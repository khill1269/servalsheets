/**
 * ServalSheets - Templates Handler
 *
 * Handles sheets_templates tool (8 actions):
 * - list: List all saved templates
 * - get: Get template details
 * - create: Save spreadsheet as template
 * - apply: Create spreadsheet from template
 * - update: Update template definition
 * - delete: Delete template
 * - preview: Preview template structure
 * - import_builtin: Import from knowledge base
 *
 * Storage: Google Drive appDataFolder (hidden, user-specific)
 * Required scope: https://www.googleapis.com/auth/drive.appdata
 *
 * MCP Protocol: 2025-11-25
 */

import { ErrorCodes } from './error-codes.js';
import type { sheets_v4, drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsTemplatesInput,
  SheetsTemplatesOutput,
  TemplatesResponse,
  TemplatesRequest,
  TemplatesListInput,
  TemplatesGetInput,
  TemplatesCreateInput,
  TemplatesApplyInput,
  TemplatesUpdateInput,
  TemplatesDeleteInput,
  TemplatesPreviewInput,
  TemplatesImportBuiltinInput,
} from '../schemas/index.js';
import { TemplateStore } from '../services/template-store.js';
import { ScopeValidator, IncrementalScopeRequiredError } from '../security/incremental-scope.js';
import { handleList, handleGet, handlePreview } from './templates-actions/catalog.js';
import {
  handleCreate,
  handleApply,
  handleUpdate,
  handleDelete,
  handleImportBuiltin,
} from './templates-actions/operations.js';
import type { TemplatesHandlerAccess } from './templates-actions/internal.js';

export class SheetsTemplatesHandler extends BaseHandler<
  SheetsTemplatesInput,
  SheetsTemplatesOutput
> {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi: drive_v3.Drive;
  private templateStore: TemplateStore;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, driveApi: drive_v3.Drive) {
    super('sheets_templates', context);
    this.sheetsApi = sheetsApi;
    this.driveApi = driveApi;
    this.templateStore = new TemplateStore(driveApi);
  }

  async handle(input: SheetsTemplatesInput): Promise<SheetsTemplatesOutput> {
    // 1. Unwrap request from wrapper
    const rawReq = unwrapRequest<SheetsTemplatesInput['request']>(input);

    // 2. Require auth
    this.requireAuth();

    try {
      // 3. Dispatch to action handler
      const req = rawReq as TemplatesRequest & {
        verbosity?: 'minimal' | 'standard' | 'detailed';
      };
      const verbosity = req.verbosity ?? 'standard';
      const h = this.buildHandlerAccess();
      let response: TemplatesResponse;

      switch (req.action) {
        case 'list':
          response = await handleList(h, req as TemplatesListInput);
          break;
        case 'get':
          response = await handleGet(h, req as TemplatesGetInput);
          break;
        case 'create':
          response = await handleCreate(h, req as TemplatesCreateInput);
          break;
        case 'apply':
          response = await handleApply(h, req as TemplatesApplyInput);
          break;
        case 'update':
          response = await handleUpdate(h, req as TemplatesUpdateInput);
          break;
        case 'delete':
          response = await handleDelete(h, req as TemplatesDeleteInput);
          break;
        case 'preview':
          response = await handlePreview(h, req as TemplatesPreviewInput);
          break;
        case 'import_builtin':
          response = await handleImportBuiltin(h, req as TemplatesImportBuiltinInput);
          break;
        default: {
          const _exhaustiveCheck: never = req;
          response = this.error({
            code: ErrorCodes.INVALID_PARAMS,
            message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
        }
      }

      // 4. Apply verbosity filtering (LLM optimization)
      const filteredResponse = super.applyVerbosityFilter(response, verbosity);

      // 5. Return wrapped response
      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  // Required by BaseHandler
  protected createIntents(_input: SheetsTemplatesInput): Intent[] {
    return []; // Templates don't use batch compiler
  }

  /**
   * Validate scopes for an operation.
   * Must remain on the class — references this.context.auth.scopes.
   */
  private validateScopes(operation: string): TemplatesResponse | null {
    const validator = new ScopeValidator({
      scopes: this.context.auth?.scopes ?? [],
    });

    try {
      validator.validateOperation(operation);
      return null; // Scopes are valid
    } catch (error) {
      if (error instanceof IncrementalScopeRequiredError) {
        return this.error({
          code: ErrorCodes.INCREMENTAL_SCOPE_REQUIRED,
          message: error.message,
          category: 'auth',
          retryable: true,
          suggestedFix: 'Grant the required permissions when prompted',
          details: {
            operation: error.operation,
            requiredScopes: error.requiredScopes,
            currentScopes: error.currentScopes,
            missingScopes: error.missingScopes,
            authorizationUrl: error.authorizationUrl,
          },
        });
      }
      throw error; // Re-throw non-scope errors
    }
  }

  /**
   * Build a TemplatesHandlerAccess facade that exposes handler resources
   * to submodule functions without passing `this` directly.
   */
  private buildHandlerAccess(): TemplatesHandlerAccess {
    return {
      sheetsApi: this.sheetsApi,
      driveApi: this.driveApi,
      templateStore: this.templateStore,
      validateScopes: (op) => this.validateScopes(op),
      success: (action, data) => this.success(action, data),
      error: (params) => this.error(params) as TemplatesResponse,
      sendProgress: (current, total, msg) => this.sendProgress(current, total, msg),
      letterToColumn: (letter) => this.letterToColumn(letter),
    };
  }
}
