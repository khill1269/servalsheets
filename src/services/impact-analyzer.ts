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

import { v4 as uuidv4 } from "uuid";
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
} from "../types/impact.js";

/**
 * Impact Analyzer - Analyzes operation impact before execution
 */
export class ImpactAnalyzer {
  private config: Required<Omit<ImpactAnalyzerConfig, "googleClient">>;
  private googleClient?: ImpactAnalyzerConfig["googleClient"];
  private stats: ImpactAnalyzerStats;

  constructor(config: ImpactAnalyzerConfig = {}) {
    this.googleClient = config.googleClient;
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

    this.log(
      `Analyzing impact for operation: ${operation.tool}.${operation.action}`,
    );

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
      protectedRangesAffected.length,
    );

    // Generate warnings
    const warnings = this.generateWarnings(
      cells,
      formulasAffected,
      chartsAffected,
      pivotTablesAffected,
      protectedRangesAffected,
    );

    // Update statistics
    warnings.forEach((w) => {
      this.stats.totalWarnings++;
      this.stats.warningsBySeverity[w.severity]++;
    });

    if (severity === "critical") {
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
      severity,
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
      `Impact analysis complete: ${cells} cells, ${warnings.length} warnings, ${severity} severity`,
    );

    return analysis;
  }

  /**
   * Extract range from operation parameters
   */
  private extractRange(params: Record<string, unknown>): string {
    return (
      (params["range"] as string) || (params["targetRange"] as string) || "A1"
    );
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
   * Convert row/column index to A1 notation
   */
  private indexToA1(row: number, col: number): string {
    let column = "";
    let colNum = col + 1; // Convert from 0-based to 1-based

    while (colNum > 0) {
      const remainder = (colNum - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      colNum = Math.floor((colNum - 1) / 26);
    }

    return `${column}${row + 1}`; // row is also 0-based
  }

  /**
   * Parse range string to extract spreadsheetId and range
   */
  private parseRange(range: string): { spreadsheetId?: string; range: string } {
    // Check if range includes spreadsheetId (format: "spreadsheetId!Sheet1!A1:B10")
    const parts = range.split("!");
    if (parts.length >= 3) {
      return {
        spreadsheetId: parts[0],
        range: parts.slice(1).join("!"),
      };
    }
    return { range };
  }

  /**
   * Check if formula references a given range
   */
  private formulaReferencesRange(formula: string, range: string): boolean {
    // Simple heuristic: check if the range appears in the formula
    // This is a simplified implementation; a real one would parse the formula AST
    const rangePattern = this.parseRange(range).range;
    return formula.toUpperCase().includes(rangePattern.toUpperCase());
  }

  /**
   * Convert GridRange to A1 notation
   */
  private gridRangeToA1(gridRange: {
    startRowIndex?: number | null;
    endRowIndex?: number | null;
    startColumnIndex?: number | null;
    endColumnIndex?: number | null;
  }): string {
    const startRow = (gridRange.startRowIndex ?? 0) + 1;
    const endRow = (gridRange.endRowIndex ?? startRow - 1) + 1;
    const startCol = this.numberToColumn((gridRange.startColumnIndex ?? 0) + 1);
    const endCol = this.numberToColumn(
      (gridRange.endColumnIndex ?? startCol.charCodeAt(0) - 65) + 1,
    );

    if (startRow === endRow && startCol === endCol) {
      return `${startCol}${startRow}`;
    }
    return `${startCol}${startRow}:${endCol}${endRow}`;
  }

  /**
   * Convert column number to letter
   */
  private numberToColumn(num: number): string {
    let column = "";
    while (num > 0) {
      const remainder = (num - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      num = Math.floor((num - 1) / 26);
    }
    return column;
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(range1: string, range2: string): boolean {
    // Simplified overlap check - just check if range strings are similar
    // A real implementation would parse both ranges and check for geometric overlap
    return (
      range1.toUpperCase().includes(range2.toUpperCase()) ||
      range2.toUpperCase().includes(range1.toUpperCase())
    );
  }

  /**
   * Get chart type from chart spec
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getChartType(spec: any): string {
    if (spec.basicChart) return spec.basicChart.chartType || "BASIC";
    if (spec.pieChart) return "PIE";
    if (spec.bubbleChart) return "BUBBLE";
    if (spec.candlestickChart) return "CANDLESTICK";
    if (spec.orgChart) return "ORG";
    if (spec.histogramChart) return "HISTOGRAM";
    if (spec.waterfallChart) return "WATERFALL";
    if (spec.treemapChart) return "TREEMAP";
    if (spec.scorecardChart) return "SCORECARD";
    return "UNKNOWN";
  }

  /**
   * Find formulas affected by range
   */
  private async findAffectedFormulas(
    range: string,
  ): Promise<AffectedFormula[]> {
    if (!this.googleClient) {
      this.log("No Google API client - skipping formula analysis");
      return [];
    }

    try {
      const affected: AffectedFormula[] = [];
      const params = this.parseRange(range);
      if (!params.spreadsheetId) {
        return [];
      }

      // Get spreadsheet metadata to find all sheets
      const spreadsheet = await this.googleClient.sheets.spreadsheets.get({
        spreadsheetId: params.spreadsheetId,
        fields:
          "sheets(properties,data.rowData.values.userEnteredValue.formulaValue)",
      });

      if (!spreadsheet.data.sheets) {
        return [];
      }

      // Scan each sheet for formulas
      for (const sheet of spreadsheet.data.sheets) {
        const sheetName = sheet.properties?.title || "Unknown";
        const data = sheet.data;

        if (!data) continue;

        for (const gridData of data) {
          const rowData = gridData.rowData;
          if (!rowData) continue;

          for (let rowIndex = 0; rowIndex < rowData.length; rowIndex++) {
            const row = rowData[rowIndex];
            const values = row?.values;
            if (!values) continue;

            for (let colIndex = 0; colIndex < values.length; colIndex++) {
              const cell = values[colIndex];
              const formula = cell?.userEnteredValue?.formulaValue;

              if (formula && this.formulaReferencesRange(formula, range)) {
                const cellAddress = this.indexToA1(rowIndex, colIndex);
                affected.push({
                  cell: cellAddress,
                  sheetName,
                  formula,
                  impactType: "references_affected_range",
                  description: `Formula references cells in the affected range ${range}`,
                });
              }
            }
          }
        }
      }

      this.log(`Found ${affected.length} formulas affected by range ${range}`);
      return affected;
    } catch (error) {
      this.log(
        `Error finding affected formulas: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Find charts affected by range
   */
  private async findAffectedCharts(range: string): Promise<AffectedChart[]> {
    if (!this.googleClient) {
      this.log("No Google API client - skipping chart analysis");
      return [];
    }

    try {
      const affected: AffectedChart[] = [];
      const params = this.parseRange(range);
      if (!params.spreadsheetId) {
        return [];
      }

      // Get spreadsheet with chart information
      const spreadsheet = await this.googleClient.sheets.spreadsheets.get({
        spreadsheetId: params.spreadsheetId,
        fields: "sheets(properties(title),charts(chartId,spec))",
      });

      if (!spreadsheet.data.sheets) {
        return [];
      }

      // Check each sheet for charts
      for (const sheet of spreadsheet.data.sheets) {
        const sheetName = sheet.properties?.title || "Unknown";
        const charts = sheet.charts;

        if (!charts) continue;

        for (const chart of charts) {
          const spec = chart.spec;
          if (!spec) continue;

          // Extract data ranges from chart spec
          const dataRanges: string[] = [];

          // Check various chart types for data ranges
          if (spec.basicChart?.series) {
            for (const series of spec.basicChart.series) {
              // BasicChartSeries doesn't have sourceRange, it has series data
              // For now, we'll mark this as a chart that could be affected
              if (series.series) {
                // The series.series contains the ChartData which has the actual range
                dataRanges.push(`${sheetName}!${range}`); // Simplified - would need full implementation
              }
            }
          }

          // Check domain/data in basicChart
          if (spec.basicChart?.domains) {
            for (const domain of spec.basicChart.domains) {
              if (domain.domain?.sourceRange) {
                const sourceRange = domain.domain.sourceRange;
                if (sourceRange.sources) {
                  for (const source of sourceRange.sources) {
                    if (source.sheetId !== undefined) {
                      const rangeA1 = this.gridRangeToA1(source);
                      dataRanges.push(`${sheetName}!${rangeA1}`);
                    }
                  }
                }
              }
            }
          }

          // Check if any data range overlaps with the affected range
          const isAffected = dataRanges.some((dataRange) =>
            this.rangesOverlap(dataRange, range),
          );

          if (isAffected) {
            affected.push({
              chartId: chart.chartId || 0,
              title: spec.title || "Untitled Chart",
              sheetName,
              chartType: this.getChartType(spec),
              dataRanges,
              impactType: "data_source_affected",
              description: `Chart uses data from the affected range ${range}`,
            });
          }
        }
      }

      this.log(`Found ${affected.length} charts affected by range ${range}`);
      return affected;
    } catch (error) {
      this.log(
        `Error finding affected charts: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Find pivot tables affected by range
   */
  private async findAffectedPivotTables(
    range: string,
  ): Promise<AffectedPivotTable[]> {
    if (!this.googleClient) {
      return [];
    }

    try {
      const affected: AffectedPivotTable[] = [];
      const params = this.parseRange(range);
      if (!params.spreadsheetId) return [];

      // Get spreadsheet with pivot table information
      // Note: TypeScript types don't fully expose pivotTables, but it exists in the API
      const spreadsheet = await this.googleClient.sheets.spreadsheets.get({
        spreadsheetId: params.spreadsheetId,
        fields: "sheets(properties(title,sheetId),pivotTables)",
      });

      // Type assertion: The API response includes pivotTables but TypeScript types don't expose it
      const sheets = spreadsheet.data.sheets as Array<{
        properties?: { title?: string | null; sheetId?: number | null } | null;
        pivotTables?: Array<{
          pivotTableId?: number | null;
          source?: {
            sourceRange?: {
              sheetId?: number | null;
              startRowIndex?: number | null;
              endRowIndex?: number | null;
              startColumnIndex?: number | null;
              endColumnIndex?: number | null;
            } | null;
          } | null;
        }> | null;
      }>;

      if (sheets) {
        for (const sheet of sheets) {
          const sheetName = sheet.properties?.title || "Unknown";

          // Check if sheet has pivot tables
          if (!sheet.pivotTables || sheet.pivotTables.length === 0) {
            continue;
          }

          this.log(
            `Found ${sheet.pivotTables.length} pivot table(s) in ${sheetName}`,
          );

          // Check each pivot table
          for (const pivot of sheet.pivotTables) {
            if (!pivot.source?.sourceRange) continue;

            const sourceRange = pivot.source.sourceRange;
            const pivotA1 = this.gridRangeToA1(sourceRange);

            // Check if pivot source range overlaps with target range using A1 notation
            if (this.rangesOverlap(pivotA1, params.range)) {
              affected.push({
                pivotTableId: pivot.pivotTableId || 0,
                sheetName,
                sourceRange: pivotA1,
                impactType: "source_data_affected",
                description: `Pivot table source data will be modified. The pivot table may need to be refreshed.`,
              });

              this.log(
                `Pivot table ${pivot.pivotTableId} in ${sheetName} affected by range ${range}`,
              );
            }
          }
        }
      }

      return affected;
    } catch (error) {
      this.log(
        `Error finding pivot tables: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Find validation rules affected by range
   */
  private async findAffectedValidationRules(
    range: string,
  ): Promise<AffectedValidationRule[]> {
    if (!this.googleClient) {
      return [];
    }

    try {
      const affected: AffectedValidationRule[] = [];
      const params = this.parseRange(range);
      if (!params.spreadsheetId) return [];

      const spreadsheet = await this.googleClient.sheets.spreadsheets.get({
        spreadsheetId: params.spreadsheetId,
        fields: "sheets(data.rowData.values.dataValidation)",
      });

      if (spreadsheet.data.sheets) {
        for (const sheet of spreadsheet.data.sheets) {
          if (!sheet.data) continue;

          for (const gridData of sheet.data) {
            const rowData = gridData.rowData;
            if (!rowData) continue;

            for (const row of rowData) {
              const values = row?.values;
              if (!values) continue;

              for (const cell of values) {
                if (cell?.dataValidation) {
                  // Found a cell with validation - check if it overlaps with our range
                  // This is a simplified check
                  affected.push({
                    ruleId: `${range}-validation`,
                    range: range, // Would need actual cell address here
                    ruleType: cell.dataValidation.condition?.type || "UNKNOWN",
                    impactType: "may_conflict",
                    description: "Data validation rule may be affected",
                  });
                }
              }
            }
          }
        }
      }

      return affected;
    } catch (error) {
      this.log(
        `Error finding validation rules: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Find named ranges affected by range
   */
  private async findAffectedNamedRanges(
    range: string,
  ): Promise<AffectedNamedRange[]> {
    if (!this.googleClient) {
      return [];
    }

    try {
      const affected: AffectedNamedRange[] = [];
      const params = this.parseRange(range);
      if (!params.spreadsheetId) return [];

      const spreadsheet = await this.googleClient.sheets.spreadsheets.get({
        spreadsheetId: params.spreadsheetId,
        fields: "namedRanges(namedRangeId,name,range)",
      });

      if (spreadsheet.data.namedRanges) {
        for (const namedRange of spreadsheet.data.namedRanges) {
          const rangeData = namedRange.range;
          if (rangeData) {
            // Convert GridRange to A1 and check overlap
            const namedRangeA1 = this.gridRangeToA1(rangeData);
            if (this.rangesOverlap(namedRangeA1, range)) {
              affected.push({
                namedRangeId: namedRange.namedRangeId || "unknown",
                name: namedRange.name || "Unknown",
                range: namedRangeA1,
                impactType: "will_be_affected",
                description: `Named range "${namedRange.name}" overlaps with affected range`,
              });
            }
          }
        }
      }

      this.log(
        `Found ${affected.length} named ranges affected by range ${range}`,
      );
      return affected;
    } catch (error) {
      this.log(
        `Error finding named ranges: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Find protected ranges affected by range
   */
  private async findAffectedProtectedRanges(
    range: string,
  ): Promise<AffectedProtectedRange[]> {
    if (!this.googleClient) {
      return [];
    }

    try {
      const affected: AffectedProtectedRange[] = [];
      const params = this.parseRange(range);
      if (!params.spreadsheetId) return [];

      const spreadsheet = await this.googleClient.sheets.spreadsheets.get({
        spreadsheetId: params.spreadsheetId,
        fields:
          "sheets(protectedRanges(protectedRangeId,range,description,editors))",
      });

      if (spreadsheet.data.sheets) {
        for (const sheet of spreadsheet.data.sheets) {
          if (!sheet.protectedRanges) continue;

          for (const protectedRange of sheet.protectedRanges) {
            const rangeData = protectedRange.range;
            if (rangeData) {
              const protectedRangeA1 = this.gridRangeToA1(rangeData);
              if (this.rangesOverlap(protectedRangeA1, range)) {
                affected.push({
                  protectedRangeId: protectedRange.protectedRangeId || 0,
                  range: protectedRangeA1,
                  description: protectedRange.description || "Protected range",
                  impactType: "permission_required",
                  editors: protectedRange.editors?.users || [],
                });
              }
            }
          }
        }
      }

      this.log(
        `Found ${affected.length} protected ranges affected by range ${range}`,
      );
      return affected;
    } catch (error) {
      this.log(
        `Error finding protected ranges: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Estimate execution time
   */
  private estimateExecutionTime(
    operation: { type: string; tool: string; action: string },
    cellCount: number,
  ): number {
    // Base time: 100ms
    let time = 100;

    // Add time based on cell count
    time += cellCount * 0.5;

    // Add time based on operation type
    if (operation.tool.includes("format")) {
      time += cellCount * 0.3;
    }

    if (operation.tool.includes("formula")) {
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
    protectedRanges: number,
  ): ImpactSeverity {
    // Critical: Protected ranges or large cell count
    if (protectedRanges > 0 || cells > 10000) {
      return "critical";
    }

    // High: Many formulas or charts affected
    if (formulas > 10 || charts > 3) {
      return "high";
    }

    // Medium: Some formulas or charts
    if (formulas > 0 || charts > 0 || cells > 1000) {
      return "medium";
    }

    // Low: Minimal impact
    return "low";
  }

  /**
   * Generate warnings
   */
  private generateWarnings(
    cells: number,
    formulas: AffectedFormula[],
    charts: AffectedChart[],
    pivotTables: AffectedPivotTable[],
    protectedRanges: AffectedProtectedRange[],
  ): ImpactWarning[] {
    const warnings: ImpactWarning[] = [];

    // Large cell count warning
    if (cells > 10000) {
      warnings.push({
        severity: "critical",
        message: `This operation affects ${cells.toLocaleString()} cells, which may take significant time`,
        resourceType: "cells",
        affectedCount: cells,
        suggestedAction: "Consider breaking into smaller operations",
      });
    } else if (cells > 1000) {
      warnings.push({
        severity: "medium",
        message: `This operation affects ${cells.toLocaleString()} cells`,
        resourceType: "cells",
        affectedCount: cells,
      });
    }

    // Formulas warning
    if (formulas.length > 0) {
      warnings.push({
        severity: formulas.length > 10 ? "high" : "medium",
        message: `${formulas.length} formula(s) reference this range and may be affected`,
        resourceType: "formulas",
        affectedCount: formulas.length,
        suggestedAction: "Review formulas before proceeding",
      });
    }

    // Charts warning
    if (charts.length > 0) {
      warnings.push({
        severity: charts.length > 3 ? "high" : "medium",
        message: `${charts.length} chart(s) use data from this range`,
        resourceType: "charts",
        affectedCount: charts.length,
        suggestedAction: "Charts may need to be updated",
      });
    }

    // Protected ranges warning
    if (protectedRanges.length > 0) {
      warnings.push({
        severity: "critical",
        message: `This range is protected. Edit permissions required.`,
        resourceType: "protected_ranges",
        affectedCount: protectedRanges.length,
        suggestedAction: "Request edit permissions from sheet owner",
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
    severity: ImpactSeverity,
  ): string[] {
    const recommendations: string[] = [];

    // Critical severity recommendations
    if (severity === "critical") {
      recommendations.push("Review all warnings carefully before proceeding");
      recommendations.push("Consider creating a backup snapshot");
    }

    // Large operation recommendations
    if (
      warnings.some((w) => w.resourceType === "cells" && w.affectedCount > 1000)
    ) {
      recommendations.push("Use a transaction to ensure atomicity");
      recommendations.push("Consider breaking into smaller batches");
    }

    // Formula recommendations
    if (warnings.some((w) => w.resourceType === "formulas")) {
      recommendations.push("Verify formula references after operation");
    }

    // Chart recommendations
    if (warnings.some((w) => w.resourceType === "charts")) {
      recommendations.push("Refresh charts after operation");
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
 * Initialize impact analyzer (call once during server startup)
 */
export function initImpactAnalyzer(
  googleClient?: ImpactAnalyzerConfig["googleClient"],
): ImpactAnalyzer {
  if (!impactAnalyzerInstance) {
    impactAnalyzerInstance = new ImpactAnalyzer({
      enabled: process.env["IMPACT_ANALYSIS_ENABLED"] !== "false",
      analyzeFormulas: process.env["IMPACT_ANALYZE_FORMULAS"] !== "false",
      analyzeCharts: process.env["IMPACT_ANALYZE_CHARTS"] !== "false",
      analyzePivotTables:
        process.env["IMPACT_ANALYZE_PIVOT_TABLES"] !== "false",
      analyzeValidationRules:
        process.env["IMPACT_ANALYZE_VALIDATION"] !== "false",
      analyzeNamedRanges:
        process.env["IMPACT_ANALYZE_NAMED_RANGES"] !== "false",
      analyzeProtectedRanges:
        process.env["IMPACT_ANALYZE_PROTECTED"] !== "false",
      analysisTimeoutMs: parseInt(
        process.env["IMPACT_ANALYSIS_TIMEOUT_MS"] || "5000",
      ),
      verboseLogging: process.env["IMPACT_VERBOSE"] === "true",
      googleClient,
    });
  }
  return impactAnalyzerInstance;
}

/**
 * Get impact analyzer instance
 */
export function getImpactAnalyzer(): ImpactAnalyzer {
  if (!impactAnalyzerInstance) {
    throw new Error(
      "Impact analyzer not initialized. Call initImpactAnalyzer() first.",
    );
  }
  return impactAnalyzerInstance;
}

/**
 * Reset impact analyzer (for testing)
 */
export function resetImpactAnalyzer(): void {
  impactAnalyzerInstance = null;
}
