import { describe, expect, it, vi } from 'vitest';

import { buildStdioRuntimeDependencies } from '../../../packages/mcp-stdio/src/build-stdio-runtime-dependencies.js';

describe('@serval/mcp-stdio buildStdioRuntimeDependencies', () => {
  it('wraps completions registration and health monitor startup through the provided logger', async () => {
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const startHealthMonitor = vi.fn(async () => undefined);
    const registerCompletions = vi.fn();

    const dependencies = buildStdioRuntimeDependencies({
      ensureToolIntegrityVerified: vi.fn(async () => undefined),
      googleApiOptions: undefined,
      taskStore: { kind: 'task-store' },
      mcpServer: { kind: 'server' },
      taskAbortControllers: new Map(),
      taskWatchdogTimers: new Map(),
      healthMonitor: { start: startHealthMonitor },
      logging: {
        loggingBridgeInstalled: false,
        setLoggingBridgeInstalled: vi.fn(),
        requestedMcpLogLevel: null,
        setRequestedMcpLogLevel: vi.fn(),
        forwardingMcpLog: false,
        setForwardingMcpLog: vi.fn(),
        rateLimitState: {
          windowStartedAt: 0,
          messagesInWindow: 0,
          droppedInWindow: 0,
        },
      },
      markResourcesRegistered: vi.fn(),
      registerTools: vi.fn(),
      registerResources: vi.fn(async () => undefined),
      handleToolCall: vi.fn(async () => ({ content: [] })),
      prepareRuntimePreflight: vi.fn(() => ({
        envConfig: { mode: 'test' },
        costTrackingEnabled: false,
      })),
      createAuthHandler: vi.fn(() => ({ kind: 'auth-handler' })),
      createOptionalGoogleClient: vi.fn(async () => null),
      transport: 'stdio',
      nodeEnv: 'test',
      allowDegradedExplicitly: false,
      initializeGoogleRuntime: vi.fn(async () => ({
        context: { kind: 'context' },
        handlers: { kind: 'handlers' },
      })),
      onProgress: vi.fn(),
      initializeBuiltinConnectors: vi.fn(),
      configureConnectorSheetWriter: vi.fn(),
      initializeBilling: vi.fn(),
      registerCompletions,
      shouldDeferResourceDiscovery: vi.fn(async () => false),
      registerPrompts: vi.fn(),
      registerTaskCancelHandler: vi.fn(),
      registerLogging: vi.fn(),
      startCacheCleanupTask: vi.fn(),
      startHeapWatchdog: vi.fn(),
      onHealthMonitorStarted: (logger) => {
        logger.info('Health monitoring started');
      },
      log,
    });

    dependencies.registerCompletions();
    await dependencies.startHealthMonitor();

    expect(registerCompletions).toHaveBeenCalledWith(log);
    expect(startHealthMonitor).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalledWith('Health monitoring started');
  });
});
