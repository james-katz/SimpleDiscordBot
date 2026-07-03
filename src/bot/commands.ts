import { SlashCommandBuilder } from 'discord.js';

export function platformCommands() {
  return [
    new SlashCommandBuilder()
      .setName('trivia')
      .setDescription('Manage a persisted trivia run.')
      .setDMPermission(false)
      .addSubcommand((subcommand) => subcommand
        .setName('start')
        .setDescription('Prepare a published trivia in this channel.')
        .addStringOption((option) => option
          .setName('trivia')
          .setDescription('Published trivia to start.')
          .setRequired(true)
          .setAutocomplete(true)))
      .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show the active run state.'))
      .addSubcommand((subcommand) => subcommand.setName('resume').setDescription('Restore controls for the active run.'))
      .addSubcommand((subcommand) => subcommand.setName('cancel').setDescription('Cancel the active run.')),
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Display trivia rankings.')
      .setDMPermission(false)
      .addStringOption((option) => option
        .setName('scope')
        .setDescription('Ranking scope.')
        .addChoices(
          { name: 'Overall', value: 'overall' },
          { name: 'Trivia', value: 'trivia' },
          { name: 'Run', value: 'run' },
        ))
      .addStringOption((option) => option.setName('id').setDescription('Trivia or run ID for the selected scope.')),
  ].map((command) => command.toJSON());
}
