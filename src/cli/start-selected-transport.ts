import type { ServalSheetsServerOptions } from '../server.js';
import type { CliTransportOptions } from './command-parsing.js';
import type { startStdioCli as startStdioCliFn } from './start-stdio.js';

type CliTransportLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export interface StartSelectedCliTransportDependencies {
  readonly startStdioCli: typeof startStdioCliFn;
  readonly loadHttpServer?: () => Promise<{
    startHttpServer: (options: { port: number } & ServalSheetsServerOptions) => Promise<void>;
  }>;
  readonly loadStdioServer?: () => Promise<{
    createServalSheetsServer: (options: ServalSheetsServerOptions) => Promise<unknown>;
  }>;
  readonly env?: Record<string, string | undefined>;
  readonly log?: CliTransportLogger;
}

export async function startSelectedCliTransport(
  cliOptions: CliTransportOptions,
  serverOptions: ServalSheetsServerOptions,
  dependencies: StartSelectedCliTransportDependencies
): Promise<void> {
  const log = dependencies.log ?? (await import('../utils/logger.js')).logger;
  const env = dependencies.env ?? process.env;

  if (cliOptions.transport === 'http') {
    const port = cliOptions.port ?? parseInt(env['PORT'] ?? '3000', 10);
    const { startHttpServer } =
      (await dependencies.loadHttpServer?.()) ?? (await import('../http-server.js'));
    await startHttpServer({ port, ...serverOptions });
    log.info(`ServalSheets HTTP server started on port ${port}`);
    return;
  }

  const { createServalSheetsServer } =
    (await dependencies.loadStdioServer?.()) ?? (await import('../server.js'));
  await dependencies.startStdioCli({
    serverOptions,
    createServalSheetsServer,
    log,
  });
}
