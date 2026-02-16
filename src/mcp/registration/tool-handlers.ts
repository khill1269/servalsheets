/**
 * ServalSheets - Tool Handlers
 *
 * Handler mapping and tool call execution logic.
 *
 * @module mcp/registration/tool-handlers
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ToolTaskHandler } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { randomUUID } from 'crypto';
import { recordToolCall, recordToolCallLatency, recordError } from '../../observability/metrics.js';
import { withToolSpan } from '../../utils/tracing.js';
import { z, type ZodSchema, type ZodTypeAny } from 'zod';

import type { Handlers } from '../../handlers/index.js';
import { AuthHandler } from '../../handlers/auth.js';
import type { GoogleApiClient } from '../../services/google-api.js';
import {
  createRequestContext,
  runWithRequestContext,
  getRequestLogger,
  getRequestContext,
} from '../../utils/request-context.js';
import { compactResponse, isCompactModeEnabled } from '../../utils/response-compactor.js';
import { recordSpreadsheetId, TOOL_ACTIONS } from '../completions.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from '../features-2025-11-25.js';
import { getHistoryService } from '../../services/history-service.js';
import { getSessionContext } from '../../services/session-context.js';
import type { OperationHistory } from '../../types/history.js';
import {
  prepareSchemaForRegistrationCached,
  wrapInputSchemaForLegacyRequest,
} from './schema-helpers.js';
import type { ToolDefinition } from './tool-definitions.js';
import { ACTIVE_TOOL_DEFINITIONS } from './tool-definitions.js';
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
} from '../../schemas/index.js';
import { parseWithCache } from '../../utils/schema-cache.js';
import { registerToolsListCompatibilityHandler } from './tools-list-compat.js';
import { wrapToolMapWithIdempotency } from '../../middleware/idempotency-middleware.js';

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
]);

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
  authHandler?: AuthHandler
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

  // Wrap all handlers with idempotency middleware
  return wrapToolMapWithIdempotency(map);
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

  // Track request for quota prediction
  const sessionContext = getSessionContext();
  sessionContext.trackRequest();

  // Add request correlation ID for tracing (if available)
  const requestContext = getRequestContext();
  if (requestContext && 'response' in structuredContent) {
    const resp = structuredContent['response'] as Record<string, unknown>;
    if (resp && typeof resp === 'object') {
      // Add _meta with requestId for correlation across logs/errors
      resp['_meta'] = {
        ...(typeof resp['_meta'] === 'object' ? (resp['_meta'] as Record<string, unknown>) : {}),
        requestId: requestContext.requestId,
        ...(requestContext.traceId && { traceId: requestContext.traceId }),
        ...(requestContext.spanId && { spanId: requestContext.spanId }),
      };
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

  // Detect errors from success: false in response (or legacy top-level success)
  const hasFailure = responseSuccess === false || structuredContent['success'] === false;
  const treatAsNonFatal =
    hasFailure &&
    process.env['MCP_NON_FATAL_TOOL_ERRORS'] !== 'false' &&
    typeof responseErrorCode === 'string' &&
    NON_FATAL_TOOL_ERROR_CODES.has(responseErrorCode);
  const isError = hasFailure && !treatAsNonFatal;

  if (treatAsNonFatal && response && typeof response === 'object') {
    const responseRecord = response as Record<string, unknown>;
    responseRecord['_meta'] = {
      ...(typeof responseRecord['_meta'] === 'object'
        ? (responseRecord['_meta'] as Record<string, unknown>)
        : {}),
      nonFatalError: true,
      nonFatalReason: `error_code:${responseErrorCode}`,
    };
  }

  // DEBUG: Log sheets_collaborate responses to diagnose validation issue
  if (typeof result === 'object' && result !== null && 'response' in result) {
    const resp = (result as Record<string, unknown>)['response'];
    if (resp && typeof resp === 'object' && 'action' in resp) {
      const action = (resp as Record<string, unknown>)['action'];
      if (typeof action === 'string' && action.includes('permission')) {
        const logger = getRequestLogger();
        logger.info('[DEBUG] buildToolResponse for sharing', {
          action,
          responseSuccess,
          responseSuccessType: typeof responseSuccess,
          isError,
          structuredContentKeys: Object.keys(structuredContent),
          responseKeys:
            response && typeof response === 'object' ? Object.keys(response) : undefined,
        });
      }
    }
  }

  // P1-3: Response size validation to prevent MCP protocol issues
  // Limit responses to 10MB to avoid overwhelming MCP clients
  const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB
  // Use compact JSON for large responses (>50KB) to reduce payload by 10-20%
  const COMPACT_THRESHOLD = 50 * 1024; // 50KB
  const compactStr = JSON.stringify(structuredContent);
  const sizeBytes = Buffer.byteLength(compactStr, 'utf8');
  const responseStr =
    sizeBytes > COMPACT_THRESHOLD ? compactStr : JSON.stringify(structuredContent, null, 2);

  if (sizeBytes > MAX_RESPONSE_SIZE) {
    // Phase 3: Store as temporary resource instead of failing (edge case: <0.1% of requests)
    // Lazy import to avoid loading in common case
    let getTemporaryResourceStore: () => import('../../resources/temporary-storage.js').TemporaryResourceStore;
    try {
      ({ getTemporaryResourceStore } = require('../../resources/temporary-storage.js'));
    } catch {
      // Fallback if module not available (shouldn't happen in production)
      throw new Error('Temporary resource storage not available');
    }
    const store = getTemporaryResourceStore();
    const resourceUri = store.store(structuredContent, 1800); // 30 min TTL

    // Create preview (first 100 rows or 1000 chars)
    const preview = truncateForPreview(structuredContent, 1000);

    const fallbackContent: Record<string, unknown> = {
      response: {
        success: true,
        resourceUri,
        preview,
        message: `Response size ${(sizeBytes / 1024 / 1024).toFixed(2)}MB exceeds transport limit. Stored as temporary resource.`,
        _hint: `Full data available via: resources/read uri="${resourceUri}" (expires in 30 minutes)`,
        details: {
          sizeBytes,
          maxSizeBytes: MAX_RESPONSE_SIZE,
          expiresIn: '30 minutes',
        },
      },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(fallbackContent, null, 2) }],
      structuredContent: fallbackContent,
      isError: false,
    };
  }

  return {
    // Human-readable content for display
    content: [{ type: 'text', text: responseStr }],
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

export function normalizeToolArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object') {
    // OK: Explicit empty - invalid args will be caught by Zod validation downstream
    return {};
  }
  const record = args as Record<string, unknown>;

  // Legacy root-level wrapper: { action, params: {...} }
  const rootParams = record['params'];
  if (rootParams && typeof rootParams === 'object') {
    const action = typeof record['action'] === 'string' ? { action: record['action'] } : {};
    return { request: { ...(rootParams as Record<string, unknown>), ...action } };
  }

  const request = record['request'];
  if (!request || typeof request !== 'object') {
    return { request: record };
  }

  const requestRecord = request as Record<string, unknown>;
  const params = requestRecord['params'];
  if (params && typeof params === 'object') {
    const action =
      typeof requestRecord['action'] === 'string' ? { action: requestRecord['action'] } : {};
    return { request: { ...(params as Record<string, unknown>), ...action } };
  }

  return { request: requestRecord };
}

function createToolCallHandler(
  tool: ToolDefinition,
  handlerMap: Record<string, (args: unknown, extra?: unknown) => Promise<unknown>> | null
): (
  args: Record<string, unknown>,
  extra?: { requestId?: string | number; elicit?: unknown; sample?: unknown }
) => Promise<CallToolResult> {
  return async (
    args: Record<string, unknown>,
    extra?: { requestId?: string | number; elicit?: unknown; sample?: unknown }
  ) => {
    const requestId = extra?.requestId ? String(extra.requestId) : undefined;
    const requestContext = createRequestContext({ requestId });

    // Generate operation ID and start time for history tracking
    const operationId = randomUUID();
    const startTime = Date.now();
    const timestamp = new Date(startTime).toISOString();

    return runWithRequestContext(requestContext, async () => {
      recordSpreadsheetId(args);

      if (!handlerMap) {
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

      try {
        // Execute handler with distributed tracing
        const result = await withToolSpan(
          tool.name,
          async (span) => {
            // Add span attributes for observability
            const action = extractAction(args);
            const spreadsheetId = extractSpreadsheetId(args);
            const sheetId = extractSheetId(args);

            span.setAttributes({
              'tool.name': tool.name,
              'tool.action': action,
              'operation.id': operationId,
              'request.id': requestId || 'unknown',
              ...(spreadsheetId && { 'spreadsheet.id': spreadsheetId }),
              ...(sheetId && { 'sheet.id': sheetId.toString() }),
            });

            // Execute handler - pass extra context for MCP-native tools
            const handlerResult = await handler(normalizeToolArgs(args), extra);

            // Add result attributes to span
            span.setAttributes({
              'result.success': isSuccessResult(handlerResult),
              'cells.affected': extractCellsAffected(handlerResult) || 0,
            });

            return handlerResult;
          },
          {
            'mcp.protocol.version': '2025-11-25',
            'service.name': 'servalsheets',
          }
        );

        const duration = Date.now() - startTime;

        // Record operation in history
        const historyService = getHistoryService();
        const operation: OperationHistory = {
          id: operationId,
          timestamp,
          tool: tool.name,
          action: extractAction(args),
          params: args,
          result: isSuccessResult(result) ? 'success' : 'error',
          duration,
          cellsAffected: extractCellsAffected(result),
          snapshotId: extractSnapshotId(result),
          errorMessage: extractErrorMessage(result),
          errorCode: extractErrorCode(result),
          requestId,
          spreadsheetId: extractSpreadsheetId(args),
          sheetId: extractSheetId(args),
        };

        historyService.record(operation);

        // Record metrics for observability
        const action = extractAction(args);
        const status = isSuccessResult(result) ? 'success' : 'error';
        const durationSeconds = duration / 1000;
        recordToolCall(tool.name, action, status, durationSeconds);
        recordToolCallLatency(tool.name, action, durationSeconds);

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

        // Return structured error instead of throwing (Task 1.2)
        // buildToolResponse classifies recoverable error codes as non-fatal MCP results.
        const errorResponse = {
          response: {
            success: false,
            error: errorPayload,
          },
        };

        return buildToolResponse(errorResponse);
      }
    });
  };
}

function createToolTaskHandler(
  toolName: string,
  runTool: (
    args: Record<string, unknown>,
    extra?: { requestId?: string | number }
  ) => Promise<CallToolResult>
): ToolTaskHandler<AnySchema> {
  return {
    createTask: async (args, extra) => {
      if (!extra.taskStore) {
        throw new Error(`[${toolName}] Task store not configured`);
      }

      const task = await extra.taskStore.createTask({
        ttl: extra.taskRequestedTtl ?? undefined,
      });

      const taskStore = extra.taskStore;
      void (async () => {
        try {
          const result = await runTool(args as Record<string, unknown>, extra);
          await taskStore.storeTaskResult(task.taskId, 'completed', result);
        } catch (error) {
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
): Promise<void> {
  const authHandler = new AuthHandler({
    googleClient: options?.googleClient ?? null,
    elicitationServer: server.server,
  });

  const handlerMap = handlers
    ? createToolHandlerMap(handlers, authHandler)
    : {
        sheets_auth: (args: unknown) =>
          authHandler.handle(
            parseForHandler<Parameters<AuthHandler['handle']>[0]>(
              SheetsAuthInputSchema,
              args,
              'SheetsAuthInput',
              'sheets_auth'
            )
          ),
      };

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
    const runTool = createToolCallHandler(tool, handlerMap);

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
          title: tool.annotations.title,
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

  // NOTE: We register unwrapped object schemas for tools/list compatibility.
  // Legacy request envelopes are handled during validation via wrapInputSchemaForLegacyRequest.
}
