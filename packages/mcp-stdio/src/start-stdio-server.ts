import type { StdioTransportLogger } from './start-stdio-transport.js';

export interface StdioProcessLike {
  on(event: string, listener: (...args: unknown[]) => void | Promise<void>): void;
  exit(code?: number): void;
}

export interface StartStdioServerOptions {
  readonly initTelemetry: () => Promise<void>;
  readonly validateEnv: () => void;
  readonly verifyToolIntegrity: () => Promise<void>;
  readonly initialize: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
  readonly startTransport: () => Promise<void>;
  readonly getProcessBreadcrumbs: () => Record<string, unknown>;
  readonly log: StdioTransportLogger;
  readonly processLike?: StdioProcessLike;
}

export async function startStdioServer(options: StartStdioServerOptions): Promise<void> {
  const processLike = options.processLike ?? process;

  await options.initTelemetry();
  options.validateEnv();
  await options.verifyToolIntegrity();

  options.log.info('[Phase 1/3] Initializing handlers...');
  const initStart = performance.now();

  try {
    await options.initialize();
    const initDuration = performance.now() - initStart;
    options.log.info('[Phase 1/3] \u2713 Handlers initialized', {
      durationMs: initDuration.toFixed(2),
    });
  } catch (error) {
    options.log.error('[Phase 1/3] \u2717 Initialization failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  const handleShutdown = async (signal: string): Promise<void> => {
    options.log.warn(`ServalSheets: Received ${signal}, shutting down...`);
    await options.shutdown();
    processLike.exit(0);
  };

  processLike.on('SIGINT', () => handleShutdown('SIGINT'));
  processLike.on('SIGTERM', () => handleShutdown('SIGTERM'));
  processLike.on('SIGHUP', () => handleShutdown('SIGHUP'));

  processLike.on('uncaughtException', async (error) => {
    options.log.error('ServalSheets: Uncaught exception', {
      error,
      ...options.getProcessBreadcrumbs(),
    });
    await options.shutdown();
    processLike.exit(1);
  });

  processLike.on('unhandledRejection', async (reason) => {
    options.log.error('ServalSheets: Unhandled rejection', {
      reason,
      ...options.getProcessBreadcrumbs(),
    });
    await options.shutdown();
    processLike.exit(1);
  });

  await options.startTransport();
}
