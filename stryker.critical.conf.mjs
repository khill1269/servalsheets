/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  coverageAnalysis: 'perTest',
  // Critical paths: core pipeline files and error handling
  mutate: [
    'src/core/errors.ts',
    'src/mcp/registration/tool-handlers.ts',
    'src/handlers/base.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  thresholds: {
    high: 60,
    low: 40,
    break: 0,
  },
  timeoutMS: 60000,
  concurrency: 2,
  disableTypeChecks: true,
  ignorePatterns: ['node_modules', 'dist', 'coverage', 'benchmark'],
};
