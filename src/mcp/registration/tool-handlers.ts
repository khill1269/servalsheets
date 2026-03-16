/**
 * ServalSheets - Tool Handlers
 *
 * Handler mapping and tool call execution logic.
 *
 * @module mcp/registration/tool-handlers
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type {
  CallToolResult,
  RequestInfo,
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import type { ToolTaskHandler } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { randomUUID } from 'crypto';
import PQueue from 'p-queue';
import {
  recordToolCall,
  recordToolCallLatency,
  recordError,
  recordSelfCorrection,
  recordErrorCodeCompatibility,
  updateQueueMetrics,
} from '../../observability/metrics.js';
import { getTemporaryResourceStore } from '../../resources/temporary-storage.js';
import { resourceNotifications } from '../../resources/notifications.js';
import { withToolSpan } from '../../utils/tracing.js';
import { z, type ZodSchema, type ZodTypeAny } from 'zod';

import type { Handlers } from '../../handlers/index.js';
import { AuthHandler } from '../../handlers/auth.js';
import {
  handleGenerateTemplateAction,
  handlePreviewGenerationAction,
} from '../../handlers/composite-actions/generation.js';
import { ConfirmHandler } from '../../handlers/confirm.js';
import { SessionHandler } from '../../handlers/session.js';
import type { GoogleApiClient } from '../../services/google-api.js';
import {
  createRequestContext,
  runWithRequestContext,
  getRequestContext,
  createRequestAbortError,
  type RelatedRequestSender,
  type TaskStatusUpdater,
} from '../../utils/request-context.js';
import { extractIdempotencyKeyFromHeaders } from '../../utils/idempotency-key-generator.js';
import { compactResponse, isCompactModeEnabled } from '../../utils/response-compactor.js';
import { recordSpreadsheetId, TOOL_ACTIONS } from '../completions.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from '../features-2025-11-25.js';
import { getHistoryService } from '../../services/history-service.js';
import { getTraceAggregator } from '../../services/trace-aggregator.js';
import { getSessionContext } from '../../services/session-context.js';
import { getConcurrencyCoordinator } from '../../services/concurrency-coordinator.js';
import { getCostTracker } from '../../services/cost-tracker.js';
import { getAuditLogger } from '../../services/audit-logger.js';
import { getCacheInvalidationGraph } from '../../services/cache-invalidation-graph.js';
import { createMetadataCache } from '../../services/metadata-cache.js';
import { invalidateContext as invalidateSamplingContext } from '../../services/sampling-context-cache.js';
import { getEnv } from '../../config/env.js';
import { registerServerTaskCancelHandler } from '../../server-runtime/control-plane-registration.js';
import { handlePreInitExemptToolCall } from '../../server-runtime/preinit-tool-routing.js';
import { resolveCostTrackingTenantId } from '../../utils/tenant-identification.js';
import type { OperationHistory } from '../../types/history.js';
import {
  prepareSchemaForRegistrationCached,
  wrapInputSchemaForLegacyRequest,
} from './schema-helpers.js';
import { detectLegacyInvocation, normalizeToolArgs } from './tool-arg-normalization.js';
import { assertValidMcpToolNames } from './tool-name-validation.js';
import type { ToolDefinition } from './tool-definitions.js';
import { redactSensitiveData } from '../../middleware/redaction.js';
import { ACTIVE_TOOL_DEFINITIONS, isToolCallAuthExempt } from './tool-definitions.js';
import {
  extractAction,
  extractSpreadsheetId,
  extractSheetId,
  extractCellsAffected,
  extractSnapshotId,
  extractErrorMessage,
  extractErrorCode,
  isSuccessResult,
} from './extraction-helpers.js';
import { createZodValidationError } from '../../utils/error-factory.js';
import { logger } from '../../utils/logger.js';
import {
  SheetsAuthInputSchema,
  SheetsCoreInputSchema,
  SheetsDataInputSchema,
  SheetsFormatInputSchema,
  SheetsDimensionsInputSchema,
  SheetsVisualizeInputSchema,
  SheetsCollaborateInputSchema,
  SheetsAdvancedInputSchema,
  SheetsTransactionInputSchema,
  SheetsQualityInputSchema,
  SheetsHistoryInputSchema,
  SheetsConfirmInputSchema,
  SheetsAnalyzeInputSchema,
  SheetsFixInputSchema,
  CompositeInputSchema,
  SheetsSessionInputSchema,
  // Tier 7 Enterprise tools
  SheetsTemplatesInputSchema,
  SheetsBigQueryInputSchema,
  SheetsAppsScriptInputSchema,
  SheetsWebhookInputSchema,
  SheetsDependenciesInputSchema,
  SheetsFederationInputSchema,
  SheetsComputeInputSchema,
  SheetsAgentInputSchema,
  SheetsConnectorsInputSchema,
} from '../../schemas/index.js';
import { parseWithCache } from '../../utils/schema-cache.js';
import { registerToolsListCompatibilityHandler } from './tools-list-compat.js';
import { wrapToolMapWithIdempotency } from '../../middleware/idempotency-middleware.js';
import { registerPipelineDispatch } from '../../services/pipeline-registry.js';
import { suggestFix } from '../../services/error-fix-suggester.js';
import { getRecommendedActions } from '../../services/action-recommender.js';
import { scanResponseQuality } from '../../services/lightweight-quality-scanner.js';
import { generateResponseHints } from '../../services/response-hints-engine.js';
import { getErrorCodeCompatibility } from '../../utils/error-code-compat.js';
import { withWriteLock } from '../../middleware/write-lock-middleware.js';
import { checkRateLimit } from '../../middleware/rate-limit-middleware.js';
import { detectMutationSafetyViolation } from '../../middleware/mutation-safety-middleware.js';
import { startKeepalive } from '../../utils/keepalive.js';
import { createTaskAwareSamplingServer } from '../sampling.js';
import {
  buildAuthErrorResponse,
  checkAuthAsync,
  convertGoogleAuthError,
  isGoogleAuthError,
} from '../../utils/auth-guard.js';
import { replaceAvailableToolNames } from '../tool-registry-state.js';

// Wrap input schemas for legacy envelopes during validation.
// Keep registration schemas unwrapped to avoid MCP SDK tools/list empty schema bug.
const SheetsAuthInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsAuthInputSchema);
const SheetsCoreInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsCoreInputSchema);
const SheetsDataInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsDataInputSchema);
const SheetsFormatInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsFormatInputSchema);
const SheetsDimensionsInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsDimensionsInputSchema
);
const SheetsVisualizeInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsVisualizeInputSchema
);
const SheetsCollaborateInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsCollaborateInputSchema
);
const SheetsAdvancedInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsAdvancedInputSchema);
const SheetsTransactionInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsTransactionInputSchema
);
const SheetsQualityInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsQualityInputSchema);
const SheetsHistoryInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsHistoryInputSchema);
const SheetsConfirmInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsConfirmInputSchema);
const SheetsAnalyzeInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsAnalyzeInputSchema);
const SheetsFixInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsFixInputSchema);
const CompositeInputSchemaLegacy = wrapInputSchemaForLegacyRequest(CompositeInputSchema);
const SheetsSessionInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsSessionInputSchema);
const SheetsTemplatesInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsTemplatesInputSchema
);
const SheetsBigQueryInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsBigQueryInputSchema);
const SheetsAppsScriptInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsAppsScriptInputSchema
);
const SheetsWebhookInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsWebhookInputSchema);
const SheetsDependenciesInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsDependenciesInputSchema
);
const SheetsFederationInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsFederationInputSchema
);
const SheetsComputeInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsComputeInputSchema);
const SheetsAgentInputSchemaLegacy = wrapInputSchemaForLegacyRequest(SheetsAgentInputSchema);
const SheetsConnectorsInputSchemaLegacy = wrapInputSchemaForLegacyRequest(
  SheetsConnectorsInputSchema
);

const NON_FATAL_TOOL_ERROR_CODES = new Set<string>([
  'VALIDATION_ERROR',
  'INVALID_PARAMS',
  'NOT_FOUND',
  'PRECONDITION_FAILED',
  'FAILED_PRECONDITION',
  'INCREMENTAL_SCOPE_REQUIRED',
  'PERMISSION_DENIED',
  'ELICITATION_UNAVAILABLE',
  'CONFIG_ERROR',
  'FEATURE_UNAVAILABLE',
  'AUTHENTICATION_REQUIRED',
  'NOT_AUTHENTICATED',
  'NOT_CONFIGURED',
  'TOKEN_EXPIRED',
  'QUOTA_EXCEEDED',
]);

const SELF_CORRECTION_WINDOW_MS = 5 * 60 * 1000;
const recentFailuresByPrincipal = new Map<string, { action: string; timestampMs: number }>();
type RegisteredTaskStore = Parameters<typeof registerServerTaskCancelHandler>[0]['taskStore'];
const taskAbortControllersByStore = new WeakMap<
  RegisteredTaskStore,
  Map<string, AbortController>
>();
const taskWatchdogTimersByStore = new WeakMap<RegisteredTaskStore, Map<string, NodeJS.Timeout>>();
const taskCancelHandlersRegistered = new WeakSet<RegisteredTaskStore>();

export interface LegacyToolRegistration {
  dispose(): void;
}

interface LegacyToolRegistrationState {
  disposed: boolean;
  abortController: AbortController;
}

function buildSelfCorrectionKey(toolName: string, principalId: string): string {
  return `${principalId}:${toolName}`;
}

function pruneSelfCorrectionFailures(nowMs: number): void {
  for (const [key, value] of recentFailuresByPrincipal.entries()) {
    if (nowMs - value.timestampMs > SELF_CORRECTION_WINDOW_MS) {
      recentFailuresByPrincipal.delete(key);
    }
  }
}

function mergeAbortSignals(
  requestAbortSignal?: AbortSignal,
  sessionAbortSignal?: AbortSignal
): AbortSignal | undefined {
  if (!requestAbortSignal) {
    return sessionAbortSignal;
  }
  if (!sessionAbortSignal) {
    return requestAbortSignal;
  }

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([requestAbortSignal, sessionAbortSignal]);
  }

  const controller = new AbortController();
  const forwardAbort = (signal: AbortSignal): void => {
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  if (requestAbortSignal.aborted) {
    forwardAbort(requestAbortSignal);
  } else {
    requestAbortSignal.addEventListener('abort', () => forwardAbort(requestAbortSignal), {
      once: true,
    });
  }

  if (sessionAbortSignal.aborted) {
    forwardAbort(sessionAbortSignal);
  } else {
    sessionAbortSignal.addEventListener('abort', () => forwardAbort(sessionAbortSignal), {
      once: true,
    });
  }

  return controller.signal;
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeRequestHeaders(
  headers: unknown
): Record<string, string | string[] | undefined> | undefined {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  if (
    'entries' in (headers as Record<string, unknown>) &&
    typeof (headers as { entries?: unknown }).entries === 'function'
  ) {
    return Object.fromEntries(
      Array.from((headers as { entries: () => IterableIterator<[string, string]> }).entries())
    );
  }

  return headers as Record<string, string | string[] | undefined>;
}

function extractAttemptedAction(args: unknown): string | null {
  if (!args || typeof args !== 'object') {
    return null;
  }

  const record = args as Record<string, unknown>;
  if (typeof record['action'] === 'string') {
    return record['action'];
  }

  const request = record['request'];
  if (!request || typeof request !== 'object') {
    return null;
  }

  const requestRecord = request as Record<string, unknown>;
  return typeof requestRecord['action'] === 'string' ? requestRecord['action'] : null;
}

function getIssueCode(issue: z.ZodIssue): string {
  return String((issue as { code?: unknown }).code ?? '');
}

function normalizeIssuePath(path: readonly PropertyKey[]): Array<string | number> {
  return path.map((segment) =>
    typeof segment === 'string' || typeof segment === 'number' ? segment : String(segment)
  );
}

function isActionValidationIssue(issue: z.ZodIssue): boolean {
  const issueRecord = issue as unknown as Record<string, unknown>;
  const issueCode = getIssueCode(issue);
  const hasActionInPath = normalizeIssuePath(issue.path).some((segment) => segment === 'action');
  const isActionDiscriminator = issueRecord['discriminator'] === 'action';

  return (
    (hasActionInPath &&
      (issueCode === 'invalid_union' ||
        issueCode === 'invalid_union_discriminator' ||
        issueCode === 'invalid_literal' ||
        issueCode === 'invalid_value')) ||
    isActionDiscriminator
  );
}

function formatActionValidationMessage(
  path: readonly PropertyKey[],
  availableActions: string[]
): string {
  const normalizedPath = normalizeIssuePath(path);
  const pathStr = normalizedPath.length > 0 ? normalizedPath.join('.') : 'action';
  const preview = availableActions.slice(0, 20).join(', ');
  const more = availableActions.length > 20 ? ` (and ${availableActions.length - 20} more)` : '';
  return `Invalid action at '${pathStr}'. Valid actions: ${preview}${more}`;
}

function shouldEnhanceActionIssue(issue: z.ZodIssue, attemptedAction: string | null): boolean {
  if (isActionValidationIssue(issue)) {
    return true;
  }

  if (!attemptedAction) {
    return false;
  }

  const issueCode = getIssueCode(issue);
  return issueCode === 'invalid_union' || issueCode === 'invalid_union_discriminator';
}

function shouldInvalidateSamplingContext(toolName: string, action: string): boolean {
  const invalidationKeys = getCacheInvalidationGraph().getInvalidationKeys(toolName, action);
  return invalidationKeys.length > 0;
}

function getTaskAbortControllers(taskStore: RegisteredTaskStore): Map<string, AbortController> {
  const existing = taskAbortControllersByStore.get(taskStore);
  if (existing) {
    return existing;
  }

  const controllers = new Map<string, AbortController>();
  taskAbortControllersByStore.set(taskStore, controllers);
  return controllers;
}

function getTaskWatchdogTimers(taskStore: RegisteredTaskStore): Map<string, NodeJS.Timeout> {
  const existing = taskWatchdogTimersByStore.get(taskStore);
  if (existing) {
    return existing;
  }

  const timers = new Map<string, NodeJS.Timeout>();
  taskWatchdogTimersByStore.set(taskStore, timers);
  return timers;
}

function ensureTaskCancellationControlPlane(taskStore: RegisteredTaskStore): {
  abortControllers: Map<string, AbortController>;
  watchdogTimers: Map<string, NodeJS.Timeout>;
} {
  const abortControllers = getTaskAbortControllers(taskStore);
  const watchdogTimers = getTaskWatchdogTimers(taskStore);

  if (!taskCancelHandlersRegistered.has(taskStore)) {
    registerServerTaskCancelHandler({
      taskStore,
      taskAbortControllers: abortControllers,
      taskWatchdogTimers: watchdogTimers,
      log: logger,
    });
    taskCancelHandlersRegistered.add(taskStore);
  }

  return { abortControllers, watchdogTimers };
}

const parseForHandler = <T>(
  schema: ZodTypeAny,
  args: unknown,
  schemaName: string,
  toolName?: string
): T => {
  try {
    return parseWithCache(schema as ZodSchema<T>, args, schemaName);
  } catch (error) {
    if (!(error instanceof z.ZodError) || !toolName) {
      throw error;
    }

    const availableActions = TOOL_ACTIONS[toolName] ?? [];
    if (availableActions.length === 0) {
      throw error;
    }

    const attemptedAction = extractAttemptedAction(args);
    const hasActionIssue = error.issues.some((issue) =>
      shouldEnhanceActionIssue(issue, attemptedAction)
    );

    if (!hasActionIssue) {
      throw error;
    }

    const enhancedIssues = error.issues.map((issue) => {
      if (!shouldEnhanceActionIssue(issue, attemptedAction)) {
        return issue;
      }

      const messagePath = issue.path.length > 0 ? issue.path : (['action'] as PropertyKey[]);

      return {
        ...issue,
        message: formatActionValidationMessage(messagePath, availableActions),
        options: availableActions,
      } as unknown as z.ZodIssue;
    });

    if (attemptedAction && attemptedAction.toLowerCase().includes('rename')) {
      enhancedIssues.push({
        code: 'custom',
        path: ['_hint'],
        message: 'Hint: To rename a sheet, use action="update_sheet" with the "title" parameter.',
      } as z.ZodIssue);
    }

    throw new z.ZodError(enhancedIssues);
  }
};

// ============================================================================
// HANDLER MAPPING
// ============================================================================

/**
 * Creates a map of tool names to handler functions
 *
 * Each handler receives validated input and returns structured output.
 * The MCP SDK validates input against inputSchema before calling the handler.
 */
