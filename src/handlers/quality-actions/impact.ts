/**
 * Quality impact analysis action — pre-execution impact analysis with dependency tracking.
 */

import { getImpactAnalyzer } from '../../services/impact-analyzer.js';
import type { QualityAnalyzeImpactInput, QualityResponse } from '../../schemas/quality.js';

export async function handleAnalyzeImpact(
  input: QualityAnalyzeImpactInput
): Promise<QualityResponse> {
  const impactAnalyzer = getImpactAnalyzer();
  // Provide defaults for optional operation fields (schema allows all optional)
  const operation = {
    type: input.operation.type ?? 'unknown',
    tool: input.operation.tool ?? 'unknown',
    action: input.operation.action ?? 'unknown',
    params: input.operation.params ?? {},
  };
  const analysis = await impactAnalyzer.analyzeOperation(operation);

  return {
    success: true,
    action: 'analyze_impact',
    impact: {
      severity: analysis.severity,
      scope: {
        rows: analysis.rowsAffected,
        columns: analysis.columnsAffected,
        cells: analysis.cellsAffected,
        sheets: [],
      },
      affectedResources: {
        formulas: (analysis.formulasAffected ?? []).map((f) => f?.cell).filter(Boolean),
        charts: (analysis.chartsAffected ?? []).map((c) => c?.title).filter(Boolean),
        pivotTables: (analysis.pivotTablesAffected ?? [])
          .map((p) => (p ? `PivotTable ${p.pivotTableId}` : ''))
          .filter(Boolean),
        validationRules: (analysis.validationRulesAffected ?? [])
          .map((v) => v?.range)
          .filter(Boolean),
        namedRanges: (analysis.namedRangesAffected ?? []).map((n) => n?.name).filter(Boolean),
        protectedRanges: (analysis.protectedRangesAffected ?? [])
          .map((p) => p?.range)
          .filter(Boolean),
      },
      estimatedExecutionTime: analysis.estimatedExecutionTime,
      warnings: analysis.warnings.map((w) => ({
        severity: w.severity,
        message: w.message,
        affectedResources: w.suggestedAction ? [w.suggestedAction] : undefined,
      })),
      recommendations: analysis.recommendations.map((r) => ({
        action: r,
        reason: 'Suggested based on impact analysis',
        priority:
          analysis.severity === 'high' || analysis.severity === 'critical'
            ? ('high' as const)
            : ('medium' as const),
      })),
      canProceed: analysis.severity !== 'critical',
      requiresConfirmation: analysis.severity === 'high' || analysis.severity === 'critical',
    },
    message: `Impact analysis complete. Severity: ${analysis.severity}, ${analysis.cellsAffected} cell(s) affected, ${analysis.warnings.length} warning(s).`,
  };
}
