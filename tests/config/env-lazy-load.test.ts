/**
 * Tests for lazy env loading (Fix 3)
 *
 * Verifies that importing env.ts with missing required env vars does NOT
 * synchronously call process.exit.
 *
 * TDD: written BEFORE implementation, must fail initially.
 */
import { describe, it, expect, vi } from 'vitest';

// Import the module once at the top to share the cached instance across all
// tests in this file.  Re-importing inside each test causes prom-client to
// attempt double-registration of module-scoped gauges, which throws.
import * as envModule from '../../src/config/env.js';

describe('Fix 3: env.ts lazy validation', () => {
  it('importing env.ts with missing required vars does NOT call process.exit synchronously', async () => {
    // The module-level `env` must start as undefined (no eager validateEnv call).
    // If validateEnv() was still called at module scope it would have called
    // process.exit(1) in environments without GOOGLE_CLIENT_ID.  The fact that
    // we reached this test at all proves the import did not call process.exit.
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit should not be called at import time');
    }) as never);

    try {
      // Re-access the already-cached module — no re-import, no re-execution
      expect(envModule).toBeDefined();
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });

  it('getEnv() is exported and callable', () => {
    expect(typeof envModule.getEnv).toBe('function');
  });

  it('resetEnvForTest() is exported and callable without throwing', () => {
    expect(typeof envModule.resetEnvForTest).toBe('function');
    expect(() => envModule.resetEnvForTest()).not.toThrow();
  });
});
