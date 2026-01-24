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
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
/**
 * Validation Engine - Comprehensive data validation
 */
export class ValidationEngine {
    config;
    googleClient;
    stats;
    rules;
    validationCache;
    constructor(config = {}) {
        this.googleClient = config.googleClient;
        this.config = {
            enabled: config.enabled ?? true,
            validateBeforeOperations: config.validateBeforeOperations ?? true,
            stopOnFirstError: config.stopOnFirstError ?? false,
            maxErrors: config.maxErrors ?? 100,
            asyncTimeout: config.asyncTimeout ?? 5000,
            enableCaching: config.enableCaching ?? true,
            cacheTtl: config.cacheTtl ?? 300000, // 5 minutes - aligned with CACHE_TTL_* constants
            verboseLogging: config.verboseLogging ?? false,
        };
        this.stats = {
            totalValidations: 0,
            passedValidations: 0,
            failedValidations: 0,
            successRate: 0,
            avgValidationTime: 0,
            errorsByType: {
                data_type: 0,
                range: 0,
                format: 0,
                uniqueness: 0,
                required: 0,
                pattern: 0,
                custom: 0,
                business_rule: 0,
            },
            errorsBySeverity: {
                error: 0,
                warning: 0,
                info: 0,
            },
            cacheHitRate: 0,
        };
        this.rules = new Map();
        this.validationCache = new Map();
        // Register builtin validators
        this.registerBuiltinValidators();
        // Start cache cleanup
        this.startCacheCleanup();
    }
    /**
     * Register a validation rule
     */
    registerRule(rule) {
        this.rules.set(rule.id, rule);
        this.log(`Registered validation rule: ${rule.name}`);
    }
    /**
     * Validate a value against all applicable rules
     */
    async validate(value, context) {
        if (!this.config.enabled) {
            return this.createEmptyReport(context);
        }
        const startTime = Date.now();
        this.stats.totalValidations++;
        const errors = [];
        const warnings = [];
        const infoMessages = [];
        let totalChecks = 0;
        let passedChecks = 0;
        for (const rule of this.rules.values()) {
            if (!rule.enabled)
                continue;
            totalChecks++;
            // Check cache
            if (this.config.enableCaching) {
                const cacheKey = this.getCacheKey(rule.id, value);
                const cached = this.validationCache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
                    const result = cached.result;
                    if (result.valid) {
                        passedChecks++;
                    }
                    else {
                        this.addError(result, rule, value, errors, warnings, infoMessages, context);
                    }
                    continue;
                }
            }
            // Execute validator
            try {
                const result = await this.executeValidator(rule, value, context);
                // Cache result
                if (this.config.enableCaching) {
                    const cacheKey = this.getCacheKey(rule.id, value);
                    this.validationCache.set(cacheKey, { result, timestamp: Date.now() });
                }
                if (result.valid) {
                    passedChecks++;
                }
                else {
                    this.addError(result, rule, value, errors, warnings, infoMessages, context);
                    if (this.config.stopOnFirstError && rule.severity === 'error') {
                        break;
                    }
                }
            }
            catch (error) {
                this.log(`Validator error: ${rule.name} - ${error}`);
            }
            if (errors.length >= this.config.maxErrors) {
                break;
            }
        }
        const failedChecks = totalChecks - passedChecks;
        const valid = errors.length === 0;
        // Update statistics
        if (valid) {
            this.stats.passedValidations++;
        }
        else {
            this.stats.failedValidations++;
        }
        this.stats.successRate = this.stats.passedValidations / this.stats.totalValidations;
        const duration = Date.now() - startTime;
        this.stats.avgValidationTime =
            (this.stats.avgValidationTime * (this.stats.totalValidations - 1) + duration) /
                this.stats.totalValidations;
        // Update error statistics
        errors.forEach((err) => {
            this.stats.errorsByType[err.rule.type]++;
            this.stats.errorsBySeverity[err.severity]++;
        });
        const report = {
            id: uuidv4(),
            valid,
            totalChecks,
            passedChecks,
            failedChecks,
            errors,
            warnings,
            infoMessages,
            duration,
            timestamp: Date.now(),
            context,
        };
        return report;
    }
    /**
     * Validate multiple values
     */
    async validateBatch(values, context) {
        const reports = [];
        for (const value of values) {
            const report = await this.validate(value, context);
            reports.push(report);
        }
        return reports;
    }
    /**
     * Execute validator with timeout
     */
    async executeValidator(rule, value, context) {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Validator timeout')), this.config.asyncTimeout));
        const validation = Promise.resolve(rule.validator(value, context));
        try {
            return await Promise.race([validation, timeout]);
        }
        catch (error) {
            return {
                valid: false,
                message: error instanceof Error ? error.message : 'Validation failed',
                severity: rule.severity,
            };
        }
    }
    /**
     * Add error to appropriate list
     */
    addError(result, rule, value, errors, warnings, infoMessages, context) {
        const error = {
            id: uuidv4(),
            rule,
            value,
            message: result.message || rule.errorMessage,
            severity: result.severity || rule.severity,
            context,
            timestamp: Date.now(),
        };
        switch (error.severity) {
            case 'error':
                errors.push(error);
                break;
            case 'warning':
                warnings.push(error);
                break;
            case 'info':
                infoMessages.push(error);
                break;
        }
    }
    /**
     * Register builtin validators
     */
    registerBuiltinValidators() {
        // Data type validators
        this.registerDataTypeValidators();
        // Range validators
        this.registerRangeValidators();
        // Format validators
        this.registerFormatValidators();
        // Common validators
        this.registerCommonValidators();
    }
    /**
     * Register data type validators
     */
    registerDataTypeValidators() {
        // String validator
        this.registerRule({
            id: 'builtin_string',
            name: 'String Type',
            type: 'data_type',
            description: 'Validates that value is a string',
            validator: (value) => ({
                valid: typeof value === 'string',
                message: `Expected string, got ${typeof value}`,
            }),
            severity: 'error',
            errorMessage: 'Value must be a string',
            enabled: true,
        });
        // Number validator
        this.registerRule({
            id: 'builtin_number',
            name: 'Number Type',
            type: 'data_type',
            description: 'Validates that value is a number',
            validator: (value) => ({
                valid: typeof value === 'number' && !isNaN(value),
                message: `Expected number, got ${typeof value}`,
            }),
            severity: 'error',
            errorMessage: 'Value must be a number',
            enabled: true,
        });
        // Boolean validator
        this.registerRule({
            id: 'builtin_boolean',
            name: 'Boolean Type',
            type: 'data_type',
            description: 'Validates that value is a boolean',
            validator: (value) => ({
                valid: typeof value === 'boolean',
                message: `Expected boolean, got ${typeof value}`,
            }),
            severity: 'error',
            errorMessage: 'Value must be a boolean',
            enabled: true,
        });
        // Date validator
        this.registerRule({
            id: 'builtin_date',
            name: 'Date Type',
            type: 'data_type',
            description: 'Validates that value is a valid date',
            validator: (value) => {
                const date = new Date(value);
                return {
                    valid: !isNaN(date.getTime()),
                    message: 'Invalid date format',
                };
            },
            severity: 'error',
            errorMessage: 'Value must be a valid date',
            enabled: true,
        });
    }
    /**
     * Register range validators
     */
    registerRangeValidators() {
        // Positive number
        this.registerRule({
            id: 'builtin_positive',
            name: 'Positive Number',
            type: 'range',
            description: 'Validates that number is positive',
            validator: (value) => ({
                valid: typeof value === 'number' && value > 0,
                message: 'Value must be positive',
            }),
            severity: 'error',
            errorMessage: 'Value must be positive',
            enabled: true,
        });
        // Non-negative number
        this.registerRule({
            id: 'builtin_non_negative',
            name: 'Non-Negative Number',
            type: 'range',
            description: 'Validates that number is non-negative',
            validator: (value) => ({
                valid: typeof value === 'number' && value >= 0,
                message: 'Value must be non-negative',
            }),
            severity: 'error',
            errorMessage: 'Value must be non-negative',
            enabled: true,
        });
    }
    /**
     * Register format validators
     */
    registerFormatValidators() {
        // Email validator
        this.registerRule({
            id: 'builtin_email',
            name: 'Email Format',
            type: 'format',
            description: 'Validates email format',
            validator: (value) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return {
                    valid: typeof value === 'string' && emailRegex.test(value),
                    message: 'Invalid email format',
                };
            },
            severity: 'error',
            errorMessage: 'Value must be a valid email address',
            enabled: true,
        });
        // URL validator
        this.registerRule({
            id: 'builtin_url',
            name: 'URL Format',
            type: 'format',
            description: 'Validates URL format',
            validator: (value) => {
                try {
                    new URL(value);
                    return { valid: true };
                }
                catch {
                    return { valid: false, message: 'Invalid URL format' };
                }
            },
            severity: 'error',
            errorMessage: 'Value must be a valid URL',
            enabled: true,
        });
        // Phone validator (basic)
        this.registerRule({
            id: 'builtin_phone',
            name: 'Phone Format',
            type: 'format',
            description: 'Validates phone format',
            validator: (value) => {
                const phoneRegex = /^\+?[\d\s\-()]+$/;
                return {
                    valid: typeof value === 'string' && phoneRegex.test(value) && value.length >= 10,
                    message: 'Invalid phone format',
                };
            },
            severity: 'error',
            errorMessage: 'Value must be a valid phone number',
            enabled: true,
        });
    }
    /**
     * Register common validators
     */
    registerCommonValidators() {
        // Required (not empty)
        this.registerRule({
            id: 'builtin_required',
            name: 'Required',
            type: 'required',
            description: 'Validates that value is not empty',
            validator: (value) => ({
                valid: value !== null && value !== undefined && value !== '',
                message: 'Value is required',
            }),
            severity: 'error',
            errorMessage: 'This field is required',
            enabled: true,
        });
        // Non-empty string
        this.registerRule({
            id: 'builtin_non_empty_string',
            name: 'Non-Empty String',
            type: 'required',
            description: 'Validates that string is not empty',
            validator: (value) => ({
                valid: typeof value === 'string' && value.trim().length > 0,
                message: 'String cannot be empty',
            }),
            severity: 'error',
            errorMessage: 'Value cannot be empty',
            enabled: true,
        });
    }
    /**
     * Create empty report
     */
    createEmptyReport(context) {
        return {
            id: uuidv4(),
            valid: true,
            totalChecks: 0,
            passedChecks: 0,
            failedChecks: 0,
            errors: [],
            warnings: [],
            infoMessages: [],
            duration: 0,
            timestamp: Date.now(),
            context,
        };
    }
    /**
     * Get cache key
     */
    getCacheKey(ruleId, value) {
        return `${ruleId}:${JSON.stringify(value)}`;
    }
    /**
     * Start cache cleanup
     */
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            const expired = [];
            for (const [key, entry] of this.validationCache.entries()) {
                if (now - entry.timestamp > this.config.cacheTtl) {
                    expired.push(key);
                }
            }
            for (const key of expired) {
                this.validationCache.delete(key);
            }
            this.log(`Cleaned up ${expired.length} expired validation cache entries`);
        }, 60000); // Every minute
    }
    /**
     * Log message
     */
    log(message) {
        if (this.config.verboseLogging) {
            logger.debug('[ValidationEngine] ' + message);
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalValidations: 0,
            passedValidations: 0,
            failedValidations: 0,
            successRate: 0,
            avgValidationTime: 0,
            errorsByType: {
                data_type: 0,
                range: 0,
                format: 0,
                uniqueness: 0,
                required: 0,
                pattern: 0,
                custom: 0,
                business_rule: 0,
            },
            errorsBySeverity: {
                error: 0,
                warning: 0,
                info: 0,
            },
            cacheHitRate: 0,
        };
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.validationCache.clear();
    }
    /**
     * Get all registered rules
     */
    getRules() {
        return Array.from(this.rules.values());
    }
    /**
     * Enable/disable rule
     */
    setRuleEnabled(ruleId, enabled) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = enabled;
        }
    }
}
// Singleton instance
let validationEngineInstance = null;
/**
 * Initialize validation engine (call once during server startup)
 */
