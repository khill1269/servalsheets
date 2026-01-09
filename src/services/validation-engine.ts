/**
 * ServalSheets - Validation Engine
 *
 * Comprehensive validation system:
 * - Data type validation
 * - Range validation
 * - Format validation
 * - Business rules
 * - Custom validators
 *
 * Phase 4, Task 4.4
 */

import { v4 as uuidv4 } from "uuid";
import {
  ValidationRule,
  ValidationRuleType as _ValidationRuleType,
  ValidationSeverity as _ValidationSeverity,
  ValidationResult,
  ValidationError,
  ValidationReport,
  ValidationContext,
  ValidationEngineConfig,
  ValidationEngineStats,
  DataType as _DataType,
  DataTypeValidation as _DataTypeValidation,
  RangeValidation as _RangeValidation,
  FormatValidation as _FormatValidation,
} from "../types/validation.js";

/**
 * Validation Engine - Comprehensive data validation
 */
export class ValidationEngine {
  private config: Required<Omit<ValidationEngineConfig, "googleClient">>;
  private googleClient?: ValidationEngineConfig["googleClient"];
  private stats: ValidationEngineStats;
  private rules: Map<string, ValidationRule>;
  private validationCache: Map<
    string,
    { result: ValidationResult; timestamp: number }
  >;

  constructor(config: ValidationEngineConfig = {}) {
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
  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
    this.log(`Registered validation rule: ${rule.name}`);
  }

