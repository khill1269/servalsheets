/**
 * ServalSheets - Spreadsheet Handler
 * 
 * Handles sheets_spreadsheet tool (get, create, copy, update_properties, get_url, batch_get)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4, drive_v3 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { 
  SheetsSpreadsheetInput, 
  SheetsSpreadsheetOutput,
  SheetInfo,
} from '../schemas/index.js';

export class SpreadsheetHandler extends BaseHandler<SheetsSpreadsheetInput, SheetsSpreadsheetOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi: drive_v3.Drive | undefined;

  constructor(
    context: HandlerContext, 
    sheetsApi: sheets_v4.Sheets,
    driveApi?: drive_v3.Drive
  ) {
    super('sheets_spreadsheet', context);
    this.sheetsApi = sheetsApi;
    this.driveApi = driveApi;
  }

  async handle(input: SheetsSpreadsheetInput): Promise<SheetsSpreadsheetOutput> {
    try {
      switch (input.action) {
        case 'get':
          return await this.handleGet(input);
        case 'create':
          return await this.handleCreate(input);
        case 'copy':
          return await this.handleCopy(input);
        case 'update_properties':
          return await this.handleUpdateProperties(input);
        case 'get_url':
          return await this.handleGetUrl(input);
        case 'batch_get':
          return await this.handleBatchGet(input);
        default:
          return this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(input as { action: string }).action}`,
            retryable: false,
          });
      }
    } catch (err) {
      return this.mapError(err);
    }
  }

  protected createIntents(input: SheetsSpreadsheetInput): Intent[] {
    // Most spreadsheet operations don't go through batch compiler
    // Only update_properties uses batchUpdate
    if (input.action === 'update_properties') {
      return [{
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
      }];
    }
    return [];
  }

  private async handleGet(
    input: Extract<SheetsSpreadsheetInput, { action: 'get' }>
  ): Promise<SheetsSpreadsheetOutput> {
    const params: sheets_v4.Params$Resource$Spreadsheets$Get = {
      spreadsheetId: input.spreadsheetId,
      includeGridData: input.includeGridData ?? false,
    };
    if (input.ranges && input.ranges.length > 0) {
      params.ranges = input.ranges;
    }

    const response = await this.sheetsApi.spreadsheets.get(params);
    const data = response.data;
    
    const sheets: SheetInfo[] = (data.sheets ?? []).map((s: sheets_v4.Schema$Sheet) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? '',
      index: s.properties?.index ?? 0,
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
      hidden: s.properties?.hidden ?? false,
      tabColor: s.properties?.tabColor ? {
        red: s.properties.tabColor.red ?? 0,
        green: s.properties.tabColor.green ?? 0,
        blue: s.properties.tabColor.blue ?? 0,
        alpha: s.properties.tabColor.alpha ?? 1,
      } : undefined,
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

  private async handleCreate(
    input: Extract<SheetsSpreadsheetInput, { action: 'create' }>
  ): Promise<SheetsSpreadsheetOutput> {
    const sheetsConfig: sheets_v4.Schema$Sheet[] | undefined = input.sheets?.map(s => {
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

  private async handleCopy(
    input: Extract<SheetsSpreadsheetInput, { action: 'copy' }>
  ): Promise<SheetsSpreadsheetOutput> {
    if (!this.driveApi) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Drive API not available for copy operation',
        retryable: false,
        suggestedFix: 'Ensure the server has Drive API access enabled',
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

  private async handleUpdateProperties(
    input: Extract<SheetsSpreadsheetInput, { action: 'update_properties' }>
  ): Promise<SheetsSpreadsheetOutput> {
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
        requests: [{
          updateSpreadsheetProperties: {
            properties,
            fields: fields.join(','),
          },
        }],
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

  private async handleGetUrl(
    input: Extract<SheetsSpreadsheetInput, { action: 'get_url' }>
  ): Promise<SheetsSpreadsheetOutput> {
    const url = `https://docs.google.com/spreadsheets/d/${input.spreadsheetId}`;
    return this.success('get_url', { url });
  }

  private async handleBatchGet(
    input: Extract<SheetsSpreadsheetInput, { action: 'batch_get' }>
  ): Promise<SheetsSpreadsheetOutput> {
    const results = await Promise.all(
      input.spreadsheetIds.map(async (id) => {
        try {
          const response = await this.sheetsApi.spreadsheets.get({
            spreadsheetId: id,
            fields: 'spreadsheetId,properties,spreadsheetUrl,sheets.properties',
          });
          
          const data = response.data;
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
}
