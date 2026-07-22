import { randomInt, randomUUID } from 'node:crypto';
import { Op, QueryTypes, type Transaction } from 'sequelize';
import type { PlatformModels } from '../db/models';
import { ConflictError, NotFoundError } from '../domain/errors';
import { ValidationError } from '../domain/errors';
import { decodeCursor, encodeCursor } from '../domain/pagination/cursor';

export type DiscordIdentity = {
  discordUserId: string;
  username: string;
  displayName: string;
  avatarHash?: string | null;
};

type RankingScope =
  | { type: 'run'; id: string }
  | { type: 'trivia'; id: string }
  | { type: 'overall'; seasonId?: string };

export class RunService {
  constructor(private readonly models: PlatformModels) {}

  async listPublishedForAutocomplete(search: string, limit = 25) {
    const where: any = { status: 'published' };
    if (search.trim()) where.name = { [Op.like]: `%${search.trim()}%` };
    const rows = await this.models.Trivia.findAll({
      where,
      attributes: ['id', 'name'],
      limit: Math.min(limit, 25),
      order: [['name', 'ASC']],
    });
    return rows.map((row) => ({ id: row.get('id') as string, name: row.get('name') as string }));
  }

  async createRun(triviaId: string, guildId: string, channelId: string, moderator: DiscordIdentity) {
    return this.models.Trivia.sequelize!.transaction(async (transaction) => {
      const existing = await this.models.TriviaRun.findOne({
        where: { channelId, status: { [Op.in]: ['waiting', 'in_progress', 'between_questions'] } },
        transaction,
      });
      if (existing) throw new ConflictError('This channel already has an active trivia run');

      const trivia = await this.models.Trivia.findOne({
        where: { id: triviaId, status: 'published' },
        include: [{
          model: this.models.Question,
          as: 'questions',
          separate: true,
          order: [['position', 'ASC']],
          include: [{ model: this.models.QuestionOption, as: 'options' }],
        }],
        transaction,
      });
      if (!trivia) throw new NotFoundError('Published trivia');
      const snapshot = trivia.toJSON() as any;
      if (!snapshot.questions?.length) throw new ConflictError('Trivia contains no questions');

      const user = await this.upsertDiscordUser(moderator, transaction);
      const activeSeason = await this.models.RankingSeason.findOne({ where: { isActive: true }, transaction });
      const runId = randomUUID();
      await this.models.TriviaRun.create({
        id: runId,
        triviaId,
        triviaVersion: trivia.get('version'),
        status: 'waiting',
        guildId,
        channelId,
        startedByDiscordUserId: user.get('id'),
        eligibleForOverall: true,
        rankingSeasonId: activeSeason?.get('id') ?? null,
      }, { transaction });

      for (const question of snapshot.questions.sort((a: any, b: any) => a.position - b.position)) {
        const runQuestionId = randomUUID();
        await this.models.RunQuestion.create({
          id: runQuestionId,
          triviaRunId: runId,
          sourceQuestionId: question.id,
          prompt: question.prompt,
          position: question.position,
          durationSeconds: question.durationSeconds ?? snapshot.defaultQuestionDurationSeconds,
          points: question.points,
          prize: question.prize,
          status: 'pending',
        }, { transaction });

        const options = this.shuffle([...question.options].sort((a: any, b: any) => a.position - b.position));
        await this.models.RunQuestionOption.bulkCreate(options.map((option: any, position: number) => ({
          id: randomUUID(),
          runQuestionId,
          sourceOptionId: option.id,
          text: option.text,
          position,
          isCorrect: option.isCorrect,
        })), { transaction });
      }

      await this.audit('trivia-run.create', 'trivia-run', runId, {
        triviaId, guildId, channelId, rankingSeasonId: activeSeason?.get('id') ?? null,
      }, transaction);

      return {
        id: runId,
        triviaId,
        name: snapshot.name as string,
        description: snapshot.description as string,
        language: snapshot.language as string,
        questionCount: snapshot.questions.length as number,
        defaultQuestionDurationSeconds: snapshot.defaultQuestionDurationSeconds as number,
        status: 'waiting' as const,
      };
    });
  }

