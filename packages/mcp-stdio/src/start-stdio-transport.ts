export interface StdioTransportLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface StdioTransportLike {
  onclose?: () => void;
  onerror?: (error: Error) => void;
}

export interface StdioConnectableServer<TTransport> {
  connect(transport: TTransport): Promise<void>;
}

export interface StartStdioTransportOptions<
  TTransport extends StdioTransportLike,
  TServer extends StdioConnectableServer<TTransport>,
> {
  readonly createTransport: () => TTransport;
  readonly server: TServer;
  readonly initializeAfterConnect: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
  readonly getIsShutdown: () => boolean;
  readonly getProcessBreadcrumbs: () => Record<string, unknown>;
  readonly toolCount: number;
  readonly actionCount: number;
  readonly log: StdioTransportLogger;
}

export async function startStdioTransport<
  TTransport extends StdioTransportLike,
  TServer extends StdioConnectableServer<TTransport>,
>(options: StartStdioTransportOptions<TTransport, TServer>): Promise<void> {
  options.log.info('[Phase 2/3] Creating STDIO transport');
  const transportStart = performance.now();
  const transport = options.createTransport();
  const transportDuration = performance.now() - transportStart;
  let isConnected = false;

  options.log.info('Running in privacy mode - no data leaves your machine (STDIO transport)');

  transport.onclose = () => {
    if (!options.getIsShutdown()) {
      options.log.warn('MCP transport closed unexpectedly', {
        wasConnected: isConnected,
        suggestion: isConnected
          ? 'Client (Claude Desktop) may have crashed or disconnected'
          : 'Initial connection failed - check client MCP configuration',
        ...options.getProcessBreadcrumbs(),
      });

      void options.shutdown().catch((error) => {
        options.log.error('Shutdown after transport close failed', { error });
      });
    }
  };

  transport.onerror = (error: Error) => {
    options.log.error('MCP transport error', {
      error: error.message,
      stack: error.stack,
      isConnected,
      suggestion: 'Check Claude Desktop logs and MCP server configuration',
      ...options.getProcessBreadcrumbs(),
    });
  };

  options.log.info('[Phase 3/3] Connecting transport');
  const connectStart = performance.now();

  try {
    await options.server.connect(transport);
    isConnected = true;
    const connectDuration = performance.now() - connectStart;

    options.log.info(
      `[Phase 3/3] \u2713 ServalSheets ready (${options.toolCount} tools, ${options.actionCount} actions)`,
      {
        transport: 'stdio',
        connectionId: new Date().toISOString(),
        timing: {
          transportMs: transportDuration.toFixed(2),
          connectMs: connectDuration.toFixed(2),
        },
      }
    );

    await options.initializeAfterConnect();
  } catch (error) {
    options.log.error('[Phase 3/3] \u2717 Connection failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      transport: 'stdio',
      suggestion: 'Check Claude Desktop MCP configuration and server.json',
    });
    throw error;
  }
}
