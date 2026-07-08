import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

const CRITICAL_INCLUDE = [
  'tests/contracts/oauth-refresh-errors.test.ts',
  'tests/contracts/mutation-action-consistency.test.ts',
  'tests/middleware/mutation-safety-middleware.test.ts',
  'tests/middleware/write-lock-middleware.test.ts',
  'tests/services/python-worker.test.ts',
  'tests/services/duckdb-worker.test.ts',
  'tests/services/circuit-breaker-registry.test.ts',
  'tests/services/google-api.test.ts',
  'tests/services/metrics.extended.test.ts',
  'tests/utils/retry.test.ts',
  'tests/utils/circuit-breaker-states.test.ts',
  'tests/utils/circuit-breaker-fallback.test.ts',
  'tests/utils/quota-circuit-breaker.test.ts',
  'tests/unit/circuit-breaker-fallback.test.ts',
];

const merged = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      maxConcurrency: 1,
      maxWorkers: 1,
      minWorkers: 1,
    },
  })
);

// vitest's mergeConfig concatenates arrays. For Stryker we need to FULLY
// restrict the test set to the critical-path files, so replace `include`
// rather than merge it with the base `tests/**/*.test.ts` glob. Without this
// override, Stryker's initial dry run collects thousands of unrelated tests
// and hits hard-to-debug sandbox failures (e.g. filesystem-existence assertions
// that pass in the real repo but fail in .stryker-tmp/).
if (!merged.test) {
  merged.test = {};
}
merged.test.include = CRITICAL_INCLUDE;

export default merged;
