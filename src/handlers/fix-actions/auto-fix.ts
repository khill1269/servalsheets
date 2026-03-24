/**
 * Auto-Fix Operations (F0)
 *
 * Handles the original `fix` action: issue detection and resolution operations.
 */

import type { FixRequest, FixOperation, IssueToFix, FixResult, SheetsFixOutput } from '../../schemas/fix.js';
import type { FixHandlerAccess } from './internal.js';
import { ValidationError } from '../../core/errors.js';
import { ErrorCodes } from '../error-codes.js';

export async function handleFixAction(
  handler: FixHandlerAccess,
  req: FixRequest & { action: 'fix' },
  verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  // Type narrow to ensure required fields are present
  if (!req.spreadsheetId || !req.issues) {
    return {
      response: handler._mapError(new Error('Missing required fields: spreadsheetId and issues')),
    };
  }

  const mode = req.mode ?? 'preview';

  // Filter issues based on user preferences
  const filteredIssues = filterIssues(req.issues, req.filters);

  if (filteredIssues.length === 0) {
    const response = {
      success: true as const,
      mode,
      operations: [] as FixOperation[],
      summary: { total: 0, skipped: req.issues.length },
      message: 'No issues matched the filters',
    };
    return {
      response: handler._applyVerbosityFilter(response, verbosity),
    };
  }

  // Generate fix operations
  const operations = await generateFixOperations(handler, req.spreadsheetId, filteredIssues);

  // Preview mode - just return operations
  if (mode === 'preview' || req.safety?.dryRun) {
    const response = {
      success: true as const,
      mode: 'preview' as const,
      operations,
      summary: {
        total: operations.length,
      },
      message: `Preview: ${operations.length} operation(s) ready to apply. Use mode="apply" to execute.`,
    };
    return {
      response: handler._applyVerbosityFilter(response, verbosity),
    };
  }

  // Apply mode - execute operations
  // ISSUE-131: Confirm before applying large batches (>5 ops) to avoid unreviewed changes
  const CLEAN_CONFIRM_THRESHOLD = 5;
  if (operations.length > CLEAN_CONFIRM_THRESHOLD) {
    const confirmed = await handler._confirmOperation(
      `Apply ${operations.length} fix operations`,
      `This will apply ${operations.length} changes to spreadsheet ${req.spreadsheetId}. Review the preview output before proceeding.`,
      { isDestructive: false, operationType: 'fix_apply_batch' },
      { skipIfElicitationUnavailable: true }
    );
    if (!confirmed) {
      return {
        response: {
          success: false as const,
          error: {
            code: ErrorCodes.OPERATION_CANCELLED,
            message: `Fix apply cancelled by user. ${operations.length} operation(s) were not applied. Run in preview mode first to review changes.`,
            retryable: false,
          },
        },
      };
    }
  }

  const snapshot =
    req.safety?.createSnapshot !== false ? await handler._createSnapshot(req.spreadsheetId) : undefined;

  const results = await applyFixOperations(handler, req.spreadsheetId, operations);

  // Count successes/failures
  const applied = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  // Track context on success
  if (applied > 0) {
    handler._trackContextFromRequest({
      spreadsheetId: req.spreadsheetId,
    });
  }

  const response = {
    success: true as const,
    mode: 'apply' as const,
    operations,
    results,
    snapshotId: snapshot?.revisionId,
    summary: {
      total: operations.length,
      applied,
      failed,
    },
    message: `Applied ${applied}/${operations.length} fix(es). ${failed} failed.`,
  };

  return {
    response: handler._applyVerbosityFilter(response, verbosity),
  };
}

/**
 * Filter issues based on user preferences
 */
function filterIssues(
  issues: IssueToFix[],
  filters?: Extract<FixRequest, { action: 'fix' }>['filters']
): IssueToFix[] {
  if (!filters) return issues;

  let filtered = issues;

  if (filters.severity) {
    filtered = filtered.filter((i) => filters.severity!.includes(i.severity));
  }

  if (filters.types) {
    filtered = filtered.filter((i) => filters.types!.includes(i.type));
  }

  if (filters.sheets) {
    filtered = filtered.filter((i) => !i.sheet || filters.sheets!.includes(i.sheet));
  }

  if (filters.limit) {
    filtered = filtered.slice(0, filters.limit);
  }

  return filtered;
}

/**
 * Generate fix operations from issues
 */
