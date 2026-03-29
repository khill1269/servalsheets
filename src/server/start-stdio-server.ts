import {
  startStdioServer as startPackagedStdioServer,
  type StartStdioServerOptions as PackagedStartStdioServerOptions,
} from '../../packages/mcp-stdio/dist/start-stdio-server.js';

type StdioServerLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export type StartStdioServerOptions = Omit<
  PackagedStartStdioServerOptions,
  'log' | 'processLike'
> & {
  readonly log?: StdioServerLogger;
  readonly processLike?: PackagedStartStdioServerOptions['processLike'];
};

export async function startStdioServer(options: StartStdioServerOptions): Promise<void> {
  await startPackagedStdioServer({
    ...options,
    log: options.log ?? (await import('../utils/logger.js')).logger,
    processLike: options.processLike ?? process,
  });
}
