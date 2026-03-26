import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtimeFactoryMocks = vi.hoisted(() => ({
  randomUUID: vi.fn(),
  getEnv: vi.fn(),
  prepareRuntimePreflight: vi.fn(),
  validateToolCatalogConfiguration: vi.fn(),
  createTaskStore: vi.fn(),
  createBaseMcpServer: vi.fn(),
  createServerCapabilities: vi.fn(),
  installInitializeCancellationGuard: vi.fn(),
  getOrCreateSessionContextAsync: vi.fn(),
  createHandlerRuntimeBridge: vi.fn(),
  createTaskAwareSamplingServer: vi.fn(),
  getCostTracker: vi.fn(),
  createTokenBackedInitializedGoogleHandlerBundle: vi.fn(),
  buildBillingBootstrapConfig: vi.fn(),
  initializeBillingIntegration: vi.fn(),
  registerServalSheetsTools: vi.fn(),
  registerServerPrompts: vi.fn(),
  registerServerResources: vi.fn(),
  registerHttpLoggingSetLevelHandler: vi.fn(),
  createMcpLogRateLimitState: vi.fn(),
  sendProgress: vi.fn(),
  teardownResourceNotifications: vi.fn(),
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
  requestDeduplicator: { kind: 'dedup' },
}));

vi.mock('crypto', () => ({
  randomUUID: runtimeFactoryMocks.randomUUID,
}));

vi.mock('../../src/config/env.js', () => ({
  getEnv: runtimeFactoryMocks.getEnv,
}));

vi.mock('../../src/server/runtime-preflight.js', () => ({
  prepareRuntimePreflight: runtimeFactoryMocks.prepareRuntimePreflight,
}));

vi.mock('../../src/mcp/tool-catalog.js', () => ({
  validateToolCatalogConfiguration: runtimeFactoryMocks.validateToolCatalogConfiguration,
}));

vi.mock('../../src/core/task-store-factory.js', () => ({
  createTaskStore: runtimeFactoryMocks.createTaskStore,
}));

vi.mock('../../src/server/create-base-mcp-server.js', () => ({
  createBaseMcpServer: runtimeFactoryMocks.createBaseMcpServer,
}));

vi.mock('../../src/mcp/features-2025-11-25.js', () => ({
  createServerCapabilities: runtimeFactoryMocks.createServerCapabilities,
  SERVER_INSTRUCTIONS: 'server instructions',
}));

vi.mock('../../src/server/initialize-cancellation-guard.js', () => ({
  installInitializeCancellationGuard: runtimeFactoryMocks.installInitializeCancellationGuard,
}));

vi.mock('../../src/services/session-context.js', () => ({
  getOrCreateSessionContextAsync: runtimeFactoryMocks.getOrCreateSessionContextAsync,
}));

vi.mock('../../src/server/handler-runtime-bridge.js', () => ({
  createHandlerRuntimeBridge: runtimeFactoryMocks.createHandlerRuntimeBridge,
}));

vi.mock('../../src/mcp/sampling.js', () => ({
  createTaskAwareSamplingServer: runtimeFactoryMocks.createTaskAwareSamplingServer,
}));

vi.mock('../../src/services/cost-tracker.js', () => ({
  getCostTracker: runtimeFactoryMocks.getCostTracker,
}));

vi.mock('../../src/server/google-handler-bundle.js', () => ({
  createTokenBackedInitializedGoogleHandlerBundle:
    runtimeFactoryMocks.createTokenBackedInitializedGoogleHandlerBundle,
}));

vi.mock('../../src/server/billing-bootstrap-config.js', () => ({
  buildBillingBootstrapConfig: runtimeFactoryMocks.buildBillingBootstrapConfig,
}));

vi.mock('../../src/services/billing-integration.js', () => ({
  initializeBillingIntegration: runtimeFactoryMocks.initializeBillingIntegration,
}));

vi.mock('../../src/mcp/registration/tool-handlers.js', () => ({
  registerServalSheetsTools: runtimeFactoryMocks.registerServalSheetsTools,
}));

