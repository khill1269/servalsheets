import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodTypeAny } from '../../lib/schema.js';
import { recordErrorCodeCompatibility } from '../../observability/metrics.js';
import { getTemporaryResourceStore } from '../../resources/temporary-storage.js';
import { getConcurrencyCoordinator } from '../../services/concurrency-coordinator.js';
import { getSessionContext } from '../../services/session-context.js';
import { redactSensitiveData } from '../../middleware/redaction.js';
import { getErrorCodeCompatibility } from '../../utils/error-code-compat.js';
import { logger } from '../../utils/logger.js';
import {
  getRequestContext,
  getRequestLlmProvenance,
  getRequestVerbosity,
} from '../../utils/request-context.js';
import { compactResponse, isCompactModeEnabled } from '../../utils/response-compactor.js';
import { applyResponseIntelligence } from './response-intelligence.js';
import { applyVerbosityFilter } from '../../handlers/helpers/verbosity-filter.js';
import { sanitizeToolOutput } from './tool-output-sanitization.js';
import { getEnv } from '../../config/env.js';
import {
  getErrorRecord,
  getMetaRecord,
  getResponseRecord,
  injectStandardCollectionMeta,
  injectStandardPaginationMeta,
  isPlainRecord,
  normalizeStructuredContent,
  sanitizeErrorPayload,
  type PlainRecord,
} from './tool-response-normalization.js';

/**
 * Module-level flag: emit onboarding hint exactly once per server lifetime.
 * Reset when `sheets_auth status` is called (via markOnboardingComplete).
 */
let onboardingHintEmitted = false;

/** Called by auth handler after sheets_auth.status completes, suppressing further hints. */
export function markOnboardingComplete(): void {
  onboardingHintEmitted = true;
}

