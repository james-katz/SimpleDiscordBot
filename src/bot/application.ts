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

function moderatorComponents(runId: string, start = false) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (start) {
    row.addComponents(new ButtonBuilder()
      .setCustomId(`trivia:start:${runId}`)
      .setLabel('Start trivia')
      .setStyle(ButtonStyle.Success));
  } else {
    row.addComponents(new ButtonBuilder()
      .setCustomId(`trivia:next:${runId}`)
      .setLabel('Next question')
      .setStyle(ButtonStyle.Primary));
  }
  row.addComponents(new ButtonBuilder()
    .setCustomId(`trivia:cancel:${runId}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger));
  return row;
}

export class DiscordBotApplication {
  readonly client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

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
    const channel = await this.client.channels.fetch(run.channelId);
    if (!channel?.isTextBased() || !('messages' in channel) || !question.messageId) return;
    const message = await channel.messages.fetch(question.messageId);
    await message.edit(this.closedQuestionMessage(question, result.completed));

    if (result.completed && 'send' in channel) {
      const ranking = await this.runs.rankings({ type: 'run', id: result.runId }, 10);
      await channel.send({ embeds: [this.rankingEmbed(ranking, `${run.trivia.name} — Final ranking`)] });
    }
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
      const content = error instanceof AppError ? error.message : 'The command could not be completed.';
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
    if (!hasRole(interaction, this.config.moderatorRoleIds)) {
      await interaction.reply({ content: 'You do not have permission to manage trivia runs.', ephemeral: true });
      return;
    }
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'start') {
      const triviaId = interaction.options.getString('trivia', true);
      const run = await this.runs.createRun(triviaId, interaction.guildId!, interaction.channelId, identity(interaction));
      const message = await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xf4b728)
          .setTitle(run.name)
          .setDescription(run.description)
          .addFields(
            { name: 'Questions', value: String(run.questionCount), inline: true },
            { name: 'Default timer', value: `${run.defaultQuestionDurationSeconds} seconds`, inline: true },
          )
          .setFooter({ text: 'A moderator can start when everyone is ready.' })
          .setTimestamp()],
        components: [moderatorComponents(run.id, true)],
        fetchReply: true,
      }) as Message;
      await this.runs.setMessageIds(run.id, { introMessageId: message.id, controlMessageId: message.id });
      return;
    }

    const active = await this.runs.getActiveRun(interaction.channelId);
    if (subcommand === 'status') {
      await interaction.reply({ content: `Active run \`${active.id}\` is **${active.status}**.`, ephemeral: true });
    } else if (subcommand === 'cancel') {
      await this.runs.cancelRun(active.id as string);
      await interaction.reply({ content: 'Trivia run cancelled.', ephemeral: true });
    } else if (subcommand === 'resume') {
      const components = active.status === 'waiting'
        ? [moderatorComponents(active.id as string, true)]
        : active.status === 'between_questions'
          ? [moderatorComponents(active.id as string)]
          : [];
      await interaction.reply({
        content: `Run \`${active.id}\` restored in state **${active.status}**.`,
        components,
      });
    }
  }

  private async handleRankCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const scope = interaction.options.getString('scope') ?? 'overall';
    const id = interaction.options.getString('id');
    if (scope !== 'overall' && !id) throw new AppError(400, 'VALIDATION_ERROR', 'A trivia or run ID is required for this scope');
    const ranking = await this.runs.rankings(
      scope === 'run' ? { type: 'run', id: id! } : scope === 'trivia' ? { type: 'trivia', id: id! } : { type: 'overall' },
      10,
      undefined,
    );
    await interaction.editReply({ embeds: [this.rankingEmbed(ranking, 'Trivia ranking')] });
  }

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    const [, action, firstId, secondId] = interaction.customId.split(':');
    if (action === 'answer') {
      await this.runs.submitAnswer(firstId!, secondId!, identity(interaction));
      await interaction.reply({ content: 'Your answer was recorded.', ephemeral: true });
      return;
    }

    if (!hasRole(interaction, this.config.moderatorRoleIds)) {
      await interaction.reply({ content: 'Only a configured moderator can use this control.', ephemeral: true });
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
      await this.runs.cancelRun(firstId!);
      await interaction.update({ content: 'Trivia run cancelled by a moderator.', components: [], embeds: [] });
    }
  }

  private async sendQuestion(interaction: ButtonInteraction, question: any): Promise<void> {
    const options = [...question.options].sort((a, b) => a.position - b.position);
    const closesUnix = Math.floor(new Date(question.closesAt).getTime() / 1000);
    const embed = new EmbedBuilder()
      .setColor(0xf4b728)
      .setTitle(`Question ${question.position + 1}`)
      .setDescription(question.prompt)
      .addFields({
        name: 'Choose one answer',
        value: options.map((option, index) => `${ANSWER_EMOJIS[index]} ${option.text}`).join('\n'),
      })
      .setFooter({ text: `Closes <t:${closesUnix}:R>` })
      .setTimestamp();
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(options.map((option, index) =>
      new ButtonBuilder()
        .setCustomId(`trivia:answer:${question.id}:${option.id}`)
        .setEmoji(ANSWER_EMOJIS[index]!)
        .setStyle(ButtonStyle.Secondary),
    ));
    const message = await interaction.followUp({ embeds: [embed], components: [row], fetchReply: true });
    await this.runs.setQuestionMessageId(question.id, message.id);
  }

  private closedQuestionMessage(question: any, completed: boolean) {
    const options = [...question.options].sort((a, b) => a.position - b.position);
    const correct = question.participants.filter((participant: any) => participant.isCorrect);
    const incorrect = question.participants.filter((participant: any) => !participant.isCorrect);
    const embed = new EmbedBuilder()
      .setColor(0xf4b728)
      .setTitle(`Question ${question.position + 1} closed`)
      .setDescription(question.prompt)
      .addFields(
        { name: 'Correct answer', value: options.find((option) => option.isCorrect)?.text ?? 'Unknown' },
        { name: 'Correct', value: correct.length ? correct.map((user: any) => `<@${user.discordUserId}>`).join('\n') : 'No correct answers', inline: true },
        { name: 'Incorrect', value: incorrect.length ? incorrect.map((user: any) => `<@${user.discordUserId}>`).join('\n') : 'None', inline: true },
      )
      .setFooter({ text: `${question.participants.length} participant(s)` })
      .setTimestamp();
    const answerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(options.map((option, index) =>
      new ButtonBuilder()
        .setCustomId(`trivia:closed:${option.id}`)
        .setEmoji(ANSWER_EMOJIS[index]!)
        .setStyle(option.isCorrect ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(true),
    ));
    return { embeds: [embed], components: completed ? [answerRow] : [answerRow, moderatorComponents(question.triviaRunId)] };
  }

  private rankingEmbed(ranking: Awaited<ReturnType<RunService['rankings']>>, title: string) {
    const embed = new EmbedBuilder().setColor(0xf4b728).setTitle(title).setTimestamp();
    if (ranking.items.length === 0) return embed.setDescription('No ranking data yet.');
    return embed.setDescription(ranking.items.map((item: any) =>
      `**#${item.rank} ${item.displayName}** — ${item.totalPoints} points (${item.correctAnswers} correct, ${item.wrongAnswers} wrong)`,
    ).join('\n'));
  }
}
