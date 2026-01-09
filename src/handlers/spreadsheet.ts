/**
 * ServalSheets - Spreadsheet Handler
 *
 * Handles sheets_spreadsheet tool (get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4, drive_v3 } from "googleapis";
import { BaseHandler, type HandlerContext } from "./base.js";
import type { Intent } from "../core/intent.js";
import type {
  SheetsSpreadsheetInput,
  SheetsSpreadsheetOutput,
  SheetInfo,
  SpreadsheetResponse,
} from "../schemas/index.js";
import { cacheManager, createCacheKey } from "../utils/cache-manager.js";
import { CACHE_TTL_SPREADSHEET } from "../config/constants.js";
import { ScopeValidator } from "../security/incremental-scope.js";

export class SpreadsheetHandler extends BaseHandler<
  SheetsSpreadsheetInput,
  SheetsSpreadsheetOutput
> {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi: drive_v3.Drive | undefined;

  constructor(
    context: HandlerContext,
    sheetsApi: sheets_v4.Sheets,
    driveApi?: drive_v3.Drive,
  ) {
    super("sheets_spreadsheet", context);
    this.sheetsApi = sheetsApi;
    this.driveApi = driveApi;
  }

  async handle(
    input: SheetsSpreadsheetInput,
  ): Promise<SheetsSpreadsheetOutput> {
    // Input is now the action directly (no request wrapper)
    // Track spreadsheet ID for better error messages
    // Note: create requests do not have a spreadsheetId
    const spreadsheetId =
      "spreadsheetId" in input
        ? (input as { spreadsheetId?: string }).spreadsheetId
        : undefined;
    this.trackSpreadsheetId(spreadsheetId);

    try {
      // Phase 1, Task 1.4: Infer missing parameters from context
      const req = this.inferRequestParameters(
        input,
      ) as SheetsSpreadsheetInput;

      let response: SpreadsheetResponse;
      switch (req.action) {
        case "get":
          response = await this.handleGet(req);
          break;
        case "create":
          response = await this.handleCreate(req);
          break;
        case "copy":
          response = await this.handleCopy(req);
          break;
        case "update_properties":
          response = await this.handleUpdateProperties(req);
          break;
        case "get_url":
          response = await this.handleGetUrl(req);
          break;
        case "batch_get":
          response = await this.handleBatchGet(req);
          break;
        case "get_comprehensive":
          response = await this.handleGetComprehensive(req);
          break;
        case "list":
          response = await this.handleList(req);
          break;
        default:
          response = this.error({
            code: "INVALID_PARAMS",
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }

      // Phase 1, Task 1.4: Track context after successful operation
      if (response.success && "spreadsheetId" in req) {
        this.trackContextFromRequest({
          spreadsheetId: req.spreadsheetId,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  /**
   * List user's spreadsheets
   */
  private async handleList(
    input: Extract<SheetsSpreadsheetInput, { action: "list" }>,
  ): Promise<SpreadsheetResponse> {
    if (!this.driveApi) {
      return this.error({
        code: "INTERNAL_ERROR",
        message: "Drive API not available - required for listing spreadsheets",
        details: {
          action: "list",
          requiredScope: "https://www.googleapis.com/auth/drive.readonly",
        },
        retryable: false,
        resolution:
          "Ensure Drive API client is initialized. Check Google API credentials configuration.",
        resolutionSteps: [
          "1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup",
          "2. Ensure drive.readonly scope is included in OAuth scopes",
          "3. Re-authenticate if using OAuth",
        ],
      });
    }

    const pageSize = input.maxResults || 100;
    const orderBy = input.orderBy || "modifiedTime desc";

    // Build query: filter for Google Sheets files
    let q = "mimeType='application/vnd.google-apps.spreadsheet'";
    if (input.query) {
      q += ` and ${input.query}`;
    }

    const response = await this.driveApi.files.list({
      q,
      pageSize,
      orderBy,
      fields:
        "files(id,name,createdTime,modifiedTime,webViewLink,owners,lastModifyingUser)",
      spaces: "drive",
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

    return this.success("list", {
      spreadsheets,
    });
  }

  protected createIntents(input: SheetsSpreadsheetInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    // Most spreadsheet operations don't go through batch compiler
    // Only update_properties uses batchUpdate
    if (input.action === "update_properties") {
      return [
        {
          type: "UPDATE_SHEET_PROPERTIES",
          target: { spreadsheetId: input.spreadsheetId },
          payload: {
            title: input.title,
            locale: input.locale,
            timeZone: input.timeZone,
            autoRecalc: input.autoRecalc,
          },
          metadata: {
            sourceTool: this.toolName,
            sourceAction: "update_properties",
            priority: 1,
            destructive: false,
          },
        },
      ];
    }
    return [];
  }

  private async handleGet(
    input: Extract<SheetsSpreadsheetInput, { action: "get" }>,
  ): Promise<SpreadsheetResponse> {
    const params: sheets_v4.Params$Resource$Spreadsheets$Get = {
      spreadsheetId: input.spreadsheetId,
      includeGridData: input.includeGridData ?? false,
    };
    if (input.ranges && input.ranges.length > 0) {
      params.ranges = input.ranges;
    }

    // Try cache first (5min TTL for spreadsheet metadata)
    const cacheKey = createCacheKey(
      "spreadsheet:get",
      params as unknown as Record<string, unknown>,
    );
    const cached = cacheManager.get<sheets_v4.Schema$Spreadsheet>(
      cacheKey,
      "spreadsheet",
    );

    const data =
      cached ??
      (await (async () => {
        const response = await this.sheetsApi.spreadsheets.get(params);
        const result = response.data;
        // Cache the result
        cacheManager.set(cacheKey, result, {
          ttl: CACHE_TTL_SPREADSHEET,
          namespace: "spreadsheet",
        });
        return result;
      })());

    const sheets: SheetInfo[] = (data.sheets ?? []).map(
      (s: sheets_v4.Schema$Sheet) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? "",
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
      }),
    );

    return this.success("get", {
      spreadsheet: {
        spreadsheetId: data.spreadsheetId!,
        title: data.properties?.title ?? "",
        url: data.spreadsheetUrl ?? undefined,
        locale: data.properties?.locale ?? undefined,
        timeZone: data.properties?.timeZone ?? undefined,
        sheets,
      },
    });
  }

  private async handleCreate(
    input: Extract<SheetsSpreadsheetInput, { action: "create" }>,
  ): Promise<SpreadsheetResponse> {
    // Check if create operation has required scopes
    // IMPORTANT: Creating a spreadsheet should NOT require elevated Drive scope.
    // It typically requires only Sheets + drive.file.
    const validator = new ScopeValidator({
      scopes: this.context.auth?.scopes ?? [],
    });

    const operation = "sheets_spreadsheet.create";
    const requirements = validator.getOperationRequirements(operation);

    if (requirements && !requirements.satisfied) {
      // Generate authorization URL for incremental consent
      const authUrl = validator.generateIncrementalAuthUrl(
        requirements.missing,
      );

      return this.error({
        code: "PERMISSION_DENIED",
        message: requirements.description,
        category: "auth",
        severity: "high",
        retryable: false,
        retryStrategy: "manual",
        details: {
          operation,
          requiredScopes: requirements.required,
          currentScopes: this.context.auth?.scopes ?? [],
          missingScopes: requirements.missing,
          authorizationUrl: authUrl,
          scopeCategory: requirements.category,
        },
        resolution: "Grant additional permissions to create new spreadsheets.",
        resolutionSteps: [
          "1. Visit the authorization URL to approve required scopes",
          `2. Authorization URL: ${authUrl}`,
          "3. After approving, retry the create operation",
        ],
      });
    }

    const sheetsConfig: sheets_v4.Schema$Sheet[] | undefined =
      input.sheets?.map((s) => {
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
      locale: input.locale ?? "en_US",
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
    const sheets: SheetInfo[] = (data.sheets ?? []).map(
      (s: sheets_v4.Schema$Sheet) => ({
        sheetId: s.properties?.sheetId ?? 0,
        title: s.properties?.title ?? "",
        index: s.properties?.index ?? 0,
        rowCount: s.properties?.gridProperties?.rowCount ?? 0,
        columnCount: s.properties?.gridProperties?.columnCount ?? 0,
        hidden: s.properties?.hidden ?? false,
      }),
    );

    return this.success("create", {
      spreadsheet: {
        spreadsheetId: data.spreadsheetId!,
        title: data.properties?.title ?? "",
        url: data.spreadsheetUrl ?? undefined,
        locale: data.properties?.locale ?? undefined,
        timeZone: data.properties?.timeZone ?? undefined,
        sheets,
      },
      newSpreadsheetId: data.spreadsheetId!,
    });
  }

  private async handleCopy(
    input: Extract<SheetsSpreadsheetInput, { action: "copy" }>,
  ): Promise<SpreadsheetResponse> {
    if (!this.driveApi) {
      return this.error({
        code: "INTERNAL_ERROR",
        message:
          "Drive API not available - required for spreadsheet copy operation",
        details: {
          spreadsheetId: input.spreadsheetId,
          destinationFolder: input.destinationFolderId,
          requiredScope: "https://www.googleapis.com/auth/drive.file",
        },
        retryable: false,
        resolution:
          "Ensure Drive API client is initialized with drive.file scope. Check Google API credentials configuration.",
        resolutionSteps: [
          "1. Verify GOOGLE_APPLICATION_CREDENTIALS or service account setup",
          "2. Ensure drive.file scope is included in OAuth scopes",
          "3. Restart the server after fixing credentials",
        ],
      });
    }

    // Get current title if newTitle not provided
    let title = input.newTitle;
    if (!title) {
      const current = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: "properties.title",
      });
      title = `Copy of ${current.data.properties?.title ?? "Untitled"}`;
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

    return this.success("copy", {
      spreadsheet: {
        spreadsheetId: newId,
        title: response.data.name ?? title,
        url: `https://docs.google.com/spreadsheets/d/${newId}`,
      },
      newSpreadsheetId: newId,
    });
  }

  private async handleUpdateProperties(
    input: Extract<SheetsSpreadsheetInput, { action: "update_properties" }>,
  ): Promise<SpreadsheetResponse> {
    // Build fields mask
    const fields: string[] = [];
    const properties: sheets_v4.Schema$SpreadsheetProperties = {};

    if (input.title !== undefined) {
      properties.title = input.title;
      fields.push("title");
    }
    if (input.locale !== undefined) {
      properties.locale = input.locale;
      fields.push("locale");
    }
    if (input.timeZone !== undefined) {
      properties.timeZone = input.timeZone;
      fields.push("timeZone");
    }
    if (input.autoRecalc !== undefined) {
      properties.autoRecalc = input.autoRecalc;
      fields.push("autoRecalc");
    }

    if (fields.length === 0) {
      return this.error({
        code: "INVALID_PARAMS",
        message: "No properties to update",
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
              fields: fields.join(","),
            },
          },
        ],
      },
    });

    // Fetch updated properties
    const updated = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: "spreadsheetId,properties,spreadsheetUrl",
    });

    return this.success("update_properties", {
      spreadsheet: {
        spreadsheetId: updated.data.spreadsheetId!,
        title: updated.data.properties?.title ?? "",
        url: updated.data.spreadsheetUrl ?? undefined,
        locale: updated.data.properties?.locale ?? undefined,
        timeZone: updated.data.properties?.timeZone ?? undefined,
      },
    });
  }

  private async handleGetUrl(
    input: Extract<SheetsSpreadsheetInput, { action: "get_url" }>,
  ): Promise<SpreadsheetResponse> {
    const url = `https://docs.google.com/spreadsheets/d/${input.spreadsheetId}`;
    return this.success("get_url", { url });
  }

  private async handleBatchGet(
    input: Extract<SheetsSpreadsheetInput, { action: "batch_get" }>,
  ): Promise<SpreadsheetResponse> {
    const results = await Promise.all(
      input.spreadsheetIds.map(async (id) => {
        try {
          // Try cache first (5min TTL)
          const cacheKey = createCacheKey("spreadsheet:batch_get", {
            spreadsheetId: id,
          });
          const cached = cacheManager.get<sheets_v4.Schema$Spreadsheet>(
            cacheKey,
            "spreadsheet",
          );

          const data =
            cached ??
            (await (async () => {
              const response = await this.sheetsApi.spreadsheets.get({
                spreadsheetId: id,
                fields:
                  "spreadsheetId,properties,spreadsheetUrl,sheets.properties",
              });
              const result = response.data;
              // Cache the result
              cacheManager.set(cacheKey, result, {
                ttl: CACHE_TTL_SPREADSHEET,
                namespace: "spreadsheet",
              });
              return result;
            })());
          const sheets: SheetInfo[] = (data.sheets ?? []).map(
            (s: sheets_v4.Schema$Sheet) => ({
              sheetId: s.properties?.sheetId ?? 0,
              title: s.properties?.title ?? "",
              index: s.properties?.index ?? 0,
              rowCount: s.properties?.gridProperties?.rowCount ?? 0,
              columnCount: s.properties?.gridProperties?.columnCount ?? 0,
              hidden: s.properties?.hidden ?? false,
            }),
          );

          return {
            spreadsheetId: data.spreadsheetId!,
            title: data.properties?.title ?? "",
            url: data.spreadsheetUrl ?? undefined,
            locale: data.properties?.locale ?? undefined,
            timeZone: data.properties?.timeZone ?? undefined,
            sheets,
          };
        } catch {
          // Return minimal info for failed fetches
          return {
            spreadsheetId: id,
            title: "(error)",
          };
        }
      }),
    );

    return this.success("batch_get", { spreadsheets: results });
  }

  /**
   * Get comprehensive metadata for analysis (Phase 2 optimization)
   *
   * Fetches ALL metadata in a single API call:
   * - Sheet properties (names, IDs, dimensions)
   * - Conditional formats
   * - Protected ranges
   * - Charts
   * - Named ranges
   * - Filter views
   * - Merges
   * - Sample data (optional)
   *
   * This enables analysis tools to work from cached comprehensive metadata
   * instead of making 4-15 separate API calls.
   */
  private async handleGetComprehensive(
    input: Extract<SheetsSpreadsheetInput, { action: "get_comprehensive" }>,
  ): Promise<SpreadsheetResponse> {
    const startTime = Date.now();

    // Build comprehensive fields string
    const baseFields = [
      "spreadsheetId",
      "properties",
      "spreadsheetUrl",
      "namedRanges",
      "sheets(properties,conditionalFormats,protectedRanges,charts,filterViews,basicFilter,merges)",
    ];

    // Optionally include sample grid data
    if (input.includeGridData) {
      baseFields.push(
        "sheets.data.rowData.values(dataValidation,pivotTable,formattedValue)",
      );
    }

    const fields = baseFields.join(",");

    // Build ranges for sampling if includeGridData
    let ranges: string[] | undefined;
    if (input.includeGridData) {
      // Generate sample ranges (first N rows per sheet)
      const metaResponse = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: "sheets.properties(title,sheetId)",
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
    const cacheKey = createCacheKey("spreadsheet:comprehensive", {
      spreadsheetId: input.spreadsheetId,
      includeGridData: input.includeGridData ?? false,
      maxRows: input.maxRowsPerSheet ?? 100,
    });
    const cached = cacheManager.get<sheets_v4.Schema$Spreadsheet>(
      cacheKey,
      "spreadsheet",
    );

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
          namespace: "spreadsheet",
        });

        return result;
      })());

    // Calculate stats
    const sheetsCount = data.sheets?.length ?? 0;
    const namedRangesCount = data.namedRanges?.length ?? 0;
    const totalCharts =
      data.sheets?.reduce((sum, s) => sum + (s.charts?.length ?? 0), 0) ?? 0;
    const totalConditionalFormats =
      data.sheets?.reduce(
        (sum, s) => sum + (s.conditionalFormats?.length ?? 0),
        0,
      ) ?? 0;
    const totalProtectedRanges =
      data.sheets?.reduce(
        (sum, s) => sum + (s.protectedRanges?.length ?? 0),
        0,
      ) ?? 0;

    return this.success("get_comprehensive", {
      comprehensiveMetadata: {
        spreadsheetId: data.spreadsheetId!,
        properties: data.properties as Record<string, unknown>,
        namedRanges: data.namedRanges as Array<Record<string, unknown>>,
        sheets: data.sheets?.map((s) => ({
          properties: s.properties as Record<string, unknown>,
          conditionalFormats: s.conditionalFormats as Array<
            Record<string, unknown>
          >,
          protectedRanges: s.protectedRanges as Array<Record<string, unknown>>,
          charts: s.charts as Array<Record<string, unknown>>,
          filterViews: s.filterViews as Array<Record<string, unknown>>,
          basicFilter: s.basicFilter as Record<string, unknown>,
          merges: s.merges as Array<Record<string, unknown>>,
          data: s.data as Array<Record<string, unknown>>, // Array of GridData objects
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
}
