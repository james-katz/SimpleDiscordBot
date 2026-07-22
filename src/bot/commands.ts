import { SlashCommandBuilder } from 'discord.js';

export function platformCommands() {
  return [
    new SlashCommandBuilder()
      .setName('trivia')
      .setDescription('Manage a persisted trivia run.')
      .setDescriptionLocalizations({ 'pt-BR': 'Gerencie uma rodada de quiz.' })
      .setDMPermission(false)
      .addSubcommand((subcommand) => subcommand
        .setName('start')
        .setDescription('Prepare a published trivia in this channel.')
        .setDescriptionLocalizations({ 'pt-BR': 'Prepare um quiz publicado neste canal.' })
        .addStringOption((option) => option
          .setName('trivia')
          .setDescription('Published trivia to start.')
          .setDescriptionLocalizations({ 'pt-BR': 'Quiz publicado que será iniciado.' })
          .setRequired(true)
          .setAutocomplete(true)))
      .addSubcommand((subcommand) => subcommand
        .setName('status')
        .setDescription('Show the active run state.')
        .setDescriptionLocalizations({ 'pt-BR': 'Mostre o estado da rodada ativa.' }))
      .addSubcommand((subcommand) => subcommand
        .setName('resume')
        .setDescription('Restore controls for the active run.')
        .setDescriptionLocalizations({ 'pt-BR': 'Restaure os controles da rodada ativa.' }))
      .addSubcommand((subcommand) => subcommand
        .setName('cancel')
        .setDescription('Cancel the active run.')
        .setDescriptionLocalizations({ 'pt-BR': 'Cancele a rodada ativa.' })),
    new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Display trivia rankings.')
      .setDescriptionLocalizations({ 'pt-BR': 'Mostre os rankings dos quizzes.' })
      .setDMPermission(false)
      .addStringOption((option) => option
        .setName('scope')
        .setDescription('Ranking scope.')
        .setDescriptionLocalizations({ 'pt-BR': 'Escopo do ranking.' })
        .addChoices(
          { name: 'Overall', name_localizations: { 'pt-BR': 'Geral' }, value: 'overall' },
          { name: 'Trivia', name_localizations: { 'pt-BR': 'Quiz' }, value: 'trivia' },
          { name: 'Run', name_localizations: { 'pt-BR': 'Rodada' }, value: 'run' },
        ))
      .addStringOption((option) => option
        .setName('id')
        .setDescription('Trivia or run ID for the selected scope.')
        .setDescriptionLocalizations({ 'pt-BR': 'ID do quiz ou da rodada para o escopo selecionado.' })),
  ].map((command) => command.toJSON());
}
