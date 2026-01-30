/**
 * ServalSheets - Structured Error Classes
 *
 * Base error classes for consistent error handling across the codebase.
 * All errors implement toErrorDetail() for conversion to ErrorDetail schema.
 *
 * Security: All error messages and details are automatically redacted to
 * prevent sensitive data (tokens, API keys) from leaking into logs.
 */
import type { ErrorDetail } from '../schemas/shared.js';
type ErrorCode = ErrorDetail['code'];
/**
 * Base class for all ServalSheets errors
 *
 * Security: Automatically redacts sensitive data from message and details
 */
export declare abstract class ServalSheetsError extends Error {
    abstract code: ErrorCode;
    abstract retryable: boolean;
    details?: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>);
    abstract toErrorDetail(): ErrorDetail;
}
/**
 * ServiceError - For service initialization and operation failures
 * Use when: Service not initialized, API clients unavailable, external service errors
 */
export declare class ServiceError extends ServalSheetsError {
    code: ErrorCode;
    retryable: boolean;
    serviceName: string;
    constructor(message: string, code: ErrorCode, serviceName: string, retryable?: boolean, details?: Record<string, unknown>);
    toErrorDetail(): ErrorDetail;
}
/**
 * ConfigError - For configuration and validation failures
 * Use when: Invalid environment variables, missing config, validation failures
 */
export declare class ConfigError extends ServalSheetsError {
    code: ErrorCode;
    retryable: boolean;
    configKey: string;
    constructor(message: string, configKey: string, details?: Record<string, unknown>);
    toErrorDetail(): ErrorDetail;
}
/**
 * ValidationError - For input validation failures
 * Use when: Invalid user input, malformed data, type mismatches
 */
export declare class ValidationError extends ServalSheetsError {
    code: ErrorCode;
    retryable: boolean;
    field: string;
    expectedFormat?: string;
    constructor(message: string, field: string, expectedFormat?: string, details?: Record<string, unknown>);
    toErrorDetail(): ErrorDetail;
}
/**
 * NotFoundError - For resource not found scenarios
 * Use when: Spreadsheet not found, snapshot not found, resource lookup failures
 */
export declare class NotFoundError extends ServalSheetsError {
    code: ErrorCode;
    retryable: boolean;
    resourceType: string;
    resourceId: string;
    constructor(resourceType: string, resourceId: string, details?: Record<string, unknown>);
    toErrorDetail(): ErrorDetail;
}
/**
 * AuthenticationError - For OAuth and token issues
 * Use when: Token expired, invalid credentials, auth flow failures
 */
export declare class AuthenticationError extends ServalSheetsError {
    code: ErrorCode;
    retryable: boolean;
    constructor(message: string, code?: ErrorCode, retryable?: boolean, details?: Record<string, unknown>);
    toErrorDetail(): ErrorDetail;
}
/**
 * DataError - For data parsing and integrity issues
 * Use when: JSON parse failures, data corruption, version mismatches
 */
export declare class DataError extends ServalSheetsError {
    code: ErrorCode;
    retryable: boolean;
    constructor(message: string, code?: ErrorCode, retryable?: boolean, details?: Record<string, unknown>);
    toErrorDetail(): ErrorDetail;
}
/**
 * HandlerLoadError - For handler factory and dynamic loading failures
 * Use when: Unknown handler, method not found, lazy loading failures
 */
export declare class HandlerLoadError extends ServalSheetsError {
    code: ErrorCode;
    retryable: boolean;
    handlerName: string;
    constructor(message: string, handlerName: string, details?: Record<string, unknown>);
    toErrorDetail(): ErrorDetail;
}
export {};
//# sourceMappingURL=errors.d.ts.map