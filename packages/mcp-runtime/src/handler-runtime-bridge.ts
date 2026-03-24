export interface CreateHandlerRuntimeBridgeOptions<TServer, TSamplingServer, TCostTracker> {
  readonly server: TServer;
  readonly createSamplingServer: (server: TServer) => TSamplingServer;
  readonly costTrackingEnabled?: boolean;
  readonly getCostTracker?: () => TCostTracker;
}

export interface HandlerRuntimeBridge<TServer, TSamplingServer, TCostTracker> {
  readonly samplingServer: TSamplingServer;
  readonly elicitationServer: TServer;
  readonly server: TServer;
  readonly costTracker?: TCostTracker;
}

export function createHandlerRuntimeBridge<TServer, TSamplingServer, TCostTracker>(
  options: CreateHandlerRuntimeBridgeOptions<TServer, TSamplingServer, TCostTracker>
): HandlerRuntimeBridge<TServer, TSamplingServer, TCostTracker> {
  return {
    ...(options.costTrackingEnabled && options.getCostTracker
      ? { costTracker: options.getCostTracker() }
      : {}),
    samplingServer: options.createSamplingServer(options.server),
    elicitationServer: options.server,
    server: options.server,
  };
}
