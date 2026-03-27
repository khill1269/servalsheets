import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [
        'tests/contracts/oauth-refresh-errors.test.ts',
        'tests/contracts/mutation-action-consistency.test.ts',
        'tests/middleware/mutation-safety-middleware.test.ts',
        'tests/middleware/write-lock-middleware.test.ts',
        'tests/services/python-worker.test.ts',
        'tests/services/duckdb-worker.test.ts',
        'tests/utils/retry.test.ts',
        'tests/utils/circuit-breaker-states.test.ts',
        'tests/utils/circuit-breaker-fallback.test.ts',
        'tests/unit/circuit-breaker-fallback.test.ts',
      ],
      maxConcurrency: 1,
      maxWorkers: 1,
      minWorkers: 1,
    },
  })
);
