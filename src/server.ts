/**
 * ServalSheets - MCP Server
 *
 * Main server class that registers all tools and resources
 * MCP Protocol: 2025-11-25
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult, LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type {
  ToolTaskHandler,
  TaskToolExecution,
} from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { TOOL_COUNT, ACTION_COUNT } from './schemas/index.js';
import { SERVER_ICONS } from './version.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as {
  version: string;
};
const PACKAGE_VERSION = packageJson.version;
import PQueue from 'p-queue';
import {
  createServerCapabilities,
  SERVER_INSTRUCTIONS,
  TOOL_ICONS,
  TOOL_EXECUTION_CONFIG,
} from './mcp/features-2025-11-25.js';
import {
  recordToolCall,
  updateQueueMetrics,
  quotaWarningsTotal,
  recordSelfCorrection,
} from './observability/metrics.js';

import {
  BatchCompiler,
  RateLimiter,
  DiffEngine,
  PolicyEnforcer,
  RangeResolver,
  TaskStoreAdapter,
} from './core/index.js';

import { SnapshotService, GoogleApiClient, createGoogleApiClient } from './services/index.js';
import type { GoogleApiClientOptions } from './services/google-api.js';
// Removed: initWorkflowEngine (Claude orchestrates natively via MCP)
// Removed: initPlanningAgent, initInsightsService (replaced by MCP-native Elicitation/Sampling)
import { initTransactionManager } from './services/transaction-manager.js';
import { initConflictDetector } from './services/conflict-detector.js';
import { initImpactAnalyzer } from './services/impact-analyzer.js';
import { initValidationEngine } from './services/validation-engine.js';
import { initWebhookManager } from './services/webhook-manager.js';
import { initWebhookQueue } from './services/webhook-queue.js';
import { DuckDBEngine } from './services/duckdb-engine.js';
import { SchedulerService } from './services/scheduler.js';
import { createHandlers, type HandlerContext, type Handlers } from './handlers/index.js';
import { getCostTracker } from './services/cost-tracker.js';
import { initializeBillingIntegration } from './services/billing-integration.js';
import { GoogleSheetsBackend } from './adapters/index.js';
import { AuthHandler } from './handlers/auth.js';
import { handleLoggingSetLevel } from './handlers/logging.js';
import {
  checkAuth,
  buildAuthErrorResponse,
  isGoogleAuthError,
  convertGoogleAuthError,
} from './utils/auth-guard.js';
import { logger as baseLogger } from './utils/logger.js';
import {
  createRequestContext,
  runWithRequestContext,
  sendProgress,
} from './utils/request-context.js';
import { verifyJsonSchema } from './utils/schema-compat.js';
import { extractIdempotencyKeyFromHeaders } from './utils/idempotency-key-generator.js';
import { TOOL_DEFINITIONS, isToolCallAuthExempt } from './mcp/registration/tool-definitions.js';
import { createToolHandlerMap, buildToolResponse } from './mcp/registration/tool-handlers.js';
import { registerServalSheetsResources } from './mcp/registration/resource-registration.js';
import { registerServalSheetsPrompts } from './mcp/registration/prompt-registration.js';
import { prepareSchemaForRegistrationCached } from './mcp/registration/schema-helpers.js';
import { registerToolsListCompatibilityHandler } from './mcp/registration/tools-list-compat.js';
import { recordSpreadsheetId } from './mcp/completions.js';
import {
  registerKnowledgeResources,
  registerDeferredKnowledgeResources,
  registerHistoryResources,
  registerCacheResources,
  registerTransactionResources,
  registerConflictResources,
  registerImpactResources,
  registerValidationResources,
  registerMetricsResources,
  registerConfirmResources,
  registerAnalyzeResources,
  registerReferenceResources,
  registerGuideResources,
  registerDecisionResources,
  registerExamplesResources,
  registerPatternResources,
  registerSheetResources,
  registerSchemaResources,
  registerDiscoveryResources,
  registerMasterIndexResource,
  registerKnowledgeIndexResource,
  registerKnowledgeSearchResource,
  initializeResourceNotifications,
  resourceNotifications,
  registerConnectionHealthResource,
  registerRestartHealthResource,
  registerCostDashboardResources,
  registerTimeTravelResources,
} from './resources/index.js';
import { cacheManager } from './utils/cache-manager.js';
import { requestDeduplicator } from './utils/request-deduplication.js';
import {
  createHealthMonitor,
  createHeapHealthCheck,
  createConnectionHealthCheck,
  type HealthMonitor,
} from './server/index.js';
import { parseWithCache } from './utils/schema-cache.js';
import { startKeepalive } from './utils/keepalive.js';
import { cleanupAllResources } from './utils/resource-cleanup.js';
import { disposeTemporaryResourceStore } from './resources/temporary-storage.js';
import { startHeapWatchdog } from './utils/heap-watchdog.js';
import { DEFER_SCHEMAS, STAGED_REGISTRATION } from './config/constants.js';
import { toolStageManager } from './mcp/registration/tool-stage-manager.js';
import { getEnv } from './config/env.js';
import { resolveCostTrackingTenantId } from './utils/tenant-identification.js';
import { warnIfDefaultCredentialsInHttpMode } from './config/embedded-oauth.js';
import { registerSamplingConsentChecker } from './mcp/sampling.js';
import { initializeBuiltinConnectors, connectorManager } from './connectors/connector-manager.js';

const MCP_LOG_SEVERITY: Record<LoggingLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

const WINSTON_TO_MCP_LOG_LEVEL: Record<string, LoggingLevel> = {
  error: 'error',
  warn: 'warning',
  info: 'info',
  http: 'info',
  verbose: 'debug',
  debug: 'debug',
  silly: 'debug',
};

function normalizeMcpLogLevel(winstonLevel: string): LoggingLevel {
  return WINSTON_TO_MCP_LOG_LEVEL[winstonLevel] ?? 'info';
}

function shouldForwardMcpLog(winstonLevel: string, requestedLevel: LoggingLevel): boolean {
  const messageLevel = normalizeMcpLogLevel(winstonLevel);
  return MCP_LOG_SEVERITY[messageLevel] <= MCP_LOG_SEVERITY[requestedLevel];
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Extract action from args, checking up to 3 levels deep for nested request objects
 * Fixes: 13% of calls showing as "unknown" due to shallow extraction
 */
function extractActionFromArgs(args: unknown): string {
  if (typeof args !== 'object' || args === null) {
    return 'unknown';
  }

  const record = args as Record<string, unknown>;

  // Check top-level action field
  if (typeof record['action'] === 'string' && record['action']) {
    return record['action'];
  }

  // Check nested request objects (up to 3 levels)
  let current: unknown = record['request'];
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current === 'object' && current !== null) {
      const nested = current as Record<string, unknown>;
      if (typeof nested['action'] === 'string' && nested['action']) {
        return nested['action'];
      }
      current = nested['request'];
    }
  }

  return 'unknown';
}

function getSingleHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  headerName: string
): string | undefined {
  const raw = headers[headerName];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

function extractPrincipalIdFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const candidateHeaders = ['x-user-id', 'x-session-id', 'x-client-id'] as const;
  for (const header of candidateHeaders) {
    const value = getSingleHeaderValue(headers, header)?.trim();
    if (value) {
      return value;
    }
  }
  return undefined; // OK: no principal header found — caller treats undefined as anonymous
}

const SELF_CORRECTION_WINDOW_MS = 5 * 60 * 1000;
const recentToolFailures = new Map<string, { action: string; timestampMs: number }>();

function buildSelfCorrectionKey(principalId: string, toolName: string): string {
  return `${principalId}:${toolName}`;
}

function pruneOldSelfCorrectionFailures(nowMs: number): void {
  for (const [key, value] of recentToolFailures.entries()) {
    if (nowMs - value.timestampMs > SELF_CORRECTION_WINDOW_MS) {
      recentToolFailures.delete(key);
    }
  }
}

