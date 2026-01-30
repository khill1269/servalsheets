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
import type { SafetyOptions, ErrorDetail, MutationSummary, RangeInput, ResponseMeta } from '../schemas/shared.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import type { CircuitBreaker } from '../utils/circuit-breaker.js';
import { type SafetyContext, type SafetyWarning, type SnapshotResult } from '../utils/safety-helpers.js';
declare const COLUMN_LETTERS: string[];
declare const LETTER_TO_COLUMN: Map<string, number>;
export { COLUMN_LETTERS, LETTER_TO_COLUMN };
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
/**
 * Optimized Base Handler
 *
 * Key optimizations:
 * - Lazy initialization of context manager
 * - Pre-computed column letter lookups
 * - Reduced object allocations in success/error paths
 * - Inline error mapping for common cases
 */
export declare abstract class OptimizedBaseHandler<TInput, TOutput> {
    protected readonly context: HandlerContext;
    protected readonly toolName: string;
    protected currentSpreadsheetId?: string;
    private _contextManager?;
    constructor(toolName: string, context: HandlerContext);
    abstract handle(input: TInput): Promise<TOutput>;
    protected abstract createIntents(input: TInput): Intent[];
    /**
     * Execute intents through batch compiler
     */
    protected executeIntents(intents: Intent[], safety?: SafetyOptions): Promise<ExecutionResult[]>;
    /**
     * Resolve range using range resolver
     */
    protected resolveRange(spreadsheetId: string, range: RangeInput): Promise<string>;
    /**
     * Optimized success response builder
     * - Single object allocation
     * - Conditional field assignment (avoids undefined properties)
     */
    protected success<T extends Record<string, unknown>>(action: string, data: T, mutation?: MutationSummary, dryRun?: boolean): HandlerResult<T>;
    /**
     * Optimized error response
     */
    protected error(error: ErrorDetail): HandlerError;
    /**
     * Optimized error mapping with fast paths for common cases
     */
    protected mapError(err: unknown): HandlerError;
    /**
     * Map Google API error - inlined for performance
     */
    private mapGoogleApiError;
    /**
     * Create mutation summary from execution results
     */
    protected createMutationSummary(results: ExecutionResult[]): MutationSummary | undefined;
    /**
     * Column index to letter - O(1) lookup for common columns
     */
    protected columnToLetter(index: number): string;
    /**
     * Letter to column index - O(1) lookup for common columns
     */
    protected letterToColumn(letter: string): number;
    /**
     * Track spreadsheet ID for error context
     */
    protected trackSpreadsheetId(spreadsheetId?: string): void;
    /**
     * Infer parameters from context - lazy init
     */
    protected inferRequestParameters<T extends Record<string, unknown>>(request: T): T;
    /**
     * Track context from request - lazy init
     */
    protected trackContextFromRequest(params: {
        spreadsheetId?: string;
        sheetId?: number;
        range?: string;
        sheetName?: string;
    }): void;
    protected shouldRequireConfirmation(context: SafetyContext): boolean;
    protected getSafetyWarnings(context: SafetyContext, safetyOptions?: SafetyOptions): SafetyWarning[];
    protected createSafetySnapshot(context: SafetyContext, safetyOptions?: SafetyOptions): Promise<SnapshotResult | null>;
    protected formatWarnings(warnings: SafetyWarning[]): string[];
    protected isDryRun(safetyOptions?: SafetyOptions): boolean;
    protected snapshotInfo(snapshot: SnapshotResult | null): Record<string, unknown> | undefined;
    /**
     * Fetch comprehensive metadata with caching
     */
    protected fetchComprehensiveMetadata(spreadsheetId: string, sheetsApi: import('googleapis').sheets_v4.Sheets): Promise<import('googleapis').sheets_v4.Schema$Spreadsheet>;
}
export { OptimizedBaseHandler as BaseHandler };
//# sourceMappingURL=base-optimized.d.ts.map