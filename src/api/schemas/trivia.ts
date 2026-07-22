import { TRIVIA_LANGUAGE_CODES } from '../../domain/trivia/languages';

export const optionInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'isCorrect'],
  properties: {
    text: { type: 'string', minLength: 1, maxLength: 500 },
    isCorrect: { type: 'boolean' },
  },
} as const;

export const questionInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['prompt', 'options'],
  properties: {
    prompt: { type: 'string', minLength: 1, maxLength: 4000 },
    durationSeconds: { anyOf: [{ type: 'integer', minimum: 10, maximum: 600 }, { type: 'null' }] },
    points: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
    prize: { type: 'number', minimum: 0, maximum: 1000000, multipleOf: 0.00000001, default: 0 },
    options: { type: 'array', minItems: 2, maxItems: 4, items: optionInputSchema },
  },
} as const;

export const triviaCreateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    description: { type: 'string', minLength: 1, maxLength: 4000 },
    language: { type: 'string', enum: TRIVIA_LANGUAGE_CODES, default: 'en' },
    defaultQuestionDurationSeconds: { type: 'integer', minimum: 10, maximum: 600, default: 40 },
    questions: { type: 'array', maxItems: 500, items: questionInputSchema, default: [] },
  },
} as const;

export const triviaPatchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: {
    version: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1, maxLength: 120 },
    description: { type: 'string', minLength: 1, maxLength: 4000 },
    language: { type: 'string', enum: TRIVIA_LANGUAGE_CODES },
    defaultQuestionDurationSeconds: { type: 'integer', minimum: 10, maximum: 600 },
  },
} as const;

export const questionReplaceSchema = {
  ...questionInputSchema,
  required: ['prompt', 'options', 'version'],
  properties: {
    ...questionInputSchema.properties,
    version: { type: 'integer', minimum: 1 },
  },
} as const;
