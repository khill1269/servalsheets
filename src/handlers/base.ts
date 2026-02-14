/**
 * ServalSheets - Base Handler
 *
 * Abstract base class for tool handlers
 * MCP Protocol: 2025-11-25
 */

import type { Intent } from '../core/intent.js';
import { ServiceError } from '../core/errors.js';
import type { BatchCompiler, ExecutionResult } from '../core/batch-compiler.js';
import type { RangeResolver } from '../core/range-resolver.js';
import type {
  SafetyOptions,
  ErrorDetail,
  MutationSummary,
  RangeInput,
  ResponseMeta,
} from '../schemas/shared.js';
import { getRequestLogger } from '../utils/request-context.js';
import {
  createPermissionError,
  createRateLimitError,
  createNotFoundError,
  createValidationError,
  createZodValidationError,
  parseGoogleApiError,
} from '../utils/error-factory.js';
import {
  enhanceResponse,
  estimateCost,
  type EnhancementContext,
} from '../utils/response-enhancer.js';
import { compactResponse } from '../utils/response-compactor.js';
import type { SamplingServer } from '../mcp/sampling.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import { getCircuitBreakerConfig } from '../config/env.js';
import {
  buildGridRangeInput,
  parseA1Notation,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';
import type { sheets_v4 } from 'googleapis';
import { getContextManager } from '../services/context-manager.js';
import {
  requiresConfirmation,
  generateSafetyWarnings,
  createSnapshotIfNeeded,
  formatSafetyWarnings,
  shouldReturnPreview,
  buildSnapshotInfo,
  type SafetyContext,
  type SafetyWarning,
  type SnapshotResult,
} from '../utils/safety-helpers.js';
import { createEnhancedError, enhanceError } from '../utils/enhanced-errors.js';
import { memoize } from '../utils/memoization.js';
import { withApiSpan } from '../utils/tracing.js';
import { recordGoogleApiCall } from '../observability/metrics.js';

export interface HandlerContext {
  batchCompiler: BatchCompiler;
  rangeResolver: RangeResolver;
  googleClient?: import('../services/google-api.js').GoogleApiClient | null; // For authentication checks
  batchingSystem?: import('../services/batching-system.js').BatchingSystem;
  snapshotService?: import('../services/snapshot.js').SnapshotService; // For undo/revert operations
  cachedSheetsApi?: import('../services/cached-sheets-api.js').CachedSheetsApi; // ETag-based caching for reads
  requestMerger?: import('../services/request-merger.js').RequestMerger; // Phase 2: Merge overlapping read requests
  parallelExecutor?: import('../services/parallel-executor.js').ParallelExecutor; // Phase 2: Parallel batch execution
  prefetchPredictor?: import('../services/prefetch-predictor.js').PrefetchPredictor; // Phase 3: Predictive prefetching
  accessPatternTracker?: import('../services/access-pattern-tracker.js').AccessPatternTracker; // Phase 3: Access pattern learning
  queryOptimizer?: import('../services/query-optimizer.js').AdaptiveQueryOptimizer; // Phase 3B: Adaptive query optimization
  auth?: {
    hasElevatedAccess: boolean;
    scopes: string[];
  };
  samplingServer?: SamplingServer;
  requestDeduplicator?: RequestDeduplicator;
  circuitBreaker?: CircuitBreaker;
  elicitationServer?: import('../mcp/elicitation.js').ElicitationServer;
  server?: import('@modelcontextprotocol/sdk/server/index.js').Server; // MCP Server instance for elicitation/sampling
  taskStore?: import('../core/task-store-adapter.js').TaskStoreAdapter; // For task-based execution (SEP-1686)
  metrics?: import('../services/metrics.js').MetricsService; // For tracking confirmation skips and performance
  metadataCache?: import('../services/metadata-cache.js').MetadataCache; // Session-level metadata cache (N+1 elimination)
  logger?: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  abortSignal?: AbortSignal;
  requestId?: string;
}

/**
 * Unwrap legacy direct inputs to the request envelope.
 */
export function unwrapRequest<TRequest extends Record<string, unknown>>(
  input: { request?: TRequest } | TRequest
): TRequest {
  if (input && typeof input === 'object' && 'request' in input) {
    const container = input as { request?: TRequest };
    if (container.request && typeof container.request === 'object') {
      return container.request;
    }
  }

  return input as TRequest;
}

/**
 * Success result type - flat structure matching outputSchema
 * Data fields are spread directly into the result object
 */
export type HandlerResult<T extends Record<string, unknown>> = T & {
  success: true;
  action: string;
  mutation?: MutationSummary;
  dryRun?: boolean;
  _meta?: ResponseMeta;
};

/**
 * Error result type
 */
export interface HandlerError {
  success: false;
  error: ErrorDetail;
}

/**
 * Combined output type
 */
export type HandlerOutput<T extends Record<string, unknown>> = HandlerResult<T> | HandlerError;

/**
 * Memoized column conversion functions for performance
 * Shared across all handler instances
 */
const memoizedColumnToLetter = memoize(
  (index: number): string => {
    let letter = '';
    let temp = index + 1;
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - 1) / 26);
    }
    return letter;
  },
  { maxSize: 500, ttl: 300000 }
); // Cache 500 entries for 5 minutes

const memoizedLetterToColumn = memoize(
  (letter: string): number => {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1;
  },
  { maxSize: 500, ttl: 300000 }
);

/**
 * Base handler with common utilities
 */
