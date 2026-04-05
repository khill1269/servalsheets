import PQueue from 'p-queue';
import { ConcurrencyCoordinator } from './concurrency-coordinator.js';

export interface ExecutionTask<T> {
  id: string;
  fn: () => Promise<T>;
  timeout?: number;
  priority?: number;
}

export interface ExecutionStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalDuration: number;
  averageDuration: number;
  p95Duration: number;
  p99Duration: number;
}

export class ParallelExecutor {
  private queue: PQueue;
  private coordinator: ConcurrencyCoordinator;
  private durations: number[] = [];
  private stats: ExecutionStats;

  constructor(concurrency: number = 10, coordinator?: ConcurrencyCoordinator) {
    this.queue = new PQueue({ concurrency });
    this.coordinator = coordinator || new ConcurrencyCoordinator();
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalDuration: 0,
      averageDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
    };
  }

  async executeAll<T>(tasks: ExecutionTask<T>[]): Promise<(T | Error)[]> {
    const results: (T | Error)[] = [];

    const promises = tasks.map(async (task) => {
      const startTime = Date.now();
      const permit = await this.coordinator.acquirePermit(1);

      try {
        const timeout = task.timeout || 30000;
        const result = await Promise.race([
          task.fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), timeout)
          ),
        ]);

        const duration = Date.now() - startTime;
        this.durations.push(duration);
        this.stats.completedTasks++;
        results.push(result);
      } catch (error) {
        this.stats.failedTasks++;
        results.push(error as Error);
      } finally {
        this.coordinator.releasePermit(permit);
      }
    });

    await Promise.all(promises);
    this.updateStats();
    return results;
  }

  async executeAllSuccessful<T>(tasks: ExecutionTask<T>[]): Promise<T[]> {
    const results = await this.executeAll(tasks);
    return results.filter((r) => !(r instanceof Error)) as T[];
  }

  async executeAllOrFail<T>(tasks: ExecutionTask<T>[]): Promise<T[]> {
    const results = await this.executeAll(tasks);
    const failures = results.filter((r) => r instanceof Error);

    if (failures.length > 0) {
      throw new Error(`${failures.length} tasks failed`);
    }

    return results as T[];
  }

  private updateStats(): void {
    const sorted = [...this.durations].sort((a, b) => a - b);
    this.stats.totalDuration = this.durations.reduce((a, b) => a + b, 0);
    this.stats.averageDuration = this.stats.totalDuration / this.durations.length;
    this.stats.p95Duration = sorted[Math.floor(sorted.length * 0.95)];
    this.stats.p99Duration = sorted[Math.floor(sorted.length * 0.99)];
  }

  getStats(): ExecutionStats {
    return { ...this.stats };
  }
}
