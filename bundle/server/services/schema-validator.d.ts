/**
 * SchemaValidator
 *
 * @purpose Validates discovered Google API schemas against current implementation; detects breaking changes, deprecations, migration needs
 * @category Quality
 * @usage Use with DiscoveryClient to validate API compatibility; compares field changes, required parameters, deprecated endpoints
 * @dependencies logger, DiscoveryClient, SchemaCache
 * @stateful No - stateless validation comparing two schemas
 * @singleton No - can be instantiated per validation request
 *
 * @example
 * const validator = new SchemaValidator();
 * const comparison = await validator.validate(currentSchema, discoveredSchema);
 * if (comparison.breaking Changes.length > 0) logger.error('Breaking changes detected:', comparison.breakingChanges);
 * if (comparison.deprecations.length > 0) logger.warn('Deprecations found:', comparison.deprecations);
 */
import { DiscoveryApiClient, type SchemaComparison, type DiscoverySchema } from './discovery-client.js';
import { SchemaCache } from './schema-cache.js';
/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
    comparison?: SchemaComparison;
    recommendation: string;
}
/**
 * Validation issue
 */
export interface ValidationIssue {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    type: 'breaking_change' | 'deprecation' | 'new_feature' | 'type_change' | 'missing_method';
    path: string;
    message: string;
    suggestedAction?: string;
}
/**
 * Migration plan
 */
export interface MigrationPlan {
    api: string;
    version: string;
    hasBreakingChanges: boolean;
    estimatedEffort: 'low' | 'medium' | 'high';
    steps: MigrationStep[];
    affectedFiles: string[];
    testingRequired: string[];
}
/**
 * Migration step
 */
export interface MigrationStep {
    order: number;
    title: string;
    description: string;
    category: 'code_change' | 'test_update' | 'documentation' | 'verification';
    priority: 'required' | 'recommended' | 'optional';
    estimatedTime: string;
    codeExample?: string;
}
/**
 * Schema Validator Configuration
 */
export interface SchemaValidatorConfig {
    discoveryClient?: DiscoveryApiClient;
    schemaCache?: SchemaCache;
    strictMode?: boolean;
}
/**
 * Schema Validator
 *
 * Validates discovered schemas and generates migration guidance.
 */
export declare class SchemaValidator {
    private readonly discoveryClient;
    private readonly schemaCache;
    private readonly strictMode;
    constructor(config?: SchemaValidatorConfig);
    /**
     * Validate current implementation against latest API schema
     */
    validateAgainstCurrent(api: 'sheets' | 'drive'): Promise<ValidationResult>;
    /**
     * Compare two schemas and validate compatibility
     */
    compareSchemas(api: 'sheets' | 'drive', currentSchema: DiscoverySchema, newSchema: DiscoverySchema): Promise<ValidationResult>;
    /**
     * Generate migration plan from schema comparison
     */
    generateMigrationPlan(comparison: SchemaComparison): MigrationPlan;
    /**
     * Get formatted migration report
     */
    formatMigrationReport(plan: MigrationPlan): string;
    /**
     * Detect common issues in a schema
     */
    private detectCommonIssues;
    /**
     * Convert schema comparison to validation issues
     */
    private comparisonToIssues;
    /**
     * Generate recommendation based on issues
     */
    private generateRecommendation;
    /**
     * Get affected files based on comparison
     */
    private getAffectedFiles;
    /**
     * Get testing requirements based on comparison
     */
    private getTestingRequirements;
    /**
     * Generate code example for deprecation
     */
    private generateDeprecationExample;
    /**
     * Generate code example for type change
     */
    private generateTypeChangeExample;
    /**
     * Generate code example for new field
     */
    private generateNewFieldExample;
}
/**
 * Get or create global schema validator
 */
export declare function getSchemaValidator(): SchemaValidator;
/**
 * Reset global schema validator
 */
export declare function resetSchemaValidator(): void;
//# sourceMappingURL=schema-validator.d.ts.map