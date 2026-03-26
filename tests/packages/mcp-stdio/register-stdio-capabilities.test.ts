import { describe, expect, it, vi } from 'vitest';

import {
  installStdioLoggingBridge,
  registerStdioCompletions,
  registerStdioLogging,
  registerStdioPrompts,
  registerStdioTaskCancelHandler,
} from '../../../packages/mcp-stdio/src/register-stdio-capabilities.js';

describe('@serval/mcp-stdio registerStdioCapabilities', () => {
  it('delegates prompt registration to the provided registrar', () => {
    const registerPrompts = vi.fn();
    const server = { kind: 'server' };

    registerStdioPrompts({
      server: server as never,
      registerPrompts: registerPrompts as never,
    });

    expect(registerPrompts).toHaveBeenCalledWith(server);
  });

  it('passes the logger through to completions registration', () => {
    const ensureCompletionsRegistered = vi.fn();
    const log = { info: vi.fn() };

    registerStdioCompletions({
      ensureCompletionsRegistered,
      log,
    });

    expect(ensureCompletionsRegistered).toHaveBeenCalledWith(log);
  });

  it('registers task cancellation support with the provided state', () => {
    const registerTaskCancelHandler = vi.fn();
    const taskStore = { kind: 'store' };
    const taskAbortControllers = new Map<string, AbortController>();
    const taskWatchdogTimers = new Map<string, NodeJS.Timeout>();
    const log = { info: vi.fn() };

    registerStdioTaskCancelHandler({
      taskStore,
      taskAbortControllers,
      taskWatchdogTimers,
      registerTaskCancelHandler,
      log,
    });

    expect(registerTaskCancelHandler).toHaveBeenCalledWith({
      taskStore,
      taskAbortControllers,
      taskWatchdogTimers,
      log,
    });
  });

  it('installs the logging bridge with the current stdio logging state', () => {
    const installLoggingBridge = vi.fn();
    const state = {
      loggingBridgeInstalled: false,
      setLoggingBridgeInstalled: vi.fn(),
      getRequestedMcpLogLevel: vi.fn(() => 'info'),
      setRequestedMcpLogLevel: vi.fn(),
      getForwardingMcpLog: vi.fn(() => false),
      setForwardingMcpLog: vi.fn(),
      getRateLimitState: vi.fn(() => ({ tokens: 1 })),
      server: { kind: 'server' },
    };

    installStdioLoggingBridge(state as never, {
      installLoggingBridge,
    });

    expect(installLoggingBridge).toHaveBeenCalledWith({
      loggingBridgeInstalled: false,
      setLoggingBridgeInstalled: state.setLoggingBridgeInstalled,
      getRequestedMcpLogLevel: state.getRequestedMcpLogLevel,
      getForwardingMcpLog: state.getForwardingMcpLog,
      setForwardingMcpLog: state.setForwardingMcpLog,
      getRateLimitState: state.getRateLimitState,
      server: state.server,
    });
  });

  it('registers logging/setLevel with lazy logging bridge installation', () => {
    const registerLogging = vi.fn();
    const installLoggingBridge = vi.fn();
    const state = {
      loggingBridgeInstalled: false,
      setLoggingBridgeInstalled: vi.fn(),
      getRequestedMcpLogLevel: vi.fn(() => 'debug'),
      setRequestedMcpLogLevel: vi.fn(),
      getForwardingMcpLog: vi.fn(() => false),
      setForwardingMcpLog: vi.fn(),
      getRateLimitState: vi.fn(() => ({ tokens: 1 })),
      server: { kind: 'server' },
    };
    const log = { info: vi.fn() };

    registerStdioLogging(state as never, {
      registerLogging,
      installLoggingBridge,
      log,
    });

    expect(registerLogging).toHaveBeenCalledOnce();
    const params = registerLogging.mock.calls[0]?.[0];
    expect(params).toMatchObject({
      server: state.server,
      setRequestedMcpLogLevel: state.setRequestedMcpLogLevel,
      log,
    });

    params.installLoggingBridge();

    expect(installLoggingBridge).toHaveBeenCalledWith({
      loggingBridgeInstalled: false,
      setLoggingBridgeInstalled: state.setLoggingBridgeInstalled,
      getRequestedMcpLogLevel: state.getRequestedMcpLogLevel,
      getForwardingMcpLog: state.getForwardingMcpLog,
      setForwardingMcpLog: state.setForwardingMcpLog,
      getRateLimitState: state.getRateLimitState,
      server: state.server,
    });
  });
});
