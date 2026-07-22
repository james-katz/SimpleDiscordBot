import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databasePath: string;
  sqlLogging: boolean;
  corsOrigins: string[];
  jwtAccessSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookieSecure: boolean;
  discordToken?: string;
  discordClientId?: string;
  discordGuildId?: string;
  moderatorRoleIds: Set<string>;
  rankAdminRoleIds: Set<string>;
};

function integer(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }

  return value;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be either true or false`);
}

function csv(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function snowflakeSet(name: string): Set<string> {
  const values = csv(name);
  for (const value of values) {
    if (!/^\d{17,20}$/.test(value)) {
      throw new Error(`${name} contains an invalid Discord role ID`);
    }
  }
  return new Set(values);
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as AppConfig['nodeEnv'];
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET ?? (nodeEnv === 'test' ? 'test-secret-that-is-at-least-32-bytes' : '');
  if (jwtAccessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  }

  const databasePath = path.resolve(
    process.cwd(),
    process.env.DATABASE_PATH ?? 'dbs/trivia-platform.sqlite',
  );

  return {
    nodeEnv,
    host: process.env.HOST ?? '127.0.0.1',
    port: integer('PORT', 3000, 1, 65535),
    databasePath,
    sqlLogging: boolean('SQL_LOGGING', false),
    corsOrigins: csv('CORS_ORIGINS'),
    jwtAccessSecret,
    jwtIssuer: process.env.JWT_ISSUER ?? 'zecquiz-api',
    jwtAudience: process.env.JWT_AUDIENCE ?? 'zecquiz-dashboard',
    accessTokenTtlSeconds: integer('ACCESS_TOKEN_TTL_SECONDS', 900, 60, 3600),
    refreshTokenTtlSeconds: integer('REFRESH_TOKEN_TTL_SECONDS', 604800, 3600, 2592000),
    cookieSecure: boolean('COOKIE_SECURE', nodeEnv === 'production'),
    discordToken: process.env.DISCORD_TOKEN || undefined,
    discordClientId: process.env.CLIENT_ID || undefined,
    discordGuildId: process.env.GUILD_ID || undefined,
    moderatorRoleIds: snowflakeSet('DISCORD_MODERATOR_ROLE_IDS'),
    rankAdminRoleIds: snowflakeSet('DISCORD_RANK_ADMIN_ROLE_IDS'),
    ...overrides,
  };
}
