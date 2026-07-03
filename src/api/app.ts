import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { AppConfig } from '../config/env';
import type { PlatformModels } from '../db/models';
import { AppError } from '../domain/errors';
import { AuthService } from '../services/auth-service';
import { IdempotencyService } from '../services/idempotency-service';
import { RunService } from '../services/run-service';
import { RankingSeasonService } from '../services/ranking-season-service';
import { TriviaService } from '../services/trivia-service';
import { registerAuthRoutes } from './routes/auth-routes';
import { registerRankingRoutes } from './routes/ranking-routes';
import { registerRankingSeasonRoutes } from './routes/ranking-season-routes';
import { registerTriviaRoutes } from './routes/trivia-routes';

export async function buildApi(config: AppConfig, models: PlatformModels): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.nodeEnv === 'test' ? false : {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
    },
    bodyLimit: 1024 * 1024,
    requestTimeout: 15_000,
  });

  await app.register(cookie);
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: true,
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      info: { title: 'ZecQuiz API', version: '1.0.0' },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).type('application/problem+json').send({
        type: `https://zecquiz.local/problems/${error.code.toLowerCase()}`,
        title: error.message,
        status: error.statusCode,
        code: error.code,
        detail: error.message,
        instance: request.url,
        ...(error.details === undefined ? {} : { errors: error.details }),
      });
    }

    const validationError = error as { validation?: unknown; message?: string };
    if (validationError.validation) {
      return reply.code(400).type('application/problem+json').send({
        type: 'https://zecquiz.local/problems/validation-error',
        title: 'Request validation failed',
        status: 400,
        code: 'VALIDATION_ERROR',
        detail: validationError.message ?? 'Request validation failed',
        instance: request.url,
        errors: validationError.validation,
      });
    }

    request.log.error({ err: error }, 'Unhandled API error');
    return reply.code(500).type('application/problem+json').send({
      type: 'https://zecquiz.local/problems/internal-error',
      title: 'Internal server error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'The request could not be completed',
      instance: request.url,
    });
  });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await models.ApiUser.sequelize!.authenticate();
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'not-ready' });
    }
  });

  await registerAuthRoutes(app, new AuthService(models, config), config);
  await registerTriviaRoutes(app, new TriviaService(models), new IdempotencyService(models), config);
  await registerRankingRoutes(app, new RunService(models));
  await registerRankingSeasonRoutes(app, new RankingSeasonService(models), config);
  return app;
}
