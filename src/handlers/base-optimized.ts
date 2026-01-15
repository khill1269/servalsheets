/**
 * ServalSheets - Optimized Base Handler
 *
 * Performance-optimized base class for all handlers.
 *
 * Optimizations:
 * 1. Removed unnecessary async/await chains
 * 2. Inlined hot path operations
 * 3. Lazy initialization of heavy objects
 * 4. Pre-computed constants (column letters)
 * 5. Cached method bindings
 * 6. Reduced object allocations
 */

import type { Intent } from '../core/intent.js';
import type { BatchCompiler, ExecutionResult } from '../core/batch-compiler.js';
import type { RangeResolver } from '../core/range-resolver.js';
import type {
  SafetyOptions,
  ErrorDetail,
  MutationSummary,
  RangeInput,
  ResponseMeta,
} from '../schemas/shared.js';
import { parseGoogleApiError, createNotFoundError } from '../utils/error-factory.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import type { CircuitBreaker } from '../utils/circuit-breaker.js';
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

// ============================================================================
// PRE-COMPUTED CONSTANTS
// ============================================================================

// Pre-computed column letters (A-ZZ) - 702 columns
const COLUMN_LETTERS: string[] = [];
for (let i = 0; i < 702; i++) {
  let letter = '';
  let temp = i + 1;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  COLUMN_LETTERS.push(letter);
}

// Pre-computed letter to column map for reverse lookup
const LETTER_TO_COLUMN = new Map<string, number>();
for (let i = 0; i < COLUMN_LETTERS.length; i++) {
  LETTER_TO_COLUMN.set(COLUMN_LETTERS[i]!, i);
}

// Export for use in other modules
export { COLUMN_LETTERS, LETTER_TO_COLUMN };

// ============================================================================
// TYPES
// ============================================================================

export interface HandlerContext {
  batchCompiler: BatchCompiler;
  rangeResolver: RangeResolver;
  batchingSystem?: import('../services/batching-system.js').BatchingSystem;
  snapshotService?: import('../services/snapshot.js').SnapshotService;
  auth?: {
    hasElevatedAccess: boolean;
    scopes: string[];
  };
  samplingServer?: import('@modelcontextprotocol/sdk/server/index.js').Server;
  requestDeduplicator?: RequestDeduplicator;
  circuitBreaker?: CircuitBreaker;
  elicitationServer?: import('../mcp/elicitation.js').ElicitationServer;
  server?: import('@modelcontextprotocol/sdk/server/index.js').Server;
  logger?: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
  abortSignal?: AbortSignal;
  requestId?: string;
}

export type HandlerResult<T extends Record<string, unknown>> = T & {
  success: true;
  action: string;
  mutation?: MutationSummary;
  dryRun?: boolean;
  _meta?: ResponseMeta;
};

export interface HandlerError {
  success: false;
  error: ErrorDetail;
}

export type HandlerOutput<T extends Record<string, unknown>> = HandlerResult<T> | HandlerError;

// ============================================================================
// OPTIMIZED BASE HANDLER
// ============================================================================

/**
 * Optimized Base Handler
 *
 * Key optimizations:
 * - Lazy initialization of context manager
 * - Pre-computed column letter lookups
 * - Reduced object allocations in success/error paths
 * - Inline error mapping for common cases
 */
export abstract class OptimizedBaseHandler<TInput, TOutput> {
  protected readonly context: HandlerContext;
  protected readonly toolName: string;
  protected currentSpreadsheetId?: string;

  // Lazy-initialized context manager
  private _contextManager?: ReturnType<typeof getContextManager>;

  constructor(toolName: string, context: HandlerContext) {
    this.toolName = toolName;
    this.context = context;
  }

  abstract handle(input: TInput): Promise<TOutput>;
  protected abstract createIntents(input: TInput): Intent[];

  /**
   * Execute intents through batch compiler
   */
  protected async executeIntents(
    intents: Intent[],
    safety?: SafetyOptions
  ): Promise<ExecutionResult[]> {
    const batches = await this.context.batchCompiler.compile(intents);
    return this.context.batchCompiler.executeAll(batches, safety);
  }

  /**
   * Resolve range using range resolver
   */
  protected async resolveRange(spreadsheetId: string, range: RangeInput): Promise<string> {
    const resolved = await this.context.rangeResolver.resolve(spreadsheetId, range);
    return resolved.a1Notation;
  }

  /**
   * Optimized success response builder
   * - Single object allocation
   * - Conditional field assignment (avoids undefined properties)
   */
  protected success<T extends Record<string, unknown>>(
    action: string,
    data: T,
    mutation?: MutationSummary,
    dryRun?: boolean
  ): HandlerResult<T> {
    const result = {
      success: true as const,
      action,
      ...data,
    } as HandlerResult<T>;

    // Only add optional fields if they have values
    if (mutation) result.mutation = mutation;
    if (dryRun !== undefined) result.dryRun = dryRun;

    return result;
  }

  /**
   * Optimized error response
   */
  protected error(error: ErrorDetail): HandlerError {
    return { success: false, error };
  }

  /**
   * Optimized error mapping with fast paths for common cases
   */
  protected mapError(err: unknown): HandlerError {
    // Fast path: already structured error
    if (err && typeof err === 'object' && 'code' in err) {
      const structured = err as {
        code: string;
        message: string;
        details?: Record<string, unknown>;
        retryable?: boolean;
      };
      return this.error({
        code: structured.code as ErrorDetail['code'],
        message: structured.message,
        details: structured.details,
        retryable: structured.retryable ?? false,
      });
    }

    // Error instance path
    if (err instanceof Error) {
      return this.error(this.mapGoogleApiError(err));
    }

    // Unknown error fallback
    return this.error({
      code: 'UNKNOWN_ERROR',
      message: String(err),
      retryable: false,
    });
  }

