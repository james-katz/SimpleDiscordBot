import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import type { PlatformModels } from '../db/models';
import { decodeCursor, encodeCursor } from '../domain/pagination/cursor';
import { ConflictError, NotFoundError, ValidationError } from '../domain/errors';

export class RankingSeasonService {
  constructor(private readonly models: PlatformModels) {}

  async list(limit = 50, cursor?: string) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const decoded = decodeCursor<{ createdAt: string; id: string }>(cursor);
    if (decoded && (typeof decoded.createdAt !== 'string' || typeof decoded.id !== 'string' || Number.isNaN(Date.parse(decoded.createdAt)))) {
      throw new ValidationError('Pagination cursor is invalid');
    }
    const where = decoded ? {
      [Op.or]: [
        { createdAt: { [Op.lt]: new Date(decoded.createdAt) } },
        { createdAt: new Date(decoded.createdAt), id: { [Op.gt]: decoded.id } },
      ],
    } : {};
    const [total, rows] = await Promise.all([
      this.models.RankingSeason.count(),
      this.models.RankingSeason.findAll({
        where,
        order: [['createdAt', 'DESC'], ['id', 'ASC']],
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
        createdAt: (last.get('createdAt') as Date).toISOString(),
        id: last.get('id') as string,
      }) : null,
    };
  }

  async create(input: { name: string; startsAt?: string; endsAt?: string | null; activate?: boolean }, apiUserId: string) {
    const name = input.name?.trim();
    if (!name || name.length > 120) throw new ValidationError('Season name must contain 1–120 characters');
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      throw new ValidationError('Season dates must be valid ISO timestamps');
    }
    if (endsAt && endsAt <= startsAt) throw new ValidationError('Season end must be after its start');

    const id = randomUUID();
    await this.models.RankingSeason.sequelize!.transaction(async (transaction) => {
      if (input.activate) await this.models.RankingSeason.update({ isActive: false }, { where: { isActive: true }, transaction });
      await this.models.RankingSeason.create({
        id,
        name,
        startsAt,
        endsAt,
        isActive: input.activate === true,
        createdByApiUserId: apiUserId,
      }, { transaction });
      await this.audit(apiUserId, 'ranking-season.create', 'ranking-season', id, transaction);
    });
    return this.get(id);
  }

  async activate(id: string, apiUserId: string) {
    await this.models.RankingSeason.sequelize!.transaction(async (transaction) => {
      const season = await this.models.RankingSeason.findByPk(id, { transaction });
      if (!season) throw new NotFoundError('Ranking season');
      const endsAt = season.get('endsAt') as Date | null;
      if (endsAt && endsAt <= new Date()) throw new ConflictError('A closed ranking season cannot be activated');
      await this.models.RankingSeason.update({ isActive: false }, { where: { isActive: true }, transaction });
      await season.update({ isActive: true }, { transaction });
      await this.audit(apiUserId, 'ranking-season.activate', 'ranking-season', id, transaction);
    });
    return this.get(id);
  }

  async close(id: string, apiUserId: string) {
    await this.models.RankingSeason.sequelize!.transaction(async (transaction) => {
      const season = await this.models.RankingSeason.findByPk(id, { transaction });
      if (!season) throw new NotFoundError('Ranking season');
      await season.update({ isActive: false, endsAt: season.get('endsAt') ?? new Date() }, { transaction });
      await this.audit(apiUserId, 'ranking-season.close', 'ranking-season', id, transaction);
    });
    return this.get(id);
  }

  async excludeRun(runId: string, reason: string, apiUserId: string) {
    const normalized = reason?.trim();
    if (!normalized || normalized.length > 500) throw new ValidationError('Exclusion reason must contain 1–500 characters');
    await this.models.TriviaRun.sequelize!.transaction(async (transaction) => {
      const [changed] = await this.models.TriviaRun.update({
        eligibleForOverall: false,
        rankingExclusionReason: normalized,
        rankingExcludedAt: new Date(),
      }, { where: { id: runId }, transaction });
      if (changed !== 1) throw new NotFoundError('Trivia run');
      await this.audit(apiUserId, 'trivia-run.exclude-ranking', 'trivia-run', runId, transaction);
    });
    return { runId, excluded: true, reason: normalized };
  }

  async includeRun(runId: string, apiUserId: string) {
    await this.models.TriviaRun.sequelize!.transaction(async (transaction) => {
      const [changed] = await this.models.TriviaRun.update({
        eligibleForOverall: true,
        rankingExclusionReason: null,
        rankingExcludedAt: null,
      }, { where: { id: runId }, transaction });
      if (changed !== 1) throw new NotFoundError('Trivia run');
      await this.audit(apiUserId, 'trivia-run.include-ranking', 'trivia-run', runId, transaction);
    });
    return { runId, excluded: false };
  }

  private async get(id: string) {
    const season = await this.models.RankingSeason.findByPk(id);
    if (!season) throw new NotFoundError('Ranking season');
    return season.toJSON();
  }

  private async audit(apiUserId: string, action: string, entityType: string, entityId: string, transaction?: Transaction) {
    await this.models.AuditLog.create({
      id: randomUUID(), apiUserId, action, entityType, entityId,
    }, { transaction });
  }
}