async function generateFixOperations(
  handler: FixHandlerAccess,
  spreadsheetId: string,
  issues: IssueToFix[]
): Promise<FixOperation[]> {
  const operations: FixOperation[] = [];

  for (const issue of issues) {
    const ops = await generateFixForIssue(handler, spreadsheetId, issue);
    operations.push(...ops);
  }

  return operations;
}

/**
 * Generate fix operations for a single issue
 */
async function generateFixForIssue(
  handler: FixHandlerAccess,
  spreadsheetId: string,
  issue: IssueToFix
): Promise<FixOperation[]> {
  switch (issue.type) {
    case 'MULTIPLE_TODAY':
      return fixMultipleToday(spreadsheetId);

    case 'NO_FROZEN_HEADERS':
      return fixFrozenHeaders(handler, spreadsheetId, issue.sheet!);

    case 'NO_FROZEN_COLUMNS':
      return fixFrozenColumns(handler, spreadsheetId, issue.sheet!);

    case 'NO_PROTECTION':
      return fixProtection(handler, spreadsheetId, issue.sheet!);

    case 'FULL_COLUMN_REFS':
      return fixFullColumnRefs(spreadsheetId, issue);

    case 'NESTED_IFERROR':
      return fixNestedIferror(spreadsheetId, issue);

    case 'EXCESSIVE_CF_RULES':
      return fixExcessiveCfRules(spreadsheetId, issue.sheet!);

    default:
      return [];
  }
}

/**
 * Fix: Consolidate multiple TODAY() calls
 */
function fixMultipleToday(spreadsheetId: string): FixOperation[] {
  return [
    {
      id: `fix_today_${Date.now()}`,
      issueType: 'MULTIPLE_TODAY',
      tool: 'sheets_data',
      action: 'write',
      parameters: {
        spreadsheetId,
        range: '_System!B1',
        values: [['=TODAY()']],
      },
      estimatedImpact: 'Create _System!B1 with =TODAY() formula',
      risk: 'low',
    },
    {
      id: `fix_today_name_${Date.now()}`,
      issueType: 'MULTIPLE_TODAY',
      tool: 'sheets_advanced',
      action: 'create_named_range',
      parameters: {
        spreadsheetId,
        name: 'TodayDate',
        range: '_System!B1',
      },
      estimatedImpact: 'Create named range "TodayDate" → _System!B1',
      risk: 'low',
    },
  ];
}

/**
 * Fix: Freeze header rows
 */
async function fixFrozenHeaders(
  handler: FixHandlerAccess,
  spreadsheetId: string,
  sheetName: string
): Promise<FixOperation[]> {
  const response = await handler.sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const sheet = response.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheet) return []; // OK: Explicit empty — sheet not found, no operations to generate

  return [
    {
      id: `fix_freeze_headers_${Date.now()}`,
      issueType: 'NO_FROZEN_HEADERS',
      tool: 'sheets_dimensions',
      action: 'freeze_rows',
      parameters: {
        spreadsheetId,
        sheetId: sheet.properties!.sheetId!,
        count: 1,
      },
      estimatedImpact: `Freeze row 1 in "${sheetName}"`,
      risk: 'low',
    },
  ];
}

/**
 * Fix: Freeze ID columns
 */
async function fixFrozenColumns(
  handler: FixHandlerAccess,
  spreadsheetId: string,
  sheetName: string
): Promise<FixOperation[]> {
  const response = await handler.sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const sheet = response.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheet) return []; // OK: Explicit empty — sheet not found, no operations to generate

  return [
    {
      id: `fix_freeze_columns_${Date.now()}`,
      issueType: 'NO_FROZEN_COLUMNS',
      tool: 'sheets_dimensions',
      action: 'freeze_columns',
      parameters: {
        spreadsheetId,
        sheetId: sheet.properties!.sheetId!,
        count: 1,
      },
      estimatedImpact: `Freeze column A in "${sheetName}"`,
      risk: 'low',
    },
  ];
}

/**
 * Fix: Protect formula cells
 */
async function fixProtection(
  handler: FixHandlerAccess,
  spreadsheetId: string,
  sheetName: string
): Promise<FixOperation[]> {
  const response = await handler.sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  const sheet = response.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheet) return []; // OK: Explicit empty — sheet not found, no operations to generate

  return [
    {
      id: `fix_protection_${Date.now()}`,
      issueType: 'NO_PROTECTION',
      tool: 'sheets_advanced',
      action: 'add_protected_range',
      parameters: {
        spreadsheetId,
        sheetId: sheet.properties!.sheetId!,
        description: 'Auto-protected by ServalSheets',
        warningOnly: true,
      },
      estimatedImpact: `Add protection to "${sheetName}" (warning mode)`,
      risk: 'low',
    },
  ];
}