export function createToolHandlerMap(
  handlers: Handlers,
  authHandler?: AuthHandler,
  googleClient?: GoogleApiClient | null
): Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> {
  const map: Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> = {
    sheets_core: (args) =>
      handlers.core.handle(
        parseForHandler<Parameters<Handlers['core']['handle']>[0]>(
          SheetsCoreInputSchemaLegacy,
          args,
          'SheetsCoreInput',
          'sheets_core'
        )
      ),
    sheets_data: (args) =>
      handlers.data.handle(
        parseForHandler<Parameters<Handlers['data']['handle']>[0]>(
          SheetsDataInputSchemaLegacy,
          args,
          'SheetsDataInput',
          'sheets_data'
        )
      ),
    sheets_format: (args) =>
      handlers.format.handle(
        parseForHandler<Parameters<Handlers['format']['handle']>[0]>(
          SheetsFormatInputSchemaLegacy,
          args,
          'SheetsFormatInput',
          'sheets_format'
        )
      ),
    sheets_dimensions: (args) =>
      handlers.dimensions.handle(
        parseForHandler<Parameters<Handlers['dimensions']['handle']>[0]>(
          SheetsDimensionsInputSchemaLegacy,
          args,
          'SheetsDimensionsInput',
          'sheets_dimensions'
        )
      ),
    sheets_visualize: (args) =>
      handlers.visualize.handle(
        parseForHandler<Parameters<Handlers['visualize']['handle']>[0]>(
          SheetsVisualizeInputSchemaLegacy,
          args,
          'SheetsVisualizeInput',
          'sheets_visualize'
        )
      ),
    sheets_collaborate: (args) =>
      handlers.collaborate.handle(
        parseForHandler<Parameters<Handlers['collaborate']['handle']>[0]>(
          SheetsCollaborateInputSchemaLegacy,
          args,
          'SheetsCollaborateInput',
          'sheets_collaborate'
        )
      ),
    sheets_advanced: (args) =>
      handlers.advanced.handle(
        parseForHandler<Parameters<Handlers['advanced']['handle']>[0]>(
          SheetsAdvancedInputSchemaLegacy,
          args,
          'SheetsAdvancedInput',
          'sheets_advanced'
        )
      ),
    sheets_transaction: (args) =>
      handlers.transaction.handle(
        parseForHandler<Parameters<Handlers['transaction']['handle']>[0]>(
          SheetsTransactionInputSchemaLegacy,
          args,
          'SheetsTransactionInput',
          'sheets_transaction'
        )
      ),
    sheets_quality: (args) =>
      handlers.quality.handle(
        parseForHandler<Parameters<Handlers['quality']['handle']>[0]>(
          SheetsQualityInputSchemaLegacy,
          args,
          'SheetsQualityInput',
          'sheets_quality'
        )
      ),
    sheets_history: (args) =>
      handlers.history.handle(
        parseForHandler<Parameters<Handlers['history']['handle']>[0]>(
          SheetsHistoryInputSchemaLegacy,
          args,
          'SheetsHistoryInput',
          'sheets_history'
        )
      ),
    // MCP-native tools (use Server instance from context for Elicitation/Sampling)
    sheets_confirm: (args) =>
      handlers.confirm.handle(
        parseForHandler<Parameters<Handlers['confirm']['handle']>[0]>(
          SheetsConfirmInputSchemaLegacy,
          args,
          'SheetsConfirmInput',
          'sheets_confirm'
        )
      ),
    sheets_analyze: (args) =>
      handlers.analyze.handle(
        parseForHandler<Parameters<Handlers['analyze']['handle']>[0]>(
          SheetsAnalyzeInputSchemaLegacy,
          args,
          'SheetsAnalyzeInput',
          'sheets_analyze'
        )
      ),
    sheets_fix: (args) =>
      handlers.fix.handle(
        parseForHandler<Parameters<Handlers['fix']['handle']>[0]>(
          SheetsFixInputSchemaLegacy,
          args,
          'SheetsFixInput',
          'sheets_fix'
        )
      ),
    // Composite operations
    sheets_composite: (args) =>
      handlers.composite.handle(
        parseForHandler<Parameters<Handlers['composite']['handle']>[0]>(
          CompositeInputSchemaLegacy,
          args,
          'CompositeInput',
          'sheets_composite'
        )
      ),
    // Session context for NL excellence
    sheets_session: (args) =>
      handlers.session.handle(
        parseForHandler<Parameters<Handlers['session']['handle']>[0]>(
          SheetsSessionInputSchemaLegacy,
          args,
          'SheetsSessionInput',
          'sheets_session'
        )
      ),
    // Tier 7 Enterprise tools
    sheets_templates: (args) =>
      handlers.templates.handle(
        parseForHandler<Parameters<Handlers['templates']['handle']>[0]>(
          SheetsTemplatesInputSchemaLegacy,
          args,
          'SheetsTemplatesInput',
          'sheets_templates'
        )
      ),
    sheets_bigquery: (args) =>
      handlers.bigquery.handle(
        parseForHandler<Parameters<Handlers['bigquery']['handle']>[0]>(
          SheetsBigQueryInputSchemaLegacy,
          args,
          'SheetsBigQueryInput',
          'sheets_bigquery'
        )
      ),
    sheets_appsscript: (args) =>
      handlers.appsscript.handle(
        parseForHandler<Parameters<Handlers['appsscript']['handle']>[0]>(
          SheetsAppsScriptInputSchemaLegacy,
          args,
          'SheetsAppsScriptInput',
          'sheets_appsscript'
        )
      ),
    sheets_webhook: (args) =>
      handlers.webhooks.handle(
        parseForHandler<Parameters<Handlers['webhooks']['handle']>[0]>(
          SheetsWebhookInputSchemaLegacy,
          args,
          'SheetsWebhookInput',
          'sheets_webhook'
        )
      ),
    sheets_dependencies: (args) =>
      handlers.dependencies.handle(
        parseForHandler<Parameters<Handlers['dependencies']['handle']>[0]>(
          SheetsDependenciesInputSchemaLegacy,
          args,
          'SheetsDependenciesInput',
          'sheets_dependencies'
        )
      ),
    sheets_federation: (args) =>
      handlers.federation.handle(
        parseForHandler<Parameters<Handlers['federation']['handle']>[0]>(
          SheetsFederationInputSchemaLegacy,
          args,
          'SheetsFederationInput',
          'sheets_federation'
        )
      ),
    // Phase 5: Computation Engine
    sheets_compute: (args) =>
      handlers.compute.handle(
        parseForHandler<Parameters<Handlers['compute']['handle']>[0]>(
          SheetsComputeInputSchemaLegacy,
          args,
          'SheetsComputeInput',
          'sheets_compute'
        )
      ),
    // Phase 6: Agent Loop
    sheets_agent: (args) =>
      handlers.agent.handle(
        parseForHandler<Parameters<Handlers['agent']['handle']>[0]>(
          SheetsAgentInputSchemaLegacy,
          args,
          'SheetsAgentInput',
          'sheets_agent'
        )
      ),
    // Wave 6: Live Data Connectors
    sheets_connectors: (args) =>
      handlers.connectors.handle(
        parseForHandler<Parameters<Handlers['connectors']['handle']>[0]>(
          SheetsConnectorsInputSchemaLegacy,
          args,
          'SheetsConnectorsInput',
          'sheets_connectors'
        )
      ),
  };

  if (authHandler) {
    map['sheets_auth'] = (args) =>
      authHandler.handle(
        parseForHandler<Parameters<AuthHandler['handle']>[0]>(
          SheetsAuthInputSchemaLegacy,
          args,
          'SheetsAuthInput',
          'sheets_auth'
        )
      );
  }

  const withRequestMetadataCache = (
    fn: (args: unknown, extra?: unknown) => Promise<unknown>
  ): ((args: unknown, extra?: unknown) => Promise<unknown>) => {
    if (!googleClient?.sheets) {
      return fn;
    }

    return async (args: unknown, extra?: unknown) => {
      const requestContext = getRequestContext();
      if (requestContext?.metadataCache) {
        return fn(args, extra);
      }

      const metadataCache = createMetadataCache(googleClient.sheets);
      if (requestContext) {
        requestContext.metadataCache = metadataCache;
      }

      try {
        return await fn(args, extra);
      } finally {
        if (requestContext?.metadataCache === metadataCache) {
          delete requestContext.metadataCache;
        }
        metadataCache.clear();
      }
    };
  };

  for (const [toolName, fn] of Object.entries(map)) {
    map[toolName] = withRequestMetadataCache(fn);
  }

  // Build final map (with optional idempotency wrapping)
  const finalMap = getEnv().ENABLE_IDEMPOTENCY ? wrapToolMapWithIdempotency(map) : map;

  // Register pipeline dispatcher so SessionHandler.execute_pipeline can call other tools.
  // Using a registry module avoids circular imports between tool-handlers ↔ session.
  registerPipelineDispatch((tool: string, args: Record<string, unknown>) => {
    const fn = finalMap[tool];
    if (!fn) return Promise.reject(new Error(`Unknown tool in pipeline: ${tool}`));
    return fn(args) as Promise<unknown>;
  });

  return finalMap;
}

