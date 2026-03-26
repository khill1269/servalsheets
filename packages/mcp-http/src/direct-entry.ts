export interface HttpDirectEntryLogger {
  info(message: string): void;
  error(message: string, meta?: unknown): void;
}

export interface RunHttpServerDirectEntryOptions {
  readonly startHttpServer: (options: { port: number }) => Promise<void>;
  readonly logEnvironmentConfig: () => void;
  readonly startBackgroundTasks: () => Promise<void>;
  readonly registerSignalHandlers: () => void;
  readonly port?: number;
  readonly log?: HttpDirectEntryLogger;
  readonly exit?: (code: number) => void;
}

const defaultLogger: HttpDirectEntryLogger = {
  info(message: string) {
    console.info(message);
  },
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export async function runHttpServerDirectEntry(
  options: RunHttpServerDirectEntryOptions
): Promise<void> {
  const {
    startHttpServer,
    logEnvironmentConfig,
    startBackgroundTasks,
    registerSignalHandlers,
    port = parseInt(process.env['PORT'] ?? '3000', 10),
    log = defaultLogger,
    exit = (code) => process.exit(code),
  } = options;

  try {
    logEnvironmentConfig();
    await startBackgroundTasks();
    registerSignalHandlers();
    await startHttpServer({ port });
    log.info('ServalSheets HTTP server started successfully');
  } catch (error) {
    log.error('Failed to start HTTP server', { error });
    exit(1);
  }
}
