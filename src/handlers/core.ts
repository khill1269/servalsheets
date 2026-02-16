/**
 * ServalSheets - Core Handler (Consolidated)
 *
 * Handles sheets_core tool (15 actions total):
 * - Spreadsheet operations (8): get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list
 * - Sheet/tab operations (7): add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet
 *
 * Consolidates legacy sheets_spreadsheet + sheets_sheet handlers
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4, drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsCoreInput,
  SheetsCoreOutput,
  SheetInfo,
  CoreResponse,
  CoreRequest,
  CoreGetInput,
  CoreCreateInput,
  CoreCopyInput,
  CoreUpdatePropertiesInput,
  CoreGetUrlInput,
  CoreBatchGetInput,
  CoreGetComprehensiveInput,
  CoreListInput,
  CoreAddSheetInput,
  CoreDeleteSheetInput,
  CoreDuplicateSheetInput,
  CoreUpdateSheetInput,
  CoreCopySheetToInput,
  CoreListSheetsInput,
  CoreGetSheetInput,
  CoreBatchDeleteSheetsInput,
  CoreBatchUpdateSheetsInput,
  CoreClearSheetInput,
  CoreMoveSheetInput,
} from '../schemas/index.js';
import { cacheManager, createCacheKey } from '../utils/cache-manager.js';
import { CACHE_TTL_SPREADSHEET } from '../config/constants.js';
import { ScopeValidator, IncrementalScopeRequiredError } from '../security/incremental-scope.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
import { createNotFoundError, createValidationError } from '../utils/error-factory.js';

export class SheetsCoreHandler extends BaseHandler<SheetsCoreInput, SheetsCoreOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, driveApi?: drive_v3.Drive) {
    super('sheets_core', context);
    this.sheetsApi = sheetsApi;
    this.driveApi = driveApi;
  }

  /**
   * Validate scopes for an operation
   * Returns error response if scopes are insufficient, null if valid
   */
  private validateScopes(operation: string): SheetsCoreOutput | null {
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

  /**
   * Encode sheet-level pagination state to cursor (Phase 1.2: get_comprehensive pagination)
   */
  private encodeSheetPaginationCursor(state: { sheetIndex: number; maxSheets: number }): string {
    return Buffer.from(JSON.stringify(state)).toString('base64');
  }

  /**
   * Decode sheet-level pagination cursor to state (Phase 1.2: get_comprehensive pagination)
   */
  private decodeSheetPaginationCursor(
    cursor?: string
  ): { sheetIndex: number; maxSheets: number } | null {
    if (!cursor) return null;
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const state = JSON.parse(decoded);
      // Validate state structure
      if (typeof state.sheetIndex !== 'number' || typeof state.maxSheets !== 'number') {
        return null;
      }
      return state;
    } catch (err) {
      this.context.logger?.warn?.('Failed to decode pagination cursor', { error: String(err) });
      return null;
    }
  }

  async handle(input: SheetsCoreInput): Promise<SheetsCoreOutput> {
    // Extract the request from the wrapper
    const rawReq = unwrapRequest<SheetsCoreInput['request']>(input);
    this.requireAuth();

    // Track spreadsheet ID for better error messages
    const spreadsheetId = 'spreadsheetId' in rawReq ? rawReq.spreadsheetId : undefined;
    this.trackSpreadsheetId(spreadsheetId);

    try {
      // Infer missing parameters from context
      const req = this.inferRequestParameters(rawReq) as CoreRequest;

      // Phase 0: Validate scopes for the operation
      const operation = `sheets_core.${req.action}`;
      const scopeError = this.validateScopes(operation);
      if (scopeError) {
        return scopeError;
      }

      // Set verbosity early to skip metadata generation for minimal mode (saves ~400-800 tokens)
      const verbosity = req.verbosity ?? 'standard';
      this.setVerbosity(verbosity);

      let response: CoreResponse;
      // Cast to string to allow handler-level aliases (rename_sheet, hide_sheet, etc.)
      // These aliases are intentionally more permissive than the schema
      switch (req.action as string) {
        // Spreadsheet actions (8)
        case 'get':
          response = await this.handleGet(req as CoreGetInput);
          break;
        case 'create':
          response = await this.handleCreate(req as CoreCreateInput);
          break;
        case 'copy':
          response = await this.handleCopy(req as CoreCopyInput);
          break;
        case 'update_properties':
          response = await this.handleUpdateProperties(req as CoreUpdatePropertiesInput);
          break;
        case 'get_url':
          response = await this.handleGetUrl(req as CoreGetUrlInput);
          break;
        case 'batch_get':
          response = await this.handleBatchGet(req as CoreBatchGetInput);
          break;
        case 'get_comprehensive':
          response = await this.handleGetComprehensive(req as CoreGetComprehensiveInput);
          break;
        case 'list':
          response = await this.handleList(req as CoreListInput);
          break;

        // Sheet/tab actions (7)
        case 'add_sheet':
          response = await this.handleAddSheet(req as CoreAddSheetInput);
          break;
        case 'delete_sheet':
          response = await this.handleDeleteSheet(req as CoreDeleteSheetInput);
          break;
        case 'duplicate_sheet':
          response = await this.handleDuplicateSheet(req as CoreDuplicateSheetInput);
          break;
        case 'update_sheet':
          response = await this.handleUpdateSheet(req as CoreUpdateSheetInput);
          break;
        case 'copy_sheet_to':
          response = await this.handleCopySheetTo(req as CoreCopySheetToInput);
          break;
        case 'list_sheets':
          response = await this.handleListSheets(req as CoreListSheetsInput);
          break;
        case 'get_sheet':
          response = await this.handleGetSheet(req as CoreGetSheetInput);
          break;

        // Batch operations (Issue #2 fix - efficient multi-sheet operations)
        case 'batch_delete_sheets':
          response = await this.handleBatchDeleteSheets(req as CoreBatchDeleteSheetsInput);
          break;
        case 'batch_update_sheets':
          response = await this.handleBatchUpdateSheets(req as CoreBatchUpdateSheetsInput);
          break;

        // New actions (Issue fix - missing functionality)
        case 'clear_sheet':
          response = await this.handleClearSheet(req as CoreClearSheetInput);
          break;
        case 'move_sheet':
          response = await this.handleMoveSheet(req as CoreMoveSheetInput);
          break;

        // ACTION ALIASES - Common variations that map to existing actions
        // These prevent "Unknown action" errors when LLMs guess action names
        case 'rename_sheet':
          // Alias for update_sheet - just changes title
          response = await this.handleUpdateSheet(req as CoreUpdateSheetInput);
          break;
        case 'hide_sheet':
          // Alias for update_sheet with hidden:true
          response = await this.handleUpdateSheet({ ...req, hidden: true } as CoreUpdateSheetInput);
          break;
        case 'show_sheet':
        case 'unhide_sheet':
          // Alias for update_sheet with hidden:false
          response = await this.handleUpdateSheet({
            ...req,
            hidden: false,
          } as CoreUpdateSheetInput);
          break;
        case 'copy_to':
          // Alias for copy_sheet_to
          response = await this.handleCopySheetTo(req as CoreCopySheetToInput);
          break;
        case 'update_sheet_properties':
          // Alias for update_properties (spreadsheet-level)
          response = await this.handleUpdateProperties(req as CoreUpdatePropertiesInput);
          break;

        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}. Available actions: get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list, add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet, clear_sheet, move_sheet, batch_delete_sheets, batch_update_sheets`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
      }

      // Track context after successful operation
      if (response.success && 'spreadsheetId' in req) {
        this.trackContextFromRequest({
          spreadsheetId: req.spreadsheetId,
          sheetId:
            'sheetId' in req
              ? typeof req.sheetId === 'number'
                ? req.sheetId
                : undefined
              : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization) - verbosity already set earlier
      const filteredResponse = this.applyCoreVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  /**
   * Apply verbosity filtering with core-specific customization
   * Uses base handler's applyVerbosityFilter and adds spreadsheet-specific logic
   */
  private applyCoreVerbosityFilter(
    response: CoreResponse,
    verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'
  ): CoreResponse {
    // Use base handler's filtering first
    const baseFiltered = super.applyVerbosityFilter(response, verbosity) as CoreResponse;

    // Add core-specific filtering for minimal verbosity
    if (verbosity === 'minimal' && baseFiltered.success) {
      const filtered = { ...baseFiltered };

      // If response has spreadsheet data, minimize it further
      if ('spreadsheet' in filtered && filtered.spreadsheet?.sheets) {
        filtered.spreadsheet = {
          spreadsheetId: filtered.spreadsheet.spreadsheetId,
          title: filtered.spreadsheet.title,
          sheets: filtered.spreadsheet.sheets.map((s: SheetInfo) => ({
            sheetId: s.sheetId,
            title: s.title,
            rowCount: s.rowCount,
            columnCount: s.columnCount,
            // Omit: index, hidden, tabColor
          })) as SheetInfo[],
          // Omit: url, locale, timeZone
        };
      }

      return filtered;
    }

    return baseFiltered;
  }

  protected createIntents(input: SheetsCoreInput): Intent[] {
    // Extract the request from the wrapper
    const req = unwrapRequest<SheetsCoreInput['request']>(input);
    // Create intents for batch compiler
    switch (req.action) {
      // Spreadsheet intents
      case 'update_properties':
        if (req.spreadsheetId) {
          return [
            {
              type: 'UPDATE_SHEET_PROPERTIES',
              target: { spreadsheetId: req.spreadsheetId },
              payload: {
                title: req.title,
                locale: req.locale,
                timeZone: req.timeZone,
                autoRecalc: req.autoRecalc,
              },
              metadata: {
                sourceTool: this.toolName,
                sourceAction: 'update_properties',
                priority: 1,
                destructive: false,
              },
            },
          ];
        }
        break;

      // Sheet/tab intents
      case 'add_sheet':
        return [
          {
            type: 'ADD_SHEET',
            target: { spreadsheetId: req.spreadsheetId! },
            payload: { title: req.title },
            metadata: {
              sourceTool: this.toolName,
              sourceAction: 'add_sheet',
              priority: 1,
              destructive: false,
            },
          },
        ];
      case 'delete_sheet':
        return [
          {
            type: 'DELETE_SHEET',
            target: {
              spreadsheetId: req.spreadsheetId!,
              sheetId: req.sheetId!,
            },
            payload: {},
            metadata: {
              sourceTool: this.toolName,
              sourceAction: 'delete_sheet',
              priority: 1,
              destructive: true,
            },
          },
        ];
      case 'duplicate_sheet':
        return [
          {
            type: 'DUPLICATE_SHEET',
            target: {
              spreadsheetId: req.spreadsheetId!,
              sheetId: req.sheetId!,
            },
            payload: { newTitle: req.newTitle },
            metadata: {
              sourceTool: this.toolName,
              sourceAction: 'duplicate_sheet',
              priority: 1,
              destructive: false,
            },
          },
        ];
      case 'update_sheet':
        return [
          {
            type: 'UPDATE_SHEET_PROPERTIES',
            target: {
              spreadsheetId: req.spreadsheetId!,
              sheetId: req.sheetId!,
            },
            payload: { title: req.title, hidden: req.hidden },
            metadata: {
              sourceTool: this.toolName,
              sourceAction: 'update_sheet',
              priority: 1,
              destructive: false,
            },
          },
        ];
    }
    return [];
  }

  // ===================================================================
  // SPREADSHEET ACTIONS (8)
  // ===================================================================

  /**
   * Get spreadsheet metadata
   */
  private async handleGet(input: CoreGetInput): Promise<CoreResponse> {
    const params: sheets_v4.Params$Resource$Spreadsheets$Get = {
      spreadsheetId: input.spreadsheetId,
      includeGridData: input.includeGridData ?? false,
      fields:
        'spreadsheetId,properties,spreadsheetUrl,sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))',
    };
    if (input.ranges && input.ranges.length > 0) {
      params.ranges = input.ranges;
    }

    // Try cache first (5min TTL for spreadsheet metadata)
    const cacheKey = createCacheKey(
      'spreadsheet:get',
      params as unknown as Record<string, unknown>
    );
    const cached = cacheManager.get<sheets_v4.Schema$Spreadsheet>(cacheKey, 'spreadsheet');

    const data =
      cached ??
      (await (async () => {
        // Use request deduplication for API call
        const dedupKey = `spreadsheet:get:${input.spreadsheetId}:${params.fields ?? 'all'}`;
        const response = await this.deduplicatedApiCall(dedupKey, () =>
          this.sheetsApi.spreadsheets.get(params)
        );
        const result = response.data;
        // Cache the result
        cacheManager.set(cacheKey, result, {
          ttl: CACHE_TTL_SPREADSHEET,
          namespace: 'spreadsheet',
        });
        return result;
      })());

    const sheets: SheetInfo[] = (data.sheets ?? []).map((s: sheets_v4.Schema$Sheet) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? '',
      index: s.properties?.index ?? 0,
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
      hidden: s.properties?.hidden ?? false,
      tabColor: s.properties?.tabColor
        ? {
            red: s.properties.tabColor.red ?? 0,
            green: s.properties.tabColor.green ?? 0,
            blue: s.properties.tabColor.blue ?? 0,
            alpha: s.properties.tabColor.alpha ?? 1,
          }
        : undefined,
    }));

    // Validate response data
    if (!data.spreadsheetId) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Sheets API returned incomplete data - missing spreadsheetId',
        details: { inputSpreadsheetId: input.spreadsheetId },
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
        resolution: 'Retry the operation. If the issue persists, check Google Sheets API status.',
      });
    }

    return this.success('get', {
      spreadsheet: {
        spreadsheetId: data.spreadsheetId,
        title: data.properties?.title ?? '',
        url: data.spreadsheetUrl ?? undefined,
        locale: data.properties?.locale ?? undefined,
        timeZone: data.properties?.timeZone ?? undefined,
        sheets,
      },
    });
  }

  /**
   * Create a new spreadsheet
   */
  private async handleCreate(input: CoreCreateInput): Promise<CoreResponse> {
    // Check if create operation has required scopes
    const validator = new ScopeValidator({
      scopes: this.context.auth?.scopes ?? [],
    });

    const operation = 'sheets_core.create';
    const requirements = validator.getOperationRequirements(operation);

    if (requirements && !requirements.satisfied) {
      const authUrl = validator.generateIncrementalAuthUrl(requirements.missing);

      return this.error({
        code: 'PERMISSION_DENIED',
        message: requirements.description,
        category: 'auth',
        severity: 'high',
        retryable: false,
        suggestedFix:
          'Check that the spreadsheet is shared with the right account, or verify sharing settings',
        retryStrategy: 'manual',
        details: {
          operation,
          requiredScopes: requirements.required,
          currentScopes: this.context.auth?.scopes ?? [],
          missingScopes: requirements.missing,
          authorizationUrl: authUrl,
          scopeCategory: requirements.category,
        },
        resolution: 'Grant additional permissions to create new spreadsheets.',
        resolutionSteps: [
          '1. Visit the authorization URL to approve required scopes',
          `2. Authorization URL: ${authUrl}`,
          '3. After approving, retry the create operation',
        ],
      });
    }

    const sheetsConfig: sheets_v4.Schema$Sheet[] | undefined = input.sheets?.map((s) => {
      const sheetProps: sheets_v4.Schema$SheetProperties = {
        title: s.title,
        gridProperties: {
          rowCount: s.rowCount ?? 1000,
          columnCount: s.columnCount ?? 26,
        },
      };
      if (s.tabColor) {
        sheetProps.tabColor = {
          red: s.tabColor.red,
          green: s.tabColor.green,
          blue: s.tabColor.blue,
          alpha: s.tabColor.alpha,
        };
      }
      return { properties: sheetProps };
    });

    const spreadsheetProps: sheets_v4.Schema$SpreadsheetProperties = {
      title: input.title,
      locale: input.locale ?? 'en_US',
    };
    if (input.timeZone) {
      spreadsheetProps.timeZone = input.timeZone;
    }

    const requestBody: sheets_v4.Schema$Spreadsheet = {
      properties: spreadsheetProps,
    };
    if (sheetsConfig && sheetsConfig.length > 0) {
      requestBody.sheets = sheetsConfig;
    }

    const response = await this.sheetsApi.spreadsheets.create({ requestBody });

    const data = response.data;
    const sheets: SheetInfo[] = (data.sheets ?? []).map((s: sheets_v4.Schema$Sheet) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? '',
      index: s.properties?.index ?? 0,
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
      hidden: s.properties?.hidden ?? false,
    }));

    // Validate response data
    if (!data.spreadsheetId) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Sheets API returned incomplete data after creating spreadsheet',
        details: { title: input.title },
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
        resolution: 'Retry the operation. If the issue persists, check Google Sheets API status.',
      });
    }

    return this.success('create', {
      spreadsheet: {
        spreadsheetId: data.spreadsheetId,
        title: data.properties?.title ?? '',
        url: data.spreadsheetUrl ?? undefined,
        locale: data.properties?.locale ?? undefined,
        timeZone: data.properties?.timeZone ?? undefined,
        sheets,
      },
      newSpreadsheetId: data.spreadsheetId,
    });
  }

  /**
   * Copy spreadsheet to Drive
   */
  private async handleCopy(input: CoreCopyInput): Promise<CoreResponse> {
    if (!this.driveApi) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Drive API not available - required for spreadsheet copy operation',
        details: {
          spreadsheetId: input.spreadsheetId,
          destinationFolder: input.destinationFolderId,
          requiredScope: 'https://www.googleapis.com/auth/drive.file',
        },
        retryable: false,
        suggestedFix: 'Please try again. If the issue persists, contact support',
        resolution:
          'Ensure Drive API client is initialized with drive.file scope. Check Google API credentials configuration.',
        resolutionSteps: [
          '1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup',
          '2. Ensure drive.file scope is included in OAuth scopes',
          '3. Restart the server after fixing credentials',
        ],
      });
    }

    // BUG-007 FIX: Copy operations can take >30s on large spreadsheets
    // For long-running copies, set COMPOSITE_TIMEOUT_MS env var to extend timeout
    // This operation uses Drive API's files.copy which is inherently slow for large datasets
    // Get current title if newTitle not provided
    let title = input.newTitle;
    if (!title) {
      const current = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'properties.title',
      });
      title = `Copy of ${current.data.properties?.title ?? 'Untitled'}`;
    }

    // Build copy params - only include parents if destination folder is specified
    // FIX: Use spread operator to conditionally include parents instead of null
    // Google Drive API may not handle null parents correctly, causing hangs
    const copyParams: drive_v3.Params$Resource$Files$Copy = {
      fileId: input.spreadsheetId,
      requestBody: {
        name: title,
        ...(input.destinationFolderId ? { parents: [input.destinationFolderId] } : {}),
      },
    };

    try {
      const response = await this.driveApi.files.copy(copyParams);

      if (!response.data.id) {
        return this.error({
          code: 'INTERNAL_ERROR',
          message: 'Drive API returned no file ID after copy operation',
          details: {
            spreadsheetId: input.spreadsheetId,
            copyParams,
          },
          retryable: true,
          suggestedFix: 'Please try again. If the issue persists, contact support',
          resolution:
            'Retry the copy operation. If the issue persists, check Google Drive API status.',
        });
      }

      const newId = response.data.id;

      return this.success('copy', {
        spreadsheet: {
          spreadsheetId: newId,
          title: response.data.name ?? title,
          url: `https://docs.google.com/spreadsheets/d/${newId}`,
        },
        newSpreadsheetId: newId,
      });
    } catch (err) {
      // Ensure errors from Drive API are properly caught and mapped
      return this.mapError(err);
    }
  }

  /**
   * Update spreadsheet properties
   */
  private async handleUpdateProperties(input: CoreUpdatePropertiesInput): Promise<CoreResponse> {
    // Build fields mask
    const fields: string[] = [];
    const properties: sheets_v4.Schema$SpreadsheetProperties = {};

    if (input.title !== undefined) {
      properties.title = input.title;
      fields.push('title');
    }
    if (input.locale !== undefined) {
      properties.locale = input.locale;
      fields.push('locale');
    }
    if (input.timeZone !== undefined) {
      properties.timeZone = input.timeZone;
      fields.push('timeZone');
    }
    if (input.autoRecalc !== undefined) {
      properties.autoRecalc = input.autoRecalc;
      fields.push('autoRecalc');
    }

    if (fields.length === 0) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'No properties to update',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSpreadsheetProperties: {
              properties,
              fields: fields.join(','),
            },
          },
        ],
      },
    });

    // Fetch updated properties
    const updated = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'spreadsheetId,properties,spreadsheetUrl',
    });

    // Validate response data
    if (!updated.data.spreadsheetId) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Sheets API returned incomplete data after update',
        details: { spreadsheetId: input.spreadsheetId },
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
        resolution: 'Retry the operation. If the issue persists, check Google Sheets API status.',
      });
    }

    return this.success('update_properties', {
      spreadsheet: {
        spreadsheetId: updated.data.spreadsheetId,
        title: updated.data.properties?.title ?? '',
        url: updated.data.spreadsheetUrl ?? undefined,
        locale: updated.data.properties?.locale ?? undefined,
        timeZone: updated.data.properties?.timeZone ?? undefined,
      },
    });
  }

  /**
   * Get spreadsheet URL
   */
  private async handleGetUrl(input: CoreGetUrlInput): Promise<CoreResponse> {
    let url = `https://docs.google.com/spreadsheets/d/${input.spreadsheetId}`;
    if (input.sheetId !== undefined) {
      url += `#gid=${input.sheetId}`;
    }
    return this.success('get_url', { url });
  }

  /**
   * Batch get multiple spreadsheets
   */
  private async handleBatchGet(input: CoreBatchGetInput): Promise<CoreResponse> {
    const results = await Promise.all(
      input.spreadsheetIds.map(async (id) => {
        try {
          // Try cache first (5min TTL)
          const cacheKey = createCacheKey('spreadsheet:batch_get', {
            spreadsheetId: id,
          });
          const cached = cacheManager.get<sheets_v4.Schema$Spreadsheet>(cacheKey, 'spreadsheet');

          const data =
            cached ??
            (await (async () => {
              const response = await this.sheetsApi.spreadsheets.get({
                spreadsheetId: id,
                fields: 'spreadsheetId,properties,spreadsheetUrl,sheets.properties',
              });
              const result = response.data;
              // Cache the result
              cacheManager.set(cacheKey, result, {
                ttl: CACHE_TTL_SPREADSHEET,
                namespace: 'spreadsheet',
              });
              return result;
            })());
          const sheets: SheetInfo[] = (data.sheets ?? []).map((s: sheets_v4.Schema$Sheet) => ({
            sheetId: s.properties?.sheetId ?? 0,
            title: s.properties?.title ?? '',
            index: s.properties?.index ?? 0,
            rowCount: s.properties?.gridProperties?.rowCount ?? 0,
            columnCount: s.properties?.gridProperties?.columnCount ?? 0,
            hidden: s.properties?.hidden ?? false,
          }));

          // Use fallback to input ID if response missing spreadsheetId
          return {
            spreadsheetId: data.spreadsheetId ?? id,
            title: data.properties?.title ?? '',
            url: data.spreadsheetUrl ?? undefined,
            locale: data.properties?.locale ?? undefined,
            timeZone: data.properties?.timeZone ?? undefined,
            sheets,
          };
        } catch (err) {
          // Return minimal info for failed fetches
          this.context.logger?.warn?.('Batch get: failed to fetch spreadsheet', {
            spreadsheetId: id,
            error: String(err),
          });
          return {
            spreadsheetId: id,
            title: '(error)',
          };
        }
      })
    );

    return this.success('batch_get', { spreadsheets: results });
  }

  /**
   * Get comprehensive metadata for analysis
   */
  private async handleGetComprehensive(input: CoreGetComprehensiveInput): Promise<CoreResponse> {
    const startTime = Date.now();

    // Phase 1.2: Sheet-level pagination support
    const paginationState = this.decodeSheetPaginationCursor(input.cursor) || {
      sheetIndex: 0,
      maxSheets: input.maxSheets ?? 10,
    };

    // First, get all sheet metadata (lightweight operation)
    const metaResponse = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields:
        'spreadsheetId,properties,spreadsheetUrl,namedRanges,sheets.properties(title,sheetId)',
    });

    const allSheets = metaResponse.data.sheets ?? [];
    const totalSheets = allSheets.length;

    // Validate pagination cursor
    if (paginationState.sheetIndex < 0 || paginationState.sheetIndex > totalSheets) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Invalid pagination cursor: sheet index out of bounds',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
        details: { cursor: input.cursor, sheetIndex: paginationState.sheetIndex, totalSheets },
      });
    }

    // Determine which sheets to include in this page
    const startIndex = paginationState.sheetIndex;
    const endIndex = Math.min(startIndex + paginationState.maxSheets, totalSheets);
    const sheetsToFetch = allSheets.slice(startIndex, endIndex);
    const hasMore = endIndex < totalSheets;
    const nextCursor = hasMore
      ? this.encodeSheetPaginationCursor({
          sheetIndex: endIndex,
          maxSheets: paginationState.maxSheets,
        })
      : undefined;

    // Build comprehensive fields string
    const baseFields = [
      'spreadsheetId',
      'properties',
      'spreadsheetUrl',
      'namedRanges',
      'sheets(properties,conditionalFormats,protectedRanges,charts,filterViews,basicFilter,merges)',
    ];

    // Optionally include sample grid data
    if (input.includeGridData) {
      baseFields.push('sheets.data.rowData.values(dataValidation,pivotTable,formattedValue)');
    }

    const fields = baseFields.join(',');

    // Build ranges for sampling if includeGridData (only for sheets in this page)
    let ranges: string[] | undefined;
    if (input.includeGridData) {
      ranges = sheetsToFetch
        .map((s) => {
          const title = s.properties?.title;
          if (!title) return null;
          const maxRows = input.maxRowsPerSheet ?? 100;
          // Escape single quotes in sheet name
          const escapedTitle = title.replace(/'/g, "''");
          return `'${escapedTitle}'!A1:Z${maxRows}`;
        })
        .filter((r): r is string => r !== null);
    }

    // Check cache first (include pagination state in cache key)
    const cacheKey = createCacheKey('spreadsheet:comprehensive', {
      spreadsheetId: input.spreadsheetId,
      includeGridData: input.includeGridData ?? false,
      maxRows: input.maxRowsPerSheet ?? 100,
      sheetIndex: startIndex,
      maxSheets: paginationState.maxSheets,
    });
    const cached = cacheManager.get<sheets_v4.Schema$Spreadsheet>(cacheKey, 'spreadsheet');

    const data =
      cached ??
      (await (async () => {
        const params: sheets_v4.Params$Resource$Spreadsheets$Get = {
          spreadsheetId: input.spreadsheetId,
          includeGridData: input.includeGridData ?? false,
          fields,
        };

        if (ranges && ranges.length > 0) {
          params.ranges = ranges;
        }

        const response = await this.sheetsApi.spreadsheets.get(params);
        const result = response.data;

        // Cache the comprehensive metadata (5 min TTL)
        cacheManager.set(cacheKey, result, {
          ttl: CACHE_TTL_SPREADSHEET,
          namespace: 'spreadsheet',
        });

        return result;
      })());

    // Phase 2: Send progress notification after fetching data (HTTP only, throttled to 1/sec)
    await this.sendProgress(
      endIndex,
      totalSheets,
      `Fetched ${endIndex - startIndex} sheets (${startIndex + 1}-${endIndex} of ${totalSheets})`
    );

    // Filter sheets to only include the paginated subset
    const paginatedSheets = data.sheets?.slice(startIndex, endIndex) ?? [];

    // Calculate stats (only for sheets in this page)
    const sheetsCount = paginatedSheets.length;
    const namedRangesCount = data.namedRanges?.length ?? 0;
    const totalCharts = paginatedSheets.reduce((sum, s) => sum + (s.charts?.length ?? 0), 0);
    const totalConditionalFormats = paginatedSheets.reduce(
      (sum, s) => sum + (s.conditionalFormats?.length ?? 0),
      0
    );
    const totalProtectedRanges = paginatedSheets.reduce(
      (sum, s) => sum + (s.protectedRanges?.length ?? 0),
      0
    );

    // Validate response data
    if (!data.spreadsheetId) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Sheets API returned incomplete data - missing spreadsheetId',
        details: { inputSpreadsheetId: input.spreadsheetId },
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
        resolution: 'Retry the operation. If the issue persists, check Google Sheets API status.',
      });
    }

    return this.success('get_comprehensive', {
      comprehensiveMetadata: {
        spreadsheetId: data.spreadsheetId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: data.properties as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        namedRanges: data.namedRanges as any,
        sheets: paginatedSheets.map((s) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          properties: s.properties as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          conditionalFormats: s.conditionalFormats as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          protectedRanges: s.protectedRanges as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          charts: s.charts as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          filterViews: s.filterViews as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          basicFilter: s.basicFilter as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          merges: s.merges as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: s.data as any,
        })),
        stats: {
          sheetsCount,
          namedRangesCount,
          totalCharts,
          totalConditionalFormats,
          totalProtectedRanges,
          cacheHit: !!cached,
          fetchTime: Date.now() - startTime,
        },
        // Phase 1.2: Pagination metadata
        pagination: {
          hasMore,
          nextCursor,
          totalSheets,
          currentPage: {
            startIndex,
            endIndex,
            count: sheetsCount,
          },
        },
      },
    });
  }

  /**
   * List user's spreadsheets
   */
  private async handleList(input: CoreListInput): Promise<CoreResponse> {
    if (!this.driveApi) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Drive API not available - required for listing spreadsheets',
        details: {
          action: 'list',
          requiredScope: 'https://www.googleapis.com/auth/drive.readonly',
        },
        retryable: false,
        suggestedFix: 'Please try again. If the issue persists, contact support',
        resolution:
          'Ensure Drive API client is initialized. Check Google API credentials configuration.',
        resolutionSteps: [
          '1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup',
          '2. Ensure drive.readonly scope is included in OAuth scopes',
          '3. Re-authenticate if using OAuth',
        ],
      });
    }

    const pageSize = input.maxResults || 100;
    const orderBy = input.orderBy || 'modifiedTime desc';

    // Build query: filter for Google Sheets files
    let q = "mimeType='application/vnd.google-apps.spreadsheet'";
    if (input.query) {
      q += ` and ${input.query}`;
    }

    try {
      const response = await this.driveApi.files.list({
        q,
        pageSize,
        orderBy,
        fields: 'files(id,name,createdTime,modifiedTime,webViewLink,owners,lastModifyingUser)',
        spaces: 'drive',
      });

      const spreadsheets = (response.data.files || [])
        .filter((file) => file.id && file.name) // Filter out incomplete data
        .map((file) => ({
          spreadsheetId: file.id as string,
          title: file.name as string,
          url: file.webViewLink ?? undefined,
          createdTime: file.createdTime ?? undefined,
          modifiedTime: file.modifiedTime ?? undefined,
          owners: file.owners?.map((o) => ({
            email: o.emailAddress ?? undefined,
            displayName: o.displayName ?? undefined,
          })),
          lastModifiedBy: file.lastModifyingUser?.emailAddress ?? undefined,
        }));

      return this.success('list', {
        spreadsheets,
      });
    } catch (err) {
      // Ensure errors from Drive API are properly caught and mapped
      return this.mapError(err);
    }
  }

  // ===================================================================
  // SHEET/TAB ACTIONS (7)
  // ===================================================================

  /**
   * Add a new sheet/tab
   */
  private async handleAddSheet(input: CoreAddSheetInput): Promise<CoreResponse> {
    const sheetProperties: sheets_v4.Schema$SheetProperties = {
      title: input.title,
      hidden: input.hidden ?? false,
      gridProperties: {
        rowCount: input.rowCount ?? 1000,
        columnCount: input.columnCount ?? 26,
      },
    };

    // Only add optional properties if defined
    if (input.index !== undefined) {
      sheetProperties.index = input.index;
    }
    if (input.tabColor) {
      sheetProperties.tabColor = {
        red: input.tabColor.red,
        green: input.tabColor.green,
        blue: input.tabColor.blue,
        alpha: input.tabColor.alpha,
      };
    }

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: { properties: sheetProperties },
          },
        ],
      },
    });

    const newSheet = response.data?.replies?.[0]?.addSheet?.properties;
    const sheet: SheetInfo = {
      sheetId: newSheet?.sheetId ?? 0,
      title: newSheet?.title ?? input.title,
      index: newSheet?.index ?? 0,
      rowCount: newSheet?.gridProperties?.rowCount ?? input.rowCount ?? 1000,
      columnCount: newSheet?.gridProperties?.columnCount ?? input.columnCount ?? 26,
      hidden: newSheet?.hidden ?? false,
      tabColor: this.convertTabColor(newSheet?.tabColor),
    };

    return this.success('add_sheet', { sheet });
  }

  /**
   * Delete a sheet/tab
   */
  private async handleDeleteSheet(input: CoreDeleteSheetInput): Promise<CoreResponse> {
    // Check if sheet exists when allowMissing is true
    if (input.allowMissing) {
      const exists = await this.sheetExists(input.spreadsheetId, input.sheetId);
      if (!exists) {
        return this.success('delete_sheet', { alreadyDeleted: true });
      }
    }

    // Dry run support
    if (input.safety?.dryRun) {
      return this.success('delete_sheet', {}, undefined, true);
    }

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'delete_sheet',
        `Delete sheet with ID ${input.sheetId} from spreadsheet ${input.spreadsheetId}. This will permanently remove the entire sheet and all its data. This action cannot be undone.`
      );

      if (!confirmation.confirmed) {
        return this.error({
          code: 'PRECONDITION_FAILED',
          message: confirmation.reason || 'User cancelled the operation',
          retryable: false,
          suggestedFix: 'Review the operation requirements and try again',
        });
      }
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'delete_sheet',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{ deleteSheet: { sheetId: input.sheetId } }],
      },
    });

    return this.success('delete_sheet', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  /**
   * Duplicate a sheet/tab
   */
  private async handleDuplicateSheet(input: CoreDuplicateSheetInput): Promise<CoreResponse> {
    const duplicateRequest: sheets_v4.Schema$DuplicateSheetRequest = {
      sourceSheetId: input.sheetId,
    };

    if (input.insertIndex !== undefined) {
      duplicateRequest.insertSheetIndex = input.insertIndex;
    }
    if (input.newTitle !== undefined) {
      duplicateRequest.newSheetName = input.newTitle;
    }

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{ duplicateSheet: duplicateRequest }],
      },
    });

    const newSheet = response.data?.replies?.[0]?.duplicateSheet?.properties;
    const sheet: SheetInfo = {
      sheetId: newSheet?.sheetId ?? 0,
      title: newSheet?.title ?? '',
      index: newSheet?.index ?? 0,
      rowCount: newSheet?.gridProperties?.rowCount ?? 0,
      columnCount: newSheet?.gridProperties?.columnCount ?? 0,
      hidden: newSheet?.hidden ?? false,
    };

    return this.success('duplicate_sheet', { sheet });
  }

  /**
   * Update sheet/tab properties
   *
   * ENHANCED: Now supports both parameter styles:
   * - Root-level: { title: "...", hidden: true }
   * - Nested: { properties: { title: "...", hidden: true } }
   *
   * Also supports sheetName lookup as alternative to sheetId
   */
  private async handleUpdateSheet(input: CoreUpdateSheetInput): Promise<CoreResponse> {
    // PARAMETER NORMALIZATION: Support both root-level and nested properties
    // This fixes the issue where { properties: { title: "..." } } silently fails
    const inputAny = input as Record<string, unknown>;
    const nestedProps = inputAny['properties'] as Record<string, unknown> | undefined;

    // Normalize: extract from nested properties if present (using bracket notation for index signature)
    const title = input.title ?? (nestedProps?.['title'] as string | undefined);
    const index = input.index ?? (nestedProps?.['index'] as number | undefined);
    const hidden = input.hidden ?? (nestedProps?.['hidden'] as boolean | undefined);
    const tabColor = input.tabColor ?? (nestedProps?.['tabColor'] as typeof input.tabColor);
    const rightToLeft = input.rightToLeft ?? (nestedProps?.['rightToLeft'] as boolean | undefined);

    // SHEETID RESOLUTION: Support sheetName lookup
    let resolvedSheetId = input.sheetId;
    const sheetName = inputAny['sheetName'] as string | undefined;

    if (resolvedSheetId === undefined && sheetName) {
      // Look up sheetId by name
      const lookupResponse = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.properties(sheetId,title)',
      });

      const matchingSheet = lookupResponse.data.sheets?.find(
        (s) => s.properties?.title?.toLowerCase() === sheetName.toLowerCase()
      );

      const matchingSheetId = matchingSheet?.properties?.sheetId;
      if (matchingSheetId === undefined || matchingSheetId === null) {
        return this.error(
          createNotFoundError({
            resourceType: 'sheet',
            resourceId: `sheetName: "${sheetName}"`,
            searchSuggestion: `Available sheets: ${lookupResponse.data.sheets?.map((s) => s.properties?.title).join(', ')}`,
            parentResourceId: input.spreadsheetId,
          })
        );
      }

      resolvedSheetId = matchingSheetId;
    }

    if (resolvedSheetId === undefined) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Either sheetId (number) or sheetName (string) is required',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Build properties and fields mask
    const properties: sheets_v4.Schema$SheetProperties = {
      sheetId: resolvedSheetId,
    };
    const fields: string[] = [];

    if (title !== undefined) {
      properties.title = title;
      fields.push('title');
    }
    if (index !== undefined) {
      properties.index = index;
      fields.push('index');
    }
    if (hidden !== undefined) {
      properties.hidden = hidden;
      fields.push('hidden');
    }
    if (tabColor !== undefined) {
      properties.tabColor = {
        red: tabColor.red,
        green: tabColor.green,
        blue: tabColor.blue,
        alpha: tabColor.alpha,
      };
      fields.push('tabColor');
    }
    if (rightToLeft !== undefined) {
      properties.rightToLeft = rightToLeft;
      fields.push('rightToLeft');
    }

    if (fields.length === 0) {
      return this.error({
        code: 'INVALID_PARAMS',
        message:
          'No properties to update. Provide at least one of: title, index, hidden, tabColor, rightToLeft',
        details: {
          receivedParams: Object.keys(inputAny).filter(
            (k) => k !== 'action' && k !== 'spreadsheetId'
          ),
          hint: 'Properties can be at root level or nested in a "properties" object',
        },
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties,
              fields: fields.join(','),
            },
          },
        ],
      },
    });

    // Fetch updated sheet info
    const updated = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheetData = updated.data.sheets?.find((s) => s.properties?.sheetId === resolvedSheetId);
    if (!sheetData?.properties) {
      return this.error(
        createNotFoundError({
          resourceType: 'sheet',
          resourceId: String(resolvedSheetId),
          searchSuggestion: 'Sheet not found after update. Verify the sheet ID is correct.',
          parentResourceId: input.spreadsheetId,
        })
      );
    }

    const sheet: SheetInfo = {
      sheetId: sheetData.properties.sheetId ?? 0,
      title: sheetData.properties.title ?? '',
      index: sheetData.properties.index ?? 0,
      rowCount: sheetData.properties.gridProperties?.rowCount ?? 0,
      columnCount: sheetData.properties.gridProperties?.columnCount ?? 0,
      hidden: sheetData.properties.hidden ?? false,
      tabColor: this.convertTabColor(sheetData.properties.tabColor),
    };

    return this.success('update_sheet', { sheet });
  }

  /**
   * Copy sheet/tab to another spreadsheet
   */
  private async handleCopySheetTo(input: CoreCopySheetToInput): Promise<CoreResponse> {
    const response = await this.sheetsApi.spreadsheets.sheets.copyTo({
      spreadsheetId: input.spreadsheetId,
      sheetId: input.sheetId,
      requestBody: {
        destinationSpreadsheetId: input.destinationSpreadsheetId,
      },
    });

    const sheet: SheetInfo = {
      sheetId: response.data.sheetId ?? 0,
      title: response.data.title ?? '',
      index: response.data.index ?? 0,
      rowCount: response.data.gridProperties?.rowCount ?? 0,
      columnCount: response.data.gridProperties?.columnCount ?? 0,
      hidden: response.data.hidden ?? false,
    };

    return this.success('copy_sheet_to', {
      sheet,
      copiedSheetId: response.data.sheetId ?? 0,
    });
  }

  /**
   * List all sheets/tabs in a spreadsheet
   */
  private async handleListSheets(input: CoreListSheetsInput): Promise<CoreResponse> {
    // Use request deduplication
    const dedupKey = `spreadsheet:get:${input.spreadsheetId}:sheets.properties`;
    const response = await this.deduplicatedApiCall(dedupKey, () =>
      this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.properties',
      })
    );

    const sheets: SheetInfo[] = (response.data.sheets ?? []).map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? '',
      index: s.properties?.index ?? 0,
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
      hidden: s.properties?.hidden ?? false,
      tabColor: this.convertTabColor(s.properties?.tabColor),
    }));

    return this.success('list_sheets', { sheets });
  }

  /**
   * Get info for a specific sheet/tab
   * Supports lookup by sheetId (numeric) or sheetName (string)
   */
  private async handleGetSheet(input: CoreGetSheetInput): Promise<CoreResponse> {
    // Use request deduplication
    const dedupKey = `spreadsheet:get:${input.spreadsheetId}:sheets.properties`;
    const response = await this.deduplicatedApiCall(dedupKey, () =>
      this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.properties',
      })
    );

    // Find sheet by sheetId or sheetName
    let sheetData: sheets_v4.Schema$Sheet | undefined;

    if (input.sheetId !== undefined) {
      // Lookup by numeric sheetId
      sheetData = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    } else if (input.sheetName !== undefined) {
      // Lookup by sheet name (case-insensitive)
      const nameLower = input.sheetName.toLowerCase();
      sheetData = response.data.sheets?.find(
        (s) => s.properties?.title?.toLowerCase() === nameLower
      );
    }

    if (!sheetData?.properties) {
      const resourceId =
        input.sheetId !== undefined
          ? `sheetId: ${input.sheetId}`
          : `sheetName: "${input.sheetName}"`;
      const available =
        response.data.sheets?.map((s) => `${s.properties?.title} (id: ${s.properties?.sheetId})`) ??
        [];
      return this.error(
        createNotFoundError({
          resourceType: 'sheet',
          resourceId,
          searchSuggestion: `Available sheets: ${available.join(', ')}`,
          parentResourceId: input.spreadsheetId,
        })
      );
    }

    const sheet: SheetInfo = {
      sheetId: sheetData.properties.sheetId ?? 0,
      title: sheetData.properties.title ?? '',
      index: sheetData.properties.index ?? 0,
      rowCount: sheetData.properties.gridProperties?.rowCount ?? 0,
      columnCount: sheetData.properties.gridProperties?.columnCount ?? 0,
      hidden: sheetData.properties.hidden ?? false,
      tabColor: this.convertTabColor(sheetData.properties.tabColor),
    };

    return this.success('get_sheet', { sheet });
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  /**
   * Convert Google API tab color to our schema format
   */
  private convertTabColor(
    tabColor: sheets_v4.Schema$Color | null | undefined
  ): SheetInfo['tabColor'] {
    // OK: Explicit empty - tab color is optional, undefined means no color set
    if (!tabColor) return undefined;
    return {
      red: tabColor.red ?? 0,
      green: tabColor.green ?? 0,
      blue: tabColor.blue ?? 0,
      alpha: tabColor.alpha ?? 1,
    };
  }

  /**
   * Check if a sheet exists in a spreadsheet
   */
  private async sheetExists(spreadsheetId: string, sheetId: number): Promise<boolean> {
    try {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.sheetId',
      });
      return response.data.sheets?.some((s) => s.properties?.sheetId === sheetId) ?? false;
    } catch (err) {
      this.context.logger?.warn?.('Failed to check sheet existence', {
        spreadsheetId,
        sheetId,
        error: String(err),
      });
      return false;
    }
  }

  // ===================================================================
  // BATCH OPERATIONS (Issue #2 fix - efficient multi-sheet operations)
  // ===================================================================

  /**
   * Batch delete multiple sheets in a single API call
   * More efficient than calling delete_sheet multiple times
   */
  private async handleBatchDeleteSheets(input: CoreBatchDeleteSheetsInput): Promise<CoreResponse> {
    if (!input.sheetIds || input.sheetIds.length === 0) {
      return this.error(
        createValidationError({
          field: 'sheetIds',
          value: input.sheetIds ?? null,
          expectedFormat: 'non-empty array of sheet IDs',
          reason: 'Provide at least one sheetId to delete',
        })
      );
    }

    // Get current sheets to validate which exist
    const spreadsheetResponse = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties.sheetId',
    });

    const existingSheetIds = new Set(
      spreadsheetResponse.data.sheets?.map((s) => s.properties?.sheetId) ?? []
    );

    // Filter to only sheets that exist
    const sheetsToDelete = input.sheetIds.filter((id) => existingSheetIds.has(id));
    const skippedSheetIds = input.sheetIds.filter((id) => !existingSheetIds.has(id));

    if (sheetsToDelete.length === 0) {
      return this.success('batch_delete_sheets', {
        deletedCount: 0,
        skippedSheetIds,
        message: 'No sheets found to delete',
      });
    }

    // Check we're not deleting all sheets (at least one must remain)
    if (sheetsToDelete.length >= existingSheetIds.size) {
      return this.error(
        createValidationError({
          field: 'sheetIds',
          value: input.sheetIds,
          expectedFormat: 'at least one sheet to remain',
          reason: 'A spreadsheet must have at least one sheet. Remove one sheetId from the list.',
        })
      );
    }

    // Build batch delete requests
    const requests: sheets_v4.Schema$Request[] = sheetsToDelete.map((sheetId) => ({
      deleteSheet: { sheetId },
    }));

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success('batch_delete_sheets', {
      deletedCount: sheetsToDelete.length,
      skippedSheetIds: skippedSheetIds.length > 0 ? skippedSheetIds : undefined,
      message: `Deleted ${sheetsToDelete.length} sheet(s)${skippedSheetIds.length > 0 ? `, skipped ${skippedSheetIds.length} non-existent` : ''}`,
    });
  }

  /**
   * Batch update multiple sheets' properties in a single API call
   * More efficient than calling update_sheet multiple times
   */
  private async handleBatchUpdateSheets(input: CoreBatchUpdateSheetsInput): Promise<CoreResponse> {
    if (!input.updates || input.updates.length === 0) {
      return this.error(
        createValidationError({
          field: 'updates',
          value: input.updates ?? null,
          expectedFormat: 'non-empty array of sheet updates',
          reason: 'Provide at least one update object with sheetId and properties to update',
        })
      );
    }

    // Build batch update requests
    const requests: sheets_v4.Schema$Request[] = input.updates.map((update) => {
      const fields: string[] = [];
      const properties: sheets_v4.Schema$SheetProperties = {
        sheetId: update.sheetId,
      };

      if (update.title !== undefined) {
        properties.title = update.title;
        fields.push('title');
      }
      if (update.index !== undefined) {
        properties.index = update.index;
        fields.push('index');
      }
      if (update.hidden !== undefined) {
        properties.hidden = update.hidden;
        fields.push('hidden');
      }
      if (update.tabColor !== undefined) {
        properties.tabColor = {
          red: update.tabColor.red,
          green: update.tabColor.green,
          blue: update.tabColor.blue,
          alpha: update.tabColor.alpha ?? 1,
        };
        fields.push('tabColor');
      }

      return {
        updateSheetProperties: {
          properties,
          fields: fields.join(','),
        },
      };
    });

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success('batch_update_sheets', {
      updatedCount: input.updates.length,
      message: `Updated ${input.updates.length} sheet(s)`,
    });
  }

  // ===================================================================
  // NEW ACTIONS (Issue fix - missing functionality)
  // ===================================================================

  /**
   * Clear all content from a sheet while preserving the sheet itself
   * This is a common operation that was missing from the API
   */
  private async handleClearSheet(input: CoreClearSheetInput): Promise<CoreResponse> {
    // Resolve sheet ID from name if needed
    let resolvedSheetId = input.sheetId;

    if (resolvedSheetId === undefined && input.sheetName) {
      const lookupResponse = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.properties(sheetId,title)',
      });

      const matchingSheet = lookupResponse.data.sheets?.find(
        (s) => s.properties?.title?.toLowerCase() === input.sheetName!.toLowerCase()
      );

      const matchingSheetId = matchingSheet?.properties?.sheetId;
      if (matchingSheetId === undefined || matchingSheetId === null) {
        return this.error(
          createNotFoundError({
            resourceType: 'sheet',
            resourceId: `sheetName: "${input.sheetName}"`,
            searchSuggestion: `Available sheets: ${lookupResponse.data.sheets?.map((s) => s.properties?.title).join(', ')}`,
            parentResourceId: input.spreadsheetId,
          })
        );
      }

      resolvedSheetId = matchingSheetId;
    }

    if (resolvedSheetId === undefined) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Either sheetId (number) or sheetName (string) is required',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Get sheet title for the range
    const sheetInfo = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties(sheetId,title,gridProperties)',
    });

    const targetSheet = sheetInfo.data.sheets?.find(
      (s) => s.properties?.sheetId === resolvedSheetId
    );

    if (!targetSheet?.properties?.title) {
      return this.error(
        createNotFoundError({
          resourceType: 'sheet',
          resourceId: `sheetId: ${resolvedSheetId}`,
          parentResourceId: input.spreadsheetId,
        })
      );
    }

    const sheetTitle = targetSheet.properties.title;
    const _escapedTitle = sheetTitle.replace(/'/g, "''"); // Reserved for future use in A1 notation

    // Determine what to clear based on options
    const clearValues = input.clearValues !== false; // default true
    const clearFormats = input.clearFormats === true; // default false
    const clearNotes = input.clearNotes === true; // default false

    const requests: sheets_v4.Schema$Request[] = [];

    if (clearValues) {
      // Clear all values using updateCells with empty userEnteredValue
      requests.push({
        updateCells: {
          range: {
            sheetId: resolvedSheetId,
          },
          fields: 'userEnteredValue',
        },
      });
    }

    if (clearFormats) {
      requests.push({
        updateCells: {
          range: {
            sheetId: resolvedSheetId,
          },
          fields: 'userEnteredFormat',
        },
      });
    }

    if (clearNotes) {
      requests.push({
        updateCells: {
          range: {
            sheetId: resolvedSheetId,
          },
          fields: 'note',
        },
      });
    }

    if (requests.length === 0) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Nothing to clear. Set at least one of: clearValues, clearFormats, clearNotes',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success('clear_sheet', {
      sheetId: resolvedSheetId,
      sheetTitle,
      cleared: {
        values: clearValues,
        formats: clearFormats,
        notes: clearNotes,
      },
    });
  }

  /**
   * Move a sheet to a new position (index) within the spreadsheet
   */
  private async handleMoveSheet(input: CoreMoveSheetInput): Promise<CoreResponse> {
    // Resolve sheet ID from name if needed
    let resolvedSheetId = input.sheetId;

    if (resolvedSheetId === undefined && input.sheetName) {
      const lookupResponse = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.properties(sheetId,title,index)',
      });

      const matchingSheet = lookupResponse.data.sheets?.find(
        (s) => s.properties?.title?.toLowerCase() === input.sheetName!.toLowerCase()
      );

      const matchingSheetId = matchingSheet?.properties?.sheetId;
      if (matchingSheetId === undefined || matchingSheetId === null) {
        return this.error(
          createNotFoundError({
            resourceType: 'sheet',
            resourceId: `sheetName: "${input.sheetName}"`,
            searchSuggestion: `Available sheets: ${lookupResponse.data.sheets?.map((s) => s.properties?.title).join(', ')}`,
            parentResourceId: input.spreadsheetId,
          })
        );
      }

      resolvedSheetId = matchingSheetId;
    }

    if (resolvedSheetId === undefined) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Either sheetId (number) or sheetName (string) is required',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    if (input.newIndex === undefined) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'newIndex is required - the 0-based position to move the sheet to',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Move the sheet by updating its index property
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: resolvedSheetId,
                index: input.newIndex,
              },
              fields: 'index',
            },
          },
        ],
      },
    });

    // Fix 3.2: Verify the move actually happened by reading back the sheet
    const verifyResponse = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties(sheetId,title,index)',
    });

    const movedSheet = verifyResponse.data.sheets?.find(
      (s) => s.properties?.sheetId === resolvedSheetId
    );

    if (!movedSheet) {
      return this.error({
        code: 'SHEET_NOT_FOUND',
        message: `Sheet with ID ${resolvedSheetId} not found after move operation`,
        retryable: false,
        suggestedFix: 'Verify the sheet still exists in the spreadsheet',
      });
    }

    const actualIndex = movedSheet.properties?.index ?? -1;
    const verified = actualIndex === input.newIndex;

    if (!verified) {
      this.context.logger?.warn('move_sheet verification failed', {
        requestedIndex: input.newIndex,
        actualIndex,
        sheetId: resolvedSheetId,
      });
    }

    return this.success('move_sheet', {
      sheetId: resolvedSheetId,
      sheetTitle: movedSheet.properties?.title,
      requestedIndex: input.newIndex,
      actualIndex,
      verified,
      ...(verified
        ? {}
        : {
            warning: `Sheet moved but ended at index ${actualIndex} instead of ${input.newIndex}. This may happen if the newIndex was out of range.`,
          }),
    });
  }
}
