import { createHash, randomUUID } from 'node:crypto';
import type { PlatformModels } from '../db/models';
import { ConflictError, ValidationError } from '../domain/errors';

type ActionResult<T> = { statusCode: number; body: T };

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(',')}}`;
}

export class IdempotencyService {
  constructor(private readonly models: PlatformModels) {}

  async execute<T>(options: {
    key: string | string[] | undefined;
    apiUserId: string;
    operation: string;
    requestBody: unknown;
    action: () => Promise<ActionResult<T>>;
  }): Promise<ActionResult<T> & { replayed: boolean }> {
    if (options.key === undefined) return { ...(await options.action()), replayed: false };
    if (Array.isArray(options.key) || !/^[\x21-\x7E]{1,128}$/.test(options.key)) {
      throw new ValidationError('Idempotency-Key must contain 1–128 visible ASCII characters');
    }

    const requestHash = createHash('sha256').update(canonicalize(options.requestBody)).digest('hex');
    const existing = await this.models.IdempotencyKey.findOne({
      where: { apiUserId: options.apiUserId, key: options.key },
    });
    if (existing) {
      const expiresAt = existing.get('expiresAt') as Date;
      if (expiresAt.getTime() <= Date.now()) {
        await existing.destroy();
      } else {
        if (existing.get('operation') !== options.operation || existing.get('requestHash') !== requestHash) {
          throw new ConflictError('Idempotency-Key was already used for a different request');
        }
        const responseJson = existing.get('responseJson') as string | null;
        if (!responseJson) throw new ConflictError('The idempotent request is still in progress');
        return {
          statusCode: existing.get('statusCode') as number,
          body: JSON.parse(responseJson) as T,
          replayed: true,
        };
      }
    }

    let record;
    try {
      record = await this.models.IdempotencyKey.create({
        id: randomUUID(),
        apiUserId: options.apiUserId,
        key: options.key,
        operation: options.operation,
        requestHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch (error) {
      if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
        return this.execute(options);
      }
      throw error;
    }

    try {
      const result = await options.action();
      await record.update({ statusCode: result.statusCode, responseJson: JSON.stringify(result.body) });
      return { ...result, replayed: false };
    } catch (error) {
      await record.destroy().catch(() => {});
      throw error;
    }
  }
}
