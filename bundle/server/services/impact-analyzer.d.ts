/**
 * ImpactAnalyzer
 *
 * @purpose Analyzes operation impact before execution: cells/rows/columns affected, formulas broken, charts/pivots impacted
 * @category Quality
 * @usage Use before destructive operations (delete rows, clear range); provides warnings, recommendations, risk assessment
 * @dependencies sheets_v4, logger
 * @stateful No - stateless analysis service processing operations on-demand
 * @singleton No - can be instantiated per analysis request
 *
 * @example
 * const analyzer = new ImpactAnalyzer(sheetsClient);
 * const impact = await analyzer.analyze(spreadsheetId, { type: 'delete_rows', startRow: 5, endRow: 10 });
 * if (impact.severity === 'high') logger.warn('Will break', impact.formulasAffected, 'formulas!');
 */
import { ImpactAnalysis, ImpactAnalyzerConfig, ImpactAnalyzerStats } from '../types/impact.js';
/**
 * Impact Analyzer - Analyzes operation impact before execution
 */
export declare class ImpactAnalyzer {
    private config;
    private googleClient?;
    private stats;
    constructor(config?: ImpactAnalyzerConfig);
    /**
     * Analyze operation impact
     */
    analyzeOperation(operation: {
        type: string;
        tool: string;
        action: string;
        params: Record<string, unknown>;
    }): Promise<ImpactAnalysis>;
    /**
     * Extract range from operation parameters
     */
    private extractRange;
    /**
     * Calculate range size
     */
    private calculateRangeSize;
    /**
     * Convert column letter to number
     */
    private columnToNumber;
    /**
     * Convert row/column index to A1 notation
     */
    private indexToA1;
    /**
     * Parse range string to extract spreadsheetId and range
     */
    private parseRange;
    /**
     * Check if formula references a given range
     */
    private formulaReferencesRange;
    /**
     * Convert GridRange to A1 notation
     */
    private gridRangeToA1;
    /**
     * Convert column number to letter
     */
    private numberToColumn;
    /**
     * Check if two ranges overlap
     */
    private rangesOverlap;
    /**
     * Get chart type from chart spec
     */
    private getChartType;
    /**
     * Fetch comprehensive spreadsheet data in a single API call
     * OPTIMIZATION: Replaces 6 sequential calls with 1 comprehensive call
     */
    private fetchComprehensiveData;
    /**
     * Parse formulas from comprehensive data
     */
    private parseFormulasFromData;
    /**
     * Parse charts from comprehensive data
     */
    private parseChartsFromData;
    /**
     * Parse pivot tables from comprehensive data
     */
    private parsePivotTablesFromData;
    /**
     * Parse validation rules from comprehensive data
     */
    private parseValidationRulesFromData;
    /**
     * Parse named ranges from comprehensive data
     */
    private parseNamedRangesFromData;
    /**
     * Parse protected ranges from comprehensive data
     */
    private parseProtectedRangesFromData;
    /**
     * Find formulas affected by range (DEPRECATED - kept for compatibility)
     */
    private findAffectedFormulas;
    /**
     * Find charts affected by range
     */
    private findAffectedCharts;
    /**
     * Find pivot tables affected by range
     */
    private findAffectedPivotTables;
    /**
     * Find validation rules affected by range
     */
    private findAffectedValidationRules;
    /**
     * Find named ranges affected by range
     */
    private findAffectedNamedRanges;
    /**
     * Find protected ranges affected by range
     */
    private findAffectedProtectedRanges;
    /**
     * Estimate execution time
     */
    private estimateExecutionTime;
    /**
     * Calculate impact severity
     */
    private calculateSeverity;
    /**
     * Generate warnings
     */
    private generateWarnings;
    /**
     * Generate recommendations
     */
    private generateRecommendations;
    /**
     * Log message
     */
    private log;
    /**
     * Get statistics
     */
    getStats(): ImpactAnalyzerStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
/**
 * Initialize impact analyzer (call once during server startup)
 */
export declare function initImpactAnalyzer(googleClient?: ImpactAnalyzerConfig['googleClient']): ImpactAnalyzer;
/**
 * Get impact analyzer instance
 */
export declare function getImpactAnalyzer(): ImpactAnalyzer;
/**
 * Reset impact analyzer (for testing only)
 * @internal
 */
export declare function resetImpactAnalyzer(): void;
//# sourceMappingURL=impact-analyzer.d.ts.map