/**
 * Vitest Configuration for E2E Tests
 *
 * Configuration for end-to-end tests that run against
 * the hosted MCP server deployment.
 *
 * @see https://vitest.dev/config/
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use node environment for E2E tests
    environment: 'node',

    // Per-test timeout (E2E tests may be slower due to network)
    testTimeout: 30000,

    // Hook timeout for setup/teardown
    hookTimeout: 30000,

    // Run tests sequentially to avoid resource contention
    // E2E tests may have shared state (server connection)
    // @ts-expect-error poolOptions.threads.singleThread is a valid vitest option
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },

    // Include only E2E test files
    include: ['tests/e2e/**/*.test.ts'],

    // Exclude non-test files
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**/*.ts', '!tests/e2e/**/*.test.ts'],

    // Use E2E-specific reporter
    reporters: ['verbose'],

    // Global setup/teardown
    globals: true,

    // Disable coverage for E2E tests by default
    // Coverage is for unit/integration tests
    coverage: {
      enabled: false,
    },

    // Environment variables for E2E tests
    env: {
      NODE_ENV: 'test',
      // Default to localhost, can be overridden with BASE_URL env var
      BASE_URL: process.env['BASE_URL'] || 'http://localhost:3000',
    },
  },
});
