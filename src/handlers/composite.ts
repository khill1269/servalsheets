/**
 * ServalSheets - Composite Operations Handler
 *
 * Handles high-level composite operations.
 * 21 Actions:
 * - Core Data (4): import_csv, smart_append, bulk_update, deduplicate
 * - Import/Export (3): export_xlsx, import_xlsx, get_form_responses
 * - LLM-Optimized Workflows (3): setup_sheet, import_and_format, clone_structure
 * - Streaming (1): export_large_dataset
 * - NL Sheet Generator (3): generate_sheet, generate_template, preview_generation
 * - P14-C1 Composite Workflows (5): audit_sheet, publish_report, data_pipeline, instantiate_template, migrate_spreadsheet
 * - Orchestration (1): batch_operations
 * - Dashboard (1): build_dashboard
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 *
 * Action implementations decomposed into composite-actions/ submodules.
 *
 * @module handlers/composite
 */

import { ErrorCodes } from './error-codes.js';
import { assertNever } from '../utils/type-utils.js';
import type { sheets_v4, drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext, type HandlerError, unwrapRequest } from './base.js';
import { getRequestAbortSignal } from '../utils/request-context.js';
import {
  CompositeOperationsService,
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
  CompositeSetupSheetInput,
  CompositeImportAndFormatInput,
  CompositeCloneStructureInput,
  CompositeExportLargeDatasetInput,
  CompositeGenerateSheetInput,
  CompositeGenerateTemplateInput,
  CompositePreviewGenerationInput,
  CompositeAuditSheetInput,
  CompositePublishReportInput,
  CompositeDataPipelineInput,
  CompositeInstantiateTemplateInput,
  CompositeMigrateSpreadsheetInput,
  CompositeBatchOperationsInput,
  CompositeBuildDashboardInput,
} from '../schemas/composite.js';
import type { Intent } from '../core/intent.js';
import { getRequestLogger } from '../utils/request-context.js';
import { ScopeValidator, IncrementalScopeRequiredError } from '../security/incremental-scope.js';
import type { CompositeHandlerAccess } from './composite-actions/internal.js';

// Submodule imports
import {
  handleImportCsvAction,
  handleSmartAppendAction,
  handleBulkUpdateAction,
  handleDeduplicateAction,
} from './composite-actions/data-operations.js';
import {
  handleExportXlsxAction,
  handleImportXlsxAction,
  handleGetFormResponsesAction,
} from './composite-actions/import-export.js';
import {
  handleSetupSheetAction,
  handleImportAndFormatAction,
  handleCloneStructureAction,
} from './composite-actions/structure.js';
import {
  handleAuditSheetAction,
  handlePublishReportAction,
  handleDataPipelineAction,
  handleInstantiateTemplateAction,
  handleMigrateSpreadsheetAction,
} from './composite-actions/workflow.js';
import { handleBatchOperationsAction } from './composite-actions/batch.js';
import { handleExportLargeDatasetAction } from './composite-actions/streaming.js';
import {
  handleGenerateSheetAction,
  handleGenerateTemplateAction,
  handlePreviewGenerationAction,
} from './composite-actions/generation.js';
import { handleBuildDashboardAction } from './composite-actions/dashboard.js';
import { ensureRetriableGoogleApi } from '../utils/google-api-retry-wrapper.js';

// ============================================================================
// Handler
// ============================================================================

/**
 * Composite Operations Handler (thin dispatch)
 *
 * Provides high-level operations that combine multiple API calls.
 * Delegates all action implementations to composite-actions submodules.
 */
