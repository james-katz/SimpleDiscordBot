import { describe, expect, it, vi } from 'vitest';
import { DiscordBotApplication } from '../../src/bot/application';
import type { AppConfig } from '../../src/config/env';

const config = {
  moderatorRoleIds: new Set(['1078741799306268727']),
} as AppConfig;

function button(customId: string, roleIds: string[] = []) {
  return {
    customId,
    locale: 'en-US',
    isAutocomplete: () => false,
    isButton: () => true,
    isChatInputCommand: () => false,
    inGuild: () => true,
    member: { roles: { cache: new Map(roleIds.map((id) => [id, {}])) } },
    user: { id: '123456789012345678', username: 'player', avatar: null },
    message: { edit: vi.fn(async () => undefined) },
    reply: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    followUp: vi.fn(async () => ({ id: 'message-id' })),
    deferred: false,
    replied: false,
    isRepliable: () => true,
  };
}

describe('Discord interaction adapter', () => {
  it('rejects moderator controls without an allowed role', async () => {
    const runs = { startRun: vi.fn() };
    const app = new DiscordBotApplication(config, runs as any);
    const interaction = button('trivia:start:run-id');

    await (app as any).handleInteraction(interaction);

    expect(runs.startRun).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
    await app.stop();
  });

  it('starts and renders a question for an authorized moderator', async () => {
    const question = {
      id: 'question-id',
      position: 0,
      prompt: 'Question?',
      closesAt: new Date(Date.now() + 10_000),
      options: [
        { id: 'option-a', position: 0, text: 'A', isCorrect: true },
        { id: 'option-b', position: 1, text: 'B', isCorrect: false },
      ],
    };
    const runs = {
      startRun: vi.fn(async () => question),
      setQuestionMessageId: vi.fn(async () => undefined),
    };
    const app = new DiscordBotApplication(config, runs as any);
    const interaction = button('trivia:start:run-id', ['1078741799306268727']);

    await (app as any).handleInteraction(interaction);

    expect(runs.startRun).toHaveBeenCalledWith('run-id');
    expect(interaction.update).toHaveBeenCalledWith({ components: [] });
    expect(interaction.followUp).toHaveBeenCalledOnce();
    expect(runs.setQuestionMessageId).toHaveBeenCalledWith('question-id', 'message-id');
    await app.stop();
  });

  it('records participant answers without requiring a moderator role', async () => {
    const runs = {
      submitAnswer: vi.fn(async () => ({ recorded: true, language: 'pt-BR' })),
      getQuestionForDisplay: vi.fn(async () => ({
        id: 'question-id',
        status: 'open',
        position: 0,
        prompt: 'Pergunta?',
        participants: [{ discordUserId: '123', isCorrect: true }],
        run: { trivia: { language: 'pt-BR' } },
        options: [
          { id: 'option-id', position: 0, text: 'A', isCorrect: true },
          { id: 'other-option', position: 1, text: 'B', isCorrect: false },
        ],
      })),
    };
    const app = new DiscordBotApplication(config, runs as any);
    const interaction = button('trivia:answer:question-id:option-id');

    await (app as any).handleInteraction(interaction);

    expect(runs.submitAnswer).toHaveBeenCalledWith(
      'question-id',
      'option-id',
      expect.objectContaining({ discordUserId: interaction.user.id }),
    );
    expect(interaction.reply).toHaveBeenCalledWith({ content: 'Sua resposta foi registrada.', ephemeral: true });
    expect(interaction.message.edit).toHaveBeenCalledOnce();
    const updatedMessage = (interaction.message.edit as any).mock.calls[0][0];
    expect(updatedMessage.embeds[0].data.title).toBe('Questão 1');
    expect(updatedMessage.embeds[0].data.footer.text).toBe('1 participante');
    await app.stop();
  });

  it('sends a ztip command for correct answers when a closed question has a prize', async () => {
    const message = { edit: vi.fn(async () => undefined) };
    const channel = {
      isTextBased: () => true,
      messages: { fetch: vi.fn(async () => message) },
      send: vi.fn(async () => undefined),
    };
    const runs = {
      getQuestionForDisplay: vi.fn(async () => ({
        id: 'question-id',
        triviaRunId: 'run-id',
        messageId: 'message-id',
        status: 'closed',
        position: 0,
        prompt: 'Question?',
        prize: '2.5',
        participants: [
          { discordUserId: '111111111111111111', isCorrect: true },
          { discordUserId: '222222222222222222', isCorrect: false },
          { discordUserId: '333333333333333333', isCorrect: true },
        ],
        run: {
          id: 'run-id',
          channelId: 'channel-id',
          trivia: { name: 'Quiz', language: 'en' },
        },
        options: [
          { id: 'option-a', position: 0, text: 'A', isCorrect: true },
          { id: 'option-b', position: 1, text: 'B', isCorrect: false },
        ],
      })),
    };
    const app = new DiscordBotApplication(config, runs as any);
    vi.spyOn(app.client.channels, 'fetch').mockResolvedValue(channel as any);

    await app.handleClosedQuestion({ runId: 'run-id', questionId: 'question-id', completed: false } as any);

    expect(message.edit).toHaveBeenCalledOnce();
    expect(channel.send).toHaveBeenCalledWith('$ztip <@111111111111111111> <@333333333333333333> $2.50 zec');
    await app.stop();
  });

  it('does not send a ztip command when the closed question prize is zero', async () => {
    const message = { edit: vi.fn(async () => undefined) };
    const channel = {
      isTextBased: () => true,
      messages: { fetch: vi.fn(async () => message) },
      send: vi.fn(async () => undefined),
    };
    const runs = {
      getQuestionForDisplay: vi.fn(async () => ({
        id: 'question-id',
        triviaRunId: 'run-id',
        messageId: 'message-id',
        status: 'closed',
        position: 0,
        prompt: 'Question?',
        prize: 0,
        participants: [{ discordUserId: '111111111111111111', isCorrect: true }],
        run: {
          id: 'run-id',
          channelId: 'channel-id',
          trivia: { name: 'Quiz', language: 'en' },
        },
        options: [
          { id: 'option-a', position: 0, text: 'A', isCorrect: true },
          { id: 'option-b', position: 1, text: 'B', isCorrect: false },
        ],
      })),
    };
    const app = new DiscordBotApplication(config, runs as any);
    vi.spyOn(app.client.channels, 'fetch').mockResolvedValue(channel as any);

    await app.handleClosedQuestion({ runId: 'run-id', questionId: 'question-id', completed: false } as any);

    expect(message.edit).toHaveBeenCalledOnce();
    expect(channel.send).not.toHaveBeenCalled();
    await app.stop();
  });
});