  /**
   * Validate a value against all applicable rules
   */
  async validate(
    value: unknown,
    context?: ValidationContext,
  ): Promise<ValidationReport> {
    if (!this.config.enabled) {
      return this.createEmptyReport(context);
    }

    const startTime = Date.now();
    this.stats.totalValidations++;

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const infoMessages: ValidationError[] = [];

    let totalChecks = 0;
    let passedChecks = 0;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      totalChecks++;

      // Check cache
      if (this.config.enableCaching) {
        const cacheKey = this.getCacheKey(rule.id, value);
        const cached = this.validationCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
          const result = cached.result;
          if (result.valid) {
            passedChecks++;
          } else {
            this.addError(
              result,
              rule,
              value,
              errors,
              warnings,
              infoMessages,
              context,
            );
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
        } else {
          this.addError(
            result,
            rule,
            value,
            errors,
            warnings,
            infoMessages,
            context,
          );

          if (this.config.stopOnFirstError && rule.severity === "error") {
            break;
          }
        }
      } catch (error) {
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
    } else {
      this.stats.failedValidations++;
    }

    this.stats.successRate =
      this.stats.passedValidations / this.stats.totalValidations;

    const duration = Date.now() - startTime;
    this.stats.avgValidationTime =
      (this.stats.avgValidationTime * (this.stats.totalValidations - 1) +
        duration) /
      this.stats.totalValidations;

    // Update error statistics
    errors.forEach((err) => {
      this.stats.errorsByType[err.rule.type]++;
      this.stats.errorsBySeverity[err.severity]++;
    });

    const report: ValidationReport = {
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
  async validateBatch(
    values: unknown[],
    context?: ValidationContext,
  ): Promise<ValidationReport[]> {
    const reports: ValidationReport[] = [];

    for (const value of values) {
      const report = await this.validate(value, context);
      reports.push(report);
    }

    return reports;
  }

  /**
   * Execute validator with timeout
   */
  private async executeValidator(
    rule: ValidationRule,
    value: unknown,
    context?: ValidationContext,
  ): Promise<ValidationResult> {
    const timeout = new Promise<ValidationResult>((_, reject) =>
      setTimeout(
        () => reject(new Error("Validator timeout")),
        this.config.asyncTimeout,
      ),
    );

    const validation = Promise.resolve(rule.validator(value, context));

    try {
      return await Promise.race([validation, timeout]);
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : "Validation failed",
        severity: rule.severity,
      };
    }
  }

  /**
   * Add error to appropriate list
   */
  private addError(
    result: ValidationResult,
    rule: ValidationRule,
    value: unknown,
    errors: ValidationError[],
    warnings: ValidationError[],
    infoMessages: ValidationError[],
    context?: ValidationContext,
  ): void {
    const error: ValidationError = {
      id: uuidv4(),
      rule,
      value,
      message: result.message || rule.errorMessage,
      severity: result.severity || rule.severity,
      context,
      timestamp: Date.now(),
    };

    switch (error.severity) {
      case "error":
        errors.push(error);
        break;
      case "warning":
        warnings.push(error);
        break;
      case "info":
        infoMessages.push(error);
        break;
    }
  }

  /**
   * Register builtin validators
   */
  private registerBuiltinValidators(): void {
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
  private registerDataTypeValidators(): void {
    // String validator
    this.registerRule({
      id: "builtin_string",
      name: "String Type",
      type: "data_type",
      description: "Validates that value is a string",
      validator: (value) => ({
        valid: typeof value === "string",
        message: `Expected string, got ${typeof value}`,
      }),
      severity: "error",
      errorMessage: "Value must be a string",
      enabled: true,
    });

    // Number validator
    this.registerRule({
      id: "builtin_number",
      name: "Number Type",
      type: "data_type",
      description: "Validates that value is a number",
      validator: (value) => ({
        valid: typeof value === "number" && !isNaN(value),
        message: `Expected number, got ${typeof value}`,
      }),
      severity: "error",
      errorMessage: "Value must be a number",
      enabled: true,
    });

    // Boolean validator
    this.registerRule({
      id: "builtin_boolean",
      name: "Boolean Type",
      type: "data_type",
      description: "Validates that value is a boolean",
      validator: (value) => ({
        valid: typeof value === "boolean",
        message: `Expected boolean, got ${typeof value}`,
      }),
      severity: "error",
      errorMessage: "Value must be a boolean",
      enabled: true,
    });

    // Date validator
    this.registerRule({
      id: "builtin_date",
      name: "Date Type",
      type: "data_type",
      description: "Validates that value is a valid date",
      validator: (value) => {
        const date = new Date(value as string);
        return {
          valid: !isNaN(date.getTime()),
          message: "Invalid date format",
        };
      },
      severity: "error",
      errorMessage: "Value must be a valid date",
      enabled: true,
    });
  }

  /**
   * Register range validators
   */
  private registerRangeValidators(): void {
    // Positive number
    this.registerRule({
      id: "builtin_positive",
      name: "Positive Number",
      type: "range",
      description: "Validates that number is positive",
      validator: (value) => ({
        valid: typeof value === "number" && value > 0,
        message: "Value must be positive",
      }),
      severity: "error",
      errorMessage: "Value must be positive",
      enabled: true,
    });

    // Non-negative number
    this.registerRule({
      id: "builtin_non_negative",
      name: "Non-Negative Number",
      type: "range",
      description: "Validates that number is non-negative",
      validator: (value) => ({
        valid: typeof value === "number" && value >= 0,
        message: "Value must be non-negative",
      }),
      severity: "error",
      errorMessage: "Value must be non-negative",
      enabled: true,
    });
  }

  /**
   * Register format validators
   */
  private registerFormatValidators(): void {
    // Email validator
    this.registerRule({
      id: "builtin_email",
      name: "Email Format",
      type: "format",
      description: "Validates email format",
      validator: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
          valid: typeof value === "string" && emailRegex.test(value),
          message: "Invalid email format",
        };
      },
      severity: "error",
      errorMessage: "Value must be a valid email address",
      enabled: true,
    });

    // URL validator
    this.registerRule({
      id: "builtin_url",
      name: "URL Format",
      type: "format",
      description: "Validates URL format",
      validator: (value) => {
        try {
          new URL(value as string);
          return { valid: true };
        } catch {
          return { valid: false, message: "Invalid URL format" };
        }
      },
      severity: "error",
      errorMessage: "Value must be a valid URL",
      enabled: true,
    });

    // Phone validator (basic)
    this.registerRule({
      id: "builtin_phone",
      name: "Phone Format",
      type: "format",
      description: "Validates phone format",
      validator: (value) => {
        const phoneRegex = /^\+?[\d\s\-()]+$/;
        return {
          valid:
            typeof value === "string" &&
            phoneRegex.test(value) &&
            value.length >= 10,
          message: "Invalid phone format",
        };
      },
      severity: "error",
      errorMessage: "Value must be a valid phone number",
      enabled: true,
    });
  }