export interface ServalSheetsServerOptions {
  name?: string;
  version?: string;
  googleApiOptions?: GoogleApiClientOptions;
  taskStore?: TaskStoreAdapter;
}

/**
 * ServalSheets MCP Server
 */
export class ServalSheetsServer {
  private _server: McpServer;
  private googleClient: GoogleApiClient | null = null;
  private authHandler: AuthHandler | null = null;
  private options: ServalSheetsServerOptions;
  private isShutdown = false;
  private handlers: Handlers | null = null;
  private context: HandlerContext | null = null;
  private requestQueue: PQueue;
  private taskStore: TaskStoreAdapter;
  private taskAbortControllers = new Map<string, AbortController>();
  private taskWatchdogTimers = new Map<string, NodeJS.Timeout>();
  private healthMonitor: HealthMonitor;
  private connectionHealthCheck: ReturnType<typeof createConnectionHealthCheck>;
  private requestedMcpLogLevel: LoggingLevel | null = null;
  private loggingBridgeInstalled = false;
  private forwardingMcpLog = false;

  // Cached handler map (rebuilt only when handlers change)
  private cachedHandlerMap: Record<
    string,
    (args: unknown, extra?: unknown) => Promise<unknown>
  > | null = null;

  // Resource lazy loading state
  private resourcesRegistered = false;
  private resourceRegistrationPromise: Promise<void> | null = null;

