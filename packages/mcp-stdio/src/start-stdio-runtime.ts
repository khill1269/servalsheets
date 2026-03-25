import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  startStdioServer,
  type StartStdioServerOptions,
  type StdioProcessLike,
} from './start-stdio-server.js';
import {
  startStdioTransport,
  type StdioConnectableServer,
  type StdioTransportLogger,
} from './start-stdio-transport.js';

export interface StartStdioRuntimeOptions<
  TServer extends StdioConnectableServer<StdioServerTransport>,
> {
  readonly initTelemetry: () => Promise<void>;
  readonly validateEnv: () => void;
  readonly verifyToolIntegrity: () => Promise<void>;
  readonly initialize: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
  readonly getProcessBreadcrumbs: () => Record<string, unknown>;
  readonly server: TServer;
  readonly ensureResourcesRegistered: () => Promise<void>;
  readonly getIsShutdown: () => boolean;
  readonly toolCount: number;
  readonly actionCount: number;
  readonly log: StdioTransportLogger;
  readonly processLike?: StdioProcessLike;
}

export interface StartStdioRuntimeDependencies<
  TServer extends StdioConnectableServer<StdioServerTransport>,
> {
  readonly startServer?: (options: StartStdioServerOptions) => Promise<void>;
  readonly startTransport?: (options: {
    server: TServer;
    ensureResourcesRegistered: () => Promise<void>;
    shutdown: () => Promise<void>;
    getIsShutdown: () => boolean;
    getProcessBreadcrumbs: () => Record<string, unknown>;
    toolCount: number;
    actionCount: number;
    log: StdioTransportLogger;
  }) => Promise<void>;
}

export async function startStdioRuntime<
  TServer extends StdioConnectableServer<StdioServerTransport>,
>(
  options: StartStdioRuntimeOptions<TServer>,
  dependencies: StartStdioRuntimeDependencies<TServer> = {}
): Promise<void> {
  const startServerImpl = dependencies.startServer ?? startStdioServer;
  const startTransportImpl =
    dependencies.startTransport ??
    (async (transportOptions) =>
      startStdioTransport({
        ...transportOptions,
        createTransport: () => new StdioServerTransport(),
      }));

  await startServerImpl({
    initTelemetry: options.initTelemetry,
    validateEnv: options.validateEnv,
    verifyToolIntegrity: options.verifyToolIntegrity,
    initialize: options.initialize,
    shutdown: options.shutdown,
    getProcessBreadcrumbs: options.getProcessBreadcrumbs,
    processLike: options.processLike,
    startTransport: () =>
      startTransportImpl({
        server: options.server,
        ensureResourcesRegistered: options.ensureResourcesRegistered,
        shutdown: options.shutdown,
        getIsShutdown: options.getIsShutdown,
        getProcessBreadcrumbs: options.getProcessBreadcrumbs,
        toolCount: options.toolCount,
        actionCount: options.actionCount,
        log: options.log,
      }),
    log: options.log,
  });
}
