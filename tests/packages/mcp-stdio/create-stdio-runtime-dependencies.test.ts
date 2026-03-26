import { describe, expect, it, vi } from 'vitest';

import { createStdioRuntimeDependencies } from '../../../packages/mcp-stdio/src/create-stdio-runtime-dependencies.js';

describe('@serval/mcp-stdio createStdioRuntimeDependencies', () => {
  it('wraps health monitor startup and emits the started hook', async () => {
    const startHealthMonitor = vi.fn(async () => undefined);
    const onHealthMonitorStarted = vi.fn();

    const dependencies = createStdioRuntimeDependencies({
      ensureToolIntegrityVerified: vi.fn(async () => undefined),
      prepareRuntimePreflight: vi.fn(() => ({ envConfig: { mode: 'test' }, costTrackingEnabled: true })),
      createAuthHandler: vi.fn(() => ({ kind: 'auth-handler' })),
      createOptionalGoogleClient: vi.fn(async () => null),
      initializeGoogleRuntime: vi.fn(async () => ({
        context: { kind: 'context' },
        handlers: { kind: 'handlers' },
      })),
      initializeBuiltinConnectors: vi.fn(),
      configureConnectorSheetWriter: vi.fn(),
      initializeBilling: vi.fn(),
      registerTools: vi.fn(),
      registerCompletions: vi.fn(),
      registerResources: vi.fn(async () => undefined),
      shouldDeferResourceDiscovery: vi.fn(async () => false),
      markResourcesRegistered: vi.fn(),
      registerPrompts: vi.fn(),
      registerTaskCancelHandler: vi.fn(),
      registerLogging: vi.fn(),
      startCacheCleanupTask: vi.fn(),
      startHeapWatchdog: vi.fn(),
      startHealthMonitor,
      onHealthMonitorStarted,
    });

    await dependencies.startHealthMonitor();

    expect(startHealthMonitor).toHaveBeenCalledOnce();
    expect(onHealthMonitorStarted).toHaveBeenCalledOnce();
  });

  it('provides a default no-op resource deferral hook', () => {
    const dependencies = createStdioRuntimeDependencies({
      ensureToolIntegrityVerified: vi.fn(async () => undefined),
      prepareRuntimePreflight: vi.fn(() => ({ envConfig: { mode: 'test' }, costTrackingEnabled: false })),
      createAuthHandler: vi.fn(() => ({ kind: 'auth-handler' })),
      createOptionalGoogleClient: vi.fn(async () => null),
      initializeGoogleRuntime: vi.fn(async () => ({
        context: { kind: 'context' },
        handlers: { kind: 'handlers' },
      })),
      initializeBuiltinConnectors: vi.fn(),
      configureConnectorSheetWriter: vi.fn(),
      initializeBilling: vi.fn(),
      registerTools: vi.fn(),
      registerCompletions: vi.fn(),
      registerResources: vi.fn(async () => undefined),
      shouldDeferResourceDiscovery: vi.fn(async () => true),
      markResourcesRegistered: vi.fn(),
      registerPrompts: vi.fn(),
      registerTaskCancelHandler: vi.fn(),
      registerLogging: vi.fn(),
      startCacheCleanupTask: vi.fn(),
      startHeapWatchdog: vi.fn(),
      startHealthMonitor: vi.fn(async () => undefined),
    });

    expect(() => dependencies.onResourceDiscoveryDeferred?.()).not.toThrow();
  });
});
