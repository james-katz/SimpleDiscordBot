import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../config/env';
import type { AuthService } from '../../services/auth-service';
import { authenticate } from '../auth';

const credentialsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 64 },
    password: { type: 'string', minLength: 12, maxLength: 256 },
  },
} as const;

export async function registerAuthRoutes(app: FastifyInstance, auth: AuthService, config: AppConfig) {
  const cookieOptions = {
    path: '/api/v1/auth',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: config.cookieSecure,
  };

  app.post('/api/v1/auth/login', {
    schema: { body: credentialsSchema },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = request.body as { username: string; password: string };
    const session = await auth.login(body.username, body.password);
    reply.setCookie('zecquiz_refresh', session.refreshToken, {
      ...cookieOptions,
      expires: session.refreshTokenExpiresAt,
    });
    return {
      accessToken: session.accessToken,
      expiresIn: session.accessTokenExpiresIn,
      user: session.user,
    };
  });

  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const session = await auth.refresh(request.cookies.zecquiz_refresh ?? '');
    reply.setCookie('zecquiz_refresh', session.refreshToken, {
      ...cookieOptions,
      expires: session.refreshTokenExpiresAt,
    });
    return {
      accessToken: session.accessToken,
      expiresIn: session.accessTokenExpiresIn,
      user: session.user,
    };
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    await auth.logout(request.cookies.zecquiz_refresh);
    reply.clearCookie('zecquiz_refresh', cookieOptions);
    return reply.code(204).send();
  });

  app.get('/api/v1/auth/me', { preHandler: authenticate(config) }, async (request) => {
    return { data: await auth.getUser(request.auth.sub) };
  });
}
