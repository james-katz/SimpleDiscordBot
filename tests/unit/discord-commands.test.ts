import { describe, expect, it } from 'vitest';
import { platformCommands } from '../../src/bot/commands';

describe('Discord command registration', () => {
  it('omits every legacy command by default', () => {
    const commands = platformCommands();
    expect(commands.map((command) => command.name)).toEqual(['trivia', 'rank']);
    expect(commands.map((command) => command.name)).not.toContain('reset-ranking');
  });

  it('defines the complete platform trivia command namespace', () => {
    const commands = platformCommands();
    expect(commands.map((command) => command.name)).not.toContain('reset-ranking');
    const trivia = commands.find((command) => command.name === 'trivia');
    expect(trivia?.options?.map((option) => option.name)).toEqual(['start', 'status', 'resume', 'cancel']);
  });
});
