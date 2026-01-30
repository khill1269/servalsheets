/**
 * ServalSheets - Error Message Templates
 *
 * Centralized error messages for consistency across the codebase.
 * Provides structured error details with context and resolution steps.
 *
 * MCP Protocol: 2025-11-25
 */
export interface ErrorMessageTemplate {
    message: string;
    resolution: string;
    resolutionSteps: string[];
    details?: Record<string, unknown>;
}
/**
 * Error message templates for common scenarios
 */
export declare const ERROR_MESSAGES: {
    readonly SERVICE_NOT_INITIALIZED: (serviceName: string, method: string) => ErrorMessageTemplate;
    readonly SHEET_NOT_FOUND: (sheetName: string, spreadsheetId: string) => ErrorMessageTemplate;
    readonly RANGE_RESOLUTION_FAILED: (rangeInput: string) => ErrorMessageTemplate;
    readonly CONFIG_ERROR: (key: string, format: string, received?: string) => ErrorMessageTemplate;
    readonly TOKEN_STORE_KEY_INVALID: (received: string) => ErrorMessageTemplate;
    readonly SNAPSHOT_NOT_FOUND: (snapshotId: string) => ErrorMessageTemplate;
    readonly SNAPSHOT_CREATION_FAILED: (spreadsheetId: string, reason?: string) => ErrorMessageTemplate;
    readonly AUTH_TOKEN_EXPIRED: () => ErrorMessageTemplate;
    readonly AUTH_INVALID_CREDENTIALS: () => ErrorMessageTemplate;
    readonly GOOGLE_API_QUOTA_EXCEEDED: (quotaType: string) => ErrorMessageTemplate;
    readonly GOOGLE_API_PERMISSION_DENIED: (spreadsheetId: string) => ErrorMessageTemplate;
    readonly DATA_PARSE_ERROR: (field: string, expectedType: string) => ErrorMessageTemplate;
    readonly VERSION_MISMATCH: (receivedVersion: number, supportedVersions: number[]) => ErrorMessageTemplate;
    readonly TASK_NOT_FOUND: (taskId: string) => ErrorMessageTemplate;
    readonly TASK_ALREADY_TERMINAL: (taskId: string, status: string) => ErrorMessageTemplate;
    readonly REDIS_REQUIRED_IN_PRODUCTION: () => ErrorMessageTemplate;
    readonly HTTPS_REQUIRED_IN_PRODUCTION: () => ErrorMessageTemplate;
};
/**
 * Helper function to get formatted error message
 */
export declare function getErrorMessage(template: ErrorMessageTemplate): {
    message: string;
    resolution: string;
    resolutionSteps: string[];
    details?: Record<string, unknown>;
};
/**
 * Usage example:
 *
 * ```typescript
 * import { ERROR_MESSAGES } from './utils/error-messages.js';
 *
 * throw new ServiceError(
 *   ERROR_MESSAGES.SERVICE_NOT_INITIALIZED('GoogleAPI', 'sheets').message,
 *   'SERVICE_NOT_INITIALIZED',
 *   'GoogleAPI',
 *   false,
 *   ERROR_MESSAGES.SERVICE_NOT_INITIALIZED('GoogleAPI', 'sheets')
 * );
 * ```
 */
//# sourceMappingURL=error-messages.d.ts.map