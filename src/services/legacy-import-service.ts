import { randomUUID } from 'node:crypto';
import { QueryTypes, type Sequelize } from 'sequelize';
import type { createDatabase } from '../db';

type PlatformDatabase = Awaited<ReturnType<typeof createDatabase>>;
type LegacyQuestion = { question: string; answers: string | string[]; language: string };
type LegacyRank = { userId: string; correctAnswers: number; wrongAnswers: number };

function parseAnswers(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((answer) => typeof answer !== 'string')) {
    throw new Error('Legacy question has invalid answers JSON');
  }
  return parsed;
}

export async function importLegacyData(target: PlatformDatabase, legacy: Sequelize) {
  const alreadyImported = await target.models.Trivia.count({ where: { isLegacy: true } });
  if (alreadyImported > 0) return { alreadyImported: true, questions: 0, ranks: 0 };

  const questions = await legacy.query<LegacyQuestion>(
    'SELECT question, answers, language FROM questions ORDER BY id ASC',
    { type: QueryTypes.SELECT },
  );
  const ranks = await legacy.query<LegacyRank>(
    'SELECT userId, correctAnswers, wrongAnswers FROM rank ORDER BY id ASC',
    { type: QueryTypes.SELECT },
  );

  await target.sequelize.transaction(async (transaction) => {
    const now = new Date();
    const systemUserId = randomUUID();
    await target.models.DiscordUser.create({
      id: systemUserId,
      discordUserId: '0',
      username: 'legacy-import',
      displayName: 'Legacy import',
      lastSeenAt: now,
    }, { transaction });

    const questionTriviaId = randomUUID();
    await target.models.Trivia.create({
      id: questionTriviaId,
      name: 'Legacy Question Bank',
      description: 'Questions imported from the legacy standalone question table.',
      language: 'multi',
      status: 'draft',
      defaultQuestionDurationSeconds: 40,
      version: 1,
      isLegacy: true,
    }, { transaction });

    for (const [position, legacyQuestion] of questions.entries()) {
      const answers = parseAnswers(legacyQuestion.answers);
      if (answers.length < 2 || answers.length > 4) {
        throw new Error(`Legacy question ${position + 1} must contain 2–4 answers`);
      }
      const questionId = randomUUID();
      await target.models.Question.create({
        id: questionId,
        triviaId: questionTriviaId,
        prompt: legacyQuestion.question,
        position,
        durationSeconds: null,
        points: 1,
        prize: 0,
        version: 1,
      }, { transaction });
      await target.models.QuestionOption.bulkCreate(answers.map((answer, optionPosition) => ({
        id: randomUUID(),
        questionId,
        text: answer,
        position: optionPosition,
        isCorrect: optionPosition === 0,
      })), { transaction });
    }

    const rankingTriviaId = randomUUID();
    const rankingRunId = randomUUID();
    await target.models.Trivia.create({
      id: rankingTriviaId,
      name: 'Legacy Ranking Import',
      description: 'Hidden synthetic trivia used to preserve pre-platform aggregate scores.',
      language: 'multi',
      status: 'archived',
      defaultQuestionDurationSeconds: 40,
      version: 1,
      isLegacy: true,
      archivedAt: now,
    }, { transaction });
    await target.models.TriviaRun.create({
      id: rankingRunId,
      triviaId: rankingTriviaId,
      triviaVersion: 1,
      status: 'completed',
      guildId: 'legacy',
      channelId: 'legacy',
      startedByDiscordUserId: systemUserId,
      isLegacy: true,
      eligibleForOverall: true,
      startedAt: now,
      completedAt: now,
    }, { transaction });

    for (const rank of ranks) {
      const userId = randomUUID();
      await target.models.DiscordUser.create({
        id: userId,
        discordUserId: String(rank.userId),
        username: `discord-${String(rank.userId).slice(-6)}`,
        displayName: `Discord user ${String(rank.userId).slice(-6)}`,
        lastSeenAt: now,
      }, { transaction });
      await target.models.RunScore.create({
        id: randomUUID(),
        triviaRunId: rankingRunId,
        discordUserId: userId,
        correctAnswers: Number(rank.correctAnswers),
        wrongAnswers: Number(rank.wrongAnswers),
        answeredQuestions: Number(rank.correctAnswers) + Number(rank.wrongAnswers),
        totalPoints: Number(rank.correctAnswers),
      }, { transaction });
    }
  });

  const expectedCorrect = ranks.reduce((total, rank) => total + Number(rank.correctAnswers), 0);
  const expectedWrong = ranks.reduce((total, rank) => total + Number(rank.wrongAnswers), 0);
  const importedCorrect = Number(await target.models.RunScore.sum('correctAnswers'));
  const importedWrong = Number(await target.models.RunScore.sum('wrongAnswers'));
  if (importedCorrect !== expectedCorrect || importedWrong !== expectedWrong) {
    throw new Error(`Import reconciliation failed: expected ${expectedCorrect}/${expectedWrong}, found ${importedCorrect}/${importedWrong}`);
  }
  return { alreadyImported: false, questions: questions.length, ranks: ranks.length };
}
