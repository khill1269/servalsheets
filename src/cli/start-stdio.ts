import {
  startStdioCli as startPackagedStdioCli,
  type StartStdioCliOptions as PackagedStartStdioCliOptions,
} from '#mcp-stdio/start-stdio-cli';
import { logger as defaultLogger } from '../utils/logger.js';

export type StartStdioCliOptions<TServerOptions> = Omit<
  PackagedStartStdioCliOptions<TServerOptions>,
  'log'
> & {
  readonly log?: typeof defaultLogger;
};

export async function startStdioCli<TServerOptions>(
  options: StartStdioCliOptions<TServerOptions>
): Promise<void> {
  await startPackagedStdioCli({
    ...options,
    log: options.log ?? defaultLogger,
  });
}
