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
  TemplateSheet,
} from '../schemas/index.js';
import { TemplateStore } from '../services/template-store.js';
import { logger } from '../utils/logger.js';
import { ScopeValidator, IncrementalScopeRequiredError } from '../security/incremental-scope.js';

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
      let response: TemplatesResponse;

      switch (req.action) {
        case 'list':
          response = await this.handleList(req as TemplatesListInput);
          break;
        case 'get':
          response = await this.handleGet(req as TemplatesGetInput);
          break;
        case 'create':
          response = await this.handleCreate(req as TemplatesCreateInput);
          break;
        case 'apply':
          response = await this.handleApply(req as TemplatesApplyInput);
          break;
        case 'update':
          response = await this.handleUpdate(req as TemplatesUpdateInput);
          break;
        case 'delete':
          response = await this.handleDelete(req as TemplatesDeleteInput);
          break;
        case 'preview':
          response = await this.handlePreview(req as TemplatesPreviewInput);
          break;
        case 'import_builtin':
          response = await this.handleImportBuiltin(req as TemplatesImportBuiltinInput);
          break;
        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
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
   * Validate scopes for an operation
   * Returns error response if scopes are insufficient, null if valid
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
          code: 'INCREMENTAL_SCOPE_REQUIRED',
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
   * List all templates
   */
  private async handleList(req: TemplatesListInput): Promise<TemplatesResponse> {
    // Validate scopes before Drive API access
    const scopeError = this.validateScopes('sheets_templates.list');
    if (scopeError) return scopeError;

    try {
      const userTemplates = await this.templateStore.list(req.category);

      let builtinTemplates: Array<{
        id: string;
        name: string;
        description?: string;
        category?: string;
        sheetCount: number;
      }> = [];

      if (req.includeBuiltin) {
        const builtins = await this.templateStore.listBuiltinTemplates();
        builtinTemplates = builtins.map((b) => ({
          id: `builtin:${b.id}`,
          name: b.name,
          description: b.description,
          category: b.category,
          sheetCount: b.sheets.length,
        }));
      }

      const allTemplates = [...userTemplates, ...builtinTemplates];

      return this.success('list', {
        templates: allTemplates,
        totalTemplates: allTemplates.length,
        builtinCount: builtinTemplates.length,
      });
    } catch (error) {
      logger.error('Failed to list templates', { error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to list templates: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  /**
   * Get template details
   */
  private async handleGet(req: TemplatesGetInput): Promise<TemplatesResponse> {
    // Validate scopes before Drive API access (only for user templates)
    if (!req.templateId.startsWith('builtin:')) {
      const scopeError = this.validateScopes('sheets_templates.get');
      if (scopeError) return scopeError;
    }

    try {
      // Check if it's a builtin template
      if (req.templateId.startsWith('builtin:')) {
        const builtinId = req.templateId.replace('builtin:', '');
        const builtin = await this.templateStore.getBuiltinTemplate(builtinId);
        if (!builtin) {
          return this.error({
            code: 'NOT_FOUND',
            message: `Builtin template not found: ${builtinId}`,
            retryable: false,
            suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
          });
        }
        return this.success('get', {
          template: {
            id: req.templateId,
            name: builtin.name,
            description: builtin.description,
            category: builtin.category,
            version: '1.0.0',
            sheets: builtin.sheets,
          },
        });
      }

      const template = await this.templateStore.get(req.templateId);
      if (!template) {
        return this.error({
          code: 'NOT_FOUND',
          message: `Template not found: ${req.templateId}`,
          retryable: false,
          suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
        });
      }

      return this.success('get', { template });
    } catch (error) {
      logger.error('Failed to get template', { templateId: req.templateId, error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to get template: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  /**
   * Create template from spreadsheet
   */
  private async handleCreate(req: TemplatesCreateInput): Promise<TemplatesResponse> {
    // Validate scopes before Drive API access (CRITICAL - write operation)
    const scopeError = this.validateScopes('sheets_templates.create');
    if (scopeError) return scopeError;

    try {
      // Get spreadsheet metadata
      const spreadsheet = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: req.spreadsheetId,
        includeGridData: req.includeData ?? false,
        fields: req.includeData ? 'sheets(properties,data)' : 'sheets(properties)',
      });

      const sheets = spreadsheet.data.sheets || [];
      const templateSheets: TemplateSheet[] = sheets.map((sheet) => ({
        name: sheet.properties?.title || 'Sheet',
        rowCount: sheet.properties?.gridProperties?.rowCount || 1000,
        columnCount: sheet.properties?.gridProperties?.columnCount || 26,
        frozenRowCount: sheet.properties?.gridProperties?.frozenRowCount ?? undefined,
        frozenColumnCount: sheet.properties?.gridProperties?.frozenColumnCount ?? undefined,
        // Extract headers from first row if data is included
        headers:
          req.includeData && sheet.data?.[0]?.rowData?.[0]?.values
            ? sheet.data[0].rowData[0].values
                .map((cell) => cell.formattedValue || '')
                .filter((v) => v)
            : undefined,
      }));

      const template = await this.templateStore.create({
        name: req.name,
        description: req.description,
        category: req.category,
        version: '1.0.0',
        sheets: templateSheets,
      });

      return this.success('create', { template });
    } catch (error) {
      logger.error('Failed to create template', { spreadsheetId: req.spreadsheetId, error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to create template: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  /**
   * Apply template to create new spreadsheet
   */
  private async handleApply(req: TemplatesApplyInput): Promise<TemplatesResponse> {
    // Validate scopes before Drive API access (only for user templates)
    if (!req.templateId.startsWith('builtin:')) {
      const scopeError = this.validateScopes('sheets_templates.apply');
      if (scopeError) return scopeError;
    }

    try {
      // Get template (user or builtin)
      let templateData: {
        sheets: TemplateSheet[];
        namedRanges?: Array<{ name: string; range: string }>;
      };

      if (req.templateId.startsWith('builtin:')) {
        const builtinId = req.templateId.replace('builtin:', '');
        const builtin = await this.templateStore.getBuiltinTemplate(builtinId);
        if (!builtin) {
          return this.error({
            code: 'NOT_FOUND',
            message: `Builtin template not found: ${builtinId}`,
            retryable: false,
            suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
          });
        }
        templateData = { sheets: builtin.sheets };
      } else {
        const template = await this.templateStore.get(req.templateId);
        if (!template) {
          return this.error({
            code: 'NOT_FOUND',
            message: `Template not found: ${req.templateId}`,
            retryable: false,
            suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
          });
        }
        templateData = template;
      }

      // Build spreadsheet create request
      const createRequest: sheets_v4.Schema$Spreadsheet = {
        properties: {
          title: req.title,
        },
        sheets: templateData.sheets.map((sheet, index) => ({
          properties: {
            sheetId: index,
            title: sheet.name,
            gridProperties: {
              rowCount: sheet.rowCount || 1000,
              columnCount: sheet.columnCount || 26,
              frozenRowCount: sheet.frozenRowCount,
              frozenColumnCount: sheet.frozenColumnCount,
            },
          },
        })),
      };

      // Create spreadsheet
      const response = await this.sheetsApi.spreadsheets.create({
        requestBody: createRequest,
        // Field mask reduces response payload - only return fields we actually use
        fields: 'spreadsheetId,spreadsheetUrl,sheets(properties(sheetId,title))',
      });

      // Validate response data before using
      if (!response.data.spreadsheetId || !response.data.spreadsheetUrl) {
        return this.error({
          code: 'INTERNAL_ERROR',
          message: 'Sheets API returned incomplete data after creating spreadsheet',
          details: {
            templateId: req.templateId,
            title: req.title,
            hasSpreadsheetId: !!response.data.spreadsheetId,
            hasSpreadsheetUrl: !!response.data.spreadsheetUrl,
          },
          retryable: true,
          suggestedFix: 'Please try again. If the issue persists, contact support',
          resolution: 'Retry the operation. If the issue persists, check Google Sheets API status.',
        });
      }

      const spreadsheetId = response.data.spreadsheetId;
      const spreadsheetUrl = response.data.spreadsheetUrl;

      // Apply headers if defined
      const requests: sheets_v4.Schema$Request[] = [];
      for (let i = 0; i < templateData.sheets.length; i++) {
        const sheet = templateData.sheets[i];
        if (!sheet) continue;

        if (sheet.headers && sheet.headers.length > 0) {
          requests.push({
            updateCells: {
              rows: [
                {
                  values: sheet.headers.map((header) => ({
                    userEnteredValue: { stringValue: header },
                    userEnteredFormat: { textFormat: { bold: true } },
                  })),
                },
              ],
              fields: 'userEnteredValue,userEnteredFormat.textFormat.bold',
              start: {
                sheetId: i,
                rowIndex: 0,
                columnIndex: 0,
              },
            },
          });
        }

        // Apply column widths if defined
        if (sheet.columnWidths) {
          for (let col = 0; col < sheet.columnWidths.length; col++) {
            const width = sheet.columnWidths[col];
            if (width === undefined) continue;
            requests.push({
              updateDimensionProperties: {
                range: {
                  sheetId: i,
                  dimension: 'COLUMNS',
                  startIndex: col,
                  endIndex: col + 1,
                },
                properties: {
                  pixelSize: width,
                },
                fields: 'pixelSize',
              },
            });
          }
        }
      }

      // Add named ranges if defined
      if (templateData.namedRanges) {
        for (const namedRange of templateData.namedRanges) {
          requests.push({
            addNamedRange: {
              namedRange: {
                name: namedRange.name,
                range: this.parseA1Range(namedRange.range, response.data.sheets || []),
              },
            },
          });
        }
      }

      // Apply batch updates if any
      if (requests.length > 0) {
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests },
        });
      }

      // Move to folder if specified
      if (req.folderId) {
        try {
          await this.driveApi.files.update({
            fileId: spreadsheetId,
            addParents: req.folderId,
            fields: 'id',
            supportsAllDrives: true,
          });
        } catch (moveError) {
          logger.warn('Failed to move spreadsheet to folder', {
            folderId: req.folderId,
            error: moveError,
          });
          // Don't fail the whole operation for this
        }
      }

      logger.info('Applied template', {
        templateId: req.templateId,
        spreadsheetId,
        title: req.title,
      });

      return this.success('apply', {
        spreadsheetId,
        spreadsheetUrl,
      });
    } catch (error) {
      logger.error('Failed to apply template', { templateId: req.templateId, error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to apply template: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  /**
   * Update template
   */
  private async handleUpdate(req: TemplatesUpdateInput): Promise<TemplatesResponse> {
    // Validate scopes before Drive API access
    const scopeError = this.validateScopes('sheets_templates.update');
    if (scopeError) return scopeError;

    try {
      if (req.templateId.startsWith('builtin:')) {
        return this.error({
          code: 'INVALID_REQUEST',
          message: 'Cannot update builtin templates. Use import_builtin first.',
          retryable: false,
          suggestedFix: 'Verify the request format is correct',
        });
      }

      const template = await this.templateStore.update(req.templateId, {
        name: req.name,
        description: req.description,
        category: req.category,
        sheets: req.sheets,
        namedRanges: req.namedRanges,
        metadata: req.metadata,
      });

      return this.success('update', { template });
    } catch (error) {
      logger.error('Failed to update template', { templateId: req.templateId, error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to update template: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  /**
   * Delete template
   */
  private async handleDelete(req: TemplatesDeleteInput): Promise<TemplatesResponse> {
    // Validate scopes before Drive API access
    const scopeError = this.validateScopes('sheets_templates.delete');
    if (scopeError) return scopeError;

    try {
      if (req.templateId.startsWith('builtin:')) {
        return this.error({
          code: 'INVALID_REQUEST',
          message: 'Cannot delete builtin templates.',
          retryable: false,
          suggestedFix: 'Verify the request format is correct',
        });
      }

      const deleted = await this.templateStore.delete(req.templateId);

      return this.success('delete', { deleted });
    } catch (error) {
      logger.error('Failed to delete template', { templateId: req.templateId, error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to delete template: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  /**
   * Preview template structure
   */
  private async handlePreview(req: TemplatesPreviewInput): Promise<TemplatesResponse> {
    // Validate scopes before Drive API access (only for user templates)
    if (!req.templateId.startsWith('builtin:')) {
      const scopeError = this.validateScopes('sheets_templates.preview');
      if (scopeError) return scopeError;
    }

    try {
      // Get template (user or builtin)
      let templateData: {
        name: string;
        description?: string;
        sheets: TemplateSheet[];
        namedRanges?: Array<{ name: string; range: string }>;
      };

      if (req.templateId.startsWith('builtin:')) {
        const builtinId = req.templateId.replace('builtin:', '');
        const builtin = await this.templateStore.getBuiltinTemplate(builtinId);
        if (!builtin) {
          return this.error({
            code: 'NOT_FOUND',
            message: `Builtin template not found: ${builtinId}`,
            retryable: false,
            suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
          });
        }
        templateData = {
          name: builtin.name,
          description: builtin.description,
          sheets: builtin.sheets,
        };
      } else {
        const template = await this.templateStore.get(req.templateId);
        if (!template) {
          return this.error({
            code: 'NOT_FOUND',
            message: `Template not found: ${req.templateId}`,
            retryable: false,
            suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
          });
        }
        templateData = template;
      }

      return this.success('preview', {
        preview: {
          name: templateData.name,
          description: templateData.description,
          sheets: templateData.sheets.map((s) => ({
            name: s.name,
            headers: s.headers,
            rowCount: s.rowCount,
            columnCount: s.columnCount,
          })),
          namedRanges: templateData.namedRanges?.map((nr) => nr.name),
        },
      });
    } catch (error) {
      logger.error('Failed to preview template', { templateId: req.templateId, error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to preview template: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  /**
   * Import builtin template to user's collection
   */
  private async handleImportBuiltin(req: TemplatesImportBuiltinInput): Promise<TemplatesResponse> {
    // Validate scopes before Drive API access (imports to user's Drive)
    const scopeError = this.validateScopes('sheets_templates.import_builtin');
    if (scopeError) return scopeError;

    try {
      const builtin = await this.templateStore.getBuiltinTemplate(req.builtinName);
      if (!builtin) {
        return this.error({
          code: 'NOT_FOUND',
          message: `Builtin template not found: ${req.builtinName}`,
          retryable: false,
          suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
        });
      }

      const template = await this.templateStore.create({
        name: req.customName || builtin.name,
        description: builtin.description,
        category: builtin.category,
        version: '1.0.0',
        sheets: builtin.sheets,
      });

      return this.success('import_builtin', {
        template,
        importedTemplateId: template.id,
      });
    } catch (error) {
      logger.error('Failed to import builtin template', { builtinName: req.builtinName, error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Failed to import builtin template: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  /**
   * Parse A1 notation range to GridRange
   */
  private parseA1Range(
    a1Range: string,
    sheets: sheets_v4.Schema$Sheet[]
  ): sheets_v4.Schema$GridRange {
    // Simple parser - handles "Sheet1!A1:B10" format
    const match = a1Range.match(/^(.+?)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
    if (!match) {
      logger.debug(`Invalid A1 range format: ${a1Range}`);
      return {}; // OK: Explicit empty for invalid format (caller handles gracefully)
    }

    const [, sheetName, startCol, startRow, endCol, endRow] = match;

    // Validate all captured groups exist
    if (!sheetName || !startCol || !startRow || !endCol || !endRow) {
      logger.debug(`Incomplete A1 range components: ${a1Range}`);
      return {}; // OK: Explicit empty for invalid format (caller handles gracefully)
    }

    const sheet = sheets.find((s) => s.properties?.title === sheetName);
    const sheetId = sheet?.properties?.sheetId ?? 0;

    return {
      sheetId,
      startRowIndex: parseInt(startRow, 10) - 1,
      endRowIndex: parseInt(endRow, 10),
      startColumnIndex: this.letterToColumn(startCol.toUpperCase()),
      endColumnIndex: this.letterToColumn(endCol.toUpperCase()) + 1,
    };
  }
}
