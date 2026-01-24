/**
 * Agent-Actionable Error Factory
 *
 * Creates structured, actionable errors that Claude can understand and act upon.
 * Provides clear resolution steps and tool suggestions for common error scenarios.
 */
import { type ErrorDetail } from '../schemas/shared.js';
/**
 * Enriched error with additional debugging context
 */
export interface EnrichedError extends ErrorDetail {
    correlationId?: string;
    requestPath?: string;
    userAction?: string;
    stackTrace?: string;
    errorHistory?: Array<{
        timestamp: number;
        error: ErrorDetail;
    }>;
    suggestedPattern?: ErrorPattern;
    enrichedAt: number;
}
/**
 * Detected error pattern
 */
export interface ErrorPattern {
    pattern: 'rate_limit' | 'auth_expiry' | 'network' | 'quota' | 'permission';
    frequency: number;
    suggestedAction: string;
    affectedOperations: string[];
    firstSeen: number;
    lastSeen: number;
}
/**
 * Create a permission denied error with actionable resolution
 */
export declare function createPermissionError(params: {
    operation: string;
    resourceType?: 'spreadsheet' | 'sheet' | 'range' | 'file';
    resourceId?: string;
    currentPermission?: 'view' | 'comment' | 'none';
    requiredPermission?: 'edit' | 'full';
}): ErrorDetail;
/**
 * Create a rate limit error with retry guidance
 */
export declare function createRateLimitError(params: {
    quotaType?: 'read' | 'write' | 'requests';
    retryAfterMs?: number;
    endpoint?: string;
}): ErrorDetail;
/**
 * Create a not found error with search suggestions
 */
export declare function createNotFoundError(params: {
    resourceType: 'spreadsheet' | 'sheet' | 'range' | 'file' | 'permission' | 'operation' | 'snapshot';
    resourceId: string;
    searchSuggestion?: string;
    parentResourceId?: string;
}): ErrorDetail;
/**
 * Create an authentication error with setup guidance
 */
export declare function createAuthenticationError(params: {
    reason: 'missing_token' | 'invalid_token' | 'expired_token' | 'insufficient_scopes';
    missingScopes?: string[];
}): ErrorDetail;
/**
 * Create a validation error with format guidance
 */
export declare function createValidationError(params: {
    field: string;
    value: unknown;
    expectedFormat?: string;
    allowedValues?: string[];
    reason?: string;
}): ErrorDetail;
/**
 * Parse Google API error and create agent-actionable error
 *
 * Security: Redacts sensitive data (tokens, API keys) from error messages
 */
export declare function parseGoogleApiError(error: {
    code?: number;
    message?: string;
    status?: string;
    errors?: Array<{
        domain?: string;
        reason?: string;
        message?: string;
    }>;
}): Partial<ErrorDetail>;
/**
 * Enrich an error with additional debugging context
 *
 * Adds correlation IDs, stack traces, request paths, and error history
 * to aid in debugging and error pattern detection.
 */
export declare function enrichErrorWithContext(error: Error | ErrorDetail, context: {
    correlationId?: string;
    requestPath?: string;
    userAction?: string;
    previousErrors?: ErrorDetail[];
}): EnrichedError;
/**
 * Detect error patterns from historical errors
 *
 * Analyzes a sequence of errors to identify common patterns like:
 * - Rate limiting
 * - Authentication expiry
 * - Network issues
 * - Quota exhaustion
 * - Permission problems
 */
export declare function detectErrorPattern(errors: ErrorDetail[]): ErrorPattern | null;
//# sourceMappingURL=error-factory.d.ts.map