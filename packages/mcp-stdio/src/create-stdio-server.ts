export interface CreateStdioServerDependencies<TOptions, TServer> {
  readonly prepareBootstrap: (options: TOptions) => Promise<void>;
  readonly createServer: (options: TOptions) => TServer;
  readonly startServer: (server: TServer) => Promise<void>;
}

export async function createStdioServer<TOptions, TServer>(
  options: TOptions,
  dependencies: CreateStdioServerDependencies<TOptions, TServer>
): Promise<TServer> {
  await dependencies.prepareBootstrap(options);
  const server = dependencies.createServer(options);
  await dependencies.startServer(server);
  return server;
}
