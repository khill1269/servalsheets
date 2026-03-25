import { describe, expect, it, vi } from 'vitest';

import { buildServerStdioRuntimeDependencies } from '../../src/server/build-server-stdio-runtime-dependencies.js';

describe('buildServerStdioRuntimeDependencies', () => {
  it('wires completions registration and health monitor startup through the provided logger', async () => {
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    const startHealthMonitor = vi.fn(async () => undefined);

    const dependencies = buildServerStdioRuntimeDependencies({
      ensureToolIntegrityVerified: vi.fn(async () => undefined),
      googleApiOptions: undefined,
      taskStore: { kind: 'task-store' } as never,
      mcpServer: { server: {} } as never,
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
      log,
    });

    dependencies.registerCompletions();
    await dependencies.startHealthMonitor();

    expect(log.info).toHaveBeenCalledWith(
      'Completions capability registered (spreadsheetId + range autocompletion active)'
    );
    expect(startHealthMonitor).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalledWith('Health monitoring started');
  });
});
