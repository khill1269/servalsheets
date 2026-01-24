/**
 * ServalSheets - Visualize Handler
 *
 * Consolidated handler for sheets_visualize tool (chart and pivot table operations)
 * Merges: charts.ts (9 actions) + pivot.ts (7 actions) = 16 actions total
 * MCP Protocol: 2025-11-25
 */
import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsVisualizeInput, SheetsVisualizeOutput } from '../schemas/visualize.js';
export declare class VisualizeHandler extends BaseHandler<SheetsVisualizeInput, SheetsVisualizeOutput> {
    private sheetsApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets);
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    handle(input: SheetsVisualizeInput): Promise<SheetsVisualizeOutput>;
    protected createIntents(input: SheetsVisualizeInput): Intent[];
    private handleChartCreate;
    private handleSuggestChart;
    private handleChartUpdate;
    private handleChartDelete;
    private handleChartList;
    private handleChartGet;
    private handleChartMove;
    private handleChartResize;
    private handleChartUpdateDataRange;
    private handlePivotCreate;
    private handleSuggestPivot;
    private handlePivotUpdate;
    private handlePivotDelete;
    private handlePivotList;
    private handlePivotGet;
    private handlePivotRefresh;
    private buildBasicChartSpec;
    /**
     * Route chart creation to appropriate spec builder based on chart type
     * PIE/DOUGHNUT/TREEMAP/HISTOGRAM/SCORECARD/WATERFALL/CANDLESTICK need specific specs
     * BAR/LINE/AREA/COLUMN/SCATTER/COMBO/STEPPED_AREA use BasicChartSpec
     */
    private buildChartSpec;
    private toOverlayPosition;
    private fetchChartPosition;
    private formatAnchorCell;
    private toDestination;
    private mapPivotGroup;
    private mapPivotValue;
    private mapPivotFilter;
    private normalizeGridRange;
    private findPivotRange;
    private toGridRange;
}
//# sourceMappingURL=visualize.d.ts.map