/**
 * ServalSheets - Base Handler
 * 
 * Abstract base class for tool handlers
 * MCP Protocol: 2025-11-25
 */

import type { Intent } from '../core/intent.js';
import type { BatchCompiler, ExecutionResult } from '../core/batch-compiler.js';
import type { RangeResolver } from '../core/range-resolver.js';
import type { SafetyOptions, ErrorDetail, MutationSummary, RangeInput } from '../schemas/shared.js';
import { getRequestLogger } from '../utils/request-context.js';

export interface HandlerContext {
  batchCompiler: BatchCompiler;
  rangeResolver: RangeResolver;
  auth?: {
    hasElevatedAccess: boolean;
    scopes: string[];
  };
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
   */
  protected success<T extends Record<string, unknown>>(
    action: string, 
    data: T, 
    mutation?: MutationSummary, 
    dryRun?: boolean
  ): T & { success: true; action: string; mutation?: MutationSummary; dryRun?: boolean } {
    const result: T & { success: true; action: string; mutation?: MutationSummary; dryRun?: boolean } = {
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
    
    return result;
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
   * Map Google API error to ErrorDetail
   */
  private mapGoogleApiError(error: Error): ErrorDetail {
    const message = error.message.toLowerCase();
    
    // Rate limit (429)
    if (message.includes('429') || message.includes('rate limit') || message.includes('quota exceeded')) {
      return {
        code: 'RATE_LIMITED',
        message: 'API rate limit exceeded',
        retryable: true,
        retryAfterMs: 60000,
        suggestedFix: 'Wait a minute and try again',
      };
    }
    
    // Permission denied (403)
    if (message.includes('403') || message.includes('permission') || message.includes('forbidden')) {
      return {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied',
        retryable: false,
        suggestedFix: 'Check that you have edit access to the spreadsheet',
      };
    }
    
    // Not found (404)
    if (message.includes('404') || message.includes('not found') || message.includes('requested entity was not found')) {
      return {
        code: 'SPREADSHEET_NOT_FOUND',
        message: 'Spreadsheet or sheet not found',
        retryable: false,
        suggestedFix: 'Check the spreadsheet ID and sheet name',
      };
    }
    
    // Quota exceeded
    if (message.includes('quota')) {
      return {
        code: 'QUOTA_EXCEEDED',
        message: 'API quota exceeded',
        retryable: true,
        retryAfterMs: 3600000,
        suggestedFix: 'Wait an hour or request quota increase',
      };
    }
    
    // Invalid range
    if (message.includes('unable to parse range') || message.includes('invalid range')) {
      return {
        code: 'INVALID_RANGE',
        message: 'Invalid range specification',
        retryable: false,
        suggestedFix: 'Check the range format (e.g., "Sheet1!A1:C10")',
      };
    }
    
    // Circular reference
    if (message.includes('circular')) {
      return {
        code: 'CIRCULAR_REFERENCE',
        message: 'Circular reference detected in formula',
        retryable: false,
        suggestedFix: 'Check formula references for circular dependencies',
      };
    }

    // Default: internal error
    return {
      code: 'INTERNAL_ERROR',
      message: error.message,
      retryable: false,
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
}
