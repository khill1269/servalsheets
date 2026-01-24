/**
 * ServalSheets - Response Validator
 *
 * Phase 2.2: Validate Google Sheets API Responses
 * Uses Google Discovery API schemas to validate batchUpdate responses,
 * detecting breaking changes and ensuring type safety.
 *
 * Key Benefits:
 * - Catch breaking changes in Google API responses early
 * - Provide detailed validation errors for debugging
 * - Enable runtime type checking of API responses
 * - Support graceful degradation when schemas are unavailable
 *
 * Design Principles:
 * 1. Fail-safe: Validation failures warn but don't crash
 * 2. Performance: Lazy-load schemas only when validation is enabled
 * 3. Developer-friendly: Detailed error messages with paths
 * 4. Production-ready: Disable in production to avoid overhead
 */
import type { sheets_v4 } from 'googleapis';
/**
 * Validation result for a single field
 */
export interface ValidationError {
    /** Path to the field (e.g., "replies[0].addSheet.properties.sheetId") */
    path: string;
    /** Expected type from schema */
    expected: string;
    /** Actual type/value found */
    actual: string;
    /** Validation error message */
    message: string;
    /** Severity: 'error' for breaking changes, 'warning' for deprecations */
    severity: 'error' | 'warning';
}
/**
 * Validation result for an API response
 */
export interface ValidationResult {
    /** Whether the response is valid */
    valid: boolean;
    /** Array of validation errors */
    errors: ValidationError[];
    /** Array of validation warnings */
    warnings: ValidationError[];
    /** Whether schema validation was actually performed */
    validated: boolean;
    /** Reason for skipping validation (if not validated) */
    skipReason?: string;
}
/**
 * Response Validator Configuration
 */
export interface ResponseValidatorConfig {
    /** Enable schema validation (default: from env SCHEMA_VALIDATION_ENABLED) */
    enabled?: boolean;
    /** Fail on validation errors (default: false, just warn) */
    strict?: boolean;
    /** Validate deprecated fields (default: true) */
    checkDeprecations?: boolean;
    /** Maximum depth for recursive validation (default: 10) */
    maxDepth?: number;
}
/**
 * Response Validator
 *
 * Validates Google Sheets API responses against Discovery API schemas.
 * Helps detect breaking changes and ensures type safety at runtime.
 */
export declare class ResponseValidator {
    private discoveryClient;
    private schemasCache;
    private readonly enabled;
    private readonly strict;
    private readonly checkDeprecations;
    private readonly maxDepth;
    constructor(config?: ResponseValidatorConfig);
    /**
     * Check if validation is enabled
     */
    isEnabled(): boolean;
    /**
     * Validate a batchUpdate response
     */
    validateBatchUpdateResponse(response: sheets_v4.Schema$BatchUpdateSpreadsheetResponse): Promise<ValidationResult>;
    /**
     * Validate an arbitrary response against a schema type
     */
    validateResponse(response: unknown, schemaType: string, api?: 'sheets' | 'drive', version?: string): Promise<ValidationResult>;
    /**
     * Get schema from cache or Discovery API
     */
    private getSchema;
    /**
     * Validate an object against a schema definition
     */
    private validateObject;
    /**
     * Validate object type
     */
    private validateObjectType;
    /**
     * Validate array type
     */
    private validateArrayType;
    /**
     * Validate string type
     */
    private validateStringType;
    /**
     * Validate number type
     */
    private validateNumberType;
    /**
     * Validate boolean type
     */
    private validateBooleanType;
    /**
     * Clear schema cache
     */
    clearCache(): void;
}
/**
 * Response Validation Error
 *
 * Thrown when response validation fails in strict mode
 */
export declare class ResponseValidationError extends Error {
    readonly errors: ValidationError[];
    readonly warnings: ValidationError[];
    constructor(message: string, errors: ValidationError[], warnings: ValidationError[]);
}
/**
 * Get or create global response validator
 */
export declare function getResponseValidator(): ResponseValidator;
/**
 * Reset global response validator
 */
export declare function resetResponseValidator(): void;
//# sourceMappingURL=response-validator.d.ts.map