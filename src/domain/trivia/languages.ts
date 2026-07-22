export const SUPPORTED_TRIVIA_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'pt-BR', label: 'Brazilian Portuguese', nativeLabel: 'Português (Brasil)' },
] as const;

export type TriviaLanguage = typeof SUPPORTED_TRIVIA_LANGUAGES[number]['code'];

export const TRIVIA_LANGUAGE_CODES = SUPPORTED_TRIVIA_LANGUAGES.map((language) => language.code);

export function normalizeTriviaLanguage(value: unknown): TriviaLanguage | null {
  if (typeof value !== 'string') return null;
  if (value.toLowerCase() === 'en') return 'en';
  if (value.toLowerCase() === 'pt-br') return 'pt-BR';
  return null;
}
