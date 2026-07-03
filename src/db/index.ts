import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Sequelize, type QueryInterface } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import type { AppConfig } from '../config/env';
import { defineModels } from './models';
import * as initialSchema from './migrations/001-initial-platform-schema';
import * as platformFeatures from './migrations/002-idempotency-and-ranking-seasons';

export async function createDatabase(config: Pick<AppConfig, 'databasePath' | 'nodeEnv'>) {
  await mkdir(path.dirname(config.databasePath), { recursive: true });

  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: config.databasePath,
    logging: config.nodeEnv === 'development' ? (sql) => console.debug(sql) : false,
  });

  const models = defineModels(sequelize);
  const migrator = new Umzug<QueryInterface>({
    migrations: [{
      name: '001-initial-platform-schema',
      up: ({ context }) => initialSchema.up(context),
      down: ({ context }) => initialSchema.down(context),
    }, {
      name: '002-idempotency-and-ranking-seasons',
      up: ({ context }) => platformFeatures.up(context),
      down: ({ context }) => platformFeatures.down(context),
    }],
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize, tableName: 'platform_migrations' }),
    logger: undefined,
  });

  await sequelize.authenticate();
  await sequelize.query('PRAGMA foreign_keys = ON');
  await sequelize.query('PRAGMA journal_mode = WAL');
  await sequelize.query('PRAGMA busy_timeout = 5000');

  return { sequelize, models, migrator };
}
