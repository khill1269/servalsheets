/**
 * ServalSheets - Validation Handler
 *
 * Handles data validation with builtin and custom rules.
 */

import { getValidationEngine } from '../services/validation-engine.js';
import type {
  SheetsValidationInput,
  SheetsValidationOutput,
  ValidationResponse,
} from '../schemas/validation.js';

export interface ValidationHandlerOptions {
  // Options can be added as needed
}

export class ValidationHandler {
  constructor(_options: ValidationHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(input: SheetsValidationInput): Promise<SheetsValidationOutput> {
    const { request } = input;
    const validationEngine = getValidationEngine();

    try {
      let response: ValidationResponse;

      switch (request.action) {
        case 'validate': {
          const report = await validationEngine.validate(request.value, request.context);

          response = {
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
          break;
        }
      }

      return { response };
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
}
