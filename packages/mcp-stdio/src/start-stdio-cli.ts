export interface StdioCliLogger {
  info(message: string, meta?: unknown): void;
}

export interface StartStdioCliOptions<TServerOptions> {
  readonly serverOptions: TServerOptions;
  readonly createServalSheetsServer: (options: TServerOptions) => Promise<unknown>;
  readonly log: StdioCliLogger;
}

export async function startStdioCli<TServerOptions>(
  options: StartStdioCliOptions<TServerOptions>
): Promise<void> {
  await options.createServalSheetsServer(options.serverOptions);
  options.log.info('ServalSheets STDIO server started successfully');
}
