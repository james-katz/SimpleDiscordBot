import type { FastifyInstance } from 'fastify';
import type { RunService } from '../../services/run-service';

const paginationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    cursor: { type: 'string', minLength: 1, maxLength: 1024 },
  },
} as const;

type Pagination = { limit?: number; cursor?: string; seasonId?: string };
type IdParams = { triviaId?: string; runId?: string; publicUserId?: string };

export async function registerRankingRoutes(app: FastifyInstance, runs: RunService) {
  app.get('/api/v1/public/trivia-runs', {
    schema: { querystring: paginationSchema },
  }, async (request, reply) => {
    const { limit, cursor } = request.query as Pagination;
    reply.header('Cache-Control', 'public, max-age=15');
    return { data: await runs.listCompletedRuns(limit, cursor) };
  });

  app.get('/api/v1/public/trivia-runs/:runId/rankings', {
    schema: { querystring: paginationSchema },
  }, async (request, reply) => {
    const { runId } = request.params as Required<Pick<IdParams, 'runId'>>;
    const { limit, cursor } = request.query as Pagination;
    reply.header('Cache-Control', 'public, max-age=15');
    return { data: await runs.rankings({ type: 'run', id: runId }, limit, cursor) };
  });

  app.get('/api/v1/public/trivias/:triviaId/rankings', {
    schema: { querystring: paginationSchema },
  }, async (request, reply) => {
    const { triviaId } = request.params as Required<Pick<IdParams, 'triviaId'>>;
    const { limit, cursor } = request.query as Pagination;
    reply.header('Cache-Control', 'public, max-age=15');
    return { data: await runs.rankings({ type: 'trivia', id: triviaId }, limit, cursor) };
  });

  app.get('/api/v1/public/rankings/overall', {
    schema: {
      querystring: {
        ...paginationSchema,
        properties: {
          ...paginationSchema.properties,
          seasonId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { limit, cursor, seasonId } = request.query as Pagination;
    reply.header('Cache-Control', 'public, max-age=15');
    return { data: await runs.rankings({ type: 'overall', seasonId }, limit, cursor) };
  });

  app.get('/api/v1/public/users/:publicUserId/stats', async (request, reply) => {
    const { publicUserId } = request.params as Required<Pick<IdParams, 'publicUserId'>>;
    reply.header('Cache-Control', 'public, max-age=30');
    return { data: await runs.getPublicUserStats(publicUserId) };
  });
}