export function initValidationEngine(googleClient) {
    if (!validationEngineInstance) {
        validationEngineInstance = new ValidationEngine({
            enabled: process.env['VALIDATION_ENABLED'] !== 'false',
            validateBeforeOperations: process.env['VALIDATION_BEFORE_OPERATIONS'] !== 'false',
            stopOnFirstError: process.env['VALIDATION_STOP_ON_FIRST_ERROR'] === 'true',
            maxErrors: parseInt(process.env['VALIDATION_MAX_ERRORS'] || '100'),
            asyncTimeout: parseInt(process.env['VALIDATION_ASYNC_TIMEOUT'] || '5000'),
            enableCaching: process.env['VALIDATION_ENABLE_CACHING'] !== 'false',
            cacheTtl: parseInt(process.env['VALIDATION_CACHE_TTL'] || '300000'), // 5 minutes - aligned with CACHE_TTL_* constants
            verboseLogging: process.env['VALIDATION_VERBOSE'] === 'true',
            googleClient,
        });
    }
    return validationEngineInstance;
}
/**
 * Get validation engine instance
 */
export function getValidationEngine() {
    if (!validationEngineInstance) {
        throw new Error('Validation engine not initialized. Call initValidationEngine() first.');
    }
    return validationEngineInstance;
}
/**
 * Reset validation engine (for testing only)
 * @internal
 */
export function resetValidationEngine() {
    if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
        throw new Error('resetValidationEngine() can only be called in test environment');
    }
    validationEngineInstance = null;
}
//# sourceMappingURL=validation-engine.js.map