  /**
   * Register common validators
   */
  private registerCommonValidators(): void {
    // Required (not empty)
    this.registerRule({
      id: "builtin_required",
      name: "Required",
      type: "required",
      description: "Validates that value is not empty",
      validator: (value) => ({
        valid: value !== null && value !== undefined && value !== "",
        message: "Value is required",
      }),
      severity: "error",
      errorMessage: "This field is required",
      enabled: true,
    });

    // Non-empty string
    this.registerRule({
      id: "builtin_non_empty_string",
      name: "Non-Empty String",
      type: "required",
      description: "Validates that string is not empty",
      validator: (value) => ({
        valid: typeof value === "string" && value.trim().length > 0,
        message: "String cannot be empty",
      }),
      severity: "error",
      errorMessage: "Value cannot be empty",
      enabled: true,
    });
  }

  /**
   * Create empty report
   */
  private createEmptyReport(context?: ValidationContext): ValidationReport {
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
  private getCacheKey(ruleId: string, value: unknown): string {
    return `${ruleId}:${JSON.stringify(value)}`;
  }

  /**
   * Start cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];

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
  private log(message: string): void {
    if (this.config.verboseLogging) {
      // eslint-disable-next-line no-console
      console.log(`[ValidationEngine] ${message}`); // Debugging output when verboseLogging enabled
    }
  }

  /**
   * Get statistics
   */
  getStats(): ValidationEngineStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
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
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get all registered rules
   */
  getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable/disable rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }
}

// Singleton instance
let validationEngineInstance: ValidationEngine | null = null;

/**
 * Initialize validation engine (call once during server startup)
 */
export function initValidationEngine(
  googleClient?: ValidationEngineConfig["googleClient"],
): ValidationEngine {
  if (!validationEngineInstance) {
    validationEngineInstance = new ValidationEngine({
      enabled: process.env["VALIDATION_ENABLED"] !== "false",
      validateBeforeOperations:
        process.env["VALIDATION_BEFORE_OPERATIONS"] !== "false",
      stopOnFirstError:
        process.env["VALIDATION_STOP_ON_FIRST_ERROR"] === "true",
      maxErrors: parseInt(process.env["VALIDATION_MAX_ERRORS"] || "100"),
      asyncTimeout: parseInt(process.env["VALIDATION_ASYNC_TIMEOUT"] || "5000"),
      enableCaching: process.env["VALIDATION_ENABLE_CACHING"] !== "false",
      cacheTtl: parseInt(process.env["VALIDATION_CACHE_TTL"] || "300000"), // 5 minutes - aligned with CACHE_TTL_* constants
      verboseLogging: process.env["VALIDATION_VERBOSE"] === "true",
      googleClient,
    });
  }
  return validationEngineInstance;
}

/**
 * Get validation engine instance
 */
export function getValidationEngine(): ValidationEngine {
  if (!validationEngineInstance) {
    throw new Error(
      "Validation engine not initialized. Call initValidationEngine() first.",
    );
  }
  return validationEngineInstance;
}

/**
 * Reset validation engine (for testing)
 */
export function resetValidationEngine(): void {
  validationEngineInstance = null;
}
