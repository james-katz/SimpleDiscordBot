import { describe, expect, it } from 'vitest';
import { createAccessToken, hashRefreshToken, verifyAccessToken } from '../../src/domain/auth/tokens';

const config = {
  jwtAccessSecret: 'a-secret-value-that-is-long-enough-for-tests',
  jwtIssuer: 'test-issuer',
  jwtAudience: 'test-audience',
  accessTokenTtlSeconds: 900,
};

describe('access tokens', () => {
  it('round trips validated claims', () => {
    const token = createAccessToken('admin-id', config, 100);
    const claims = verifyAccessToken(token, config, 101);

    expect(claims.sub).toBe('admin-id');
    expect(claims.role).toBe('admin');
    expect(claims.exp).toBe(1000);
  });

  it('rejects expired and modified tokens', () => {
    const token = createAccessToken('admin-id', config, 100);

    expect(() => verifyAccessToken(token, config, 1000)).toThrow('expired');
    expect(() => verifyAccessToken(`${token.slice(0, -1)}x`, config, 101)).toThrow('Invalid');
  });
});

describe('refresh token hashing', () => {
  it('is deterministic without storing a raw token', () => {
    expect(hashRefreshToken('refresh-token')).toBe(hashRefreshToken('refresh-token'));
    expect(hashRefreshToken('refresh-token')).not.toBe('refresh-token');
  });
});
