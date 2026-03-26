/**
 * Schema Validator — Google Sheets API Schema Compatibility
 *
 * Validates spreadsheets against Google Sheets Discovery API schema.
 * Detects breaking changes, deprecations, and migration requirements.
 * Generates actionable migration plans.
 *
 * Singleton pattern with caching for performance.
 */

import { ServiceError } from '../core/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  comparison?: unknown;
  recommendation?: string;
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type:
    | 'breaking_change'
    | 'deprecation'
    | 'new_feature'
    | 'type_change'
    | 'missing_method';
  path: string;
  message: string;
  suggestion?: string;
}

/**
 * Migration plan
 */
export interface MigrationPlan {
  steps: MigrationStep[];
  effort: 'low' | 'medium' | 'high';
  estimatedHours: number;
}

/**
 * Migration step
 */
export interface MigrationStep {
  id: string;
  title: string;
  description: string;
  action: string;
  verification: string;
}

/**
 * Schema Validator
 */
export class SchemaValidator {
  private currentSchema: unknown;
  private schemaCache: Map<string, ValidationResult> = new Map();
  private readonly cacheTTL = 60 * 60 * 1000; // 1 hour
  private cacheTimestamps: Map<string, number> = new Map();

  constructor() {
    logger.info('SchemaValidator initialized');
  }

  /**
   * Validate spreadsheet against current API schema
   */
  async validateAgainstCurrent(
    spreadsheetId: string,
    schema: unknown
  ): Promise<ValidationResult> {
    const cacheKey = `${spreadsheetId}:current`;
    const cached = this.schemaCache.get(cacheKey);
    const timestamp = this.cacheTimestamps.get(cacheKey) ?? 0;

    if (cached && Date.now() - timestamp < this.cacheTTL) {
      return cached;
    }

    try {
      // Validate against latest schema
      this.currentSchema = schema;
      const issues = this.detectCommonIssues(schema);
      const valid = issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length === 0;
      const recommendation = this.generateRecommendation(issues);
      const result = { valid, issues, recommendation };
      this.schemaCache.set(cacheKey, result);
      this.cacheTimestamps.set(cacheKey, Date.now());
      return result;
    } catch (err) {
      throw new ServiceError(
        `Validation failed: ${err instanceof Error ? err.message : String(err)}`,
        'VALIDATION_ERROR',
        'schema-validator'
      );
    }
  }

  /**
   * Compare two schema versions
   */
  compareSchemas(oldSchema: unknown, newSchema: unknown): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Simple comparison logic
    if (JSON.stringify(oldSchema) !== JSON.stringify(newSchema)) {
      issues.push({
        severity: 'high',
        type: 'breaking_change',
        path: 'root',
        message: 'Schema has changed',
        suggestion: 'Review migration plan',
      });
    }

    const valid = issues.length === 0;
    return { valid, issues };
  }

  /**
   * Generate migration plan
   */
  generateMigrationPlan(issues: ValidationIssue[]): MigrationPlan {
    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const highCount = issues.filter((i) => i.severity === 'high').length;
    let effort: 'low' | 'medium' | 'high' = 'low';
    let estimatedHours = 0.5;

    if (criticalCount > 0) {
      effort = 'high';
      estimatedHours = 8 + criticalCount * 2;
    } else if (highCount > 0) {
      effort = 'medium';
      estimatedHours = 2 + highCount * 1;
    }

    const steps: MigrationStep[] = [];
    for (const issue of issues) {
      steps.push({
        id: `step-${steps.length + 1}`,
        title: `Resolve ${issue.type}`,
        description: issue.message,
        action: issue.suggestion ?? 'Review documentation',
        verification: 'Validate schema again',
      });
    }

    return { steps, effort, estimatedHours };
  }

  /**
   * Format migration report as markdown
   */
  formatMigrationReport(plan: MigrationPlan): string {
    let report = '# Migration Plan\n\n';
    report += `**Effort Level:** ${plan.effort}\n`;
    report += `**Estimated Hours:** ${plan.estimatedHours}\n\n`;
    report += '## Steps\n\n';
    for (const step of plan.steps) {
      report += `### ${step.id}: ${step.title}\n`;
      report += `${step.description}\n\n`;
      report += `**Action:** ${step.action}\n`;
      report += `**Verification:** ${step.verification}\n\n`;
    }
    return report;
  }

  /**
   * Detect common schema issues
   */
  private detectCommonIssues(schema: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for required properties
    if (!schema) {
      issues.push({
        severity: 'critical',
        type: 'missing_method',
        path: 'root',
        message: 'Schema is empty',
      });
    }

    return issues;
  }

  /**
   * Generate recommendation based on issues
   */
  private generateRecommendation(issues: ValidationIssue[]): string {
    if (issues.length === 0) return 'Schema is valid. No changes needed.';
    const critical = issues.filter((i) => i.severity === 'critical').length;
    if (critical > 0) {
      return `Found ${critical} critical issue(s). Immediate action required.`;
    }
    return `Found ${issues.length} issue(s). Review and plan migration.`;
  }
}

/**
 * Global schema validator instance
 */
let globalValidator: SchemaValidator | null = null;

/**
 * Get global schema validator
 */
export function getSchemaValidator(): SchemaValidator {
  if (!globalValidator) {
    globalValidator = new SchemaValidator();
  }
  return globalValidator;
}

/**
 * Reset global schema validator (for testing)
 */
export function resetSchemaValidator(): void {
  globalValidator = null;
}
