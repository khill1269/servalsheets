import { randomUUID } from 'crypto';
import { getEnv } from '../config/env.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TaskStoreAdapter } from '../core/index.js';
import type { HandlerContext, HandlerMcpServer } from '../handlers/index.js';
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
  const { googleToken, googleRefreshToken, sessionId, subscribers, installLoggingBridge } =
    options;

  const { envConfig, costTrackingEnabled } = prepareRuntimePreflight({
    loadEnv: getEnv,
    validateToolCatalogConfiguration,
  });

  const { createTaskStore } = await import('../core/task-store-factory.js');
  const taskStore = await createTaskStore();

  const mcpServer = createBaseMcpServer({
    serverInfo: {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      icons: SERVER_ICONS,
    },
    capabilities: createServerCapabilities(),
    instructions: SERVER_INSTRUCTIONS,
    taskStore,
  });
  installInitializeCancellationGuard(mcpServer, {
    onIgnoredCancellation: (requestId) => {
      logger.warn('Ignoring cancellation for initialize request', {
        requestId,
        transport: 'http',
      });
    },
  });

  let handlers = null;
  let googleClient = null;
  let context: HandlerContext | null = null;

  if (googleToken) {
    const googleRuntime = await createTokenBackedInitializedGoogleHandlerBundle({
      accessToken: googleToken,
      refreshToken: googleRefreshToken,
      onProgress: (event) => {
        void sendProgress(event.current, event.total, event.message);
      },
      requestDeduplicator,
      extraContext: {
        ...(sessionId ? { sessionContext: await getOrCreateSessionContextAsync(sessionId) } : {}),
        taskStore,
        ...createHandlerRuntimeBridge({
          server: mcpServer.server as HandlerMcpServer,
          createSamplingServer: createTaskAwareSamplingServer,
          costTrackingEnabled,
          getCostTracker,
        }),
      },
    });
    googleClient = googleRuntime.googleClient;
    context = googleRuntime.context;
    handlers = googleRuntime.handlers;
  }

  initializeBillingIntegration(buildBillingBootstrapConfig(envConfig));

  const toolRegistration = await registerServalSheetsTools(mcpServer, handlers, { googleClient });
  registerServerPrompts(mcpServer);
  await registerServerResources({
    server: mcpServer,
    googleClient,
    context,
    options: {
      deferKnowledgeResources: false,
      includeTimeTravelResources: false,
      toolsListSyncReason: 'http transport resources initialized',
    },
  });

  const loggingSubscriberId = sessionId ?? `http:${randomUUID()}`;
  registerHttpLoggingSetLevelHandler({
    server: mcpServer,
    subscriberId: loggingSubscriberId,
    subscribers,
    installLoggingBridge,
    createRateLimitState: createMcpLogRateLimitState,
    log: logger,
  });

  return {
    mcpServer,
    taskStore,
    disposeRuntime: () => {
      teardownResourceNotifications(mcpServer);
      subscribers.delete(loggingSubscriberId);
      toolRegistration.dispose();
    },
  };
}
