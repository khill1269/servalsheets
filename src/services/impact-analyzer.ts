/**
 * ServalSheets - Impact Analyzer
 *
 * Analyzes operation impact before execution:
 * - Cells, rows, columns affected
 * - Formulas, charts, pivot tables affected
 * - Warnings and recommendations
 *
 * Phase 4, Task 4.3
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ImpactAnalysis,
  ImpactSeverity,
  ImpactWarning,
  AffectedFormula,
  AffectedChart,
  AffectedPivotTable,
  AffectedValidationRule,
  AffectedNamedRange,
  AffectedProtectedRange,
  ImpactAnalyzerConfig,
  ImpactAnalyzerStats,
} from '../types/impact.js';

/**
 * Impact Analyzer - Analyzes operation impact before execution
 */
export class ImpactAnalyzer {
  private config: Required<ImpactAnalyzerConfig>;
  private stats: ImpactAnalyzerStats;

  constructor(config: ImpactAnalyzerConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      analyzeFormulas: config.analyzeFormulas ?? true,
      analyzeCharts: config.analyzeCharts ?? true,
      analyzePivotTables: config.analyzePivotTables ?? true,
      analyzeValidationRules: config.analyzeValidationRules ?? true,
      analyzeNamedRanges: config.analyzeNamedRanges ?? true,
      analyzeProtectedRanges: config.analyzeProtectedRanges ?? true,
      analysisTimeoutMs: config.analysisTimeoutMs ?? 5000,
      verboseLogging: config.verboseLogging ?? false,
    };