  constructor(options: ServalSheetsServerOptions = {}) {
    this.options = options;

    // Initialize task store for MCP 2025-11-25 Tasks support
    // Use provided taskStore or create default with InMemoryTaskStore
    this.taskStore = options.taskStore ?? new TaskStoreAdapter();

    // Create McpServer with MCP 2025-11-25 capabilities
    this._server = new McpServer(
      {
        name: options.name ?? 'servalsheets',
        version: options.version ?? PACKAGE_VERSION,
        icons: SERVER_ICONS,
        description:
          'Production-grade Google Sheets MCP server with AI-powered analysis, transactions, workflows, and enterprise features',
      },
      {
        // Server capabilities (logging, tasks, etc. - tools/prompts/resources auto-registered)
        capabilities: createServerCapabilities(),
        // Instructions for LLM context
        instructions: SERVER_INSTRUCTIONS,
        // Task support (MCP 2025-11-25) for tasks/get/list/result/cancel and task-capable tools
        taskStore: this.taskStore,
      }
    );

    // Initialize request queue with concurrency limit
    const maxConcurrent = parseInt(process.env['MAX_CONCURRENT_REQUESTS'] ?? '10', 10);
    this.requestQueue = new PQueue({
      concurrency: maxConcurrent,
    });

    baseLogger.info('Request queue initialized', { maxConcurrent });

    // Initialize health monitoring with heap and connection checks
    this.connectionHealthCheck = createConnectionHealthCheck({
      disconnectThresholdMs: Number.parseInt(
        process.env['MCP_DISCONNECT_THRESHOLD_MS'] || '120000',
        10
      ),
      warnThresholdMs: Number.parseInt(process.env['MCP_WARN_THRESHOLD_MS'] || '60000', 10),
    });

    this.healthMonitor = createHealthMonitor({
      checks: [
        createHeapHealthCheck({
          warningThreshold: 0.7,
          criticalThreshold: 0.85,
          enableSnapshots: process.env['ENABLE_HEAP_SNAPSHOTS'] === 'true',
          snapshotPath: process.env['HEAP_SNAPSHOT_PATH'] || './heap-snapshots',
        }),
        this.connectionHealthCheck,
      ],
      autoStart: false, // Manual start in initialize()
    });
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    const envConfig = getEnv();
    const costTrackingEnabled =
      envConfig.ENABLE_COST_TRACKING || envConfig.ENABLE_BILLING_INTEGRATION;

    // Always create AuthHandler (it works even without googleClient)
    this.authHandler = new AuthHandler({
      googleClient: null, // Will be set after googleClient is created
    });

    // Initialize Google API client
    if (this.options.googleApiOptions) {
      this.googleClient = await createGoogleApiClient(this.options.googleApiOptions);

      // Update AuthHandler with the initialized googleClient
      this.authHandler = new AuthHandler({
        googleClient: this.googleClient,
      });

      // Create SnapshotService for undo/revert operations
      const snapshotService = new SnapshotService({ driveApi: this.googleClient.drive });

      // Initialize all performance optimizations (batching, caching, merging, prefetching)
      const { initializePerformanceOptimizations } = await import('./startup/performance-init.js');
      const {
        batchingSystem,
        cachedSheetsApi,
        requestMerger,
        parallelExecutor,
        prefetchPredictor,
        accessPatternTracker,
        queryOptimizer,
        prefetchingSystem,
      } = await initializePerformanceOptimizations(this.googleClient.sheets);

      // Create reusable context and handlers
      // Local ref for closure capture in getter below
      const _googleClient = this.googleClient;
      const duckdbEngine = new DuckDBEngine();
      const scheduler = new SchedulerService(
        process.env['DATA_DIR'] ?? '/tmp/servalsheets',
        async (job) => {
          const result = await this.handleToolCall(job.action.tool, {
            request: {
              action: job.action.actionName,
              ...job.action.params,
            },
          });

          const isError = (result as { isError?: boolean }).isError === true;
          if (isError) {
            throw new Error(`Scheduled job ${job.id} failed for ${job.action.tool}`);
          }
        }
      );

      // Create platform-agnostic backend adapter (wraps GoogleApiClient)
      const backend = new GoogleSheetsBackend(_googleClient);
      await backend.initialize();

      this.context = {
        backend, // Platform-agnostic SpreadsheetBackend from @serval/core
        batchCompiler: new BatchCompiler({
          rateLimiter: new RateLimiter(),
          diffEngine: new DiffEngine({ sheetsApi: this.googleClient.sheets }),
          policyEnforcer: new PolicyEnforcer(),
          snapshotService,
          sheetsApi: this.googleClient.sheets,
          onProgress: (event) => {
            // Send MCP progress notification
            void sendProgress(event.current, event.total, event.message);
          },
        }),
        rangeResolver: new RangeResolver({ sheetsApi: this.googleClient.sheets }),
        googleClient: this.googleClient, // For authentication checks in handlers
        batchingSystem, // Time-window batching system for reducing API calls
        cachedSheetsApi, // ETag-based caching for reads (30-50% API savings)
        requestMerger, // Phase 2: Merge overlapping read requests (20-40% API savings)
        parallelExecutor, // Phase 2: Parallel batch execution (40% faster batch ops)
        prefetchPredictor, // Phase 3: Predictive prefetching (200-500ms latency reduction)
        accessPatternTracker, // Phase 3: Access pattern learning for smarter predictions
        queryOptimizer, // Phase 3B: Adaptive query optimization (-25% avg latency)
        prefetchingSystem, // Pattern-based prefetching (80% latency reduction on sequential ops)
        snapshotService, // Pass to context for HistoryHandler undo/revert (Task 1.3)
        duckdbEngine, // Advanced SQL compute engine (Phase 1)
        scheduler, // Scheduled workflows (Phase 6)
        ...(costTrackingEnabled ? { costTracker: getCostTracker() } : {}),
        auth: {
          // Use getter to always read live value from GoogleApiClient
          // This ensures re-auth with broader scopes takes effect immediately
          get hasElevatedAccess() {
            return _googleClient.hasElevatedAccess;
          },
          // Use getter to always read live scopes from GoogleApiClient
          // This ensures re-auth with broader scopes takes effect immediately
          get scopes() {
            return _googleClient.scopes;
          },
        },
        samplingServer: this._server.server, // Pass underlying Server instance for sampling
        server: this._server.server, // Pass Server instance for elicitation/sampling (SEP-1036, SEP-1577)
        requestDeduplicator, // Pass request deduplicator for preventing duplicate API calls
        taskStore: this.taskStore, // For task-based execution (SEP-1686)
      };

      // QUOTA-01: Subscribe to CostTracker alerts and emit Prometheus metric at 80% quota
      this.context.costTracker?.on('alert', (alert: { type: string; tenantId: string }) => {
        if (alert.type === 'limit_approaching') {
          quotaWarningsTotal.inc({ tenantId: alert.tenantId });
          baseLogger.warn('API quota approaching monthly limit', { tenantId: alert.tenantId });
        }
      });

      const handlers = createHandlers({
        context: this.context,
        sheetsApi: this.googleClient.sheets,
        driveApi: this.googleClient.drive,
        bigqueryApi: this.googleClient.bigquery ?? undefined,
      });
      this.handlers = handlers;
      this.cachedHandlerMap = null; // Invalidate cached handler map

      if (envConfig.ENABLE_PYTHON_COMPUTE) {
        void import('./services/python-engine.js')
          .then(({ preloadPyodide }) => {
            preloadPyodide();
          })
          .catch((error) => {
            baseLogger.warn('Pyodide preload skipped due to initialization error', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }

      // Removed: initWorkflowEngine (Claude orchestrates natively via MCP)
      // Removed: initPlanningAgent, initInsightsService (replaced by MCP-native Elicitation/Sampling)

      // Initialize Phase 4 advanced features
      initTransactionManager(this.googleClient); // Phase 4, Task 4.1
      initConflictDetector(this.googleClient); // Phase 4, Task 4.2
      initImpactAnalyzer(this.googleClient); // Phase 4, Task 4.3
      initValidationEngine(this.googleClient); // Phase 4, Task 4.4

      // Initialize webhook infrastructure (BUG FIX 0.8)
      // Note: Redis is optional - webhooks will fail gracefully without it
      const webhookEndpoint = process.env['WEBHOOK_ENDPOINT'] || 'https://localhost:3000/webhook';
      initWebhookQueue(null); // No Redis by default - would need to add Redis client
      initWebhookManager(null, this.googleClient, webhookEndpoint);
    }

    // Register built-in data connectors once at startup so sheets_connectors has
    // a non-empty catalog without any manual bootstrap calls.
    initializeBuiltinConnectors();

    initializeBillingIntegration({
      enabled: envConfig.ENABLE_BILLING_INTEGRATION,
      stripeSecretKey: envConfig.STRIPE_SECRET_KEY,
      webhookSecret: envConfig.STRIPE_WEBHOOK_SECRET,
      currency: envConfig.BILLING_CURRENCY,
      billingCycle: envConfig.BILLING_CYCLE,
      autoInvoicing: envConfig.BILLING_AUTO_INVOICING,
    });

    // Register all tools
    this.registerTools();

    // Register completions
    // Supported since SDK v1.26.0: resource template completions are auto-registered by the
    // SDK when ResourceTemplate instances include 'complete' callbacks (see resource-registration.ts).
    // This call ensures completion capability is advertised and logs registration status.
    this.registerCompletions();

    // Register resources (async to support non-blocking knowledge discovery)
    // Can be deferred to first access with DEFER_RESOURCE_DISCOVERY=true (saves 300-500ms)
    const { shouldDeferResourceDiscovery } = await import('./config/env.js');
    if (shouldDeferResourceDiscovery()) {
      baseLogger.info('Resource discovery deferred - resources will load on first access');
    } else {
      await this.registerResources();
      this.resourcesRegistered = true;
    }

    // Register prompts
    this.registerPrompts();

    // Register task cancellation handler (SEP-1686)
    this.registerTaskCancelHandler();

    // Register logging handler for dynamic log level control
    this.registerLogging();

    // Start cache cleanup task
    cacheManager.startCleanupTask();

    // Start reactive heap watchdog (5s interval, disables analysis at 80%, rejects at 90%)
    startHeapWatchdog();

    // Start health monitoring (heap usage, connection tracking)
    await this.healthMonitor.start();
    baseLogger.info('Health monitoring started');
  }

  /**
   * Register a set of tool definitions with the MCP server.
   * Extracted to support both initial registration and stage-based advancement.
   */
  private registerToolSet(tools: readonly (typeof TOOL_DEFINITIONS)[number][]): void {
    for (const tool of tools) {
      // Prepare schemas for SDK registration with caching (P0-2 optimization)
      // Caching saves 8-40ms at startup by avoiding redundant schema transformations
      const inputSchemaForRegistration = prepareSchemaForRegistrationCached(
        tool.name,
        tool.inputSchema,
        'input'
      ) as unknown as AnySchema;
      const outputSchemaForRegistration = prepareSchemaForRegistrationCached(
        tool.name,
        tool.outputSchema,
        'output'
      ) as unknown as AnySchema;

      // SAFETY CHECK: Verify schemas are properly transformed JSON Schema objects (not Zod objects)
      // This prevents "v3Schema.safeParseAsync is not a function" errors
      // Only run in development to avoid performance overhead in production
      if (process.env['NODE_ENV'] !== 'production') {
        const isZodSchema = (schema: unknown): boolean =>
          Boolean(
            schema && typeof schema === 'object' && '_def' in (schema as Record<string, unknown>)
          );

        if (!isZodSchema(inputSchemaForRegistration)) {
          verifyJsonSchema(inputSchemaForRegistration);
        }
        if (!isZodSchema(outputSchemaForRegistration)) {
          verifyJsonSchema(outputSchemaForRegistration);
        }
      }

      // Get icons and execution config for this tool
      const toolIcons = TOOL_ICONS[tool.name];
      const toolExecution = TOOL_EXECUTION_CONFIG[tool.name];
      const supportsTasks = toolExecution?.taskSupport && toolExecution.taskSupport !== 'forbidden';

      // Task support enabled (SEP-1686)
      if (supportsTasks) {
        const taskHandler = this.createToolTaskHandler(tool.name);
        const taskSupport = toolExecution?.taskSupport === 'required' ? 'required' : 'optional';
        const taskExecution = {
          ...(toolExecution ?? {}),
          taskSupport,
        } as TaskToolExecution;

        this._server.experimental.tasks.registerToolTask<AnySchema, AnySchema>(
          tool.name,
          {
            title: tool.annotations.title,
            description: tool.description,
            // FIX: Use prepared schemas (deferred/optimized) instead of full Zod schemas
            inputSchema: inputSchemaForRegistration,
            outputSchema: outputSchemaForRegistration,
            annotations: tool.annotations,
            execution: taskExecution,
          },
          taskHandler
        );
        continue;
      }

      // Register tool with transformed schemas
      // Note: Using type assertion to avoid TypeScript's "excessively deep type instantiation" error
      // See registration.ts for detailed explanation
      (
        this._server.registerTool as (
          name: string,
          config: {
            title?: string;
            description?: string;
            inputSchema?: unknown;
            outputSchema?: unknown;
            annotations?: import('@modelcontextprotocol/sdk/types.js').ToolAnnotations;
            icons?: import('@modelcontextprotocol/sdk/types.js').Icon[];
            execution?: import('@modelcontextprotocol/sdk/types.js').ToolExecution;
          },
          cb: (
            args: Record<string, unknown>,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extra: any // Use 'any' to accept full RequestHandlerExtra from SDK with all fields
          ) => Promise<CallToolResult>
        ) => void
      )(
        tool.name,
        {
          title: tool.annotations.title,
          description: tool.description,
          inputSchema: inputSchemaForRegistration,
          outputSchema: outputSchemaForRegistration,
          annotations: tool.annotations,
          // SEP-973: Tool icons for UI
          icons: toolIcons,
          // SEP-1686: Task support for long-running operations
          execution: toolExecution,
        },
        async (args: Record<string, unknown>, extra) => {
          // Extract progress token from request metadata
          const progressToken =
            extra.requestInfo?._meta?.progressToken ?? extra._meta?.progressToken;
          // Forward complete MCP context (Task 1.1)
          return this.handleToolCall(tool.name, args, {
            ...extra, // Forward all fields: signal, requestId, sendRequest, sendNotification, etc.
            sendNotification: extra.sendNotification as (
              n: import('@modelcontextprotocol/sdk/types.js').ServerNotification
            ) => Promise<void>,
            progressToken,
            abortSignal: extra.signal, // Make signal available as abortSignal for clarity
          });
        }
      );
    }
  }

  /**
   * Register tools with stage-based loading support.
   *
   * When SERVAL_STAGED_REGISTRATION=true:
   * - Stage 1 tools are registered immediately (auth, core, session, analyze, confirm)
   * - Stage 2 tools (data, format, dimensions, etc.) are registered after spreadsheet active
   * - Stage 3 tools (remaining) are registered on demand
   * - Each stage transition emits notifications/tools/list_changed
   *
   * When disabled (default): all tools are registered at once (backwards-compatible).
   */
  private registerTools(): void {
    // Initialize stage manager with all definitions and registration callback
    toolStageManager.initialize(TOOL_DEFINITIONS, (newTools) => this.registerToolSet(newTools));

    // Register initial tools (all tools if staging disabled, Stage 1 if enabled)
    const initialTools = toolStageManager.getInitialTools();
    this.registerToolSet(initialTools);
    toolStageManager.markRegistered(initialTools.map((t) => t.name));

    if (STAGED_REGISTRATION) {
      baseLogger.info('Staged tool registration enabled', {
        stage: 1,
        initialTools: initialTools.length,
        totalAvailable: TOOL_DEFINITIONS.length,
      });
    }

    // Override tools/list to safely serialize schemas with transforms/pipes.
    registerToolsListCompatibilityHandler(this._server);

    if (getEnv().ENABLE_TOOLS_LIST_CHANGED_NOTIFICATIONS) {
      resourceNotifications.syncToolList(
        initialTools.map((tool) => tool.name),
        {
          emitOnFirstSet: false,
          reason: 'tool registration updated',
        }
      );
    }
  }

  private createToolTaskHandler(toolName: string): ToolTaskHandler<AnySchema> {
    return {
      createTask: async (args, extra) => {
        if (!extra.taskStore) {
          throw new Error(`[${toolName}] Task store not configured`);
        }

        const task = await extra.taskStore.createTask({
          ttl: extra.taskRequestedTtl ?? undefined,
        });

        // Create AbortController for this task
        const abortController = new AbortController();
        this.taskAbortControllers.set(task.taskId, abortController);

        // Watchdog timer: force-abort tasks that exceed configured max runtime
        const TASK_WATCHDOG_MS = getEnv().TASK_WATCHDOG_MS;
        const watchdogTimer = setTimeout(() => {
          if (this.taskAbortControllers.has(task.taskId)) {
            baseLogger.warn('Task watchdog: aborting hung task', {
              taskId: task.taskId,
              toolName,
              maxLifetimeMs: TASK_WATCHDOG_MS,
            });
            abortController.abort(
              `Task exceeded maximum runtime of ${(TASK_WATCHDOG_MS / 60000).toFixed(1)} minutes`
            );
            this.taskAbortControllers.delete(task.taskId);
            this.taskWatchdogTimers.delete(task.taskId);
          }
        }, TASK_WATCHDOG_MS);
        this.taskWatchdogTimers.set(task.taskId, watchdogTimer);

        // Use this.taskStore for cancellation methods (not extra.taskStore)
        void (async () => {
          try {
            // Check if already cancelled
            if (await this.taskStore.isTaskCancelled(task.taskId)) {
              const reason = await this.taskStore.getCancellationReason(task.taskId);
              const cancelResult = buildToolResponse({
                response: {
                  success: false,
                  error: {
                    code: 'TASK_CANCELLED',
                    message: reason || 'Task was cancelled',
                    retryable: false,
                  },
                },
              });
              // C11: SDK storeTaskResult only accepts 'completed'|'failed'; use 'failed' for
              // cancelled tasks (cancelResult.content carries code:'TASK_CANCELLED' for callers)
              await this.taskStore.storeTaskResult(task.taskId, 'failed', cancelResult);
              return;
            }

            // Execute with abort signal
            const result = await this.handleToolCall(toolName, args as Record<string, unknown>, {
              ...extra,
              abortSignal: abortController.signal,
            });

            // Check cancellation again before storing result
            if (await this.taskStore.isTaskCancelled(task.taskId)) {
              return; // Already marked as cancelled
            }

            await extra.taskStore.storeTaskResult(task.taskId, 'completed', result);
          } catch (error) {
            // Check if error is due to cancellation
            if (error instanceof Error && error.name === 'AbortError') {
              const cancelResult = buildToolResponse({
                response: {
                  success: false,
                  error: {
                    code: 'TASK_CANCELLED',
                    message: error.message,
                    retryable: false,
                  },
                },
              });
              try {
                // C11: SDK storeTaskResult only accepts 'completed'|'failed'; use 'failed' for
                // cancelled tasks (cancelResult.content carries code:'TASK_CANCELLED' for callers)
                await this.taskStore.storeTaskResult(task.taskId, 'failed', cancelResult);
              } catch (storeError) {
                baseLogger.error('Failed to store cancelled task result', { toolName, storeError });
              }
            } else {
              const errorResult = buildToolResponse({
                response: {
                  success: false,
                  error: {
                    code: 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : String(error),
                    retryable: false,
                  },
                },
              });
              try {
                await extra.taskStore.storeTaskResult(task.taskId, 'failed', errorResult);
              } catch (storeError) {
                baseLogger.error('Failed to store task result', { toolName, storeError });
              }
            }
          } finally {
            // Cleanup abort controller and watchdog timer
            this.taskAbortControllers.delete(task.taskId);
            clearTimeout(this.taskWatchdogTimers.get(task.taskId));
            this.taskWatchdogTimers.delete(task.taskId);
          }
        })();

        return { task };
      },
      getTask: async (_args, extra) => {
        if (!extra.taskStore) {
          throw new Error(`[${toolName}] Task store not configured`);
        }
        return await extra.taskStore.getTask(extra.taskId);
      },
      getTaskResult: async (_args, extra) => {
        if (!extra.taskStore) {
          throw new Error(`[${toolName}] Task store not configured`);
        }
        return (await extra.taskStore.getTaskResult(extra.taskId)) as CallToolResult;
      },
    };
  }

  /**
   * Cancel a running task
   *
   * Marks the task as cancelled in the task store and aborts the operation
   * if it's currently running.
   *
   * @param taskId - Task identifier
   * @param taskStore - Task store instance
   */
  private async handleTaskCancel(taskId: string, taskStore: TaskStoreAdapter): Promise<void> {
    try {
      // Mark task as cancelled in store
      await taskStore.cancelTask(taskId, 'Cancelled by client request');

      // Abort the operation if it's running
      const abortController = this.taskAbortControllers.get(taskId);
      if (abortController) {
        abortController.abort('Task cancelled by client');
        this.taskAbortControllers.delete(taskId);
      }

      // Clear watchdog timer for cancelled task
      clearTimeout(this.taskWatchdogTimers.get(taskId));
      this.taskWatchdogTimers.delete(taskId);

      baseLogger.info('Task cancelled', { taskId });
    } catch (error) {
      baseLogger.error('Failed to cancel task', { taskId, error });
      throw error;
    }
  }

  /**
   * Handle a tool call - routes to appropriate handler
   */
  private async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    extra?: {
      sendNotification?: (
        notification: import('@modelcontextprotocol/sdk/types.js').ServerNotification
      ) => Promise<void>;
      progressToken?: string | number;
      elicit?: unknown; // SEP-1036: Elicitation capability for sheets_confirm
      sample?: unknown; // SEP-1577: Sampling capability for sheets_analyze
      abortSignal?: AbortSignal; // Task cancellation support
    }
  ): Promise<CallToolResult> {
    // Lazy-load resources if deferred at startup
    await this.ensureResourcesRegistered();

    const startTime = Date.now();

    // Update queue metrics
    updateQueueMetrics(this.requestQueue.size, this.requestQueue.pending);

    // Wrap in queue to enforce concurrency limits
    return this.requestQueue.add(async () => {
      // Extract idempotency key from headers (if HTTP transport)
      const headers = (extra as { headers?: Record<string, string | string[] | undefined> })
        ?.headers;
      const idempotencyKey = headers ? extractIdempotencyKeyFromHeaders(headers) : undefined;
      const costTrackingTenantId = resolveCostTrackingTenantId({ headers });
      const principalId = extractPrincipalIdFromHeaders(headers) ?? 'anonymous';

      const requestContext = createRequestContext({
        sendNotification: extra?.sendNotification,
        progressToken: extra?.progressToken,
        // W3C Trace Context support - extract from extra if provided by HTTP transport
        traceId: (extra as { traceId?: string })?.traceId,
        spanId: (extra as { spanId?: string })?.spanId,
        parentSpanId: (extra as { parentSpanId?: string })?.parentSpanId,
        // Idempotency key from X-Idempotency-Key header
        idempotencyKey,
        principalId,
      });
      return runWithRequestContext(requestContext, async () => {
        const logger = requestContext.logger;
        recordSpreadsheetId(args);

        // Record heartbeat for connection health monitoring
        this.connectionHealthCheck.recordHeartbeat(toolName);

        // Log queue state with trace context
        logger.debug('Tool call queued', {
          toolName,
          queueSize: this.requestQueue.size,
          pendingCount: this.requestQueue.pending,
          traceId: requestContext.traceId,
          spanId: requestContext.spanId,
        });

        // Check if shutting down
        if (this.isShutdown) {
          return buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Server is shutting down',
                retryable: false,
              },
            },
          });
        }

        try {
          // Handle sheets_auth separately - it works even without full initialization
          if (toolName === 'sheets_auth') {
            if (!this.authHandler) {
              // Create a basic auth handler if not initialized
              this.authHandler = new AuthHandler({});
            }
            const { SheetsAuthInputSchema } = await import('./schemas/auth.js');
            const result = await this.authHandler.handle(
              parseWithCache(SheetsAuthInputSchema, args, 'SheetsAuthInput')
            );
            const duration = (Date.now() - startTime) / 1000;
            recordToolCall(toolName, 'auth', 'success', duration);
            return buildToolResponse(result);
          }

          // Local-only actions that are explicitly auth-exempt in tool registration metadata.
          // Extract action from request envelope first, then fallback to flat legacy args.
          const rawArgs = args as Record<string, unknown>;
          const rawAction = ((rawArgs['request'] as Record<string, unknown> | undefined)?.[
            'action'
          ] ?? rawArgs['action']) as string | undefined;
          const isExempt = isToolCallAuthExempt(toolName, rawAction);

          // For all other tools, check authentication first
          if (!isExempt) {
            const authResult = checkAuth(this.googleClient);
            if (!authResult.authenticated) {
              const errorResponse = buildAuthErrorResponse(authResult.error!);
              return buildToolResponse(errorResponse);
            }
          }

          if (!this.handlers) {
            // Pre-auth path: serve local-only tools without full handler initialization
            if (isExempt) {
              if (toolName === 'sheets_session') {
                const { SessionHandler } = await import('./handlers/session.js');
                const { SheetsSessionInputSchema } = await import('./schemas/session.js');
                const handler = new SessionHandler();
                const result = await handler.handle(
                  parseWithCache(SheetsSessionInputSchema, args, 'SheetsSessionInput')
                );
                return buildToolResponse(result);
              }
              if (toolName === 'sheets_history') {
                const { HistoryHandler } = await import('./handlers/history.js');
                const { SheetsHistoryInputSchema } = await import('./schemas/history.js');
                const handler = new HistoryHandler({});
                const result = await handler.handle(
                  parseWithCache(SheetsHistoryInputSchema, args, 'SheetsHistoryInput')
                );
                return buildToolResponse(result);
              }
            }
            return buildToolResponse({
              response: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Handlers not initialized. This is unexpected after auth check passed.',
                  retryable: false,
                  resolution: 'Call sheets_auth with action: "status" to verify auth state.',
                },
              },
            });
          }

          // Stage-based tool registration: auto-advance stages as needed
          if (STAGED_REGISTRATION) {
            // Auto-advance to Stage 2 when a spreadsheetId is seen or set_active is called
            if (
              toolStageManager.currentStage < 2 &&
              (rawAction === 'set_active' ||
                rawArgs['spreadsheetId'] ||
                (rawArgs['request'] as Record<string, unknown> | undefined)?.['spreadsheetId'])
            ) {
              toolStageManager.advanceToStage(2);
            }
            // Auto-advance to required stage if tool not yet registered
            toolStageManager.ensureToolAvailable(toolName);
          }

          // Route to appropriate handler (cached — handlers don't change between requests)
          this.cachedHandlerMap ??= createToolHandlerMap(
            this.handlers,
            this.authHandler ?? undefined
          );
          const handlerMap = this.cachedHandlerMap;

          const handler = handlerMap[toolName];
          if (!handler) {
            return buildToolResponse({
              response: {
                success: false,
                error: {
                  code: 'METHOD_NOT_FOUND',
                  message: `Handler for ${toolName} not yet implemented`,
                  retryable: false,
                  suggestedFix: 'This tool is planned for a future release',
                  alternatives: [
                    {
                      tool: 'sheets_data',
                      action: 'read',
                      description: 'Use sheets_data for basic read/write operations',
                    },
                  ],
                },
              },
            });
          }

          // Create per-request context with requestId for tracing
          if (!this.context) {
            return buildToolResponse({
              response: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Server context not initialized',
                  retryable: false,
                },
              },
            });
          }

