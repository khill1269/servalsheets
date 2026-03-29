/**
 * Composite Data Operations Handlers
 *
 * Decomposed action handlers for:
 * - import_csv
 * - smart_append
 * - bulk_update
 * - deduplicate
 */

import { ErrorCodes } from '../error-codes.js';
import { getRequestLogger, sendProgress } from '../../utils/request-context.js';
import { getEnv } from '../../config/env.js';
import { withTimeout } from '../../utils/timeout.js';
import {
  createSnapshotIfNeeded,
  requestSafetyConfirmation,
} from '../../utils/safety-helpers.js';
import type {
  CompositeImportCsvInput,
  CompositeSmartAppendInput,
  CompositeBulkUpdateInput,
  CompositeDeduplicateInput,
  CompositeOutput,
} from '../../schemas/composite.js';
import type { CsvImportResult, SmartAppendResult, BulkUpdateResult, DeduplicateResult } from '../../services/composite-operations.js';
import type { CompositeHandlerAccess } from './internal.js';

/**
 * Decomposed action handler for `import_csv`.
 */
export async function handleImportCsvAction(
  input: CompositeImportCsvInput,
  access: CompositeHandlerAccess
): Promise<CompositeOutput['response']> {
  let resolvedInput = input;
  const legacySheetName =
    typeof (input as { sheetName?: unknown }).sheetName === 'string'
      ? ((input as { sheetName?: string }).sheetName ?? '').trim()
      : '';

  if (
    legacySheetName.length > 0 &&
    resolvedInput.sheet === undefined &&
    resolvedInput.newSheetName === undefined
  ) {
    resolvedInput = {
      ...resolvedInput,
      newSheetName: legacySheetName,
    };
  }

  // Wizard: If csvData is provided but delimiter is missing, elicit delimiter
  if (resolvedInput.csvData && !resolvedInput.delimiter && access.context?.server?.elicitInput) {
    try {
      const wizard = await access.context.server.elicitInput({
        message: 'CSV data detected. What delimiter separates fields?',
        requestedSchema: {
          type: 'object',
          properties: {
            delimiter: {
              type: 'string',
              title: 'CSV delimiter',
              description: 'Character separating fields (comma, semicolon, tab, or pipe)',
              enum: [',', ';', '\t', '|'],
            },
          },
        },
      });
      const wizardContent = wizard?.content as Record<string, unknown> | undefined;
      const delimiter =
        typeof wizardContent?.['delimiter'] === 'string' ? wizardContent['delimiter'] : undefined;
      if (wizard?.action === 'accept' && delimiter) {
        resolvedInput = { ...resolvedInput, delimiter };
      }
    } catch {
      // Elicitation not available — continue with default comma delimiter
      if (!resolvedInput.delimiter) {
        resolvedInput = { ...resolvedInput, delimiter: ',' };
      }
    }
  }

  // Send progress notification for long-running import
  const env = getEnv();
  if (env.ENABLE_GRANULAR_PROGRESS) {
    await sendProgress(0, 2, 'Starting CSV import...');
  }

  const result: CsvImportResult = await withTimeout(
    () =>
      access.compositeService.importCsv({
        spreadsheetId: resolvedInput.spreadsheetId,
        sheet:
          resolvedInput.sheet !== undefined
            ? typeof resolvedInput.sheet === 'string'
              ? resolvedInput.sheet
              : resolvedInput.sheet
            : undefined,
        csvData: resolvedInput.csvData,
        delimiter: resolvedInput.delimiter ?? ',',
        hasHeader: resolvedInput.hasHeader,
        mode: resolvedInput.mode,
        newSheetName: resolvedInput.newSheetName,
        skipEmptyRows: resolvedInput.skipEmptyRows,
        trimValues: resolvedInput.trimValues,
      }),
    env.COMPOSITE_TIMEOUT_MS,
    'import_csv'
  );

  const cellsAffected = result.rowsImported * result.columnsImported;

  if (env.ENABLE_GRANULAR_PROGRESS) {
    await sendProgress(2, 2, `Imported ${result.rowsImported} rows`);
  }

  // Invalidate sheet cache after CSV import (may create new sheet)
  access.context.sheetResolver?.invalidate(resolvedInput.spreadsheetId);

  // Record operation in session context for LLM follow-up references
  try {
    if (access.context.sessionContext) {
      access.context.sessionContext.recordOperation({
        tool: 'sheets_composite',
        action: 'import_csv',
        spreadsheetId: resolvedInput.spreadsheetId,
        description: `Imported CSV: ${result.rowsImported} rows, ${result.columnsImported} columns`,
        undoable: false,
        cellsAffected,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return access.success('import_csv', {
    ...result,
    mutation: {
      cellsAffected,
      reversible: false,
    },
  });
}

/**
 * Decomposed action handler for `smart_append`.
 */
export async function handleSmartAppendAction(
  input: CompositeSmartAppendInput,
  access: CompositeHandlerAccess
): Promise<CompositeOutput['response']> {
  const result: SmartAppendResult = await access.compositeService.smartAppend({
    spreadsheetId: input.spreadsheetId,
    sheet: input.sheet,
    data: input.data,
    matchHeaders: input.matchHeaders,
    createMissingColumns: input.createMissingColumns,
    skipEmptyRows: input.skipEmptyRows,
  });

  const cellsAffected = result.rowsAppended * result.columnsMatched.length;

  // Record operation in session context for LLM follow-up references
  try {
    if (access.context.sessionContext) {
      access.context.sessionContext.recordOperation({
        tool: 'sheets_composite',
        action: 'smart_append',
        spreadsheetId: input.spreadsheetId,
        description: `Smart-appended ${result.rowsAppended} rows (${result.columnsMatched.length} columns matched)`,
        undoable: false,
        cellsAffected,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return access.success('smart_append', {
    ...result,
    mutation: {
      cellsAffected,
      reversible: false,
    },
  });
}

/**
 * Decomposed action handler for `bulk_update`.
 */
export async function handleBulkUpdateAction(
  input: CompositeBulkUpdateInput,
  access: CompositeHandlerAccess
): Promise<CompositeOutput['response']> {
  // Safety check: dry-run mode
  if (input.safety?.dryRun) {
    return {
      success: true as const,
      action: 'bulk_update' as const,
      rowsUpdated: 0,
      rowsCreated: 0,
      keysNotFound: [],
      cellsModified: 0,
      mutation: {
        cellsAffected: 0,
        reversible: false,
      },
      _meta: access.generateMeta(
        'bulk_update',
        input as unknown as Record<string, unknown>,
        {} as Record<string, unknown>,
        { cellsAffected: 0 }
      ),
    };
  }

  const estimatedUpdates = input.updates.length;
  const estimatedCells =
    estimatedUpdates *
    Math.max(
      1,
      ...input.updates.map((update) => Object.keys(update as Record<string, unknown>).length)
    );
  const confirmation = await requestSafetyConfirmation({
    server: access.context.server ?? access.context.elicitationServer,
    operation: 'bulk_update',
    details: `Perform bulk update of ${estimatedUpdates} record(s) in spreadsheet ${input.spreadsheetId}. This will modify multiple cells based on key column matches. This action cannot be easily undone.`,
    context: {
      toolName: 'sheets_composite',
      actionName: 'bulk_update',
      operationType: 'bulk_update',
      isDestructive: false,
      affectedRows: estimatedUpdates,
      affectedCells: estimatedCells,
      spreadsheetId: input.spreadsheetId,
    },
    logger: access.context.logger,
  });

  if (!confirmation.confirmed) {
    return {
      success: false,
      error: {
        code: ErrorCodes.PRECONDITION_FAILED,
        message: confirmation.reason || 'User cancelled the operation',
        retryable: false,
      },
    } as CompositeOutput['response'];
  }

  // Create snapshot if requested
  const snapshot = await createSnapshotIfNeeded(
    access.context.snapshotService,
    {
      operationType: 'bulk_update',
      isDestructive: true,
      spreadsheetId: input.spreadsheetId,
      affectedCells: estimatedCells,
    },
    input.safety
  );

  // Wrap service call in try-catch and map Google API errors
  let result: BulkUpdateResult;
  try {
    result = await access.compositeService.bulkUpdate({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      keyColumn: input.keyColumn,
      updates: input.updates,
      createUnmatched: input.createUnmatched,
    });
  } catch (err) {
    const requestLogger = getRequestLogger();
    requestLogger.error('bulk_update failed', {
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      keyColumn: input.keyColumn,
      updateCount: input.updates.length,
    });
    return access.mapError(err);
  }

  return {
    success: true as const,
    action: 'bulk_update' as const,
    ...result,
    mutation: {
      cellsAffected: result.cellsModified,
      reversible: false,
    },
    snapshotId: snapshot?.snapshotId,
    _meta: access.generateMeta(
      'bulk_update',
      input as unknown as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      {
        cellsAffected: result.cellsModified,
      }
    ),
  };
}

/**
 * Decomposed action handler for `deduplicate`.
 */
export async function handleDeduplicateAction(
  input: CompositeDeduplicateInput,
  access: CompositeHandlerAccess
): Promise<CompositeOutput['response']> {
  let resolvedInput = input;

  // Wizard: If range is provided but keyColumns is missing, elicit key column
  if (
    resolvedInput.sheet &&
    (!resolvedInput.keyColumns || resolvedInput.keyColumns.length === 0)
  ) {
    if (access.context?.server?.elicitInput) {
      try {
        const wizard = await access.context.server.elicitInput({
          message: 'Which column(s) identify duplicates? (Column letter like A, or header name)',
          requestedSchema: {
            type: 'object',
            properties: {
              keyColumn: {
                type: 'string',
                title: 'Key column',
                description: 'Column letter (A, B, C...) or header name (Email, ID, Name...)',
              },
            },
          },
        });
        const wizardContent = wizard?.content as Record<string, unknown> | undefined;
        const keyColumn =
          typeof wizardContent?.['keyColumn'] === 'string'
            ? wizardContent['keyColumn']
            : undefined;
        if (wizard?.action === 'accept' && keyColumn) {
          resolvedInput = {
            ...resolvedInput,
            keyColumns: [keyColumn],
          };
        }
      } catch {
        // Elicitation not available — continue without specific key columns
      }
    }
  }

  // Safety check: preview mode (dry-run equivalent)
  if (resolvedInput.preview) {
    const result: DeduplicateResult = await access.compositeService.deduplicate({
      spreadsheetId: resolvedInput.spreadsheetId,
      sheet: resolvedInput.sheet,
      keyColumns: resolvedInput.keyColumns,
      keep: resolvedInput.keep,
      preview: true,
    });

    return {
      success: true as const,
      action: 'deduplicate' as const,
      ...result,
      mutation:
        result.rowsDeleted > 0
          ? {
              cellsAffected: result.rowsDeleted,
              reversible: false,
            }
          : undefined,
      _meta: access.generateMeta(
        'deduplicate',
        resolvedInput as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
        { cellsAffected: result.rowsDeleted }
      ),
    };
  }

  // Safety check: dry-run mode
  if (resolvedInput.safety?.dryRun) {
    return {
      success: true as const,
      action: 'deduplicate' as const,
      totalRows: 0,
      uniqueRows: 0,
      duplicatesFound: 0,
      rowsDeleted: 0,
      _meta: access.generateMeta(
        'deduplicate',
        resolvedInput as unknown as Record<string, unknown>,
        {} as Record<string, unknown>,
        { cellsAffected: 0 }
      ),
    };
  }

  // First run in preview mode to get count
  const previewResult: DeduplicateResult = await access.compositeService.deduplicate({
    spreadsheetId: resolvedInput.spreadsheetId,
    sheet: resolvedInput.sheet,
    keyColumns: resolvedInput.keyColumns,
    keep: resolvedInput.keep,
    preview: true,
  });

  const confirmation = await requestSafetyConfirmation({
    server: access.context.server ?? access.context.elicitationServer,
    operation: 'deduplicate',
    details: `Remove ${previewResult.duplicatesFound} duplicate row(s) from spreadsheet ${resolvedInput.spreadsheetId}. Keeping ${resolvedInput.keep || 'first'} occurrence of each duplicate. This action cannot be undone.`,
    context: {
      toolName: 'sheets_composite',
      actionName: 'deduplicate',
      operationType: 'deduplicate',
      isDestructive: true,
      affectedRows: previewResult.duplicatesFound,
      spreadsheetId: resolvedInput.spreadsheetId,
    },
    logger: access.context.logger,
  });

  if (!confirmation.confirmed) {
    return {
      success: false,
      error: {
        code: ErrorCodes.PRECONDITION_FAILED,
        message: confirmation.reason || 'User cancelled the operation',
        retryable: false,
      },
    } as CompositeOutput['response'];
  }

  // Create snapshot if requested
  const snapshot = await createSnapshotIfNeeded(
    access.context.snapshotService,
    {
      operationType: 'deduplicate',
      isDestructive: true,
      spreadsheetId: resolvedInput.spreadsheetId,
      affectedRows: previewResult.duplicatesFound,
    },
    resolvedInput.safety
  );

  // Send progress notification for long-running dedupe
  const env = getEnv();
  if (env.ENABLE_GRANULAR_PROGRESS) {
    await sendProgress(0, 2, `Deduplicating ${previewResult.totalRows} rows...`);
  }

  // Execute the actual deduplication (reuse preview scan to skip redundant API fetch)
  const result: DeduplicateResult = await access.compositeService.deduplicate({
    spreadsheetId: resolvedInput.spreadsheetId,
    sheet: resolvedInput.sheet,
    keyColumns: resolvedInput.keyColumns,
    keep: resolvedInput.keep,
    preview: false,
    _preComputedDuplicateRows: previewResult._duplicateRowSet,
    _preComputedTotalRows: previewResult.totalRows,
    _preComputedUniqueRows: previewResult.uniqueRows,
  });

  if (env.ENABLE_GRANULAR_PROGRESS) {
    await sendProgress(2, 2, `Removed ${result.rowsDeleted} duplicate rows`);
  }

  return {
    success: true as const,
    action: 'deduplicate' as const,
    ...result,
    mutation:
      result.rowsDeleted > 0
        ? {
            cellsAffected: result.rowsDeleted,
            reversible: false,
          }
        : undefined,
    snapshotId: snapshot?.snapshotId,
    _meta: access.generateMeta(
      'deduplicate',
      input as unknown as Record<string, unknown>,
      result as unknown as Record<string, unknown>,
      { cellsAffected: result.rowsDeleted }
    ),
  };
}