/**
 * Fix: Replace full column references with bounded ranges
 */
function fixFullColumnRefs(_spreadsheetId: string, _issue: IssueToFix): FixOperation[] {
  // NOT_IMPLEMENTED: Requires formula AST parsing + rewriting (A:A → A2:A500).
  // Full column refs trigger full grid fetch — significant perf impact — but
  // automated rewriting needs formula-level analysis to determine safe bounds.
  return []; // OK: Explicit empty — full column ref rewriting not yet implemented
}

/**
 * Fix: Simplify nested IFERROR
 */
function fixNestedIferror(_spreadsheetId: string, _issue: IssueToFix): FixOperation[] {
  // NOT_IMPLEMENTED: Requires formula AST analysis to simplify nested IFERROR chains
  // (e.g., IFERROR(IFERROR(A,B),C) → IFERROR(A,IFERROR(B,C))) while preserving semantics.
  return []; // OK: Explicit empty — nested IFERROR simplification not yet implemented
}

/**
 * Fix: Consolidate excessive CF rules
 */
function fixExcessiveCfRules(_spreadsheetId: string, _sheetName: string): FixOperation[] {
  // NOT_IMPLEMENTED: Requires reading all CF rules, identifying overlapping/duplicate
  // conditions, and merging them without changing visual behavior. Complex rule interaction
  // analysis needed (priority ordering, stop-if-true semantics).
  return []; // OK: Explicit empty — conditional format rule deduplication not yet implemented
}

/**
 * Apply fix operations (calls other tools)
 */
async function applyFixOperations(
  handler: FixHandlerAccess,
  _spreadsheetId: string,
  operations: FixOperation[]
): Promise<FixResult[]> {
  const results: FixResult[] = [];

  for (const op of operations) {
    try {
      await executeOperation(handler, op);

      results.push({
        operationId: op.id,
        success: true,
        message: `Applied: ${op.estimatedImpact}`,
      });
    } catch (err) {
      results.push({
        operationId: op.id,
        success: false,
        message: 'Failed to apply operation',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/**
 * Execute a single fix operation
 */
async function executeOperation(handler: FixHandlerAccess, op: FixOperation): Promise<void> {
  const { tool, action, parameters } = op;

  switch (tool) {
    case 'sheets_data':
      if (action === 'write') {
        await handler.sheetsApi.spreadsheets.values.update({
          spreadsheetId: parameters['spreadsheetId'] as string,
          range: parameters['range'] as string,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: parameters['values'] as unknown[][],
          },
        });
      }
      break;

    case 'sheets_dimensions':
      if (action === 'freeze_rows' || action === 'freeze_columns') {
        await handler.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: parameters['spreadsheetId'] as string,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: parameters['sheetId'] as number,
                    gridProperties: {
                      [action === 'freeze_rows' ? 'frozenRowCount' : 'frozenColumnCount']:
                        parameters['count'] as number,
                    },
                  },
                  fields: `gridProperties.${action === 'freeze_rows' ? 'frozenRowCount' : 'frozenColumnCount'}`,
                },
              },
            ],
          },
        });
      }
      break;

    case 'sheets_advanced':
      if (action === 'add_protected_range') {
        await handler.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: parameters['spreadsheetId'] as string,
          requestBody: {
            requests: [
              {
                addProtectedRange: {
                  protectedRange: {
                    range: {
                      sheetId: parameters['sheetId'] as number,
                    },
                    description: parameters['description'] as string,
                    warningOnly: parameters['warningOnly'] as boolean,
                  },
                },
              },
            ],
          },
        });
      } else if (action === 'create_named_range') {
        await handler.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: parameters['spreadsheetId'] as string,
          requestBody: {
            requests: [
              {
                addNamedRange: {
                  namedRange: {
                    name: parameters['name'] as string,
                    range: {
                      sheetId: 0,
                    },
                  },
                },
              },
            ],
          },
        });
      }
      break;

    default:
      throw new ValidationError(
        `Unsupported tool: ${tool}`,
        'tool',
        'sheets_data | sheets_format | sheets_dimensions | sheets_core'
      );
  }
}
