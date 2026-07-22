import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/db';
import type { PlatformModels } from '../../src/db/models';
import { QuestionDeadlineWorker } from '../../src/jobs/question-deadline-worker';
import { RunService } from '../../src/services/run-service';
import { RankingSeasonService } from '../../src/services/ranking-season-service';
import { TriviaService } from '../../src/services/trivia-service';

describe('platform persistence', () => {
  let directory: string;
  let database: Awaited<ReturnType<typeof createDatabase>>;
  let models: PlatformModels;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'zecquiz-test-'));
    database = await createDatabase({ databasePath: path.join(directory, 'platform.sqlite') });
    await database.migrator.up();
    models = database.models;
  });

  afterEach(async () => {
    await database.sequelize.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('creates, publishes, runs, scores, and ranks a trivia', async () => {
    const adminId = '774acd2e-b109-4e20-86d7-337c6a926ffa';
    await models.ApiUser.create({
      id: adminId,
      username: 'admin',
      passwordHash: 'not-used-in-this-test',
      role: 'admin',
      status: 'active',
    });
    const trivias = new TriviaService(models);
    const seasons = new RankingSeasonService(models);
    const season = await seasons.create({ name: 'Season 1', activate: true }, adminId) as any;
    const trivia = await trivias.create({
      name: 'Friday Night Quiz',
      description: 'Latest updates',
      defaultQuestionDurationSeconds: 10,
      questions: [{
        prompt: 'Pick the correct answer',
        points: 2,
        prize: 0.01,
        options: [
          { text: 'Correct', isCorrect: true },
          { text: 'Wrong', isCorrect: false },
        ],
      }],
    }, adminId);
    await trivias.publish(trivia.id as string, adminId);

    const runs = new RunService(models);
    const moderator = { discordUserId: '1078741799306268727', username: 'moderator', displayName: 'Moderator' };
    const run = await runs.createRun(trivia.id as string, 'guild', 'channel', moderator);
    const question = await runs.startRun(run.id, new Date('2026-01-01T00:00:00Z')) as any;
    const correctOption = question.options.find((option: any) => option.isCorrect);
    const wrongOption = question.options.find((option: any) => !option.isCorrect);
    const firstAnswer = await runs.submitAnswer(question.id, correctOption.id, {
      discordUserId: '123456789012345678',
      username: 'player',
      displayName: 'Player',
    }, new Date('2026-01-01T00:00:01Z'));
    expect(firstAnswer.language).toBe('en');
    await runs.submitAnswer(question.id, wrongOption.id, {
      discordUserId: '223456789012345678', username: 'player-two', displayName: 'Player Two',
    }, new Date('2026-01-01T00:00:02Z'));
    await runs.submitAnswer(question.id, correctOption.id, {
      discordUserId: '323456789012345678', username: 'player-three', displayName: 'Player Three',
    }, new Date('2026-01-01T00:00:03Z'));

    const liveQuestion = await runs.getQuestionForDisplay(question.id) as any;
    expect(liveQuestion.participants).toHaveLength(3);
    expect(liveQuestion.run.trivia.language).toBe('en');

    const result = await runs.closeQuestion(question.id, new Date('2026-01-01T00:00:11Z'));
    expect(result.completed).toBe(true);
    await runs.closeQuestion(question.id, new Date('2026-01-01T00:00:12Z'));
    const firstPage = await runs.rankings({ type: 'run', id: run.id }, 1);
    const secondPage = await runs.rankings({ type: 'run', id: run.id }, 1, firstPage.nextCursor!);
    expect(firstPage.total).toBe(3);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(secondPage.items[0]?.publicUserId).not.toBe(firstPage.items[0]?.publicUserId);
    expect(secondPage.items[0]?.rank).toBe(2);

    const seasonRanking = await runs.rankings({ type: 'overall', seasonId: season.id });
    expect(seasonRanking.total).toBe(3);
    await seasons.excludeRun(run.id, 'Test run', adminId);
    expect((await runs.rankings({ type: 'overall', seasonId: season.id })).total).toBe(0);
    expect((await runs.rankings({ type: 'run', id: run.id })).total).toBe(3);

    const auditActions = (await models.AuditLog.findAll({ attributes: ['action'] })).map((item) => item.get('action'));
    expect(auditActions).toContain('trivia-run.start');
    expect(auditActions).toContain('trivia-run.complete');
    expect(auditActions).toContain('trivia-run.exclude-ranking');
  });

  it('retries failed result presentation without scoring twice', async () => {
    const adminId = '774acd2e-b109-4e20-86d7-337c6a926ffa';
    await models.ApiUser.create({ id: adminId, username: 'admin', passwordHash: 'unused', role: 'admin', status: 'active' });
    const trivias = new TriviaService(models);
    const trivia = await trivias.create({
      name: 'Recovery quiz',
      description: 'Worker recovery',
      defaultQuestionDurationSeconds: 10,
      questions: [{
        prompt: 'Recover?',
        options: [{ text: 'Yes', isCorrect: true }, { text: 'No', isCorrect: false }],
      }],
    }, adminId);
    await trivias.publish(trivia.id as string, adminId);
    const runs = new RunService(models);
    const run = await runs.createRun(trivia.id as string, 'guild', 'recovery-channel', {
      discordUserId: '1078741799306268727', username: 'moderator', displayName: 'Moderator',
    });
    const question = await runs.startRun(run.id, new Date('2026-01-01T00:00:00Z')) as any;
    const correctOption = question.options.find((option: any) => option.isCorrect);
    await runs.submitAnswer(question.id, correctOption.id, {
      discordUserId: '123456789012345678', username: 'player', displayName: 'Player',
    }, new Date('2026-01-01T00:00:01Z'));

    let attempts = 0;
    const worker = new QuestionDeadlineWorker(runs, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Discord unavailable');
    });
    await worker.tick(new Date('2026-01-01T00:00:11Z'));
    await worker.tick(new Date('2026-01-01T00:00:12Z'));

    expect(attempts).toBe(2);
    const ranking = await runs.rankings({ type: 'run', id: run.id });
    expect(ranking.items[0]).toMatchObject({ correctAnswers: 1, totalPoints: 1 });
    expect(await runs.findPendingResultPresentations()).toHaveLength(0);
  });

  it('paginates trivia definitions with opaque non-overlapping cursors', async () => {
    const adminId = '774acd2e-b109-4e20-86d7-337c6a926ffa';
    await models.ApiUser.create({ id: adminId, username: 'admin', passwordHash: 'unused', role: 'admin', status: 'active' });
    const trivias = new TriviaService(models);
    for (const name of ['One', 'Two', 'Three']) {
      await trivias.create({ name, description: `${name} description` }, adminId);
    }

    const first = await trivias.list({ limit: 2 });
    const second = await trivias.list({ limit: 2, cursor: first.nextCursor! });
    expect(first.total).toBe(3);
    expect(first.items).toHaveLength(2);
    expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((item: any) => item.id)).size).toBe(3);
  });
});
