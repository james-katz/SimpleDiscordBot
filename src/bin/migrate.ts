import { loadConfig } from '../config/env';
import { createDatabase } from '../db';

async function main() {
  const config = loadConfig();
  const database = await createDatabase(config);

  try {
    const migrations = await database.migrator.up();
    if (migrations.length === 0) {
      console.log('Database is already up to date.');
      return;
    }
    console.log(`Applied migrations: ${migrations.map((migration) => migration.name).join(', ')}`);
  } finally {
    await database.sequelize.close();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error);
  process.exitCode = 1;
});
