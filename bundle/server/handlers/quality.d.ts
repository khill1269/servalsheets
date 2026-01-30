/**
 * ServalSheets - Quality Handler
 *
 * Enterprise quality assurance combining validation, conflict detection, and impact analysis.
 *
 * Actions (4):
 * - validate: Data validation with built-in validators
 * - detect_conflicts: Detect concurrent modification conflicts
 * - resolve_conflict: Resolve detected conflicts with strategies
 * - analyze_impact: Pre-execution impact analysis with dependency tracking
 */
import type { SheetsQualityInput, SheetsQualityOutput } from '../schemas/quality.js';
export interface QualityHandlerOptions {
}
export declare class QualityHandler {
    constructor(_options?: QualityHandlerOptions);
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    private applyVerbosityFilter;
    handle(input: SheetsQualityInput): Promise<SheetsQualityOutput>;
    /**
     * VALIDATE: Data validation with built-in validators
     */
    private handleValidate;
    /**
     * DETECT_CONFLICTS: Detect concurrent modification conflicts
     *
     * Note: Conflict detection currently works automatically during write operations.
     * Explicit detection queries are not yet implemented.
     */
    private handleDetectConflicts;
    /**
     * RESOLVE_CONFLICT: Resolve detected conflicts with strategies
     */
    private handleResolveConflict;
    /**
     * ANALYZE_IMPACT: Pre-execution impact analysis with dependency tracking
     */
    private handleAnalyzeImpact;
}
//# sourceMappingURL=quality.d.ts.map