  /**
   * Map Google API error - inlined for performance
   */
  private mapGoogleApiError(error: Error): ErrorDetail {
    const errorAny = error as unknown as Record<string, unknown>;

    // Fast path: structured Google API error with numeric code
    if (typeof errorAny['code'] === 'number') {
      const parsed = parseGoogleApiError(
        errorAny as {
          code?: number;
          message?: string;
          status?: string;
          errors?: { domain?: string; reason?: string; message?: string }[];
        }
      );
      if (this.currentSpreadsheetId && parsed.details?.['resourceId'] === 'unknown') {
        parsed.details['resourceId'] = this.currentSpreadsheetId;
      }
      return parsed as ErrorDetail;
    }

    // String-based detection (slower path)
    const message = error.message.toLowerCase();

    if (message.includes('429') || message.includes('rate limit')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Rate limited. Retry in 60 seconds.',
        retryable: true,
      };
    }
    if (message.includes('403') || message.includes('permission')) {
      return {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied.',
        retryable: false,
      };
    }
    if (message.includes('404') || message.includes('not found')) {
      return createNotFoundError({
        resourceType: 'spreadsheet',
        resourceId: this.currentSpreadsheetId || 'unknown',
        searchSuggestion: 'Verify the spreadsheet ID is correct and you have access to it',
      });
    }
    if (message.includes('unable to parse range')) {
      return {
        code: 'INVALID_PARAMS',
        message: 'Invalid range format',
        retryable: false,
      };
    }

    return { code: 'INTERNAL_ERROR', message: error.message, retryable: false };
  }

  /**
   * Create mutation summary from execution results
   */
  protected createMutationSummary(results: ExecutionResult[]): MutationSummary | undefined {
    const firstResult = results[0];
    // OK: Explicit empty - typed as optional, no execution results
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
   * Column index to letter - O(1) lookup for common columns
   */
  protected columnToLetter(index: number): string {
    if (index < COLUMN_LETTERS.length) {
      return COLUMN_LETTERS[index]!;
    }
    // Fallback for very large indices (beyond ZZ)
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
   * Letter to column index - O(1) lookup for common columns
   */
  protected letterToColumn(letter: string): number {
    const cached = LETTER_TO_COLUMN.get(letter);
    if (cached !== undefined) return cached;

    // Fallback computation
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  /**
   * Track spreadsheet ID for error context
   */
  protected trackSpreadsheetId(spreadsheetId?: string): void {
    this.currentSpreadsheetId = spreadsheetId;
  }

  /**
   * Infer parameters from context - lazy init
   */
  protected inferRequestParameters<T extends Record<string, unknown>>(request: T): T {
    if (!this._contextManager) {
      this._contextManager = getContextManager();
    }
    return this._contextManager.inferParameters(request);
  }

  /**
   * Track context from request - lazy init
   */
  protected trackContextFromRequest(params: {
    spreadsheetId?: string;
    sheetId?: number;
    range?: string;
    sheetName?: string;
  }): void {
    if (!this._contextManager) {
      this._contextManager = getContextManager();
    }
    this._contextManager.updateContext(params);
  }

  // Safety helpers - direct delegation (no wrapper overhead)
  protected shouldRequireConfirmation(context: SafetyContext): boolean {
    return requiresConfirmation(context);
  }

  protected getSafetyWarnings(
    context: SafetyContext,
    safetyOptions?: SafetyOptions
  ): SafetyWarning[] {
    return generateSafetyWarnings(context, safetyOptions);
  }

  protected async createSafetySnapshot(
    context: SafetyContext,
    safetyOptions?: SafetyOptions
  ): Promise<SnapshotResult | null> {
    return createSnapshotIfNeeded(this.context.snapshotService, context, safetyOptions);
  }

  protected formatWarnings(warnings: SafetyWarning[]): string[] {
    return formatSafetyWarnings(warnings);
  }

  protected isDryRun(safetyOptions?: SafetyOptions): boolean {
    return shouldReturnPreview(safetyOptions);
  }

  protected snapshotInfo(snapshot: SnapshotResult | null): Record<string, unknown> | undefined {
    return buildSnapshotInfo(snapshot);
  }

  /**
   * Fetch comprehensive metadata with caching
   */
  protected async fetchComprehensiveMetadata(
    spreadsheetId: string,
    sheetsApi: import('googleapis').sheets_v4.Sheets
  ): Promise<import('googleapis').sheets_v4.Schema$Spreadsheet> {
    const { cacheManager, createCacheKey } = await import('../utils/cache-manager.js');
    const { CACHE_TTL_SPREADSHEET } = await import('../config/constants.js');

    const cacheKey = createCacheKey('spreadsheet:comprehensive', {
      spreadsheetId,
    });
    const cached = cacheManager.get<import('googleapis').sheets_v4.Schema$Spreadsheet>(
      cacheKey,
      'spreadsheet'
    );

    if (cached) return cached;

    const response = await sheetsApi.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
      fields:
        'spreadsheetId,properties,namedRanges,sheets(properties,conditionalFormats,protectedRanges,charts,filterViews,basicFilter,merges)',
    });

    cacheManager.set(cacheKey, response.data, {
      ttl: CACHE_TTL_SPREADSHEET,
      namespace: 'spreadsheet',
    });
    return response.data;
  }
}

// Re-export as BaseHandler for drop-in replacement
export { OptimizedBaseHandler as BaseHandler };
