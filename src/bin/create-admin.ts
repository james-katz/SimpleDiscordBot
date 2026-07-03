import { loadConfig } from '../config/env';
import { createDatabase } from '../db';
import { AuthService } from '../services/auth-service';

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD for this one-time command');
  }

  const config = loadConfig();
  const database = await createDatabase(config);
  try {
    await database.migrator.up();
    const user = await new AuthService(database.models, config).createAdmin(username, password);
    console.log(`Created API administrator: ${user.username} (${user.id})`);
  } finally {
    await database.sequelize.close();
  }
}

main().catch((error) => {
  console.error('Unable to create API administrator:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
