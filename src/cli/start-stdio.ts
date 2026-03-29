import {
  startStdioCli as startPackagedStdioCli,
  type StartStdioCliOptions as PackagedStartStdioCliOptions,
} from '../../packages/mcp-stdio/dist/start-stdio-cli.js';

type StdioCliLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export type StartStdioCliOptions<TServerOptions> = Omit<
  PackagedStartStdioCliOptions<TServerOptions>,
  'log'
> & {
  readonly log?: StdioCliLogger;
};

export async function startStdioCli<TServerOptions>(
  options: StartStdioCliOptions<TServerOptions>
): Promise<void> {
  await startPackagedStdioCli({
    ...options,
    log: options.log ?? (await import('../utils/logger.js')).logger,
  });
}
