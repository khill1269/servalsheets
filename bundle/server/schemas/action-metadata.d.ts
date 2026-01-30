/**
 * Action-Level Metadata for AI Cost-Aware Decision Making
 *
 * Provides detailed metadata for all 267 actions across 21 tools.
 * This enables AI to make informed decisions about:
 * - API quota costs
 * - Read-only vs destructive operations
 * - Operations requiring confirmation
 * - Typical latency expectations
 * - Quota savings opportunities
 */
export interface ActionMetadata {
    /** Is this a read-only operation? */
    readOnly: boolean;
    /** Number of Google Sheets API calls (or 'dynamic' if varies) */
    apiCalls: number | 'dynamic';
    /** Quota cost (1 = one API call, or formula for dynamic) */
    quotaCost: number | string;
    /** Does this operation require user confirmation? */
    requiresConfirmation: boolean;
    /** Is this a destructive operation (deletes/modifies data)? */
    destructive: boolean;
    /** Is this operation idempotent (safe to retry)? */
    idempotent: boolean;
    /** Typical latency range */
    typicalLatency?: string;
    /** Quota savings description (for batch operations) */
    savings?: string;
}
/**
 * Complete action metadata for all 267 actions
 */
export declare const ACTION_METADATA: Record<string, Record<string, ActionMetadata>>;
//# sourceMappingURL=action-metadata.d.ts.map