    this.stats = {
      totalAnalyses: 0,
      operationsPrevented: 0,
      avgAnalysisTime: 0,
      totalWarnings: 0,
      warningsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
    };
  }

  /**
   * Analyze operation impact
   */
  async analyzeOperation(operation: {
    type: string;
    tool: string;
    action: string;
    params: Record<string, unknown>;
  }): Promise<ImpactAnalysis> {
    const startTime = Date.now();
    this.stats.totalAnalyses++;

    this.log(`Analyzing impact for operation: ${operation.tool}.${operation.action}`);

    // Parse range from parameters
    const range = this.extractRange(operation.params);
    const { rows, columns, cells } = this.calculateRangeSize(range);

    // Analyze affected resources
    const formulasAffected = this.config.analyzeFormulas
      ? await this.findAffectedFormulas(range)
      : [];

    const chartsAffected = this.config.analyzeCharts
      ? await this.findAffectedCharts(range)
      : [];

    const pivotTablesAffected = this.config.analyzePivotTables
      ? await this.findAffectedPivotTables(range)
      : [];

    const validationRulesAffected = this.config.analyzeValidationRules
      ? await this.findAffectedValidationRules(range)
      : [];

    const namedRangesAffected = this.config.analyzeNamedRanges
      ? await this.findAffectedNamedRanges(range)
      : [];

    const protectedRangesAffected = this.config.analyzeProtectedRanges
      ? await this.findAffectedProtectedRanges(range)
      : [];

    // Calculate execution time estimate
    const estimatedExecutionTime = this.estimateExecutionTime(operation, cells);

    // Determine severity
    const severity = this.calculateSeverity(
      cells,
      formulasAffected.length,
      chartsAffected.length,
      protectedRangesAffected.length
    );

    // Generate warnings
    const warnings = this.generateWarnings(
      cells,
      formulasAffected,
      chartsAffected,
      pivotTablesAffected,
      protectedRangesAffected
    );

    // Update statistics
    warnings.forEach((w) => {
      this.stats.totalWarnings++;
      this.stats.warningsBySeverity[w.severity]++;
    });

    if (severity === 'critical') {
      this.stats.operationsPrevented++;
    }

    const duration = Date.now() - startTime;
    this.stats.avgAnalysisTime =
      (this.stats.avgAnalysisTime * (this.stats.totalAnalyses - 1) + duration) /
      this.stats.totalAnalyses;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      operation,
      warnings,
      severity
    );

    const analysis: ImpactAnalysis = {
      id: uuidv4(),
      operation,
      cellsAffected: cells,
      rowsAffected: rows,
      columnsAffected: columns,
      formulasAffected,
      chartsAffected,
      pivotTablesAffected,
      validationRulesAffected,
      conditionalFormatsAffected: 0,
      namedRangesAffected,
      protectedRangesAffected,
      estimatedExecutionTime,
      severity,
      warnings,
      recommendations,
      timestamp: Date.now(),
    };

    this.log(
      `Impact analysis complete: ${cells} cells, ${warnings.length} warnings, ${severity} severity`
    );

    return analysis;
  }

  /**
   * Extract range from operation parameters
   */
  private extractRange(params: Record<string, unknown>): string {
    return (params['range'] as string) || (params['targetRange'] as string) || 'A1';
  }

  /**
   * Calculate range size
   */
  private calculateRangeSize(range: string): {
    rows: number;
    columns: number;
    cells: number;
  } {
    // Parse A1 notation (e.g., "A1:B10")
    const match = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);

    if (!match) {
      return { rows: 1, columns: 1, cells: 1 };
    }

    const startCol = this.columnToNumber(match[1]!);
    const startRow = parseInt(match[2]!, 10);
    const endCol = this.columnToNumber(match[3]!);
    const endRow = parseInt(match[4]!, 10);

    const rows = endRow - startRow + 1;
    const columns = endCol - startCol + 1;
    const cells = rows * columns;

    return { rows, columns, cells };
  }

  /**
   * Convert column letter to number
   */
  private columnToNumber(column: string): number {
    let result = 0;
    for (let i = 0; i < column.length; i++) {
      result = result * 26 + (column.charCodeAt(i) - 64);
    }
    return result;
  }

  /**
   * Find formulas affected by range
   */
  private async findAffectedFormulas(_range: string): Promise<AffectedFormula[]> {
    // TODO: Integrate with Google Sheets API to find actual formulas
    // For now, return simulated results

    // Simulate finding formulas that reference the range
    const affected: AffectedFormula[] = [];

    // Example: Some formulas reference this range
    if (Math.random() > 0.7) {
      affected.push({
        cell: 'D10',
        sheetName: 'Sheet1',
        formula: '=SUM(A1:B10)',
        impactType: 'references_affected_range',
        description: 'Formula references cells in the affected range',
      });
    }

    return affected;
  }

  /**
   * Find charts affected by range
   */
  private async findAffectedCharts(_range: string): Promise<AffectedChart[]> {
    // TODO: Integrate with Google Sheets API to find actual charts
    const affected: AffectedChart[] = [];

    // Simulate finding charts
    if (Math.random() > 0.8) {
      affected.push({
        chartId: 1,
        title: 'Sales Chart',
        sheetName: 'Sheet1',
        chartType: 'LINE',
        dataRanges: ['A1:B10'],
        impactType: 'data_source_affected',
        description: 'Chart uses data from the affected range',
      });
    }

    return affected;
  }

  /**
   * Find pivot tables affected by range
   */
  private async findAffectedPivotTables(
    _range: string
  ): Promise<AffectedPivotTable[]> {
    // TODO: Integrate with Google Sheets API
    return [];
  }

  /**
   * Find validation rules affected by range
   */
  private async findAffectedValidationRules(
    _range: string
  ): Promise<AffectedValidationRule[]> {
    // TODO: Integrate with Google Sheets API
    return [];
  }

  /**
   * Find named ranges affected by range
   */
  private async findAffectedNamedRanges(
    _range: string
  ): Promise<AffectedNamedRange[]> {
    // TODO: Integrate with Google Sheets API
    return [];
  }

  /**
   * Find protected ranges affected by range
   */
  private async findAffectedProtectedRanges(
    _range: string
  ): Promise<AffectedProtectedRange[]> {
    // TODO: Integrate with Google Sheets API
    const affected: AffectedProtectedRange[] = [];

    // Simulate protected range detection
    if (Math.random() > 0.9) {
      affected.push({
        protectedRangeId: 1,
        range: 'A1:B10',
        description: 'Protected range',
        impactType: 'permission_required',
        editors: ['user@example.com'],
      });
    }

    return affected;
  }

  /**
   * Estimate execution time
   */
  private estimateExecutionTime(
    operation: { type: string; tool: string; action: string },
    cellCount: number
  ): number {
    // Base time: 100ms
    let time = 100;

    // Add time based on cell count
    time += cellCount * 0.5;

    // Add time based on operation type
    if (operation.tool.includes('format')) {
      time += cellCount * 0.3;
    }

    if (operation.tool.includes('formula')) {
      time += cellCount * 1.0;
    }

    return Math.round(time);
  }

  /**
   * Calculate impact severity
   */
  private calculateSeverity(
    cells: number,
    formulas: number,
    charts: number,
    protectedRanges: number
  ): ImpactSeverity {
    // Critical: Protected ranges or large cell count
    if (protectedRanges > 0 || cells > 10000) {
      return 'critical';
    }

    // High: Many formulas or charts affected
    if (formulas > 10 || charts > 3) {
      return 'high';
    }

    // Medium: Some formulas or charts
    if (formulas > 0 || charts > 0 || cells > 1000) {
      return 'medium';
    }

    // Low: Minimal impact
    return 'low';
  }

  /**
   * Generate warnings
   */
  private generateWarnings(
    cells: number,
    formulas: AffectedFormula[],
    charts: AffectedChart[],
    pivotTables: AffectedPivotTable[],
    protectedRanges: AffectedProtectedRange[]
  ): ImpactWarning[] {
    const warnings: ImpactWarning[] = [];

    // Large cell count warning
    if (cells > 10000) {
      warnings.push({
        severity: 'critical',
        message: `This operation affects ${cells.toLocaleString()} cells, which may take significant time`,
        resourceType: 'cells',
        affectedCount: cells,
        suggestedAction: 'Consider breaking into smaller operations',
      });
    } else if (cells > 1000) {
      warnings.push({
        severity: 'medium',
        message: `This operation affects ${cells.toLocaleString()} cells`,
        resourceType: 'cells',
        affectedCount: cells,
      });
    }

    // Formulas warning
    if (formulas.length > 0) {
      warnings.push({
        severity: formulas.length > 10 ? 'high' : 'medium',
        message: `${formulas.length} formula(s) reference this range and may be affected`,
        resourceType: 'formulas',
        affectedCount: formulas.length,
        suggestedAction: 'Review formulas before proceeding',
      });
    }

    // Charts warning
    if (charts.length > 0) {
      warnings.push({
        severity: charts.length > 3 ? 'high' : 'medium',
        message: `${charts.length} chart(s) use data from this range`,
        resourceType: 'charts',
        affectedCount: charts.length,
        suggestedAction: 'Charts may need to be updated',
      });
    }

    // Protected ranges warning
    if (protectedRanges.length > 0) {
      warnings.push({
        severity: 'critical',
        message: `This range is protected. Edit permissions required.`,
        resourceType: 'protected_ranges',
        affectedCount: protectedRanges.length,
        suggestedAction: 'Request edit permissions from sheet owner',
      });
    }

    return warnings;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    operation: { type: string; tool: string; action: string },
    warnings: ImpactWarning[],
    severity: ImpactSeverity
  ): string[] {
    const recommendations: string[] = [];

    // Critical severity recommendations
    if (severity === 'critical') {
      recommendations.push('Review all warnings carefully before proceeding');
      recommendations.push('Consider creating a backup snapshot');
    }

    // Large operation recommendations
    if (warnings.some((w) => w.resourceType === 'cells' && w.affectedCount > 1000)) {
      recommendations.push('Use a transaction to ensure atomicity');
      recommendations.push('Consider breaking into smaller batches');
    }

    // Formula recommendations
    if (warnings.some((w) => w.resourceType === 'formulas')) {
      recommendations.push('Verify formula references after operation');
    }

    // Chart recommendations
    if (warnings.some((w) => w.resourceType === 'charts')) {
      recommendations.push('Refresh charts after operation');
    }

    return recommendations;
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.verboseLogging) {
      // eslint-disable-next-line no-console
      console.log(`[ImpactAnalyzer] ${message}`); // Debugging output when verboseLogging enabled
    }
  }

  /**
   * Get statistics
   */
  getStats(): ImpactAnalyzerStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalAnalyses: 0,
      operationsPrevented: 0,
      avgAnalysisTime: 0,
      totalWarnings: 0,
      warningsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
    };
  }
}

// Singleton instance
let impactAnalyzerInstance: ImpactAnalyzer | null = null;

/**
 * Get impact analyzer instance
 */
export function getImpactAnalyzer(config?: ImpactAnalyzerConfig): ImpactAnalyzer {
  if (!impactAnalyzerInstance) {
    impactAnalyzerInstance = new ImpactAnalyzer(config);
  }
  return impactAnalyzerInstance;
}
