/**
 * ValidationEngine
 *
 * @purpose Comprehensive data validation with 11 built-in validators: type, range, format, uniqueness, dependencies, business rules
 * @category Quality
 * @usage Use before write operations to validate data quality; supports custom validators and severity levels (error/warning/info)
 * @dependencies logger, validation types
 * @stateful Yes - maintains validation rule registry, custom validators, validation statistics (rules executed, errors found)
 * @singleton No - instantiate per validation context with specific rule sets
 *
 * @example
 * const engine = new ValidationEngine({ strictMode: true });
 * engine.registerRule({ type: 'range', field: 'age', min: 0, max: 120 });
 * const result = await engine.validate(data, { context: 'user_profile' });
 * if (!result.valid) logger.info(result.errors);
 */
import { ValidationRule, ValidationReport, ValidationContext, ValidationEngineConfig, ValidationEngineStats } from '../types/validation.js';
/**
 * Validation Engine - Comprehensive data validation
 */
export declare class ValidationEngine {
    private config;
    private googleClient?;
    private stats;
    private rules;
    private validationCache;
    constructor(config?: ValidationEngineConfig);
    /**
     * Register a validation rule
     */
    registerRule(rule: ValidationRule): void;
    /**
     * Validate a value against all applicable rules
     */
    validate(value: unknown, context?: ValidationContext): Promise<ValidationReport>;
    /**
     * Validate multiple values
     */
    validateBatch(values: unknown[], context?: ValidationContext): Promise<ValidationReport[]>;
    /**
     * Execute validator with timeout
     */
    private executeValidator;
    /**
     * Add error to appropriate list
     */
    private addError;
    /**
     * Register builtin validators
     */
    private registerBuiltinValidators;
    /**
     * Register data type validators
     */
    private registerDataTypeValidators;
    /**
     * Register range validators
     */
    private registerRangeValidators;
    /**
     * Register format validators
     */
    private registerFormatValidators;
    /**
     * Register common validators
     */
    private registerCommonValidators;
    /**
     * Create empty report
     */
    private createEmptyReport;
    /**
     * Get cache key
     */
    private getCacheKey;
    /**
     * Start cache cleanup
     */
    private startCacheCleanup;
    /**
     * Log message
     */
    private log;
    /**
     * Get statistics
     */
    getStats(): ValidationEngineStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get all registered rules
     */
    getRules(): ValidationRule[];
    /**
     * Enable/disable rule
     */
    setRuleEnabled(ruleId: string, enabled: boolean): void;
}
/**
 * Initialize validation engine (call once during server startup)
 */
export declare function initValidationEngine(googleClient?: ValidationEngineConfig['googleClient']): ValidationEngine;
/**
 * Get validation engine instance
 */
export declare function getValidationEngine(): ValidationEngine;
/**
 * Reset validation engine (for testing only)
 * @internal
 */
export declare function resetValidationEngine(): void;
//# sourceMappingURL=validation-engine.d.ts.map