// ============================================================================
// RESPONSE BUILDING
// ============================================================================

/**
 * Truncate large objects for preview (Phase 3: Resource URI Fallback)
 */
function truncateForPreview(data: unknown, maxChars: number): unknown {
  const str = JSON.stringify(data);
  if (str.length <= maxChars) {
    return data;
  }

  // Try to intelligently truncate arrays
  if (Array.isArray(data)) {
    const preview = data.slice(0, 100); // First 100 items
    return {
      _truncated: true,
      _totalItems: data.length,
      _preview: preview,
      _hint: 'Showing first 100 items. Use resourceUri to access full data.',
    };
  }

  // For objects, try to truncate string fields
  if (data && typeof data === 'object') {
    const truncated: Record<string, unknown> = { _truncated: true };
    for (const [key, value] of Object.entries(data)) {
      const valueStr = JSON.stringify(value);
      if (valueStr.length > 200) {
        truncated[key] = `${valueStr.substring(0, 200)}... [truncated]`;
      } else {
        truncated[key] = value;
      }
    }
    return truncated;
  }

  // Last resort: just truncate the string
  return `${str.substring(0, maxChars)}... [truncated]`;
}

type StandardPaginationMeta = {
  hasMore: boolean;
  nextCursor?: string;
  totalCount?: number;
  count?: number;
  offset?: number;
  limit?: number;
};

type StandardCollectionMeta = {
  itemsField: string;
  count: number;
  totalCount?: number;
  hasMore?: boolean;
  nextCursor?: string;
  offset?: number;
  limit?: number;
};

const KNOWN_COLLECTION_FIELDS = [
  'items',
  'permissions',
  'comments',
  'replies',
  'revisions',
  'operations',
  'sheets',
  'templates',
  'charts',
  'valueRanges',
  'results',
  'tools',
  'servers',
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : undefined;
}

