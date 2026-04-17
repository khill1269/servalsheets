import PQueue from 'p-queue';

export interface ExecutionTask<T> {
  id: string;
  fn: () => Promise<T>;
  timeout?: number;
  priority?: number;
}

export interface ExecutionResult<T> {
  id: string;
  success: boolean;
  result?: T;
  error?: Error;
  retries: number;
  duration: number;
}

export interface ExecutionProgress {
  completed: number;
  total: number;
  succeeded: number;
  failed: number;
}

export interface ExecutionStats {
  totalExecuted: number;
  totalSucceeded: number;
  totalFailed: number;
  successRate: number;
  averageDuration: number;
}

export interface ParallelExecutorOptions {
  concurrency?: number;
  verboseLogging?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

// ============================================================================
// Singleton management
// ============================================================================
// IMPORTANT: These exports are declared BEFORE the class body because tsc in
// Docker can produce truncated output that omits exports at the tail of large
// files. The functions reference ParallelExecutor but are only called at
// runtime (not module load), so the class is initialized by then.
// See: getOtlpExportConfig pattern in src/config/env.ts

let _parallelExecutor: ParallelExecutor | null = null;

export function getParallelExecutor(): ParallelExecutor {
  if (!_parallelExecutor) {
    _parallelExecutor = new ParallelExecutor(5);
  }
  return _parallelExecutor;
}

export function resetParallelExecutor(): void {
  _parallelExecutor = null;
}

// ============================================================================
// ParallelExecutor class
// ============================================================================

export class ParallelExecutor {
  private queue: PQueue;
  private concurrency: number;
  private verboseLogging: boolean;
  private retryOnError: boolean;
  private maxRetries: number;
  private retryDelayMs: number;
  private stats: ExecutionStats;

  constructor(options: ParallelExecutorOptions | number = {}) {
    if (typeof options === 'number') {
      // Legacy constructor: new ParallelExecutor(concurrencyNumber)
      this.concurrency = options;
      this.verboseLogging = false;
      this.retryOnError = true;
      this.maxRetries = 3;
      this.retryDelayMs = 100;
    } else {
      this.concurrency = options.concurrency ?? 10;
      this.verboseLogging = options.verboseLogging ?? false;
      this.retryOnError = options.retryOnError ?? true;
      this.maxRetries = options.maxRetries ?? 3;
      this.retryDelayMs = options.retryDelayMs ?? 100;
    }

    this.queue = new PQueue({ concurrency: this.concurrency });
    this.stats = {
      totalExecuted: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      successRate: 0,
      averageDuration: 0,
    };
  }

  async executeAll<T>(
    tasks: ExecutionTask<T>[],
    onProgress?: (progress: ExecutionProgress) => void
  ): Promise<ExecutionResult<T>[]> {
    const results: ExecutionResult<T>[] = [];
    let completed = 0;
    let succeeded = 0;
    let failed = 0;
    const total = tasks.length;
    const durations: number[] = [];

    // Sort by priority descending so higher-priority tasks are enqueued first
    const sortedTasks = [...tasks].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const promises = sortedTasks.map((task) =>
      this.queue.add(
        async () => {
          const startTime = performance.now();
          let retries = 0;
          let lastError: Error | undefined;

          const maxAttempts = this.retryOnError ? this.maxRetries + 1 : 1;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
              await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
              retries++;
            }

            try {
              const timeout = task.timeout ?? 30000;
              const result = await Promise.race([
                task.fn(),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Task timeout')), timeout)
                ),
              ]);

              const duration = performance.now() - startTime;
              durations.push(duration);
              succeeded++;
              completed++;

              const executionResult: ExecutionResult<T> = {
                id: task.id,
                success: true,
                result,
                retries,
                duration,
              };

              results.push(executionResult);
              onProgress?.({ completed, total, succeeded, failed });
              return;
            } catch (error) {
              lastError = error as Error;
              if (this.verboseLogging) {
                // eslint-disable-next-line no-console
                console.debug(
                  `[ParallelExecutor] Task ${task.id} attempt ${attempt + 1} failed: ${lastError.message}`
                );
              }
            }
          }

          // All attempts failed
          const duration = performance.now() - startTime;
          failed++;
          completed++;

          results.push({
            id: task.id,
            success: false,
            error: lastError,
            retries,
            duration,
          });

          onProgress?.({ completed, total, succeeded, failed });
        },
        { priority: task.priority ?? 0 }
      )
    );

    await Promise.all(promises);

    const totalDuration = durations.reduce((a, b) => a + b, 0);
    const avgDuration = durations.length > 0 ? totalDuration / durations.length : 0;

    this.stats.totalExecuted += total;
    this.stats.totalSucceeded += succeeded;
    this.stats.totalFailed += failed;
    this.stats.successRate =
      this.stats.totalExecuted > 0
        ? (this.stats.totalSucceeded / this.stats.totalExecuted) * 100
        : 0;
    // Running average of duration
    this.stats.averageDuration = avgDuration;

    return results;
  }

  async executeAllSuccessful<T>(tasks: ExecutionTask<T>[]): Promise<T[]> {
    const results = await this.executeAll(tasks);
    return results.filter((r) => r.success).map((r) => r.result as T);
  }

  async executeAllOrFail<T>(tasks: ExecutionTask<T>[]): Promise<T[]> {
    const results = await this.executeAll(tasks);
    const failures = results.filter((r) => !r.success);

    if (failures.length > 0) {
      throw new Error(`${failures.length} task(s) failed`);
    }

    return results.map((r) => r.result as T);
  }

  getStats(): ExecutionStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalExecuted: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      successRate: 0,
      averageDuration: 0,
    };
  }
}

// Singleton exports moved above class definition — see comment at top of file.
