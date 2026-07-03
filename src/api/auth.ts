import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../config/env';
import type { AccessTokenClaims } from '../domain/auth/tokens';
import { verifyAccessToken } from '../domain/auth/tokens';
import { UnauthorizedError } from '../domain/errors';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AccessTokenClaims;
  }
}

export function authenticate(config: AppConfig) {
  return async function authHook(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedError();
    request.auth = verifyAccessToken(authorization.slice(7), config);
  };
}
