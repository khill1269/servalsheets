import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';

interface LoggingBridgeState<TRateLimitState> {
  loggingBridgeInstalled: boolean;
  setLoggingBridgeInstalled: (value: boolean) => void;
  getRequestedMcpLogLevel: () => LoggingLevel | null;
  setRequestedMcpLogLevel: (level: LoggingLevel) => void;
  getForwardingMcpLog: () => boolean;
  setForwardingMcpLog: (value: boolean) => void;
  getRateLimitState: () => TRateLimitState;
  server: McpServer;
}

export function registerStdioPrompts(params: {
  server: McpServer;
  registerPrompts: (server: McpServer) => void;
}): void {
  params.registerPrompts(params.server);
}

export function registerStdioCompletions<TLog>(params: {
  ensureCompletionsRegistered: (log?: TLog) => void;
  log?: TLog;
}): void {
  params.ensureCompletionsRegistered(params.log);
}

export function registerStdioTaskCancelHandler<TTaskStore, TLog>(params: {
  taskStore: TTaskStore;
  taskAbortControllers: Map<string, AbortController>;
  taskWatchdogTimers: Map<string, NodeJS.Timeout>;
  registerTaskCancelHandler: (options: {
    taskStore: TTaskStore;
    taskAbortControllers: Map<string, AbortController>;
    taskWatchdogTimers: Map<string, NodeJS.Timeout>;
    log?: TLog;
  }) => void;
  log?: TLog;
}): void {
  params.registerTaskCancelHandler({
    taskStore: params.taskStore,
    taskAbortControllers: params.taskAbortControllers,
    taskWatchdogTimers: params.taskWatchdogTimers,
    log: params.log,
  });
}

export function installStdioLoggingBridge<TRateLimitState>(
  state: LoggingBridgeState<TRateLimitState>,
  deps: {
    installLoggingBridge: (params: {
      loggingBridgeInstalled: boolean;
      setLoggingBridgeInstalled: (value: boolean) => void;
      getRequestedMcpLogLevel: () => LoggingLevel | null;
      getForwardingMcpLog: () => boolean;
      setForwardingMcpLog: (value: boolean) => void;
      getRateLimitState: () => TRateLimitState;
      server: McpServer;
    }) => void;
  }
): void {
  deps.installLoggingBridge({
    loggingBridgeInstalled: state.loggingBridgeInstalled,
    setLoggingBridgeInstalled: state.setLoggingBridgeInstalled,
    getRequestedMcpLogLevel: state.getRequestedMcpLogLevel,
    getForwardingMcpLog: state.getForwardingMcpLog,
    setForwardingMcpLog: state.setForwardingMcpLog,
    getRateLimitState: state.getRateLimitState,
    server: state.server,
  });
}

export function registerStdioLogging<TRateLimitState, TLog>(
  state: LoggingBridgeState<TRateLimitState>,
  deps: {
    registerLogging: (params: {
      server: McpServer;
      setRequestedMcpLogLevel: (level: LoggingLevel) => void;
      installLoggingBridge: () => void;
      log?: TLog;
    }) => void;
    installLoggingBridge: (params: {
      loggingBridgeInstalled: boolean;
      setLoggingBridgeInstalled: (value: boolean) => void;
      getRequestedMcpLogLevel: () => LoggingLevel | null;
      getForwardingMcpLog: () => boolean;
      setForwardingMcpLog: (value: boolean) => void;
      getRateLimitState: () => TRateLimitState;
      server: McpServer;
    }) => void;
    log?: TLog;
  }
): void {
  deps.registerLogging({
    server: state.server,
    setRequestedMcpLogLevel: state.setRequestedMcpLogLevel,
    installLoggingBridge: () => {
      installStdioLoggingBridge(state, {
        installLoggingBridge: deps.installLoggingBridge,
      });
    },
    log: deps.log,
  });
}
