import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../config/env';
import type { QuestionInput, TriviaInput } from '../../domain/trivia/validation';
import { SUPPORTED_TRIVIA_LANGUAGES } from '../../domain/trivia/languages';
import type { TriviaService } from '../../services/trivia-service';
import type { IdempotencyService } from '../../services/idempotency-service';
import { authenticate } from '../auth';
import { questionInputSchema, questionReplaceSchema, triviaCreateSchema, triviaPatchSchema } from '../schemas/trivia';

type IdParams = { triviaId: string; questionId?: string };

export async function registerTriviaRoutes(
  app: FastifyInstance,
  service: TriviaService,
  idempotency: IdempotencyService,
  config: AppConfig,
) {
  const protectedRoute = { onRequest: authenticate(config) };

  app.get('/api/v1/trivias', {
    ...protectedRoute,
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['draft', 'published', 'archived'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          cursor: { type: 'string', minLength: 1, maxLength: 512 },
        },
      },
    },
  }, async (request) => {
    const query = request.query as { status?: string; limit?: number; cursor?: string };
    return { data: await service.list(query) };
  });

  app.post('/api/v1/trivias', {
    ...protectedRoute,
    schema: { body: triviaCreateSchema },
  }, async (request, reply) => {
    const result = await idempotency.execute({
      key: request.headers['idempotency-key'],
      apiUserId: request.auth.sub,
      operation: 'trivia.create',
      requestBody: request.body,
      action: async () => ({
        statusCode: 201,
        body: { data: await service.create(request.body as TriviaInput, request.auth.sub) },
      }),
    });
    if (result.replayed) reply.header('Idempotent-Replayed', 'true');
    return reply.code(result.statusCode).send(result.body);
  });

  app.get('/api/v1/trivias/:triviaId', protectedRoute, async (request) => {
    return { data: await service.get((request.params as IdParams).triviaId) };
  });

  app.patch('/api/v1/trivias/:triviaId', {
    ...protectedRoute,
    schema: { body: triviaPatchSchema },
  }, async (request) => {
    const { triviaId } = request.params as IdParams;
    return { data: await service.update(triviaId, request.body as Record<string, unknown>, request.auth.sub) };
  });

  app.delete('/api/v1/trivias/:triviaId', protectedRoute, async (request, reply) => {
    const result = await service.remove((request.params as IdParams).triviaId, request.auth.sub);
    return result.archived ? { data: result } : reply.code(204).send();
  });

  app.post('/api/v1/trivias/:triviaId/publish', protectedRoute, async (request, reply) => {
    const triviaId = (request.params as IdParams).triviaId;
    const result = await idempotency.execute({
      key: request.headers['idempotency-key'],
      apiUserId: request.auth.sub,
      operation: `trivia.publish:${triviaId}`,
      requestBody: {},
      action: async () => ({ statusCode: 200, body: { data: await service.publish(triviaId, request.auth.sub) } }),
    });
    if (result.replayed) reply.header('Idempotent-Replayed', 'true');
    return result.body;
  });

  app.post('/api/v1/trivias/:triviaId/duplicate', protectedRoute, async (request, reply) => {
    const trivia = await service.duplicate((request.params as IdParams).triviaId, request.auth.sub);
    return reply.code(201).send({ data: trivia });
  });

  app.post('/api/v1/trivias/:triviaId/questions', {
    ...protectedRoute,
    schema: { body: questionInputSchema },
  }, async (request, reply) => {
    const question = await service.addQuestion(
      (request.params as IdParams).triviaId,
      request.body as QuestionInput,
      request.auth.sub,
    );
    return reply.code(201).send({ data: question });
  });

  app.get('/api/v1/trivias/:triviaId/questions/:questionId', protectedRoute, async (request) => {
    const { triviaId, questionId } = request.params as Required<IdParams>;
    return { data: await service.getQuestion(triviaId, questionId) };
  });

  app.put('/api/v1/trivias/:triviaId/questions/:questionId', {
    ...protectedRoute,
    schema: { body: questionReplaceSchema },
  }, async (request) => {
    const { triviaId, questionId } = request.params as Required<IdParams>;
    return {
      data: await service.replaceQuestion(
        triviaId,
        questionId,
        request.body as QuestionInput & { version: number },
        request.auth.sub,
      ),
    };
  });

  app.delete('/api/v1/trivias/:triviaId/questions/:questionId', protectedRoute, async (request, reply) => {
    const { triviaId, questionId } = request.params as Required<IdParams>;
    await service.removeQuestion(triviaId, questionId, request.auth.sub);
    return reply.code(204).send();
  });

  app.put('/api/v1/trivias/:triviaId/questions/order', {
    ...protectedRoute,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['questionIds'],
        properties: {
          questionIds: { type: 'array', uniqueItems: true, items: { type: 'string', format: 'uuid' } },
        },
      },
    },
  }, async (request) => {
    const { triviaId } = request.params as IdParams;
    const { questionIds } = request.body as { questionIds: string[] };
    return { data: await service.reorderQuestions(triviaId, questionIds, request.auth.sub) };
  });

  app.get('/api/v1/public/trivias', {
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          cursor: { type: 'string', minLength: 1, maxLength: 512 },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as { limit?: number; cursor?: string };
    const result = await service.list({ ...query, status: 'published' });
    result.items = result.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        language: item.language,
        defaultQuestionDurationSeconds: item.defaultQuestionDurationSeconds,
        publishedAt: item.publishedAt,
      }));
    reply.header('Cache-Control', 'public, max-age=30');
    return { data: result };
  });

  app.get('/api/v1/public/languages', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=3600');
    return {
      data: {
        default: 'en',
        items: SUPPORTED_TRIVIA_LANGUAGES,
      },
    };
  });

  app.get('/api/v1/public/trivias/:triviaId', async (request, reply) => {
    reply.header('Cache-Control', 'public, max-age=30');
    return { data: await service.get((request.params as IdParams).triviaId, true) };
  });
}