export abstract class BaseHandler<TInput, TOutput> {
  protected context: HandlerContext;
  protected toolName: string;
  protected currentSpreadsheetId?: string; // Track current request for better error messages
  protected currentVerbosity: 'minimal' | 'standard' | 'detailed' = 'standard'; // LLM optimization: skip metadata for minimal
  private lastProgressTime = 0; // Throttle progress events to max 1/sec

  constructor(toolName: string, context: HandlerContext) {
    this.toolName = toolName;
    this.context = context;
  }

  /**
   * Set verbosity level for current request (call before building response)
   * When minimal, metadata generation is skipped to save ~400-800 tokens
   */
  protected setVerbosity(verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'): void {
    this.currentVerbosity = verbosity;
  }

  /**
   * Send progress notification for long-running operations (Phase 2: HTTP Progress Notifications)
   * Only works with HTTP/SSE transport - gracefully degrades for STDIO
   * Throttled to max 1 event per second to avoid overwhelming the client
   *
   * @param completed - Number of items completed
   * @param total - Total number of items
   * @param message - Optional progress message
   */
  protected async sendProgress(completed: number, total: number, _message?: string): Promise<void> {
    // Only available for HTTP transport (graceful degradation for STDIO)
    if (!this.context.server) {
      return;
    }

    // Throttle: max 1 event per second
    const now = Date.now();
    if (now - this.lastProgressTime < 1000) {
      return;
    }
    this.lastProgressTime = now;

    try {
      // Send MCP progress notification
      await this.context.server.notification({
        method: 'notifications/progress',
        params: {
          progress: completed,
          total,
          progressToken: this.context.requestId || `${this.toolName}-progress`,
        },
      });
    } catch (error) {
      // Don't fail the operation if progress notification fails
      // Just log and continue
      const logger = this.context.logger || getRequestLogger();
      logger?.warn?.('Failed to send progress notification', {
        error: error instanceof Error ? error.message : String(error),
        tool: this.toolName,
      });
    }
  }

  /**
   * Require authentication before executing tool
   * Throws clear error with step-by-step instructions if not authenticated
   */
  protected requireAuth(): void {
    if (!this.context.googleClient) {
      const error = createEnhancedError(
        'AUTH_REQUIRED',
        `Authentication required for ${this.toolName}. Call sheets_auth with action "status" to check authentication, or action "login" to authenticate.`,
        {
          tool: this.toolName,
          hint: 'Authentication is required before using this tool',
          resolution: 'Authenticate using sheets_auth tool',
          steps: [
            '1. Check auth status: sheets_auth action="status"',
            '2. If not authenticated: sheets_auth action="login"',
            '3. Follow the OAuth flow to complete authentication',
            '4. Retry this operation',
          ],
        }
      );
      throw error;
    }
  }

  /**
   * Handle the input and return output
   */
  abstract handle(input: TInput): Promise<TOutput>;

  /**
   * Execute an API call with circuit breaker protection
   * Creates/retrieves a circuit breaker for the operation type
   * Protects against cascade failures when Google API degrades
   *
   * @param operation - Operation name for circuit breaker identification (e.g., 'values.get')
   * @param fn - The API call to execute
   * @param fallback - Optional fallback function if circuit is open
   */
  protected async withCircuitBreaker<T>(
    operation: string,
    fn: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    const circuitName = `${this.toolName}:${operation}`;
    const config = getCircuitBreakerConfig();

    // Get or create circuit breaker from registry
    let entry = circuitBreakerRegistry.get(circuitName);
    if (!entry) {
      const newBreaker = new CircuitBreaker({
        name: circuitName,
        failureThreshold: config.failureThreshold,
        successThreshold: config.successThreshold,
        timeout: config.timeout,
      });
      circuitBreakerRegistry.register(circuitName, newBreaker);
      entry = circuitBreakerRegistry.get(circuitName);
    }

    return entry!.breaker.execute(fn, fallback);
  }

  /**
   * Execute an instrumented Google API call with distributed tracing and metrics
   * Automatically records latency metrics and creates trace spans for observability
   *
   * @param method - API method name (e.g., 'spreadsheets.values.get')
   * @param apiCall - The API call function to execute
   * @param context - Optional context for enhanced tracing (spreadsheetId, range, etc.)
   * @returns Promise resolving to the API call result
   */
  protected async instrumentedApiCall<T>(
    method: string,
    apiCall: () => Promise<T>,
    context?: { spreadsheetId?: string; range?: string; sheetName?: string }
  ): Promise<T> {
    const startTime = Date.now();

    // Build endpoint URL for tracing
    const endpoint = context?.spreadsheetId
      ? `https://sheets.googleapis.com/v4/spreadsheets/${context.spreadsheetId}`
      : 'https://sheets.googleapis.com/v4';

    return withApiSpan(
      method,
      endpoint,
      async (span) => {
        // Add context attributes to span for better tracing
        if (context?.spreadsheetId) {
          span.setAttribute('spreadsheet.id', context.spreadsheetId);
        }
        if (context?.range) {
          span.setAttribute('range', context.range);
        }
        if (context?.sheetName) {
          span.setAttribute('sheet.name', context.sheetName);
        }

        try {
          const result = await apiCall();
          const duration = (Date.now() - startTime) / 1000;
          recordGoogleApiCall(method, 'success', duration);
          return result;
        } catch (error) {
          const duration = (Date.now() - startTime) / 1000;
          recordGoogleApiCall(method, 'error', duration);
          throw error;
        }
      },
      { 'api.system': 'google_sheets' }
    );
  }

  /**
   * Create intents from input
   */
  protected abstract createIntents(input: TInput): Intent[];

