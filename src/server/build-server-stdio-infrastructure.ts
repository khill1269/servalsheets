import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TaskStoreAdapter } from '../core/index.js';
import { createServerCapabilities, SERVER_INSTRUCTIONS } from '../mcp/features-2025-11-25.js';
import { SERVER_ICONS } from '../version.js';
import { logger as baseLogger } from '../utils/logger.js';
import {
  createHealthMonitor,
  createHeapHealthCheck,
  createConnectionHealthCheck,
  type HealthMonitor,
} from './index.js';
import { createBaseMcpServer } from './create-base-mcp-server.js';
import { installInitializeCancellationGuard } from './initialize-cancellation-guard.js';
import {
  buildServerStdioInfrastructure as buildServerStdioInfrastructureBase,
  type ServerStdioInfrastructure as PackageServerStdioInfrastructure,
} from '#mcp-stdio/build-server-stdio-infrastructure';

interface BuildServerStdioInfrastructureOptions {
  name?: string;
  version?: string;
  taskStore?: TaskStoreAdapter;
}

export type ServerStdioInfrastructure = PackageServerStdioInfrastructure<
  McpServer,
  TaskStoreAdapter,
  ReturnType<typeof createConnectionHealthCheck>,
  HealthMonitor
>;

export function buildServerStdioInfrastructure(input: {
  options: BuildServerStdioInfrastructureOptions;
  packageVersion: string;
  log?: typeof baseLogger;
}): ServerStdioInfrastructure {
  const { options, packageVersion, log = baseLogger } = input;

  return buildServerStdioInfrastructureBase({
    options,
    packageVersion,
    createTaskStore: () => new TaskStoreAdapter(),
    createServer: ({ name, version, taskStore }) =>
      createBaseMcpServer({
        serverInfo: {
          name,
          version,
          icons: SERVER_ICONS,
          description:
            'Production-grade Google Sheets MCP server with AI-powered analysis, transactions, workflows, and enterprise features',
        },
        capabilities: createServerCapabilities(),
        instructions: SERVER_INSTRUCTIONS,
        taskStore,
      }),
    afterServerCreated: (server) => {
      installInitializeCancellationGuard(server, {
        onIgnoredCancellation: (requestId) => {
          log.warn('Ignoring cancellation for initialize request', { requestId });
        },
      });
    },
    maxConcurrentRequests: parseInt(process.env['MAX_CONCURRENT_REQUESTS'] ?? '10', 10),
    createConnectionHealthCheck,
    disconnectThresholdMs: Number.parseInt(
      process.env['MCP_DISCONNECT_THRESHOLD_MS'] || '120000',
      10
    ),
    warnThresholdMs: Number.parseInt(process.env['MCP_WARN_THRESHOLD_MS'] || '60000', 10),
    createHeapHealthCheck,
    heapWarningThreshold: 0.7,
    heapCriticalThreshold: 0.85,
    enableHeapSnapshots: process.env['ENABLE_HEAP_SNAPSHOTS'] === 'true',
    heapSnapshotPath: process.env['HEAP_SNAPSHOT_PATH'] || './heap-snapshots',
    createHealthMonitor,
    healthMonitorAutoStart: false,
    log,
  });
}
