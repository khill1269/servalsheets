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
import { applyVerbosityFilter } from './helpers/verbosity-filter.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { sendProgress } from '../utils/request-context.js';
import { logger } from '../utils/logger.js';
import { generateAIInsight } from '../mcp/sampling.js';
import type { SamplingServer } from '../mcp/sampling.js';

export interface QualityHandlerOptions {
  samplingServer?: SamplingServer;
}

export class QualityHandler {
  private samplingServer?: SamplingServer;

  constructor(options: QualityHandlerOptions = {}) {
    this.samplingServer = options.samplingServer;
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
        default: {
          const _exhaustiveCheck: never = req;
          throw new ValidationError(
            `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
            'action',
            'validate | detect_conflicts | resolve_conflict | analyze_impact'
          );
        }
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (error) {
      // Catch-all for unexpected errors
      logger.error('Quality handler error', {
        action: req.action,
        error,
      });
      return {
        response: {
          success: false,
          error: mapStandaloneError(error),
        },
      };
    }
  }

  /**
   * VALIDATE: Data validation with built-in validators
   */
  private async handleValidate(input: QualityValidateInput): Promise<QualityResponse> {
    const validationEngine = getValidationEngine();
    const totalRules = input.rules?.length ?? 0;
    await sendProgress(0, 100, `Validating...${totalRules > 0 ? ` (${totalRules} rules)` : ''}`);
    // Pass rules filter to validation engine - only run specified rules if provided
    const contextWithRules = {
      ...input.context,
      rules: input.rules, // Filter to only these rule IDs if specified
    };
    const report = await validationEngine.validate(input.value, contextWithRules);
    await sendProgress(100, 100, 'Validation complete');

    // Check if dry run mode is enabled
    const isDryRun = input.safety?.dryRun ?? false;

    const hasErrors = report.errors.length > 0;

    // When validation finds errors, return success: false so the caller knows data is invalid.
    // This eliminates the ambiguous success:true + valid:false dual-success pattern (ISSUE-136).
    if (hasErrors) {
      const response: QualityResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Validation failed. ${report.errors.length} error(s), ${report.warnings.length} warning(s).`,
          retryable: false,
          details: {
            valid: false,
            errorCount: report.errors.length,
            warningCount: report.warnings.length,
            totalChecks: report.totalChecks,
            passedChecks: report.passedChecks,
            errors: report.errors?.map((e) => ({
              ruleId: e.rule.id,
              ruleName: e.rule.name,
              severity: e.severity,
              message: e.message,
            })),
          },
        },
      };
      return response;
    }

    // Generate AI insight for validation failures
    let aiInsight: string | undefined;
    if (report.errors.length > 0 && this.samplingServer) {
      const errorSummary = report.errors
        .slice(0, 5)
        .map((e) => `${e.rule.name}: ${e.message}`)
        .join('\n');
      aiInsight = await generateAIInsight(
        this.samplingServer,
        'dataCleaning',
        `Explain these validation failures and recommend specific fixes for each`,
        errorSummary,
        { maxTokens: 400 }
      );
    }

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
        // e.value is `unknown`; schema accepts the specific value union. Cast via unknown.
        actualValue: e.value as
          | string
          | number
          | boolean
          | null
          | unknown[]
          | Record<string, unknown>,
        path: e.cell,
      })),
      warnings: report.warnings?.map((w) => ({
        ruleId: w.rule.id,
        ruleName: w.rule.name,
        message: w.message,
      })),
      duration: report.duration,
      message: `Validation passed. ${report.passedChecks}/${report.totalChecks} checks passed.`,
      ...(aiInsight !== undefined ? { aiInsight } : {}),
    };

    // Add dry run preview if requested
    if (isDryRun) {
      // `dryRun` and `validationPreview` are optional fields on the success branch of
      // QualityResponse. We narrow to the success variant before assignment.
      const successResponse = response as Extract<QualityResponse, { success: true }>;
      successResponse.dryRun = true;
      successResponse.validationPreview = {
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

    // Generate AI insight for conflict resolution strategy (even with no active conflicts)
    let aiInsight: string | undefined;
    if (this.samplingServer) {
      aiInsight = await generateAIInsight(
        this.samplingServer,
        'dataAnalysis',
        'Analyze these conflicts and recommend the best resolution strategy for each',
        'No active conflicts detected. Conflict detection is limited to automatic checks during write operations.',
        { maxTokens: 300 }
      );
    }

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
      ...(aiInsight !== undefined ? { aiInsight } : {}),
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
          // ChangeSet is a typed object; schema accepts Record<string, unknown> here.
          finalValue: result.changesApplied as unknown as Record<string, unknown>,
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
}
