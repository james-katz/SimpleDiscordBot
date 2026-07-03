import { REST, Routes } from 'discord.js';
import { platformCommands } from '../bot/commands';
import { loadConfig } from '../config/env';

async function main() {
  const config = loadConfig();
  if (!config.discordToken || !config.discordClientId) {
    throw new Error('DISCORD_TOKEN and CLIENT_ID are required');
  }
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const commands = platformCommands();
  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);
  const registered = await rest.put(route, { body: commands }) as unknown[];
  console.log(`Registered ${registered.length} platform commands ${config.discordGuildId ? 'for the configured guild' : 'globally'}.`);
}

main().catch((error) => {
  console.error('Command deployment failed:', error);
  process.exitCode = 1;
});