const NON_FATAL_TOOL_ERROR_CODES = new Set<string>([
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

const USER_AND_ASSISTANT_AUDIENCE: ['user', 'assistant'] = ['user', 'assistant'];
const ASSISTANT_AUDIENCE: ['assistant'] = ['assistant'];

function getOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * P4: Known long-running action pairs that benefit from tasks/call routing.
 * Key: "toolName.actionName", Value: reason string for the taskHint.
 */
const LONG_RUNNING_ACTIONS: Record<string, string> = {
  'sheets_bigquery.export_to_bigquery':
    'BigQuery export can take 30-120s for large datasets. Use tasks/call for background execution.',
  'sheets_bigquery.import_from_bigquery':
    'BigQuery import can take 30-120s for large datasets. Use tasks/call for background execution.',
  'sheets_appsscript.run':
    'Apps Script execution has unbounded duration. Use tasks/call for background execution.',
  'sheets_composite.export_large_dataset':
    'Large dataset export streams data in chunks. Use tasks/call for background execution.',
  'sheets_history.timeline':
    'Revision timeline scans Drive API history and can take 15-60s. Use tasks/call for background execution.',
  'sheets_federation.call_remote':
    'Remote MCP server calls have network latency. Use tasks/call for background execution.',
  'sheets_analyze.comprehensive':
    'Comprehensive analysis scans 43 feature categories. Use tasks/call for background execution.',
};

/** Execution time threshold (ms) above which we suggest tasks/call even for non-listed actions */
const TASK_ROUTING_THRESHOLD_MS = 10_000;

function getTaskRoutingHint(
  toolName: string | undefined,
  actionName: string,
  executionTimeMs: number
): string | undefined {
  if (!toolName || !actionName) return undefined; // OK: Explicit empty

  const key = `${toolName}.${actionName}`;
  const knownHint = LONG_RUNNING_ACTIONS[key];
  if (knownHint) return knownHint;

  // Dynamic hint: if any action took >10s, suggest tasks/call for next time
  if (executionTimeMs > TASK_ROUTING_THRESHOLD_MS) {
    return `This operation took ${Math.round(executionTimeMs / 1000)}s. Consider using tasks/call for background execution on similar requests.`;
  }

  return undefined; // OK: no task hint applicable for this action/timing
}

/**
 * Actions whose results are deterministic — confidence is always 1.0.
 * No need to waste tokens reporting this.
 */
const DETERMINISTIC_ACTIONS = new Set([
  'read',
  'batch_read',
  'write',
  'batch_write',
  'append',
  'clear',
  'list_sheets',
  'get_sheet',
  'create',
  'delete_sheet',
  'duplicate_sheet',
  'set_format',
  'batch_format',
  'set_background',
  'set_borders',
  'set_number_format',
  'insert',
  'delete',
  'freeze',
  'auto_resize',
  'sort_range',
  'hide',
  'unhide',
  'share_add',
  'share_remove',
  'share_list',
  'comment_add',
  'comment_list',
  'login',
  'logout',
  'status',
  'callback',
  'begin',
  'commit',
  'rollback',
  'queue',
  'register',
  'unregister',
  'list',
]);

/**
 * Extract confidence from response bodies that already contain it.
 * Analysis handlers (scout, comprehensive, quality, performance) compute
 * `overallScore` or `confidence.overallScore`. For AI-powered actions
 * (sampling), use aiMode as a proxy. Returns undefined for deterministic
 * actions (no value in reporting confidence 1.0).
 */
function extractResponseConfidence(
  response: Record<string, unknown>,
  aiMode: 'sampling' | 'heuristic' | 'cached'
): number | undefined {
  const actionName = typeof response['action'] === 'string' ? response['action'] : '';

  // Don't report confidence for deterministic operations
  if (DETERMINISTIC_ACTIONS.has(actionName)) {
    return undefined; // OK: Explicit empty
  }

  // 1. Direct overallScore in response (scout, quality, performance)
  if (typeof response['overallScore'] === 'number') {
    return Math.round(response['overallScore']) / 100; // Normalize 0-100 → 0-1
  }

  // 2. Nested confidence object (comprehensive analysis)
  const confidence = response['confidence'];
  if (confidence && typeof confidence === 'object') {
    const confRecord = confidence as Record<string, unknown>;
    if (typeof confRecord['overallScore'] === 'number') {
      return Math.round(confRecord['overallScore']) / 100;
    }
  }

  // 3. Nested quality.score (quality handler)
  const quality = response['quality'];
  if (quality && typeof quality === 'object') {
    const qualRecord = quality as Record<string, unknown>;
    if (typeof qualRecord['score'] === 'number') {
      return Math.round(qualRecord['score']) / 100;
    }
  }

  // 4. For AI-powered actions without explicit confidence, use aiMode as a proxy
  if (aiMode === 'sampling') return 0.8; // Sampling results are generally reliable
  if (aiMode === 'cached') return 0.85; // Cached sampling results were reliable when generated

  // 5. Heuristic analysis actions without explicit scores
  const heuristicActions = new Set([
    'suggest_next_actions',
    'auto_enhance',
    'suggest_cleaning',
    'suggest_format',
    'suggest_chart',
    'suggest_pivot',
    'detect_anomalies',
    'generate_formula',
    'preview_generation',
  ]);
  if (heuristicActions.has(actionName)) return 0.7;

  return undefined; // OK: no confidence applicable for this action
}

function validateOutputSchema(
  toolName: string,
  result: unknown,
  outputSchema: ZodTypeAny | undefined
): void {
  if (!getEnv().VALIDATE_OUTPUT_SCHEMAS || !outputSchema) {
    return;
  }

  if (!result || typeof result !== 'object') {
    return;
  }

  try {
    const parseResult = outputSchema.safeParse(result);
    if (!parseResult.success) {
      const isDev = process.env['NODE_ENV'] !== 'production';
      const issues = parseResult.error.issues;

      if (isDev) {
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
        logger.debug('Output schema validation mismatch', {
          tool: toolName,
          issueCount: issues.length,
          firstIssue: issues[0] ? `${issues[0].path.join('.')}: ${issues[0].message}` : 'unknown',
        });
      }
    }
  } catch (err) {
    logger.debug('Output schema validation error', {
      tool: toolName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function truncateForPreview(data: unknown, maxChars: number): unknown {
  const str = JSON.stringify(data);
  if (str.length <= maxChars) {
    return data;
  }

  if (Array.isArray(data)) {
    return {
      _truncated: true,
      _totalItems: data.length,
      _preview: data.slice(0, 100),
      _hint: 'Showing first 100 items. Use resourceUri to access full data.',
    };
  }

  if (isPlainRecord(data)) {
    const truncated: PlainRecord = { _truncated: true };
    for (const [key, value] of Object.entries(data)) {
      const valueStr = JSON.stringify(value);
      truncated[key] =
        valueStr.length > 200 ? `${valueStr.substring(0, 200)}... [truncated]` : value;
    }
    return truncated;
  }

  return `${str.substring(0, maxChars)}... [truncated]`;
}

export function buildToolResponse(
  result: unknown,
  toolName?: string,
  outputSchema?: ZodTypeAny
): CallToolResult {
  if (toolName && outputSchema) {
    validateOutputSchema(toolName, result, outputSchema);
  }

  let structuredContent = normalizeStructuredContent(result);
  sanitizeErrorPayload(structuredContent);

  const requestContext = getRequestContext();
  (requestContext?.sessionContext ?? getSessionContext()).trackRequest();
  const initialResponse = getResponseRecord(structuredContent);
  if (initialResponse) {
    if (requestContext) {
      const scMeta = getMetaRecord(structuredContent);
      const llmProvenance = getRequestLlmProvenance();
      const quotaStatus = getConcurrencyCoordinator().getQuotaStatus();
      const executionTimeMs = Date.now() - requestContext.requestStartTime;
      const apiCallsMade = requestContext.apiCallsMade;
      // Quota impact: each API call costs ~1 unit against the 60 req/min per-user quota
      const quotaImpact =
        apiCallsMade > 0 ? { apiCalls: apiCallsMade, quotaUnits: apiCallsMade } : undefined;
      // Classify operation into performance tier for LLM cost awareness
      const performanceTier =
        executionTimeMs < 50
          ? 'instant'
          : executionTimeMs < 300
            ? 'fast'
            : executionTimeMs < 2000
              ? 'medium'
              : executionTimeMs < 10000
                ? 'slow'
                : 'background';
      structuredContent['_meta'] = {
        ...scMeta,
        requestId: requestContext.requestId,
        traceId: requestContext.traceId,
        spanId: requestContext.spanId,
        executionTimeMs,
        performanceTier,
        apiCallsMade,
        ...(quotaImpact ? { quotaImpact } : {}),
        ...(llmProvenance ?? {}),
        // Only include quotaStatus when utilization is meaningful (>20%) —
        // saves ~150 bytes/response for the ~80% of calls at low utilization
        ...(quotaStatus.utilization > 0.2
          ? {
              quotaStatus: {
                used: quotaStatus.used,
                limit: quotaStatus.limit,
                utilization: Math.round(quotaStatus.utilization * 100) / 100,
                windowRemainingMs: quotaStatus.windowRemainingMs,
              },
            }
          : {}),
      };

      // P4: Inject taskHint for long-running operations so LLMs know to use tasks/call
      const rawAction = initialResponse['action'];
      const actionName = typeof rawAction === 'string' ? rawAction : '';
      const taskHint = getTaskRoutingHint(toolName, actionName, executionTimeMs);
      if (taskHint) {
        (structuredContent['_meta'] as Record<string, unknown>)['taskHint'] = taskHint;
      }

      // Onboarding hint: on first non-auth tool call, nudge user toward sheets_auth status
      // for full readiness report, optional feature setup, and guided prompts.
      if (toolName && toolName !== 'sheets_auth' && !onboardingHintEmitted) {
        onboardingHintEmitted = true;
        (structuredContent['_meta'] as Record<string, unknown>)['onboardingHint'] = {
          message:
            'Tip: Run sheets_auth action:"status" for a full readiness report — see which optional features (AI sampling, data connectors, webhooks) are available and get guided setup.',
          suggestedAction: { tool: 'sheets_auth', action: 'status' },
          recommendedPrompt: 'welcome',
        };
      }

      // Session context summary: helps LLM skip redundant operations
      // Only inject when there's meaningful context (active sheet or 2+ operations)
      const sessionSummary = getSessionContext().getSummary();
      if (sessionSummary.activeSpreadsheet || sessionSummary.recentOperations.length >= 2) {
        const lastOps = sessionSummary.recentOperations.slice(0, 3);
        (structuredContent['_meta'] as Record<string, unknown>)['sessionContext'] = {
          ...(sessionSummary.activeSpreadsheet
            ? {
                activeSheet: sessionSummary.activeSpreadsheet.title,
                knownSheets: sessionSummary.activeSpreadsheet.sheetNames.slice(0, 10),
              }
            : {}),
          ...(lastOps.length > 0
            ? {
                recentOps: lastOps.map(
                  (op: { tool?: string; action?: string; range?: string }) =>
                    `${op.tool ?? ''}${op.action ? `.${op.action}` : ''}${op.range ? ` ${op.range}` : ''}`
                ),
              }
            : {}),
        };
      }
    }

    injectStandardPaginationMeta(initialResponse);
    injectStandardCollectionMeta(initialResponse);
  }

  const preCompactResponse = getResponseRecord(structuredContent);
  const preCompactResponseSuccess = preCompactResponse
    ? getOptionalBoolean(preCompactResponse['success'])
    : undefined;
  const preCompactHasFailure =
    preCompactResponseSuccess === false || structuredContent['success'] === false;

  // Track per-tool success/failure for adaptive description verbosity
  if (toolName) {
    try {
      getSessionContext().recordToolOutcome(toolName, !preCompactHasFailure);
    } catch {
      // Session context may not be initialized — non-critical
    }
  }

  if (preCompactResponse) {
    let intelligenceResult: { batchingHint?: string; aiMode?: string } = {};
    // Determine aiMode before try block so it's available for confidence extraction
    const existingMetaForAiMode = getMetaRecord(structuredContent);
    const rawAiMode = existingMetaForAiMode['aiMode'];
    const aiMode: 'sampling' | 'heuristic' | 'cached' =
      rawAiMode === 'sampling' || rawAiMode === 'cached' ? rawAiMode : 'heuristic';
    try {
      // Extract action/spreadsheetId from response for recovery engine context
      const responseAction =
        typeof preCompactResponse['action'] === 'string' ? preCompactResponse['action'] : undefined;
      const responseSpreadsheetId =
        typeof preCompactResponse['spreadsheetId'] === 'string'
          ? preCompactResponse['spreadsheetId']
          : undefined;
      intelligenceResult = applyResponseIntelligence(preCompactResponse, {
        toolName,
        actionName: responseAction,
        hasFailure: preCompactHasFailure,
        spreadsheetId: responseSpreadsheetId,
        aiMode,
      });
    } catch (err) {
      logger.debug('applyResponseIntelligence threw, continuing without enrichment', {
        error: err,
      });
    }

    // Inject cell-level citations into _meta when present in response
    const responseCitations = preCompactResponse['_citations'] ?? preCompactResponse['citations'];
    if (Array.isArray(responseCitations) && responseCitations.length > 0 && requestContext) {
      const scMeta = getMetaRecord(structuredContent);
      structuredContent['_meta'] = { ...scMeta, citations: responseCitations };
      // Remove internal _citations field from response body
      delete preCompactResponse['_citations'];
    }

    // Inject batching hint into _meta when present
    if (intelligenceResult.batchingHint && requestContext) {
      const scMeta = getMetaRecord(structuredContent);
      structuredContent['_meta'] = { ...scMeta, batchingHint: intelligenceResult.batchingHint };
    }

    // Surface confidence score in _meta when present in the response body.
    // Analysis handlers (scout, comprehensive, quality, performance) already compute
    // confidence; this extracts it to _meta so the LLM pipeline can use it for
    // decision-making without parsing the full response JSON.
    if (requestContext && !preCompactHasFailure) {
      const responseConfidence = extractResponseConfidence(preCompactResponse, aiMode);
      if (responseConfidence !== undefined) {
        const scMeta = getMetaRecord(structuredContent);
        structuredContent['_meta'] = { ...scMeta, confidence: responseConfidence };
      }
    }

    // Inject transaction hint when many API calls were made in a single request
    if (requestContext && requestContext.apiCallsMade >= 5) {
      const scMeta = getMetaRecord(structuredContent);
      structuredContent['_meta'] = {
        ...scMeta,
        transactionHint: `${requestContext.apiCallsMade} API calls in this request. For 5+ operations, use sheets_transaction for 80-95% fewer API calls.`,
      };
    }

    const sanitizationFindings = sanitizeToolOutput(preCompactResponse);
    if (sanitizationFindings.length > 0) {
      const scMeta = getMetaRecord(structuredContent);
      structuredContent['_meta'] = {
        ...scMeta,
        outputSanitized: true,
        outputSanitizationFindings: sanitizationFindings,
      };
    }
  }

  // Global verbosity filter: apply to ALL tool responses via request context.
  // Handlers that already called applyVerbosityFilter() will have removed _meta etc.
  // This ensures the 8+ handlers that don't call it themselves still benefit.
  const requestedVerbosity = getRequestVerbosity();
  if (requestedVerbosity && requestedVerbosity !== 'standard') {
    const responseForFilter = getResponseRecord(structuredContent);
    if (responseForFilter && typeof responseForFilter['success'] === 'boolean') {
      applyVerbosityFilter(
        responseForFilter as { success: boolean; _meta?: unknown },
        requestedVerbosity
      );
    }
  }

  // Inject _meta.verbosity so LLMs know what level was applied
  if (requestedVerbosity && requestContext) {
    const scMeta = getMetaRecord(structuredContent);
    structuredContent['_meta'] = { ...scMeta, verbosity: requestedVerbosity };
  }

  if (isCompactModeEnabled()) {
    structuredContent = compactResponse(structuredContent);
  }

  const response = getResponseRecord(structuredContent);
  const responseSuccess = response ? getOptionalBoolean(response['success']) : undefined;
  const errorRecord = getErrorRecord(response);
  const responseErrorCode = errorRecord ? errorRecord['code'] : undefined;
  const errorCodeCompatibility = getErrorCodeCompatibility(responseErrorCode);

  const hasFailure = responseSuccess === false || structuredContent['success'] === false;
  const env = getEnv();
  const treatAsNonFatal =
    hasFailure &&
    env.MCP_NON_FATAL_TOOL_ERRORS !== 'false' &&
    typeof responseErrorCode === 'string' &&
    NON_FATAL_TOOL_ERROR_CODES.has(responseErrorCode);
  const isError = hasFailure && !treatAsNonFatal;

  if (treatAsNonFatal) {
    const scMeta = getMetaRecord(structuredContent);
    structuredContent['_meta'] = {
      ...scMeta,
      nonFatalError: true,
      nonFatalReason: `error_code:${responseErrorCode}`,
    };
  }

  if (hasFailure && response && errorCodeCompatibility) {
    recordErrorCodeCompatibility({
      reportedCode: errorCodeCompatibility.reportedCode,
      canonicalCode: errorCodeCompatibility.canonicalCode,
      family: errorCodeCompatibility.family,
      isAlias: errorCodeCompatibility.isAlias,
      isKnown: errorCodeCompatibility.isKnown,
    });

    const scMeta = getMetaRecord(structuredContent);
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

  const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;
  const MAX_RESPONSE_TOKENS_BYTES = parseInt(process.env['MCP_MAX_RESPONSE_BYTES'] || '100000', 10);
  const COMPACT_THRESHOLD = 50 * 1024;
  const compactStr = JSON.stringify(structuredContent);
  const sizeBytes = Buffer.byteLength(compactStr, 'utf8');
  const rawResponseStr =
    sizeBytes > COMPACT_THRESHOLD ? compactStr : JSON.stringify(structuredContent, null, 2);
  const responseStr = redactSensitiveData(rawResponseStr).output;

  if (sizeBytes > MAX_RESPONSE_TOKENS_BYTES && sizeBytes <= MAX_RESPONSE_SIZE) {
    const resourceUri = getTemporaryResourceStore().store(structuredContent, 1800);
    const preview = truncateForPreview(structuredContent, 2000);
    const continuationHint = `resources/read uri="${resourceUri}"`;
    const budgetMeta: PlainRecord = {
      truncated: true,
      originalSizeBytes: sizeBytes,
      retrievalUri: resourceUri,
      continuationHint,
    };
    const budgetResponse: PlainRecord = {
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
      _meta: budgetMeta,
    };
    const budgetContent: PlainRecord = { response: budgetResponse };
    budgetMeta['deliveredSizeBytes'] = Buffer.byteLength(JSON.stringify(budgetContent), 'utf8');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(budgetContent, null, 2),
        },
      ],
      structuredContent: budgetContent,
      isError: undefined,
    };
  }

  if (sizeBytes > MAX_RESPONSE_SIZE) {
    const resourceUri = getTemporaryResourceStore().store(structuredContent, 1800);
    const preview = truncateForPreview(structuredContent, 1000);
    const continuationHint = `resources/read uri="${resourceUri}"`;
    const fallbackMeta: PlainRecord = {
      truncated: true,
      originalSizeBytes: sizeBytes,
      retrievalUri: resourceUri,
      continuationHint,
    };
    const fallbackResponse: PlainRecord = {
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
      _meta: fallbackMeta,
    };
    const fallbackContent: PlainRecord = { response: fallbackResponse };
    fallbackMeta['deliveredSizeBytes'] = Buffer.byteLength(JSON.stringify(fallbackContent), 'utf8');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(fallbackContent, null, 2),
        },
      ],
      structuredContent: fallbackContent,
      isError: undefined,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: responseStr,
        annotations: {
          audience: isError ? USER_AND_ASSISTANT_AUDIENCE : ASSISTANT_AUDIENCE,
        },
      },
    ],
    structuredContent,
    isError: isError ? true : undefined,
  };
}