          // OPTIMIZATION: Create session-level metadata cache (N+1 elimination)
          const { createMetadataCache } = await import('./services/metadata-cache.js');
          const metadataCache = this.googleClient?.sheets
            ? createMetadataCache(this.googleClient.sheets)
            : undefined;

          const perRequestContext: HandlerContext = {
            ...this.context,
            requestId: requestContext.requestId,
            // The MCP SDK automatically handles notifications/cancelled — it aborts this signal
            // when the client sends a cancellation notification for this requestId (SEP-1724).
            abortSignal: extra?.abortSignal,
            metadataCache, // Session-level metadata cache for N+1 elimination
          };

          // Start keepalive to prevent Claude Desktop timeouts during long operations
          const keepalive = startKeepalive({
            operationName: toolName,
            debug: process.env['DEBUG_KEEPALIVE'] === 'true',
          });

          // Pass full extra to handler (includes elicit/sample for MCP-native tools, plus context)
          // Wrap with try/finally to ensure keepalive stops even if handler throws
          let result;
          try {
            result = await handler(args, { ...extra, context: perRequestContext });
          } finally {
            // Stop keepalive when handler completes
            keepalive.stop();

            // OPTIMIZATION: Clear metadata cache after request completes
            metadataCache?.clear();

            // COST-01: Record per-tool API call when cost tracking is enabled
            perRequestContext.costTracker?.trackApiCall(costTrackingTenantId, 'sheets');
          }

