/**
 * ServalSheets - Impact Handler
 *
 * Handles pre-execution impact analysis with dependency tracking.
 */

import { getImpactAnalyzer } from "../services/impact-analyzer.js";
import type {
  SheetsImpactInput,
  SheetsImpactOutput,
  ImpactResponse,
  ImpactAnalyzeInput,
} from "../schemas/impact.js";

export interface ImpactHandlerOptions {
  // Options can be added as needed
}

export class ImpactHandler {
  constructor(_options: ImpactHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(input: SheetsImpactInput): Promise<SheetsImpactOutput> {
    // Input is now the action directly (no request wrapper)
    const impactAnalyzer = getImpactAnalyzer();

    try {
      // Type narrowing: after schema validation, we know operation exists for analyze action
      const analyzeInput = input as ImpactAnalyzeInput;
      const analysis = await impactAnalyzer.analyzeOperation(analyzeInput.operation);

      const response: ImpactResponse = {
        success: true,
        action: "analyze",
        impact: {
          severity: analysis.severity,
          scope: {
            rows: analysis.rowsAffected,
            columns: analysis.columnsAffected,
            cells: analysis.cellsAffected,
            sheets: [],
          },
          affectedResources: {
            formulas: analysis.formulasAffected.map((f) => f.cell),
            charts: analysis.chartsAffected.map((c) => c.title),
            pivotTables: analysis.pivotTablesAffected.map(
              (p) => `PivotTable ${p.pivotTableId}`,
            ),
            validationRules: analysis.validationRulesAffected.map(
              (v) => v.range,
            ),
            namedRanges: analysis.namedRangesAffected.map((n) => n.name),
            protectedRanges: analysis.protectedRangesAffected.map(
              (p) => p.range,
            ),
          },
          estimatedExecutionTime: analysis.estimatedExecutionTime,
          warnings: analysis.warnings.map((w) => ({
            severity: w.severity,
            message: w.message,
            affectedResources: w.suggestedAction
              ? [w.suggestedAction]
              : undefined,
          })),
          recommendations: analysis.recommendations.map((r) => ({
            action: r,
            reason: "Suggested based on impact analysis",
            priority:
              analysis.severity === "high" || analysis.severity === "critical"
                ? ("high" as const)
                : ("medium" as const),
          })),
          canProceed: analysis.severity !== "critical",
          requiresConfirmation:
            analysis.severity === "high" || analysis.severity === "critical",
        },
        message: `Impact analysis complete. Severity: ${analysis.severity}, ${analysis.cellsAffected} cell(s) affected, ${analysis.warnings.length} warning(s).`,
      };

      return { response };
    } catch (error) {
      // Catch-all for unexpected errors
      return {
        response: {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }
}
