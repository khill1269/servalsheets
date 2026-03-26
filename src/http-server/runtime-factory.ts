import { randomUUID } from 'crypto';
import { getEnv } from '../config/env.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStoreAdapter } from '../core/index.js';
import type { HandlerMcpServer } from '../handlers/index.js';
import { createServerCapabilities, SERVER_INSTRUCTIONS } from '../mcp/features-2025-11-25.js';
import { registerServalSheetsTools } from '../mcp/registration/tool-handlers.js';
import { createTaskAwareSamplingServer } from '../mcp/sampling.js';
import { validateToolCatalogConfiguration } from '../mcp/tool-catalog.js';
import { teardownResourceNotifications } from '../resources/index.js';
import { initializeBillingIntegration } from '../services/billing-integration.js';
import { getCostTracker } from '../services/cost-tracker.js';
import { getOrCreateSessionContextAsync } from '../services/session-context.js';
import { createBaseMcpServer } from '../server/create-base-mcp-server.js';
import { buildBillingBootstrapConfig } from '../server/billing-bootstrap-config.js';
import { createTokenBackedInitializedGoogleHandlerBundle } from '../server/google-handler-bundle.js';
import { createHandlerRuntimeBridge } from '../server/handler-runtime-bridge.js';
import { installInitializeCancellationGuard } from '../server/initialize-cancellation-guard.js';
import { createMcpLogRateLimitState } from '../server/logging-bridge-utils.js';
import { registerServerPrompts, registerServerResources } from '../server/resource-registration.js';
import { prepareRuntimePreflight } from '../server/runtime-preflight.js';
import { logger } from '../utils/logger.js';
import { sendProgress } from '../utils/request-context.js';
import { requestDeduplicator } from '../utils/request-deduplication.js';
import { SERVER_INFO, SERVER_ICONS } from '../version.js';
import {
  createHttpMcpServerInstance as createPackagedHttpMcpServerInstance,
  type HttpMcpServerInstance as PackagedHttpMcpServerInstance,
} from '../../packages/mcp-http/dist/runtime-factory.js';
import {
  registerHttpLoggingSetLevelHandler,
  type HttpLoggingSubscriber,
} from './logging-registration.js';

export interface HttpMcpServerInstance {
  readonly mcpServer: McpServer;
  readonly taskStore: TaskStoreAdapter;
  readonly disposeRuntime: () => void;
}

export interface CreateHttpMcpServerInstanceOptions {
  readonly googleToken?: string;
  readonly googleRefreshToken?: string;
  readonly sessionId?: string;
  readonly subscribers: Map<string, HttpLoggingSubscriber>;
  readonly installLoggingBridge: () => void;
}

export async function createHttpMcpServerInstance(
  options: CreateHttpMcpServerInstanceOptions
): Promise<HttpMcpServerInstance> {
  return (await createPackagedHttpMcpServerInstance({
    ...options,
    prepareRuntimePreflight: () =>
      prepareRuntimePreflight({
        loadEnv: getEnv,
        validateToolCatalogConfiguration,
      }),
    createTaskStore: async () => {
      const { createTaskStore } = await import('../core/task-store-factory.js');
      return await createTaskStore();
    },
    createServerCapabilities,
    createBaseMcpServer,
    serverInfo: {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      icons: SERVER_ICONS,
    },
    instructions: SERVER_INSTRUCTIONS,
    getRawServer: (server) => server.server as HandlerMcpServer,
    installInitializeCancellationGuard,
    getOrCreateSessionContextAsync,
    createHandlerRuntimeBridge,
    createTaskAwareSamplingServer,
    getCostTracker,
    createTokenBackedInitializedGoogleHandlerBundle,
    sendProgress,
    requestDeduplicator,
    buildBillingBootstrapConfig,
    initializeBillingIntegration,
    registerServalSheetsTools,
    registerServerPrompts,
    registerServerResources,
    createRandomUUID: randomUUID,
    registerHttpLoggingSetLevelHandler: (params) =>
      registerHttpLoggingSetLevelHandler({
        server: params.server,
        subscriberId: params.subscriberId,
        subscribers: params.subscribers,
        installLoggingBridge: params.installLoggingBridge,
        createRateLimitState: params.createRateLimitState,
        log: logger,
      }),
    createRateLimitState: createMcpLogRateLimitState,
    teardownResourceNotifications,
    log: logger,
  })) as PackagedHttpMcpServerInstance<McpServer, TaskStoreAdapter>;
}
