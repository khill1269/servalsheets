import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  startStdioTransport as startPackagedStdioTransport,
  type StdioConnectableServer,
  type StartStdioTransportOptions as PackagedStartStdioTransportOptions,
} from '../../packages/mcp-stdio/dist/start-stdio-transport.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type StartStdioTransportOptions<
  TServer extends StdioConnectableServer<StdioServerTransport>,
> = Omit<
  PackagedStartStdioTransportOptions<StdioServerTransport, TServer>,
  'createTransport' | 'log'
> & {
  readonly log?: typeof defaultLogger;
};

export async function startStdioTransport<
  TServer extends StdioConnectableServer<StdioServerTransport>,
>(options: StartStdioTransportOptions<TServer>): Promise<void> {
  await startPackagedStdioTransport({
    ...options,
    createTransport: () => new StdioServerTransport(),
    log: options.log ?? defaultLogger,
  });
}
