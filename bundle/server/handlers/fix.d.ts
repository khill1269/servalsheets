/**
 * ServalSheets - Fix Handler
 *
 * Automated issue resolution based on analysis results.
 * Takes issues from sheets_analyze and applies fixes in transaction.
 */
import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsFixInput, SheetsFixOutput } from '../schemas/fix.js';
export declare class FixHandler extends BaseHandler<SheetsFixInput, SheetsFixOutput> {
    private sheetsApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets);
    handle(input: SheetsFixInput): Promise<SheetsFixOutput>;
    protected createIntents(input: SheetsFixInput): Intent[];
    /**
     * Filter issues based on user preferences
     */
    private filterIssues;
    /**
     * Generate fix operations from issues
     */
    private generateFixOperations;
    /**
     * Generate fix operations for a single issue
     */
    private generateFixForIssue;
    /**
     * Fix: Consolidate multiple TODAY() calls
     */
    private fixMultipleToday;
    /**
     * Fix: Freeze header rows
     */
    private fixFrozenHeaders;
    /**
     * Fix: Freeze ID columns
     */
    private fixFrozenColumns;
    /**
     * Fix: Protect formula cells
     */
    private fixProtection;
    /**
     * Fix: Replace full column references with bounded ranges
     */
    private fixFullColumnRefs;
    /**
     * Fix: Simplify nested IFERROR
     */
    private fixNestedIferror;
    /**
     * Fix: Consolidate excessive CF rules
     */
    private fixExcessiveCfRules;
    /**
     * Create snapshot before making changes
     */
    private createSnapshot;
    /**
     * Apply fix operations (calls other tools)
     */
    private applyFixOperations;
    /**
     * Execute a single fix operation
     */
    private executeOperation;
}
//# sourceMappingURL=fix.d.ts.map