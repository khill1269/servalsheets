import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Ensure tests don't run in production mode
    env: {
      NODE_ENV: 'test',
      OAUTH_AUTO_OPEN_BROWSER: 'false',
    },
    // Test sharding support for parallel execution
    // Use: npm run test:shard 1/4 to run 1st quarter of tests
    // Use: npm run test:unit to run unit tests only
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/.tmp/**',
      'tests/manual/**',
      'tests/examples/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts', // Re-export files
        'src/cli.ts', // CLI entry point
        'src/http-server.ts', // HTTP server entry point (integration tested separately)
        'src/remote-server.ts', // Remote server entry point
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75,
      },
      include: ['src/**/*.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
