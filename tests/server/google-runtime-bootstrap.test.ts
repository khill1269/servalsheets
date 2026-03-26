import { beforeEach, describe, expect, it, vi } from 'vitest';

const googleRuntimeBootstrapMocks = vi.hoisted(() => {
  let schedulerDispatch:
    | ((job: {
        id: string;
        action: { tool: string; actionName: string; params: Record<string, unknown> };
      }) => Promise<void>)
    | undefined;
  const backendInitialize = vi.fn();

  return {
    createGoogleHandlerContext: vi.fn(),
    createHandlers: vi.fn(),
    createHandlerRuntimeBridge: vi.fn(),
    createTaskAwareSamplingServer: vi.fn(),
    getCostTracker: vi.fn(),
    initializeGoogleAdvancedFeatures: vi.fn(),
    initializeWebhookBootstrap: vi.fn(),
    backendInitialize,
    GoogleSheetsBackend: vi.fn(function MockGoogleSheetsBackend(
      this: { client: unknown },
      googleClient: unknown
    ) {
      this.client = googleClient;
      return {
        client: googleClient,
        initialize: backendInitialize,
      };
    }),
    DuckDBEngine: vi.fn(function MockDuckDBEngine() {
      return { kind: 'duckdb' };
    }),
    SchedulerService: vi.fn(function MockSchedulerService(
      this: unknown,
      _dataDir: string,
      dispatch: (job: {
        id: string;
        action: { tool: string; actionName: string; params: Record<string, unknown> };
      }) => Promise<void>
    ) {
      schedulerDispatch = dispatch;
      return { kind: 'scheduler' };
    }),
    getSchedulerDispatch: () => schedulerDispatch,
    resetSchedulerDispatch: () => {
      schedulerDispatch = undefined;
    },
  };
});

vi.mock('../../src/server/google-handler-context.js', () => ({
  createGoogleHandlerContext: googleRuntimeBootstrapMocks.createGoogleHandlerContext,
}));

vi.mock('../../src/handlers/index.js', () => ({
  createHandlers: googleRuntimeBootstrapMocks.createHandlers,
}));

vi.mock('../../src/server/handler-runtime-bridge.js', () => ({
  createHandlerRuntimeBridge: googleRuntimeBootstrapMocks.createHandlerRuntimeBridge,
}));

vi.mock('../../src/mcp/sampling.js', () => ({
  createTaskAwareSamplingServer: googleRuntimeBootstrapMocks.createTaskAwareSamplingServer,
}));

vi.mock('../../src/services/cost-tracker.js', () => ({
  getCostTracker: googleRuntimeBootstrapMocks.getCostTracker,
}));

vi.mock('../../src/server/google-feature-bootstrap.js', () => ({
  initializeGoogleAdvancedFeatures: googleRuntimeBootstrapMocks.initializeGoogleAdvancedFeatures,
}));

vi.mock('../../src/startup/webhook-bootstrap.js', () => ({
  initializeWebhookBootstrap: googleRuntimeBootstrapMocks.initializeWebhookBootstrap,
}));

vi.mock('../../src/adapters/index.js', () => ({
  GoogleSheetsBackend: googleRuntimeBootstrapMocks.GoogleSheetsBackend,
}));

vi.mock('../../src/services/duckdb-engine.js', () => ({
  DuckDBEngine: googleRuntimeBootstrapMocks.DuckDBEngine,
}));

vi.mock('../../src/services/scheduler.js', () => ({
  SchedulerService: googleRuntimeBootstrapMocks.SchedulerService,
}));

import { initializeServerGoogleRuntime } from '../../src/server/google-runtime-bootstrap.js';

