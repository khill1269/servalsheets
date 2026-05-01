/**
 * Auto-Fix Operations (F0)
 *
 * Handles the original `fix` action: issue detection and resolution operations.
 */

import type {
  FixRequest,
  FixOperation,
  IssueToFix,
  FixResult,
  SheetsFixOutput,
} from '../../schemas/fix.js';
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
    req.safety?.createSnapshot !== false
      ? await handler._createSnapshot(req.spreadsheetId)
      : undefined;

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
      return fixFullColumnRefs(handler, spreadsheetId, issue);

    case 'NESTED_IFERROR':
      return fixNestedIferror(spreadsheetId, issue);

    case 'EXCESSIVE_CF_RULES':
      return fixExcessiveCfRules(handler, spreadsheetId, issue.sheet!);

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
async function fixFullColumnRefs(
  handler: FixHandlerAccess,
  spreadsheetId: string,
  issue: IssueToFix
): Promise<FixOperation[]> {
  const formula = getStringMetadata(issue, 'formula');
  const cell = getStringMetadata(issue, 'cell') ?? getStringMetadata(issue, 'range');
  if (!formula || !cell) return [];

  const response = await handler.sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(title,gridProperties(rowCount))',
  });
  const sheet =
    response.data.sheets?.find((s) => s.properties?.title === issue.sheet) ??
    response.data.sheets?.[0];
  const rowCount = sheet?.properties?.gridProperties?.rowCount ?? 1000;
  const boundedFormula = formula.replace(
    /\b([A-Z]{1,3}):([A-Z]{1,3})\b/g,
    (match, start: string, end: string) =>
      start.toUpperCase() === end.toUpperCase() ? `${start}1:${end}${rowCount}` : match
  );

  if (boundedFormula === formula) return [];

  return [
    {
      id: `fix_full_column_refs_${Date.now()}`,
      issueType: 'FULL_COLUMN_REFS',
      tool: 'sheets_data',
      action: 'write',
      parameters: {
        spreadsheetId,
        range: cell,
        values: [[boundedFormula]],
      },
      estimatedImpact: `Replace full-column references in ${cell} with bounded ranges using row count ${rowCount}`,
      risk: 'medium',
    },
  ];
}

/**
 * Fix: Simplify nested IFERROR
 */
function fixNestedIferror(spreadsheetId: string, issue: IssueToFix): FixOperation[] {
  const formula = getStringMetadata(issue, 'formula');
  const cell = getStringMetadata(issue, 'cell') ?? getStringMetadata(issue, 'range');
  if (!formula || !cell) return [];

  const rewrite = simplifyNestedIferror(formula);
  if (!rewrite) return [];

  return [
    {
      id: `fix_nested_iferror_${Date.now()}`,
      issueType: 'NESTED_IFERROR',
      tool: 'sheets_data',
      action: 'write',
      parameters: {
        spreadsheetId,
        range: cell,
        values: [[rewrite.formula]],
      },
      estimatedImpact: `Simplify nested IFERROR in ${cell}`,
      risk: rewrite.sameFallback ? 'low' : 'high',
    },
  ];
}

/**
 * Fix: Consolidate excessive CF rules
 */
async function fixExcessiveCfRules(
  handler: FixHandlerAccess,
  spreadsheetId: string,
  sheetName: string
): Promise<FixOperation[]> {
  const response = await handler.sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(title,sheetId),sheets.conditionalFormats',
  });
  const sheet = response.data.sheets?.find((s) => s.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || !sheet) return [];

  const seen = new Map<string, number>();
  const duplicateIndexes: number[] = [];
  for (const [index, rule] of (sheet.conditionalFormats ?? []).entries()) {
    const fingerprint = JSON.stringify(rule);
    if (seen.has(fingerprint)) {
      duplicateIndexes.push(index);
    } else {
      seen.set(fingerprint, index);
    }
  }

  return duplicateIndexes
    .sort((a, b) => b - a)
    .map((ruleIndex) => ({
      id: `fix_duplicate_cf_rule_${sheetId}_${ruleIndex}`,
      issueType: 'EXCESSIVE_CF_RULES' as const,
      tool: 'sheets_format',
      action: 'delete_conditional_format_rule',
      parameters: {
        spreadsheetId,
        sheetId,
        ruleIndex,
      },
      estimatedImpact: `Delete duplicate conditional format rule ${ruleIndex} from "${sheetName}"`,
      risk: 'low' as const,
    }));
}

function getStringMetadata(issue: IssueToFix, key: string): string | undefined {
  const value = issue.metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function splitTopLevelArgs(input: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | undefined;
  let start = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quote) {
      if (char === quote && input[i - 1] !== '\\') quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      args.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }

  args.push(input.slice(start).trim());
  return args;
}

function parseIferror(formula: string): [string, string] | undefined {
  const trimmed = formula.trim();
  const normalized = trimmed.startsWith('=') ? trimmed.slice(1).trim() : trimmed;
  if (!normalized.toUpperCase().startsWith('IFERROR(') || !normalized.endsWith(')')) {
    return undefined;
  }
  const args = splitTopLevelArgs(normalized.slice('IFERROR('.length, -1));
  return args.length === 2 ? [args[0]!, args[1]!] : undefined;
}

function simplifyNestedIferror(
  formula: string
): { formula: string; sameFallback: boolean } | undefined {
  const outer = parseIferror(formula);
  if (!outer) return undefined;
  const inner = parseIferror(outer[0]);
  if (!inner) return undefined;

  const sameFallback = inner[1] === outer[1];
  const nextFormula = sameFallback
    ? `=IFERROR(${inner[0]},${outer[1]})`
    : `=IFERROR(${inner[0]},IFERROR(${inner[1]},${outer[1]}))`;
  return { formula: nextFormula, sameFallback };
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

    case 'sheets_format':
      if (action === 'delete_conditional_format_rule') {
        await handler.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: parameters['spreadsheetId'] as string,
          requestBody: {
            requests: [
              {
                deleteConditionalFormatRule: {
                  sheetId: parameters['sheetId'] as number,
                  index: parameters['ruleIndex'] as number,
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