  async setMessageIds(runId: string, values: { introMessageId?: string; controlMessageId?: string }) {
    await this.models.TriviaRun.update(values, { where: { id: runId } });
  }

  async setQuestionMessageId(questionId: string, messageId: string) {
    await this.models.RunQuestion.update({ messageId }, { where: { id: questionId } });
  }

  async startRun(runId: string, now = new Date()) {
    return this.models.Trivia.sequelize!.transaction(async (transaction) => {
      const [changed] = await this.models.TriviaRun.update({
        status: 'in_progress',
        startedAt: now,
        currentQuestionPosition: 0,
      }, { where: { id: runId, status: 'waiting' }, transaction });
      if (changed !== 1) throw new ConflictError('Trivia run is no longer waiting to start');
      const question = await this.openQuestion(runId, 0, now, transaction);
      await this.audit('trivia-run.start', 'trivia-run', runId, { questionId: question.id }, transaction);
      return question;
    });
  }

  async nextQuestion(runId: string, now = new Date()) {
    return this.models.Trivia.sequelize!.transaction(async (transaction) => {
      const run = await this.models.TriviaRun.findByPk(runId, { transaction });
      if (!run) throw new NotFoundError('Trivia run');
      if (run.get('status') !== 'between_questions') throw new ConflictError('Trivia run is not ready for the next question');
      const nextPosition = (run.get('currentQuestionPosition') as number) + 1;
      const [changed] = await this.models.TriviaRun.update({
        status: 'in_progress',
        currentQuestionPosition: nextPosition,
      }, { where: { id: runId, status: 'between_questions' }, transaction });
      if (changed !== 1) throw new ConflictError('Trivia run state changed');
      const question = await this.openQuestion(runId, nextPosition, now, transaction);
      await this.audit('trivia-run.next-question', 'trivia-run', runId, {
        questionId: question.id, position: nextPosition,
      }, transaction);
      return question;
    });
  }