  /**
   * Execute intents through the batch compiler
   */
  protected async executeIntents(
    intents: Intent[],
    safety?: SafetyOptions
  ): Promise<ExecutionResult[]> {
    const batches = await this.context.batchCompiler.compile(intents);
    return this.context.batchCompiler.executeAll(batches, safety);
  }

  /**
   * Resolve a range input to A1 notation
   */
  protected async resolveRange(spreadsheetId: string, range: RangeInput): Promise<string> {
    const resolved = await this.context.rangeResolver.resolve(spreadsheetId, range);
    return resolved.a1Notation;
  }

  /**
   * Create a success response - FLAT structure matching outputSchema
   * Data fields are spread directly into the result (not nested under 'data')
   * Automatically generates response metadata if not provided
   */
  protected success<A extends string, T extends Record<string, unknown>>(
    action: A,
    data: T,
    mutation?: MutationSummary,
    dryRun?: boolean,
    meta?: ResponseMeta
  ): T & {
    success: true;
    action: A;
    mutation?: MutationSummary;
    dryRun?: boolean;
    _meta?: ResponseMeta;
  } {
    const result: T & {
      success: true;
      action: A;
      mutation?: MutationSummary;
      dryRun?: boolean;
      _meta?: ResponseMeta;
    } = {
      success: true as const,
      action,
      ...data,
    };

    // Only include optional fields if they have values
    if (mutation !== undefined) {
      result.mutation = mutation;
    }
    if (dryRun !== undefined) {
      result.dryRun = dryRun;
    }

    // Auto-generate metadata if not provided
    // Skip metadata generation for minimal verbosity (LLM optimization - saves ~400-800 tokens)
    // Handlers can still override by passing explicit meta
    if (this.currentVerbosity !== 'minimal') {
      if (meta !== undefined) {
        result._meta = meta;
      } else {
        // Generate metadata with context from the result
        const cellsAffected = this.extractCellsAffected(data);
        result._meta = this.generateMeta(action, data, data, { cellsAffected });
      }
    }
    // Note: No _meta field added when verbosity is minimal - this is intentional

    // DEBUG: Log response structure for sheets_collaborate to diagnose validation issue
    if (this.toolName === 'sheets_collaborate') {
      const logger = getRequestLogger();
      logger.info('[DEBUG] sheets_collaborate response', {
        toolName: this.toolName,
        action,
        successField: result.success,
        successType: typeof result.success,
        successValue: JSON.stringify(result.success),
        keys: Object.keys(result),
        fullResponse: JSON.stringify(result),
      });
    }

    // Apply response compaction to reduce token usage for LLM consumption
    // Respects verbosity level and COMPACT_RESPONSES environment variable
    return compactResponse(result, { verbosity: this.currentVerbosity });
  }

  /**
   * Extract cells affected count from result data
   */
  private extractCellsAffected(data: Record<string, unknown>): number | undefined {
    // Try common field names
    if (typeof data['updatedCells'] === 'number') return data['updatedCells'];
    if (typeof data['cellsAffected'] === 'number') return data['cellsAffected'];
    if (typeof data['cellsFormatted'] === 'number') return data['cellsFormatted'];

    // Try to infer from values array
    const values = data['values'];
    if (Array.isArray(values)) {
      return values.reduce((sum: number, row: unknown) => {
        return sum + (Array.isArray(row) ? row.length : 0);
      }, 0);
    }

    // OK: Explicit empty - typed as optional, cells count cannot be inferred
    return undefined;
  }

  /**
   * Generate response metadata with suggestions and cost estimates
   * Phase 1.5: Smart metadata generation based on verbosity level
   * - minimal: No metadata (handled by caller)
   * - standard: Only costEstimate (saves ~300-600 tokens)
   * - detailed: Full metadata (suggestions, costEstimate, relatedTools, nextSteps)
   */
  protected generateMeta(
    action: string,
    input: Record<string, unknown>,
    result?: Record<string, unknown>,
    options?: {
      cellsAffected?: number;
      apiCallsMade?: number;
      duration?: number;
    }
  ): ResponseMeta {
    const context: EnhancementContext = {
      tool: this.toolName,
      action,
      input,
      result,
      cellsAffected: options?.cellsAffected,
      apiCallsMade: options?.apiCallsMade || 1,
      duration: options?.duration,
    };

    // For standard verbosity, generate lightweight metadata (cost only)
    // This saves ~300-600 tokens while preserving essential cost information
    if (this.currentVerbosity === 'standard') {
      const costEstimate = estimateCost(context);
      return { costEstimate };
    }

    // For detailed verbosity, include full metadata
    return enhanceResponse(context);
  }

  /**
   * Create an error response with enhanced context
   */
  protected error(error: ErrorDetail): HandlerError {
    return {
      success: false,
      error,
    };
  }

  /**
   * Create enhanced error with suggested fixes
   */
  protected enhancedError(
    code: string,
    message: string,
    context?: Record<string, unknown>
  ): HandlerError {
    return createEnhancedError(code, message, context);
  }

  /**
   * Helper: Create "not found" error (SHEET_NOT_FOUND, CHART_NOT_FOUND, etc.)
   */
  protected notFoundError(
    resourceType: string,
    identifier: string | number,
    details?: Record<string, unknown>
  ): HandlerError {
    return this.error({
      code: 'SHEET_NOT_FOUND',
      message: `${resourceType} ${identifier} not found`,
      retryable: false,
      suggestedFix: 'Verify the sheet name or ID is correct',
      details,
    });
  }

