import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import type { AppConfig } from '../../config/env';
import { UnauthorizedError } from '../errors';

export type AccessTokenClaims = {
  sub: string;
  role: 'admin';
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(input: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(input).digest();
}

export function createAccessToken(
  subject: string,
  config: Pick<AppConfig, 'jwtAccessSecret' | 'jwtIssuer' | 'jwtAudience' | 'accessTokenTtlSeconds'>,
  now = Math.floor(Date.now() / 1000),
): string {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const claims: AccessTokenClaims = {
    sub: subject,
    role: 'admin',
    iss: config.jwtIssuer,
    aud: config.jwtAudience,
    iat: now,
    exp: now + config.accessTokenTtlSeconds,
    jti: randomBytes(16).toString('hex'),
  };
  const payload = encode(claims);
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signature(unsigned, config.jwtAccessSecret).toString('base64url')}`;
}

export function verifyAccessToken(
  token: string,
  config: Pick<AppConfig, 'jwtAccessSecret' | 'jwtIssuer' | 'jwtAudience'>,
  now = Math.floor(Date.now() / 1000),
): AccessTokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new UnauthorizedError('Invalid access token');
  }

  let header: { alg?: string; typ?: string };
  let claims: AccessTokenClaims;
  let received: Buffer;
  try {
    const headerBytes = Buffer.from(parts[0], 'base64url');
    const claimBytes = Buffer.from(parts[1], 'base64url');
    received = Buffer.from(parts[2], 'base64url');
    if (
      headerBytes.toString('base64url') !== parts[0]
      || claimBytes.toString('base64url') !== parts[1]
      || received.toString('base64url') !== parts[2]
    ) {
      throw new Error('Non-canonical token encoding');
    }
    header = JSON.parse(headerBytes.toString('utf8'));
    claims = JSON.parse(claimBytes.toString('utf8'));
  } catch {
    throw new UnauthorizedError('Invalid access token');
  }

  const expected = signature(`${parts[0]}.${parts[1]}`, config.jwtAccessSecret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new UnauthorizedError('Invalid access token');
  }

  if (
    header.alg !== 'HS256'
    || header.typ !== 'JWT'
    || claims.role !== 'admin'
    || claims.iss !== config.jwtIssuer
    || claims.aud !== config.jwtAudience
    || typeof claims.sub !== 'string'
    || typeof claims.jti !== 'string'
    || typeof claims.exp !== 'number'
    || claims.exp <= now
  ) {
    throw new UnauthorizedError('Invalid or expired access token');
  }

  return claims;
}

export function createRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
