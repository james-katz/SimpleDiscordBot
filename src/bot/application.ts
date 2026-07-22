import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type Interaction,
  type Message,
} from 'discord.js';
import type { AppConfig } from '../config/env';
import { AppError } from '../domain/errors';
import type { DiscordIdentity, RunService } from '../services/run-service';
import { botLocale, botMessages, type BotLocale } from './localization';

const ANSWER_EMOJIS = ['🇦', '🇧', '🇨', '🇩'];

function identity(interaction: ChatInputCommandInteraction | ButtonInteraction): DiscordIdentity {
  const member = interaction.member as { displayName?: string } | null;
  return {
    discordUserId: interaction.user.id,
    username: interaction.user.username,
    displayName: member?.displayName
      ?? (interaction.user as typeof interaction.user & { globalName?: string }).globalName
      ?? interaction.user.username,
    avatarHash: interaction.user.avatar,
  };
}

function hasRole(interaction: Interaction, allowed: Set<string>): boolean {
  if (!interaction.inGuild() || allowed.size === 0) return false;
  const roles = interaction.member?.roles;
  const ids = Array.isArray(roles) ? roles : roles?.cache?.keys();
  return ids ? [...ids].some((id) => allowed.has(id)) : false;
}

function moderatorComponents(runId: string, locale: BotLocale, start = false) {
  const text = botMessages(locale);
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (start) {
    row.addComponents(new ButtonBuilder()
      .setCustomId(`trivia:start:${runId}`)
      .setLabel(text.startTrivia)
      .setStyle(ButtonStyle.Success));
  } else {
    row.addComponents(new ButtonBuilder()
      .setCustomId(`trivia:next:${runId}`)
      .setLabel(text.nextQuestion)
      .setStyle(ButtonStyle.Primary));
  }
  row.addComponents(new ButtonBuilder()
    .setCustomId(`trivia:cancel:${runId}`)
    .setLabel(text.cancel)
    .setStyle(ButtonStyle.Danger));
  return row;
}

function tipCommandForQuestion(question: any): string | null {
  const prize = Number(question.prize);
  if (!Number.isFinite(prize) || prize <= 0) return null;

  const correctMentions = question.participants
    .filter((participant: any) => participant.isCorrect)
    .map((participant: any) => `<@${participant.discordUserId}>`);
  if (correctMentions.length === 0) return null;

  const normalizedAmount = prize.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  const amount = normalizedAmount.includes('.')
    && normalizedAmount.split('.')[1]!.length >= 2
    ? normalizedAmount
    : prize.toFixed(2);

  return `$ztip ${correctMentions.join(' ')} $${amount} zec`;
}

export class DiscordBotApplication {
  readonly client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  private readonly questionMessageUpdates = new Map<string, Promise<void>>();

  constructor(
    private readonly config: AppConfig,
    private readonly runs: RunService,
  ) {
    this.client.on('interactionCreate', (interaction) => void this.handleInteraction(interaction));
    this.client.once('ready', () => console.log(`Discord bot ready as ${this.client.user?.tag}`));
  }

  async start(): Promise<void> {
    if (!this.config.discordToken) throw new Error('DISCORD_TOKEN is required to start the Discord bot');
    await this.client.login(this.config.discordToken);
  }

  async stop(): Promise<void> {
    this.client.destroy();
  }

  async handleClosedQuestion(result: Awaited<ReturnType<RunService['closeQuestion']>>): Promise<void> {
    const question = await this.runs.getQuestionForDisplay(result.questionId);
    const run = question.run as any;
    const locale = botLocale(run.trivia.language);
    const text = botMessages(locale);
    const channel = await this.client.channels.fetch(run.channelId);
    if (!channel?.isTextBased() || !('messages' in channel) || !question.messageId) return;
    const message = await channel.messages.fetch(question.messageId);
    await message.edit(this.closedQuestionMessage(question, result.completed, locale));

    if (result.completed && 'send' in channel) {
      const ranking = await this.runs.rankings({ type: 'run', id: result.runId }, 10);
      await channel.send({ embeds: [this.rankingEmbed(ranking, `${run.trivia.name} — ${text.finalRanking}`, locale)] });
    }

    const tipCommand = tipCommandForQuestion(question);
    if (tipCommand && 'send' in channel) await channel.send(tipCommand);
  }

