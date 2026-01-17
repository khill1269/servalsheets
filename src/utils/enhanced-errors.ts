/**
 * ServalSheets - Enhanced Error Context
 *
 * Provides enhanced error messages with suggested fixes and context.
 */

import type { ErrorDetail } from '../schemas/shared.js';

export interface ErrorSuggestion {
  title: string;
  steps: string[];
}

/**
 * Enhanced error with suggested fixes
 */
export function enhanceError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): ErrorDetail {
  const suggestions = getErrorSuggestions(code, context);

  return {
    code: code as ErrorDetail['code'],
    message,
    retryable: isRetryable(code),
    details: context,
    resolution: suggestions.title,
    resolutionSteps: suggestions.steps,
  };
}

/**
 * Get suggested fixes for error code
 */
function getErrorSuggestions(code: string, context?: Record<string, unknown>): ErrorSuggestion {
  const range = context?.['range'] as string | undefined;
  const spreadsheetId = context?.['spreadsheetId'] as string | undefined;
  const operation = context?.['operation'] as string | undefined;

  switch (code) {
    case 'RANGE_NOT_FOUND':
      return {
        title: 'Range not found - Check sheet name and cell references',
        steps: [
          '1. Verify sheet name spelling (case-sensitive)',
          `2. List all sheets: sheets_core action="spreadsheet_get" spreadsheetId="${spreadsheetId || '<ID>'}"`,
          '3. Check range format: "SheetName!A1:D10" (include sheet name and !)',
          '4. Try semantic range: {"semantic":{"sheet":"Sales","column":"Revenue"}}',
          range ? `5. Current range: "${range}" - is this correct?` : '',
        ].filter(Boolean),
      };

    case 'PERMISSION_DENIED':
      return {
        title: 'Insufficient permissions - Grant additional access',
        steps: [
          '1. Check current auth: sheets_auth action="status"',
          '2. Re-authenticate: sheets_auth action="login"',
          '3. Grant required permissions in browser',
          '4. If sharing: Check spreadsheet permissions (sheets_sharing action="list_permissions")',
          '5. If still failing: Request owner to share with your account',
        ],
      };

    case 'QUOTA_EXCEEDED':
      return {
        title: 'API quota exceeded - Reduce request rate',
        steps: [
          '1. Wait 60 seconds before retrying',
          '2. Use batch operations: sheets_data action="batch_read" (saves 80% quota)',
          '3. Use transactions: sheets_transaction (batches multiple ops into 1 API call)',
          '4. Check quota: sheets_auth action="status"',
          '5. Avoid polling - use event-driven updates instead',
        ],
      };

    case 'INVALID_RANGE':
      return {
        title: 'Invalid range format - Use correct A1 notation',
        steps: [
          '1. Valid formats: "A1:D10", "Sheet1!A1:D10", "Sheet1!A:A" (column), "Sheet1!1:1" (row)',
          '2. Invalid formats: "A1-D10", "A1..D10", "SheetName A1:D10"',
          '3. Include sheet name before !: "Sales!A1:D10"',
          '4. Alternative: Use semantic ranges: {"semantic":{"column":"Revenue"}}',
          range ? `5. Your range: "${range}" - check for typos` : '',
        ].filter(Boolean),
      };

    case 'NOT_FOUND':
      return {
        title: 'Spreadsheet not found - Verify ID and access',
        steps: [
          '1. Check spreadsheet ID format (44 chars, alphanumeric)',
          `2. Get ID from URL: docs.google.com/spreadsheets/d/{ID}/...`,
          '3. Verify access: sheets_core action="spreadsheet_get" (will fail if no access)',
          '4. List accessible spreadsheets: sheets_core action="spreadsheet_list"',
          '5. If deleted: Check trash or restore from version history',
        ],
      };

    case 'ELICITATION_UNAVAILABLE':
      return {
        title: 'Client does not support MCP Elicitation',
        steps: [
          '1. Update Claude Desktop to latest version (elicitation requires v0.7.0+)',
          '2. Alternative: Use dry-run to preview: {"safety":{"dryRun":true}}',
          '3. Manual confirmation: Ask user to review plan in chat before executing',
          '4. Check capabilities: sheets_auth action="status"',
        ],
      };

    case 'SAMPLING_UNAVAILABLE':
      return {
        title: 'Client does not support MCP Sampling',
        steps: [
          '1. Update Claude Desktop to latest version (sampling requires v0.7.0+)',
          '2. Alternative: Use sheets_analysis (traditional analysis, no AI)',
          '3. For formula generation: Use sheets_analysis to understand data, write formula manually',
          '4. Check capabilities: sheets_auth action="status"',
        ],
      };

    case 'NO_DATA':
      return {
        title: 'No data found in range',
        steps: [
          '1. Verify range has data: sheets_data action="read"',
          '2. Check sheet name is correct',
          '3. Expand range if needed',
          range ? `4. Current range: "${range}"` : '',
          '5. Use sheets_core action="spreadsheet_get" to see all sheet dimensions',
        ].filter(Boolean),
      };

    case 'TRANSACTION_TIMEOUT':
      return {
        title: 'Transaction took too long',
        steps: [
          '1. Reduce operations per transaction (max 50 recommended)',
          '2. Split into multiple smaller transactions',
          '3. Check if operations are complex (avoid heavy formulas)',
          '4. Transaction best practices: sheets_transaction description',
        ],
      };

    case 'PARSE_ERROR':
      return {
        title: 'Failed to parse response',
        steps: [
          '1. Retry operation (may be transient LLM formatting issue)',
          '2. Simplify request (reduce data size, clearer instructions)',
          '3. Check MCP version compatibility',
          operation ? `4. Operation: ${operation}` : '',
        ].filter(Boolean),
      };

    case 'INTERNAL_ERROR':
      return {
        title: 'Internal server error',
        steps: [
          '1. Check server logs for details',
          '2. Verify operation parameters are valid',
          '3. Try simpler operation to isolate issue',
          '4. Check recent changes to codebase',
          '5. Report to developers if persistent',
        ],
      };

    case 'RATE_LIMIT_EXCEEDED':
      return {
        title: 'Too many requests - Circuit breaker active',
        steps: [
          '1. Wait 10 seconds for circuit breaker to reset',
          '2. Reduce request frequency',
          '3. Use batch operations to reduce request count',
          '4. Circuit breaker auto-retries with exponential backoff',
        ],
      };

    default:
      return {
        title: 'Error occurred - See details',
        steps: [
          '1. Check error message for specific details',
          '2. Verify input parameters are correct',
          '3. Try operation in dry-run mode: {"safety":{"dryRun":true}}',
          '4. Check tool description for correct usage',
          `5. Error code: ${code}`,
        ],
      };
  }
}

/**
 * Determine if error is retryable
 */
function isRetryable(code: string): boolean {
  const retryableCodes = [
    'QUOTA_EXCEEDED',
    'RATE_LIMIT_EXCEEDED',
    'PARSE_ERROR',
    'INTERNAL_ERROR',
    'TRANSACTION_TIMEOUT',
  ];
  return retryableCodes.includes(code);
}

/**
 * Create enhanced error response
 */
export function createEnhancedError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): { success: false; error: ErrorDetail } {
  return {
    success: false,
    error: enhanceError(code, message, context),
  };
}
