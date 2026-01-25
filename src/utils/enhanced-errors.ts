/**
 * ServalSheets - Enhanced Error Context
 *
 * Provides enhanced error messages with suggested fixes and context.
 */

import type { ErrorDetail } from '../schemas/shared.js';

export interface ErrorSuggestion {
  title: string;
  steps: string[];
  suggestedTools?: string[];
}

/**
 * Enhanced error with suggested fixes and resource links (Quick Win #2)
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
    suggestedTools: suggestions.suggestedTools,
    fixableVia: getFixableVia(code, context),
    resources: getErrorResources(code),
  };
}

/**
 * Get suggested fixes for error code
 */
function getErrorSuggestions(code: string, context?: Record<string, unknown>): ErrorSuggestion {
  const range = context?.['range'] as string | undefined;
  const spreadsheetId = context?.['spreadsheetId'] as string | undefined;
  const sheetName = context?.['sheetName'] as string | undefined;
  const sheetId = context?.['sheetId'] as number | string | undefined;
  const operation = context?.['operation'] as string | undefined;
  const matches = context?.['matches'] as string[] | undefined;
  const suggestedFix = context?.['suggestedFix'] as string | undefined;

  switch (code) {
    case 'RANGE_NOT_FOUND':
      return {
        title: 'Range not found - Check sheet name and cell references',
        steps: [
          '1. Verify sheet name spelling (case-sensitive)',
          `2. List all sheets: sheets_core action="get" spreadsheetId="${spreadsheetId || '<ID>'}"`,
          '3. Check range format: "SheetName!A1:D10" (include sheet name and !)',
          '4. Try semantic range: {"semantic":{"sheet":"Sales","column":"Revenue"}}',
          range ? `5. Current range: "${range}" - is this correct?` : '',
        ].filter(Boolean),
        suggestedTools: ['sheets_core', 'sheets_data'],
      };

    case 'SHEET_NOT_FOUND':
      return {
        title: 'Sheet not found - Verify sheet name or ID',
        steps: [
          `1. List sheets: sheets_core action="list_sheets" spreadsheetId="${spreadsheetId || '<ID>'}"`,
          sheetName
            ? `2. Sheet name requested: "${sheetName}" (case-sensitive)`
            : '2. Verify sheet name is exact (case-sensitive)',
          sheetId !== undefined
            ? `3. Sheet ID requested: ${sheetId}`
            : '3. Verify sheetId is correct (numeric gid)',
          '4. Confirm the sheet was not deleted or renamed',
        ].filter(Boolean),
        suggestedTools: ['sheets_core'],
      };

    case 'SPREADSHEET_NOT_FOUND':
      return {
        title: 'Spreadsheet not found - Verify ID and access',
        steps: [
          `1. Check spreadsheet ID format (alphanumeric, 44 chars typical)`,
          `2. Open URL: https://docs.google.com/spreadsheets/d/${spreadsheetId || '<ID>'}`,
          '3. Confirm you have access or request sharing from the owner',
          '4. Check if the spreadsheet was deleted or moved to trash',
        ],
        suggestedTools: ['sheets_core', 'sheets_collaborate'],
      };

    case 'AUTH_REQUIRED':
      return {
        title: 'Authentication required - Complete OAuth first',
        steps: [
          '1. Check auth status: sheets_auth action="status"',
          '2. Start login flow: sheets_auth action="login"',
          '3. Complete OAuth consent in the browser',
          '4. Retry the original operation',
        ],
        suggestedTools: ['sheets_auth'],
      };

    case 'PERMISSION_DENIED':
      return {
        title: 'Insufficient permissions - Grant additional access',
        steps: [
          '1. Check current auth: sheets_auth action="status"',
          '2. Re-authenticate: sheets_auth action="login"',
          '3. Grant required permissions in browser',
          '4. If sharing: Check spreadsheet permissions (sheets_collaborate action="share_list")',
          '5. If still failing: Request owner to share with your account',
        ],
        suggestedTools: ['sheets_auth', 'sheets_collaborate'],
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
        suggestedTools: ['sheets_data', 'sheets_transaction', 'sheets_auth'],
      };

    case 'AMBIGUOUS_RANGE':
      return {
        title: 'Ambiguous range - Choose a single match',
        steps: [
          '1. Specify a single column or exact A1 range',
          matches ? `2. Matching columns: ${matches.join(', ')}` : '',
          suggestedFix ? `3. ${suggestedFix}` : '',
        ].filter(Boolean),
        suggestedTools: ['sheets_analyze', 'sheets_data'],
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
        suggestedTools: ['sheets_data', 'sheets_core'],
      };

    case 'NOT_FOUND':
      return {
        title: 'Spreadsheet not found - Verify ID and access',
        steps: [
          '1. Check spreadsheet ID format (44 chars, alphanumeric)',
          `2. Get ID from URL: docs.google.com/spreadsheets/d/{ID}/...`,
          '3. Verify access: sheets_core action="get" (will fail if no access)',
          '4. List accessible spreadsheets: sheets_core action="list"',
          '5. If deleted: Check trash or restore from version history',
        ],
        suggestedTools: ['sheets_core', 'sheets_collaborate'],
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
        suggestedTools: ['sheets_auth', 'sheets_quality'],
      };

    case 'SAMPLING_UNAVAILABLE':
      return {
        title: 'Client does not support MCP Sampling',
        steps: [
          '1. Update Claude Desktop to latest version (sampling requires v0.7.0+)',
          '2. Alternative: Use sheets_quality for deterministic checks',
          '3. For formula work: Use sheets_analyze with useAI=false or write formulas manually',
          '4. Check capabilities: sheets_auth action="status"',
        ],
        suggestedTools: ['sheets_auth', 'sheets_quality', 'sheets_analyze'],
      };

    case 'NO_DATA':
      return {
        title: 'No data found in range',
        steps: [
          '1. Verify range has data: sheets_data action="read"',
          '2. Check sheet name is correct',
          '3. Expand range if needed',
          range ? `4. Current range: "${range}"` : '',
          '5. Use sheets_core action="get" to see all sheet dimensions',
        ].filter(Boolean),
        suggestedTools: ['sheets_data', 'sheets_core', 'sheets_analyze'],
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
        suggestedTools: ['sheets_transaction'],
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
        suggestedTools: ['sheets_auth'],
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
        suggestedTools: ['sheets_auth'],
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
        suggestedTools: ['sheets_data', 'sheets_transaction'],
      };

    case 'INVALID_ARGUMENT':
      return {
        title: 'Invalid argument to Google API',
        steps: [
          '1. Check error message for specific field that failed',
          '2. Common issues:',
          '   - BAR charts: series must target BOTTOM_AXIS (use COLUMN for vertical bars)',
          '   - Range without sheet name: Use "Sheet1!A1:D10" not "A1:D10"',
          '   - Invalid sheetId: Get from sheets_core action="list_sheets"',
          '3. Verify IDs match existing objects (sheets, charts, named ranges)',
          '4. Check schema description for field constraints',
        ],
        suggestedTools: ['sheets_core', 'sheets_visualize'],
      };

    case 'VALIDATION_FAILED':
      return {
        title: 'Input validation failed',
        steps: [
          '1. Check the "action" parameter is valid for this tool',
          '2. Ensure all required parameters are provided',
          '3. Verify "spreadsheetId" is a valid 44-character string',
          '4. Range format: "SheetName!A1:D10" (include sheet name with !)',
          '5. Use sheets_auth action="status" to verify connection',
        ],
        suggestedTools: ['sheets_auth'],
      };

    case 'ACTION_REQUIRED':
      return {
        title: 'Missing required "action" parameter',
        steps: [
          '1. Every tool call MUST include an "action" parameter',
          '2. Example: {"action":"read", "spreadsheetId":"...", "range":"..."}',
          '3. Check tool description for valid action names',
          '4. Common actions: read, write, get, create, list_sheets',
        ],
        suggestedTools: ['sheets_auth'],
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
        suggestedTools: ['sheets_auth', 'sheets_analyze'],
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
 * Get automated recovery tool/action for error
 */
function getFixableVia(code: string, context?: Record<string, unknown>): ErrorDetail['fixableVia'] {
  const spreadsheetId = context?.['spreadsheetId'] as string | undefined;
  const range = context?.['range'] as string | undefined;

  switch (code) {
    case 'AUTH_REQUIRED':
      // Auth required → login
      return {
        tool: 'sheets_auth',
        action: 'login',
      };

    case 'PERMISSION_DENIED':
      // Permission denied → re-authenticate to grant additional permissions
      return {
        tool: 'sheets_auth',
        action: 'login',
      };

    case 'SHEET_NOT_FOUND':
      // Sheet not found → list sheets to see available sheets
      if (spreadsheetId) {
        return {
          tool: 'sheets_core',
          action: 'list_sheets',
          params: { spreadsheetId },
        };
      }
      return {
        tool: 'sheets_core',
        action: 'list_sheets',
      };

    case 'SPREADSHEET_NOT_FOUND':
      // Spreadsheet not found → list accessible spreadsheets
      return {
        tool: 'sheets_core',
        action: 'list',
      };

    case 'RANGE_NOT_FOUND':
    case 'INVALID_RANGE':
      // Range issues → get spreadsheet to see sheet names and structure
      if (spreadsheetId) {
        return {
          tool: 'sheets_core',
          action: 'get',
          params: { spreadsheetId },
        };
      }
      return undefined;

    case 'NO_DATA':
      // No data → read range to verify it exists
      if (spreadsheetId && range) {
        return {
          tool: 'sheets_data',
          action: 'read',
          params: { spreadsheetId, range },
        };
      }
      return undefined;

    case 'NOT_FOUND':
      // Generic not found → list accessible spreadsheets
      return {
        tool: 'sheets_core',
        action: 'list',
      };

    case 'VALIDATION_FAILED':
    case 'ACTION_REQUIRED':
    case 'INTERNAL_ERROR':
    case 'INVALID_ARGUMENT':
      // Validation/generic errors → check auth status as basic diagnostic
      return {
        tool: 'sheets_auth',
        action: 'status',
      };

    case 'AMBIGUOUS_RANGE':
      // Ambiguous range → analyze sheet to see column structure
      if (spreadsheetId) {
        return {
          tool: 'sheets_analyze',
          action: 'analyze_sheet',
          params: { spreadsheetId },
        };
      }
      return undefined;

    case 'PARSE_ERROR':
      // Parse error → analyze data to understand structure
      if (spreadsheetId && range) {
        return {
          tool: 'sheets_analyze',
          action: 'analyze_data',
          params: { spreadsheetId, range },
        };
      }
      return undefined;

    case 'TRANSACTION_TIMEOUT':
      // Transaction timeout → retry the operation
      // Note: Client should implement retry logic
      return undefined;

    case 'QUOTA_EXCEEDED':
    case 'RATE_LIMIT_EXCEEDED':
      // Quota/rate limit → wait and retry (not automatically fixable)
      // Note: Client should implement backoff strategy
      return undefined;

    case 'ELICITATION_UNAVAILABLE':
    case 'SAMPLING_UNAVAILABLE':
      // Missing MCP capability → cannot be fixed automatically
      return undefined;

    default:
      // No automated fix available
      return undefined;
  }
}

/**
 * Get resource links for error code (Quick Win #2)
 */
function getErrorResources(code: string): Array<{ uri: string; description: string }> | undefined {
  const resourceMap: Record<string, Array<{ uri: string; description: string }>> = {
    SHEET_NOT_FOUND: [
      {
        uri: 'servalsheets://decisions/find-sheet',
        description: 'Decision tree for finding sheets',
      },
      {
        uri: 'servalsheets://reference/sheet-naming',
        description: 'Sheet naming conventions',
      },
    ],
    RANGE_NOT_FOUND: [
      {
        uri: 'servalsheets://reference/a1-notation',
        description: 'A1 notation syntax guide',
      },
      {
        uri: 'servalsheets://decisions/find-range',
        description: 'How to locate ranges in sheets',
      },
    ],
    SPREADSHEET_NOT_FOUND: [
      {
        uri: 'servalsheets://decisions/find-spreadsheet',
        description: 'How to verify spreadsheet access',
      },
    ],
    AUTH_REQUIRED: [
      {
        uri: 'servalsheets://reference/authentication',
        description: 'OAuth authentication guide',
      },
      {
        uri: 'servalsheets://decisions/auth-flow',
        description: 'Authentication troubleshooting',
      },
    ],
    PERMISSION_DENIED: [
      {
        uri: 'servalsheets://decisions/request-access',
        description: 'How to request spreadsheet access',
      },
      {
        uri: 'servalsheets://reference/permissions',
        description: 'Google Sheets permission levels',
      },
    ],
    QUOTA_EXCEEDED: [
      {
        uri: 'servalsheets://reference/api-limits',
        description: 'Google Sheets API quota limits',
      },
      {
        uri: 'servalsheets://decisions/optimize-requests',
        description: 'How to reduce API calls',
      },
    ],
    RATE_LIMIT: [
      {
        uri: 'servalsheets://reference/rate-limiting',
        description: 'Rate limit policies',
      },
    ],
    INVALID_PARAMS: [
      {
        uri: 'servalsheets://decisions/parameter-validation',
        description: 'Parameter validation guide',
      },
    ],
    VALIDATION_ERROR: [
      {
        uri: 'servalsheets://reference/validation-rules',
        description: 'Data validation rules',
      },
    ],
    DATA_VALIDATION_ERROR: [
      {
        uri: 'servalsheets://reference/data-types',
        description: 'Cell data type requirements',
      },
    ],
    OUT_OF_BOUNDS: [
      {
        uri: 'servalsheets://reference/sheet-dimensions',
        description: 'Sheet size limits',
      },
    ],
  };

  return resourceMap[code];
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
