import PQueue from 'p-queue';

interface BuildStdioInfrastructureLogger {
  info(message: string, meta?: unknown): void;
}

export interface ServerStdioInfrastructure<
  TServer,
  TTaskStore,
  TConnectionHealthCheck,
  THealthMonitor,
> {
  server: TServer;
  taskStore: TTaskStore;
  requestQueue: PQueue;
  connectionHealthCheck: TConnectionHealthCheck;
  healthMonitor: THealthMonitor;
}

export interface BuildServerStdioInfrastructureInput<
  TServer,
  TTaskStore,
  TConnectionHealthCheck,
  THealthMonitor,
  THealthCheck,
> {
  readonly options: {
    name?: string;
    version?: string;
    taskStore?: TTaskStore;
  };
  readonly packageVersion: string;
  readonly createTaskStore: () => TTaskStore;
  readonly createServer: (input: {
    name: string;
    version: string;
    taskStore: TTaskStore;
  }) => TServer;
  readonly afterServerCreated?: (server: TServer) => void;
  readonly maxConcurrentRequests: number;
  readonly createConnectionHealthCheck: (input: {
    disconnectThresholdMs: number;
    warnThresholdMs: number;
  }) => TConnectionHealthCheck & THealthCheck;
  readonly disconnectThresholdMs: number;
  readonly warnThresholdMs: number;
  readonly createHeapHealthCheck: (input: {
    warningThreshold: number;
    criticalThreshold: number;
    enableSnapshots: boolean;
    snapshotPath: string;
  }) => THealthCheck;
  readonly heapWarningThreshold: number;
  readonly heapCriticalThreshold: number;
  readonly enableHeapSnapshots: boolean;
  readonly heapSnapshotPath: string;
  readonly createHealthMonitor: (input: {
    checks: THealthCheck[];
    autoStart: boolean;
  }) => THealthMonitor;
  readonly healthMonitorAutoStart?: boolean;
  readonly log: BuildStdioInfrastructureLogger;
}

export function buildServerStdioInfrastructure<
  TServer,
  TTaskStore,
  TConnectionHealthCheck,
  THealthMonitor,
  THealthCheck,
>(
  input: BuildServerStdioInfrastructureInput<
    TServer,
    TTaskStore,
    TConnectionHealthCheck,
    THealthMonitor,
    THealthCheck
  >
): ServerStdioInfrastructure<TServer, TTaskStore, TConnectionHealthCheck, THealthMonitor> {
  const taskStore = input.options.taskStore ?? input.createTaskStore();
  const server = input.createServer({
    name: input.options.name ?? 'servalsheets',
    version: input.options.version ?? input.packageVersion,
    taskStore,
  });

  input.afterServerCreated?.(server);

  const requestQueue = new PQueue({
    concurrency: input.maxConcurrentRequests,
  });

  input.log.info('Request queue initialized', {
    maxConcurrent: input.maxConcurrentRequests,
  });

  const connectionHealthCheck = input.createConnectionHealthCheck({
    disconnectThresholdMs: input.disconnectThresholdMs,
    warnThresholdMs: input.warnThresholdMs,
  });

  const heapHealthCheck = input.createHeapHealthCheck({
    warningThreshold: input.heapWarningThreshold,
    criticalThreshold: input.heapCriticalThreshold,
    enableSnapshots: input.enableHeapSnapshots,
    snapshotPath: input.heapSnapshotPath,
  });

  const healthMonitor = input.createHealthMonitor({
    checks: [heapHealthCheck, connectionHealthCheck],
    autoStart: input.healthMonitorAutoStart ?? false,
  });

  return {
    server,
    taskStore,
    requestQueue,
    connectionHealthCheck,
    healthMonitor,
  };
}