  /**
   * Helper: Create "invalid" error (INVALID_RANGE, INVALID_REQUEST, etc.)
   */
  protected invalidError(
    what: string,
    why: string,
    details?: Record<string, unknown>
  ): HandlerError {
    return this.error({
      code: 'INVALID_REQUEST',
      message: `Invalid ${what}: ${why}`,
      retryable: false,
      suggestedFix: 'Verify the request format is correct',
      details,
    });
  }

  /**
   * Map any error to a structured HandlerError
   */
  protected mapError(err: unknown): HandlerError {
    const logger = getRequestLogger();
    if (err instanceof Error) {
      const errAny = err as unknown as Record<string, unknown>;

      const enrichDetail = (detail: ErrorDetail): ErrorDetail => {
        if (detail.resolution || detail.resolutionSteps) {
          return detail;
        }

        const enhanced = enhanceError(detail.code, detail.message, detail.details);
        return {
          ...detail,
          resolution: detail.resolution ?? enhanced.resolution,
          resolutionSteps: detail.resolutionSteps ?? enhanced.resolutionSteps,
          retryable: detail.retryable ?? enhanced.retryable,
        };
      };

      if (typeof errAny['toErrorDetail'] === 'function') {
        const detail = (err as unknown as { toErrorDetail: () => ErrorDetail }).toErrorDetail();
        return this.error(enrichDetail(detail));
      }

      // Check if it's already a structured error (from RangeResolver, PolicyEnforcer, etc.)
      if ('code' in err && typeof errAny['code'] === 'string') {
        const structured = err as Error & {
          code: string;
          details?: Record<string, unknown>;
          retryable?: boolean;
          retryAfterMs?: number;
          resolution?: string;
          resolutionSteps?: string[];
          category?: ErrorDetail['category'];
          severity?: ErrorDetail['severity'];
          retryStrategy?: ErrorDetail['retryStrategy'];
          suggestedTools?: string[];
          suggestedFix?: string;
          alternatives?: ErrorDetail['alternatives'];
        };
        const detail: ErrorDetail = {
          code: structured.code as ErrorDetail['code'],
          message: structured.message,
          details: structured.details,
          retryable: structured.retryable ?? false,
        };

        if (typeof structured.retryAfterMs === 'number') {
          detail.retryAfterMs = structured.retryAfterMs;
        }
        if (typeof structured.resolution === 'string') {
          detail.resolution = structured.resolution;
        }
        if (structured.resolutionSteps) {
          detail.resolutionSteps = structured.resolutionSteps;
        }
        if (structured.category) {
          detail.category = structured.category;
        }
        if (structured.severity) {
          detail.severity = structured.severity;
        }
        if (structured.retryStrategy) {
          detail.retryStrategy = structured.retryStrategy;
        }
        if (structured.suggestedTools) {
          detail.suggestedTools = structured.suggestedTools;
        }
        if (structured.suggestedFix) {
          detail.suggestedFix = structured.suggestedFix;
        }
        if (structured.alternatives) {
          detail.alternatives = structured.alternatives;
        }

        return this.error(enrichDetail(detail));
      }

      // Check if it's a Zod validation error (has `issues` array)
      if (
        'issues' in err &&
        Array.isArray(errAny['issues']) &&
        (errAny['issues'] as unknown[]).length > 0
      ) {
        const issues = errAny['issues'] as Array<{
          code: string;
          path: (string | number)[];
          message: string;
          expected?: string;
          received?: string;
          options?: unknown[];
        }>;
        const zodDetail = createZodValidationError(issues, this.toolName);
        return this.error(enrichDetail(zodDetail));
      }

      // Map Google API errors
      const mapped = this.mapGoogleApiError(err);
      if (mapped.code === 'INTERNAL_ERROR' || mapped.code === 'UNKNOWN_ERROR') {
        logger.error('Handler error', { tool: this.toolName, error: err });
      }
      return this.error(mapped);
    }

    logger.error('Handler error', { tool: this.toolName, error: err });
    return this.error({
      code: 'UNKNOWN_ERROR',
      message: String(err),
      retryable: false,
      suggestedFix: 'Please try again. If the issue persists, contact support',
    });
  }

