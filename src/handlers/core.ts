/**
 * ServalSheets - Core Handler (Consolidated)
 *
 * Handles sheets_core tool (15 actions total):
 * - Spreadsheet operations (8): get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list
 * - Sheet/tab operations (7): add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet
 *
 * Consolidates sheets_spreadsheet + sheets_sheet handlers
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4, drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsCoreInput,
  SheetsCoreOutput,
  SheetInfo,
  CoreResponse,
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
} from '../schemas/index.js';
import { cacheManager, createCacheKey } from '../utils/cache-manager.js';
import { CACHE_TTL_SPREADSHEET } from '../config/constants.js';
import { ScopeValidator } from '../security/incremental-scope.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
import { createNotFoundError } from '../utils/error-factory.js';

export class SheetsCoreHandler extends BaseHandler<SheetsCoreInput, SheetsCoreOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi: drive_v3.Drive | undefined;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets, driveApi?: drive_v3.Drive) {
    super('sheets_core', context);
    this.sheetsApi = sheetsApi;
    this.driveApi = driveApi;
  }

  async handle(input: SheetsCoreInput): Promise<SheetsCoreOutput> {
    // Require authentication before proceeding
    this.requireAuth();

    // Track spreadsheet ID for better error messages
    const spreadsheetId =
      'spreadsheetId' in input ? (input as { spreadsheetId?: string }).spreadsheetId : undefined;
    this.trackSpreadsheetId(spreadsheetId);

    try {
      // Infer missing parameters from context
      const req = this.inferRequestParameters(input) as SheetsCoreInput;

      let response: CoreResponse;
      switch (req.action) {
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

        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
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

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = this.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: CoreResponse,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): CoreResponse {
    if (!response.success || verbosity === 'standard') {
      return response; // No filtering for errors or standard verbosity
    }

    if (verbosity === 'minimal') {
      // Minimal: Return only essential fields (80% token reduction)
      const filtered = { ...response };

      // If response has spreadsheet data, minimize it
      if (filtered.spreadsheet?.sheets) {
        filtered.spreadsheet = {
          spreadsheetId: filtered.spreadsheet.spreadsheetId,
          title: filtered.spreadsheet.title,
          sheets: filtered.spreadsheet.sheets.map((s) => ({
            sheetId: s.sheetId,
            title: s.title,
            rowCount: s.rowCount,
            columnCount: s.columnCount,
            // Omit: index, hidden, tabColor
          })) as SheetInfo[],
          // Omit: url, locale, timeZone
        };
      }

      // If response has multiple sheets, show first 5 only
      if (filtered.sheets && filtered.sheets.length > 5) {
        filtered.sheets = filtered.sheets.slice(0, 5);
      }

      // Omit technical metadata (using _meta as per schema)
      if ('_meta' in filtered) {
        delete (filtered as { _meta?: unknown })._meta;
      }

      return filtered;
    }

    // Detailed: Add extra metadata (future enhancement)
    return response;
  }

  protected createIntents(input: SheetsCoreInput): Intent[] {
    // Create intents for batch compiler
    switch (input.action) {
      // Spreadsheet intents
      case 'update_properties':
        if (input.spreadsheetId) {
          return [
            {
              type: 'UPDATE_SHEET_PROPERTIES',
              target: { spreadsheetId: input.spreadsheetId },
              payload: {
                title: input.title,
                locale: input.locale,
                timeZone: input.timeZone,
                autoRecalc: input.autoRecalc,
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
            target: { spreadsheetId: input.spreadsheetId! },
            payload: { title: input.title },
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
              spreadsheetId: input.spreadsheetId!,
              sheetId: input.sheetId!,
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
              spreadsheetId: input.spreadsheetId!,
              sheetId: input.sheetId!,
            },
            payload: { newTitle: input.newTitle },
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
              spreadsheetId: input.spreadsheetId!,
              sheetId: input.sheetId!,
            },
            payload: { title: input.title, hidden: input.hidden },
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
        const response = await this.sheetsApi.spreadsheets.get(params);
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

    return this.success('get', {
      spreadsheet: {
        spreadsheetId: data.spreadsheetId!,
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

    return this.success('create', {
      spreadsheet: {
        spreadsheetId: data.spreadsheetId!,
        title: data.properties?.title ?? '',
        url: data.spreadsheetUrl ?? undefined,
        locale: data.properties?.locale ?? undefined,
        timeZone: data.properties?.timeZone ?? undefined,
        sheets,
      },
      newSpreadsheetId: data.spreadsheetId!,
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
        resolution:
          'Ensure Drive API client is initialized with drive.file scope. Check Google API credentials configuration.',
        resolutionSteps: [
          '1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup',
          '2. Ensure drive.file scope is included in OAuth scopes',
          '3. Restart the server after fixing credentials',
        ],
      });
    }

    // Get current title if newTitle not provided
    let title = input.newTitle;
    if (!title) {
      const current = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'properties.title',
      });
      title = `Copy of ${current.data.properties?.title ?? 'Untitled'}`;
    }

    const copyParams: drive_v3.Params$Resource$Files$Copy = {
      fileId: input.spreadsheetId,
      requestBody: {
        name: title,
        parents: input.destinationFolderId ? [input.destinationFolderId] : null,
      },
    };

    const response = await this.driveApi.files.copy(copyParams);
    const newId = response.data.id!;

    return this.success('copy', {
      spreadsheet: {
        spreadsheetId: newId,
        title: response.data.name ?? title,
        url: `https://docs.google.com/spreadsheets/d/${newId}`,
      },
      newSpreadsheetId: newId,
    });
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

    return this.success('update_properties', {
      spreadsheet: {
        spreadsheetId: updated.data.spreadsheetId!,
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

          return {
            spreadsheetId: data.spreadsheetId!,
            title: data.properties?.title ?? '',
            url: data.spreadsheetUrl ?? undefined,
            locale: data.properties?.locale ?? undefined,
            timeZone: data.properties?.timeZone ?? undefined,
            sheets,
          };
        } catch {
          // Return minimal info for failed fetches
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

    // Build ranges for sampling if includeGridData
    let ranges: string[] | undefined;
    if (input.includeGridData) {
      // Generate sample ranges (first N rows per sheet)
      const metaResponse = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.properties(title,sheetId)',
      });

      ranges = (metaResponse.data.sheets ?? [])
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

    // Check cache first
    const cacheKey = createCacheKey('spreadsheet:comprehensive', {
      spreadsheetId: input.spreadsheetId,
      includeGridData: input.includeGridData ?? false,
      maxRows: input.maxRowsPerSheet ?? 100,
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

    // Calculate stats
    const sheetsCount = data.sheets?.length ?? 0;
    const namedRangesCount = data.namedRanges?.length ?? 0;
    const totalCharts = data.sheets?.reduce((sum, s) => sum + (s.charts?.length ?? 0), 0) ?? 0;
    const totalConditionalFormats =
      data.sheets?.reduce((sum, s) => sum + (s.conditionalFormats?.length ?? 0), 0) ?? 0;
    const totalProtectedRanges =
      data.sheets?.reduce((sum, s) => sum + (s.protectedRanges?.length ?? 0), 0) ?? 0;

    return this.success('get_comprehensive', {
      comprehensiveMetadata: {
        spreadsheetId: data.spreadsheetId!,
        properties: data.properties as Record<string, unknown>,
        namedRanges: data.namedRanges as Array<Record<string, unknown>>,
        sheets: data.sheets?.map((s) => ({
          properties: s.properties as Record<string, unknown>,
          conditionalFormats: s.conditionalFormats as Array<Record<string, unknown>>,
          protectedRanges: s.protectedRanges as Array<Record<string, unknown>>,
          charts: s.charts as Array<Record<string, unknown>>,
          filterViews: s.filterViews as Array<Record<string, unknown>>,
          basicFilter: s.basicFilter as Record<string, unknown>,
          merges: s.merges as Array<Record<string, unknown>>,
          data: s.data as Array<Record<string, unknown>>,
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

    const response = await this.driveApi.files.list({
      q,
      pageSize,
      orderBy,
      fields: 'files(id,name,createdTime,modifiedTime,webViewLink,owners,lastModifyingUser)',
      spaces: 'drive',
    });

    const spreadsheets = (response.data.files || []).map((file) => ({
      spreadsheetId: file.id!,
      title: file.name!,
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

    const newSheet = response.data.replies?.[0]?.addSheet?.properties;
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

    const newSheet = response.data.replies?.[0]?.duplicateSheet?.properties;
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
   */
  private async handleUpdateSheet(input: CoreUpdateSheetInput): Promise<CoreResponse> {
    // Build properties and fields mask
    const properties: sheets_v4.Schema$SheetProperties = {
      sheetId: input.sheetId,
    };
    const fields: string[] = [];

    if (input.title !== undefined) {
      properties.title = input.title;
      fields.push('title');
    }
    if (input.index !== undefined) {
      properties.index = input.index;
      fields.push('index');
    }
    if (input.hidden !== undefined) {
      properties.hidden = input.hidden;
      fields.push('hidden');
    }
    if (input.tabColor !== undefined) {
      properties.tabColor = {
        red: input.tabColor.red,
        green: input.tabColor.green,
        blue: input.tabColor.blue,
        alpha: input.tabColor.alpha,
      };
      fields.push('tabColor');
    }
    if (input.rightToLeft !== undefined) {
      properties.rightToLeft = input.rightToLeft;
      fields.push('rightToLeft');
    }

    if (fields.length === 0) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'No properties to update',
        retryable: false,
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

    const sheetData = updated.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    if (!sheetData?.properties) {
      return this.error(
        createNotFoundError({
          resourceType: 'sheet',
          resourceId: String(input.sheetId),
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
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties',
    });

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
   */
  private async handleGetSheet(input: CoreGetSheetInput): Promise<CoreResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheetData = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    if (!sheetData?.properties) {
      return this.error(
        createNotFoundError({
          resourceType: 'sheet',
          resourceId: String(input.sheetId),
          searchSuggestion: 'Use sheets_core action "list_sheets" to see available sheet IDs',
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
    } catch {
      return false;
    }
  }
}
