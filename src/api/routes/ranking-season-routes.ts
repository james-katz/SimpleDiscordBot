import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../config/env';
import type { RankingSeasonService } from '../../services/ranking-season-service';
import { authenticate } from '../auth';

export async function registerRankingSeasonRoutes(
  app: FastifyInstance,
  seasons: RankingSeasonService,
  config: AppConfig,
) {
  const protectedRoute = { onRequest: authenticate(config) };
  const paginationSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      cursor: { type: 'string', minLength: 1, maxLength: 512 },
    },
  } as const;

  app.get('/api/v1/ranking-seasons', { ...protectedRoute, schema: { querystring: paginationSchema } }, async (request) => {
    const query = request.query as { limit?: number; cursor?: string };
    return { data: await seasons.list(query.limit, query.cursor) };
  });

  app.post('/api/v1/ranking-seasons', {
    ...protectedRoute,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
          activate: { type: 'boolean', default: false },
        },
      },
    },
  }, async (request, reply) => {
    const season = await seasons.create(request.body as Parameters<RankingSeasonService['create']>[0], request.auth.sub);
    return reply.code(201).send({ data: season });
  });

  app.post('/api/v1/ranking-seasons/:seasonId/activate', protectedRoute, async (request) => {
    return { data: await seasons.activate((request.params as { seasonId: string }).seasonId, request.auth.sub) };
  });

  app.post('/api/v1/ranking-seasons/:seasonId/close', protectedRoute, async (request) => {
    return { data: await seasons.close((request.params as { seasonId: string }).seasonId, request.auth.sub) };
  });

  app.put('/api/v1/trivia-runs/:runId/ranking-exclusion', {
    ...protectedRoute,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['reason'],
        properties: { reason: { type: 'string', minLength: 1, maxLength: 500 } },
      },
    },
  }, async (request) => {
    const { reason } = request.body as { reason: string };
    return { data: await seasons.excludeRun((request.params as { runId: string }).runId, reason, request.auth.sub) };
  });

  app.delete('/api/v1/trivia-runs/:runId/ranking-exclusion', protectedRoute, async (request) => {
    return { data: await seasons.includeRun((request.params as { runId: string }).runId, request.auth.sub) };
  });

  app.get('/api/v1/public/ranking-seasons', { schema: { querystring: paginationSchema } }, async (request, reply) => {
    const query = request.query as { limit?: number; cursor?: string };
    reply.header('Cache-Control', 'public, max-age=30');
    return { data: await seasons.list(query.limit, query.cursor) };
  });
}
