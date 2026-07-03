import { describe, expect, it, vi } from 'vitest';
import { DiscordBotApplication } from '../../src/bot/application';
import type { AppConfig } from '../../src/config/env';

const config = {
  moderatorRoleIds: new Set(['1078741799306268727']),
} as AppConfig;

function button(customId: string, roleIds: string[] = []) {
  return {
    customId,
    isAutocomplete: () => false,
    isButton: () => true,
    isChatInputCommand: () => false,
    inGuild: () => true,
    member: { roles: { cache: new Map(roleIds.map((id) => [id, {}])) } },
    user: { id: '123456789012345678', username: 'player', avatar: null },
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
    const runs = { submitAnswer: vi.fn(async () => ({ recorded: true })) };
    const app = new DiscordBotApplication(config, runs as any);
    const interaction = button('trivia:answer:question-id:option-id');

    await (app as any).handleInteraction(interaction);

    expect(runs.submitAnswer).toHaveBeenCalledWith(
      'question-id',
      'option-id',
      expect.objectContaining({ discordUserId: interaction.user.id }),
    );
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
    await app.stop();
  });
});
