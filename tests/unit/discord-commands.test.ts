import { describe, expect, it } from 'vitest';
import { platformCommands } from '../../src/bot/commands';

describe('Discord command registration', () => {
  it('registers only the supported platform commands', () => {
    const commands = platformCommands();
    expect(commands.map((command) => command.name)).toEqual(['trivia', 'rank']);
  });

  it('defines the complete platform trivia command namespace', () => {
    const commands = platformCommands();
    const trivia = commands.find((command) => command.name === 'trivia');
    expect(trivia?.options?.map((option) => option.name)).toEqual(['start', 'status', 'resume', 'cancel']);
    expect(trivia?.description_localizations?.['pt-BR']).toBeTruthy();
  });
});
