import { describe, expect, it, vi } from 'vitest';

import { startCliRuntime } from '../../../packages/mcp-stdio/src/start-cli-runtime.js';

describe('@serval/mcp-stdio startCliRuntime', () => {
  it('runs startup steps and schedules successful-start bookkeeping', async () => {
    const calls: string[] = [];
    const output = {
      error: vi.fn(),
      warn: vi.fn(),
    };
    const recordSuccessfulStartup = vi.fn(async () => {
      calls.push('recordSuccessfulStartup');
    });
    let scheduledCallback: (() => void) | null = null;

    await startCliRuntime({
      checkRestartBackoff: async () => {
        calls.push('backoff');
        return 0;
      },
      sleep: async () => {
        calls.push('sleep');
      },
      recordStartupAttempt: async () => {
        calls.push('recordStartupAttempt');
      },
      runPreflightChecks: async () => {
        calls.push('preflight');
        return {
          criticalFailures: 0,
          warnings: 0,
          failures: [],
          warningList: [],
        };
      },
      requireEncryptionKeyInProduction: () => {
        calls.push('requireEncryptionKeyInProduction');
      },
      ensureEncryptionKey: () => {
        calls.push('ensureEncryptionKey');
      },
      logEnvironmentConfig: () => {
        calls.push('logEnvironmentConfig');
      },
      startBackgroundTasks: async () => {
        calls.push('startBackgroundTasks');
      },
      registerSignalHandlers: () => {
        calls.push('registerSignalHandlers');
      },
      startTransport: async () => {
        calls.push('startTransport');
      },
      recordSuccessfulStartup,
      output,
      exit: vi.fn(),
      setTimeoutFn: (callback) => {
        scheduledCallback = callback;
        return 1;
      },
    });

    expect(calls).toEqual([
      'backoff',
      'recordStartupAttempt',
      'preflight',
      'requireEncryptionKeyInProduction',
      'ensureEncryptionKey',
      'logEnvironmentConfig',
      'startBackgroundTasks',
      'registerSignalHandlers',
      'startTransport',
    ]);
    expect(scheduledCallback).not.toBeNull();
    await scheduledCallback?.();
    expect(recordSuccessfulStartup).toHaveBeenCalledOnce();
    expect(output.error).not.toHaveBeenCalled();
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('prints preflight failures and exits before startup continues', async () => {
    const output = {
      error: vi.fn(),
      warn: vi.fn(),
    };
    const exit = vi.fn();
    const startTransport = vi.fn(async () => {});

    await startCliRuntime({
      checkRestartBackoff: async () => 0,
      sleep: async () => {},
      recordStartupAttempt: async () => {},
      runPreflightChecks: async () => ({
        criticalFailures: 1,
        warnings: 0,
        failures: [
          {
            name: 'build-artifacts',
            message: 'dist/ directory not found - project not built',
            fix: 'Run: npm run build',
          },
        ],
        warningList: [],
      }),
      requireEncryptionKeyInProduction: () => {
        throw new Error('should not run');
      },
      ensureEncryptionKey: () => {
        throw new Error('should not run');
      },
      logEnvironmentConfig: () => {
        throw new Error('should not run');
      },
      startBackgroundTasks: async () => {
        throw new Error('should not run');
      },
      registerSignalHandlers: () => {
        throw new Error('should not run');
      },
      startTransport,
      recordSuccessfulStartup: async () => {},
      output,
      exit,
    });

    expect(output.error).toHaveBeenCalledWith('\n❌ Pre-flight checks failed - cannot start server\n');
    expect(output.error).toHaveBeenCalledWith(
      '  ✗ build-artifacts: dist/ directory not found - project not built'
    );
    expect(output.error).toHaveBeenCalledWith('    Fix: Run: npm run build');
    expect(exit).toHaveBeenCalledWith(1);
    expect(startTransport).not.toHaveBeenCalled();
  });
});