          const duration = (Date.now() - startTime) / 1000;

          // Get action from args if available (check up to 3 levels deep)
          const action = extractActionFromArgs(args);
          const nowMs = Date.now();
          pruneOldSelfCorrectionFailures(nowMs);
          const correctionKey = buildSelfCorrectionKey(
            requestContext.principalId ?? 'anonymous',
            toolName
          );

          const response =
            typeof result === 'object' && result !== null
              ? (result as { response?: { success?: boolean; error?: unknown } }).response
              : undefined;
          const isError =
            response?.success === false ||
            (typeof result === 'object' &&
              result !== null &&
              'success' in result &&
              (result as { success?: boolean }).success === false);

          if (isError) {
            const errorDetail =
              response?.success === false ? response.error : (result as { error?: unknown }).error;
            logger.warn('Tool call failed', {
              tool: toolName,
              error: errorDetail,
            });
            // Record failed tool call
            recordToolCall(toolName, action, 'error', duration);
            recentToolFailures.set(correctionKey, { action, timestampMs: nowMs });
          } else {
            // Record successful tool call
            recordToolCall(toolName, action, 'success', duration);
            const priorFailure = recentToolFailures.get(correctionKey);
            if (priorFailure && nowMs - priorFailure.timestampMs <= SELF_CORRECTION_WINDOW_MS) {
              recordSelfCorrection(toolName, priorFailure.action, action);
              recentToolFailures.delete(correctionKey);
            }
          }

