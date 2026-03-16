import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodTypeAny } from 'zod';
import { recordErrorCodeCompatibility } from '../../observability/metrics.js';
import { getTemporaryResourceStore } from '../../resources/temporary-storage.js';
import { getConcurrencyCoordinator } from '../../services/concurrency-coordinator.js';
import { getSessionContext } from '../../services/session-context.js';
import { redactSensitiveData } from '../../middleware/redaction.js';
import { getErrorCodeCompatibility } from '../../utils/error-code-compat.js';
import { logger } from '../../utils/logger.js';
import { getRequestContext } from '../../utils/request-context.js';
import { compactResponse, isCompactModeEnabled } from '../../utils/response-compactor.js';
import { applyResponseIntelligence } from './response-intelligence.js';
import { sanitizeToolOutput } from './tool-output-sanitization.js';
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

const USER_AND_ASSISTANT_AUDIENCE: ['user', 'assistant'] = ['user', 'assistant'];
const ASSISTANT_AUDIENCE: ['assistant'] = ['assistant'];

function getOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function validateOutputSchema(
  toolName: string,
  result: unknown,
  outputSchema: ZodTypeAny | undefined
): void {
  if (process.env['VALIDATE_OUTPUT_SCHEMAS'] === 'false' || !outputSchema) {
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

  getSessionContext().trackRequest();

  const requestContext = getRequestContext();
  const initialResponse = getResponseRecord(structuredContent);
  if (initialResponse) {
    if (requestContext) {
      const scMeta = getMetaRecord(structuredContent);
      const quotaStatus = getConcurrencyCoordinator().getQuotaStatus();
      const executionTimeMs = Date.now() - requestContext.requestStartTime;
      const apiCallsMade = requestContext.apiCallsMade;
      // Quota impact: each API call costs ~1 unit against the 60 req/min per-user quota
      const quotaImpact =
        apiCallsMade > 0 ? { apiCalls: apiCallsMade, quotaUnits: apiCallsMade } : undefined;
      structuredContent['_meta'] = {
        ...scMeta,
        requestId: requestContext.requestId,
        ...(requestContext.traceId ? { traceId: requestContext.traceId } : {}),
        ...(requestContext.spanId ? { spanId: requestContext.spanId } : {}),
        executionTimeMs,
        apiCallsMade,
        ...(quotaImpact ? { quotaImpact } : {}),
        quotaStatus: {
          used: quotaStatus.used,
          limit: quotaStatus.limit,
          utilization: Math.round(quotaStatus.utilization * 100) / 100,
          windowRemainingMs: quotaStatus.windowRemainingMs,
        },
      };
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

  if (preCompactResponse) {
    let intelligenceResult: { batchingHint?: string } = {};
    try {
      intelligenceResult = applyResponseIntelligence(preCompactResponse, {
        toolName,
        hasFailure: preCompactHasFailure,
      });
    } catch (err) {
      logger.debug('applyResponseIntelligence threw, continuing without enrichment', {
        error: err,
      });
    }

    // Inject batching hint into _meta when present
    if (intelligenceResult.batchingHint && requestContext) {
      const scMeta = getMetaRecord(structuredContent);
      structuredContent['_meta'] = { ...scMeta, batchingHint: intelligenceResult.batchingHint };
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

  if (isCompactModeEnabled()) {
    structuredContent = compactResponse(structuredContent);
  }

  const response = getResponseRecord(structuredContent);
  const responseSuccess = response ? getOptionalBoolean(response['success']) : undefined;
  const errorRecord = getErrorRecord(response);
  const responseErrorCode = errorRecord ? errorRecord['code'] : undefined;
  const errorCodeCompatibility = getErrorCodeCompatibility(responseErrorCode);

  const hasFailure = responseSuccess === false || structuredContent['success'] === false;
  const treatAsNonFatal =
    hasFailure &&
    process.env['MCP_NON_FATAL_TOOL_ERRORS'] !== 'false' &&
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
      content: [{ type: 'text', text: JSON.stringify(budgetContent, null, 2) }],
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
      content: [{ type: 'text', text: JSON.stringify(fallbackContent, null, 2) }],
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
