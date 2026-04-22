/**
 * Vitest Configuration — Live API OPTIMIZATIONS tier
 *
 * Dedicated config for the timing-sensitive benchmark-style tests under
 * `tests/live-api/optimizations/`:
 *
 *   - batching.live.test.ts        — request-batching timing bands
 *   - caching.live.test.ts         — cache hit/miss windows
 *   - circuit-breaker.live.test.ts — breaker thresholds (wall-clock)
 *   - parallel-execution.live.test.ts — concurrent-fan-out speedup
 *   - prefetching.live.test.ts     — prefetch hit-rate
 *   - request-merging.live.test.ts — dedup window correctness
 *
 * These are NOT correctness tests — they're *performance* assertions with
 * built-in timing bands. Keeping them in the correctness tier (nightly)
 * produced high flake rates (~4/39 failures in the 2026-04-21 E2E session)
 * because Google's tail-latency + our forks=1 pool makes wall-clock
 * timing measurements noisy.
 *
 * Run deliberately:
 *   - `npm run test:live:optimizations` when benchmarking
 *   - Never as a PR gate
 *   - Optionally on a weekly workflow (`.github/workflows/weekly-optimizations.yml`)
 *
 * Use with: npx vitest --config tests/config/vitest.config.live.optimizations.ts --run
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts', './tests/live-api/setup.ts'],
    include: ['tests/live-api/optimizations/**/*.live.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'tests/.tmp/**'],
    env: {
      NODE_ENV: 'test',
      OAUTH_AUTO_OPEN_BROWSER: 'false',
      TEST_REAL_API: process.env.TEST_REAL_API ?? 'false',
      TEST_SPREADSHEET_ID: process.env.TEST_SPREADSHEET_ID ?? '',
      TEST_INFRASTRUCTURE_ENABLED: 'true',
      SERVAL_LIVE_TIER: 'optimizations',
    },
    // Benchmarks need wider timing windows — wall-clock assertions
    // multiply flakiness under typical Google 500ms tail-latency.
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: 'forks',
    maxWorkers: 1,
    // Retry twice — these assertions are timing-sensitive by design
    // and a single spurious-slow request should not fail the run.
    retry: 2,
    reporters: ['verbose'],
    bail: 0,
    coverage: {
      enabled: false,
    },
    sequence: {
      shuffle: false,
    },
  },
});
