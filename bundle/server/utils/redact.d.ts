/**
 * ServalSheets - Sensitive Data Redaction
 *
 * Centralized utility for redacting sensitive information from logs, errors,
 * and API responses. Prevents tokens, credentials, and API keys from leaking
 * into error messages or logs.
 *
 * Security: Part of Phase 4 - Auth & API Hardening
 */
/**
 * Field names that contain sensitive data (all lowercase for case-insensitive matching)
 * Used for object key-based redaction
 */
export declare const SENSITIVE_FIELD_NAMES: Set<string>;
/**
 * Patterns for detecting and redacting sensitive strings
 * IMPORTANT: Order matters! Specific patterns should come before generic ones.
 */
export declare const SENSITIVE_STRING_PATTERNS: {
    pattern: RegExp;
    replacement: string;
    description: string;
}[];
/**
 * Redact sensitive information from a string
 *
 * @param text - String that may contain sensitive data
 * @returns String with sensitive data replaced with [REDACTED]
 */
export declare function redactString(text: string): string;
/**
 * Redact sensitive fields from an object (deep)
 * Handles circular references and maintains type safety
 *
 * @param obj - Object to redact
 * @param seen - WeakSet for tracking visited objects (circular reference detection)
 * @param depth - Current recursion depth (prevent stack overflow)
 * @returns Redacted copy of the object
 */
export declare function redactObject<T>(obj: T, seen?: WeakSet<object>, depth?: number): T;
/**
 * Check if a field name is sensitive (case-insensitive)
 *
 * @param fieldName - Field name to check
 * @returns True if field should be redacted
 */
export declare function isSensitiveField(fieldName: string): boolean;
/**
 * Redact sensitive data from any value (auto-detect type)
 *
 * @param value - Value to redact (string, object, array, etc.)
 * @returns Redacted value
 */
export declare function redact<T>(value: T): T;
/**
 * Redact multiple values at once
 * Useful for function arguments or API responses
 *
 * @param values - Values to redact
 * @returns Array of redacted values
 */
export declare function redactAll<T extends unknown[]>(...values: T): T;
//# sourceMappingURL=redact.d.ts.map