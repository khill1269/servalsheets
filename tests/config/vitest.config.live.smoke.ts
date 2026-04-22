/**
 * Vitest Configuration — Live API SMOKE tier
 *
 * A narrow, quota-safe slice of the live-api suite intended for every PR
 * and every local verify:safe. Budget: < 60 writes/min (Google Sheets API
 * hard cliff) and < 5 min wall time.
 *
 * Surface:
 *   - sheets_auth      (status, login flow — read-only)
 *   - sheets_core      (list, get, list_sheets — read-heavy)
 *   - sheets_data      (read, write — most-used path)
 *   - sheets_session   (session state, record_operation)
 *   - infrastructure   (rate-limit + pool health)
 *
 * Excluded by design:
 *   - optimizations/   (intrinsically timing-sensitive; P2b)
 *   - zstress/         (concurrent stress; blows the quota)
 *   - action-matrix    (full 409-action sweep; nightly tier)
 *   - large-scale/unicode (edge tiers; nightly)
 *
 * If a smoke run fails, it's almost certainly a real regression — not
 * a quota cliff. That signal is the whole point of this tier.
 *
 * Use with: npx vitest --config tests/config/vitest.config.live.smoke.ts --run
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
    include: [
      // Keep this list short — every addition spends rate budget.
      'tests/live-api/auth/incremental-consent.live.test.ts',
      'tests/live-api/tools/sheets-auth.live.test.ts',
      'tests/live-api/tools/sheets-core.live.test.ts',
      'tests/live-api/tools/sheets-data.live.test.ts',
      'tests/live-api/tools/sheets-session.live.test.ts',
      'tests/live-api/infrastructure.test.ts',
    ],
    exclude: ['node_modules/**', 'dist/**', 'tests/.tmp/**'],
    env: {
      NODE_ENV: 'test',
      OAUTH_AUTO_OPEN_BROWSER: 'false',
      TEST_REAL_API: process.env.TEST_REAL_API ?? 'false',
      TEST_SPREADSHEET_ID: process.env.TEST_SPREADSHEET_ID ?? '',
      TEST_INFRASTRUCTURE_ENABLED: 'true',
      // Smoke runs opt out of rate-limit-sensitive stress paths.
      SERVAL_LIVE_TIER: 'smoke',
    },
    // Tighter timeouts than nightly — smoke tests must be fast.
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    maxWorkers: 1,
    // No retries in smoke — flakes mean real regressions, not quota races.
    retry: 0,
    reporters: ['verbose'],
    bail: process.env.CI ? 1 : 0,
    coverage: {
      enabled: false,
    },
    sequence: {
      shuffle: false,
    },
  },
});
