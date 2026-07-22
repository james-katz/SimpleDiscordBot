import { normalizeTriviaLanguage, type TriviaLanguage } from '../domain/trivia/languages';

export type BotLocale = TriviaLanguage;

type RankingItem = {
  rank: number;
  displayName: string;
  totalPoints: number;
  correctAnswers: number;
  wrongAnswers: number;
};

export type BotMessages = {
  startTrivia: string;
  nextQuestion: string;
  cancel: string;
  genericError: string;
  validationError: string;
  conflictError: string;
  notFoundError: string;
  permissionManage: string;
  moderatorOnly: string;
  questions: string;
  defaultTimer: string;
  seconds: string;
  readyFooter: string;
  runCancelled: string;
  runCancelledByModerator: string;
  rankingTitle: string;
  finalRanking: string;
  rankingEmpty: string;
  rankingIdRequired: string;
  chooseAnswer: string;
  answerRecorded: string;
  correctAnswer: string;
  correct: string;
  incorrect: string;
  unknown: string;
  noCorrectAnswers: string;
  none: string;
  question: (number: number) => string;
  questionClosed: (number: number) => string;
  participants: (count: number) => string;
  runStatus: (id: string, status: string) => string;
  runRestored: (id: string, status: string) => string;
  rankingLine: (item: RankingItem) => string;
};

const statusEn: Record<string, string> = {
  waiting: 'waiting',
  in_progress: 'in progress',
  between_questions: 'between questions',
  completed: 'completed',
  cancelled: 'cancelled',
};

const statusPtBr: Record<string, string> = {
  waiting: 'aguardando',
  in_progress: 'em andamento',
  between_questions: 'entre questões',
  completed: 'finalizado',
  cancelled: 'cancelado',
};

const messages: Record<BotLocale, BotMessages> = {
  en: {
    startTrivia: 'Start trivia',
    nextQuestion: 'Next question',
    cancel: 'Cancel',
    genericError: 'The command could not be completed.',
    validationError: 'The provided information is invalid.',
    conflictError: 'This action is no longer available.',
    notFoundError: 'The requested item was not found.',
    permissionManage: 'You do not have permission to manage trivia runs.',
    moderatorOnly: 'Only a configured moderator can use this control.',
    questions: 'Questions',
    defaultTimer: 'Default timer',
    seconds: 'seconds',
    readyFooter: 'A moderator can start when everyone is ready.',
    runCancelled: 'Trivia run cancelled.',
    runCancelledByModerator: 'Trivia run cancelled by a moderator.',
    rankingTitle: 'Trivia ranking',
    finalRanking: 'Final ranking',
    rankingEmpty: 'No ranking data yet.',
    rankingIdRequired: 'A trivia or run ID is required for this scope.',
    chooseAnswer: 'Select one answer',
    answerRecorded: 'Your answer was recorded.',
    correctAnswer: 'Correct answer',
    correct: 'Correct',
    incorrect: 'Incorrect',
    unknown: 'Unknown',
    noCorrectAnswers: 'No correct answers',
    none: 'None',
    question: (number) => `Question ${number}`,
    questionClosed: (number) => `Question ${number} closed`,
    participants: (count) => `${count} ${count === 1 ? 'participant' : 'participants'}`,
    runStatus: (id, status) => `Active run \`${id}\` is **${statusEn[status] ?? status}**.`,
    runRestored: (id, status) => `Run \`${id}\` restored in state **${statusEn[status] ?? status}**.`,
    rankingLine: (item) => `**#${item.rank} ${item.displayName}** — ${item.totalPoints} points (${item.correctAnswers} correct, ${item.wrongAnswers} wrong)`,
  },
  'pt-BR': {
    startTrivia: 'Iniciar quiz',
    nextQuestion: 'Próxima questão',
    cancel: 'Cancelar',
    genericError: 'Não foi possível concluir o comando.',
    validationError: 'As informações fornecidas são inválidas.',
    conflictError: 'Esta ação não está mais disponível.',
    notFoundError: 'O item solicitado não foi encontrado.',
    permissionManage: 'Você não tem permissão para gerenciar quizzes.',
    moderatorOnly: 'Somente um moderador configurado pode usar este controle.',
    questions: 'Questões',
    defaultTimer: 'Tempo padrão',
    seconds: 'segundos',
    readyFooter: 'Um moderador pode iniciar quando todos estiverem prontos.',
    runCancelled: 'Quiz cancelado.',
    runCancelledByModerator: 'Quiz cancelado por um moderador.',
    rankingTitle: 'Ranking do quiz',
    finalRanking: 'Ranking final',
    rankingEmpty: 'Ainda não há dados no ranking.',
    rankingIdRequired: 'É necessário informar o ID do quiz ou da rodada.',
    chooseAnswer: 'Selecione uma resposta',
    answerRecorded: 'Sua resposta foi registrada.',
    correctAnswer: 'Resposta correta',
    correct: 'Correto',
    incorrect: 'Incorreto',
    unknown: 'Desconhecida',
    noCorrectAnswers: 'Nenhuma resposta correta',
    none: 'Nenhuma',
    question: (number) => `Questão ${number}`,
    questionClosed: (number) => `Questão ${number} encerrada`,
    participants: (count) => `${count} ${count === 1 ? 'participante' : 'participantes'}`,
    runStatus: (id, status) => `A rodada ativa \`${id}\` está **${statusPtBr[status] ?? status}**.`,
    runRestored: (id, status) => `A rodada \`${id}\` foi restaurada no estado **${statusPtBr[status] ?? status}**.`,
    rankingLine: (item) => `**#${item.rank} ${item.displayName}** — ${item.totalPoints} pontos (${item.correctAnswers} corretas, ${item.wrongAnswers} erradas)`,
  },
};

export function botLocale(value?: string | null): BotLocale {
  if (value?.toLowerCase() === 'pt') return 'pt-BR';
  return normalizeTriviaLanguage(value) ?? 'en';
}

export function botMessages(value?: string | null): BotMessages {
  return messages[botLocale(value)];
}
