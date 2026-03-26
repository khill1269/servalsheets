export interface AsyncOnceRunner {
  run(): Promise<void>;
}

/**
 * Runs an async task at most once after it succeeds.
 * Concurrent callers share the same in-flight promise, and failures are retryable.
 */
export function createAsyncOnce(task: () => Promise<void>): AsyncOnceRunner {
  let completed = false;
  let inFlight: Promise<void> | null = null;

  return {
    run(): Promise<void> {
      if (completed) {
        return Promise.resolve();
      }

      if (inFlight) {
        return inFlight;
      }

      inFlight = task()
        .then(() => {
          completed = true;
        })
        .finally(() => {
          if (!completed) {
            inFlight = null;
            return;
          }

          inFlight = Promise.resolve();
        });

      return inFlight;
    },
  };
}
