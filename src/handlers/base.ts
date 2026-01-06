/**
 * ServalSheets - Base Handler
 * 
 * Abstract base class for tool handlers
 * MCP Protocol: 2025-11-25
 */

import type { Intent } from '../core/intent.js';
import type { BatchCompiler, ExecutionResult } from '../core/batch-compiler.js';
import type { RangeResolver } from '../core/range-resolver.js';
import type { SafetyOptions, ErrorDetail, MutationSummary, RangeInput, ResponseMeta } from '../schemas/shared.js';
import { getRequestLogger } from '../utils/request-context.js';
import {
  createPermissionError,
  createRateLimitError,
  createNotFoundError,
  createValidationError,
  parseGoogleApiError,
} from '../utils/error-factory.js';
import { enhanceResponse, type EnhancementContext } from '../utils/response-enhancer.js';
import type { SamplingServer } from '../mcp/sampling.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import type { CircuitBreaker } from '../utils/circuit-breaker.js';
import { getContextManager } from '../services/context-manager.js';

export interface HandlerContext {
  batchCompiler: BatchCompiler;
  rangeResolver: RangeResolver;
  auth?: {
    hasElevatedAccess: boolean;
    scopes: string[];
  };
  samplingServer?: SamplingServer;
  requestDeduplicator?: RequestDeduplicator;
  circuitBreaker?: CircuitBreaker;
  elicitationServer?: import('../mcp/elicitation.js').ElicitationServer;
  logger?: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  abortSignal?: AbortSignal;
  requestId?: string;
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
 * Base handler with common utilities
 */
export abstract class BaseHandler<TInput, TOutput> {
  protected context: HandlerContext;
  protected toolName: string;

  constructor(toolName: string, context: HandlerContext) {
    this.toolName = toolName;
    this.context = context;
  }

  /**
   * Handle the input and return output
   */
  abstract handle(input: TInput): Promise<TOutput>;

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
  protected async resolveRange(
    spreadsheetId: string,
    range: RangeInput
  ): Promise<string> {
    const resolved = await this.context.rangeResolver.resolve(spreadsheetId, range);
    return resolved.a1Notation;
  }

  /**
   * Create a success response - FLAT structure matching outputSchema
   * Data fields are spread directly into the result (not nested under 'data')
   * Automatically generates response metadata if not provided
   */
  protected success<T extends Record<string, unknown>>(
    action: string,
    data: T,
    mutation?: MutationSummary,
    dryRun?: boolean,
    meta?: ResponseMeta
  ): T & { success: true; action: string; mutation?: MutationSummary; dryRun?: boolean; _meta?: ResponseMeta } {
    const result: T & { success: true; action: string; mutation?: MutationSummary; dryRun?: boolean; _meta?: ResponseMeta } = {
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
    // Handlers can still override by passing explicit meta
    if (meta !== undefined) {
      result._meta = meta;
    } else {
      // Generate metadata with context from the result
      const cellsAffected = this.extractCellsAffected(data);
      result._meta = this.generateMeta(action, data, data, { cellsAffected });
    }

    return result;
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

    return undefined;
  }

  /**
   * Generate response metadata with suggestions and cost estimates
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

    return enhanceResponse(context);
  }

  /**
   * Create an error response
   */
  protected error(error: ErrorDetail): HandlerError {
    return {
      success: false,
      error,
    };
  }

  /**
   * Map any error to a structured HandlerError
   */
  protected mapError(err: unknown): HandlerError {
    const logger = getRequestLogger();
    if (err instanceof Error) {
      // Check if it's already a structured error (from RangeResolver, PolicyEnforcer, etc.)
      const errAny = err as unknown as Record<string, unknown>;
      if ('code' in err && typeof errAny['code'] === 'string') {
        const structured = err as Error & { code: string; details?: Record<string, unknown>; retryable?: boolean };
        return this.error({
          code: structured.code as ErrorDetail['code'],
          message: structured.message,
          details: structured.details,
          retryable: structured.retryable ?? false,
        });
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
      const googleError = errorAny as { code: number; message: string; errors?: Array<{ domain?: string; reason?: string; message?: string }> };
      const parsed = parseGoogleApiError(googleError);
      return parsed as ErrorDetail;
    }

    // Fallback: Parse from message string

    // Rate limit (429)
    if (message.includes('429') || message.includes('rate limit')) {
      return createRateLimitError({ quotaType: 'requests', retryAfterMs: 60000 });
    }

    // Quota exceeded
    if (message.includes('quota exceeded') || message.includes('quota')) {
      return createRateLimitError({ quotaType: 'requests', retryAfterMs: 3600000 });
    }

    // Permission denied (403)
    if (message.includes('403') || message.includes('permission') || message.includes('forbidden')) {
      return createPermissionError({
        operation: 'perform this operation',
        resourceType: 'spreadsheet',
        currentPermission: 'view',
        requiredPermission: 'edit',
      });
    }

    // Not found (404)
    if (message.includes('404') || message.includes('not found') || message.includes('requested entity was not found')) {
      return createNotFoundError({
        resourceType: 'spreadsheet',
        resourceId: 'unknown (check spreadsheet ID)',
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

    // Default: internal error
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
      category: 'server',
      severity: 'high',
      retryable: false,
      retryStrategy: 'none',
      resolution: 'This is an internal error. Check the error message for details or contact support.',
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
    if (results.length === 0) return undefined;

    const firstResult = results[0];
    if (!firstResult) return undefined;

    return {
      cellsAffected: firstResult.diff?.tier === 'METADATA' 
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
   */
  protected columnToLetter(index: number): string {
    let letter = '';
    let temp = index + 1;
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - 1) / 26);
    }
    return letter;
  }

  /**
   * Convert column letter to 0-based index
   */
  protected letterToColumn(letter: string): number {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1;
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
}
