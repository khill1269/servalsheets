/**
 * Vitest Configuration — Live API NIGHTLY tier
 *
 * Full 409-action matrix + cross-tool + stress + edge-case coverage.
 * Expected wall-time: 30-45 minutes. Expected API spend: multiple 60/min
 * quota windows (explicit backoff between waves is mandatory).
 *
 * Runs:
 *   - On a nightly GitHub Actions schedule (`.github/workflows/nightly-live-api.yml`)
 *   - On explicit dispatch (`workflow_dispatch`)
 *   - Local: `npm run test:live:nightly`
 *
 * Does NOT run:
 *   - On PRs (use smoke tier for PR gating)
 *   - On local `verify:safe` (that includes smoke only)
 *
 * Excluded by policy:
 *   - `tests/live-api/optimizations/` — P2b moved these out; they're
 *     timing-sensitive benchmarks, not correctness tests, and inflate
 *     failure counts with rate-limit flakes. Run them explicitly via
 *     `test:live:optimizations` when benchmarking.
 *
 * Use with: npx vitest --config tests/config/vitest.config.live.nightly.ts --run
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
    include: ['tests/live-api/**/*.test.ts', 'tests/live-api/**/*.live.test.ts'],
    // P2b: optimizations are excluded from the nightly correctness tier.
    // They're reached via `test:live:optimizations` when benchmarking.
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/.tmp/**',
      'tests/live-api/optimizations/**',
    ],
    env: {
      NODE_ENV: 'test',
      OAUTH_AUTO_OPEN_BROWSER: 'false',
      TEST_REAL_API: process.env.TEST_REAL_API ?? 'false',
      TEST_SPREADSHEET_ID: process.env.TEST_SPREADSHEET_ID ?? '',
      TEST_INFRASTRUCTURE_ENABLED: 'true',
      SERVAL_LIVE_TIER: 'nightly',
    },
    // Nightly gets generous timeouts and a single retry per test to
    // tolerate transient Google 500s — but not more than 1 retry, so
    // a real shape-drift bug still fails loudly.
    testTimeout: 90000,
    hookTimeout: 90000,
    pool: 'forks',
    maxWorkers: 1,
    retry: 1,
    reporters: ['verbose'],
    // Don't bail — we want the full failure set for a nightly.
    bail: 0,
    coverage: {
      enabled: false,
    },
    sequence: {
      shuffle: false,
    },
  },
});
