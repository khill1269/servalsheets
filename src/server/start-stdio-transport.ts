import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  startStdioTransport as startPackagedStdioTransport,
  type StdioConnectableServer,
  type StartStdioTransportOptions as PackagedStartStdioTransportOptions,
} from '../../packages/mcp-stdio/dist/start-stdio-transport.js';

type StdioTransportLogger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export type StartStdioTransportOptions<
  TServer extends StdioConnectableServer<StdioServerTransport>,
> = Omit<
  PackagedStartStdioTransportOptions<StdioServerTransport, TServer>,
  'createTransport' | 'log'
> & {
  readonly log?: StdioTransportLogger;
};

export async function startStdioTransport<
  TServer extends StdioConnectableServer<StdioServerTransport>,
>(options: StartStdioTransportOptions<TServer>): Promise<void> {
  await startPackagedStdioTransport({
    ...options,
    createTransport: () => new StdioServerTransport(),
    log: options.log ?? (await import('../utils/logger.js')).logger,
  });
}
