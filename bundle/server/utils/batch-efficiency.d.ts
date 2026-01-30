/**
 * ServalSheets - Batch Efficiency Monitoring
 *
 * Monitors and logs batch efficiency metrics
 */
import type { Intent } from '../core/intent.js';
export interface BatchEfficiencyMetrics {
    intentCount: number;
    spreadsheetCount: number;
    averageIntentsPerSpreadsheet: number;
    potentialSavings: number;
    timestamp: string;
}
/**
 * Analyze batch efficiency and log warnings if suboptimal
 */
export declare function analyzeBatchEfficiency(intents: Intent[]): BatchEfficiencyMetrics;
/**
 * Get batch efficiency statistics
 */
export declare function getBatchEfficiencyStats(): {
    totalBatches: number;
    averageIntentsPerBatch: number;
    averageSpreadsheetsPerBatch: number;
    totalPotentialSavings: number;
};
/**
 * Clear batch efficiency history
 */
export declare function clearBatchEfficiencyHistory(): void;
/**
 * Suggest batch optimization strategies
 */
export declare function suggestBatchOptimizations(intents: Intent[]): string[];
//# sourceMappingURL=batch-efficiency.d.ts.map