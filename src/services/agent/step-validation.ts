import { logger } from '../../utils/logger.js';

export interface StepValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Agent Step Validation
 *
 * Validates agent plan steps before execution to catch issues early.
 */

export class AgentStepValidator {
  validateStep(step: any): StepValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!step.tool) errors.push('Step missing required field: tool');
    if (!step.action) errors.push('Step missing required field: action');
    if (!step.params) warnings.push('Step has no parameters');

    // Check param types
    if (step.params && typeof step.params !== 'object') {
      errors.push('Step params must be an object');
    }

    // Check for destructive operations
    const destructiveActions = ['delete', 'clear', 'remove'];
    if (destructiveActions.some((a) => step.action.includes(a)) && !step.confirm) {
      warnings.push(`Destructive action '${step.action}' should include confirmation flag`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
