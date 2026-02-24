/**
 * ServalSheets - Composite Operations Handler
 *
 * Handles high-level composite operations
 * 14 Actions:
 * - Original (7): import_csv, smart_append, bulk_update, deduplicate, export_xlsx, import_xlsx, get_form_responses
 * - LLM-Optimized Workflows (3): setup_sheet, import_and_format, clone_structure
 * - NL Sheet Generator (3): generate_sheet, generate_template, preview_generation
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
  // Streaming types
  CompositeExportLargeDatasetInput,
  // NL Sheet Generator types
  CompositeGenerateSheetInput,
  CompositeGenerateTemplateInput,
  CompositePreviewGenerationInput,
  // P14-C1 Composite Workflow types
  CompositeAuditSheetInput,
  CompositePublishReportInput,
  CompositeDataPipelineInput,
  CompositeInstantiateTemplateInput,
  CompositeMigrateSpreadsheetInput,
  PipelineStep,
  ColumnMapping,
} from '../schemas/composite.js';
import { generateDefinition, executeDefinition } from '../services/sheet-generator.js';
import { readDataInChunks, formatBytes } from '../utils/streaming-export.js';
import type { Intent } from '../core/intent.js';
import { getRequestLogger, sendProgress } from '../utils/request-context.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { getEnv } from '../config/env.js';
import { withTimeout } from '../utils/timeout.js';
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
        case 'export_large_dataset':
          response = await this.handleExportLargeDataset(req as CompositeExportLargeDatasetInput);
          break;
        case 'generate_sheet':
          response = await this.handleGenerateSheet(req as CompositeGenerateSheetInput);
          break;
        case 'generate_template':
          response = await this.handleGenerateTemplate(req as CompositeGenerateTemplateInput);
          break;
        case 'preview_generation':
          response = await this.handlePreviewGeneration(req as CompositePreviewGenerationInput);
          break;
        // P14-C1 Composite Workflow actions (5)
        case 'audit_sheet':
          response = await this.handleAuditSheet(req as CompositeAuditSheetInput);
          break;
        case 'publish_report':
          response = await this.handlePublishReport(req as CompositePublishReportInput);
          break;
        case 'data_pipeline':
          response = await this.handleDataPipeline(req as CompositeDataPipelineInput);
          break;
        case 'instantiate_template':
          response = await this.handleInstantiateTemplate(req as CompositeInstantiateTemplateInput);
          break;
        case 'migrate_spreadsheet':
          response = await this.handleMigrateSpreadsheet(req as CompositeMigrateSpreadsheetInput);
          break;
        default: {
          // Exhaustive check - TypeScript ensures this is unreachable
          const _exhaustiveCheck: never = req;
          throw new ValidationError(
            `Unknown action: ${(req as { action: string }).action}`,
            'action',
            'import_csv | smart_append | bulk_update | deduplicate | export_xlsx | import_xlsx | get_form_responses | setup_sheet | import_and_format | clone_structure | export_large_dataset | generate_sheet | generate_template | preview_generation | audit_sheet | publish_report | data_pipeline | instantiate_template | migrate_spreadsheet'
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
    // BUG-025 FIX: CSV imports can take >30s on large files (>10K rows)
    // This operation processes large amounts of data and naturally exceeds MCP's 30s timeout
    // For long-running imports, set COMPOSITE_TIMEOUT_MS env var to extend timeout
    // Default is 120 seconds (2 minutes) which handles most CSV imports
    // Send progress notification for long-running import
    const env = getEnv();
    if (env.ENABLE_GRANULAR_PROGRESS) {
      await sendProgress(0, 2, 'Starting CSV import...');
    }

    const result: CsvImportResult = await withTimeout(
      () => this.compositeService.importCsv({
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
      }),
      env.COMPOSITE_TIMEOUT_MS,
      'import_csv'
    );

    const cellsAffected = result.rowsImported * result.columnsImported;

    if (env.ENABLE_GRANULAR_PROGRESS) {
      await sendProgress(2, 2, `Imported ${result.rowsImported} rows`);
    }

    // Fix: Invalidate sheet cache after CSV import (may create new sheet)
    this.context.sheetResolver?.invalidate(input.spreadsheetId);

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

    // BUG-022 FIX: Wrap service call in try-catch and map Google API errors
    let result: BulkUpdateResult;
    try {
      result = await this.compositeService.bulkUpdate({
        spreadsheetId: input.spreadsheetId,
        sheet: input.sheet,
        keyColumn: input.keyColumn,
        updates: input.updates,
        createUnmatched: input.createUnmatched,
      });
    } catch (err) {
      return this.mapError(err);
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

    // Execute the actual deduplication (reuse preview scan to skip redundant API fetch)
    const result: DeduplicateResult = await this.compositeService.deduplicate({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      keyColumns: input.keyColumns,
      keep: input.keep,
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
    // BUG-026 FIX: XLSX exports can take >30s on large spreadsheets (>100K cells)
    // Drive API's files.export operation is inherently slow for large datasets
    // For long-running exports, set LARGE_PAYLOAD_TIMEOUT_MS env var to extend timeout
    // Default is 60 seconds (1 minute) which handles most spreadsheets up to 500K cells
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
      supportsAllDrives: true,
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
    // BUG-027 FIX: XLSX imports can take >30s on large files (>50MB, >500K cells)
    // Drive API's files.create with media upload is slow for large XLSX files
    // For long-running imports, set COMPOSITE_TIMEOUT_MS env var to extend timeout
    // Default is 120 seconds (2 minutes) which handles most XLSX files up to 50MB
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
    const env = getEnv();

    // Create new spreadsheet by uploading XLSX with conversion
    const response = await withTimeout(
      () => this.driveApi!.files.create({
        requestBody: {
          name: input.title ?? 'Imported Spreadsheet',
          mimeType: 'application/vnd.google-apps.spreadsheet',
        },
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          body: Readable.from(buffer),
        },
        fields: 'id,name',
        supportsAllDrives: true,
      }),
      env.COMPOSITE_TIMEOUT_MS,
      'import_xlsx'
    );

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

    // BUG-024 FIX: Wrap values.get in try-catch for proper error handling
    let response;
    try {
      response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: sheetName,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
    } catch (_err) {
      // Sheet not found or access error
      return this.error({
        code: 'SHEET_NOT_FOUND',
        message: `Form responses sheet "${sheetName}" not found or inaccessible. Verify the sheet exists and you have read access.`,
        retryable: false,
        details: { formResponsesSheet: sheetName, spreadsheetId: input.spreadsheetId },
      });
    }
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
      latestResponse: latestResponse as
        | Record<string, string | number | boolean | unknown[] | Record<string, unknown> | null>
        | undefined,
      oldestResponse: oldestResponse as
        | Record<string, string | number | boolean | unknown[] | Record<string, unknown> | null>
        | undefined,
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

    // Helper: build format/width requests given a known sheetId
    const buildFormatRequests = (id: number): sheets_v4.Schema$Request[] => {
      const reqs: sheets_v4.Schema$Request[] = [];
      if (input.headerFormat) {
        reqs.push({
          repeatCell: {
            range: {
              sheetId: id,
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
      if (input.columnWidths && input.columnWidths.length > 0) {
        input.columnWidths.forEach((width, idx) => {
          if (idx < input.headers.length) {
            reqs.push({
              updateDimensionProperties: {
                range: { sheetId: id, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
                properties: { pixelSize: width },
                fields: 'pixelSize',
              },
            });
          }
        });
      }
      return reqs;
    };

    let sheetId: number;

    if (existing?.properties?.sheetId !== undefined && existing.properties.sheetId !== null) {
      // Sheet already exists — write headers then apply formats separately
      sheetId = existing.properties.sheetId;

      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range: `'${input.sheetName}'!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [input.headers] },
      });

      const formatRequests = buildFormatRequests(sheetId);
      if (formatRequests.length > 0) {
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: input.spreadsheetId,
          requestBody: { requests: formatRequests },
        });
      }
    } else {
      // New sheet: pre-determine sheetId so addSheet + formats merge into ONE batchUpdate.
      // Google docs: "By adding the sheet ID in the request, you can use it for other
      // subrequests in the same API call" — avoids a write-read-write cycle.
      sheetId = Math.floor(Math.random() * 2_147_483_647);

      const formatRequests = buildFormatRequests(sheetId);
      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  sheetId,
                  title: input.sheetName,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: input.headers.length,
                    frozenRowCount: input.freezeHeaderRow ? 1 : 0,
                  },
                },
              },
            },
            ...formatRequests,
          ],
        },
      });

      // Sheet now exists — write headers
      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range: `'${input.sheetName}'!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [input.headers] },
      });
    }

    // Calculate API calls saved (vs manual: addSheet + values.update + format + freeze + N column widths)
    const apiCallsSaved = Math.max(0, 4 + (input.columnWidths?.length ?? 0) - 3);

    // Fix: Invalidate sheet cache after setup (may have created a new sheet)
    this.context.sheetResolver?.invalidate(input.spreadsheetId);

    return {
      success: true as const,
      action: 'setup_sheet' as const,
      sheetId,
      sheetName: input.sheetName,
      columnCount: input.headers.length,
      rowsCreated: input.data?.length ?? 0,
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
      // BUG-023 FIX: Determine mode based on input parameters
      mode: input.newSheetName ? 'new_sheet' : 'replace',
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

    // Fix: Invalidate sheet cache after import (may have created a new sheet)
    this.context.sheetResolver?.invalidate(input.spreadsheetId);

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

    // Fix: Invalidate sheet cache after cloning (created a new sheet via copy + rename)
    this.context.sheetResolver?.invalidate(input.spreadsheetId);

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

  // ==========================================================================
  // Streaming Export Handler
  // ==========================================================================

  /**
   * Export Large Dataset - Memory-efficient export for 100K+ rows
   * Uses chunked reading with progress updates to prevent OOM
   */
  private async handleExportLargeDataset(
    input: CompositeExportLargeDatasetInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();

    logger.info('Starting large dataset export', {
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      chunkSize: input.chunkSize,
      format: input.format,
    });

    try {
      // Use streaming export utility
      const result = await readDataInChunks(this.sheetsApi, input.spreadsheetId, input.range, {
        chunkSize: input.chunkSize,
        enableProgress: true,
        // Force streaming when chunkSize is explicitly provided
        streamingThreshold: input.chunkSize ? 1 : undefined,
      });

      // Format data based on requested format
      let formattedData: string;
      if (input.format === 'csv') {
        // Convert to CSV
        formattedData = result.data
          .map((row) =>
            row
              .map((cell) => {
                const cellStr = String(cell ?? '');
                // Always escape internal quotes by doubling them
                const escaped = cellStr.replace(/"/g, '""');
                // Only wrap in quotes if contains comma or newline
                if (cellStr.includes(',') || cellStr.includes('\n')) {
                  return `"${escaped}"`;
                }
                return escaped;
              })
              .join(',')
          )
          .join('\n');
      } else {
        // JSON format
        formattedData = JSON.stringify(result.data);
      }

      logger.info('Large dataset export complete', {
        totalRows: result.stats.totalRows,
        totalColumns: result.stats.totalColumns,
        chunksProcessed: result.stats.chunksProcessed,
        bytesProcessed: formatBytes(result.stats.bytesProcessed),
        durationMs: result.stats.durationMs,
        streamed: result.streamed,
      });

      // MCP SEP-1686: Create task entry for long-running large dataset export
      let exportTaskId: string | undefined;
      if (this.context.taskStore) {
        const task = await this.context.taskStore.createTask(
          { ttl: 3600000 }, // 1 hour TTL
          'composite-export-large',
          {
            method: 'tools/call',
            params: { name: 'sheets_composite', arguments: input },
          }
        );
        exportTaskId = task.taskId;
        await this.context.taskStore.updateTaskStatus(
          exportTaskId,
          'completed',
          `Exported ${result.stats.totalRows} rows`
        );
        logger.info('Task created for export_large_dataset', {
          taskId: exportTaskId,
          spreadsheetId: input.spreadsheetId,
        });
      }

      return {
        success: true as const,
        action: 'export_large_dataset' as const,
        format: input.format ?? 'json',
        chunkSize: input.chunkSize,
        totalRows: result.stats.totalRows,
        totalColumns: result.stats.totalColumns,
        chunksProcessed: result.stats.chunksProcessed,
        bytesProcessed: result.stats.bytesProcessed,
        durationMs: result.stats.durationMs,
        streamed: result.streamed,
        data: formattedData,
        ...(exportTaskId !== undefined ? { taskId: exportTaskId } : {}),
        _meta: this.generateMeta(
          'export_large_dataset',
          input as unknown as Record<string, unknown>,
          {
            totalRows: result.stats.totalRows,
            bytesProcessed: result.stats.bytesProcessed,
          } as Record<string, unknown>,
          {}
        ),
      };
    } catch (error) {
      logger.error('Large dataset export failed', { error, spreadsheetId: input.spreadsheetId });
      return this.mapError(error);
    }
  }

  // ============================================================================
  // F1: Natural Language Sheet Generator (3 actions)
  // ============================================================================

  private async handleGenerateSheet(
    input: CompositeGenerateSheetInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();
    logger.info('Generating sheet from description', {
      description: input.description.slice(0, 80),
    });

    await sendProgress(0, 3, 'Designing spreadsheet structure...');
    if (this.context.abortSignal?.aborted) {
      throw new Error('Operation cancelled by client');
    }

    const definition = await generateDefinition(
      input.description,
      {
        context: input.context,
        style: input.style,
        spreadsheetId: input.spreadsheetId,
        sheetName: input.sheetName,
      },
      this.context.samplingServer
    );

    if (input.safety?.dryRun) {
      return {
        success: true,
        action: 'generate_sheet',
        spreadsheetId: '',
        spreadsheetUrl: '',
        title: definition.title,
        sheetsCreated: definition.sheets.length,
        columnsCreated: definition.sheets.reduce((sum, s) => sum + s.columns.length, 0),
        rowsCreated: 0,
        formulasApplied: 0,
        formattingApplied: false,
        definition,
      };
    }

    await sendProgress(1, 3, 'Creating spreadsheet...');
    if (this.context.abortSignal?.aborted) {
      throw new Error('Operation cancelled by client');
    }

    const result = await executeDefinition(this.sheetsApi, definition, input.spreadsheetId);

    await sendProgress(3, 3, 'Complete');

    return {
      success: true,
      action: 'generate_sheet',
      ...result,
    };
  }

  private async handleGenerateTemplate(
    input: CompositeGenerateTemplateInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();
    logger.info('Generating template from description', {
      description: input.description.slice(0, 80),
    });

    const definition = await generateDefinition(
      input.description,
      { style: input.style },
      this.context.samplingServer
    );

    // Generate a template ID
    const templateId = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = definition.title;

    // If parameterize, replace sample values with placeholders
    if (input.parameterize) {
      for (const sheet of definition.sheets) {
        for (const col of sheet.columns) {
          if (col.type === 'text') {
            col.header = `{{${col.header.toLowerCase().replace(/\s+/g, '_')}}}`;
          }
        }
      }
    }

    const parameters = input.parameterize
      ? definition.sheets.flatMap((s) =>
          s.columns
            .filter((c) => c.header.startsWith('{{'))
            .map((c) => c.header.replace(/[{}]/g, ''))
        )
      : undefined;

    return {
      success: true,
      action: 'generate_template',
      templateId,
      name,
      sheetsCount: definition.sheets.length,
      columnsCount: definition.sheets.reduce((sum, s) => sum + s.columns.length, 0),
      parameters,
      definition,
    };
  }

  // ============================================================================
  // P14-C1: New Composite Workflow Handlers (5 actions)
  // ============================================================================

  /**
   * audit_sheet — Generate a comprehensive audit report for a spreadsheet.
   * Counts formulas, blanks, detects empty headers and mixed-type columns.
   */
  private async handleAuditSheet(
    input: CompositeAuditSheetInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();
    logger.info('Starting sheet audit', { spreadsheetId: input.spreadsheetId });

    // 1. Fetch sheet list
    const spreadsheetInfo = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });

    const allSheets = spreadsheetInfo.data.sheets ?? [];
    const sheetsToAudit = input.sheetName
      ? allSheets.filter((s) => s.properties?.title === input.sheetName)
      : allSheets;

    let totalCells = 0;
    let formulaCells = 0;
    let blankCells = 0;
    let dataCells = 0;
    const issues: Array<{ type: string; location: string; message: string }> = [];

    for (const sheet of sheetsToAudit) {
      const sheetTitle = sheet.properties?.title ?? 'Sheet';

      // 2. Fetch grid data for the sheet
      const valuesResponse = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: sheetTitle,
        valueRenderOption: 'FORMULA',
      });

      const rows = valuesResponse.data.values ?? [];
      if (rows.length === 0) continue;

      // 3. Analyze header row for empty headers
      const headers = (rows[0] as unknown[]).map((h) => String(h ?? ''));
      headers.forEach((header, colIdx) => {
        if (header.trim() === '') {
          const colLetter = String.fromCharCode(65 + colIdx);
          issues.push({
            type: 'empty_header',
            location: `${sheetTitle}!${colLetter}1`,
            message: `Column ${colLetter} has an empty header`,
          });
        }
      });

      // 4. Analyze column types for mixed-type detection
      const colTypes: Map<number, Set<string>> = new Map();

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx] as unknown[];
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const cellValue = row[colIdx];
          const colLetter = String.fromCharCode(65 + colIdx);
          const cellAddr = `${sheetTitle}!${colLetter}${rowIdx + 1}`;

          totalCells++;

          if (cellValue === null || cellValue === undefined || cellValue === '') {
            blankCells++;
          } else {
            const strVal = String(cellValue);
            if (input.includeFormulas !== false && strVal.startsWith('=')) {
              formulaCells++;
            } else {
              dataCells++;
            }

            // Track column type diversity (skip header row)
            if (rowIdx > 0) {
              if (!colTypes.has(colIdx)) colTypes.set(colIdx, new Set());
              const type = typeof cellValue === 'number' ? 'number' : 'string';
              colTypes.get(colIdx)!.add(type);
              if (colTypes.get(colIdx)!.size > 1) {
                // Mixed types detected — report once per column
                if (colTypes.get(colIdx)!.size === 2) {
                  issues.push({
                    type: 'mixed_types',
                    location: `${sheetTitle}!${colLetter}:${colLetter}`,
                    message: `Column "${headers[colIdx] ?? colLetter}" contains mixed data types (numbers and text)`,
                  });
                }
              }
            }
          }

          // Simple potential circular ref detection: formula referencing its own column's header
          if (input.includeFormulas !== false && String(cellValue).startsWith('=') && rowIdx > 0) {
            const formula = String(cellValue);
            const colLetter2 = String.fromCharCode(65 + colIdx);
            // If a formula in column X references the same row in column X (e.g., =A2 in A2)
            const selfRefPattern = new RegExp(`${colLetter2}${rowIdx + 1}(?![0-9])`, 'i');
            if (selfRefPattern.test(formula)) {
              issues.push({
                type: 'potential_circular_ref',
                location: cellAddr,
                message: `Formula at ${cellAddr} may reference itself: ${formula}`,
              });
            }
          }
        }
      }
    }

    return {
      success: true as const,
      action: 'audit_sheet' as const,
      audit: {
        totalCells,
        formulaCells,
        blankCells,
        dataCells, // non-blank, non-formula cells
        sheetsAudited: sheetsToAudit.length,
        issues,
      },
      _meta: this.generateMeta(
        'audit_sheet',
        input as unknown as Record<string, unknown>,
        { totalCells, formulaCells, sheetsAudited: sheetsToAudit.length } as Record<
          string,
          unknown
        >,
        {}
      ),
    };
  }

  /**
   * publish_report — Export a sheet/range as a formatted report (pdf, xlsx, csv).
   */
  private async handlePublishReport(
    input: CompositePublishReportInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();
    logger.info('Publishing report', { spreadsheetId: input.spreadsheetId, format: input.format });

    const generatedAt = new Date().toISOString();
    const title = input.title ?? `Report ${generatedAt.slice(0, 10)}`;
    const format = input.format ?? 'pdf';

    if (format === 'csv') {
      // Fetch values and convert to CSV
      const valuesResponse = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: input.range ?? 'Sheet1',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      const rows = valuesResponse.data.values ?? [];
      const csvContent = rows
        .map((row) =>
          (row as unknown[])
            .map((cell) => {
              const s = String(cell ?? '');
              if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
              }
              return s;
            })
            .join(',')
        )
        .join('\n');

      return {
        success: true as const,
        action: 'publish_report' as const,
        report: {
          format: 'csv' as const,
          title,
          generatedAt,
          content: csvContent,
          sizeBytes: Buffer.byteLength(csvContent, 'utf8'),
        },
        _meta: this.generateMeta(
          'publish_report',
          input as unknown as Record<string, unknown>,
          { format } as Record<string, unknown>,
          {}
        ),
      };
    }

    // For xlsx and pdf: use Drive API
    if (!this.driveApi) {
      return {
        success: false,
        error: {
          code: 'FEATURE_UNAVAILABLE',
          message:
            'Drive API not available for XLSX/PDF export. Ensure OAuth authentication is configured.',
          retryable: false,
        },
      };
    }

    if (format === 'xlsx') {
      const metaResponse = await this.driveApi.files.get({
        fileId: input.spreadsheetId,
        fields: 'name',
        supportsAllDrives: true,
      });
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
        action: 'publish_report' as const,
        report: {
          format: 'xlsx' as const,
          title: title ?? (metaResponse.data.name as string | undefined),
          generatedAt,
          content: base64Content,
          sizeBytes: buffer.length,
        },
        _meta: this.generateMeta(
          'publish_report',
          input as unknown as Record<string, unknown>,
          { format } as Record<string, unknown>,
          {}
        ),
      };
    }

    // PDF format
    const exportResponse = await this.driveApi.files.export(
      {
        fileId: input.spreadsheetId,
        mimeType: 'application/pdf',
      },
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(exportResponse.data as ArrayBuffer);
    const base64Content = buffer.toString('base64');

    return {
      success: true as const,
      action: 'publish_report' as const,
      report: {
        format: 'pdf' as const,
        title,
        generatedAt,
        content: base64Content,
        sizeBytes: buffer.length,
      },
      _meta: this.generateMeta(
        'publish_report',
        input as unknown as Record<string, unknown>,
        { format } as Record<string, unknown>,
        {}
      ),
    };
  }

  /**
   * data_pipeline — Execute a sequence of data transformation steps on a range.
   * Supports filter, sort, deduplicate, transform, aggregate steps.
   */
  private async handleDataPipeline(
    input: CompositeDataPipelineInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();
    logger.info('Running data pipeline', {
      spreadsheetId: input.spreadsheetId,
      steps: input.steps.length,
    });

    // 1. Fetch source data
    const valuesResponse = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.sourceRange,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rawRows = valuesResponse.data.values ?? [];
    if (rawRows.length === 0) {
      return {
        success: true as const,
        action: 'data_pipeline' as const,
        pipeline: { stepsExecuted: 0, rowsIn: 0, rowsOut: 0, preview: [] },
      };
    }

    const headers = (rawRows[0] as unknown[]).map((h) => String(h ?? ''));
    let dataRows: unknown[][] = (rawRows.slice(1) as unknown[][]).map((r) =>
      headers.map((_, i) => r[i] ?? null)
    );
    const rowsIn = dataRows.length;

    // 2. Execute each step
    let stepsExecuted = 0;
    for (const step of input.steps) {
      dataRows = this.applyPipelineStep(dataRows, headers, step);
      stepsExecuted++;
    }

    // 3. Build output (header + data rows)
    const outputRows: unknown[][] = [headers, ...dataRows];
    const preview = outputRows.slice(0, 5);

    // 4. Write if outputRange and not dryRun
    if (input.outputRange && !input.dryRun) {
      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range: input.outputRange,
        valueInputOption: 'RAW',
        requestBody: { values: outputRows as unknown[][] },
      });
    }

    return {
      success: true as const,
      action: 'data_pipeline' as const,
      pipeline: {
        stepsExecuted,
        rowsIn,
        rowsOut: dataRows.length,
        preview,
      },
      _meta: this.generateMeta(
        'data_pipeline',
        input as unknown as Record<string, unknown>,
        { rowsIn, rowsOut: dataRows.length, stepsExecuted } as Record<string, unknown>,
        {}
      ),
    };
  }

  /**
   * Apply a single pipeline transformation step to data rows.
   * @param rows - Current data rows (no header)
   * @param headers - Column header names
   * @param step - Transformation step
   */
  private applyPipelineStep(rows: unknown[][], headers: string[], step: PipelineStep): unknown[][] {
    const config = step.config as Record<string, unknown>;
    const colIdx = (colName: string): number => {
      const idx = headers.indexOf(String(colName));
      return idx >= 0 ? idx : parseInt(String(colName), 10);
    };

    switch (step.type) {
      case 'filter': {
        const col = colIdx(String(config['column'] ?? ''));
        const value = config['value'];
        const operator = String(config['operator'] ?? 'equals');
        return rows.filter((row) => {
          const cell = row[col];
          if (operator === 'contains') return String(cell ?? '').includes(String(value ?? ''));
          return String(cell ?? '') === String(value ?? '');
        });
      }
      case 'sort': {
        const col = colIdx(String(config['column'] ?? ''));
        const order = String(config['order'] ?? 'asc');
        return [...rows].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          const aNum = Number(av);
          const bNum = Number(bv);
          const aVal = isNaN(aNum) ? String(av ?? '') : aNum;
          const bVal = isNaN(bNum) ? String(bv ?? '') : bNum;
          if (aVal < bVal) return order === 'asc' ? -1 : 1;
          if (aVal > bVal) return order === 'asc' ? 1 : -1;
          return 0;
        });
      }
      case 'deduplicate': {
        const rawCols = config['columns'];
        const cols = Array.isArray(rawCols)
          ? (rawCols as unknown[]).map((c) => colIdx(String(c)))
          : [colIdx(String(config['column'] ?? ''))];
        const seen = new Set<string>();
        return rows.filter((row) => {
          const key = cols.map((c) => String(row[c] ?? '')).join('\x00');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      case 'transform': {
        const col = colIdx(String(config['column'] ?? ''));
        const formulaTemplate = String(config['formula'] ?? '');
        return rows.map((row) => {
          const newRow = [...row];
          const currentValue: unknown = row[col];
          let result = formulaTemplate;
          headers.forEach((header, i) => {
            result = result.replace(new RegExp(`\\{${header}\\}`, 'g'), String(row[i] ?? ''));
          });
          newRow[col] = result !== formulaTemplate ? result : currentValue;
          return newRow;
        });
      }
      case 'aggregate': {
        const groupByCol = colIdx(String(config['groupBy'] ?? ''));
        const aggCol = colIdx(String(config['column'] ?? ''));
        const aggregation = String(config['aggregation'] ?? 'sum');
        const groups = new Map<string, number[]>();
        for (const row of rows) {
          const key = String(row[groupByCol] ?? '');
          if (!groups.has(key)) groups.set(key, []);
          const num = Number(row[aggCol] ?? 0);
          if (!isNaN(num)) groups.get(key)!.push(num);
        }
        return Array.from(groups.entries()).map(([groupKey, values]) => {
          const newRow: unknown[] = headers.map(() => null);
          newRow[groupByCol] = groupKey;
          if (aggregation === 'sum') newRow[aggCol] = values.reduce((a, b) => a + b, 0);
          else if (aggregation === 'count') newRow[aggCol] = values.length;
          else if (aggregation === 'avg')
            newRow[aggCol] =
              values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          else if (aggregation === 'min') newRow[aggCol] = Math.min(...values);
          else if (aggregation === 'max') newRow[aggCol] = Math.max(...values);
          return newRow;
        });
      }
      default:
        return rows;
    }
  }

  /**
   * instantiate_template — Fetch a template spreadsheet and substitute {{variable}} placeholders.
   */
  private async handleInstantiateTemplate(
    input: CompositeInstantiateTemplateInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();
    logger.info('Instantiating template', { templateId: input.templateId });

    // 1. Load template content
    const templateSheetInfo = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.templateId,
      fields: 'sheets.properties(sheetId,title)',
    });

    const templateSheets = templateSheetInfo.data.sheets ?? [];
    const firstSheet = templateSheets[0];
    const templateSheetName = firstSheet?.properties?.title ?? 'Sheet1';

    const valuesResponse = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.templateId,
      range: input.targetSheetName ?? templateSheetName,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const templateRows = valuesResponse.data.values ?? [];

    // 2. Substitute {{variable}} placeholders
    let substitutionsApplied = 0;
    const substitutedRows = templateRows.map((row) =>
      (row as unknown[]).map((cell) => {
        if (typeof cell !== 'string') return cell;
        let result = cell;
        for (const [varName, varValue] of Object.entries(input.variables)) {
          const pattern = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
          const prev = result;
          result = result.replace(pattern, varValue);
          if (result !== prev) substitutionsApplied++;
        }
        return result;
      })
    );

    // 3. Determine target spreadsheet
    let targetSpreadsheetId = input.targetSpreadsheetId;
    let targetSheetName = input.targetSheetName ?? templateSheetName;

    if (!targetSpreadsheetId) {
      // Create a new spreadsheet
      const createResponse = await this.sheetsApi.spreadsheets.create({
        requestBody: {
          properties: { title: `${templateSheetName} (Instance)` },
          sheets: [{ properties: { title: targetSheetName } }],
        },
      });
      targetSpreadsheetId = createResponse.data.spreadsheetId!;
    }

    // 4. Write substituted data
    const cellsUpdated = substitutedRows.reduce((sum, row) => sum + row.length, 0);
    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range: `'${targetSheetName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: substitutedRows as unknown[][] },
    });

    return {
      success: true as const,
      action: 'instantiate_template' as const,
      instantiation: {
        spreadsheetId: targetSpreadsheetId,
        sheetName: targetSheetName,
        substitutionsApplied,
        cellsUpdated,
      },
      _meta: this.generateMeta(
        'instantiate_template',
        input as unknown as Record<string, unknown>,
        { substitutionsApplied, cellsUpdated } as Record<string, unknown>,
        {}
      ),
    };
  }

  /**
   * migrate_spreadsheet — Migrate data from one spreadsheet to another with column mapping.
   */
  private async handleMigrateSpreadsheet(
    input: CompositeMigrateSpreadsheetInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();
    logger.info('Migrating spreadsheet', {
      source: input.sourceSpreadsheetId,
      destination: input.destinationSpreadsheetId,
    });

    // 1. Fetch source data (with headers)
    const valuesResponse = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.sourceSpreadsheetId,
      range: input.sourceRange,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rawRows = valuesResponse.data.values ?? [];
    if (rawRows.length === 0) {
      return {
        success: true as const,
        action: 'migrate_spreadsheet' as const,
        migration: {
          rowsMigrated: 0,
          columnsMapped: input.columnMapping.length,
          destinationRange: input.destinationRange,
          preview: [],
        },
      };
    }

    const sourceHeaders = (rawRows[0] as unknown[]).map((h) => String(h ?? ''));
    const sourceDataRows = rawRows.slice(1) as unknown[][];

    // 2. Build destination column resolver
    const getSourceColIdx = (colName: string): number => {
      const byName = sourceHeaders.indexOf(colName);
      if (byName >= 0) return byName;
      const byIndex = parseInt(colName, 10);
      return isNaN(byIndex) ? -1 : byIndex;
    };

    // 3. Apply column mapping + transforms
    const destHeaders = input.columnMapping.map((m) => m.destinationColumn);
    const applyTransform = (value: unknown, transform: ColumnMapping['transform']): unknown => {
      if (value === null || value === undefined || value === '') return value;
      const s = String(value);
      switch (transform) {
        case 'uppercase':
          return s.toUpperCase();
        case 'lowercase':
          return s.toLowerCase();
        case 'number': {
          const n = parseFloat(s);
          return isNaN(n) ? value : n;
        }
        case 'date': {
          const d = new Date(s);
          return isNaN(d.getTime()) ? value : d.toISOString();
        }
        default:
          return value;
      }
    };

    const migratedRows = sourceDataRows.map((row) =>
      input.columnMapping.map((mapping) => {
        const srcIdx = getSourceColIdx(mapping.sourceColumn);
        const rawValue = srcIdx >= 0 ? row[srcIdx] : null;
        return applyTransform(rawValue, mapping.transform ?? 'none');
      })
    );

    // 4. Build output (header row + data rows)
    const outputRows: unknown[][] = [destHeaders, ...migratedRows];
    const preview = migratedRows.slice(0, 3);

    // 5. Write to destination if not dryRun
    if (!input.dryRun) {
      if (input.appendMode ?? true) {
        await this.sheetsApi.spreadsheets.values.append({
          spreadsheetId: input.destinationSpreadsheetId,
          range: input.destinationRange,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: migratedRows as unknown[][] },
        });
      } else {
        await this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: input.destinationSpreadsheetId,
          range: input.destinationRange,
          valueInputOption: 'RAW',
          requestBody: { values: outputRows as unknown[][] },
        });
      }
    }

    return {
      success: true as const,
      action: 'migrate_spreadsheet' as const,
      migration: {
        rowsMigrated: migratedRows.length,
        columnsMapped: input.columnMapping.length,
        destinationRange: input.destinationRange,
        preview,
      },
      _meta: this.generateMeta(
        'migrate_spreadsheet',
        input as unknown as Record<string, unknown>,
        { rowsMigrated: migratedRows.length, columnsMapped: input.columnMapping.length } as Record<
          string,
          unknown
        >,
        { cellsAffected: migratedRows.length * input.columnMapping.length }
      ),
    };
  }

  private async handlePreviewGeneration(
    input: CompositePreviewGenerationInput
  ): Promise<CompositeOutput['response']> {
    const logger = getRequestLogger();
    logger.info('Previewing generation', { description: input.description.slice(0, 80) });

    const definition = await generateDefinition(
      input.description,
      {
        context: input.context,
        style: input.style,
      },
      this.context.samplingServer
    );

    const estimatedCells = definition.sheets.reduce(
      (sum, s) => sum + s.columns.length * Math.max(s.rows?.length ?? 0, 10),
      0
    );
    const estimatedFormulas = definition.sheets.reduce(
      (sum, s) =>
        sum + s.columns.filter((c) => c.formula).length * Math.max(s.rows?.length ?? 0, 10),
      0
    );

    const formattingPreview: string[] = [];
    for (const sheet of definition.sheets) {
      if (sheet.formatting?.headerStyle) {
        formattingPreview.push(`${sheet.name}: Header style "${sheet.formatting.headerStyle}"`);
      }
      if (sheet.formatting?.freezeRows) {
        formattingPreview.push(`${sheet.name}: Freeze top ${sheet.formatting.freezeRows} row(s)`);
      }
      if (sheet.formatting?.alternatingRows) {
        formattingPreview.push(`${sheet.name}: Alternating row colors`);
      }
      if (sheet.formatting?.conditionalRules?.length) {
        formattingPreview.push(
          `${sheet.name}: ${sheet.formatting.conditionalRules.length} conditional formatting rule(s)`
        );
      }
      for (const col of sheet.columns) {
        if (col.type === 'currency' || col.type === 'percentage') {
          formattingPreview.push(`${sheet.name}: Column "${col.header}" formatted as ${col.type}`);
        }
      }
    }

    return {
      success: true,
      action: 'preview_generation',
      definition,
      estimatedCells,
      estimatedFormulas,
      formattingPreview,
    };
  }
}
