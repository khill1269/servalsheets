/**
 * ServalSheets - Batch Compiler
 *
 * Phase 2.1: Direct Google API Request Compilation
 * Phase 3: Response Metadata Parsing (Eliminates Compensatory Diff Pattern)
 *
 * Compiles WrappedRequests (from RequestBuilder) into batched Google Sheets API calls
 *
 * Architecture Changes:
 * - Phase 2.1: Intents → WrappedRequests (direct Google API format)
 * - Phase 3: Eliminated before/after state captures (3→1 API calls per mutation)
 *
 * OLD Pattern (3 API calls):
 *   1. captureState (before)
 *   2. batchUpdate (mutation)
 *   3. captureState (after)
 *
 * NEW Pattern (1 API call):
 *   1. batchUpdate (mutation) → ResponseParser extracts metadata
 */
import type { sheets_v4 } from 'googleapis';
import type { WrappedRequest } from './request-builder.js';
import type { Intent } from './intent.js';
import type { RateLimiter } from './rate-limiter.js';
import type { DiffEngine } from './diff-engine.js';
import type { PolicyEnforcer } from './policy-enforcer.js';
import type { SnapshotService } from '../services/snapshot.js';
import type { SafetyOptions, DiffResult, ErrorDetail } from '../schemas/shared.js';
import { type PayloadMetrics } from '../utils/payload-monitor.js';
import { type ParsedResponseMetadata } from './response-parser.js';
export interface CompiledBatch {
    spreadsheetId: string;
    requests: sheets_v4.Schema$Request[];
    estimatedCells: number;
    destructive: boolean;
    highRisk: boolean;
    requestCount: number;
}
export interface ExecutionResult {
    success: boolean;
    spreadsheetId: string;
    responses: sheets_v4.Schema$Response[];
    diff?: DiffResult;
    responseMetadata?: ParsedResponseMetadata;
    snapshotId?: string | undefined;
    error?: ErrorDetail;
    dryRun: boolean;
    payloadMetrics?: PayloadMetrics;
}
export interface ProgressEvent {
    phase: 'validating' | 'compiling' | 'executing' | 'capturing_diff';
    current: number;
    total: number;
    message: string;
    spreadsheetId?: string;
}
export interface BatchCompilerOptions {
    rateLimiter: RateLimiter;
    diffEngine: DiffEngine;
    policyEnforcer: PolicyEnforcer;
    snapshotService: SnapshotService;
    sheetsApi: sheets_v4.Sheets;
    onProgress?: (event: ProgressEvent) => void;
}
export interface SafetyExecutionOptions {
    spreadsheetId: string;
    safety?: SafetyOptions;
    estimatedCells?: number;
    destructive?: boolean;
    highRisk?: boolean;
    range?: string;
    operation: () => Promise<void>;
    diffOptions?: {
        tier?: 'METADATA' | 'SAMPLE' | 'FULL';
        sampleSize?: number;
        maxFullDiffCells?: number;
    };
}
/**
 * Compiles intents into Google Sheets API requests and executes them
 */
export declare class BatchCompiler {
    private rateLimiter;
    private diffEngine;
    private policyEnforcer;
    private snapshotService;
    private sheetsApi;
    private onProgress?;
    constructor(options: BatchCompilerOptions);
    /**
     * Compile WrappedRequests into batched API requests
     *
     * Phase 2.1: Simplified architecture - requests are already in Google API format,
     * no transformation needed! Just group, validate, and batch.
     *
     * Backward Compatibility: Also accepts Intent[] for gradual migration
     */
    compile(requests: WrappedRequest[] | Intent[]): Promise<CompiledBatch[]>;
    /**
     * Execute a compiled batch with safety rails
     */
    execute(batch: CompiledBatch, safety?: SafetyOptions): Promise<ExecutionResult>;
    /**
     * Execute a custom operation with safety rails and diff capture
     */
    executeWithSafety(options: SafetyExecutionOptions): Promise<ExecutionResult>;
    /**
     * Execute multiple batches with parallelization by spreadsheet
     * Batches for different spreadsheets run in parallel
     * Batches for the same spreadsheet run sequentially (maintains safety)
     */
    executeAll(batches: CompiledBatch[], safety?: SafetyOptions): Promise<ExecutionResult[]>;
    /**
     * Group WrappedRequests by spreadsheet ID
     *
     * Phase 2.1: Updated to work with WrappedRequest metadata instead of Intent
     */
    private groupBySpreadsheet;
    /**
     * Check if input is Intent[] (for backward compatibility)
     */
    private isIntentArray;
    /**
     * Convert Intent[] to WrappedRequest[] for backward compatibility
     *
     * Phase 2.1: Temporary bridge during migration. Handlers will gradually
     * switch to using RequestBuilder directly.
     */
    private convertIntentsToWrappedRequests;
    private mergeCompatibleRequests;
    private chunkRequests;
    /**
     * Estimate total cells affected by a group of WrappedRequests
     *
     * Phase 2.1: Updated to use WrappedRequest metadata
     */
    private estimateCells;
    private checkExpectedState;
    private mapGoogleError;
}
//# sourceMappingURL=batch-compiler.d.ts.map