          return buildToolResponse(result);
        } catch (error) {
          const duration = (Date.now() - startTime) / 1000;
          const action = extractActionFromArgs(args);

          logger.error('Tool call threw exception', { tool: toolName, error });

          // Record error metric
          recordToolCall(toolName, action, 'error', duration);
          pruneOldSelfCorrectionFailures(Date.now());
          const correctionKey = buildSelfCorrectionKey(
            requestContext.principalId ?? 'anonymous',
            toolName
          );
          recentToolFailures.set(correctionKey, { action, timestampMs: Date.now() });

          // Check if this is a Google authentication error
          // If so, convert it to a user-friendly auth error with clear instructions
          if (isGoogleAuthError(error)) {
            logger.info('Detected Google auth error, converting to auth flow guidance', {
              tool: toolName,
            });
            return buildToolResponse(convertGoogleAuthError(error));
          }

          return buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : String(error),
                retryable: false,
              },
            },
          });
        }
      });
    });
  }

  /**
   * Register resources
   */
  private async registerResources(): Promise<void> {
    registerServalSheetsResources(this._server, this.googleClient);

    // Register knowledge resources
    // Deferred mode: register URI template only, load files on-demand (saves ~800KB context)
    // Eager mode: discover all files at startup and register individual URIs
    // Auto-enabled for STDIO when DEFER_SCHEMAS is active; override with DISABLE_KNOWLEDGE_RESOURCES
    const useDeferred = process.env['DISABLE_KNOWLEDGE_RESOURCES'] === 'true' || DEFER_SCHEMAS;
    if (useDeferred) {
      registerDeferredKnowledgeResources(this._server);
    } else {
      await registerKnowledgeResources(this._server);
    }

    // Register operation history resources (Phase 1, Task 1.3)
    registerHistoryResources(this._server);

    // Register time travel debugger resources (checkpoint blame analysis)
    registerTimeTravelResources(this._server);

    // Register cache statistics resources (Phase 1, Task 1.5)
    registerCacheResources(this._server);

    // Removed: registerWorkflowResources (Claude orchestrates natively via MCP)

    // Only register Phase 4 resources if Google client was initialized
    // These features require an active Google API connection
    if (this.googleClient) {
      // Register transaction resources (Phase 4, Task 4.1)
      registerTransactionResources(this._server);

      // Register conflict resources (Phase 4, Task 4.2)
      registerConflictResources(this._server);

      // Register impact resources (Phase 4, Task 4.3)
      registerImpactResources(this._server);

      // Register validation resources (Phase 4, Task 4.4)
      registerValidationResources(this._server);

      // Register metrics resources (Phase 6, Task 6.1)
      registerMetricsResources(this._server);

      // Register discovery resources (Phase 4 - Observability)
      registerDiscoveryResources(this._server);
    }

    // Register MCP-native resources (Elicitation & Sampling)
    registerConfirmResources(this._server); // Confirmation via Elicitation (SEP-1036)
    registerAnalyzeResources(this._server); // AI analysis via Sampling (SEP-1577)

    // Register dynamic sheet discovery (MCP 2025-11-25 Resource Templates)
    if (this.googleClient && this.context) {
      registerSheetResources(this._server, this.context);
    }

    // Register static reference resources (LLM reference documentation)
    registerReferenceResources(this._server); // Colors, formulas, formats, API limits

    // Register performance guide resources (Phase 6)
    registerGuideResources(this._server); // Quota optimization, batching, caching, error recovery

    // Register decision tree resources (Phase 6)
    registerDecisionResources(this._server); // Transaction, confirmation, tool selection, read vs batch_read

    // Register examples library resources (Phase 6)
    registerExamplesResources(this._server); // Basic operations, batch, transactions, composite workflows, analysis

    // Register workflow patterns resources (UASEV+R protocol demonstrations)
    registerPatternResources(this._server); // Real-world patterns showing optimal tool usage per workflow phase

    // Register schema resources for deferred loading (SERVAL_DEFER_SCHEMAS=true)
    // These resources expose full tool schemas on-demand when using minimal registration
    registerSchemaResources(this._server);

    // Register cost dashboard resources (billing integration)
    registerCostDashboardResources(this._server);

    // Register connection health resource (Phase 0, Priority 1)
    // Exposes real-time connection health statistics for monitoring
    registerConnectionHealthResource(this._server);

    // Register restart policy health resource (Phase 0, Priority 4)
    // Exposes restart policy state and backoff monitoring
    registerRestartHealthResource(this._server);

    // Register master index resource (servalsheets://index)
    // Entry point for Claude to discover all available resources
    registerMasterIndexResource(this._server);

    // Register knowledge index resource (knowledge:///index)
    // Provides semantic index of all knowledge files with usage guidance
    registerKnowledgeIndexResource(this._server);

    // Register knowledge search resource (knowledge:///search?q={query})
    // Enables fuzzy search across all knowledge files
    registerKnowledgeSearchResource(this._server);

    // Initialize resource change notifications (MCP notifications/resources/list_changed)
    // Enables clients to be notified when dynamic resources change (e.g., analysis results)
    initializeResourceNotifications(this._server);

    if (getEnv().ENABLE_TOOLS_LIST_CHANGED_NOTIFICATIONS) {
      resourceNotifications.syncToolList(
        TOOL_DEFINITIONS.map((tool) => tool.name),
        {
          emitOnFirstSet: false,
          reason: 'resource initialization completed',
        }
      );
    }
  }

  /**
   * Ensure resources are registered (lazy initialization)
   *
   * This method is called before any operation that requires resources.
   * If resources were deferred at startup, they are registered on first access.
   * Thread-safe: multiple concurrent calls will only register once.
   */
  private async ensureResourcesRegistered(): Promise<void> {
    // Fast path: resources already registered
    if (this.resourcesRegistered) {
      return;
    }

    // If registration is in progress, wait for it
    if (this.resourceRegistrationPromise) {
      await this.resourceRegistrationPromise;
      return;
    }

    // Start registration (only one caller will enter this block)
    this.resourceRegistrationPromise = (async () => {
      try {
        baseLogger.info('Lazy-loading resources on first access');
        await this.registerResources();
        this.resourcesRegistered = true;
        baseLogger.info('Resources registered successfully');
      } catch (error) {
        baseLogger.error('Failed to register resources', { error });
        this.resourceRegistrationPromise = null; // Allow retry
        throw error;
      }
    })();

    await this.resourceRegistrationPromise;
    // ISSUE-054: Clear resolved promise to free memory (fast path guarded by resourcesRegistered)
    this.resourceRegistrationPromise = null;
  }

  /**
   * Register prompts
   */
  private registerPrompts(): void {
    registerServalSheetsPrompts(this._server);
  }

  /**
   * Register MCP completions capability
   *
   * Resource template completions (spreadsheetId, range) are auto-registered by the SDK
   * when ResourceTemplate instances include 'complete' callbacks in resource-registration.ts.
   * This method ensures the capability is advertised and logs its status.
   *
   * SDK v1.26.0+: setCompletionRequestHandler() is called automatically by the SDK
   * when any ResourceTemplate with completions is registered.
   */
  private registerCompletions(): void {
    try {
      // Resource completions are wired in registerResources() via ResourceTemplate complete callbacks.
      // No explicit handler registration is needed — the SDK installs it automatically.
      baseLogger.info(
        'Completions capability registered (spreadsheetId + range autocompletion active)'
      );
    } catch (error) {
      baseLogger.error('Failed to register completions', { error });
    }
  }

  /**
   * Register task cancellation handler
   *
   * Enables clients to cancel long-running tasks via the tasks/cancel request.
   * MCP 2025-11-25: Task-based execution support
   */
  private registerTaskCancelHandler(): void {
    try {
      // Wire the cancel callback: when the SDK's TaskStore.cancelTask() is called
      // (via tasks/cancel protocol request), abort the running operation's AbortController
      const underlyingStore = this.taskStore.getUnderlyingStore();
      if ('onTaskCancelled' in underlyingStore) {
        (
          underlyingStore as { onTaskCancelled?: (taskId: string, reason: string) => void }
        ).onTaskCancelled = (taskId, reason) => {
          const abortController = this.taskAbortControllers.get(taskId);
          if (abortController) {
            abortController.abort(reason);
            this.taskAbortControllers.delete(taskId);
            baseLogger.info('Task abort signal sent', { taskId, reason });
          }
          // Clear watchdog timer when task is cancelled via store
          clearTimeout(this.taskWatchdogTimers.get(taskId));
          this.taskWatchdogTimers.delete(taskId);
        };
        baseLogger.info('Task cancellation support enabled');
      } else {
        baseLogger.warn('Task cancellation not available (store does not support onTaskCancelled)');
      }
    } catch (error) {
      baseLogger.error('Failed to register task cancel handler', { error });
    }
  }

  private installLoggingBridge(): void {
    if (this.loggingBridgeInstalled) {
      return;
    }

    this.loggingBridgeInstalled = true;
    const originalLog = baseLogger.log.bind(baseLogger);

    baseLogger.log = ((levelOrEntry: unknown, message?: unknown, ...meta: unknown[]) => {
      const result = (originalLog as (...args: unknown[]) => unknown)(
        levelOrEntry,
        message,
        ...meta
      );
      this.forwardLogMessage(levelOrEntry, message, meta);
      return result;
    }) as typeof baseLogger.log;
  }

  private forwardLogMessage(levelOrEntry: unknown, message: unknown, meta: unknown[]): void {
    if (!this.requestedMcpLogLevel || this.forwardingMcpLog) {
      return;
    }

    let level = 'info';
    let text = '';
    let data: unknown = message;

    if (typeof levelOrEntry === 'string') {
      level = levelOrEntry;
      if (typeof message === 'string') {
        text = message;
      } else if (message !== undefined) {
        text = safeStringify(message);
      }
      data = meta.length === 0 ? message : meta.length === 1 ? meta[0] : meta;
    } else if (typeof levelOrEntry === 'object' && levelOrEntry !== null) {
      const entry = levelOrEntry as Record<string, unknown>;
      if (typeof entry['level'] !== 'string') {
        return;
      }
      level = entry['level'];
      if (typeof entry['message'] === 'string') {
        text = entry['message'];
      } else if (entry['message'] !== undefined) {
        text = safeStringify(entry['message']);
      }
      data = entry;
    } else {
      return;
    }

    if (!shouldForwardMcpLog(level, this.requestedMcpLogLevel)) {
      return;
    }

    const mcpLevel = normalizeMcpLogLevel(level);
    this.forwardingMcpLog = true;
    void this._server.server
      .sendLoggingMessage({
        level: mcpLevel,
        logger: 'servalsheets',
        data: { message: text, meta: data },
      })
      .catch(() => {
        // Best-effort bridge: avoid recursive logging on notification failure.
      })
      .finally(() => {
        this.forwardingMcpLog = false;
      });
  }

  /**
   * Register logging handler for dynamic log level control
   *
   * Enables clients to adjust server log verbosity via logging/setLevel request.
   */
  private registerLogging(): void {
    try {
      this._server.server.setRequestHandler(
        SetLevelRequestSchema,
        async (request: z.infer<typeof SetLevelRequestSchema>) => {
          // Extract level from request params
          const level = request.params.level;

          this.requestedMcpLogLevel = level;
          this.installLoggingBridge();

          // Call the handler
          const response = await handleLoggingSetLevel({ level });

          baseLogger.info('Log level changed via logging/setLevel', {
            previousLevel: response.previousLevel,
            newLevel: response.newLevel,
          });

          // OK: Explicit empty - MCP logging/setLevel returns empty object per protocol
          return {};
        }
      );

      baseLogger.info('Logging handler registered (logging/setLevel)');
    } catch (error) {
      baseLogger.error('Failed to register logging handler', { error });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    this.isShutdown = true;

    baseLogger.info('ServalSheets: Shutting down...');

    // Wait for queue to drain (with timeout)
    const pendingAtShutdown = this.requestQueue.size;
    baseLogger.info('Waiting for request queue to drain', {
      queueSize: pendingAtShutdown,
      pendingCount: this.requestQueue.pending,
    });

    let timedOut = false;
    await Promise.race([
      this.requestQueue.onIdle(),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve();
        }, 10000)
      ), // 10s max
    ]);

    // ISSUE-056: if drain timed out, clear remaining queued (not yet started) items
    // to prevent orphaned requests from executing after shutdown completes.
    if (timedOut && this.requestQueue.size > 0) {
      const orphaned = this.requestQueue.size;
      this.requestQueue.clear();
      baseLogger.warn('Request queue drain timed out — cleared orphaned waiting requests', {
        orphaned,
        stillRunning: this.requestQueue.pending,
      });
    } else {
      baseLogger.info('Request queue drained');
    }

    // Clear range resolver cache
    if (this.context?.rangeResolver) {
      this.context.rangeResolver.clearCache();
    }

    // Stop cache cleanup task
    cacheManager.stopCleanupTask();

    // Stop health monitoring (ISSUE-055: 5s timeout prevents indefinite hang on stuck onStop hooks)
    await Promise.race([
      this.healthMonitor.stop(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Health monitor stop timed out after 5s')), 5000)
      ),
    ]).catch((err: Error) => {
      baseLogger.warn('Health monitor stop did not complete cleanly', { error: err.message });
    });
    baseLogger.info('Health monitoring stopped');

    // Phase 1: Clean up all registered resources (timers, connections, etc.)
    const cleanupResult = await cleanupAllResources();
    baseLogger.info('Resource cleanup complete', {
      total: cleanupResult.total,
      successful: cleanupResult.successful,
      failed: cleanupResult.failed,
    });

    if (cleanupResult.failed > 0) {
      baseLogger.warn('Some resources failed to clean up', {
        errors: cleanupResult.errors,
      });
    }

    // Phase 2.5: Destroy services with active timers (prevent memory leaks >24h uptime)
    try {
      // Dispose SpreadsheetBackend adapter (releases cached API refs)
      if (this.context?.backend) {
        await this.context.backend.dispose();
        baseLogger.debug('SpreadsheetBackend disposed');
      }

      // Destroy GoogleApiClient (pool monitor interval, HTTP agents)
      if (this.googleClient) {
        this.googleClient.destroy();
        baseLogger.debug('GoogleApiClient destroyed');
      }

      // Destroy RequestMerger (pending group timers)
      if (this.context?.requestMerger) {
        this.context.requestMerger.destroy();
        baseLogger.debug('RequestMerger destroyed');
      }

      if (this.context?.scheduler) {
        this.context.scheduler.dispose();
        baseLogger.debug('SchedulerService disposed');
      }

      // Destroy BatchingSystem singleton (batch window timers)
      const { getBatchingSystem } = await import('./services/batching-system.js');
      const batchingSystem = getBatchingSystem();
      if (batchingSystem) {
        batchingSystem.destroy();
        baseLogger.debug('BatchingSystem destroyed');
      }

      // Destroy PrefetchingSystem singleton (background refresh timer)
      const { getPrefetchingSystem } = await import('./services/prefetching-system.js');
      const prefetchingSystem = getPrefetchingSystem();
      if (prefetchingSystem) {
        prefetchingSystem.destroy();
        baseLogger.debug('PrefetchingSystem destroyed');
      }
    } catch (error) {
      baseLogger.warn('Error during service cleanup', { error });
    }

    // Dispose connector framework resources (subscription timers + connector state).
    await connectorManager.dispose();
    baseLogger.debug('ConnectorManager disposed');

    // Dispose task store (stops cleanup interval)
    this.taskStore.dispose();

    // Dispose temporary resource store (stops cleanup interval)
    disposeTemporaryResourceStore();

    // Clear references
    this.googleClient = null;
    this.authHandler = null;
    this.handlers = null;
    this.context = null;
    this.cachedHandlerMap = null;

    baseLogger.info('ServalSheets: Shutdown complete');
  }

  /**
   * Get underlying MCP server instance (for testing and advanced usage)
   */
  get server(): McpServer {
    return this._server;
  }

  /**
   * Start the server with signal handling
   */
  async start(): Promise<void> {
    const startTime = performance.now();

    // Initialize first (register handlers), then connect
    baseLogger.info('[Phase 1/3] Initializing handlers...');
    const initStart = performance.now();
    // Wrap initialization in try-catch to provide better error context
    try {
      await this.initialize();
      const initDuration = performance.now() - initStart;
      baseLogger.info('[Phase 1/3] ✓ Handlers initialized', {
        durationMs: initDuration.toFixed(2),
      });
    } catch (error) {
      baseLogger.error('[Phase 1/3] ✗ Initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw for CLI to handle with enhanced errors
    }

    baseLogger.info('[Phase 2/3] Creating STDIO transport');
    const transportStart = performance.now();
    const transport = new StdioServerTransport();
    const transportDuration = performance.now() - transportStart;
    let isConnected = false;

    // Add transport error handlers BEFORE connecting
    transport.onclose = () => {
      if (!this.isShutdown) {
        baseLogger.warn('MCP transport closed unexpectedly', {
          wasConnected: isConnected,
          suggestion: isConnected
            ? 'Client (Claude Desktop) may have crashed or disconnected'
            : 'Initial connection failed - check client MCP configuration',
        });

        // Graceful shutdown to clean up resources
        this.shutdown().catch((err) => {
          baseLogger.error('Shutdown after transport close failed', { error: err });
        });
      }
    };

    transport.onerror = (error: Error) => {
      baseLogger.error('MCP transport error', {
        error: error.message,
        stack: error.stack,
        isConnected,
        suggestion: 'Check Claude Desktop logs and MCP server configuration',
      });
    };

    // Handle process signals for graceful shutdown
    const handleShutdown = async (signal: string): Promise<void> => {
      baseLogger.warn(`ServalSheets: Received ${signal}, shutting down...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGHUP', () => handleShutdown('SIGHUP'));

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      baseLogger.error('ServalSheets: Uncaught exception', { error });
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      baseLogger.error('ServalSheets: Unhandled rejection', { reason });
      await this.shutdown();
      process.exit(1);
    });

    // Connect after initialization (handlers are registered)
    baseLogger.info('[Phase 3/3] Connecting transport');
    const connectStart = performance.now();
    // Wrap connect in try-catch to handle immediate connection failures
    try {
      await this._server.connect(transport);
      isConnected = true;
      const connectDuration = performance.now() - connectStart;
      const totalDuration = performance.now() - startTime;
      baseLogger.info(
        `[Phase 3/3] ✓ ServalSheets ready (${TOOL_COUNT} tools, ${ACTION_COUNT} actions)`,
        {
          transport: 'stdio',
          connectionId: new Date().toISOString(),
          timing: {
            initMs: (performance.now() - startTime - connectDuration - transportDuration).toFixed(
              2
            ),
            transportMs: transportDuration.toFixed(2),
            connectMs: connectDuration.toFixed(2),
            totalMs: totalDuration.toFixed(2),
          },
        }
      );
    } catch (error) {
      baseLogger.error('[Phase 3/3] ✗ Connection failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        transport: 'stdio',
        suggestion: 'Check Claude Desktop MCP configuration and server.json',
      });
      throw error; // Re-throw for CLI to handle
    }
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; tools: number; actions: number } {
    return {
      name: this.options.name ?? 'servalsheets',
      version: this.options.version ?? PACKAGE_VERSION,
      tools: TOOL_COUNT,
      actions: ACTION_COUNT,
    };
  }

  /**
   * Check if server is healthy
   */
  isHealthy(): boolean {
    return !this.isShutdown && this.googleClient !== null;
  }
}

/**
 * Create and start a ServalSheets server
 *
 * Automatically selects RedisTaskStore if REDIS_URL is set, otherwise InMemoryTaskStore.
 * For production deployments with multiple instances, set REDIS_URL for shared task state.
 */
export async function createServalSheetsServer(
  options: ServalSheetsServerOptions = {}
): Promise<ServalSheetsServer> {
  // C1: Warn when using default embedded OAuth credentials (works for both STDIO and HTTP modes)
  warnIfDefaultCredentialsInHttpMode();

  // ISSUE-232: Wire GDPR sampling consent checker. When ENABLE_SAMPLING_CONSENT=strict, sampling
  // calls that lack explicit user consent will be blocked. Default: permissive (logs warning only).
  registerSamplingConsentChecker(async () => {
    if (process.env['ENABLE_SAMPLING_CONSENT'] === 'strict') {
      throw new Error(
        'GDPR consent required before AI sampling. Set ENABLE_SAMPLING_CONSENT=true to enable.'
      );
    }
    // Non-strict: sampling is allowed; operators can override with a stricter checker.
  });

  // Create task store if not provided - uses createTaskStore() for Redis support
  if (!options.taskStore) {
    const { createTaskStore } = await import('./core/task-store-factory.js');
    options.taskStore = await createTaskStore();
  }

  // Initialize capability cache service with Redis if available
  const redisUrl = process.env['REDIS_URL'];
  const isProduction = process.env['NODE_ENV'] === 'production';
  const allowMemorySessions = process.env['ALLOW_MEMORY_SESSIONS'] === 'true';

  // Enforce Redis in production for distributed cache and session persistence
  // Unless ALLOW_MEMORY_SESSIONS=true for local testing
  if (isProduction && !redisUrl && !allowMemorySessions) {
    throw new Error(
      'Redis is required in production mode. Set REDIS_URL environment variable.\n' +
        'Example: REDIS_URL=redis://localhost:6379\n' +
        'For development/testing, set NODE_ENV=development\n' +
        'For local production testing, set ALLOW_MEMORY_SESSIONS=true'
    );
  }

  if (isProduction && allowMemorySessions && !redisUrl) {
    baseLogger.warn(
      'Running production without Redis (ALLOW_MEMORY_SESSIONS=true). ' +
        'Cache and sessions are memory-only. Not recommended for real production.'
    );
  }

  if (redisUrl) {
    const { createClient } = await import('redis');
    const { initCapabilityCacheService } = await import('./services/capability-cache.js');
    const { initETagCache } = await import('./services/etag-cache.js');
    const { getDistributedCacheConfig } = await import('./config/env.js');

    const redis = createClient({ url: redisUrl });
    await redis.connect();

    // Initialize capability cache with Redis
    initCapabilityCacheService(redis);
    baseLogger.info('Capability cache service initialized with Redis');

    // Initialize ETag cache with Redis (if enabled)
    const cacheConfig = getDistributedCacheConfig();
    if (cacheConfig.enabled) {
      initETagCache(redis);
      baseLogger.info('ETag cache initialized with Redis L2 (distributed caching enabled)');
    } else {
      initETagCache();
      baseLogger.info('ETag cache initialized (L1 memory-only)');
    }

    // SCALE-01: Wire Redis-backed session store when SESSION_STORE_TYPE=redis
    if (process.env['SESSION_STORE_TYPE'] === 'redis') {
      const { initSessionRedis } = await import('./services/session-context.js');
      initSessionRedis(redis);
      baseLogger.info('Session store initialized with Redis backend');
    }
  } else {
    const { initCapabilityCacheService } = await import('./services/capability-cache.js');
    const { initETagCache } = await import('./services/etag-cache.js');

    initCapabilityCacheService();
    baseLogger.info('Capability cache service initialized (memory-only)');

    initETagCache();
    baseLogger.info('ETag cache initialized (L1 memory-only)');
  }

  const server = new ServalSheetsServer(options);
  await server.start();
  return server;
}
