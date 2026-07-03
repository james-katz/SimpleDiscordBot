import { describe, expect, it } from 'vitest';
import { validateQuestion, validateTrivia } from '../../src/domain/trivia/validation';

describe('trivia validation', () => {
  it('normalizes valid nested trivia input', () => {
    const trivia = validateTrivia({
      name: ' Friday quiz ',
      description: ' Weekly updates ',
      questions: [{
        prompt: 'What changed?',
        prize: 0.12345678,
        options: [
          { text: 'Correct', isCorrect: true },
          { text: 'Wrong', isCorrect: false },
        ],
      }],
    });

    expect(trivia.name).toBe('Friday quiz');
    expect(trivia.questions[0]?.prize).toBe(0.12345678);
    expect(trivia.defaultQuestionDurationSeconds).toBe(40);
  });

  it('requires exactly one correct option', () => {
    expect(() => validateQuestion({
      prompt: 'Question',
      options: [
        { text: 'One', isCorrect: true },
        { text: 'Two', isCorrect: true },
      ],
    })).toThrow('exactly one');
  });

  it('rejects negative prizes and excessive precision', () => {
    const base = {
      prompt: 'Question',
      options: [
        { text: 'One', isCorrect: true },
        { text: 'Two', isCorrect: false },
      ],
    };
    expect(() => validateQuestion({ ...base, prize: -1 })).toThrow('non-negative');
    expect(() => validateQuestion({ ...base, prize: 0.123456789 })).toThrow('8 decimal');
  });
});
