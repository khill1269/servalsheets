import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ACTION_COUNT, TOOL_COUNT } from '../schemas/index.js';
import { initTelemetry } from '../observability/otel-setup.js';
import { logger as baseLogger } from '../utils/logger.js';
import { validateEnv } from '../config/env.js';
import { getProcessBreadcrumbs } from './runtime-diagnostics.js';
import type { StartStdioRuntimeOptions } from './start-stdio-runtime.js';
import {
  buildServerStdioShutdownArgs as buildServerStdioShutdownArgsBase,
  buildServerStdioStartOptions as buildServerStdioStartOptionsBase,
} from '#mcp-stdio/build-server-stdio-lifecycle';

interface ShutdownContextLike {
  rangeResolver?: { clearCache(): void };
  backend?: { dispose(): Promise<void> };
  requestMerger?: { destroy(): void };
  scheduler?: { dispose(): void };
}

export function buildServerStdioShutdownArgs(input: {
  isShutdown: boolean;
  setIsShutdown: (value: boolean) => void;
  requestQueue: {
    size: number;
    pending: number;
    onIdle: () => Promise<void>;
    clear: () => void;
  };
  getContext: () => ShutdownContextLike | null;
  getGoogleClient: () => { destroy(): void } | null;
  clearGoogleClient: () => void;
  clearAuthHandler: () => void;
  clearHandlers: () => void;
  clearContext: () => void;
  clearCachedHandlerMap: () => void;
  stopCacheCleanupTask: () => void;
  stopHealthMonitor: () => Promise<void>;
  cleanupAllResources: () => Promise<{
    total: number;
    successful: number;
    failed: number;
    errors?: unknown;
  }>;
  getBatchingSystem: () => Promise<{ destroy(): void } | null | undefined>;
  getPrefetchingSystem: () => Promise<{ destroy(): void } | null | undefined>;
  disposeConnectorManager: () => Promise<void>;
  taskStore: { dispose(): void };
  disposeTemporaryResourceStore: () => void;
  teardownResourceNotifications: () => void;
  log?: typeof baseLogger;
}): ReturnType<typeof buildServerStdioShutdownArgsBase> {
  return buildServerStdioShutdownArgsBase({
    ...input,
    log: input.log ?? baseLogger,
  });
}

export function buildServerStdioStartOptions(input: {
  verifyToolIntegrity: () => Promise<void>;
  initialize: () => Promise<void>;
  shutdown: () => Promise<void>;
  getResourcesRegistered: () => boolean;
  getResourceRegistrationFailed: () => boolean;
  ensureResourcesRegistered: () => Promise<void>;
  isShutdown: () => boolean;
  server: McpServer;
  log?: typeof baseLogger;
}): StartStdioRuntimeOptions<McpServer> {
  return buildServerStdioStartOptionsBase({
    initTelemetry,
    validateEnv,
    verifyToolIntegrity: input.verifyToolIntegrity,
    initialize: input.initialize,
    shutdown: input.shutdown,
    getProcessBreadcrumbs: () =>
      getProcessBreadcrumbs({
        resourcesRegistered: input.getResourcesRegistered(),
        resourceRegistrationFailed: input.getResourceRegistrationFailed(),
      }),
    server: input.server,
    ensureResourcesRegistered: input.ensureResourcesRegistered,
    isShutdown: input.isShutdown,
    toolCount: TOOL_COUNT,
    actionCount: ACTION_COUNT,
    log: input.log ?? baseLogger,
  });
}
