/**
 * Agent-Actionable Error Factory
 *
 * Creates structured, actionable errors that Claude can understand and act upon.
 * Provides clear resolution steps and tool suggestions for common error scenarios.
 */

import { type ErrorDetail } from '../schemas/shared.js';
import { redactObject } from './redact.js';

/**
 * Enriched error with additional debugging context
 */
export interface EnrichedError extends ErrorDetail {
  correlationId?: string;
  requestPath?: string;
  userAction?: string;
  stackTrace?: string;
  errorHistory?: Array<{ timestamp: number; error: ErrorDetail }>;
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
export function createPermissionError(params: {
  operation: string;
  resourceType?: 'spreadsheet' | 'sheet' | 'range' | 'file';
  resourceId?: string;
  currentPermission?: 'view' | 'comment' | 'none';
  requiredPermission?: 'edit' | 'full';
}): ErrorDetail {
  const {
    operation,
    resourceType = 'spreadsheet',
    resourceId,
    currentPermission = 'view',
    requiredPermission = 'edit',
  } = params;

  const resolutionSteps = [
    `1. Check current permission level: Use 'sheets_sharing' tool with action 'list_permissions' to verify access`,
    `2. Request ${requiredPermission} access from the ${resourceType} owner`,
    `3. Alternative: Use read-only operations (sheets_values with action 'read')`,
    `4. If you're the owner: Use 'sheets_sharing' tool with action 'share' to give yourself ${requiredPermission} access`,
  ];

  return {
    code: 'PERMISSION_DENIED',
    message: `Permission denied: Cannot ${operation}. Current access: ${currentPermission}, required: ${requiredPermission}`,
    category: 'auth',
    severity: 'high',
    retryable: false,
    retryStrategy: 'manual',
    resolution: `Request ${requiredPermission} access from the ${resourceType} owner or use read-only operations`,
    resolutionSteps,
    suggestedTools: ['sheets_sharing', 'sheets_values', 'sheets_spreadsheet'],
    details: {
      operation,
      resourceType,
      resourceId,
      currentPermission,
      requiredPermission,
    },
  };
}

/**
 * Create a rate limit error with retry guidance
 */
export function createRateLimitError(params: {
  quotaType?: 'read' | 'write' | 'requests';
  retryAfterMs?: number;
  endpoint?: string;
}): ErrorDetail {
  const { quotaType = 'requests', retryAfterMs = 60000, endpoint } = params;

  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  const resolutionSteps = [
    `1. Wait ${retryAfterSeconds} seconds before retrying`,
    `2. Use batch operations to reduce API call count (sheets_values with action 'batch_read' or 'batch_write')`,
    `3. Enable caching to avoid redundant requests`,
    `4. Consider using exponential backoff for retries`,
    `5. Check quota usage in Google Cloud Console`,
  ];

  return {
    code: 'RATE_LIMITED',
    message: `Rate limit exceeded for ${quotaType} quota. Retry after ${retryAfterSeconds} seconds.`,
    category: 'quota',
    severity: 'medium',
    retryable: true,
    retryAfterMs,
    retryStrategy: 'wait_for_reset',
    resolution: `Wait ${retryAfterSeconds} seconds, then retry. Use batch operations to reduce API calls.`,
    resolutionSteps,
    suggestedTools: ['sheets_values'],
    details: {
      quotaType,
      retryAfterMs,
      endpoint,
      resetTime: new Date(Date.now() + retryAfterMs).toISOString(),
    },
  };
}

/**
 * Create a not found error with search suggestions
 */
export function createNotFoundError(params: {
  resourceType: 'spreadsheet' | 'sheet' | 'range' | 'file' | 'permission';
  resourceId: string;
  searchSuggestion?: string;
  parentResourceId?: string;
}): ErrorDetail {
  const { resourceType, resourceId, searchSuggestion, parentResourceId } = params;

  const resolutionSteps: string[] = [`1. Verify the ${resourceType} ID is correct: ${resourceId}`];

  if (resourceType === 'sheet') {
    resolutionSteps.push(
      `2. List all sheets in the spreadsheet: Use 'sheets_sheet' tool with action 'list'`,
      `3. Check if the sheet name has changed`,
      `4. Verify the sheet hasn't been deleted`
    );
  } else if (resourceType === 'spreadsheet') {
    resolutionSteps.push(
      `2. Verify you have access to the spreadsheet`,
      `3. Check if the spreadsheet was deleted or moved to trash`,
      `4. Confirm the URL is correct: https://docs.google.com/spreadsheets/d/${resourceId}`
    );
  } else if (resourceType === 'range') {
    resolutionSteps.push(
      `2. Verify the A1 notation is valid (e.g., "Sheet1!A1:B10")`,
      `3. Check if the sheet name exists`,
      `4. Ensure the range coordinates are within sheet bounds`
    );
  }

  if (searchSuggestion) {
    resolutionSteps.push(`5. Suggestion: ${searchSuggestion}`);
  }

  const suggestedTools: string[] = [];
  if (resourceType === 'sheet' || resourceType === 'range') {
    suggestedTools.push('sheets_spreadsheet', 'sheets_sheet');
  } else if (resourceType === 'spreadsheet') {
    // Note: There is no file search tool - users need to know their spreadsheet IDs
    suggestedTools.push('sheets_spreadsheet');
  }

  // Map resource type to appropriate error code
  const errorCode =
    resourceType === 'sheet'
      ? 'SHEET_NOT_FOUND'
      : resourceType === 'range'
        ? 'RANGE_NOT_FOUND'
        : 'SPREADSHEET_NOT_FOUND';

  return {
    code: errorCode,
    message: `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} not found: ${resourceId}`,
    category: 'client',
    severity: 'medium',
    retryable: false,
    retryStrategy: 'none',
    resolution: `Verify the ${resourceType} ID is correct and you have access to it`,
    resolutionSteps,
    suggestedTools,
    details: {
      resourceType,
      resourceId,
      searchSuggestion,
      parentResourceId,
    },
  };
}

/**
 * Create an authentication error with setup guidance
 */
export function createAuthenticationError(params: {
  reason: 'missing_token' | 'invalid_token' | 'expired_token' | 'insufficient_scopes';
  missingScopes?: string[];
}): ErrorDetail {
  const { reason, missingScopes } = params;

  let message = 'Authentication failed';
  let resolution = 'Authenticate using the OAuth flow';
  const resolutionSteps: string[] = [];

  switch (reason) {
    case 'missing_token':
      message = 'Authentication failed: No access token provided';
      resolution = 'Run authentication flow to obtain access token';
      resolutionSteps.push(
        '1. Run authentication: npm run auth',
        '2. Follow the OAuth flow in your browser',
        '3. Grant required permissions when prompted',
        '4. Retry the operation after authentication completes'
      );
      break;

    case 'invalid_token':
      message = 'Authentication failed: Invalid access token';
      resolution = 'Re-authenticate to obtain a new valid token';
      resolutionSteps.push(
        '1. Clear existing token storage',
        '2. Run authentication: npm run auth',
        '3. Complete the OAuth flow',
        '4. Retry the operation'
      );
      break;

    case 'expired_token':
      message = 'Authentication failed: Access token expired';
      resolution = 'Refresh the access token or re-authenticate';
      resolutionSteps.push(
        '1. Token refresh should happen automatically',
        '2. If refresh fails, re-authenticate: npm run auth',
        '3. Retry the operation'
      );
      break;

    case 'insufficient_scopes':
      message = `Authentication failed: Insufficient permissions. Missing scopes: ${missingScopes?.join(', ')}`;
      resolution = 'Re-authenticate with additional required scopes';
      resolutionSteps.push(
        '1. Run authentication with force consent: npm run auth',
        '2. Grant all requested permissions (especially Google Sheets scope)',
        '3. Ensure you select all checkboxes in the OAuth consent screen',
        '4. Retry the operation'
      );
      break;
  }

  return {
    code: 'PERMISSION_DENIED',
    message,
    category: 'auth',
    severity: 'critical',
    retryable: reason === 'expired_token',
    retryStrategy: reason === 'expired_token' ? 'exponential_backoff' : 'manual',
    resolution,
    resolutionSteps,
    suggestedTools: [],
    details: {
      reason,
      missingScopes,
    },
  };
}

/**
 * Create a validation error with format guidance
 */
export function createValidationError(params: {
  field: string;
  value: unknown;
  expectedFormat?: string;
  allowedValues?: string[];
  reason?: string;
}): ErrorDetail {
  const { field, value, expectedFormat, allowedValues, reason } = params;

  const resolutionSteps: string[] = [`1. Check the '${field}' parameter value`];

  if (expectedFormat) {
    resolutionSteps.push(`2. Expected format: ${expectedFormat}`);
  }

  if (allowedValues && allowedValues.length > 0) {
    resolutionSteps.push(`3. Allowed values: ${allowedValues.join(', ')}`);
  }

  if (reason) {
    resolutionSteps.push(`4. Reason: ${reason}`);
  }

  resolutionSteps.push(
    `5. Review the tool schema for '${field}' parameter requirements`,
    `6. Correct the value and retry`
  );

  let message = `Invalid value for '${field}'`;
  if (reason) {
    message += `: ${reason}`;
  } else if (expectedFormat) {
    message += `. Expected format: ${expectedFormat}`;
  }

  return {
    code: 'INVALID_REQUEST',
    message,
    category: 'client',
    severity: 'medium',
    retryable: false,
    retryStrategy: 'none',
    resolution: `Correct the '${field}' parameter to match the expected format`,
    resolutionSteps,
    suggestedTools: [],
    details: {
      field,
      value,
      expectedFormat,
      allowedValues,
      reason,
    },
  };
}

/**
 * Parse Google API error and create agent-actionable error
 *
 * Security: Redacts sensitive data (tokens, API keys) from error messages
 */
export function parseGoogleApiError(error: {
  code?: number;
  message?: string;
  status?: string;
  errors?: Array<{ domain?: string; reason?: string; message?: string }>;
}): Partial<ErrorDetail> {
  // Redact sensitive data from the entire error object
  const redactedError = redactObject(error);
  const { code, message = 'Unknown error', errors } = redactedError;

  // Extract domain and reason from Google error
  const firstError = errors?.[0];
  const domain = firstError?.domain;
  const reason = firstError?.reason;

  // Map Google error codes to agent-actionable errors
  switch (code) {
    case 401:
      return createAuthenticationError({ reason: 'invalid_token' });

    case 403:
      if (reason === 'rateLimitExceeded' || reason === 'quotaExceeded') {
        return createRateLimitError({});
      }
      if (reason === 'insufficientPermissions' || domain === 'global') {
        return createPermissionError({ operation: 'access resource' });
      }
      return {
        code: 'PERMISSION_DENIED',
        message,
        category: 'auth',
        severity: 'high',
        retryable: false,
        retryStrategy: 'manual',
      };

    case 404:
      return createNotFoundError({
        resourceType: 'spreadsheet',
        resourceId: 'unknown',
      });

    case 429:
      return createRateLimitError({});

    case 400:
      return createValidationError({
        field: 'request',
        value: message,
        reason: message,
      });

    default:
      return {
        code: 'INTERNAL_ERROR',
        message,
        category: 'server',
        severity: 'high',
        retryable: Boolean(code && code >= 500),
        retryStrategy: code && code >= 500 ? 'exponential_backoff' : 'none',
      };
  }
}

/**
 * Enrich an error with additional debugging context
 *
 * Adds correlation IDs, stack traces, request paths, and error history
 * to aid in debugging and error pattern detection.
 */
export function enrichErrorWithContext(
  error: Error | ErrorDetail,
  context: {
    correlationId?: string;
    requestPath?: string;
    userAction?: string;
    previousErrors?: ErrorDetail[];
  }
): EnrichedError {
  const { correlationId, requestPath, userAction, previousErrors = [] } = context;

  // Convert Error to ErrorDetail if needed
  let baseError: ErrorDetail;
  if (error instanceof Error) {
    baseError = {
      code: 'INTERNAL_ERROR',
      message: error.message,
      category: 'server',
      severity: 'high',
      retryable: false,
    };
  } else {
    baseError = error;
  }

  // Capture stack trace
  const stackTrace = error instanceof Error ? error.stack : new Error('Stack trace capture').stack;

  // Build error history (last 10 errors)
  const errorHistory = previousErrors.slice(-10).map((err) => ({
    timestamp: Date.now(),
    error: err,
  }));

  // Detect error pattern if we have history
  const detectedPattern = previousErrors.length > 0 ? detectErrorPattern(previousErrors) : null;
  const suggestedPattern = detectedPattern ?? undefined;

  return {
    ...baseError,
    correlationId,
    requestPath,
    userAction,
    stackTrace,
    errorHistory,
    suggestedPattern,
    enrichedAt: Date.now(),
  };
}

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
export function detectErrorPattern(errors: ErrorDetail[]): ErrorPattern | null {
  if (errors.length === 0) {
    return null;
  }

  // Count error categories
  const categoryCounts = new Map<string, number>();
  const operationSet = new Set<string>();
  let firstSeen = Date.now();
  let lastSeen = 0;

  for (const error of errors) {
    const category = error.category || 'unknown';
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);

    // Track operations from error details
    if (error.details?.['operation']) {
      const operation = error.details['operation'];
      if (typeof operation === 'string') {
        operationSet.add(operation);
      }
    }

    // Update timestamps (errors are assumed to have timestamp in details)
    const timestamp = (error.details?.['timestamp'] as number) || Date.now();
    if (timestamp < firstSeen) firstSeen = timestamp;
    if (timestamp > lastSeen) lastSeen = timestamp;
  }

