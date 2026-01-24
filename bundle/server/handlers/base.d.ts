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
import type { SamplingServer } from '../mcp/sampling.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import type { CircuitBreaker } from '../utils/circuit-breaker.js';
import { type SafetyContext, type SafetyWarning, type SnapshotResult } from '../utils/safety-helpers.js';
export interface HandlerContext {
    batchCompiler: BatchCompiler;
    rangeResolver: RangeResolver;
    googleClient?: import('../services/google-api.js').GoogleApiClient | null;
    batchingSystem?: import('../services/batching-system.js').BatchingSystem;
    snapshotService?: import('../services/snapshot.js').SnapshotService;
    auth?: {
        hasElevatedAccess: boolean;
        scopes: string[];
    };
    samplingServer?: SamplingServer;
    requestDeduplicator?: RequestDeduplicator;
    circuitBreaker?: CircuitBreaker;
    elicitationServer?: import('../mcp/elicitation.js').ElicitationServer;
    server?: import('@modelcontextprotocol/sdk/server/index.js').Server;
    taskStore?: import('../core/task-store-adapter.js').TaskStoreAdapter;
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
export declare function unwrapRequest<TRequest extends Record<string, unknown>>(input: {
    request?: TRequest;
} | TRequest): TRequest;
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
export declare abstract class BaseHandler<TInput, TOutput> {
    protected context: HandlerContext;
    protected toolName: string;
    protected currentSpreadsheetId?: string;
    constructor(toolName: string, context: HandlerContext);
    /**
     * Require authentication before executing tool
     * Throws clear error with step-by-step instructions if not authenticated
     */
    protected requireAuth(): void;
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
    protected executeIntents(intents: Intent[], safety?: SafetyOptions): Promise<ExecutionResult[]>;
    /**
     * Resolve a range input to A1 notation
     */
    protected resolveRange(spreadsheetId: string, range: RangeInput): Promise<string>;
    /**
     * Create a success response - FLAT structure matching outputSchema
     * Data fields are spread directly into the result (not nested under 'data')
     * Automatically generates response metadata if not provided
     */
    protected success<A extends string, T extends Record<string, unknown>>(action: A, data: T, mutation?: MutationSummary, dryRun?: boolean, meta?: ResponseMeta): T & {
        success: true;
        action: A;
        mutation?: MutationSummary;
        dryRun?: boolean;
        _meta?: ResponseMeta;
    };
    /**
     * Extract cells affected count from result data
     */
    private extractCellsAffected;
    /**
     * Generate response metadata with suggestions and cost estimates
     */
    protected generateMeta(action: string, input: Record<string, unknown>, result?: Record<string, unknown>, options?: {
        cellsAffected?: number;
        apiCallsMade?: number;
        duration?: number;
    }): ResponseMeta;
    /**
     * Create an error response with enhanced context
     */
    protected error(error: ErrorDetail): HandlerError;
    /**
     * Create enhanced error with suggested fixes
     */
    protected enhancedError(code: string, message: string, context?: Record<string, unknown>): HandlerError;
    /**
     * Helper: Create "not found" error (SHEET_NOT_FOUND, CHART_NOT_FOUND, etc.)
     */
    protected notFoundError(resourceType: string, identifier: string | number, details?: Record<string, unknown>): HandlerError;
    /**
     * Helper: Create "invalid" error (INVALID_RANGE, INVALID_REQUEST, etc.)
     */
    protected invalidError(what: string, why: string, details?: Record<string, unknown>): HandlerError;
    /**
     * Map any error to a structured HandlerError
     */
    protected mapError(err: unknown): HandlerError;
    /**
     * Map Google API error to ErrorDetail with agent-actionable information
     */
    private mapGoogleApiError;
    /**
     * Create mutation summary from execution results
     */
    protected createMutationSummary(results: ExecutionResult[]): MutationSummary | undefined;
    /**
     * Convert column index (0-based) to letter (A, B, ..., Z, AA, AB, ...)
     * Uses memoization for performance on frequently-accessed columns
     */
    protected columnToLetter(index: number): string;
    /**
     * Convert column letter to 0-based index
     * Uses memoization for performance on frequently-accessed columns
     */
    protected letterToColumn(letter: string): number;
    /**
     * Track spreadsheet ID for better error messages
     *
     * Call this at the start of handle() to enable better error reporting.
     * This allows error messages to show the actual spreadsheet ID instead of "unknown".
     */
    protected trackSpreadsheetId(spreadsheetId?: string): void;
    /**
     * Infer missing parameters from conversational context
     *
     * Phase 1, Task 1.4 - Parameter Inference
     *
     * Automatically fills in spreadsheetId, sheetId, and range from recent operations
     * when they're missing from the current request.
     */
    protected inferRequestParameters<T extends Record<string, unknown>>(request: T): T;
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
    }): void;
    /**
     * Check if operation requires confirmation
     */
    protected shouldRequireConfirmation(context: SafetyContext): boolean;
    /**
     * Generate safety warnings for operation
     */
    protected getSafetyWarnings(context: SafetyContext, safetyOptions?: SafetyOptions): SafetyWarning[];
    /**
     * Create snapshot if needed for destructive operation
     */
    protected createSafetySnapshot(context: SafetyContext, safetyOptions?: SafetyOptions): Promise<SnapshotResult | null>;
    /**
     * Format safety warnings for response
     */
    protected formatWarnings(warnings: SafetyWarning[]): string[];
    /**
     * Check if should return preview (dry-run mode)
     */
    protected isDryRun(safetyOptions?: SafetyOptions): boolean;
    /**
     * Build snapshot info for response
     */
    protected snapshotInfo(snapshot: SnapshotResult | null): Record<string, unknown> | undefined;
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
    protected fetchComprehensiveMetadata(spreadsheetId: string, sheetsApi: import('googleapis').sheets_v4.Sheets): Promise<import('googleapis').sheets_v4.Schema$Spreadsheet>;
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
    protected applyVerbosityFilter<T extends {
        success: boolean;
        _meta?: unknown;
    }>(response: T, verbosity?: 'minimal' | 'standard' | 'detailed'): T;
    /**
     * Get sheet ID by name with caching
     *
     * Reduces redundant API calls by caching spreadsheet metadata.
     * Multiple calls within same request will only hit API once.
     */
    protected getSheetId(spreadsheetId: string, sheetName?: string, sheetsApi?: import('googleapis').sheets_v4.Sheets): Promise<number>;
}
//# sourceMappingURL=base.d.ts.map