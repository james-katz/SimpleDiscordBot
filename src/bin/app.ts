import { buildApi } from '../api/app';
import { DiscordBotApplication } from '../bot/application';
import { loadConfig } from '../config/env';
import { createDatabase } from '../db';
import { QuestionDeadlineWorker } from '../jobs/question-deadline-worker';
import { RunService } from '../services/run-service';

async function main() {
  const config = loadConfig();
  const database = await createDatabase(config);
  const applied = await database.migrator.up();
  if (applied.length > 0) console.log(`Applied ${applied.length} pending database migration(s).`);

  const api = await buildApi(config, database.models);
  const runs = new RunService(database.models);
  const bot = config.discordToken ? new DiscordBotApplication(config, runs) : undefined;
  const deadlineWorker = new QuestionDeadlineWorker(
    runs,
    async (result) => bot?.handleClosedQuestion(result),
  );
  if (bot) await bot.start();
  deadlineWorker.start();
  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    api.log.info({ signal }, 'Graceful shutdown started');
    deadlineWorker.stop();
    await api.close();
    if (bot) await bot.stop();
    await database.sequelize.close();
  };

  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));

  try {
    await api.listen({ host: config.host, port: config.port });
  } catch (error) {
    api.log.error(error);
    await stop('startup-error');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Platform startup failed:', error);
  process.exitCode = 1;
});
