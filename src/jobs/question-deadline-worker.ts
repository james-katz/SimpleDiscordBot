import type { RunService } from '../services/run-service';

type ClosedQuestion = Awaited<ReturnType<RunService['closeQuestion']>>;

export class QuestionDeadlineWorker {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly runs: RunService,
    private readonly onClosed: (result: ClosedQuestion) => Promise<void> = async () => {},
    private readonly intervalMs = 1_000,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.runs.findDueQuestions(now);
      for (const questionId of due) {
        try {
          await this.runs.closeQuestion(questionId, now);
        } catch (error) {
          if ((error as { code?: string }).code !== 'CONFLICT') {
            console.error('Unable to close due question:', questionId, error);
          }
        }
      }
      const pendingPresentations = await this.runs.findPendingResultPresentations();
      for (const result of pendingPresentations) {
        try {
          await this.onClosed(result);
          await this.runs.markResultPublished(result.questionId, now);
        } catch (error) {
          console.error('Unable to publish closed question result:', result.questionId, error);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