  private async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isAutocomplete()) return await this.handleAutocomplete(interaction);
      if (interaction.isButton() && interaction.customId.startsWith('trivia:')) return await this.handleButton(interaction);
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName === 'trivia') return await this.handleTriviaCommand(interaction);
      if (interaction.commandName === 'rank') return await this.handleRankCommand(interaction);
    } catch (error) {
      console.error('Discord interaction failed:', error);
      const text = botMessages('locale' in interaction ? interaction.locale : 'en');
      const content = error instanceof AppError
        ? error.code === 'VALIDATION_ERROR' ? text.validationError
          : error.code === 'CONFLICT' ? text.conflictError
            : error.code === 'NOT_FOUND' ? text.notFoundError
              : error.message
        : text.genericError;
      if ('isRepliable' in interaction && interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) await interaction.editReply({ content, embeds: [], components: [] }).catch(() => {});
        else await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    if (interaction.commandName !== 'trivia' || interaction.options.getSubcommand() !== 'start') return;
    const query = interaction.options.getFocused();
    const choices = await this.runs.listPublishedForAutocomplete(String(query));
    await interaction.respond(choices.map((trivia) => ({
      name: `${trivia.name.slice(0, 80)} · ${trivia.id.slice(0, 8)}`,
      value: trivia.id,
    })));
  }

  private async handleTriviaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const interactionLocale = botLocale(interaction.locale);
    const interactionText = botMessages(interactionLocale);
    if (!hasRole(interaction, this.config.moderatorRoleIds)) {
      await interaction.reply({ content: interactionText.permissionManage, ephemeral: true });
      return;
    }
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'start') {
      const triviaId = interaction.options.getString('trivia', true);
      const run = await this.runs.createRun(triviaId, interaction.guildId!, interaction.channelId, identity(interaction));
      const locale = botLocale(run.language);
      const text = botMessages(locale);
      const message = await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xf4b728)
          .setTitle(run.name)
          .setDescription(run.description)
          .addFields(
            { name: text.questions, value: String(run.questionCount), inline: true },
            { name: text.defaultTimer, value: `${run.defaultQuestionDurationSeconds} ${text.seconds}`, inline: true },
          )
          .setFooter({ text: text.readyFooter })
          .setTimestamp()],
        components: [moderatorComponents(run.id, locale, true)],
        fetchReply: true,
      }) as Message;
      await this.runs.setMessageIds(run.id, { introMessageId: message.id, controlMessageId: message.id });
      return;
    }

    const active = await this.runs.getActiveRun(interaction.channelId);
    const locale = botLocale((active as any).trivia?.language);
    const text = botMessages(locale);
    if (subcommand === 'status') {
      await interaction.reply({ content: text.runStatus(active.id as string, active.status as string), ephemeral: true });
    } else if (subcommand === 'cancel') {
      await this.runs.cancelRun(active.id as string);
      await interaction.reply({ content: text.runCancelled, ephemeral: true });
    } else if (subcommand === 'resume') {
      const components = active.status === 'waiting'
        ? [moderatorComponents(active.id as string, locale, true)]
        : active.status === 'between_questions'
          ? [moderatorComponents(active.id as string, locale)]
          : [];
      await interaction.reply({
        content: text.runRestored(active.id as string, active.status as string),
        components,
      });
    }
  }

  private async handleRankCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const locale = botLocale(interaction.locale);
    const text = botMessages(locale);
    const scope = interaction.options.getString('scope') ?? 'overall';
    const id = interaction.options.getString('id');
    if (scope !== 'overall' && !id) throw new AppError(400, 'VALIDATION_ERROR', text.rankingIdRequired);
    const ranking = await this.runs.rankings(
      scope === 'run' ? { type: 'run', id: id! } : scope === 'trivia' ? { type: 'trivia', id: id! } : { type: 'overall' },
      10,
      undefined,
    );
    await interaction.editReply({ embeds: [this.rankingEmbed(ranking, text.rankingTitle, locale)] });
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [, action, firstId, secondId] = interaction.customId.split(':');
    if (action === 'answer') {
      const result = await this.runs.submitAnswer(firstId!, secondId!, identity(interaction));
      await interaction.reply({ content: botMessages(result.language).answerRecorded, ephemeral: true });
      await this.updateOpenQuestionMessage(firstId!, interaction.message);
      return;
    }

    if (!hasRole(interaction, this.config.moderatorRoleIds)) {
      await interaction.reply({ content: botMessages(interaction.locale).moderatorOnly, ephemeral: true });
      return;
    }

    if (action === 'start') {
      const question = await this.runs.startRun(firstId!);
      await interaction.update({ components: [] });
      await this.sendQuestion(interaction, question as any);
    } else if (action === 'next') {
      const question = await this.runs.nextQuestion(firstId!);
      await interaction.update({ components: [] });
      await this.sendQuestion(interaction, question as any);
    } else if (action === 'cancel') {
      const active = await this.runs.getRun(firstId!);
      const text = botMessages((active as any).trivia?.language);
      await this.runs.cancelRun(firstId!);
      await interaction.update({ content: text.runCancelledByModerator, components: [], embeds: [] });
    }
  }

  private async sendQuestion(interaction: ButtonInteraction, question: any): Promise<void> {
    const message = await interaction.followUp({ ...this.openQuestionMessage(question), fetchReply: true });
    await this.runs.setQuestionMessageId(question.id, message.id);
  }

  private openQuestionMessage(question: any) {
    const options = [...question.options].sort((a: any, b: any) => a.position - b.position);
    const text = botMessages(question.run?.trivia?.language);
    const embed = new EmbedBuilder()
      .setColor(0xf4b728)
      .setTitle(text.question(question.position + 1))
      .setDescription(question.prompt)
      .addFields({
        name: text.chooseAnswer,
        value: options.map((option, index) => `${ANSWER_EMOJIS[index]} ${option.text}`).join('\n'),
      })
      .setFooter({ text: text.participants(question.participants?.length ?? 0) })
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(options.map((option, index) =>
      new ButtonBuilder()
        .setCustomId(`trivia:answer:${question.id}:${option.id}`)
        .setEmoji(ANSWER_EMOJIS[index]!)
        .setStyle(ButtonStyle.Secondary),
    ));
    return { embeds: [embed], components: [row] };
  }

  private async updateOpenQuestionMessage(questionId: string, message: Message): Promise<void> {
    const previous = this.questionMessageUpdates.get(questionId) ?? Promise.resolve();
    const update = previous.catch(() => {}).then(async () => {
      const question = await this.runs.getQuestionForDisplay(questionId);
      if (question.status === 'open') await message.edit(this.openQuestionMessage(question));
    });
    this.questionMessageUpdates.set(questionId, update);
    try {
      await update;
    } finally {
      if (this.questionMessageUpdates.get(questionId) === update) this.questionMessageUpdates.delete(questionId);
    }
  }

  private closedQuestionMessage(question: any, completed: boolean, locale: BotLocale) {
    const text = botMessages(locale);
    const options = [...question.options].sort((a, b) => a.position - b.position);
    const correct = question.participants.filter((participant: any) => participant.isCorrect);
    const incorrect = question.participants.filter((participant: any) => !participant.isCorrect);
    const embed = new EmbedBuilder()
      .setColor(0xf4b728)
      .setTitle(text.questionClosed(question.position + 1))
      .setDescription(question.prompt)
      .addFields(
        { name: text.correctAnswer, value: options.find((option) => option.isCorrect)?.text ?? text.unknown },
        { name: text.correct, value: correct.length ? correct.map((user: any) => `<@${user.discordUserId}>`).join('\n') : text.noCorrectAnswers, inline: true },
        { name: text.incorrect, value: incorrect.length ? incorrect.map((user: any) => `<@${user.discordUserId}>`).join('\n') : text.none, inline: true },
      )
      .setFooter({ text: text.participants(question.participants.length) })
      .setTimestamp();
    const answerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(options.map((option, index) =>
      new ButtonBuilder()
        .setCustomId(`trivia:closed:${option.id}`)
        .setEmoji(ANSWER_EMOJIS[index]!)
        .setStyle(option.isCorrect ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(true),
    ));
    return { embeds: [embed], components: completed ? [answerRow] : [answerRow, moderatorComponents(question.triviaRunId, locale)] };
  }

  private rankingEmbed(ranking: Awaited<ReturnType<RunService['rankings']>>, title: string, locale: BotLocale) {
    const text = botMessages(locale);
    const embed = new EmbedBuilder().setColor(0xf4b728).setTitle(title).setTimestamp();
    if (ranking.items.length === 0) return embed.setDescription(text.rankingEmpty);
    return embed.setDescription(ranking.items.map((item: any) => text.rankingLine(item)).join('\n'));
  }
}
