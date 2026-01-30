/**
 * ServalSheets - Quality Handler
 *
 * Enterprise quality assurance combining validation, conflict detection, and impact analysis.
 *
 * Actions (4):
 * - validate: Data validation with built-in validators
 * - detect_conflicts: Detect concurrent modification conflicts
 * - resolve_conflict: Resolve detected conflicts with strategies
 * - analyze_impact: Pre-execution impact analysis with dependency tracking
 */

import { getValidationEngine } from '../services/validation-engine.js';
import { getConflictDetector } from '../services/conflict-detector.js';
import { getImpactAnalyzer } from '../services/impact-analyzer.js';
import type {
  SheetsQualityInput,
  SheetsQualityOutput,
  QualityResponse,
  QualityValidateInput,
  QualityDetectConflictsInput,
  QualityResolveConflictInput,
  QualityAnalyzeImpactInput,
} from '../schemas/quality.js';
import { unwrapRequest } from './base.js';
import { ValidationError } from '../core/errors.js';

export interface QualityHandlerOptions {
  // Options can be added as needed
}

export class QualityHandler {
  constructor(_options: QualityHandlerOptions = {}) {
    // Constructor logic if needed
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: QualityResponse,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): QualityResponse {
    if (!response.success || verbosity === 'standard') {
      return response;
    }

    if (verbosity === 'minimal') {
      // For minimal verbosity, strip _meta field
      const { _meta, ...rest } = response as Record<string, unknown>;
      return rest as QualityResponse;
    }

    return response;
  }

  async handle(input: SheetsQualityInput): Promise<SheetsQualityOutput> {
    const req = unwrapRequest<SheetsQualityInput['request']>(input);
    try {
      let response: QualityResponse;

      switch (req.action) {
        case 'validate':
          response = await this.handleValidate(req as QualityValidateInput);
          break;
        case 'detect_conflicts':
          response = await this.handleDetectConflicts(req as QualityDetectConflictsInput);
          break;
        case 'resolve_conflict':
          response = await this.handleResolveConflict(req as QualityResolveConflictInput);
          break;
        case 'analyze_impact':
          response = await this.handleAnalyzeImpact(req as QualityAnalyzeImpactInput);
          break;
        default:
          throw new ValidationError(
            `Unknown action: ${(input as { action?: string }).action}`,
            'action',
            'validate | detect_conflicts | resolve_conflict | analyze_impact'
          );
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = this.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (error) {
      // Catch-all for unexpected errors
      return {
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }

  /**
   * VALIDATE: Data validation with built-in validators
   */
  private async handleValidate(input: QualityValidateInput): Promise<QualityResponse> {
    const validationEngine = getValidationEngine();
    // Pass rules filter to validation engine - only run specified rules if provided
    const contextWithRules = {
      ...input.context,
      rules: input.rules, // Filter to only these rule IDs if specified
    };
    const report = await validationEngine.validate(input.value, contextWithRules);

    // Check if dry run mode is enabled
    const isDryRun = input.safety?.dryRun ?? false;

    const response: QualityResponse = {
      success: true,
      action: 'validate',
      valid: report.valid,
      errorCount: report.errors.length,
      warningCount: report.warnings.length,
      infoCount: report.infoMessages.length,
      totalChecks: report.totalChecks,
      passedChecks: report.passedChecks,
      errors: report.errors?.map((e) => ({
        ruleId: e.rule.id,
        ruleName: e.rule.name,
        severity: e.severity,
        message: e.message,
        actualValue: e.value,
        expectedValue: undefined,
        path: e.cell,
      })),
      warnings: report.warnings?.map((w) => ({
        ruleId: w.rule.id,
        ruleName: w.rule.name,
        message: w.message,
      })),
      duration: report.duration,
      message: report.valid
        ? `Validation passed. ${report.passedChecks}/${report.totalChecks} checks passed.`
        : `Validation failed. ${report.errors.length} error(s), ${report.warnings.length} warning(s).`,
    };

    // Add dry run preview if requested
    if (isDryRun) {
      response.dryRun = true;
      response.validationPreview = {
        wouldApply: report.valid,
        affectedCells: report.errors.length + report.warnings.length,
        rulesPreview: report.errors.map((e) => ({
          ruleId: e.rule.id,
          condition: e.rule.name,
          cellsAffected: 1,
        })),
      };
    }

    return response;
  }

  /**
   * DETECT_CONFLICTS: Detect concurrent modification conflicts
   *
   * Note: Conflict detection currently works automatically during write operations.
   * Explicit detection queries are not yet implemented.
   */
  private async handleDetectConflicts(
    _input: QualityDetectConflictsInput
  ): Promise<QualityResponse> {
    // Phase 1 Fix: Add explicit warning that this is a limited implementation
    // Future: Query active conflicts from detector's internal state
    // For now, return empty list with warning
    return {
      success: true,
      action: 'detect_conflicts',
      conflicts: [],
      warningCount: 1,
      warnings: [
        {
          ruleId: 'FEATURE_LIMITED',
          ruleName: 'Limited Implementation',
          message:
            'Conflict detection is currently limited to automatic checks during write operations. ' +
            'Explicit conflict queries across spreadsheet history are not yet implemented. ' +
            'Use analyze_impact action for pre-execution dependency analysis.',
        },
      ],
      message: 'Conflict detection service available. No active conflicts found.',
    };
  }

  /**
   * RESOLVE_CONFLICT: Resolve detected conflicts with strategies
   */
  private async handleResolveConflict(
    input: QualityResolveConflictInput
  ): Promise<QualityResponse> {
    const conflictDetector = getConflictDetector();

    // Map schema strategy to actual ResolutionStrategy type
    const strategyMap: Record<
      string,
      'overwrite' | 'merge' | 'cancel' | 'manual' | 'last_write_wins' | 'first_write_wins'
    > = {
      keep_local: 'overwrite',
      keep_remote: 'cancel',
      merge: 'merge',
      manual: 'manual',
    };

    const result = await conflictDetector.resolveConflict({
      conflictId: input.conflictId,
      strategy: strategyMap[input.strategy] || 'manual',
      mergeData: input.mergedValue,
    });

    if (result.success) {
      return {
        success: true,
        action: 'resolve_conflict',
        conflictId: input.conflictId,
        resolved: true,
        resolution: {
          strategy: input.strategy,
          finalValue: result.changesApplied,
          version: result.finalVersion?.version || 0,
        },
        message: `Conflict resolved using strategy: ${input.strategy}`,
      };
    } else {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: result.error?.message || 'Failed to resolve conflict',
          retryable: false,
        },
      };
    }
  }

  /**
   * ANALYZE_IMPACT: Pre-execution impact analysis with dependency tracking
   */
  private async handleAnalyzeImpact(input: QualityAnalyzeImpactInput): Promise<QualityResponse> {
    const impactAnalyzer = getImpactAnalyzer();
    const analysis = await impactAnalyzer.analyzeOperation(input.operation);

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
          formulas: analysis.formulasAffected.map((f) => f.cell),
          charts: analysis.chartsAffected.map((c) => c.title),
          pivotTables: analysis.pivotTablesAffected.map((p) => `PivotTable ${p.pivotTableId}`),
          validationRules: analysis.validationRulesAffected.map((v) => v.range),
          namedRanges: analysis.namedRangesAffected.map((n) => n.name),
          protectedRanges: analysis.protectedRangesAffected.map((p) => p.range),
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
}