vi.mock('../../src/server/resource-registration.js', () => ({
  registerServerPrompts: runtimeFactoryMocks.registerServerPrompts,
  registerServerResources: runtimeFactoryMocks.registerServerResources,
}));

vi.mock('../../src/http-server/logging-registration.js', () => ({
  registerHttpLoggingSetLevelHandler: runtimeFactoryMocks.registerHttpLoggingSetLevelHandler,
}));

vi.mock('../../src/server/logging-bridge-utils.js', () => ({
  createMcpLogRateLimitState: runtimeFactoryMocks.createMcpLogRateLimitState,
}));

vi.mock('../../src/utils/request-context.js', () => ({
  sendProgress: runtimeFactoryMocks.sendProgress,
}));

vi.mock('../../src/resources/index.js', () => ({
  teardownResourceNotifications: runtimeFactoryMocks.teardownResourceNotifications,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: runtimeFactoryMocks.logger,
}));

vi.mock('../../src/utils/request-deduplication.js', () => ({
  requestDeduplicator: runtimeFactoryMocks.requestDeduplicator,
}));

vi.mock('../../src/version.js', () => ({
  SERVER_INFO: { name: 'ServalSheets', version: '9.9.9' },
  SERVER_ICONS: [{ src: 'icon.svg' }],
}));

import { createHttpMcpServerInstance } from '../../src/http-server/runtime-factory.js';

