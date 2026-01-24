/**
 * ServalSheets v2.0 - Data Handler
 *
 * Consolidated data operations handler combining:
 * - Cell value operations (read, write, append, clear, find, replace)
 * - Cell-level operations (notes, validation, hyperlinks, merge, cut, copy)
 *
 * Architecture: Main handler delegates to sub-handlers for organization
 * MCP Protocol: 2025-11-25
 */
import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsDataInput, SheetsDataOutput } from '../schemas/data.js';
/**
 * Main handler for sheets_data tool
 * Delegates to sub-handlers based on action type
 */
export declare class SheetsDataHandler extends BaseHandler<SheetsDataInput, SheetsDataOutput> {
    private sheetsApi;
    private valuesOps;
    private cellsOps;
    private valueCacheMap;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets);
    /**
     * Register circuit breaker fallback strategies for read operations
     *
     * Production Pattern: Multi-tier fallback system
     *
     * When Google Sheets API fails or circuit opens:
     * 1. Try cached data (priority 100) - Return stale data if available
     * 2. Retry with backoff (priority 80) - Handle transient failures
     * 3. Degraded mode (priority 50) - Return empty result with warning
     *
     * This ensures the system remains responsive even during API outages.
     */
    private registerReadFallbacks;
    handle(input: SheetsDataInput): Promise<SheetsDataOutput>;
    protected createIntents(input: SheetsDataInput): Intent[];
    /**
     * Route action to appropriate sub-handler
     */
    private executeAction;
}
//# sourceMappingURL=data.d.ts.map