export class CompositeHandler extends BaseHandler<CompositeInput, CompositeOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi: drive_v3.Drive | undefined;
  private compositeService: CompositeOperationsService;
  private sheetResolver: SheetResolver;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, driveApi?: drive_v3.Drive) {
    super('sheets_composite', context);
    this.sheetsApi = ensureRetriableGoogleApi(sheetsApi) as sheets_v4.Sheets;
    this.driveApi = ensureRetriableGoogleApi(driveApi) as drive_v3.Drive | undefined;

    // Initialize sheet resolver
    this.sheetResolver = initializeSheetResolver(this.sheetsApi);

    // Initialize composite operations service
    this.compositeService = new CompositeOperationsService(this.sheetsApi, this.sheetResolver);
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
            code: ErrorCodes.INCREMENTAL_SCOPE_REQUIRED,
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

  /**
   * Build the CompositeHandlerAccess object for submodule functions.
   */
  private buildHandlerAccess(): CompositeHandlerAccess {
    return {
      context: this.context,
      sheetsApi: this.sheetsApi,
      driveApi: this.driveApi,
      compositeService: this.compositeService,
      sheetResolver: this.sheetResolver,
      success: (action, data, mutation) => this.success(action, data, mutation),
      error: (error) => this.error(error),
      mapError: (e) => this.mapError(e),
      sendProgress: (current, total, message) => this.sendProgress(current, total, message),
      generateMeta: (action, input, output, options) =>
        this.generateMeta(action, input, output, options),
    };
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
      const requestAbortSignal = getRequestAbortSignal() ?? this.context.abortSignal;
      const access = this.buildHandlerAccess();

      switch (req.action) {
        // Core data operations (4)
        case 'import_csv':
          response = await handleImportCsvAction(req as CompositeImportCsvInput, access);
          break;
        case 'smart_append':
          response = await handleSmartAppendAction(req as CompositeSmartAppendInput, access);
          break;
        case 'bulk_update':
          response = await handleBulkUpdateAction(req as CompositeBulkUpdateInput, access);
          break;
        case 'deduplicate':
          response = await handleDeduplicateAction(req as CompositeDeduplicateInput, access);
          break;

        // Import/Export (3)
        case 'export_xlsx':
          response = await handleExportXlsxAction(req as CompositeExportXlsxInput, {
            sheetsApi: this.sheetsApi,
            driveApi: this.driveApi,
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
            error: (error) => this.error(error),
          });
          break;
        case 'import_xlsx':
          response = await handleImportXlsxAction(req as CompositeImportXlsxInput, {
            sheetsApi: this.sheetsApi,
            driveApi: this.driveApi,
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
            error: (error) => this.error(error),
          });
          break;
        case 'get_form_responses':
          response = await handleGetFormResponsesAction(req as CompositeGetFormResponsesInput, {
            sheetsApi: this.sheetsApi,
            driveApi: this.driveApi,
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
            error: (error) => this.error(error),
          });
          break;

        // LLM-optimized workflow actions (3)
        case 'setup_sheet':
          response = await handleSetupSheetAction(req as CompositeSetupSheetInput, {
            sheetsApi: this.sheetsApi,
            invalidateSheetCache: (spreadsheetId) =>
              this.context.sheetResolver?.invalidate(spreadsheetId),
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
          });
          break;
        case 'import_and_format':
          response = await handleImportAndFormatAction(req as CompositeImportAndFormatInput, {
            sheetsApi: this.sheetsApi,
            compositeService: this.compositeService,
            invalidateSheetCache: (spreadsheetId) =>
              this.context.sheetResolver?.invalidate(spreadsheetId),
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
          });
          break;
        case 'clone_structure':
          response = await handleCloneStructureAction(req as CompositeCloneStructureInput, {
            sheetsApi: this.sheetsApi,
            sheetResolver: this.sheetResolver,
            invalidateSheetCache: (spreadsheetId) =>
              this.context.sheetResolver?.invalidate(spreadsheetId),
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
          });
          break;

        // Streaming (1)
        case 'export_large_dataset':
          response = await handleExportLargeDatasetAction(req as CompositeExportLargeDatasetInput, {
            sheetsApi: this.sheetsApi,
            taskStore: this.context.taskStore,
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
            mapError: (error) => this.mapError(error),
          });
          break;

        // NL Sheet Generator (3)
        case 'generate_sheet':
          response = await handleGenerateSheetAction(req as CompositeGenerateSheetInput, {
            sheetsApi: this.sheetsApi,
            samplingServer: this.context.samplingServer,
            abortSignal: requestAbortSignal,
          });
          break;
        case 'generate_template':
          response = await handleGenerateTemplateAction(req as CompositeGenerateTemplateInput, {
            sheetsApi: this.sheetsApi,
            samplingServer: this.context.samplingServer,
            abortSignal: requestAbortSignal,
          });
          break;
        case 'preview_generation':
          response = await handlePreviewGenerationAction(req as CompositePreviewGenerationInput, {
            sheetsApi: this.sheetsApi,
            samplingServer: this.context.samplingServer,
            abortSignal: requestAbortSignal,
          });
          break;

        // P14-C1 Composite Workflow actions (5)
        case 'audit_sheet':
          response = await handleAuditSheetAction(req as CompositeAuditSheetInput, {
            sheetsApi: this.sheetsApi,
            samplingServer: this.context.samplingServer,
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
          });
          break;
        case 'publish_report':
          response = await handlePublishReportAction(req as CompositePublishReportInput, {
            sheetsApi: this.sheetsApi,
            driveApi: this.driveApi,
            samplingServer: this.context.samplingServer,
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
          });
          break;
        case 'data_pipeline':
          response = await handleDataPipelineAction(req as CompositeDataPipelineInput, {
            sheetsApi: this.sheetsApi,
            samplingServer: this.context.samplingServer,
            snapshotService: this.context.snapshotService,
            sessionContext: this.context.sessionContext,
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
          });
          break;
        case 'instantiate_template':
          response = await handleInstantiateTemplateAction(
            req as CompositeInstantiateTemplateInput,
            {
              sheetsApi: this.sheetsApi,
              snapshotService: this.context.snapshotService,
              sessionContext: this.context.sessionContext,
              generateMeta: (action, i, output, options) =>
                this.generateMeta(action, i, output, options),
            }
          );
          break;
        case 'migrate_spreadsheet':
          response = await handleMigrateSpreadsheetAction(req as CompositeMigrateSpreadsheetInput, {
            sheetsApi: this.sheetsApi,
            snapshotService: this.context.snapshotService,
            sessionContext: this.context.sessionContext,
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
          });
          break;

        // Orchestration (1)
        case 'batch_operations':
          response = await handleBatchOperationsAction(req as CompositeBatchOperationsInput, {
            context: this.context,
            sheetsApi: this.sheetsApi,
            driveApi: this.driveApi,
            sendProgress: (current: number, total: number, message?: string) =>
              this.sendProgress(current, total, message),
            generateMeta: (action, i, output, options) =>
              this.generateMeta(action, i, output, options),
          });
          break;

        // Dashboard (1)
        case 'build_dashboard':
          response = await handleBuildDashboardAction(req as CompositeBuildDashboardInput, access);
          break;

        default:
          assertNever(req);
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
}