describe('http runtime factory', () => {
  beforeEach(() => {
    runtimeFactoryMocks.randomUUID.mockReset();
    runtimeFactoryMocks.getEnv.mockReset();
    runtimeFactoryMocks.prepareRuntimePreflight.mockReset();
    runtimeFactoryMocks.validateToolCatalogConfiguration.mockReset();
    runtimeFactoryMocks.createTaskStore.mockReset();
    runtimeFactoryMocks.createBaseMcpServer.mockReset();
    runtimeFactoryMocks.createServerCapabilities.mockReset();
    runtimeFactoryMocks.installInitializeCancellationGuard.mockReset();
    runtimeFactoryMocks.getOrCreateSessionContextAsync.mockReset();
    runtimeFactoryMocks.createHandlerRuntimeBridge.mockReset();
    runtimeFactoryMocks.createTaskAwareSamplingServer.mockReset();
    runtimeFactoryMocks.getCostTracker.mockReset();
    runtimeFactoryMocks.createTokenBackedInitializedGoogleHandlerBundle.mockReset();
    runtimeFactoryMocks.buildBillingBootstrapConfig.mockReset();
    runtimeFactoryMocks.initializeBillingIntegration.mockReset();
    runtimeFactoryMocks.registerServalSheetsTools.mockReset();
    runtimeFactoryMocks.registerServerPrompts.mockReset();
    runtimeFactoryMocks.registerServerResources.mockReset();
    runtimeFactoryMocks.registerHttpLoggingSetLevelHandler.mockReset();
    runtimeFactoryMocks.createMcpLogRateLimitState.mockReset();
    runtimeFactoryMocks.sendProgress.mockReset();
    runtimeFactoryMocks.teardownResourceNotifications.mockReset();
    runtimeFactoryMocks.logger.warn.mockReset();
    runtimeFactoryMocks.logger.info.mockReset();
    runtimeFactoryMocks.logger.error.mockReset();
    runtimeFactoryMocks.logger.debug.mockReset();
    runtimeFactoryMocks.logger.log.mockReset();
  });

  it('builds an authenticated HTTP MCP runtime and disposes it cleanly', async () => {
    const envConfig = {
      ENABLE_COST_TRACKING: true,
      ENABLE_BILLING_INTEGRATION: false,
    };
    const taskStore = { kind: 'task-store' };
    const mcpServer = { server: { kind: 'raw-server' } };
    const sessionContext = { kind: 'session-context' };
    const bridge = { samplingServer: { kind: 'sampling' }, server: mcpServer.server };
    const googleClient = { sheets: { kind: 'sheets' }, drive: { kind: 'drive' } };
    const context = { kind: 'context' };
    const handlers = { data: { kind: 'data' } };
    const toolDispose = vi.fn();
    const installLoggingBridge = vi.fn();
    const subscribers = new Map();

    runtimeFactoryMocks.prepareRuntimePreflight.mockReturnValue({
      envConfig,
      costTrackingEnabled: true,
    });
    runtimeFactoryMocks.createTaskStore.mockResolvedValue(taskStore);
    runtimeFactoryMocks.createServerCapabilities.mockReturnValue({ tools: {} });
    runtimeFactoryMocks.createBaseMcpServer.mockReturnValue(mcpServer);
    runtimeFactoryMocks.getOrCreateSessionContextAsync.mockResolvedValue(sessionContext);
    runtimeFactoryMocks.createHandlerRuntimeBridge.mockReturnValue(bridge);
    runtimeFactoryMocks.createTokenBackedInitializedGoogleHandlerBundle.mockResolvedValue({
      googleClient,
      context,
      handlers,
    });
    runtimeFactoryMocks.buildBillingBootstrapConfig.mockReturnValue({ billing: true });
    runtimeFactoryMocks.registerServalSheetsTools.mockResolvedValue({ dispose: toolDispose });

    const runtime = await createHttpMcpServerInstance({
      googleToken: 'access-token',
      googleRefreshToken: 'refresh-token',
      sessionId: 'session-123',
      subscribers,
      installLoggingBridge,
    });

    expect(runtimeFactoryMocks.prepareRuntimePreflight).toHaveBeenCalledWith({
      loadEnv: runtimeFactoryMocks.getEnv,
      validateToolCatalogConfiguration: runtimeFactoryMocks.validateToolCatalogConfiguration,
    });
    expect(runtimeFactoryMocks.createBaseMcpServer).toHaveBeenCalledWith({
      serverInfo: {
        name: 'ServalSheets',
        version: '9.9.9',
        icons: [{ src: 'icon.svg' }],
      },
      capabilities: { tools: {} },
      instructions: 'server instructions',
      taskStore,
    });
    expect(runtimeFactoryMocks.installInitializeCancellationGuard).toHaveBeenCalledWith(
      mcpServer,
      expect.objectContaining({
        onIgnoredCancellation: expect.any(Function),
      })
    );
    expect(runtimeFactoryMocks.getOrCreateSessionContextAsync).toHaveBeenCalledWith('session-123');
    expect(runtimeFactoryMocks.createHandlerRuntimeBridge).toHaveBeenCalledWith({
      server: mcpServer.server,
      createSamplingServer: runtimeFactoryMocks.createTaskAwareSamplingServer,
      costTrackingEnabled: true,
      getCostTracker: runtimeFactoryMocks.getCostTracker,
    });

    expect(
      runtimeFactoryMocks.createTokenBackedInitializedGoogleHandlerBundle
    ).toHaveBeenCalledOnce();
    const googleRuntimeOptions =
      runtimeFactoryMocks.createTokenBackedInitializedGoogleHandlerBundle.mock.calls[0]?.[0];
    expect(googleRuntimeOptions).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      requestDeduplicator: runtimeFactoryMocks.requestDeduplicator,
      extraContext: {
        sessionContext,
        taskStore,
        ...bridge,
      },
    });
    expect(googleRuntimeOptions?.onProgress).toBeTypeOf('function');
    googleRuntimeOptions?.onProgress?.({
      current: 2,
      total: 5,
      message: 'Loading',
    });
    expect(runtimeFactoryMocks.sendProgress).toHaveBeenCalledWith(2, 5, 'Loading');

    expect(runtimeFactoryMocks.buildBillingBootstrapConfig).toHaveBeenCalledWith(envConfig);
    expect(runtimeFactoryMocks.initializeBillingIntegration).toHaveBeenCalledWith({
      billing: true,
    });
    expect(runtimeFactoryMocks.registerServalSheetsTools).toHaveBeenCalledWith(
      mcpServer,
      handlers,
      { googleClient }
    );
    expect(runtimeFactoryMocks.registerServerPrompts).toHaveBeenCalledWith(mcpServer);
    expect(runtimeFactoryMocks.registerServerResources).toHaveBeenCalledWith({
      server: mcpServer,
      googleClient,
      context,
      options: {
        deferKnowledgeResources: false,
        includeTimeTravelResources: false,
        toolsListSyncReason: 'http transport resources initialized',
      },
    });
    expect(runtimeFactoryMocks.registerHttpLoggingSetLevelHandler).toHaveBeenCalledWith({
      server: mcpServer,
      subscriberId: 'session-123',
      subscribers,
      installLoggingBridge,
      createRateLimitState: runtimeFactoryMocks.createMcpLogRateLimitState,
      log: runtimeFactoryMocks.logger,
    });
    expect(runtime).toEqual({
      mcpServer,
      taskStore,
      disposeRuntime: expect.any(Function),
    });

    subscribers.set('session-123', { requestedMcpLogLevel: 'info' } as never);
    runtime.disposeRuntime();

    expect(runtimeFactoryMocks.teardownResourceNotifications).toHaveBeenCalledWith(mcpServer);
    expect(toolDispose).toHaveBeenCalledOnce();
    expect(subscribers.has('session-123')).toBe(false);
    expect(runtimeFactoryMocks.randomUUID).not.toHaveBeenCalled();
  });

  it('builds an unauthenticated HTTP MCP runtime with a generated logging subscriber id', async () => {
    const envConfig = {
      ENABLE_COST_TRACKING: false,
      ENABLE_BILLING_INTEGRATION: false,
    };
    const taskStore = { kind: 'task-store' };
    const mcpServer = { server: { kind: 'raw-server' } };
    const toolDispose = vi.fn();
    const subscribers = new Map();

    runtimeFactoryMocks.randomUUID.mockReturnValue('generated-uuid');
    runtimeFactoryMocks.prepareRuntimePreflight.mockReturnValue({
      envConfig,
      costTrackingEnabled: false,
    });
    runtimeFactoryMocks.createTaskStore.mockResolvedValue(taskStore);
    runtimeFactoryMocks.createServerCapabilities.mockReturnValue({ prompts: {} });
    runtimeFactoryMocks.createBaseMcpServer.mockReturnValue(mcpServer);
    runtimeFactoryMocks.buildBillingBootstrapConfig.mockReturnValue({ billing: false });
    runtimeFactoryMocks.registerServalSheetsTools.mockResolvedValue({ dispose: toolDispose });

    const runtime = await createHttpMcpServerInstance({
      subscribers,
      installLoggingBridge: vi.fn(),
    });

    expect(runtimeFactoryMocks.createTokenBackedInitializedGoogleHandlerBundle).not.toHaveBeenCalled();
    expect(runtimeFactoryMocks.getOrCreateSessionContextAsync).not.toHaveBeenCalled();
    expect(runtimeFactoryMocks.createHandlerRuntimeBridge).not.toHaveBeenCalled();
    expect(runtimeFactoryMocks.registerServalSheetsTools).toHaveBeenCalledWith(mcpServer, null, {
      googleClient: null,
    });
    expect(runtimeFactoryMocks.registerServerResources).toHaveBeenCalledWith({
      server: mcpServer,
      googleClient: null,
      context: null,
      options: {
        deferKnowledgeResources: false,
        includeTimeTravelResources: false,
        toolsListSyncReason: 'http transport resources initialized',
      },
    });
    expect(runtimeFactoryMocks.registerHttpLoggingSetLevelHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriberId: 'http:generated-uuid',
      })
    );

    subscribers.set('http:generated-uuid', { requestedMcpLogLevel: 'error' } as never);
    runtime.disposeRuntime();

    expect(runtimeFactoryMocks.teardownResourceNotifications).toHaveBeenCalledWith(mcpServer);
    expect(toolDispose).toHaveBeenCalledOnce();
    expect(subscribers.has('http:generated-uuid')).toBe(false);
  });
});
