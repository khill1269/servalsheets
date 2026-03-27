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
    'src/generated/**',
    'scripts/**',
    'docs/**',
  ],
};

export default config;
