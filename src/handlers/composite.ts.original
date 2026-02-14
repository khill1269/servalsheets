/**
 * ServalSheets - Composite Operations Handler
 *
 * Handles high-level composite operations
 * 10 Actions:
 * - Original (7): import_csv, smart_append, bulk_update, deduplicate, export_xlsx, import_xlsx, get_form_responses
 * - LLM-Optimized Workflows (3): setup_sheet, import_and_format, clone_structure
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 *
 * @module handlers/composite
 */

import type { sheets_v4, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { BaseHandler, type HandlerContext, type HandlerError, unwrapRequest } from './base.js';
import { ValidationError } from '../core/errors.js';
import {
  CompositeOperationsService,
  type CsvImportResult,
  type SmartAppendResult,
  type BulkUpdateResult,
  type DeduplicateResult,
} from '../services/composite-operations.js';
import { SheetResolver, initializeSheetResolver } from '../services/sheet-resolver.js';
import type {
  CompositeInput,
  CompositeOutput,
  CompositeImportCsvInput,
  CompositeSmartAppendInput,
  CompositeBulkUpdateInput,
  CompositeDeduplicateInput,
  CompositeExportXlsxInput,
  CompositeImportXlsxInput,
  CompositeGetFormResponsesInput,
  // LLM-optimized workflow types
  CompositeSetupSheetInput,
  CompositeImportAndFormatInput,
  CompositeCloneStructureInput,
} from '../schemas/composite.js';
import type { Intent } from '../core/intent.js';
import { getRequestLogger, sendProgress } from '../utils/request-context.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { getEnv } from '../config/env.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
import { ScopeValidator, IncrementalScopeRequiredError } from '../security/incremental-scope.js';

// ============================================================================
// Handler
// ============================================================================

/**
 * Composite Operations Handler
 *
 * Provides high-level operations that combine multiple API calls.
 */
export class CompositeHandler extends BaseHandler<CompositeInput, CompositeOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi: drive_v3.Drive | undefined;
  private compositeService: CompositeOperationsService;
  private sheetResolver: SheetResolver;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, driveApi?: drive_v3.Drive) {
    super('sheets_composite', context);
    this.sheetsApi = sheetsApi;
    this.driveApi = driveApi;

    // Initialize sheet resolver
    this.sheetResolver = initializeSheetResolver(sheetsApi);

    // Initialize composite operations service
    this.compositeService = new CompositeOperationsService(sheetsApi, this.sheetResolver);
  }

  /**
   * Validate scopes for an operation
   * Returns error response if scopes are insufficient, null if valid
   */
  private validateScopes(operation: string): CompositeOutput | null {
    const validator = new ScopeValidator({
      scopes: this.context.auth?.scopes ?? [],
    });

    try {
      validator.validateOperation(operation);
      return null; // Scopes are valid
    } catch (error) {
      if (error instanceof IncrementalScopeRequiredError) {
        return {
          response: this.error({
            code: 'INCREMENTAL_SCOPE_REQUIRED',
            message: error.message,
            category: 'auth',
            retryable: true,
            retryStrategy: 'reauthorize',
            details: {
              operation: error.operation,
              requiredScopes: error.requiredScopes,
              currentScopes: error.currentScopes,
              missingScopes: error.missingScopes,
              authorizationUrl: error.authorizationUrl,
            },
          }),
        };
      }
      throw error; // Re-throw non-scope errors
    }
  }

  async handle(input: CompositeInput): Promise<CompositeOutput> {
    const req = unwrapRequest<CompositeInput['request']>(input);
    const logger = getRequestLogger();
    // Track spreadsheetId if present (import_xlsx creates a new spreadsheet, so it doesn't have one)
    if ('spreadsheetId' in req) {
      this.trackSpreadsheetId(req.spreadsheetId);
    }

    // Phase 0: Validate scopes for the operation
    const operation = `sheets_composite.${req.action}`;
    const scopeError = this.validateScopes(operation);
    if (scopeError) {
      return scopeError;
    }

    try {
      let response: CompositeOutput['response'];

      switch (req.action) {
        case 'import_csv':
          response = await this.handleImportCsv(req as CompositeImportCsvInput);
          break;
        case 'smart_append':
          response = await this.handleSmartAppend(req as CompositeSmartAppendInput);
          break;
        case 'bulk_update':
          response = await this.handleBulkUpdate(req as CompositeBulkUpdateInput);
          break;
        case 'deduplicate':
          response = await this.handleDeduplicate(req as CompositeDeduplicateInput);
          break;
        case 'export_xlsx':
          response = await this.handleExportXlsx(req as CompositeExportXlsxInput);
          break;
        case 'import_xlsx':
          response = await this.handleImportXlsx(req as CompositeImportXlsxInput);
          break;
        case 'get_form_responses':
          response = await this.handleGetFormResponses(req as CompositeGetFormResponsesInput);
          break;
        // LLM-optimized workflow actions (3)
        case 'setup_sheet':
          response = await this.handleSetupSheet(req as CompositeSetupSheetInput);
          break;
        case 'import_and_format':
          response = await this.handleImportAndFormat(req as CompositeImportAndFormatInput);
          break;
        case 'clone_structure':
          response = await this.handleCloneStructure(req as CompositeCloneStructureInput);
          break;
        default: {
          // Exhaustive check - TypeScript ensures this is unreachable
          const _exhaustiveCheck: never = req;
          throw new ValidationError(
            `Unknown action: ${(req as { action: string }).action}`,
            'action',
            'import_csv | smart_append | bulk_update | deduplicate | export_xlsx | import_xlsx | get_form_responses | setup_sheet | import_and_format | clone_structure'
          );
        }
      }

      // Track context (skip for import_xlsx which creates a new spreadsheet)
      if ('spreadsheetId' in req) {
        this.trackContextFromRequest({
          spreadsheetId: req.spreadsheetId,
        });
      }

      // Apply verbosity filtering - all actions now have verbosity field
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(
        response,
        verbosity
      ) as CompositeOutput['response'];

      return { response: filteredResponse };
    } catch (error) {
      logger.error('Composite operation failed', {
        action: req.action,
        error: error instanceof Error ? error.message : String(error),
      });
      return { response: this.mapError(error) as HandlerError };
    }
  }

  protected createIntents(_input: CompositeInput): Intent[] {
    // Composite operations use services directly, not intents
    return [];
  }

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  private async handleImportCsv(
    input: CompositeImportCsvInput
  ): Promise<CompositeOutput['response']> {
    // Send progress notification for long-running import
    const env = getEnv();
    if (env.ENABLE_GRANULAR_PROGRESS) {
      await sendProgress(0, 2, 'Starting CSV import...');
    }

    const result: CsvImportResult = await this.compositeService.importCsv({
      spreadsheetId: input.spreadsheetId,
      sheet:
        input.sheet !== undefined
          ? typeof input.sheet === 'string'
            ? input.sheet
            : input.sheet
          : undefined,
      csvData: input.csvData,
      delimiter: input.delimiter,
      hasHeader: input.hasHeader,
      mode: input.mode,
      newSheetName: input.newSheetName,
      skipEmptyRows: input.skipEmptyRows,
      trimValues: input.trimValues,
    });

    const cellsAffected = result.rowsImported * result.columnsImported;

    if (env.ENABLE_GRANULAR_PROGRESS) {
      await sendProgress(2, 2, `Imported ${result.rowsImported} rows`);
    }

    return this.success('import_csv', {
      ...result,
      mutation: {
        cellsAffected,
        reversible: false,
      },
    });
  }

  private async handleSmartAppend(
    input: CompositeSmartAppendInput
  ): Promise<CompositeOutput['response']> {
    const result: SmartAppendResult = await this.compositeService.smartAppend({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      data: input.data,
      matchHeaders: input.matchHeaders,
      createMissingColumns: input.createMissingColumns,
      skipEmptyRows: input.skipEmptyRows,
    });

    const cellsAffected = result.rowsAppended * result.columnsMatched.length;

    return this.success('smart_append', {
      ...result,
      mutation: {
        cellsAffected,
        reversible: false,
      },
    });
  }

  private async handleBulkUpdate(
    input: CompositeBulkUpdateInput
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
        _meta: this.generateMeta(
          'bulk_update',
          input as unknown as Record<string, unknown>,
          {} as Record<string, unknown>,
          { cellsAffected: 0 }
        ),
      };
    }

    // Request confirmation if elicitation available and large update
    const estimatedUpdates = input.updates.length;
    if (estimatedUpdates > 10 && this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'bulk_update',
        `Perform bulk update of ${estimatedUpdates} records in spreadsheet ${input.spreadsheetId}. This will modify multiple cells based on key column matches. This action cannot be easily undone.`
      );

      if (!confirmation.confirmed) {
        return {
          success: false,
          error: {
            code: 'PRECONDITION_FAILED',
            message: confirmation.reason || 'User cancelled the operation',
            retryable: false,
          },
        } as CompositeOutput['response'];
      }
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'bulk_update',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
        affectedCells: estimatedUpdates * Object.keys(input.updates[0] || {}).length,
      },
      input.safety
    );

    const result: BulkUpdateResult = await this.compositeService.bulkUpdate({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      keyColumn: input.keyColumn,
      updates: input.updates,
      createUnmatched: input.createUnmatched,
    });

    return {
      success: true as const,
      action: 'bulk_update' as const,
      ...result,
      mutation: {
        cellsAffected: result.cellsModified,
        reversible: false,
      },
      snapshotId: snapshot?.snapshotId,
      _meta: this.generateMeta(
        'bulk_update',
        input as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
        {
          cellsAffected: result.cellsModified,
        }
      ),
    };
  }

  private async handleDeduplicate(
    input: CompositeDeduplicateInput
  ): Promise<CompositeOutput['response']> {
    // Safety check: preview mode (dry-run equivalent)
    if (input.preview) {
      const result: DeduplicateResult = await this.compositeService.deduplicate({
        spreadsheetId: input.spreadsheetId,
        sheet: input.sheet,
        keyColumns: input.keyColumns,
        keep: input.keep,
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
        _meta: this.generateMeta(
          'deduplicate',
          input as unknown as Record<string, unknown>,
          result as unknown as Record<string, unknown>,
          { cellsAffected: result.rowsDeleted }
        ),
      };
    }

    // Safety check: dry-run mode
    if (input.safety?.dryRun) {
      return {
        success: true as const,
        action: 'deduplicate' as const,
        totalRows: 0,
        uniqueRows: 0,
        duplicatesFound: 0,
        rowsDeleted: 0,
        _meta: this.generateMeta(
          'deduplicate',
          input as unknown as Record<string, unknown>,
          {} as Record<string, unknown>,
          { cellsAffected: 0 }
        ),
      };
    }

    // First run in preview mode to get count
    const previewResult: DeduplicateResult = await this.compositeService.deduplicate({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      keyColumns: input.keyColumns,
      keep: input.keep,
      preview: true,
    });

    // Request confirmation if elicitation available and many duplicates found
    if (previewResult.duplicatesFound > 0 && this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'deduplicate',
        `Remove ${previewResult.duplicatesFound} duplicate rows from spreadsheet ${input.spreadsheetId}. Keeping ${input.keep || 'first'} occurrence of each duplicate. This action cannot be undone.`
      );

      if (!confirmation.confirmed) {
        return {
          success: false,
          error: {
            code: 'PRECONDITION_FAILED',
            message: confirmation.reason || 'User cancelled the operation',
            retryable: false,
          },
        } as CompositeOutput['response'];
      }
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'deduplicate',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
        affectedRows: previewResult.duplicatesFound,
      },
      input.safety
    );

    // Send progress notification for long-running dedupe
    const env = getEnv();
    if (env.ENABLE_GRANULAR_PROGRESS) {
      await sendProgress(0, 2, `Deduplicating ${previewResult.totalRows} rows...`);
    }

    // Execute the actual deduplication
    const result: DeduplicateResult = await this.compositeService.deduplicate({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      keyColumns: input.keyColumns,
      keep: input.keep,
      preview: false,
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
      _meta: this.generateMeta(
        'deduplicate',
        input as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
        { cellsAffected: result.rowsDeleted }
      ),
    };
  }

  // ==========================================================================
  // XLSX Export/Import Handlers
  // ==========================================================================

  private async handleExportXlsx(
    input: CompositeExportXlsxInput
  ): Promise<CompositeOutput['response']> {
    if (!this.driveApi) {
      return {
        success: false,
        error: {
          code: 'FEATURE_UNAVAILABLE',
          message:
            'Drive API not available for XLSX export. Ensure OAuth authentication is configured.',
          retryable: false,
        },
      };
    }

    // Get spreadsheet metadata for filename
    const metadataResponse = await this.driveApi.files.get({
      fileId: input.spreadsheetId,
      fields: 'name',
    });
    const filename = `${metadataResponse.data.name ?? 'export'}.xlsx`;

    // Export via Drive API
    const exportResponse = await this.driveApi.files.export(
      {
        fileId: input.spreadsheetId,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(exportResponse.data as ArrayBuffer);
    const base64Content = buffer.toString('base64');

    return {
      success: true as const,
      action: 'export_xlsx' as const,
      fileContent: base64Content,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' as const,
      filename,
      sizeBytes: buffer.length,
      _meta: this.generateMeta(
        'export_xlsx',
        input as unknown as Record<string, unknown>,
        { sizeBytes: buffer.length } as Record<string, unknown>,
        {}
      ),
    };
  }

  private async handleImportXlsx(
    input: CompositeImportXlsxInput
  ): Promise<CompositeOutput['response']> {
    if (!this.driveApi) {
      return {
        success: false,
        error: {
          code: 'FEATURE_UNAVAILABLE',
          message:
            'Drive API not available for XLSX import. Ensure OAuth authentication is configured.',
          retryable: false,
        },
      };
    }

    if (input.safety?.dryRun) {
      return {
        success: true as const,
        action: 'import_xlsx' as const,
        spreadsheetId: 'dry-run-id',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/dry-run-id/edit',
        sheetsImported: 0,
        sheetNames: [],
        _meta: this.generateMeta(
          'import_xlsx',
          input as unknown as Record<string, unknown>,
          {} as Record<string, unknown>,
          {}
        ),
      };
    }

    // Decode base64 content
    const buffer = Buffer.from(input.fileContent, 'base64');

    // Create new spreadsheet by uploading XLSX with conversion
    const response = await this.driveApi.files.create({
      requestBody: {
        name: input.title ?? 'Imported Spreadsheet',
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Readable.from(buffer),
      },
      fields: 'id,name',
    });

    const spreadsheetId = response.data.id!;

    // Get sheet info from the newly created spreadsheet
    const sheetInfo = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const sheetNames = sheetInfo.data.sheets?.map((s) => s.properties?.title ?? '') ?? [];

    return {
      success: true as const,
      action: 'import_xlsx' as const,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      sheetsImported: sheetNames.length,
      sheetNames,
      mutation: {
        cellsAffected: 0, // Unknown until we read the sheets
        reversible: false,
      },
      _meta: this.generateMeta(
        'import_xlsx',
        input as unknown as Record<string, unknown>,
        { spreadsheetId, sheetsImported: sheetNames.length } as Record<string, unknown>,
        {}
      ),
    };
  }

  // ==========================================================================
  // Forms Helper Handler
  // ==========================================================================

  private async handleGetFormResponses(
    input: CompositeGetFormResponsesInput
  ): Promise<CompositeOutput['response']> {
    const sheetName = input.formResponsesSheet ?? 'Form Responses 1';

    // Read the form responses sheet
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: sheetName,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const values = response.data.values ?? [];
    if (values.length === 0) {
      return {
        success: true as const,
        action: 'get_form_responses' as const,
        responseCount: 0,
        columnHeaders: [],
        formLinked: false,
        _meta: this.generateMeta(
          'get_form_responses',
          input as unknown as Record<string, unknown>,
          { responseCount: 0 } as Record<string, unknown>,
          {}
        ),
      };
    }

    // First row is headers (form questions)
    const headers = (values[0] as unknown[]).map(String);
    const dataRows = values.slice(1);
    const responseCount = dataRows.length;

    // Detect if this looks like a form-linked sheet
    // Form responses typically have a "Timestamp" column first
    const formLinked =
      headers.length > 0 && (headers[0]?.toLowerCase().includes('timestamp') ?? false);

    // Build latest and oldest response objects
    let latestResponse: Record<string, unknown> | undefined;
    let oldestResponse: Record<string, unknown> | undefined;

    if (dataRows.length > 0) {
      const buildResponse = (row: unknown[]): Record<string, unknown> => {
        const obj: Record<string, unknown> = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      };

      latestResponse = buildResponse(dataRows[dataRows.length - 1] as unknown[]);
      oldestResponse = buildResponse(dataRows[0] as unknown[]);
    }

    return {
      success: true as const,
      action: 'get_form_responses' as const,
      responseCount,
      columnHeaders: headers,
      latestResponse,
      oldestResponse,
      formLinked,
      _meta: this.generateMeta(
        'get_form_responses',
        input as unknown as Record<string, unknown>,
        { responseCount } as Record<string, unknown>,
        {}
      ),
    };
  }

  // ==========================================================================
  // LLM-Optimized Workflow Handlers (3 new actions)
  // ==========================================================================

  /**
   * Setup Sheet - Creates a new sheet with headers, formatting, and optionally freezes header
   * Replaces 4-6 separate API calls with a single batchUpdate
   */
  private async handleSetupSheet(
    input: CompositeSetupSheetInput
  ): Promise<CompositeOutput['response']> {
    // Check if sheet already exists
    const existingSheets = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });
    const existing = existingSheets.data.sheets?.find(
      (s) => s.properties?.title === input.sheetName
    );

    let sheetId: number;

    if (existing?.properties?.sheetId !== undefined && existing.properties.sheetId !== null) {
      // Sheet already exists - use it
      sheetId = existing.properties.sheetId;
    } else {
      // Add new sheet
      const requests: sheets_v4.Schema$Request[] = [
        {
          addSheet: {
            properties: {
              title: input.sheetName,
              gridProperties: {
                rowCount: 1000,
                columnCount: input.headers.length,
                frozenRowCount: input.freezeHeaderRow ? 1 : 0,
              },
            },
          },
        },
      ];

      const addSheetResponse = await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: input.spreadsheetId,
        requestBody: { requests },
      });

      const newSheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;
      if (newSheetId === undefined || newSheetId === null) {
        return {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create sheet - no sheet ID returned',
            retryable: true,
          },
        };
      }
      sheetId = newSheetId;
    }

    // 2. Write headers
    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: input.spreadsheetId,
      range: `'${input.sheetName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [input.headers],
      },
    });

    // 3. Apply formatting and column widths in one batch
    const formatRequests: sheets_v4.Schema$Request[] = [];

    // Header formatting
    if (input.headerFormat) {
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: input.headers.length,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: input.headerFormat.bold ?? true,
                foregroundColor: input.headerFormat.textColor,
              },
              backgroundColor: input.headerFormat.backgroundColor,
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      });
    }

    // Column widths
    if (input.columnWidths && input.columnWidths.length > 0) {
      input.columnWidths.forEach((width, idx) => {
        if (idx < input.headers.length) {
          formatRequests.push({
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: idx,
                endIndex: idx + 1,
              },
              properties: { pixelSize: width },
              fields: 'pixelSize',
            },
          });
        }
      });
    }

    if (formatRequests.length > 0) {
      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: input.spreadsheetId,
        requestBody: { requests: formatRequests },
      });
    }

    // Calculate API calls saved (vs manual: addSheet + values.update + format + freeze + N column widths)
    const apiCallsSaved = Math.max(0, 4 + (input.columnWidths?.length ?? 0) - 3);

    return {
      success: true as const,
      action: 'setup_sheet' as const,
      sheetId,
      sheetName: input.sheetName,
      columnCount: input.headers.length,
      apiCallsSaved,
      _meta: this.generateMeta(
        'setup_sheet',
        input as unknown as Record<string, unknown>,
        { sheetId, columnCount: input.headers.length } as Record<string, unknown>,
        {}
      ),
    };
  }

  /**
   * Import and Format - Import CSV data and apply formatting in one operation
   * Replaces 3-5 separate API calls with optimized batch operations
   */
  private async handleImportAndFormat(
    input: CompositeImportAndFormatInput
  ): Promise<CompositeOutput['response']> {
    // 1. Import CSV using existing composite service
    const importResult: CsvImportResult = await this.compositeService.importCsv({
      spreadsheetId: input.spreadsheetId,
      sheet:
        input.sheet !== undefined
          ? typeof input.sheet === 'string'
            ? input.sheet
            : input.sheet
          : undefined,
      csvData: input.csvData,
      delimiter: input.delimiter,
      hasHeader: input.hasHeader,
      mode: 'replace',
      newSheetName: input.newSheetName,
      skipEmptyRows: true,
      trimValues: true,
    });

    // 2. Apply formatting in one batch
    const formatRequests: sheets_v4.Schema$Request[] = [];

    // Header formatting
    if (input.hasHeader && input.headerFormat) {
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: importResult.sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: importResult.columnsImported,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                bold: input.headerFormat.bold ?? true,
              },
              backgroundColor: input.headerFormat.backgroundColor,
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      });
    }

    // Freeze header row
    if (input.freezeHeaderRow && input.hasHeader) {
      formatRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: importResult.sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      });
    }

    // Auto-resize columns
    if (input.autoResizeColumns) {
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: importResult.sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: importResult.columnsImported,
          },
        },
      });
    }

    if (formatRequests.length > 0) {
      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: input.spreadsheetId,
        requestBody: { requests: formatRequests },
      });
    }

    // Calculate API calls saved (vs manual: import + format header + freeze + auto-resize)
    const apiCallsSaved = Math.max(0, 4 - 2);

    const cellsAffected = importResult.rowsImported * importResult.columnsImported;
    return {
      success: true as const,
      action: 'import_and_format' as const,
      rowsImported: importResult.rowsImported,
      columnsImported: importResult.columnsImported,
      sheetId: importResult.sheetId,
      sheetName: importResult.sheetName,
      range: importResult.range,
      apiCallsSaved,
      mutation: {
        cellsAffected,
        reversible: false,
      },
      _meta: this.generateMeta(
        'import_and_format',
        input as unknown as Record<string, unknown>,
        importResult as unknown as Record<string, unknown>,
        { cellsAffected }
      ),
    };
  }

  /**
   * Clone Structure - Copy sheet structure (headers, formats) without data
   * Replaces 4-6 separate API calls with optimized batch operations
   */
  private async handleCloneStructure(
    input: CompositeCloneStructureInput
  ): Promise<CompositeOutput['response']> {
    // 1. Get source sheet ID and info
    const sourceSheetRef =
      typeof input.sourceSheet === 'string'
        ? { sheetName: input.sourceSheet }
        : { sheetId: input.sourceSheet };
    const resolved = await this.sheetResolver.resolve(input.spreadsheetId, sourceSheetRef);
    const sourceSheetId = resolved.sheet.sheetId;

    // 2. Copy the sheet (this copies everything including data)
    const copyResponse = await this.sheetsApi.spreadsheets.sheets.copyTo({
      spreadsheetId: input.spreadsheetId,
      sheetId: sourceSheetId,
      requestBody: {
        destinationSpreadsheetId: input.spreadsheetId,
      },
    });

    const copiedSheetId = copyResponse.data.sheetId;
    if (copiedSheetId === undefined || copiedSheetId === null) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to copy sheet - no sheet ID returned',
          retryable: true,
        },
      };
    }
    // Assert type after null check
    const newSheetId: number = copiedSheetId;

    // 3. Get sheet properties to determine size
    const sheetInfo = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties',
    });

    const newSheet = sheetInfo.data.sheets?.find((s) => s.properties?.sheetId === newSheetId);
    const columnCount = newSheet?.properties?.gridProperties?.columnCount ?? 26;

    // 4. Batch: rename sheet and clear data (keep header rows)
    const requests: sheets_v4.Schema$Request[] = [
      // Rename the copied sheet
      {
        updateSheetProperties: {
          properties: {
            sheetId: newSheetId,
            title: input.newSheetName,
          },
          fields: 'title',
        },
      },
    ];

    // Clear data rows (keep header rows based on headerRowCount)
    const headerRowCount = input.headerRowCount ?? 1;
    requests.push({
      updateCells: {
        range: {
          sheetId: newSheetId,
          startRowIndex: headerRowCount,
          startColumnIndex: 0,
        },
        fields: 'userEnteredValue',
      },
    });

    // Optionally clear formatting (if not included)
    if (!input.includeFormatting) {
      requests.push({
        updateCells: {
          range: {
            sheetId: newSheetId,
            startRowIndex: headerRowCount,
            startColumnIndex: 0,
          },
          fields: 'userEnteredFormat',
        },
      });
    }

    // Optionally clear conditional formatting
    if (!input.includeConditionalFormatting) {
      // Get conditional formats and delete them
      const detailedInfo = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.conditionalFormats',
      });

      const conditionalFormats = detailedInfo.data.sheets?.find(
        (s) => s.conditionalFormats && s.conditionalFormats.length > 0
      )?.conditionalFormats;

      if (conditionalFormats) {
        // Note: We can't easily delete just the new sheet's conditional formats
        // as they inherit from the copy. This would require more complex logic.
      }
    }

    // Optionally clear data validation
    if (!input.includeDataValidation) {
      requests.push({
        setDataValidation: {
          range: {
            sheetId: newSheetId,
            startRowIndex: headerRowCount,
            startColumnIndex: 0,
          },
          rule: undefined, // Clears validation
        },
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    // Calculate API calls saved (vs manual: copy + rename + clear data + clear format + clear validation)
    const apiCallsSaved = Math.max(0, 5 - 2);

    return {
      success: true as const,
      action: 'clone_structure' as const,
      newSheetId,
      newSheetName: input.newSheetName,
      columnCount,
      headerRowsPreserved: headerRowCount,
      formattingCopied: input.includeFormatting ?? true,
      validationCopied: input.includeDataValidation ?? true,
      apiCallsSaved,
      _meta: this.generateMeta(
        'clone_structure',
        input as unknown as Record<string, unknown>,
        { newSheetId, columnCount } as Record<string, unknown>,
        {}
      ),
    };
  }
}
