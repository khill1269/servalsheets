/**
 * Quality validate action — data validation with built-in and custom validators.
 */

import { ErrorCodes } from '../error-codes.js';
import { ValidationEngine, getValidationEngine } from '../../services/validation-engine.js';
import { generateAIInsight } from '../../mcp/sampling.js';
import type { SamplingServer } from '../../mcp/sampling.js';
import { sendProgress } from '../../utils/request-context.js';
import type { QualityValidateInput, QualityResponse } from '../../schemas/quality.js';
import {
  isBuiltinRuleInput,
  isCustomRuleInput,
  buildValidationContext,
  compileCustomValidationRule,
} from './custom-rule-compiler.js';

export async function handleValidate(
  input: QualityValidateInput,
  samplingServer?: SamplingServer
): Promise<QualityResponse> {
  // value is now optional in schema for LLM discoverability — guard at runtime
  if (input.value === undefined) {
    return {
      success: false,
      error: {
        code: ErrorCodes.INVALID_PARAMS,
        message:
          'The "value" field is required for single-value validation. ' +
          'For range-based data validation, use sheets_fix.detect_anomalies, ' +
          'sheets_fix.clean, or sheets_analyze.scout instead.',
        retryable: false,
      },
    };
  }

  const requestedRules = input.rules ?? [];
  const builtinRuleIds = requestedRules.filter(isBuiltinRuleInput);
  const customRules = requestedRules.filter(isCustomRuleInput);
  const requestedRuleIds: string[] = [...builtinRuleIds];
  const validationEngine =
    customRules.length > 0
      ? new ValidationEngine({
          enabled: true,
          stopOnFirstError: input.stopOnFirstError ?? false,
          enableCaching: false,
          maxErrors: 100,
        })
      : getValidationEngine();

  customRules.forEach((rule, index) => {
    const compiledRule = compileCustomValidationRule(rule, index);
    validationEngine.registerRule(compiledRule);
    requestedRuleIds.push(compiledRule.id);
  });

  const totalRules = requestedRules.length;
  await sendProgress(0, 100, `Validating...${totalRules > 0 ? ` (${totalRules} rules)` : ''}`);
  const contextWithRules = buildValidationContext(
    input.context,
    requestedRuleIds.length > 0 ? requestedRuleIds : undefined
  );
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
        code: ErrorCodes.VALIDATION_ERROR,
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
  if (report.errors.length > 0 && samplingServer) {
    const errorSummary = report.errors
      .slice(0, 5)
      .map((e) => `${e.rule.name}: ${e.message}`)
      .join('\n');
    aiInsight = await generateAIInsight(
      samplingServer,
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
