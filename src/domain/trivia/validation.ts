import { ValidationError } from '../errors';
import { normalizeTriviaLanguage, type TriviaLanguage } from './languages';

export type QuestionOptionInput = {
  text: string;
  isCorrect: boolean;
};

export type QuestionInput = {
  prompt: string;
  durationSeconds?: number | null;
  points?: number;
  prize?: number;
  options: QuestionOptionInput[];
};

export type TriviaInput = {
  name: string;
  description: string;
  language?: string;
  defaultQuestionDurationSeconds?: number;
  questions?: QuestionInput[];
};

function triviaLanguage(value: unknown): TriviaLanguage {
  const language = normalizeTriviaLanguage(value);
  if (language) return language;
  throw new ValidationError('Trivia language must be en or pt-BR');
}

function requiredText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`);
  }
  const result = value.trim();
  if (result.length > maximum) throw new ValidationError(`${field} must not exceed ${maximum} characters`);
  return result;
}

function boundedInteger(value: unknown, field: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ValidationError(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
  return value as number;
}

export function validateQuestion(input: QuestionInput): Required<Omit<QuestionInput, 'durationSeconds'>> & { durationSeconds: number | null } {
  if (!input || typeof input !== 'object') throw new ValidationError('Question must be an object');
  if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 4) {
    throw new ValidationError('Each question must contain between 2 and 4 options');
  }

  const options = input.options.map((option, index) => ({
    text: requiredText(option?.text, `options[${index}].text`, 500),
    isCorrect: option?.isCorrect === true,
  }));
  if (options.filter((option) => option.isCorrect).length !== 1) {
    throw new ValidationError('Each question must contain exactly one correct option');
  }

  const prize = input.prize ?? 0;
  if (typeof prize !== 'number' || !Number.isFinite(prize) || prize < 0 || prize > 1_000_000) {
    throw new ValidationError('Question prize must be a non-negative number no greater than 1,000,000 ZEC');
  }
  const roundedPrize = Math.round(prize * 100_000_000) / 100_000_000;
  if (Math.abs(prize - roundedPrize) > 1e-12) {
    throw new ValidationError('Question prize must have no more than 8 decimal places');
  }

  return {
    prompt: requiredText(input.prompt, 'Question prompt', 4000),
    durationSeconds: input.durationSeconds == null
      ? null
      : boundedInteger(input.durationSeconds, 'Question duration', 10, 600),
    points: boundedInteger(input.points ?? 1, 'Question points', 1, 1000),
    prize,
    options,
  };
}

export function validateTrivia(input: TriviaInput): Required<Omit<TriviaInput, 'questions'>> & { questions: ReturnType<typeof validateQuestion>[] } {
  if (!input || typeof input !== 'object') throw new ValidationError('Trivia must be an object');
  const language = triviaLanguage(input.language ?? 'en');

  return {
    name: requiredText(input.name, 'Trivia name', 120),
    description: requiredText(input.description, 'Trivia description', 4000),
    language,
    defaultQuestionDurationSeconds: boundedInteger(
      input.defaultQuestionDurationSeconds ?? 40,
      'Default question duration',
      10,
      600,
    ),
    questions: (input.questions ?? []).map(validateQuestion),
  };
}

export function validateTriviaPatch(input: Record<string, unknown>) {
  const allowed = new Set(['name', 'description', 'language', 'defaultQuestionDurationSeconds', 'version']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new ValidationError(`Unknown trivia field: ${key}`);
  }
  if (!Number.isInteger(input.version) || (input.version as number) < 1) {
    throw new ValidationError('Current trivia version is required');
  }

  const patch: Record<string, unknown> = {};
  if ('name' in input) patch.name = requiredText(input.name, 'Trivia name', 120);
  if ('description' in input) patch.description = requiredText(input.description, 'Trivia description', 4000);
  if ('language' in input) {
    patch.language = triviaLanguage(input.language);
  }
  if ('defaultQuestionDurationSeconds' in input) {
    patch.defaultQuestionDurationSeconds = boundedInteger(
      input.defaultQuestionDurationSeconds,
      'Default question duration',
      10,
      600,
    );
  }
  return { patch, version: input.version as number };
}
