import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { Op, type Transaction } from 'sequelize';
import type { AppConfig } from '../config/env';
import type { PlatformModels } from '../db/models';
import { ConflictError, UnauthorizedError, ValidationError } from '../domain/errors';
import { createAccessToken, createRefreshToken, hashRefreshToken } from '../domain/auth/tokens';

export type AuthSession = {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: { id: string; username: string; role: 'admin' };
};

function normalizeUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(normalized)) {
    throw new ValidationError('Username must contain 3–64 lowercase letters, numbers, dots, underscores, or hyphens');
  }
  return normalized;
}

function validatePassword(password: string): void {
  if (password.length < 6 || password.length > 256) {
    throw new ValidationError('Password must contain between 6 and 256 characters');
  }
}

export class AuthService {
  constructor(
    private readonly models: PlatformModels,
    private readonly config: AppConfig,
  ) {}

  async createAdmin(username: string, password: string): Promise<{ id: string; username: string }> {
    const normalized = normalizeUsername(username);
    validatePassword(password);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    try {
      const user = await this.models.ApiUser.create({
        id: randomUUID(),
        username: normalized,
        passwordHash,
        role: 'admin',
        status: 'active',
      });
      return { id: user.get('id') as string, username: user.get('username') as string };
    } catch (error) {
      if ((error as { name?: string }).name === 'SequelizeUniqueConstraintError') {
        throw new ConflictError('That API username already exists');
      }
      throw error;
    }
  }

  async login(username: string, password: string): Promise<AuthSession> {
    const normalized = normalizeUsername(username);
    const user = await this.models.ApiUser.findOne({ where: { username: normalized } });
    if (!user || user.get('status') !== 'active') {
      throw new UnauthorizedError('Invalid username or password');
    }

    const valid = await argon2.verify(user.get('passwordHash') as string, password).catch(() => false);
    if (!valid) throw new UnauthorizedError('Invalid username or password');

    await user.update({ lastLoginAt: new Date() });
    return this.issueSession(user);
  }

  async refresh(rawToken: string): Promise<AuthSession> {
    if (!rawToken) throw new UnauthorizedError('Refresh token is required');
    const now = new Date();

    return this.models.RefreshToken.sequelize!.transaction(async (transaction) => {
      const stored = await this.models.RefreshToken.findOne({
        where: {
          tokenHash: hashRefreshToken(rawToken),
          revokedAt: null,
          expiresAt: { [Op.gt]: now },
        },
        transaction,
      });
      if (!stored) throw new UnauthorizedError('Invalid or expired refresh token');

      const user = await this.models.ApiUser.findByPk(stored.get('apiUserId') as string, { transaction });
      if (!user || user.get('status') !== 'active') {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      const session = await this.issueSession(user, transaction);
      const replacement = await this.models.RefreshToken.findOne({
        where: { tokenHash: hashRefreshToken(session.refreshToken) },
        transaction,
      });
      await stored.update({
        revokedAt: now,
        replacedByTokenId: replacement?.get('id') as string | undefined,
      }, { transaction });

      return session;
    });
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.models.RefreshToken.update(
      { revokedAt: new Date() },
      { where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null } },
    );
  }

  async getUser(id: string) {
    const user = await this.models.ApiUser.findByPk(id, {
      attributes: ['id', 'username', 'role', 'status', 'lastLoginAt', 'createdAt'],
    });
    if (!user || user.get('status') !== 'active') throw new UnauthorizedError();
    return user.toJSON();
  }

  private async issueSession(user: InstanceType<PlatformModels['ApiUser']>, transaction?: Transaction): Promise<AuthSession> {
    const refreshToken = createRefreshToken();
    const refreshTokenExpiresAt = new Date(Date.now() + this.config.refreshTokenTtlSeconds * 1000);
    await this.models.RefreshToken.create({
      id: randomUUID(),
      apiUserId: user.get('id'),
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
    }, { transaction });

    return {
      accessToken: createAccessToken(user.get('id') as string, this.config),
      accessTokenExpiresIn: this.config.accessTokenTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt,
      user: {
        id: user.get('id') as string,
        username: user.get('username') as string,
        role: 'admin',
      },
    };
  }
}
