import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApi } from '../../src/api/app';
import type { AppConfig } from '../../src/config/env';
import { createDatabase } from '../../src/db';
import { AuthService } from '../../src/services/auth-service';

describe('management API', () => {
  let directory: string;
  let database: Awaited<ReturnType<typeof createDatabase>>;
  let api: Awaited<ReturnType<typeof buildApi>>;
  let config: AppConfig;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'zecquiz-api-test-'));
    config = {
      nodeEnv: 'test',
      host: '127.0.0.1',
      port: 3000,
      databasePath: path.join(directory, 'platform.sqlite'),
      corsOrigins: [],
      jwtAccessSecret: 'integration-test-secret-with-at-least-32-characters',
      jwtIssuer: 'test-api',
      jwtAudience: 'test-client',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 3600,
      cookieSecure: false,
      moderatorRoleIds: new Set(),
      rankAdminRoleIds: new Set(),
      legacyCommandsEnabled: false,
    };
    database = await createDatabase(config);
    await database.migrator.up();
    await new AuthService(database.models, config).createAdmin('admin', 'a-valid-testing-password');
    api = await buildApi(config, database.models);
  });

  afterEach(async () => {
    await api.close();
    await database.sequelize.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('protects writes and keeps correct answers out of public responses', async () => {
    const denied = await api.inject({ method: 'POST', url: '/api/v1/trivias', payload: {} });
    expect(denied.statusCode).toBe(401);

    const login = await api.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'a-valid-testing-password' },
    });
    expect(login.statusCode).toBe(200);
    const accessToken = login.json().accessToken as string;
    expect(login.cookies.find((cookie) => cookie.name === 'zecquiz_refresh')?.httpOnly).toBe(true);

    const createPayload = {
      name: 'API trivia',
      description: 'Created in an integration test',
      questions: [{
        prompt: 'Secret answer?',
        options: [
          { text: 'Visible only to admins', isCorrect: true },
          { text: 'Wrong', isCorrect: false },
        ],
      }],
    };
    const created = await api.inject({
      method: 'POST',
      url: '/api/v1/trivias',
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': 'create-api-trivia' },
      payload: createPayload,
    });
    expect(created.statusCode).toBe(201);
    const triviaId = created.json().data.id as string;

    const replayed = await api.inject({
      method: 'POST',
      url: '/api/v1/trivias',
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': 'create-api-trivia' },
      payload: createPayload,
    });
    expect(replayed.statusCode).toBe(201);
    expect(replayed.headers['idempotent-replayed']).toBe('true');
    expect(replayed.json().data.id).toBe(triviaId);

    const mismatchedReplay = await api.inject({
      method: 'POST',
      url: '/api/v1/trivias',
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': 'create-api-trivia' },
      payload: { ...createPayload, name: 'Different trivia' },
    });
    expect(mismatchedReplay.statusCode).toBe(409);

    const published = await api.inject({
      method: 'POST',
      url: `/api/v1/trivias/${triviaId}/publish`,
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': 'publish-api-trivia' },
    });
    expect(published.statusCode).toBe(200);
    const publishReplay = await api.inject({
      method: 'POST',
      url: `/api/v1/trivias/${triviaId}/publish`,
      headers: { authorization: `Bearer ${accessToken}`, 'idempotency-key': 'publish-api-trivia' },
    });
    expect(publishReplay.statusCode).toBe(200);
    expect(publishReplay.headers['idempotent-replayed']).toBe('true');

    const publicResponse = await api.inject({ method: 'GET', url: `/api/v1/public/trivias/${triviaId}` });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json().data).not.toHaveProperty('questions');
    expect(publicResponse.body).not.toContain('Visible only to admins');
  });

  it('rotates refresh tokens and rejects replayed tokens', async () => {
    const login = await api.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'a-valid-testing-password' },
    });
    const firstRefresh = login.cookies.find((cookie) => cookie.name === 'zecquiz_refresh')!.value;

    const refreshed = await api.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `zecquiz_refresh=${firstRefresh}` },
    });
    expect(refreshed.statusCode).toBe(200);
    const secondRefresh = refreshed.cookies.find((cookie) => cookie.name === 'zecquiz_refresh')!.value;
    expect(secondRefresh).not.toBe(firstRefresh);

    const replay = await api.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `zecquiz_refresh=${firstRefresh}` },
    });
    expect(replay.statusCode).toBe(401);

    const logout = await api.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: `zecquiz_refresh=${secondRefresh}` },
    });
    expect(logout.statusCode).toBe(204);
    const afterLogout = await api.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: `zecquiz_refresh=${secondRefresh}` },
    });
    expect(afterLogout.statusCode).toBe(401);
  });

  it('manages ranking seasons through authenticated routes', async () => {
    const login = await api.inject({
      method: 'POST', url: '/api/v1/auth/login',
      payload: { username: 'admin', password: 'a-valid-testing-password' },
    });
    const authorization = `Bearer ${login.json().accessToken}`;
    const created = await api.inject({
      method: 'POST', url: '/api/v1/ranking-seasons', headers: { authorization },
      payload: { name: 'Weekly season', activate: true },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data.isActive).toBe(true);

    const publicList = await api.inject({ method: 'GET', url: '/api/v1/public/ranking-seasons' });
    expect(publicList.statusCode).toBe(200);
    expect(publicList.json().data.items).toHaveLength(1);
  });
});
