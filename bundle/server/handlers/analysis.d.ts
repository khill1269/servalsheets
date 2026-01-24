/**
 * ServalSheets - Analysis Handler
 *
 * Handles sheets_analysis tool (read-only analytics)
 * MCP Protocol: 2025-11-25
 */
import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsAnalysisInput, SheetsAnalysisOutput } from '../schemas/index.js';
export declare class AnalysisHandler extends BaseHandler<SheetsAnalysisInput, SheetsAnalysisOutput> {
    private readonly sheetsApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets);
    handle(input: SheetsAnalysisInput): Promise<SheetsAnalysisOutput>;
    protected createIntents(_input: SheetsAnalysisInput): Intent[];
    /**
     * Execute action and return response
     */
    private executeAction;
    private handleDataQuality;
    private handleFormulaAudit;
    private handleStructure;
    private handleStatistics;
    private handleCorrelations;
    private handleSummary;
    private handleDependencies;
    private handleCompareRanges;
    private handleDetectPatterns;
    private handleColumnAnalysis;
    private fetchValues;
    private pearson;
    private valueType;
    private analyzeTrends;
    private analyzeCorrelationsData;
    private detectAnomalies;
    private analyzeSeasonality;
    private detectDataType;
    private analyzeDistribution;
    private checkColumnQuality;
    private handleSuggestTemplates;
    private handleGenerateFormula;
    private handleSuggestChart;
}
//# sourceMappingURL=analysis.d.ts.map