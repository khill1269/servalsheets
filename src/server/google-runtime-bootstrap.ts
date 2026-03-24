import { GoogleSheetsBackend } from '../adapters/index.js';
import { type ProgressEvent, TaskStoreAdapter } from '../core/index.js';
import { ServiceError } from '../core/errors.js';
import { type HandlerContext, type HandlerMcpServer, type Handlers } from '../handlers/index.js';
import { createTaskAwareSamplingServer } from '../mcp/sampling.js';
import { getCostTracker } from '../services/cost-tracker.js';
import { DuckDBEngine } from '../services/duckdb-engine.js';
import { type GoogleApiClient } from '../services/google-api.js';
import { SchedulerService, type ScheduledJob } from '../services/scheduler.js';
import { initializeWebhookBootstrap } from '../startup/webhook-bootstrap.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import { createInitializedGoogleHandlerBundle } from './google-handler-bundle.js';
import { createHandlerRuntimeBridge } from './handler-runtime-bridge.js';

export interface InitializeServerGoogleRuntimeOptions {
  readonly googleClient: GoogleApiClient;
  readonly envDataDir: string;
  readonly taskStore: TaskStoreAdapter;
  readonly mcpServer: HandlerMcpServer;
  readonly costTrackingEnabled: boolean;
  readonly requestDeduplicator?: RequestDeduplicator;
  readonly onProgress?: (event: ProgressEvent) => void;
  readonly dispatchScheduledJob: (job: ScheduledJob) => Promise<unknown>;
}

export interface ServerGoogleRuntime {
  readonly context: HandlerContext;
  readonly handlers: Handlers;
}

export async function initializeServerGoogleRuntime(
  options: InitializeServerGoogleRuntimeOptions
): Promise<ServerGoogleRuntime> {
  const duckdbEngine = new DuckDBEngine();
  const scheduler = new SchedulerService(options.envDataDir, async (job) => {
    const result = await options.dispatchScheduledJob(job);

    if ((result as { isError?: boolean }).isError === true) {
      throw new ServiceError(
        `Scheduled job ${job.id} failed for ${job.action.tool}`,
        'INTERNAL_ERROR',
        'scheduler'
      );
    }
  });

  const backend = new GoogleSheetsBackend(options.googleClient);
  await backend.initialize();

  const { context, handlers } = await createInitializedGoogleHandlerBundle({
    googleClient: options.googleClient,
    onProgress: options.onProgress,
    requestDeduplicator: options.requestDeduplicator,
    extraContext: {
      backend,
      duckdbEngine,
      scheduler,
      taskStore: options.taskStore,
      ...createHandlerRuntimeBridge({
        server: options.mcpServer,
        createSamplingServer: createTaskAwareSamplingServer,
        costTrackingEnabled: options.costTrackingEnabled,
        getCostTracker,
      }),
    },
  });
  initializeWebhookBootstrap({
    googleClient: options.googleClient,
  });

  return {
    context,
    handlers,
  };
}
