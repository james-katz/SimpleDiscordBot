import { randomUUID } from 'node:crypto';
import { Op, type Model, type Transaction } from 'sequelize';
import type { PlatformModels } from '../db/models';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors';
import {
  validateQuestion,
  validateTrivia,
  validateTriviaPatch,
  type QuestionInput,
  type TriviaInput,
} from '../domain/trivia/validation';
import { decodeCursor, encodeCursor } from '../domain/pagination/cursor';

type JsonObject = Record<string, unknown>;

export class TriviaService {
  constructor(private readonly models: PlatformModels) {}

  async list({ status, isLegacy, limit = 50, cursor }: { status?: string; isLegacy?: boolean; limit?: number; cursor?: string } = {}) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const decoded = decodeCursor<{ createdAt: string; id: string }>(cursor);
    if (decoded && (typeof decoded.createdAt !== 'string' || typeof decoded.id !== 'string' || Number.isNaN(Date.parse(decoded.createdAt)))) {
      throw new ValidationError('Pagination cursor is invalid');
    }
    const baseWhere = { ...(status ? { status } : {}), ...(isLegacy === undefined ? {} : { isLegacy }) };
    const where = {
      ...baseWhere,
      ...(decoded ? {
        [Op.or]: [
          { createdAt: { [Op.lt]: new Date(decoded.createdAt) } },
          { createdAt: new Date(decoded.createdAt), id: { [Op.gt]: decoded.id } },
        ],
      } : {}),
    };
    const [total, resultRows] = await Promise.all([
      this.models.Trivia.count({ where: baseWhere }),
      this.models.Trivia.findAll({
        where,
        limit: safeLimit + 1,
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
        attributes: { exclude: ['createdByApiUserId'] },
      }),
    ]);
    const hasMore = resultRows.length > safeLimit;
    const rows = resultRows.slice(0, safeLimit);
    const last = rows.at(-1);
    return {
      items: rows.map((row) => row.toJSON()),
      total,
      limit: safeLimit,
      nextCursor: hasMore && last ? encodeCursor({
        createdAt: (last.get('createdAt') as Date).toISOString(),
        id: last.get('id') as string,
      }) : null,
    };
  }

  async get(id: string, publicView = false): Promise<JsonObject> {
    const trivia = await this.findFull(id);
    const json = trivia.toJSON() as JsonObject;
    if (publicView) {
      if (trivia.get('status') !== 'published' || trivia.get('isLegacy')) throw new NotFoundError('Trivia');
      return {
        id: json.id,
        name: json.name,
        description: json.description,
        language: json.language,
        defaultQuestionDurationSeconds: json.defaultQuestionDurationSeconds,
        publishedAt: json.publishedAt,
        questionCount: Array.isArray(json.questions) ? json.questions.length : 0,
      };
    }
    return json;
  }

  async create(input: TriviaInput, apiUserId: string): Promise<JsonObject> {
    const valid = validateTrivia(input);
    const triviaId = randomUUID();

    await this.models.Trivia.sequelize!.transaction(async (transaction) => {
      await this.models.Trivia.create({
        id: triviaId,
        name: valid.name,
        description: valid.description,
        language: valid.language,
        status: 'draft',
        defaultQuestionDurationSeconds: valid.defaultQuestionDurationSeconds,
        version: 1,
        isLegacy: false,
        createdByApiUserId: apiUserId,
      }, { transaction });

      for (const [index, question] of valid.questions.entries()) {
        await this.createQuestionRows(triviaId, question, index, transaction);
      }
      await this.audit(apiUserId, 'trivia.create', 'trivia', triviaId, transaction);
    });

    return this.get(triviaId);
  }

  async update(id: string, input: Record<string, unknown>, apiUserId: string): Promise<JsonObject> {
    const { patch, version } = validateTriviaPatch(input);
    const trivia = await this.findMutable(id);
    if (trivia.get('version') !== version) throw new ConflictError('Trivia was changed by another request');

    await this.models.Trivia.sequelize!.transaction(async (transaction) => {
      const [updated] = await this.models.Trivia.update(
        { ...patch, version: version + 1 },
        { where: { id, version }, transaction },
      );
      if (updated !== 1) throw new ConflictError('Trivia was changed by another request');
      await this.audit(apiUserId, 'trivia.update', 'trivia', id, transaction);
    });
    return this.get(id);
  }

  async publish(id: string, apiUserId: string): Promise<JsonObject> {
    const trivia = await this.findFull(id);
    if (trivia.get('status') === 'archived') throw new ConflictError('Archived trivia cannot be published');
    const json = trivia.toJSON() as { questions?: Array<{ options?: Array<{ isCorrect?: boolean }> }> };
    if (!json.questions?.length) throw new ValidationError('Trivia must contain at least one question');
    for (const question of json.questions) {
      if (!question.options || question.options.length < 2 || question.options.length > 4) {
        throw new ValidationError('Every question must contain between 2 and 4 options');
      }
      if (question.options.filter((option) => option.isCorrect).length !== 1) {
        throw new ValidationError('Every question must contain exactly one correct option');
      }
    }

    await this.models.Trivia.sequelize!.transaction(async (transaction) => {
      await trivia.update({
        status: 'published',
        publishedAt: trivia.get('publishedAt') ?? new Date(),
        version: (trivia.get('version') as number) + 1,
      }, { transaction });
      await this.audit(apiUserId, 'trivia.publish', 'trivia', id, transaction);
    });
    return this.get(id);
  }

  async remove(id: string, apiUserId: string): Promise<{ archived: boolean }> {
    const trivia = await this.models.Trivia.findByPk(id);
    if (!trivia) throw new NotFoundError('Trivia');
    const runCount = await this.models.TriviaRun.count({ where: { triviaId: id } });
    const archive = runCount > 0 || trivia.get('status') !== 'draft';

    await this.models.Trivia.sequelize!.transaction(async (transaction) => {
      if (archive) {
        await trivia.update({ status: 'archived', archivedAt: new Date(), version: (trivia.get('version') as number) + 1 }, { transaction });
      } else {
        await trivia.destroy({ transaction });
      }
      await this.audit(apiUserId, archive ? 'trivia.archive' : 'trivia.delete', 'trivia', id, transaction);
    });
    return { archived: archive };
  }

  async duplicate(id: string, apiUserId: string): Promise<JsonObject> {
    const source = await this.findFull(id);
    const json = source.toJSON() as any;
    return this.create({
      name: `${json.name} (copy)`,
      description: json.description,
      language: json.language,
      defaultQuestionDurationSeconds: json.defaultQuestionDurationSeconds,
      questions: (json.questions ?? []).map((question: any) => ({
        prompt: question.prompt,
        durationSeconds: question.durationSeconds,
        points: question.points,
        prize: Number(question.prize),
        options: question.options.map((option: any) => ({ text: option.text, isCorrect: option.isCorrect })),
      })),
    }, apiUserId);
  }

  async addQuestion(triviaId: string, input: QuestionInput, apiUserId: string): Promise<JsonObject> {
    await this.findMutable(triviaId);
    const valid = validateQuestion(input);
    const position = await this.models.Question.count({ where: { triviaId } });
    const questionId = randomUUID();
    await this.models.Trivia.sequelize!.transaction(async (transaction) => {
      await this.createQuestionRows(triviaId, valid, position, transaction, questionId);
      await this.bumpTrivia(triviaId, transaction);
      await this.audit(apiUserId, 'question.create', 'question', questionId, transaction);
    });
    return (await this.findQuestion(triviaId, questionId)).toJSON() as JsonObject;
  }

  async getQuestion(triviaId: string, questionId: string): Promise<JsonObject> {
    return (await this.findQuestion(triviaId, questionId)).toJSON() as JsonObject;
  }

  async replaceQuestion(triviaId: string, questionId: string, input: QuestionInput & { version?: number }, apiUserId: string): Promise<JsonObject> {
    await this.findMutable(triviaId);
    const valid = validateQuestion(input);
    const question = await this.findQuestion(triviaId, questionId);
    if (!Number.isInteger(input.version) || question.get('version') !== input.version) {
      throw new ConflictError('Question version is missing or stale');
    }

    await this.models.Trivia.sequelize!.transaction(async (transaction) => {
      await question.update({
        prompt: valid.prompt,
        durationSeconds: valid.durationSeconds,
        points: valid.points,
        prize: valid.prize,
        version: (input.version as number) + 1,
      }, { transaction });
      await this.models.QuestionOption.destroy({ where: { questionId }, transaction });
      await this.createOptionRows(questionId, valid.options, transaction);
      await this.bumpTrivia(triviaId, transaction);
      await this.audit(apiUserId, 'question.update', 'question', questionId, transaction);
    });
    return (await this.findQuestion(triviaId, questionId)).toJSON() as JsonObject;
  }

  async removeQuestion(triviaId: string, questionId: string, apiUserId: string): Promise<void> {
    await this.findMutable(triviaId);
    const question = await this.findQuestion(triviaId, questionId);
    await this.models.Trivia.sequelize!.transaction(async (transaction) => {
      await question.destroy({ transaction });
      const remaining = await this.models.Question.findAll({ where: { triviaId }, order: [['position', 'ASC']], transaction });
      for (const [position, item] of remaining.entries()) await item.update({ position }, { transaction });
      await this.bumpTrivia(triviaId, transaction);
      await this.audit(apiUserId, 'question.delete', 'question', questionId, transaction);
    });
  }

  async reorderQuestions(triviaId: string, questionIds: string[], apiUserId: string): Promise<JsonObject> {
    await this.findMutable(triviaId);
    const existing = await this.models.Question.findAll({ where: { triviaId }, attributes: ['id'] });
    const expected = new Set(existing.map((question) => question.get('id') as string));
    if (questionIds.length !== expected.size || new Set(questionIds).size !== expected.size || questionIds.some((id) => !expected.has(id))) {
      throw new ValidationError('Question order must contain every question ID exactly once');
    }

    await this.models.Trivia.sequelize!.transaction(async (transaction) => {
      // Move through temporary negative positions to avoid the unique index during swaps.
      for (const [index, id] of questionIds.entries()) {
        await this.models.Question.update({ position: -(index + 1) }, { where: { id, triviaId }, transaction });
      }
      for (const [position, id] of questionIds.entries()) {
        await this.models.Question.update({ position }, { where: { id, triviaId }, transaction });
      }
      await this.bumpTrivia(triviaId, transaction);
      await this.audit(apiUserId, 'question.reorder', 'trivia', triviaId, transaction);
    });
    return this.get(triviaId);
  }

  private async findFull(id: string): Promise<Model> {
    const trivia = await this.models.Trivia.findByPk(id, {
      include: [{
        model: this.models.Question,
        as: 'questions',
        separate: true,
        order: [['position', 'ASC']],
        include: [{ model: this.models.QuestionOption, as: 'options' }],
      }],
    });
    if (!trivia) throw new NotFoundError('Trivia');
    const json = trivia.toJSON() as any;
    for (const question of json.questions ?? []) question.options?.sort((a: any, b: any) => a.position - b.position);
    return trivia;
  }

  private async findMutable(id: string): Promise<Model> {
    const trivia = await this.models.Trivia.findByPk(id);
    if (!trivia) throw new NotFoundError('Trivia');
    if (trivia.get('status') === 'archived') throw new ConflictError('Archived trivia cannot be edited');
    const runCount = await this.models.TriviaRun.count({ where: { triviaId: id } });
    if (runCount > 0) throw new ConflictError('Trivia with runs is immutable; duplicate it to create a new revision');
    return trivia;
  }

  private async findQuestion(triviaId: string, questionId: string): Promise<Model> {
    const question = await this.models.Question.findOne({
      where: { id: questionId, triviaId },
      include: [{ model: this.models.QuestionOption, as: 'options' }],
      order: [[{ model: this.models.QuestionOption, as: 'options' }, 'position', 'ASC']],
    });
    if (!question) throw new NotFoundError('Question');
    return question;
  }

  private async createQuestionRows(
    triviaId: string,
    question: ReturnType<typeof validateQuestion>,
    position: number,
    transaction: Transaction,
    id = randomUUID(),
  ): Promise<void> {
    await this.models.Question.create({
      id,
      triviaId,
      prompt: question.prompt,
      position,
      durationSeconds: question.durationSeconds,
      points: question.points,
      prize: question.prize,
      version: 1,
    }, { transaction });
    await this.createOptionRows(id, question.options, transaction);
  }

  private async createOptionRows(questionId: string, options: Array<{ text: string; isCorrect: boolean }>, transaction: Transaction) {
    await this.models.QuestionOption.bulkCreate(options.map((option, position) => ({
      id: randomUUID(),
      questionId,
      text: option.text,
      position,
      isCorrect: option.isCorrect,
    })), { transaction });
  }

  private async bumpTrivia(id: string, transaction: Transaction) {
    await this.models.Trivia.increment('version', { by: 1, where: { id }, transaction });
  }

  private async audit(apiUserId: string, action: string, entityType: string, entityId: string, transaction: Transaction) {
    await this.models.AuditLog.create({
      id: randomUUID(),
      apiUserId,
      action,
      entityType,
      entityId,
    }, { transaction });
  }
}