describe('server google runtime bootstrap', () => {
  beforeEach(() => {
    googleRuntimeBootstrapMocks.createGoogleHandlerContext.mockReset();
    googleRuntimeBootstrapMocks.createHandlers.mockReset();
    googleRuntimeBootstrapMocks.createHandlerRuntimeBridge.mockReset();
    googleRuntimeBootstrapMocks.createTaskAwareSamplingServer.mockReset();
    googleRuntimeBootstrapMocks.getCostTracker.mockReset();
    googleRuntimeBootstrapMocks.initializeGoogleAdvancedFeatures.mockReset();
    googleRuntimeBootstrapMocks.initializeWebhookBootstrap.mockReset();
    googleRuntimeBootstrapMocks.backendInitialize.mockReset();
    googleRuntimeBootstrapMocks.GoogleSheetsBackend.mockClear();
    googleRuntimeBootstrapMocks.DuckDBEngine.mockClear();
    googleRuntimeBootstrapMocks.SchedulerService.mockClear();
    googleRuntimeBootstrapMocks.resetSchedulerDispatch();
  });

  it('creates the stdio google runtime context, handlers, and feature bootstraps', async () => {
    const context = { costTracker: { on: vi.fn() } };
    const handlers = { data: { kind: 'data' } };
    const bridge = { samplingServer: { kind: 'sampling' }, server: { kind: 'server' } };
    googleRuntimeBootstrapMocks.createGoogleHandlerContext.mockResolvedValueOnce(context);
    googleRuntimeBootstrapMocks.createHandlers.mockReturnValueOnce(handlers);
    googleRuntimeBootstrapMocks.createHandlerRuntimeBridge.mockReturnValueOnce(bridge);

    const googleClient = {
      sheets: { kind: 'sheets' },
      drive: { kind: 'drive' },
      bigquery: { kind: 'bigquery' },
    };
    const requestDeduplicator = { kind: 'dedup' };
    const taskStore = { kind: 'task-store' };
    const mcpServer = { kind: 'mcp-server' };
    const onProgress = vi.fn();
    const dispatchScheduledJob = vi.fn(async () => ({ isError: false }));

    const result = await initializeServerGoogleRuntime({
      googleClient: googleClient as never,
      envDataDir: '/tmp/data',
      taskStore: taskStore as never,
      mcpServer: mcpServer as never,
      costTrackingEnabled: true,
      requestDeduplicator: requestDeduplicator as never,
      onProgress,
      dispatchScheduledJob,
    });

    expect(googleRuntimeBootstrapMocks.GoogleSheetsBackend).toHaveBeenCalledWith(googleClient);
    expect(googleRuntimeBootstrapMocks.backendInitialize).toHaveBeenCalledOnce();
    expect(googleRuntimeBootstrapMocks.createHandlerRuntimeBridge).toHaveBeenCalledWith({
      server: mcpServer,
      createSamplingServer: googleRuntimeBootstrapMocks.createTaskAwareSamplingServer,
      costTrackingEnabled: true,
      getCostTracker: googleRuntimeBootstrapMocks.getCostTracker,
    });
    expect(googleRuntimeBootstrapMocks.createGoogleHandlerContext).toHaveBeenCalledOnce();
    const contextOptions = googleRuntimeBootstrapMocks.createGoogleHandlerContext.mock.calls[0]?.[0];
    expect(contextOptions.googleClient).toBe(googleClient);
    expect(contextOptions.onProgress).toBe(onProgress);
    expect(contextOptions.requestDeduplicator).toBe(requestDeduplicator);
    expect(contextOptions.extraContext).toMatchObject({
      duckdbEngine: { kind: 'duckdb' },
      scheduler: { kind: 'scheduler' },
      taskStore,
      ...bridge,
    });
    expect(googleRuntimeBootstrapMocks.createHandlers).toHaveBeenCalledWith({
      context,
      sheetsApi: googleClient.sheets,
      driveApi: googleClient.drive,
      bigqueryApi: googleClient.bigquery,
    });
    expect(googleRuntimeBootstrapMocks.initializeGoogleAdvancedFeatures).toHaveBeenCalledWith(
      googleClient
    );
    expect(googleRuntimeBootstrapMocks.initializeWebhookBootstrap).toHaveBeenCalledWith({
      googleClient,
    });
    expect(result).toEqual({ context, handlers });

    const schedulerDispatch = googleRuntimeBootstrapMocks.getSchedulerDispatch();
    expect(schedulerDispatch).toBeDefined();
    await schedulerDispatch?.({
      id: 'job-1',
      action: {
        tool: 'sheets_core',
        actionName: 'get',
        params: { spreadsheetId: 'sheet-1' },
      },
    });
    expect(dispatchScheduledJob).toHaveBeenCalledWith({
      id: 'job-1',
      action: {
        tool: 'sheets_core',
        actionName: 'get',
        params: { spreadsheetId: 'sheet-1' },
      },
    });
  });

  it('turns scheduled tool errors into scheduler service errors', async () => {
    googleRuntimeBootstrapMocks.createGoogleHandlerContext.mockResolvedValueOnce({});
    googleRuntimeBootstrapMocks.createHandlers.mockReturnValueOnce({});
    googleRuntimeBootstrapMocks.createHandlerRuntimeBridge.mockReturnValueOnce({});

    await initializeServerGoogleRuntime({
      googleClient: {
        sheets: {},
        drive: {},
      } as never,
      envDataDir: '/tmp/data',
      taskStore: { kind: 'task-store' } as never,
      mcpServer: { kind: 'mcp-server' } as never,
      costTrackingEnabled: false,
      dispatchScheduledJob: async () => ({ isError: true }),
    });

    const schedulerDispatch = googleRuntimeBootstrapMocks.getSchedulerDispatch();
    await expect(
      schedulerDispatch?.({
        id: 'job-2',
        action: {
          tool: 'sheets_data',
          actionName: 'write',
          params: {},
        },
      }) ?? Promise.resolve()
    ).rejects.toThrow('Scheduled job job-2 failed for sheets_data');
  });
});