function deriveStandardPaginationMeta(
  response: Record<string, unknown>
): StandardPaginationMeta | null {
  const responsePagination = asRecord(response['pagination']);
  const source = responsePagination ?? response;

  const nextCursor =
    asNonEmptyString(source['nextCursor']) ??
    asNonEmptyString(source['next_cursor']) ??
    asNonEmptyString(source['nextPageToken']) ??
    asNonEmptyString(source['next_page_token']);

  const explicitHasMore = source['hasMore'];
  const explicitHasMoreSnake = source['has_more'];
  const hasMore =
    typeof explicitHasMore === 'boolean'
      ? explicitHasMore
      : typeof explicitHasMoreSnake === 'boolean'
        ? explicitHasMoreSnake
        : nextCursor !== undefined;

  if (typeof hasMore !== 'boolean') {
    return null;
  }

  const totalCount =
    asNonNegativeInt(source['totalCount']) ??
    asNonNegativeInt(source['total_count']) ??
    asNonNegativeInt(source['totalRows']) ??
    asNonNegativeInt(source['totalRanges']) ??
    asNonNegativeInt(source['totalSheets']) ??
    asNonNegativeInt(source['totalTemplates']) ??
    asNonNegativeInt(response['totalCount']) ??
    asNonNegativeInt(response['total_count']) ??
    asNonNegativeInt(response['totalRows']) ??
    asNonNegativeInt(response['totalRanges']) ??
    asNonNegativeInt(response['totalSheets']) ??
    asNonNegativeInt(response['totalTemplates']);

  const count =
    asNonNegativeInt(source['count']) ??
    asNonNegativeInt(response['count']) ??
    (Array.isArray(response['items']) ? response['items'].length : undefined) ??
    (Array.isArray(response['valueRanges']) ? response['valueRanges'].length : undefined);

  const offset = asNonNegativeInt(source['offset']) ?? asNonNegativeInt(response['offset']);
  const limit =
    asNonNegativeInt(source['limit']) ??
    asNonNegativeInt(source['pageSize']) ??
    asNonNegativeInt(source['maxResults']) ??
    asNonNegativeInt(response['limit']) ??
    asNonNegativeInt(response['pageSize']) ??
    asNonNegativeInt(response['maxResults']);

  return {
    hasMore,
    ...(nextCursor ? { nextCursor } : {}),
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(count !== undefined ? { count } : {}),
    ...(offset !== undefined ? { offset } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function injectStandardPaginationMeta(response: Record<string, unknown>): void {
  const pagination = deriveStandardPaginationMeta(response);
  if (!pagination) {
    return;
  }

  const existingMeta =
    response['_meta'] && typeof response['_meta'] === 'object'
      ? (response['_meta'] as Record<string, unknown>)
      : {};
  const existingPagination = asRecord(existingMeta['pagination']) ?? {};

  response['_meta'] = {
    ...existingMeta,
    pagination: {
      ...pagination,
      ...existingPagination,
    },
  };

  const existingTopLevelPagination = asRecord(response['pagination']) ?? {};
  response['pagination'] = {
    ...pagination,
    ...existingTopLevelPagination,
  };
}

function deriveStandardCollectionMeta(
  response: Record<string, unknown>
): StandardCollectionMeta | null {
  let itemsField: string | undefined;
  let count: number | undefined;

  for (const field of KNOWN_COLLECTION_FIELDS) {
    const maybeItems = response[field];
    if (Array.isArray(maybeItems)) {
      itemsField = field;
      count = maybeItems.length;
      break;
    }
  }

  if (!itemsField) {
    for (const [key, value] of Object.entries(response)) {
      if (key === 'pagination' || key === '_meta' || key.startsWith('_')) {
        continue;
      }
      if (Array.isArray(value)) {
        itemsField = key;
        count = value.length;
        break;
      }
    }
  }

  if (!itemsField || count === undefined) {
    return null;
  }

  const pagination = asRecord(asRecord(response['_meta'])?.['pagination']);
  const totalCount =
    asNonNegativeInt(pagination?.['totalCount']) ??
    asNonNegativeInt(response['totalCount']) ??
    asNonNegativeInt(response['total_count']) ??
    asNonNegativeInt(response['totalRows']) ??
    asNonNegativeInt(response['totalRanges']) ??
    asNonNegativeInt(response['totalSheets']);

  const hasMore =
    typeof pagination?.['hasMore'] === 'boolean' ? (pagination['hasMore'] as boolean) : undefined;
  const nextCursor = asNonEmptyString(pagination?.['nextCursor']);
  const offset = asNonNegativeInt(pagination?.['offset']);
  const limit = asNonNegativeInt(pagination?.['limit']);

  return {
    itemsField,
    count,
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(hasMore !== undefined ? { hasMore } : {}),
    ...(nextCursor ? { nextCursor } : {}),
    ...(offset !== undefined ? { offset } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function injectStandardCollectionMeta(response: Record<string, unknown>): void {
  const collection = deriveStandardCollectionMeta(response);
  if (!collection) {
    return;
  }

  const existingMeta = asRecord(response['_meta']) ?? {};
  const existingCollection = asRecord(existingMeta['collection']) ?? {};
  response['_meta'] = {
    ...existingMeta,
    collection: {
      ...collection,
      ...existingCollection,
    },
  };
}

/**
 * Validate handler result against tool's output Zod schema.
 * In dev mode: logs detailed warnings. In prod mode: logs concise warnings.
 * Never rejects responses — validation is advisory only.
 *
 * @param toolName - The tool name for schema lookup
 * @param result - The handler result to validate
 * @param outputSchema - The Zod output schema for this tool
 */
function validateOutputSchema(
  toolName: string,
  result: unknown,
  outputSchema: ZodTypeAny | undefined
): void {
  // Skip if disabled or no schema available
  if (process.env['VALIDATE_OUTPUT_SCHEMAS'] === 'false' || !outputSchema) {
    return;
  }

  // Only validate object results (errors and non-objects skip validation)
  if (!result || typeof result !== 'object') {
    return;
  }

  try {
    const parseResult = outputSchema.safeParse(result);
    if (!parseResult.success) {
      const isDev = process.env['NODE_ENV'] !== 'production';
      const issues = parseResult.error.issues;

      if (isDev) {
        // Detailed logging in development
        logger.warn('Output schema validation failed', {
          tool: toolName,
          issueCount: issues.length,
          issues: issues.slice(0, 5).map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
          hint: 'Handler response does not match output schema. Fix the handler or update the schema.',
        });
      } else {
        // Concise logging in production
        logger.debug('Output schema validation mismatch', {
          tool: toolName,
          issueCount: issues.length,
          firstIssue: issues[0] ? `${issues[0].path.join('.')}: ${issues[0].message}` : 'unknown',
        });
      }
    }
  } catch (err) {
    // Validation itself should never crash the response pipeline
    logger.debug('Output schema validation error', {
      tool: toolName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Builds a compliant MCP tool response
 *
 * MCP 2025-11-25 Response Requirements:
 * - content: Array of content blocks (always present)
 * - structuredContent: Typed object matching outputSchema
 * - isError: true for tool errors (LLM can retry), undefined for success
 *
 * @param result - The handler result (should match output schema)
 * @param toolName - Optional tool name for output schema validation
 * @param outputSchema - Optional Zod output schema for validation
 * @returns CallToolResult with content, structuredContent, and optional isError
 */
export function buildToolResponse(
  result: unknown,
  toolName?: string,
  outputSchema?: ZodTypeAny
): CallToolResult {
  // Validate output against schema if available (advisory only, never blocks)
  if (toolName && outputSchema) {
    validateOutputSchema(toolName, result, outputSchema);
  }
  let structuredContent: Record<string, unknown>;

  if (typeof result !== 'object' || result === null) {
    structuredContent = {
      response: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Tool handler returned non-object result',
          retryable: false,
        },
      },
    };
  } else if ('response' in result) {
    structuredContent = result as Record<string, unknown>;
  } else if ('success' in result) {
    structuredContent = { response: result as Record<string, unknown> };
  } else {
    structuredContent = {
      response: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Tool handler returned invalid response shape',
          retryable: false,
        },
      },
    };
  }

  // Strip stack traces and file paths from error responses before MCP serialization (security)
  // ISSUE-193: Prevent leaking internal paths (/home, /Users, node_modules) and stacks
  if ('response' in structuredContent) {
    const resp = structuredContent['response'] as Record<string, unknown>;
    if (resp?.['error'] && typeof resp['error'] === 'object') {
      const err = resp['error'] as Record<string, unknown>;
      if (err['details'] && typeof err['details'] === 'object') {
        const details = err['details'] as Record<string, unknown>;
        delete details['stack'];
        // Redact values containing internal filesystem paths
        const pathPattern = /\/home\/|\/Users\/|node_modules\//;
        for (const key of Object.keys(details)) {
          if (typeof details[key] === 'string' && pathPattern.test(details[key] as string)) {
            details[key] = '[REDACTED_PATH]';
          }
        }
      }
      delete err['stackTrace'];
    }
  }

  // Track request for quota prediction
  const sessionContext = getSessionContext();
  sessionContext.trackRequest();

  // Add request correlation ID for tracing (if available)
  const requestContext = getRequestContext();
  if ('response' in structuredContent) {
    const resp = structuredContent['response'] as Record<string, unknown>;
    if (resp && typeof resp === 'object') {
      if (requestContext) {
        // Inject correlation metadata at structuredContent._meta (not inside response),
        // keeping response clean and conformant with the tool's declared outputSchema.
        // MCP 2025-11-25: _meta is a protocol-level reserved key on result objects.
        const scMeta = (
          typeof structuredContent['_meta'] === 'object' && structuredContent['_meta'] !== null
            ? structuredContent['_meta']
            : {}
        ) as Record<string, unknown>;
        const quotaStatus = getConcurrencyCoordinator().getQuotaStatus();
        structuredContent['_meta'] = {
          ...scMeta,
          requestId: requestContext.requestId,
          ...(requestContext.traceId && { traceId: requestContext.traceId }),
          ...(requestContext.spanId && { spanId: requestContext.spanId }),
          quotaStatus: {
            used: quotaStatus.used,
            limit: quotaStatus.limit,
            utilization: Math.round(quotaStatus.utilization * 100) / 100,
            windowRemainingMs: quotaStatus.windowRemainingMs,
          },
        };
      }

      // Standardize pagination envelope so clients can rely on one location.
      injectStandardPaginationMeta(resp);
      // Standardize collection/list metadata for list-style responses.
      injectStandardCollectionMeta(resp);
    }
  }

  // Apply response compaction if enabled (reduces context window pressure)
  if (isCompactModeEnabled()) {
    structuredContent = compactResponse(structuredContent);
  }

  const response = structuredContent['response'];
  const responseSuccess =
    response && typeof response === 'object'
      ? (response as { success?: boolean }).success
      : undefined;
  const responseErrorCode =
    response && typeof response === 'object'
      ? (response as { error?: { code?: unknown } }).error?.code
      : undefined;
  const errorCodeCompatibility = getErrorCodeCompatibility(responseErrorCode);

  // Detect errors from success: false in response (or legacy top-level success)
  const hasFailure = responseSuccess === false || structuredContent['success'] === false;
  const treatAsNonFatal =
    hasFailure &&
    process.env['MCP_NON_FATAL_TOOL_ERRORS'] !== 'false' &&
    typeof responseErrorCode === 'string' &&
    NON_FATAL_TOOL_ERROR_CODES.has(responseErrorCode);
  const isError = hasFailure && !treatAsNonFatal;

  if (treatAsNonFatal) {
    // Inject at structuredContent._meta level (not inside response) per MCP 2025-11-25
    const scMeta = (
      typeof structuredContent['_meta'] === 'object' && structuredContent['_meta'] !== null
        ? structuredContent['_meta']
        : {}
    ) as Record<string, unknown>;
    structuredContent['_meta'] = {
      ...scMeta,
      nonFatalError: true,
      nonFatalReason: `error_code:${responseErrorCode}`,
    };
  }

  if (hasFailure && response && typeof response === 'object' && errorCodeCompatibility) {
    recordErrorCodeCompatibility({
      reportedCode: errorCodeCompatibility.reportedCode,
      canonicalCode: errorCodeCompatibility.canonicalCode,
      family: errorCodeCompatibility.family,
      isAlias: errorCodeCompatibility.isAlias,
      isKnown: errorCodeCompatibility.isKnown,
    });

    // Inject error code compat metadata at structuredContent._meta (not inside response)
    const scMeta = (
      typeof structuredContent['_meta'] === 'object' && structuredContent['_meta'] !== null
        ? structuredContent['_meta']
        : {}
    ) as Record<string, unknown>;
    structuredContent['_meta'] = {
      ...scMeta,
      errorCode: scMeta['errorCode'] ?? errorCodeCompatibility.reportedCode,
      errorCodeCanonical: scMeta['errorCodeCanonical'] ?? errorCodeCompatibility.canonicalCode,
      errorCodeFamily: scMeta['errorCodeFamily'] ?? errorCodeCompatibility.family,
      ...(errorCodeCompatibility.isAlias && typeof scMeta['errorCodeIsAlias'] !== 'boolean'
        ? { errorCodeIsAlias: true }
        : {}),
    };
  }

  // Phase 1B.1: Inject suggestedFix for error responses
  if (hasFailure && 'response' in structuredContent && response && typeof response === 'object') {
    try {
      const responseRecord = response as Record<string, unknown>;
      const err = responseRecord['error'] as Record<string, unknown> | undefined;
      if (err && typeof err === 'object') {
        const errorCode = (err['code'] as string | undefined) || '';
        const errorMessage = (err['message'] as string | undefined) || '';
        // Extract tool/action context from the request if available
        const fix = suggestFix(errorCode, errorMessage, toolName, undefined, undefined);
        if (fix) {
          err['suggestedFix'] = fix;
        }
      }
    } catch (err) {
      // Non-blocking: if suggestion fails, continue without it
      logger.debug('suggestFix threw, continuing without fix injection', { error: err });
    }
  }

  // Phase 1B.2: Inject suggestedNextActions for successful responses
  if (
    !hasFailure &&
    'response' in structuredContent &&
    response &&
    typeof response === 'object' &&
    toolName
  ) {
    try {
      const responseRecord = response as Record<string, unknown>;
      const actionName = responseRecord['action'] as string | undefined;
      if (actionName) {
        const recommendations = getRecommendedActions(toolName, actionName);
        if (recommendations.length > 0) {
          responseRecord['suggestedNextActions'] = recommendations.slice(0, 3);
        }
      }
    } catch (err) {
      // Non-blocking: if recommendations fail, continue without them
      logger.debug('getRecommendedActions threw, continuing without actions injection', {
        error: err,
      });
    }
  }

  // Phase 1B.3: Inject dataQualityWarnings for sheets_data read/write actions
  const DATA_QUALITY_ACTIONS = new Set(['read', 'write', 'append', 'batch_read', 'batch_write']);
  if (
    !hasFailure &&
    'response' in structuredContent &&
    response &&
    typeof response === 'object' &&
    toolName === 'sheets_data'
  ) {
    try {
      const responseRecord = response as Record<string, unknown>;
      const actionName = responseRecord['action'] as string | undefined;
      if (actionName && DATA_QUALITY_ACTIONS.has(actionName)) {
        // Extract values — may be at response.values or response.data.values
        let responseValues: unknown = responseRecord['values'];
        if (
          !responseValues &&
          typeof responseRecord['data'] === 'object' &&
          responseRecord['data']
        ) {
          responseValues = (responseRecord['data'] as Record<string, unknown>)['values'];
        }
        if (
          Array.isArray(responseValues) &&
          responseValues.length >= 2 &&
          Array.isArray(responseValues[0]) &&
          (responseValues[0] as unknown[]).length >= 2
        ) {
          void scanResponseQuality(responseValues as (string | number | boolean | null)[][], {
            tool: toolName,
            action: actionName,
            range: String(responseRecord['range'] ?? ''),
          })
            .then((warnings) => {
              if (warnings.length > 0) {
                responseRecord['dataQualityWarnings'] = warnings;
              }
            })
            .catch(() => {
              // Non-blocking: quality scan failure must never fail the response
            });
        }
      }
    } catch {
      // Non-blocking: quality scan failure must never fail the response
    }
  }

  // Phase 1B.4: Inject CoT _hints on sheets_data read responses (sync, zero API calls)
  const HINTS_ACTIONS = new Set(['read', 'batch_read', 'cross_read']);
  if (
    !hasFailure &&
    'response' in structuredContent &&
    response &&
    typeof response === 'object' &&
    toolName === 'sheets_data'
  ) {
    try {
      const responseRecord = response as Record<string, unknown>;
      const actionName = responseRecord['action'] as string | undefined;
      if (actionName && HINTS_ACTIONS.has(actionName)) {
        // Extract values — may be at response.values or response.data.values
        let responseValues: unknown = responseRecord['values'];
        if (
          !responseValues &&
          typeof responseRecord['data'] === 'object' &&
          responseRecord['data']
        ) {
          responseValues = (responseRecord['data'] as Record<string, unknown>)['values'];
        }
        if (
          Array.isArray(responseValues) &&
          responseValues.length >= 2 &&
          Array.isArray(responseValues[0]) &&
          (responseValues[0] as unknown[]).length >= 1
        ) {
          const hints = generateResponseHints(
            responseValues as (string | number | boolean | null)[][]
          );
          if (hints) {
            responseRecord['_hints'] = hints;
          }
        }
      }
    } catch {
      // Non-blocking: hints injection failure must never fail the response
    }
  }

  // P1-3: Response size validation to prevent MCP protocol issues
  // Limit responses to 10MB to avoid overwhelming MCP clients
  const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB
  // Approximate token budget: ~25,000 tokens ≈ ~100KB of JSON text
  // Anthropic MCP Marketplace recommends ≤25K tokens per tool result
  const MAX_RESPONSE_TOKENS_BYTES = parseInt(process.env['MCP_MAX_RESPONSE_BYTES'] || '100000', 10); // ~25K tokens
  // Use compact JSON for large responses (>50KB) to reduce payload by 10-20%
  const COMPACT_THRESHOLD = 50 * 1024; // 50KB
  const compactStr = JSON.stringify(structuredContent);
  const sizeBytes = Buffer.byteLength(compactStr, 'utf8');
  const rawResponseStr =
    sizeBytes > COMPACT_THRESHOLD ? compactStr : JSON.stringify(structuredContent, null, 2);
  // Redact sensitive data (tokens, API keys, emails) from STDIO and HTTP text content
  const responseStr = redactSensitiveData(rawResponseStr).output;

  // Token budget enforcement: truncate responses exceeding ~25K tokens
  // This prevents overwhelming LLM context windows in MCP clients like Claude
  if (sizeBytes > MAX_RESPONSE_TOKENS_BYTES && sizeBytes <= MAX_RESPONSE_SIZE) {
    // Store full data as temporary resource and return a truncated preview
    const store = getTemporaryResourceStore();
    const resourceUri = store.store(structuredContent, 1800); // 30 min TTL
    const preview = truncateForPreview(structuredContent, 2000);
    const continuationHint = `resources/read uri="${resourceUri}"`;

    const budgetContent: Record<string, unknown> = {
      response: {
        success: true,
        resourceUri,
        preview,
        message: `Response size ${(sizeBytes / 1024).toFixed(0)}KB exceeds token budget (~25K tokens). Full data stored as temporary resource.`,
        _hint: `Full data available via: ${continuationHint} (expires in 30 minutes)`,
        details: {
          sizeBytes,
          maxTokenBytes: MAX_RESPONSE_TOKENS_BYTES,
          expiresIn: '30 minutes',
        },
        _meta: {
          truncated: true,
          originalSizeBytes: sizeBytes,
          retrievalUri: resourceUri,
          continuationHint,
        },
      },
    };
    const budgetResponse = budgetContent['response'] as Record<string, unknown>;
    const budgetMeta = budgetResponse['_meta'] as Record<string, unknown>;
    budgetMeta['deliveredSizeBytes'] = Buffer.byteLength(JSON.stringify(budgetContent), 'utf8');

    return {
      content: [{ type: 'text', text: JSON.stringify(budgetContent, null, 2) }],
      structuredContent: budgetContent,
      isError: undefined,
    };
  }

  if (sizeBytes > MAX_RESPONSE_SIZE) {
    // Phase 3: Store as temporary resource instead of failing (edge case: <0.1% of requests)
    const store = getTemporaryResourceStore();
    const resourceUri = store.store(structuredContent, 1800); // 30 min TTL

    // Create preview (first 100 rows or 1000 chars)
    const preview = truncateForPreview(structuredContent, 1000);
    const continuationHint = `resources/read uri="${resourceUri}"`;

    const fallbackContent: Record<string, unknown> = {
      response: {
        success: true,
        resourceUri,
        preview,
        message: `Response size ${(sizeBytes / 1024 / 1024).toFixed(2)}MB exceeds transport limit. Stored as temporary resource.`,
        _hint: `Full data available via: ${continuationHint} (expires in 30 minutes)`,
        details: {
          sizeBytes,
          maxSizeBytes: MAX_RESPONSE_SIZE,
          expiresIn: '30 minutes',
        },
        _meta: {
          truncated: true,
          originalSizeBytes: sizeBytes,
          retrievalUri: resourceUri,
          continuationHint,
        },
      },
    };
    const fallbackResponse = fallbackContent['response'] as Record<string, unknown>;
    const fallbackMeta = fallbackResponse['_meta'] as Record<string, unknown>;
    fallbackMeta['deliveredSizeBytes'] = Buffer.byteLength(JSON.stringify(fallbackContent), 'utf8');

    return {
      content: [{ type: 'text', text: JSON.stringify(fallbackContent, null, 2) }],
      structuredContent: fallbackContent,
      isError: undefined,
    };
  }

  return {
    // Human-readable content for display
    content: [
      {
        type: 'text',
        text: responseStr,
        // MCP 2025-11-25: audience annotations guide client rendering
        annotations: {
          audience: isError ? (['user', 'assistant'] as const) : (['assistant'] as const),
        },
      },
    ],
    // Typed structured content for programmatic access
    structuredContent,
    // Error flag - only set when true, undefined otherwise (MCP convention)
    isError: isError ? true : undefined,
  };
}

// ============================================================================
// HISTORY RECORDING HELPERS
// ============================================================================
// Note: Extraction helpers moved to extraction-helpers.ts for reusability

// ============================================================================
// TOOL CALL HANDLER
// ============================================================================

export { normalizeToolArgs } from './tool-arg-normalization.js';

function createToolCallHandler(
  tool: ToolDefinition,
  handlerMap: Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> | null,
  googleClient: GoogleApiClient | null,
  requestQueue: PQueue,
  registrationState: LegacyToolRegistrationState
): (
  args: Record<string, unknown>,
  extra?: {
    requestId?: string | number;
    elicit?: unknown;
    sample?: unknown;
    sendNotification?: (
      notification: import('@modelcontextprotocol/sdk/types.js').ServerNotification
    ) => Promise<void>;
    sendRequest?: RelatedRequestSender;
    taskId?: string;
    taskStore?: TaskStatusUpdater;
    abortSignal?: AbortSignal;
    signal?: AbortSignal;
    progressToken?: string | number;
    requestInfo?: Pick<RequestInfo, 'headers'>;
    _meta?: { progressToken?: string | number };
  }
) => Promise<CallToolResult> {
  return async (
    args: Record<string, unknown>,
    extra?: {
      requestId?: string | number;
      elicit?: unknown;
      sample?: unknown;
      sendNotification?: (
        notification: import('@modelcontextprotocol/sdk/types.js').ServerNotification
      ) => Promise<void>;
      sendRequest?: RelatedRequestSender;
      taskId?: string;
      taskStore?: TaskStatusUpdater;
      abortSignal?: AbortSignal;
      signal?: AbortSignal;
      progressToken?: string | number;
      requestInfo?: Pick<RequestInfo, 'headers'>;
      _meta?: { progressToken?: string | number };
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
      requestHeaders?: Record<string, string | string[] | undefined>;
    }
  ) => {
    const parentRequestContext = getRequestContext();
    const requestId =
      extra?.requestId !== undefined ? String(extra.requestId) : parentRequestContext?.requestId;
    const requestHeaders =
      extra?.requestHeaders ?? normalizeRequestHeaders(extra?.requestInfo?.headers);
    const progressToken = extra?._meta?.progressToken ?? extra?.progressToken;
    const requestAbortSignal = mergeAbortSignals(
      extra?.abortSignal ?? extra?.signal,
      registrationState.abortController.signal
    );

    // Extract trace context from extra params or headers (W3C Trace Context support)
    const traceId =
      extra?.traceId ||
      getHeaderValue(requestHeaders?.['x-trace-id']) ||
      parentRequestContext?.traceId;
    const spanId =
      extra?.spanId ||
      getHeaderValue(requestHeaders?.['x-span-id']) ||
      parentRequestContext?.spanId;
    const parentSpanId =
      extra?.parentSpanId ||
      getHeaderValue(requestHeaders?.['x-parent-span-id']) ||
      parentRequestContext?.parentSpanId;
    const principalId =
      getHeaderValue(requestHeaders?.['x-user-id']) ||
      getHeaderValue(requestHeaders?.['x-session-id']) ||
      getHeaderValue(requestHeaders?.['x-client-id']) ||
      parentRequestContext?.principalId;

    const requestContext = createRequestContext({
      requestId,
      traceId,
      spanId,
      parentSpanId,
      principalId,
      abortSignal: requestAbortSignal,
      sendNotification: extra?.sendNotification,
      sendRequest: extra?.sendRequest,
      taskId: extra?.taskId,
      taskStore: extra?.taskStore,
      progressToken,
      idempotencyKey: requestHeaders
        ? extractIdempotencyKeyFromHeaders(requestHeaders)
        : parentRequestContext?.idempotencyKey,
    });
    const costTrackingTenantId = resolveCostTrackingTenantId({
      headers: requestHeaders,
    });

    // Generate operation ID and start time for history tracking
    const operationId = randomUUID();
    const startTime = Date.now();
    const timestamp = new Date(startTime).toISOString();

    if (registrationState.disposed) {
      return buildToolResponse({
        response: {
          success: false,
          error: {
            code: 'OPERATION_CANCELLED',
            message: 'MCP session closed',
            retryable: false,
          },
        },
      });
    }

    updateQueueMetrics(requestQueue.size, requestQueue.pending);

    return requestQueue.add(async () => {
      if (requestAbortSignal?.aborted) {
        throw createRequestAbortError(requestAbortSignal.reason, 'MCP session closed');
      }

      return runWithRequestContext(requestContext, async () => {
        requestContext.logger.debug('Tool call queued', {
          toolName: tool.name,
          queueSize: requestQueue.size,
          pendingCount: requestQueue.pending,
          traceId: requestContext.traceId,
          spanId: requestContext.spanId,
        });

        if (requestContext.abortSignal?.aborted) {
          throw createRequestAbortError(requestContext.abortSignal.reason);
        }

        recordSpreadsheetId(args);
        const rawArgs = args as Record<string, unknown>;
        const rawAction = ((rawArgs['request'] as Record<string, unknown> | undefined)?.[
          'action'
        ] ?? rawArgs['action']) as string | undefined;
        const isExempt = isToolCallAuthExempt(tool.name, rawAction);

        if (!isExempt) {
          const authResult = await checkAuthAsync(googleClient);
          if (!authResult.authenticated) {
            return buildToolResponse(buildAuthErrorResponse(authResult.error!));
          }
        }

        if (!handlerMap) {
          if (isExempt) {
            const preInitResult = await handlePreInitExemptToolCall(tool.name, rawArgs);
            if (preInitResult) {
              return buildToolResponse(preInitResult as Record<string, unknown>);
            }
          }

          const errorResponse = {
            response: {
              success: false,
              error: {
                code: 'AUTHENTICATION_REQUIRED',
                message: 'Google API client not initialized. Please provide credentials.',
                retryable: false,
                suggestedFix: 'Set GOOGLE_APPLICATION_CREDENTIALS or configure OAuth',
              },
            },
          };

          // Record failed operation in history
          const historyService = getHistoryService();
          historyService.record({
            id: operationId,
            timestamp,
            tool: tool.name,
            action: extractAction(args),
            params: args,
            result: 'error',
            duration: Date.now() - startTime,
            errorMessage: 'Google API client not initialized. Please provide credentials.',
            errorCode: 'AUTHENTICATION_REQUIRED',
            requestId,
            spreadsheetId: extractSpreadsheetId(args),
          });

          return buildToolResponse(errorResponse);
        }

        const handler = handlerMap[tool.name];
        if (!handler) {
          if (isExempt) {
            const preInitResult = await handlePreInitExemptToolCall(tool.name, rawArgs);
            if (preInitResult) {
              return buildToolResponse(preInitResult as Record<string, unknown>);
            }
          }

          const errorResponse = {
            response: {
              success: false,
              error: {
                code: 'NOT_IMPLEMENTED',
                message: `Handler for ${tool.name} not yet implemented`,
                retryable: false,
                suggestedFix: 'This tool is planned for a future release',
              },
            },
          };

          // Record failed operation in history
          const historyService = getHistoryService();
          historyService.record({
            id: operationId,
            timestamp,
            tool: tool.name,
            action: extractAction(args),
            params: args,
            result: 'error',
            duration: Date.now() - startTime,
            errorMessage: `Handler for ${tool.name} not yet implemented`,
            errorCode: 'NOT_IMPLEMENTED',
            requestId,
            spreadsheetId: extractSpreadsheetId(args),
          });

          return buildToolResponse(errorResponse);
        }

        const keepalive = startKeepalive({
          operationName: tool.name,
          debug: process.env['DEBUG_KEEPALIVE'] === 'true',
        });

        try {
          const localParentSpanId = requestContext.spanId;
          const remoteParentSpanId = requestContext.parentSpanId;
          const toolSpanParent =
            requestContext.traceId && requestContext.spanId
              ? {
                  traceId: requestContext.traceId,
                  spanId: requestContext.spanId,
                  traceFlags: 1,
                }
              : undefined;

          // Execute handler with distributed tracing
          const result = await withToolSpan(
            tool.name,
            async (span) => {
              const previousTraceId = requestContext.traceId;
              const previousSpanId = requestContext.spanId;
              const previousParentSpanId = requestContext.parentSpanId;

              // Propagate active tool span for downstream API traceparent headers.
              requestContext.traceId = span.context.traceId;
              requestContext.spanId = span.context.spanId;
              requestContext.parentSpanId = span.parentSpanId ?? previousParentSpanId;

              // Add span attributes for observability
              const action = extractAction(args);
              const spreadsheetId = extractSpreadsheetId(args);
              const sheetId = extractSheetId(args);

              span.setAttributes({
                'tool.name': tool.name,
                'tool.action': action,
                'operation.id': operationId,
                'request.id': requestId || 'unknown',
                ...(localParentSpanId && { 'trace.local_parent_span_id': localParentSpanId }),
                ...(remoteParentSpanId && { 'trace.remote_parent_span_id': remoteParentSpanId }),
                ...(spreadsheetId && { 'spreadsheet.id': spreadsheetId }),
                ...(sheetId && { 'sheet.id': sheetId.toString() }),
              });

              // ISSUE-107: Detect legacy invocation patterns before normalizing
              const legacyWarning = detectLegacyInvocation(args);
              if (legacyWarning) {
                logger.debug('Legacy MCP invocation pattern detected', {
                  tool: tool.name,
                  warning: legacyWarning,
                  requestId,
                });
              }

              try {
                // Per-user rate limiting (token bucket, configured via RATE_LIMIT_*)
                const principalId = requestContext.principalId ?? 'anonymous';
                const rateCheck = checkRateLimit(principalId);
                if (!rateCheck.allowed) {
                  return {
                    response: {
                      success: false,
                      error: {
                        code: 'RATE_LIMITED',
                        message: `Rate limit exceeded. Retry after ${rateCheck.retryAfterMs}ms.`,
                        retryable: true,
                        retryAfterMs: rateCheck.retryAfterMs,
                      },
                    },
                  };
                }

                // Execute handler - pass extra context for MCP-native tools
                // Write lock: serialize mutations per spreadsheetId (reads bypass)
                const normalizedArgs = normalizeToolArgs(args);
                const mutationSafetyViolation = detectMutationSafetyViolation(normalizedArgs);
                if (mutationSafetyViolation) {
                  return {
                    response: {
                      success: false,
                      error: {
                        code: 'FORMULA_INJECTION_BLOCKED',
                        message:
                          `Dangerous formula detected at ${mutationSafetyViolation.path}: ` +
                          `${mutationSafetyViolation.preview}. ` +
                          'Set safety.sanitizeFormulas=false to allow.',
                        retryable: false,
                        suggestedFix:
                          'Remove formulas containing IMPORTDATA, IMPORTRANGE, IMPORTFEED, IMPORTHTML, IMPORTXML, GOOGLEFINANCE, or QUERY from mutation payloads.',
                      },
                    },
                  };
                }
                const handlerResult = await withWriteLock(normalizedArgs, () =>
                  handler(normalizedArgs, extra)
                );

                // ISSUE-107: Inject protocol version (always) + deprecation warning (if legacy)
                if (
                  handlerResult &&
                  typeof handlerResult === 'object' &&
                  'response' in handlerResult &&
                  handlerResult.response &&
                  typeof handlerResult.response === 'object'
                ) {
                  const response = handlerResult.response as Record<string, unknown>;
                  const existingMeta =
                    response['_meta'] && typeof response['_meta'] === 'object'
                      ? (response['_meta'] as Record<string, unknown>)
                      : {};
                  response['_meta'] = {
                    ...existingMeta,
                    protocolVersion: '2025-11-25',
                    ...(legacyWarning ? { deprecationWarning: legacyWarning } : {}),
                  };
                }

                // Add result attributes to span
                span.setAttributes({
                  'result.success': isSuccessResult(handlerResult),
                  'cells.affected': extractCellsAffected(handlerResult) || 0,
                });

                return handlerResult;
              } finally {
                requestContext.traceId = previousTraceId;
                requestContext.spanId = previousSpanId;
                requestContext.parentSpanId = previousParentSpanId;
              }
            },
            {
              'mcp.protocol.version': '2025-11-25',
              'service.name': 'servalsheets',
            },
            toolSpanParent
          );

          const duration = Date.now() - startTime;
          const spreadsheetId = extractSpreadsheetId(args);
          const action = extractAction(args);
          const status = isSuccessResult(result) ? 'success' : 'error';
          const principalId = requestContext.principalId ?? 'anonymous';
          const nowMs = Date.now();
          pruneSelfCorrectionFailures(nowMs);
          const correctionKey = buildSelfCorrectionKey(tool.name, principalId);

          // Record operation in history
          const historyService = getHistoryService();
          const operation: OperationHistory = {
            id: operationId,
            timestamp,
            tool: tool.name,
            action,
            params: args,
            result: status,
            duration,
            cellsAffected: extractCellsAffected(result),
            snapshotId: extractSnapshotId(result),
            errorMessage: extractErrorMessage(result),
            errorCode: extractErrorCode(result),
            requestId,
            spreadsheetId,
            sheetId: extractSheetId(args),
          };

          historyService.record(operation);

          // Record metrics for observability
          const durationSeconds = duration / 1000;
          recordToolCall(tool.name, action, status, durationSeconds);
          recordToolCallLatency(tool.name, action, durationSeconds);
          if (status === 'error') {
            recentFailuresByPrincipal.set(correctionKey, { action, timestampMs: nowMs });
          } else {
            const priorFailure = recentFailuresByPrincipal.get(correctionKey);
            if (priorFailure && nowMs - priorFailure.timestampMs <= SELF_CORRECTION_WINDOW_MS) {
              recordSelfCorrection(tool.name, priorFailure.action, action);
              recentFailuresByPrincipal.delete(correctionKey);
            }
          }

          // Record trace for debugging/performance analysis
          const traceAggregator = getTraceAggregator();
          if (traceAggregator.isEnabled()) {
            // Collect spans from the tracer for this request
            const { getTracer } = await import('../../utils/tracing.js');
            const tracer = getTracer();
            const recordedSpans = tracer.getSpans();

            // Convert Span objects to TraceSpan format
            const { TraceAggregatorImpl } = await import('../../services/trace-aggregator.js');
            const convertedSpans = recordedSpans.map((span) =>
              TraceAggregatorImpl.spanToTraceSpan(span)
            );

            traceAggregator.recordTrace({
              requestId: requestId || operationId,
              traceId: traceId || operationId,
              timestamp: startTime,
              duration,
              tool: tool.name,
              action,
              success: status === 'success',
              errorCode: extractErrorCode(result) ?? undefined,
              errorMessage: extractErrorMessage(result) ?? undefined,
              spans: convertedSpans,
            });
          }

          // Track cost per tenant (opt-in via ENABLE_COST_TRACKING)
          const envConfig = getEnv();
          if (envConfig.ENABLE_COST_TRACKING || envConfig.ENABLE_BILLING_INTEGRATION) {
            try {
              // COST-01: Disaggregate API type by tool (bigquery/drive/sheets)
              const apiType =
                tool.name === 'sheets_bigquery'
                  ? 'bigquery'
                  : tool.name === 'sheets_collaborate' || tool.name === 'sheets_history'
                    ? 'drive'
                    : 'sheets';
              getCostTracker().trackApiCall(costTrackingTenantId, apiType);

              // COST-01: Track feature-level usage (rows, transactions)
              if (status === 'success') {
                const resp = (result as Record<string, unknown>)?.['response'] as
                  | Record<string, unknown>
                  | undefined;
                if (resp) {
                  const rowsProcessed =
                    (typeof resp['rowCount'] === 'number' ? resp['rowCount'] : undefined) ??
                    (typeof resp['updatedRows'] === 'number' ? resp['updatedRows'] : undefined);
                  if (typeof rowsProcessed === 'number' && rowsProcessed > 0) {
                    getCostTracker().trackFeatureUsage(
                      costTrackingTenantId,
                      'rowsProcessed',
                      rowsProcessed
                    );
                  }
                  if (tool.name === 'sheets_transaction' && action === 'commit') {
                    getCostTracker().trackFeatureUsage(
                      costTrackingTenantId,
                      'transactionsExecuted'
                    );
                  }
                }
              }
            } catch {
              // Cost tracking is non-critical — never block tool execution
            }
          }

          // Audit logging for compliance (opt-in via ENABLE_AUDIT_LOGGING)
          if (envConfig.ENABLE_AUDIT_LOGGING) {
            try {
              void getAuditLogger().logToolCall({
                tool: tool.name,
                action,
                userId: requestId || 'anonymous',
                spreadsheetId: spreadsheetId || undefined,
                outcome: status === 'success' ? 'success' : 'failure',
                duration,
              });
            } catch {
              // Audit logging is non-critical — never block tool execution
            }
          }

          // Invalidate sampling context cache after successful mutating operations.
          if (
            status === 'success' &&
            spreadsheetId &&
            shouldInvalidateSamplingContext(tool.name, action)
          ) {
            try {
              invalidateSamplingContext(spreadsheetId);
            } catch (error) {
              logger.debug('Sampling context invalidation skipped', {
                tool: tool.name,
                action,
                spreadsheetId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          return buildToolResponse(result, tool.name, tool.outputSchema);
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorCodeFromThrown =
            typeof (error as { code?: unknown } | null)?.code === 'string'
              ? String((error as { code?: unknown }).code)
              : undefined;

          let errorCode = errorCodeFromThrown ?? 'INTERNAL_ERROR';
          const errorPayload: Record<string, unknown> = {
            code: errorCode,
            message: errorMessage,
            retryable: false,
          };

          if (error instanceof z.ZodError) {
            const validationError = createZodValidationError(
              error.issues.map((issue) => ({
                code: getIssueCode(issue),
                path: normalizeIssuePath(issue.path),
                message: issue.message,
                options: Array.isArray((issue as { options?: unknown }).options)
                  ? ((issue as { options?: unknown[] }).options ?? [])
                  : undefined,
                expected:
                  typeof (issue as { expected?: unknown }).expected === 'string'
                    ? String((issue as { expected?: unknown }).expected)
                    : undefined,
                received:
                  typeof (issue as { received?: unknown }).received === 'string'
                    ? String((issue as { received?: unknown }).received)
                    : undefined,
              })),
              tool.name
            );

            errorCode = validationError.code;
            errorPayload['code'] = validationError.code;
            errorPayload['message'] = validationError.message;
            errorPayload['retryable'] = validationError.retryable;
            if (validationError.category) {
              errorPayload['category'] = validationError.category;
            }
            if (validationError.severity) {
              errorPayload['severity'] = validationError.severity;
            }
            if (validationError.resolution) {
              errorPayload['resolution'] = validationError.resolution;
            }
            if (validationError.resolutionSteps) {
              errorPayload['resolutionSteps'] = validationError.resolutionSteps;
            }
          }

          // Record failed operation in history
          const historyService = getHistoryService();
          historyService.record({
            id: operationId,
            timestamp,
            tool: tool.name,
            action: extractAction(args),
            params: args,
            result: 'error',
            duration,
            errorMessage,
            errorCode,
            requestId,
            spreadsheetId: extractSpreadsheetId(args),
          });

          // Record error metrics
          const action = extractAction(args);
          recordToolCall(tool.name, action, 'error', duration / 1000);
          recordError(error instanceof Error ? error.name : 'UnknownError', tool.name, action);
          const principalId = requestContext.principalId ?? 'anonymous';
          pruneSelfCorrectionFailures(Date.now());
          const correctionKey = buildSelfCorrectionKey(tool.name, principalId);
          recentFailuresByPrincipal.set(correctionKey, { action, timestampMs: Date.now() });

          // Record error trace for debugging
          const traceAggregator = getTraceAggregator();
          if (traceAggregator.isEnabled()) {
            // Collect spans from the tracer for error cases too
            const { getTracer } = await import('../../utils/tracing.js');
            const tracer = getTracer();
            const recordedSpans = tracer.getSpans();

            // Convert Span objects to TraceSpan format
            const { TraceAggregatorImpl } = await import('../../services/trace-aggregator.js');
            const convertedSpans = recordedSpans.map((span) =>
              TraceAggregatorImpl.spanToTraceSpan(span)
            );

            traceAggregator.recordTrace({
              requestId: requestId || operationId,
              traceId: traceId || operationId,
              timestamp: startTime,
              duration,
              tool: tool.name,
              action,
              success: false,
              errorCode,
              errorMessage,
              spans: convertedSpans,
            });
          }

          if (isGoogleAuthError(error)) {
            return buildToolResponse(convertGoogleAuthError(error));
          }

          // Return structured error instead of throwing (Task 1.2)
          // buildToolResponse classifies recoverable error codes as non-fatal MCP results.
          const errorResponse = {
            response: {
              success: false,
              error: errorPayload,
            },
          };

          return buildToolResponse(errorResponse);
        } finally {
          keepalive.stop();
        }
      });
    });
  };
}

export function createToolTaskHandler(
  toolName: string,
  runTool: (
    args: Record<string, unknown>,
    extra?:
      | (Record<string, unknown> & {
          requestId?: string | number;
          abortSignal?: AbortSignal;
          signal?: AbortSignal;
        })
      | undefined
  ) => Promise<CallToolResult>
): ToolTaskHandler<AnySchema> {
  const buildCancelledTaskResult = (message: string): CallToolResult =>
    buildToolResponse({
      response: {
        success: false,
        error: {
          code: 'TASK_CANCELLED',
          message,
          retryable: false,
        },
      },
    });

  return {
    createTask: async (args, extra) => {
      if (!extra.taskStore) {
        throw new Error(`[${toolName}] Task store not configured`);
      }

      const task = await extra.taskStore.createTask({
        ttl: extra.taskRequestedTtl ?? undefined,
      });

      const taskStore = extra.taskStore as unknown as RegisteredTaskStore;
      const { abortControllers, watchdogTimers } = ensureTaskCancellationControlPlane(taskStore);
      const abortController = new AbortController();
      abortControllers.set(task.taskId, abortController);

      const TASK_WATCHDOG_MS = getEnv().TASK_WATCHDOG_MS;
      const watchdogTimer = setTimeout(() => {
        if (abortControllers.has(task.taskId)) {
          logger.warn('Task watchdog: aborting hung task', {
            taskId: task.taskId,
            toolName,
            maxLifetimeMs: TASK_WATCHDOG_MS,
          });
          abortController.abort(
            `Task exceeded maximum runtime of ${(TASK_WATCHDOG_MS / 60000).toFixed(1)} minutes`
          );
          abortControllers.delete(task.taskId);
          watchdogTimers.delete(task.taskId);
        }
      }, TASK_WATCHDOG_MS);
      watchdogTimers.set(task.taskId, watchdogTimer);

      const isTaskStoreCancelled = async (): Promise<boolean> => {
        if (!('isTaskCancelled' in taskStore) || typeof taskStore.isTaskCancelled !== 'function') {
          return false;
        }
        return await taskStore.isTaskCancelled(task.taskId);
      };
      const getCancellationReason = async (): Promise<string> => {
        if (
          'getCancellationReason' in taskStore &&
          typeof taskStore.getCancellationReason === 'function'
        ) {
          return (await taskStore.getCancellationReason(task.taskId)) || 'Task was cancelled';
        }
        return 'Task was cancelled';
      };
      const storeCancelledTaskResult = async (message: string): Promise<void> => {
        // C11: SDK storeTaskResult only accepts 'completed'|'failed'; use 'failed' for
        // cancelled tasks (the task store preserves cancelled status and the payload carries TASK_CANCELLED).
        await taskStore.storeTaskResult(task.taskId, 'failed', buildCancelledTaskResult(message));
      };

      void (async () => {
        try {
          if (await isTaskStoreCancelled()) {
            await storeCancelledTaskResult(await getCancellationReason());
            return;
          }

          const result = await runTool(args as Record<string, unknown>, {
            ...(extra as unknown as Record<string, unknown>),
            taskId: task.taskId,
            taskStore,
            abortSignal: abortController.signal,
            signal: abortController.signal,
          });

          if (await isTaskStoreCancelled()) {
            await storeCancelledTaskResult(await getCancellationReason());
            return;
          }

          await taskStore.storeTaskResult(task.taskId, 'completed', result);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            try {
              await storeCancelledTaskResult(error.message);
            } catch (storeError) {
              // Use structured logging to avoid corrupting stdio transport
              import('../../utils/logger.js')
                .then(({ logger }) => {
                  logger.error('Failed to store cancelled task result', {
                    toolName,
                    error: storeError,
                  });
                })
                .catch(() => {
                  // Fallback if logger import fails
                });
            }
            return;
          }

          if (await isTaskStoreCancelled()) {
            try {
              await storeCancelledTaskResult(await getCancellationReason());
            } catch (storeError) {
              import('../../utils/logger.js')
                .then(({ logger }) => {
                  logger.error('Failed to store cancelled task result', {
                    toolName,
                    error: storeError,
                  });
                })
                .catch(() => {
                  // Fallback if logger import fails
                });
            }
            return;
          }

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
            await taskStore.storeTaskResult(task.taskId, 'failed', errorResult);
          } catch (storeError) {
            // Use structured logging to avoid corrupting stdio transport
            import('../../utils/logger.js')
              .then(({ logger }) => {
                logger.error('Failed to store task result', {
                  toolName,
                  error: storeError,
                });
              })
              .catch(() => {
                // Fallback if logger import fails
              });
          }
        } finally {
          abortControllers.delete(task.taskId);
          clearTimeout(watchdogTimers.get(task.taskId));
          watchdogTimers.delete(task.taskId);
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

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Registers all ServalSheets tools with the MCP server
 *
 * Handles SDK compatibility for discriminated union schemas.
 *
 * @param server - McpServer instance
 * @param handlers - Tool handlers (null if not authenticated)
 */
export async function registerServalSheetsTools(
  server: McpServer,
  handlers: Handlers | null,
  options?: { googleClient?: GoogleApiClient | null }
): Promise<LegacyToolRegistration> {
  const requestQueue = new PQueue({
    concurrency: getEnv().MAX_CONCURRENT_REQUESTS,
  });
  const registrationState: LegacyToolRegistrationState = {
    disposed: false,
    abortController: new AbortController(),
  };

  const authHandler = new AuthHandler({
    googleClient: options?.googleClient ?? null,
    elicitationServer: server.server,
  });

  const handlerMap = handlers
    ? createToolHandlerMap(handlers, authHandler, options?.googleClient ?? null)
    : (() => {
        // Pre-auth: only sheets_auth (for login) and local-only tools available
        const sessionHandler = new SessionHandler();
        const samplingServer = createTaskAwareSamplingServer(server.server);
        const preAuthHandlerMap: Record<
          string,
          (args: unknown, extra?: unknown) => Promise<unknown>
        > = {
          sheets_auth: (args: unknown, _extra?: unknown) =>
            authHandler.handle(
              parseForHandler<Parameters<AuthHandler['handle']>[0]>(
                SheetsAuthInputSchema,
                args,
                'SheetsAuthInput',
                'sheets_auth'
              )
            ),
          sheets_confirm: (args: unknown, extra?: unknown) => {
            const requestExtra = extra as { requestId?: string | number } | undefined;
            return new ConfirmHandler({
              context: {
                batchCompiler: {} as never,
                rangeResolver: {} as never,
                server: server.server,
                elicitationServer: server.server,
                samplingServer,
                requestId: requestExtra?.requestId ? String(requestExtra.requestId) : undefined,
              },
            }).handle(
              parseForHandler<Parameters<ConfirmHandler['handle']>[0]>(
                SheetsConfirmInputSchemaLegacy,
                args,
                'SheetsConfirmInput',
                'sheets_confirm'
              )
            );
          },
          sheets_composite: async (args: unknown, _extra?: unknown) => {
            const parsed = parseForHandler<{ request: { action: string } }>(
              CompositeInputSchemaLegacy,
              args,
              'CompositeInput',
              'sheets_composite'
            );

            if (parsed.request.action === 'generate_template') {
              return {
                response: await handleGenerateTemplateAction(parsed.request as never, {
                  samplingServer,
                }),
              };
            }

            if (parsed.request.action === 'preview_generation') {
              return {
                response: await handlePreviewGenerationAction(parsed.request as never, {
                  samplingServer,
                }),
              };
            }

            return {
              response: {
                success: false,
                error: {
                  code: 'AUTHENTICATION_REQUIRED',
                  message: 'Google authentication is required for this sheets_composite action.',
                  retryable: false,
                },
              },
            };
          },
          sheets_session: (args: unknown, _extra?: unknown) =>
            sessionHandler.handle(
              parseForHandler<Parameters<SessionHandler['handle']>[0]>(
                SheetsSessionInputSchemaLegacy,
                args,
                'SheetsSessionInput',
                'sheets_session'
              )
            ),
        };
        return preAuthHandlerMap;
      })();

  assertValidMcpToolNames(ACTIVE_TOOL_DEFINITIONS);

  for (const tool of ACTIVE_TOOL_DEFINITIONS) {
    // Prepare schemas for SDK registration with caching (P0-2 optimization)
    const inputSchemaForRegistration = prepareSchemaForRegistrationCached(
      tool.name,
      tool.inputSchema,
      'input'
    );
    const outputSchemaForRegistration = prepareSchemaForRegistrationCached(
      tool.name,
      tool.outputSchema,
      'output'
    );

    // Register tool with prepared schemas
    // Type assertion needed due to TypeScript's deep type instantiation limits
    const execution = TOOL_EXECUTION_CONFIG[tool.name];
    const supportsTasks = execution?.taskSupport && execution.taskSupport !== 'forbidden';
    const runTool = createToolCallHandler(
      tool,
      handlerMap as Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> | null,
      options?.googleClient ?? null,
      requestQueue,
      registrationState
    );

    if (supportsTasks) {
      const taskHandler = createToolTaskHandler(tool.name, runTool);
      const taskSupport = execution?.taskSupport === 'required' ? 'required' : 'optional';
      const taskExecution = {
        ...(execution ?? {}),
        taskSupport,
      };

      server.experimental.tasks.registerToolTask<AnySchema, AnySchema>(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: inputSchemaForRegistration as AnySchema,
          outputSchema: outputSchemaForRegistration as AnySchema,
          annotations: tool.annotations,
          execution: taskExecution,
        } as Parameters<typeof server.experimental.tasks.registerToolTask<AnySchema, AnySchema>>[1],
        taskHandler
      );
      continue;
    }

    (
      server.registerTool as (
        name: string,
        config: {
          title?: string;
          description?: string;
          inputSchema?: unknown;
          outputSchema?: unknown;
          annotations?: ToolAnnotations;
          icons?: import('@modelcontextprotocol/sdk/types.js').Icon[];
          execution?: import('@modelcontextprotocol/sdk/types.js').ToolExecution;
        },
        cb: (
          args: Record<string, unknown>,
          extra?: {
            requestId?: string | number;
            elicit?: unknown;
            sample?: unknown;
          }
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
        icons: TOOL_ICONS[tool.name],
        execution,
      },
      runTool
    );
  }

  // Override tools/list to safely serialize schemas with transforms/pipes.
  registerToolsListCompatibilityHandler(server);

  if (getEnv().ENABLE_TOOLS_LIST_CHANGED_NOTIFICATIONS) {
    resourceNotifications.syncToolList(
      ACTIVE_TOOL_DEFINITIONS.map((tool) => tool.name),
      {
        emitOnFirstSet: false,
        reason: 'registered active tool definitions',
      }
    );
  }

  replaceAvailableToolNames(ACTIVE_TOOL_DEFINITIONS.map((tool) => tool.name));

  // NOTE: We register unwrapped object schemas for tools/list compatibility.
  // Legacy request envelopes are handled during validation via wrapInputSchemaForLegacyRequest.

  return {
    dispose: () => {
      if (registrationState.disposed) {
        return;
      }

      registrationState.disposed = true;
      registrationState.abortController.abort('MCP session closed');
      requestQueue.clear();
      updateQueueMetrics(requestQueue.size, requestQueue.pending);
    },
  };
}
