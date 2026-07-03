import { access } from 'node:fs/promises';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { loadConfig } from '../config/env';
import { createDatabase } from '../db';
import { importLegacyData } from '../services/legacy-import-service';

async function main() {
  const config = loadConfig();
  const legacyPath = path.resolve(process.cwd(), process.env.LEGACY_DATABASE_PATH ?? 'dbs/zecquiz.sqlite');
  await access(legacyPath);
  const target = await createDatabase(config);
  await target.migrator.up();
  const legacy = new Sequelize({ dialect: 'sqlite', storage: legacyPath, logging: false });

  try {
    const result = await importLegacyData(target, legacy);
    console.log(result.alreadyImported
      ? 'Legacy import already exists; no data was changed.'
      : `Imported ${result.questions} questions and ${result.ranks} legacy ranking rows.`);
  } finally {
    await legacy.close();
    await target.sequelize.close();
  }
}

main().catch((error) => {
  console.error('Legacy import failed:', error);
  process.exitCode = 1;
});