  // Detect patterns based on error frequency and category
  const quotaErrors = categoryCounts.get('quota') || 0;
  const networkErrors = categoryCounts.get('network') || 0;

  // Count specific error types by code (more specific than category)
  const permissionErrors = errors.filter(
    (e) => e.code === 'PERMISSION_DENIED' || e.code === 'FORBIDDEN'
  ).length;

  const authTokenErrors = errors.filter(
    (e) =>
      e.category === 'auth' &&
      e.code !== 'PERMISSION_DENIED' &&
      e.code !== 'FORBIDDEN' &&
      (e.message?.includes('token') || e.message?.includes('auth'))
  ).length;

  // Rate limit pattern: Multiple quota errors in short time
  if (quotaErrors >= 3) {
    return {
      pattern: 'rate_limit',
      frequency: quotaErrors,
      suggestedAction:
        'Implement exponential backoff and reduce request frequency. Consider batch operations.',
      affectedOperations: Array.from(operationSet),
      firstSeen,
      lastSeen,
    };
  }

  // Permission pattern: Check for permission-related error codes (before auth expiry)
  if (permissionErrors >= 2) {
    return {
      pattern: 'permission',
      frequency: permissionErrors,
      suggestedAction:
        'Verify user has required permissions. Use sheets_sharing tool to check access levels.',
      affectedOperations: Array.from(operationSet),
      firstSeen,
      lastSeen,
    };
  }

  // Auth expiry pattern: Multiple auth token errors (excluding permission errors)
  if (authTokenErrors >= 2) {
    return {
      pattern: 'auth_expiry',
      frequency: authTokenErrors,
      suggestedAction:
        'Check token refresh logic. Ensure OAuth tokens are being refreshed before expiry.',
      affectedOperations: Array.from(operationSet),
      firstSeen,
      lastSeen,
    };
  }

  // Network pattern: Multiple network errors
  if (networkErrors >= 3) {
    return {
      pattern: 'network',
      frequency: networkErrors,
      suggestedAction: 'Check network connectivity. Consider implementing circuit breaker pattern.',
      affectedOperations: Array.from(operationSet),
      firstSeen,
      lastSeen,
    };
  }

  // No clear pattern detected
  return null;
}
