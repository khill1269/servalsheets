// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'npm',
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.stryker-critical.ts',
    related: false,
  },
  checkers: ['typescript'],
  coverageAnalysis: 'perTest',
  tsconfigFile: 'tsconfig.json',
  reporters: ['clear-text', 'progress'],
  timeoutMS: 30000,
  concurrency: 1,
  disableTypeChecks: true,
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  // Critical security + safety paths only
  mutate: [
    'src/auth/oauth-provider.ts',
    'src/middleware/mutation-safety-middleware.ts',
    'src/middleware/write-lock-middleware.ts',
    'src/utils/retry.ts',
    'src/utils/circuit-breaker.ts',
    'src/services/python-worker.ts',
    'src/services/duckdb-worker.ts',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    // Do NOT ignore `src/generated/**`: `src/schemas/annotations.ts` re-exports
    // from `../generated/annotations.js`, and omitting it from the sandbox makes
    // every test file that imports from `src/schemas/*` fail collection with
    // "Cannot find module '../generated/annotations.js'", which Stryker surfaces
    // as the misleading "No tests were found" error.
    'scripts/**',
    'docs/**',
  ],
};

export default config;