  async submitAnswer(runQuestionId: string, runOptionId: string, identity: DiscordIdentity, now = new Date()) {
    return this.models.Trivia.sequelize!.transaction(async (transaction) => {
      const question = await this.models.RunQuestion.findOne({
        where: { id: runQuestionId, status: 'open', closesAt: { [Op.gt]: now } },
        include: [{
          model: this.models.TriviaRun,
          as: 'run',
          include: [{ model: this.models.Trivia, as: 'trivia', attributes: ['language'] }],
        }],
        transaction,
      });
      if (!question) throw new ConflictError('This question is closed');
      const option = await this.models.RunQuestionOption.findOne({
        where: { id: runOptionId, runQuestionId },
        transaction,
      });
      if (!option) throw new NotFoundError('Answer option');
      const user = await this.upsertDiscordUser(identity, transaction);

      try {
        await this.models.Response.create({
          id: randomUUID(),
          triviaRunId: question.get('triviaRunId'),
          runQuestionId,
          discordUserId: user.get('id'),
          selectedRunOptionId: runOptionId,
          isCorrect: option.get('isCorrect'),
          pointsAwarded: option.get('isCorrect') ? question.get('points') : 0,
          answeredAt: now,
        }, { transaction });
      } catch (error) {
        if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
          throw new ConflictError('Your answer for this question is already recorded');
        }
        throw error;
      }
      const json = question.toJSON() as any;
      return { recorded: true, language: json.run?.trivia?.language as string | undefined };
    });
  }

  async closeQuestion(runQuestionId: string, now = new Date()) {
    return this.models.Trivia.sequelize!.transaction(async (transaction) => {
      const question = await this.models.RunQuestion.findByPk(runQuestionId, {
        include: [{ model: this.models.RunQuestionOption, as: 'options' }],
        transaction,
      });
      if (!question) throw new NotFoundError('Run question');
      if (question.get('status') === 'closed' && question.get('scoredAt')) {
        const run = await this.models.TriviaRun.findByPk(question.get('triviaRunId') as string, { transaction });
        return this.getClosedQuestionResult(
          question.get('triviaRunId') as string,
          runQuestionId,
          run?.get('status') === 'completed',
          transaction,
        );
      }
      const closesAt = question.get('closesAt') as Date | null;
      if (question.get('status') !== 'open' || !closesAt || closesAt.getTime() > now.getTime()) {
        throw new ConflictError('Question is not due to close');
      }

      const [claimed] = await this.models.RunQuestion.update({
        status: 'closed',
        closedAt: now,
        scoredAt: now,
      }, {
        where: { id: runQuestionId, status: 'open', scoredAt: null },
        transaction,
      });
      if (claimed !== 1) throw new ConflictError('Question is not open');

      const responses = await this.models.Response.findAll({ where: { runQuestionId }, transaction });
      for (const response of responses) {
        const [score] = await this.models.RunScore.findOrCreate({
          where: {
            triviaRunId: response.get('triviaRunId'),
            discordUserId: response.get('discordUserId'),
          },
          defaults: {
            id: randomUUID(),
            correctAnswers: 0,
            wrongAnswers: 0,
            answeredQuestions: 0,
            totalPoints: 0,
          },
          transaction,
        });
        await score.increment({
          answeredQuestions: 1,
          correctAnswers: response.get('isCorrect') ? 1 : 0,
          wrongAnswers: response.get('isCorrect') ? 0 : 1,
          totalPoints: response.get('pointsAwarded') as number,
        }, { transaction });
      }

      const runId = question.get('triviaRunId') as string;
      const pending = await this.models.RunQuestion.count({ where: { triviaRunId: runId, status: 'pending' }, transaction });
      const completed = pending === 0;
      await this.models.TriviaRun.update(completed ? {
        status: 'completed',
        completedAt: now,
      } : {
        status: 'between_questions',
      }, { where: { id: runId }, transaction });

      // Auto-archive the parent trivia when the run finishes
      if (completed) {
        const run = await this.models.TriviaRun.findByPk(runId, { attributes: ['triviaId'], transaction });
        if (run) {
          await this.models.Trivia.update(
            { status: 'archived', archivedAt: now },
            { where: { id: run.get('triviaId') as string, status: 'published' }, transaction },
          );
        }
      }

      await this.audit('trivia-run.question-close', 'run-question', runQuestionId, {
        runId, completed, responseCount: responses.length,
      }, transaction);
      if (completed) await this.audit('trivia-run.complete', 'trivia-run', runId, undefined, transaction);

      return this.getClosedQuestionResult(runId, runQuestionId, completed, transaction);
    });
  }

  async cancelRun(runId: string, now = new Date()) {
    return this.models.TriviaRun.sequelize!.transaction(async (transaction) => {
      const [changed] = await this.models.TriviaRun.update({ status: 'cancelled', cancelledAt: now }, {
        where: { id: runId, status: { [Op.in]: ['waiting', 'in_progress', 'between_questions'] } },
        transaction,
      });
      if (changed !== 1) throw new ConflictError('Trivia run cannot be cancelled');
      await this.audit('trivia-run.cancel', 'trivia-run', runId, undefined, transaction);
    });
  }

  async findDueQuestions(now = new Date()) {
    const rows = await this.models.RunQuestion.findAll({
      where: { status: 'open', scoredAt: null, closesAt: { [Op.lte]: now } },
      attributes: ['id'],
      order: [['closesAt', 'ASC']],
      limit: 100,
    });
    return rows.map((row) => row.get('id') as string);
  }

  async findPendingResultPresentations() {
    const rows = await this.models.RunQuestion.findAll({
      where: { status: 'closed', scoredAt: { [Op.ne]: null }, resultPublishedAt: null },
      attributes: ['id', 'triviaRunId', 'position'],
      order: [['closedAt', 'ASC']],
      limit: 100,
    });
    return Promise.all(rows.map(async (row) => {
      const run = await this.models.TriviaRun.findByPk(row.get('triviaRunId') as string, { attributes: ['status'] });
      const laterQuestions = await this.models.RunQuestion.count({
        where: {
          triviaRunId: row.get('triviaRunId'),
          position: { [Op.gt]: row.get('position') as number },
        },
      });
      return this.getClosedQuestionResult(
        row.get('triviaRunId') as string,
        row.get('id') as string,
        run?.get('status') === 'completed' && laterQuestions === 0,
      );
    }));
  }

  async markResultPublished(questionId: string, now = new Date()) {
    await this.models.RunQuestion.update({ resultPublishedAt: now }, {
      where: { id: questionId, status: 'closed', resultPublishedAt: null },
    });
  }

  async getRun(runId: string) {
    const run = await this.models.TriviaRun.findByPk(runId, {
      include: [{ model: this.models.Trivia, as: 'trivia', attributes: ['id', 'name', 'description', 'language'] }],
    });
    if (!run) throw new NotFoundError('Trivia run');
    return run.toJSON();
  }

  async getActiveRun(channelId: string) {
    const run = await this.models.TriviaRun.findOne({
      where: { channelId, status: { [Op.in]: ['waiting', 'in_progress', 'between_questions'] } },
      include: [{ model: this.models.Trivia, as: 'trivia', attributes: ['id', 'name', 'description', 'language'] }],
      order: [['createdAt', 'DESC']],
    });
    if (!run) throw new NotFoundError('Active trivia run');
    return run.toJSON();
  }

  async getQuestionForDisplay(questionId: string) {
    const question = await this.models.RunQuestion.findByPk(questionId, {
      include: [{ model: this.models.RunQuestionOption, as: 'options' }],
    });
    if (!question) throw new NotFoundError('Run question');
    const run = await this.models.TriviaRun.findByPk(question.get('triviaRunId') as string, {
      include: [{ model: this.models.Trivia, as: 'trivia', attributes: ['name', 'language'] }],
    });
    if (!run) throw new NotFoundError('Trivia run');
    const participants = await this.models.Response.sequelize!.query<Record<string, unknown>>(`
      SELECT du.discord_user_id AS discordUserId, r.is_correct AS isCorrect
      FROM responses r
      JOIN discord_users du ON du.id = r.discord_user_id
      WHERE r.run_question_id = :questionId
      ORDER BY r.answered_at ASC
    `, { replacements: { questionId }, type: QueryTypes.SELECT });
    const json = question.toJSON() as any;
    json.options.sort((a: any, b: any) => a.position - b.position);
    return { ...json, run: run.toJSON(), participants };
  }

  async listCompletedRuns(limit = 50, cursor?: string) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const decoded = decodeCursor<{ completedAt: string; id: string }>(cursor);
    if (decoded && (typeof decoded.completedAt !== 'string' || typeof decoded.id !== 'string' || Number.isNaN(Date.parse(decoded.completedAt)))) {
      throw new ValidationError('Pagination cursor is invalid');
    }
    const baseWhere = { status: 'completed' };
    const where = {
      ...baseWhere,
      ...(decoded ? {
        [Op.or]: [
          { completedAt: { [Op.lt]: new Date(decoded.completedAt) } },
          { completedAt: new Date(decoded.completedAt), id: { [Op.gt]: decoded.id } },
        ],
      } : {}),
    };
    const [total, rows] = await Promise.all([
      this.models.TriviaRun.count({ where: baseWhere }),
      this.models.TriviaRun.findAll({
      where,
      attributes: ['id', 'triviaId', 'startedAt', 'completedAt'],
      include: [{ model: this.models.Trivia, as: 'trivia', attributes: ['name', 'description'] }],
      order: [['completedAt', 'DESC'], ['id', 'ASC']],
      limit: safeLimit + 1,
      }),
    ]);
    const hasMore = rows.length > safeLimit;
    const page = rows.slice(0, safeLimit);
    const last = page.at(-1);
    return {
      items: page.map((row) => row.toJSON()),
      total,
      limit: safeLimit,
      nextCursor: hasMore && last ? encodeCursor({
        completedAt: (last.get('completedAt') as Date).toISOString(),
        id: last.get('id') as string,
      }) : null,
    };
  }

  async getPublicUserStats(publicUserId: string) {
    const user = await this.models.DiscordUser.findByPk(publicUserId, { attributes: ['id', 'displayName'] });
    if (!user) throw new NotFoundError('User');
    const rows = await this.models.RunScore.sequelize!.query<Record<string, unknown>>(`
      SELECT
        COALESCE(SUM(rs.total_points), 0) AS totalPoints,
        COALESCE(SUM(rs.correct_answers), 0) AS correctAnswers,
        COALESCE(SUM(rs.wrong_answers), 0) AS wrongAnswers,
        COALESCE(SUM(rs.answered_questions), 0) AS answeredQuestions,
        COUNT(DISTINCT rs.trivia_run_id) AS runsPlayed
      FROM run_scores rs
      JOIN trivia_runs r ON r.id = rs.trivia_run_id
      WHERE rs.discord_user_id = :userId
        AND r.status = 'completed'
        AND r.eligible_for_overall = 1
    `, { replacements: { userId: publicUserId }, type: QueryTypes.SELECT });
    return { publicUserId: user.get('id'), displayName: user.get('displayName'), ...rows[0] };
  }

  async rankings(scope: RankingScope, limit = 50, cursor?: string) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const decoded = decodeCursor<{
      totalPoints: number;
      correctAnswers: number;
      wrongAnswers: number;
      publicUserId: string;
      rank: number;
    }>(cursor);
    if (decoded && (
      !Number.isFinite(decoded.totalPoints)
      || !Number.isFinite(decoded.correctAnswers)
      || !Number.isFinite(decoded.wrongAnswers)
      || !Number.isInteger(decoded.rank)
      || typeof decoded.publicUserId !== 'string'
    )) throw new ValidationError('Pagination cursor is invalid');

    let where = "r.status = 'completed' AND r.eligible_for_overall = 1";
    const replacements: Record<string, unknown> = { limit: safeLimit + 1 };
    if (scope.type === 'run') {
      where = "rs.trivia_run_id = :scopeId AND r.status = 'completed'";
      replacements.scopeId = scope.id;
    } else if (scope.type === 'trivia') {
      where = "r.trivia_id = :scopeId AND r.status = 'completed'";
      replacements.scopeId = scope.id;
    } else if (scope.seasonId) {
      where += ' AND r.ranking_season_id = :seasonId';
      replacements.seasonId = scope.seasonId;
    }

    const aggregateSql = `
      SELECT
        du.id AS publicUserId,
        du.display_name AS displayName,
        SUM(rs.total_points) AS totalPoints,
        SUM(rs.correct_answers) AS correctAnswers,
        SUM(rs.wrong_answers) AS wrongAnswers,
        SUM(rs.answered_questions) AS answeredQuestions
      FROM run_scores rs
      JOIN trivia_runs r ON r.id = rs.trivia_run_id
      JOIN discord_users du ON du.id = rs.discord_user_id
      WHERE ${where}
      GROUP BY du.id, du.display_name
    `;
    const cursorWhere = decoded ? `
      WHERE totalPoints < :cursorPoints
        OR (totalPoints = :cursorPoints AND correctAnswers < :cursorCorrect)
        OR (totalPoints = :cursorPoints AND correctAnswers = :cursorCorrect AND wrongAnswers > :cursorWrong)
        OR (totalPoints = :cursorPoints AND correctAnswers = :cursorCorrect AND wrongAnswers = :cursorWrong AND publicUserId > :cursorUserId)
    ` : '';
    if (decoded) Object.assign(replacements, {
      cursorPoints: decoded.totalPoints,
      cursorCorrect: decoded.correctAnswers,
      cursorWrong: decoded.wrongAnswers,
      cursorUserId: decoded.publicUserId,
    });

    const items = await this.models.RunScore.sequelize!.query(`
      WITH aggregated AS (${aggregateSql})
      SELECT * FROM aggregated
      ${cursorWhere}
      ORDER BY totalPoints DESC, correctAnswers DESC, wrongAnswers ASC, publicUserId ASC
      LIMIT :limit
    `, { replacements, type: QueryTypes.SELECT });

    const totalRows = await this.models.RunScore.sequelize!.query<{ total: number }>(`
      WITH aggregated AS (${aggregateSql})
      SELECT COUNT(*) AS total FROM aggregated
    `, { replacements, type: QueryTypes.SELECT });

    const hasMore = items.length > safeLimit;
    const page = (items as Array<Record<string, unknown>>).slice(0, safeLimit);
    const startingRank = decoded?.rank ?? 0;
    const rankedItems = page.map((item, index) => ({
      rank: startingRank + index + 1,
      publicUserId: String(item.publicUserId),
      displayName: String(item.displayName),
      totalPoints: Number(item.totalPoints),
      correctAnswers: Number(item.correctAnswers),
      wrongAnswers: Number(item.wrongAnswers),
      answeredQuestions: Number(item.answeredQuestions),
    }));
    const last = rankedItems.at(-1) as Record<string, unknown> | undefined;
    return {
      items: rankedItems,
      total: Number(totalRows[0]?.total ?? 0),
      limit: safeLimit,
      nextCursor: hasMore && last ? encodeCursor({
        totalPoints: Number(last.totalPoints),
        correctAnswers: Number(last.correctAnswers),
        wrongAnswers: Number(last.wrongAnswers),
        publicUserId: last.publicUserId,
        rank: last.rank,
      }) : null,
    };
  }

  private async openQuestion(runId: string, position: number, now: Date, transaction: Transaction) {
    const question = await this.models.RunQuestion.findOne({
      where: { triviaRunId: runId, position, status: 'pending' },
      include: [
        { model: this.models.RunQuestionOption, as: 'options' },
        {
          model: this.models.TriviaRun,
          as: 'run',
          include: [{ model: this.models.Trivia, as: 'trivia', attributes: ['language'] }],
        },
      ],
      transaction,
    });
    if (!question) throw new NotFoundError('Next run question');
    const closesAt = new Date(now.getTime() + (question.get('durationSeconds') as number) * 1000);
    await question.update({ status: 'open', openedAt: now, closesAt }, { transaction });
    return { ...question.toJSON(), closesAt };
  }

  private async getClosedQuestionResult(runId: string, questionId: string, completed: boolean, transaction?: Transaction) {
    const question = await this.models.RunQuestion.findByPk(questionId, {
      include: [{ model: this.models.RunQuestionOption, as: 'options' }],
      transaction,
    });
    const responses = await this.models.Response.findAll({ where: { runQuestionId: questionId }, transaction });
    const correctOption = (question?.toJSON() as any)?.options?.find((option: any) => option.isCorrect);
    return {
      runId,
      questionId,
      completed,
      correctOption,
      responseCount: responses.length,
      correctCount: responses.filter((response) => response.get('isCorrect')).length,
      prize: question?.get('prize'),
    };
  }

  private async upsertDiscordUser(identity: DiscordIdentity, transaction: Transaction) {
    const existing = await this.models.DiscordUser.findOne({
      where: { discordUserId: identity.discordUserId },
      transaction,
    });
    const values = {
      username: identity.username,
      displayName: identity.displayName,
      avatarHash: identity.avatarHash ?? null,
      lastSeenAt: new Date(),
    };
    if (existing) {
      await existing.update(values, { transaction });
      return existing;
    }
    return this.models.DiscordUser.create({
      id: randomUUID(),
      discordUserId: identity.discordUserId,
      ...values,
    }, { transaction });
  }

  private shuffle<T>(values: T[]): T[] {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const replacement = randomInt(index + 1);
      [values[index], values[replacement]] = [values[replacement]!, values[index]!];
    }
    return values;
  }

  private async audit(
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown> | undefined,
    transaction?: Transaction,
  ) {
    await this.models.AuditLog.create({
      id: randomUUID(),
      apiUserId: null,
      action,
      entityType,
      entityId,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    }, { transaction });
  }
}
