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
export const ERROR_MESSAGES = {
  // ========================
  // Service Initialization
  // ========================

  SERVICE_NOT_INITIALIZED: (serviceName: string, method: string): ErrorMessageTemplate => ({
    message: `${serviceName} not initialized`,
    resolution: `Call initialize() before using ${method}()`,
    resolutionSteps: [
      `1. Ensure ${serviceName}.initialize() is called during server startup`,
      `2. Check that initialization completed successfully`,
      `3. Verify credentials are properly configured`,
      `4. Restart the server if configuration was recently changed`,
    ],
  }),

  // ========================
  // Sheet Operations
  // ========================

  SHEET_NOT_FOUND: (sheetName: string, spreadsheetId: string): ErrorMessageTemplate => ({
    message: `Sheet "${sheetName}" not found`,
    resolution: 'Verify the sheet name and try again',
    resolutionSteps: [
      `1. List available sheets using sheets_core action "spreadsheet_get"`,
      `2. Check for typos in sheet name (sheet names are case-sensitive)`,
      `3. Verify the spreadsheet ID is correct: ${spreadsheetId}`,
      `4. Ensure you have permission to access this spreadsheet`,
      `5. Check if the sheet was recently renamed or deleted`,
    ],
    details: {
      sheetName,
      spreadsheetId,
      caseSensitive: true,
    },
  }),

  RANGE_RESOLUTION_FAILED: (rangeInput: string): ErrorMessageTemplate => ({
    message: `Could not resolve range: ${rangeInput}`,
    resolution: 'Provide a valid A1 notation range or named range',
    resolutionSteps: [
      `1. Check range format (e.g., "Sheet1!A1:B10", "A1:B10", or named range)`,
      `2. Verify sheet name is correct if specified`,
      `3. Ensure range bounds are valid (e.g., A1 comes before Z100)`,
      `4. Check if using named range that exists in the spreadsheet`,
    ],
    details: {
      providedRange: rangeInput,
      validExamples: ['Sheet1!A1:B10', 'A1', 'MyNamedRange'],
    },
  }),

  // ========================
  // Configuration
  // ========================

  CONFIG_ERROR: (key: string, format: string, received?: string): ErrorMessageTemplate => ({
    message: `Invalid configuration for ${key}`,
    resolution: `Fix the ${key} configuration and restart`,
    resolutionSteps: [
      `1. Check environment variable or config file for ${key}`,
      `2. Expected format: ${format}`,
      received ? `3. Current value: ${received}` : '3. Ensure value is set',
      `4. Validate the value matches the expected format`,
      `5. Restart the server after fixing configuration`,
    ],
    details: {
      configKey: key,
      expectedFormat: format,
      receivedValue: received,
    },
  }),

  TOKEN_STORE_KEY_INVALID: (received: string): ErrorMessageTemplate => ({
    message: 'TOKEN_STORE_KEY must be a 64-character hex string (32 bytes)',
    resolution: 'Generate a valid encryption key',
    resolutionSteps: [
      '1. Generate key: openssl rand -hex 32',
      `2. Current value length: ${received} characters (expected: 64)`,
      '3. Set TOKEN_STORE_KEY in environment or .env file',
      '4. Ensure the key contains only hexadecimal characters (0-9, a-f)',
      '5. Restart server after setting the key',
    ],
    details: {
      receivedLength: received,
      expectedLength: 64,
      expectedFormat: 'hex',
    },
  }),

  // ========================
  // Snapshots / Versions
  // ========================

  SNAPSHOT_NOT_FOUND: (snapshotId: string): ErrorMessageTemplate => ({
    message: `Snapshot ${snapshotId} not found`,
    resolution: 'List available snapshots and use a valid snapshot ID',
    resolutionSteps: [
      `1. Use sheets_collaborate action "version_list_snapshots" to see available snapshots`,
      `2. Verify the snapshot ID: ${snapshotId}`,
      `3. Check if snapshot was deleted or expired`,
      `4. Ensure you have access to the snapshot`,
      `5. Snapshots may have been cleaned up if older than retention period`,
    ],
    details: {
      snapshotId,
    },
  }),

  SNAPSHOT_CREATION_FAILED: (spreadsheetId: string, reason?: string): ErrorMessageTemplate => ({
    message: `Failed to create snapshot for spreadsheet ${spreadsheetId}`,
    resolution: 'Check Drive API access and permissions',
    resolutionSteps: [
      `1. Verify Drive API is enabled and initialized`,
      `2. Ensure drive.file scope is included in OAuth scopes`,
      `3. Check that you have permission to copy files in Google Drive`,
      `4. Verify spreadsheet ${spreadsheetId} exists and is accessible`,
      reason ? `5. Specific error: ${reason}` : '5. Check server logs for detailed error',
    ],
    details: {
      spreadsheetId,
      reason,
      requiredScope: 'https://www.googleapis.com/auth/drive.file',
    },
  }),

  // ========================
  // Authentication
  // ========================

  AUTH_TOKEN_EXPIRED: (): ErrorMessageTemplate => ({
    message: 'Access token has expired',
    resolution: 'Use refresh token to obtain a new access token',
    resolutionSteps: [
      '1. Call /oauth/token with grant_type=refresh_token',
      '2. Include your refresh_token in the request',
      '3. Obtain new access_token from response',
      '4. Retry the original request with new access token',
      '5. If refresh fails, re-authenticate from the beginning',
    ],
  }),

  AUTH_INVALID_CREDENTIALS: (): ErrorMessageTemplate => ({
    message: 'Invalid OAuth credentials',
    resolution: 'Verify client credentials and OAuth configuration',
    resolutionSteps: [
      '1. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables',
      '2. Ensure credentials match those in Google Cloud Console',
      '3. Verify OAuth consent screen is properly configured',
      '4. Check that redirect URIs are correctly registered',
      '5. Re-download credentials.json if unsure',
    ],
  }),

  // ========================
  // Google API Errors
  // ========================

  GOOGLE_API_QUOTA_EXCEEDED: (quotaType: string): ErrorMessageTemplate => ({
    message: `Google API quota exceeded: ${quotaType}`,
    resolution: 'Wait for quota to reset or request quota increase',
    resolutionSteps: [
      '1. Check Google Cloud Console for current quota usage',
      '2. Wait for quota reset (typically resets every 60 seconds)',
      '3. Consider batching operations to reduce API calls',
      '4. Request quota increase in Google Cloud Console if needed',
      '5. Implement exponential backoff retry strategy',
    ],
    details: {
      quotaType,
      documentationUrl: 'https://developers.google.com/sheets/api/limits',
    },
  }),

  GOOGLE_API_PERMISSION_DENIED: (spreadsheetId: string): ErrorMessageTemplate => ({
    message: `Permission denied for spreadsheet ${spreadsheetId}`,
    resolution: 'Grant access to the spreadsheet',
    resolutionSteps: [
      `1. Open the spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      `2. Click "Share" button`,
      `3. Add the service account email or OAuth user email`,
      `4. Grant "Editor" permission (or "Viewer" for read-only)`,
      `5. Retry the operation`,
    ],
    details: {
      spreadsheetId,
      requiredPermission: 'Editor',
    },
  }),

  // ========================
  // Data Errors
  // ========================

  DATA_PARSE_ERROR: (field: string, expectedType: string): ErrorMessageTemplate => ({
    message: `Failed to parse ${field}: expected ${expectedType}`,
    resolution: `Provide ${field} in the correct format`,
    resolutionSteps: [
      `1. Check the data type of ${field}`,
      `2. Expected type: ${expectedType}`,
      `3. Ensure data is properly formatted`,
      `4. Check for special characters or encoding issues`,
      `5. Validate against schema before sending`,
    ],
    details: {
      field,
      expectedType,
    },
  }),

  VERSION_MISMATCH: (
    receivedVersion: number,
    supportedVersions: number[]
  ): ErrorMessageTemplate => ({
    message: `Unsupported data version: ${receivedVersion}`,
    resolution: 'Update to a compatible version or migrate data',
    resolutionSteps: [
      `1. Current data version: ${receivedVersion}`,
      `2. Supported versions: ${supportedVersions.join(', ')}`,
      `3. Check if data migration is needed`,
      `4. Backup data before attempting migration`,
      `5. Contact support if migration tools are needed`,
    ],
    details: {
      receivedVersion,
      supportedVersions,
    },
  }),

  // ========================
  // Task Operations
  // ========================

  TASK_NOT_FOUND: (taskId: string): ErrorMessageTemplate => ({
    message: `Task ${taskId} not found`,
    resolution: 'Verify task ID or check if task expired',
    resolutionSteps: [
      `1. Verify task ID is correct: ${taskId}`,
      `2. Check if task expired (default TTL: 1 hour)`,
      `3. Use tasks/list to see active tasks`,
      `4. Task may have been cancelled or deleted`,
      `5. Create a new task if the original is no longer available`,
    ],
    details: {
      taskId,
      defaultTtl: 3600000, // 1 hour in ms
    },
  }),

  TASK_ALREADY_TERMINAL: (taskId: string, status: string): ErrorMessageTemplate => ({
    message: `Task ${taskId} is in terminal status: ${status}`,
    resolution: 'Cannot modify task in terminal status',
    resolutionSteps: [
      `1. Task is in terminal status: ${status}`,
      `2. Terminal statuses: completed, failed, cancelled`,
      `3. Use tasks/result to get final result`,
      `4. Create a new task if you need to retry the operation`,
    ],
    details: {
      taskId,
      currentStatus: status,
      terminalStatuses: ['completed', 'failed', 'cancelled'],
    },
  }),

  // ========================
  // Production Requirements
  // ========================

  REDIS_REQUIRED_IN_PRODUCTION: (): ErrorMessageTemplate => ({
    message: 'Redis session store required in production',
    resolution: 'Set REDIS_URL environment variable',
    resolutionSteps: [
      '1. Install Redis: https://redis.io/docs/getting-started/',
      '2. Set REDIS_URL environment variable (e.g., redis://localhost:6379)',
      '3. For production, use managed Redis (AWS ElastiCache, Redis Cloud, etc.)',
      '4. In-memory session store does not persist across restarts',
      '5. Multiple server instances require shared Redis',
    ],
    details: {
      reason:
        'In-memory session store does not support multiple instances or persist across restarts',
      alternatives: ['AWS ElastiCache', 'Redis Cloud', 'Azure Cache for Redis'],
    },
  }),

  HTTPS_REQUIRED_IN_PRODUCTION: (): ErrorMessageTemplate => ({
    message: 'HTTPS is required for all requests in production mode',
    resolution: 'Use https:// instead of http:// in your request URL',
    resolutionSteps: [
      '1. Update request URL to use https:// protocol',
      '2. Ensure server is behind HTTPS reverse proxy (nginx, Load Balancer)',
      '3. Configure SSL/TLS certificates',
      '4. Set X-Forwarded-Proto header if behind proxy',
      '5. OAuth tokens must be transmitted over encrypted connections',
    ],
    details: {
      reason:
        'Security: OAuth tokens and sensitive data must be transmitted over encrypted connections',
      requiredProtocol: 'https',
    },
  }),
} as const;

/**
 * Helper function to get formatted error message
 */
export function getErrorMessage(template: ErrorMessageTemplate): {
  message: string;
  resolution: string;
  resolutionSteps: string[];
  details?: Record<string, unknown>;
} {
  return {
    message: template.message,
    resolution: template.resolution,
    resolutionSteps: template.resolutionSteps,
    details: template.details,
  };
}

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