  /**
   * Map Google API error to ErrorDetail with agent-actionable information
   */
  private mapGoogleApiError(error: Error): ErrorDetail {
    const message = error.message.toLowerCase();

    // Try to extract structured error info from Google API error
    const errorAny = error as unknown as Record<string, unknown>;
    if ('code' in errorAny && typeof errorAny['code'] === 'number') {
      // Use error factory for structured Google API errors
      const googleError = errorAny as {
        code: number;
        message: string;
        errors?: Array<{ domain?: string; reason?: string; message?: string }>;
      };
      const parsed = parseGoogleApiError(googleError);

      // Fix "unknown" resourceId if we have actual spreadsheet ID
      if (this.currentSpreadsheetId && parsed.details?.['resourceId'] === 'unknown') {
        parsed.details['resourceId'] = this.currentSpreadsheetId;
        // Also fix the message text
        if (parsed.message) {
          parsed.message = parsed.message.replace('unknown', this.currentSpreadsheetId);
        }
      }

      return parsed as ErrorDetail;
    }

    // Fallback: Parse from message string

    // Rate limit (429)
    if (message.includes('429') || message.includes('rate limit')) {
      return createRateLimitError({
        quotaType: 'requests',
        retryAfterMs: 60000,
      });
    }

    // Quota exceeded
    if (message.includes('quota exceeded') || message.includes('quota')) {
      return createRateLimitError({
        quotaType: 'requests',
        retryAfterMs: 3600000,
      });
    }

    // Permission denied (403)
    if (
      message.includes('403') ||
      message.includes('permission') ||
      message.includes('forbidden')
    ) {
      return createPermissionError({
        operation: 'perform this operation',
        resourceType: 'spreadsheet',
        currentPermission: 'view',
        requiredPermission: 'edit',
      });
    }

    // Not found (404)
    if (
      message.includes('404') ||
      message.includes('not found') ||
      message.includes('requested entity was not found')
    ) {
      return createNotFoundError({
        resourceType: 'spreadsheet',
        resourceId: this.currentSpreadsheetId || 'unknown (check spreadsheet ID)',
        searchSuggestion: 'Verify the spreadsheet URL and your access permissions',
      });
    }

    // Invalid range
    if (message.includes('unable to parse range') || message.includes('invalid range')) {
      return createValidationError({
        field: 'range',
        value: 'invalid',
        expectedFormat: 'A1 notation (e.g., "Sheet1!A1:C10")',
        reason: 'Range specification could not be parsed',
      });
    }

    // Circular reference
    if (message.includes('circular')) {
      return createValidationError({
        field: 'formula',
        value: 'contains circular reference',
        reason: 'Formula creates a circular dependency',
      });
    }

    // HTTP/2 Connection Errors (transient, auto-recoverable)
    // These occur when Google servers close idle connections or during network issues
    const errorCode = (error as { code?: string }).code;
    if (
      errorCode?.startsWith('ERR_HTTP2') ||
      message.includes('http2') ||
      message.includes('goaway') ||
      message.includes('stream cancel') ||
      message.includes('stream error') ||
      message.includes('session error') ||
      message.includes('new streams cannot be created') ||
      message.includes('the pending stream has been canceled')
    ) {
      return {
        code: 'CONNECTION_ERROR',
        message:
          'HTTP/2 connection was reset by Google servers. This is a temporary network issue.',
        category: 'transient',
        severity: 'medium',
        retryable: true,
        retryAfterMs: 2000,
        resolution: 'The connection will automatically recover. Please retry the operation.',
        resolutionSteps: [
          '1. Wait 2-5 seconds for connection recovery',
          '2. Retry the same operation',
          '3. If error persists after 3 retries, the server may need restart',
          '4. Check network connectivity if issue continues',
        ],
        details: {
          errorCode: errorCode || 'HTTP2_ERROR',
          originalMessage: error.message,
          recoveryAction: 'automatic',
        },
      };
    }

    // Default: internal error
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
      category: 'server',
      severity: 'high',
      retryable: false,
      retryStrategy: 'none',
      resolution:
        'This is an internal error. Check the error message for details or contact support.',
      resolutionSteps: [
        '1. Check the error message for specific details',
        '2. Verify your request parameters are correct',
        '3. If the error persists, report it with the full error message',
      ],
    };
  }

  /**
   * Create mutation summary from execution results
   */
  protected createMutationSummary(results: ExecutionResult[]): MutationSummary | undefined {
    // OK: Explicit empty - typed as optional, no results to summarize
    if (results.length === 0) return undefined;

    const firstResult = results[0];
    // OK: Explicit empty - typed as optional, invalid result
    if (!firstResult) return undefined;

    return {
      cellsAffected:
        firstResult.diff?.tier === 'METADATA'
          ? firstResult.diff.summary.estimatedCellsChanged
          : firstResult.diff?.tier === 'FULL'
            ? firstResult.diff.summary.cellsChanged
            : 0,
      diff: firstResult.diff,
      reversible: !!firstResult.snapshotId,
      revertSnapshotId: firstResult.snapshotId,
    };
  }

  /**
   * Convert column index (0-based) to letter (A, B, ..., Z, AA, AB, ...)
   * Uses memoization for performance on frequently-accessed columns
   */
  protected columnToLetter(index: number): string {
    return memoizedColumnToLetter(index);
  }

  /**
   * Convert column letter to 0-based index
   * Uses memoization for performance on frequently-accessed columns
   */
  protected letterToColumn(letter: string): number {
    return memoizedLetterToColumn(letter);
  }

  /**
   * Track spreadsheet ID for better error messages
   *
   * Call this at the start of handle() to enable better error reporting.
   * This allows error messages to show the actual spreadsheet ID instead of "unknown".
   */
  protected trackSpreadsheetId(spreadsheetId?: string): void {
    this.currentSpreadsheetId = spreadsheetId;
  }

  /**
   * Infer missing parameters from conversational context
   *
   * Phase 1, Task 1.4 - Parameter Inference
   *
   * Automatically fills in spreadsheetId, sheetId, and range from recent operations
   * when they're missing from the current request.
   */
  protected inferRequestParameters<T extends Record<string, unknown>>(request: T): T {
    const contextManager = getContextManager();
    return contextManager.inferParameters(request);
  }

  /**
   * Update conversational context from successful operation
   *
   * Phase 1, Task 1.4 - Parameter Inference
   *
   * Tracks spreadsheetId, sheetId, and range for future parameter inference.
   * Call this after successful operations to maintain context.
   */
  protected trackContextFromRequest(params: {
    spreadsheetId?: string;
    sheetId?: number;
    range?: string;
    sheetName?: string;
  }): void {
    const contextManager = getContextManager();
    contextManager.updateContext(params);
  }

  /**
   * Check if operation requires confirmation
   */
  protected shouldRequireConfirmation(context: SafetyContext): boolean {
    return requiresConfirmation(context);
  }

  /**
   * Auto-confirm destructive operation before execution (Phase 1.3)
   *
   * Automatically requests user confirmation for destructive operations via MCP Elicitation.
   * Handlers should call this BEFORE executing any delete/clear/destructive operation.
   *
   * @param operation - Operation description (e.g., "Delete sheet", "Clear data")
   * @param details - Impact details (e.g., "This will permanently remove 1000 rows")
   * @param context - Safety context with operation metadata
   * @param options - Optional configuration
   * @returns True if user confirmed or no confirmation needed, false if user cancelled
   *
   * @example
   * ```typescript
   * const canProceed = await this.confirmOperation(
   *   `Delete sheet "${sheetName}"`,
   *   `This will permanently remove the sheet and all its data (${rowCount} rows).`,
   *   {
   *     isDestructive: true,
   *     operationType: 'delete_sheet',
   *     affectedRows: rowCount,
   *     spreadsheetId: req.spreadsheetId,
   *   }
   * );
   *
   * if (!canProceed) {
   *   return this.error({
   *     code: 'OPERATION_CANCELLED',
   *     message: 'Operation cancelled by user',
   *     retryable: false,
   suggestedFix: 'Retry the operation',
   *   });
   * }
   * ```
   */
  protected async confirmOperation(
    operation: string,
    details: string,
    context: SafetyContext,
    options?: { skipIfElicitationUnavailable?: boolean }
  ): Promise<boolean> {
    const logger = getRequestLogger();

    // Check if confirmation is required based on safety rules
    if (!this.shouldRequireConfirmation(context)) {
      logger.debug('Operation does not require confirmation', {
        operation,
        isDestructive: context.isDestructive,
        affectedCells: context.affectedCells,
        affectedRows: context.affectedRows,
      });
      return true; // Safe to proceed
    }

    // Check if elicitation server is available
    if (!this.context.server) {
      logger.warn('Elicitation not available for destructive operation', {
        operation,
        skipIfUnavailable: options?.skipIfElicitationUnavailable,
      });

      // If skipIfElicitationUnavailable is true, proceed without confirmation
      // (backward compatibility for clients that don't support elicitation)
      if (options?.skipIfElicitationUnavailable) {
        return true;
      }

      // Otherwise, block the operation for safety
      return false;
    }

    // Import confirmDestructiveAction dynamically to avoid circular dependencies
    const { confirmDestructiveAction } = await import('../mcp/elicitation.js');

    try {
      const confirmation = await confirmDestructiveAction(this.context.server, operation, details);

      logger.info('User confirmation received', {
        operation,
        confirmed: confirmation.confirmed,
        reason: confirmation.reason,
      });

      return confirmation.confirmed;
    } catch (error) {
      logger.error('Confirmation request failed', {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });

      // On error, err on the side of safety (block the operation)
      return false;
    }
  }

  /**
   * Generate safety warnings for operation
   */
  protected getSafetyWarnings(
    context: SafetyContext,
    safetyOptions?: SafetyOptions
  ): SafetyWarning[] {
    return generateSafetyWarnings(context, safetyOptions);
  }

  /**
   * Create snapshot if needed for destructive operation
   */
  protected async createSafetySnapshot(
    context: SafetyContext,
    safetyOptions?: SafetyOptions
  ): Promise<SnapshotResult | null> {
    return createSnapshotIfNeeded(this.context.snapshotService, context, safetyOptions);
  }

  /**
   * Format safety warnings for response
   */
  protected formatWarnings(warnings: SafetyWarning[]): string[] {
    return formatSafetyWarnings(warnings);
  }

  /**
   * Check if should return preview (dry-run mode)
   */
  protected isDryRun(safetyOptions?: SafetyOptions): boolean {
    return shouldReturnPreview(safetyOptions);
  }

  /**
   * Build snapshot info for response
   */
  protected snapshotInfo(snapshot: SnapshotResult | null): Record<string, unknown> | undefined {
    return buildSnapshotInfo(snapshot);
  }

  /**
   * Fetch comprehensive metadata for analysis (Phase 2 optimization)
   *
   * This helper provides a single method for all handlers to fetch comprehensive
   * spreadsheet metadata in ONE API call, instead of making multiple separate calls.
   *
   * Returns cached data if available, otherwise fetches comprehensive metadata
   * including:
   * - All sheet properties
   * - All conditional formats
   * - All protected ranges
   * - All charts
   * - All named ranges
   * - All filter views
   * - All merges
   *
   * Usage in analysis handlers:
   * ```typescript
   * const metadata = await this.fetchComprehensiveMetadata(spreadsheetId, sheetsApi);
   * const sheets = metadata.sheets ?? [];
   * const namedRanges = metadata.namedRanges ?? [];
   * ```
   */
  protected async fetchComprehensiveMetadata(
    spreadsheetId: string,
    sheetsApi: import('googleapis').sheets_v4.Sheets
  ): Promise<import('googleapis').sheets_v4.Schema$Spreadsheet> {
    const { cacheManager, createCacheKey } = await import('../utils/cache-manager.js');
    const { CACHE_TTL_SPREADSHEET } = await import('../config/constants.js');

    // Check cache first
    const cacheKey = createCacheKey('spreadsheet:comprehensive', {
      spreadsheetId,
    });
    const cached = cacheManager.get<import('googleapis').sheets_v4.Schema$Spreadsheet>(
      cacheKey,
      'spreadsheet'
    );

    if (cached) {
      return cached;
    }

    // Fetch comprehensive metadata in ONE call
    const fields = [
      'spreadsheetId',
      'properties',
      'namedRanges',
      'sheets(properties,conditionalFormats,protectedRanges,charts,filterViews,basicFilter,merges)',
    ].join(',');

    const response = await sheetsApi.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
      fields,
    });

    // Cache for 5 minutes
    cacheManager.set(cacheKey, response.data, {
      ttl: CACHE_TTL_SPREADSHEET,
      namespace: 'spreadsheet',
    });

    return response.data;
  }

  /**
   * Validate spreadsheet size before using includeGridData=true without explicit ranges.
   *
   * This prevents fetching massive payloads on large spreadsheets when using
   * includeGridData without bounded ranges. Returns an error if the spreadsheet
   * exceeds safe limits for full grid data retrieval.
   *
   * Use this BEFORE making any sheetsApi.spreadsheets.get() call with:
   * - includeGridData: true AND
   * - ranges: [] (empty/undefined, meaning ALL sheets)
   *
   * Safe limits (conservative to prevent OOM and timeouts):
   * - Max 500,000 cells total across all sheets
   * - Max 50 sheets
   *
   * @param spreadsheetId - The spreadsheet to validate
   * @param sheetsApi - Sheets API instance
   * @param sheetId - Optional: only validate a specific sheet
   * @returns null if safe to proceed, or an error response if too large
   */
  protected async validateGridDataSize(
    spreadsheetId: string,
    sheetsApi: import('googleapis').sheets_v4.Sheets,
    sheetId?: number
  ): Promise<HandlerError | null> {
    const MAX_CELLS_FOR_GRID_DATA = 500_000; // 500K cells
    const MAX_SHEETS_FOR_GRID_DATA = 50;

    try {
      const metadata = await sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',
      });

      const sheets = sheetId
        ? (metadata.data.sheets ?? []).filter((s) => s.properties?.sheetId === sheetId)
        : (metadata.data.sheets ?? []);

      // Check sheet count
      if (sheets.length > MAX_SHEETS_FOR_GRID_DATA) {
        return this.error({
          code: 'SPREADSHEET_TOO_LARGE',
          message: `Spreadsheet has ${sheets.length} sheets (max: ${MAX_SHEETS_FOR_GRID_DATA} for this operation)`,
          retryable: false,
          suggestedFix: 'Split your spreadsheet into smaller files or remove unnecessary data',
          resolution:
            'Specify a sheetId parameter to target a specific sheet instead of all sheets.',
        });
      }

      // Calculate total cells
      const totalCells = sheets.reduce(
        (sum, s) =>
          sum +
          (s.properties?.gridProperties?.rowCount ?? 0) *
            (s.properties?.gridProperties?.columnCount ?? 0),
        0
      );

      if (totalCells > MAX_CELLS_FOR_GRID_DATA) {
        return this.error({
          code: 'SPREADSHEET_TOO_LARGE',
          message: `Spreadsheet has ${totalCells.toLocaleString()} cells (max: ${MAX_CELLS_FOR_GRID_DATA.toLocaleString()} for this operation)`,
          retryable: false,
          suggestedFix: 'Split your spreadsheet into smaller files or remove unnecessary data',
          resolution:
            'Specify a sheetId parameter or use a more targeted range to reduce the data volume.',
          details: {
            totalCells,
            maxCells: MAX_CELLS_FOR_GRID_DATA,
            sheetCount: sheets.length,
          },
        });
      }

      return null; // Safe to proceed
    } catch (error) {
      // If we can't validate size, proceed anyway (fail safely)
      const logger = getRequestLogger();
      logger.warn('Failed to validate grid data size, proceeding anyway', {
        spreadsheetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Apply verbosity filtering to optimize token usage (Phase 1 LLM optimization)
   *
   * Generic implementation that can be overridden by handlers for custom filtering.
   * Handles the most common verbosity filtering patterns:
   * - minimal: Remove _meta, limit arrays to first 5 items, strip technical details
   * - standard: No filtering (return as-is)
   * - detailed: Future enhancement for additional metadata
   *
   * @param response - Response object to filter
   * @param verbosity - Verbosity level
   * @returns Filtered response
   */
  protected applyVerbosityFilter<T extends { success: boolean; _meta?: unknown }>(
    response: T,
    verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'
  ): T {
    // No filtering for errors or standard verbosity
    if (!response.success || verbosity === 'standard') {
      return response;
    }

    if (verbosity === 'minimal') {
      // Minimal: Return only essential fields (60-80% token reduction)
      // OPTIMIZATION: Modify in place instead of spreading entire object (saves 300-600 tokens)
      const filtered = response as Record<string, unknown>;

      // Remove technical metadata
      if ('_meta' in filtered) {
        delete filtered['_meta'];
      }

      // Remove optional verbose fields that aren't essential for LLM decision-making
      const verboseFields = [
        'suggestions',
        'nextSteps',
        'documentation',
        'warnings',
        'relatedTools',
      ];
      for (const field of verboseFields) {
        if (field in filtered) {
          delete filtered[field];
        }
      }

      // Limit large arrays more aggressively (3 items for minimal, with truncation indicator)
      // Preserve: 'values' (essential data), 'headers' (column names), 'sheets' (tab list)
      const preservedArrays = ['values', 'headers', 'sheets', 'rows', 'columns'];
      for (const [key, value] of Object.entries(filtered)) {
        if (Array.isArray(value) && value.length > 3 && !preservedArrays.includes(key)) {
          const truncatedCount = value.length - 3;
          filtered[key] = value.slice(0, 3);
          // Add truncation indicator
          filtered[`${key}Truncated`] = truncatedCount;
        }
      }

      return filtered as T;
    }

    // Detailed: Future enhancement for additional metadata
    return response;
  }

  /**
   * Get sheet ID by name with caching
   *
   * Reduces redundant API calls by caching spreadsheet metadata.
   * Multiple calls within same request will only hit API once.
   */
  protected async getSheetId(
    spreadsheetId: string,
    sheetName?: string,
    sheetsApi?: import('googleapis').sheets_v4.Sheets
  ): Promise<number> {
    // OPTIMIZATION: Use session-level metadata cache if available (N+1 elimination)
    if (this.context.metadataCache) {
      if (!sheetName) {
        // Get first sheet ID
        const metadata = await this.context.metadataCache.getOrFetch(spreadsheetId);
        return metadata.sheets[0]?.sheetId ?? 0;
      }

      // Get sheet ID by name
      const sheetId = await this.context.metadataCache.getSheetId(spreadsheetId, sheetName);
      if (sheetId === undefined) {
        // Sheet not found - provide helpful error
        const metadata = await this.context.metadataCache.getOrFetch(spreadsheetId);
        const availableSheets = metadata.sheets.map((s) => s.title).slice(0, 5);
        const RangeResolutionError = (await import('../core/range-resolver.js'))
          .RangeResolutionError;
        throw new RangeResolutionError(
          `Sheet "${sheetName}" not found. Available sheets: ${availableSheets.join(', ')}${metadata.sheets.length > 5 ? ` (+${metadata.sheets.length - 5} more)` : ''}. Use sheets_core action:"list_sheets" to see all sheets.`,
          'SHEET_NOT_FOUND',
          {
            sheetName,
            spreadsheetId,
            availableSheets,
            hint: 'Sheet names are case-sensitive. Check spelling and use exact name.',
            suggestedAction: 'sheets_core action:"list_sheets"',
          },
          false
        );
      }
      return sheetId;
    }

    // FALLBACK: Use global cache manager (legacy path)
    const { cacheManager, createCacheKey } = await import('../utils/cache-manager.js');
    const { CACHE_TTL_SPREADSHEET } = await import('../config/constants.js');

    // Check cache first
    const cacheKey = createCacheKey('spreadsheet:metadata', {
      spreadsheetId,
    });
    let metadata = cacheManager.get<import('googleapis').sheets_v4.Schema$Spreadsheet>(
      cacheKey,
      'spreadsheet'
    );

    // Fetch if not cached
    if (!metadata) {
      if (!sheetsApi) {
        throw new ServiceError(
          'sheetsApi required when metadata not cached',
          'SERVICE_NOT_INITIALIZED',
          'SheetsAPI',
          false
        );
      }
      const response = await sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties',
      });
      metadata = response.data;

      // Cache for 5 minutes
      cacheManager.set(cacheKey, metadata, {
        ttl: CACHE_TTL_SPREADSHEET,
        namespace: 'spreadsheet',
      });
    }

    const sheets = metadata.sheets ?? [];
    if (!sheetName) {
      return sheets[0]?.properties?.sheetId ?? 0;
    }

    const match = sheets.find((s) => s.properties?.title === sheetName);
    if (!match) {
      const availableSheets = sheets
        .map((s) => s.properties?.title)
        .filter(Boolean)
        .slice(0, 5);
      const RangeResolutionError = (await import('../core/range-resolver.js')).RangeResolutionError;
      throw new RangeResolutionError(
        `Sheet "${sheetName}" not found. Available sheets: ${availableSheets.join(', ')}${sheets.length > 5 ? ` (+${sheets.length - 5} more)` : ''}. Use sheets_core action:"list_sheets" to see all sheets.`,
        'SHEET_NOT_FOUND',
        {
          sheetName,
          spreadsheetId,
          availableSheets,
          hint: 'Sheet names are case-sensitive. Check spelling and use exact name.',
          suggestedAction: 'sheets_core action:"list_sheets"',
        },
        false
      );
    }
    return match.properties?.sheetId ?? 0;
  }

  // ============================================================
  // Shared Helper Methods (extracted from handler duplicates)
  // ============================================================

  /**
   * Execute an API call with request deduplication.
   * Prevents duplicate concurrent and sequential requests within TTL.
   * Expected savings: 30-50% API call reduction.
   *
   * Extracted from: core.ts, data.ts (identical implementations)
   */
  protected async deduplicatedApiCall<T>(cacheKey: string, apiCall: () => Promise<T>): Promise<T> {
    const deduplicator = this.context.requestDeduplicator;
    if (deduplicator) {
      return deduplicator.deduplicate(cacheKey, apiCall);
    }
    return apiCall();
  }

  /**
   * Convert a RangeInput (A1 notation or named range) to a GridRange for batchUpdate requests.
   * Resolves the range, parses A1 notation, and looks up the sheet ID.
   *
   * Extracted from: advanced.ts, dimensions.ts (identical implementations)
   * Note: visualize.ts has a specialized version with comma-separated range handling.
   */
  protected async rangeToGridRange(
    spreadsheetId: string,
    range: RangeInput,
    sheetsApi: sheets_v4.Sheets
  ): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, range);
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, sheetsApi);

    return buildGridRangeInput(
      sheetId,
      parsed.startRow,
      parsed.endRow,
      parsed.startCol,
      parsed.endCol
    );
  }

  /**
   * Convert a Google Sheets Schema$GridRange (with nullable fields) to our GridRangeInput type.
   *
   * Extracted from: advanced.ts, dimensions.ts (identical implementations)
   */
  protected gridRangeToOutput(range: sheets_v4.Schema$GridRange): GridRangeInput {
    return buildGridRangeInput(
      range.sheetId ?? 0,
      range.startRowIndex ?? undefined,
      range.endRowIndex ?? undefined,
      range.startColumnIndex ?? undefined,
      range.endColumnIndex ?? undefined
    );
  }
}
