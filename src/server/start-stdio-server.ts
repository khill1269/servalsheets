import {
  startStdioServer as startPackagedStdioServer,
  type StartStdioServerOptions as PackagedStartStdioServerOptions,
} from '../../packages/mcp-stdio/dist/start-stdio-server.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type StartStdioServerOptions = Omit<
  PackagedStartStdioServerOptions,
  'log' | 'processLike'
> & {
  readonly log?: typeof defaultLogger;
  readonly processLike?: PackagedStartStdioServerOptions['processLike'];
};

export async function startStdioServer(options: StartStdioServerOptions): Promise<void> {
  await startPackagedStdioServer({
    ...options,
    log: options.log ?? defaultLogger,
    processLike: options.processLike ?? process,
  });
}
