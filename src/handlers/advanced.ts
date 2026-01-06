/**
 * ServalSheets - Advanced Handler
 *
 * Handles sheets_advanced tool (named ranges, protections, metadata, banding)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsAdvancedInput,
  SheetsAdvancedOutput,
  AdvancedAction,
  AdvancedResponse,
} from '../schemas/index.js';
import type { RangeInput } from '../schemas/shared.js';
import { parseA1Notation, toGridRange, type GridRangeInput } from '../utils/google-sheets-helpers.js';
import { RangeResolutionError } from '../core/range-resolver.js';

type AdvancedSuccess = Extract<AdvancedResponse, { success: true }>;

export class AdvancedHandler extends BaseHandler<SheetsAdvancedInput, SheetsAdvancedOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_advanced', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsAdvancedInput): Promise<SheetsAdvancedOutput> {
    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(input.request) as AdvancedAction;

    try {
      const req = inferredRequest;
      let response: AdvancedResponse;
      switch (req.action) {
        case 'add_named_range':
          response = await this.handleAddNamedRange(req);
          break;
        case 'update_named_range':
          response = await this.handleUpdateNamedRange(req);
          break;
        case 'delete_named_range':
          response = await this.handleDeleteNamedRange(req);
          break;
        case 'list_named_ranges':
          response = await this.handleListNamedRanges(req);
          break;
        case 'get_named_range':
          response = await this.handleGetNamedRange(req);
          break;
        case 'add_protected_range':
          response = await this.handleAddProtectedRange(req);
          break;
        case 'update_protected_range':
          response = await this.handleUpdateProtectedRange(req);
          break;
        case 'delete_protected_range':
          response = await this.handleDeleteProtectedRange(req);
          break;
        case 'list_protected_ranges':
          response = await this.handleListProtectedRanges(req);
          break;
        case 'set_metadata':
          response = await this.handleSetMetadata(req);
          break;
        case 'get_metadata':
          response = await this.handleGetMetadata(req);
          break;
        case 'delete_metadata':
          response = await this.handleDeleteMetadata(req);
          break;
        case 'add_banding':
          response = await this.handleAddBanding(req);
          break;
        case 'update_banding':
          response = await this.handleUpdateBanding(req);
          break;
        case 'delete_banding':
          response = await this.handleDeleteBanding(req);
          break;
        case 'list_banding':
          response = await this.handleListBanding(req);
          break;
        case 'create_table':
        case 'delete_table':
        case 'list_tables':
          response = this.featureUnavailable(req.action);
          break;
        default:
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(req as { action: string }).action}`,
            retryable: false,
          });
      }

      // Track context on success
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: inferredRequest.spreadsheetId,
          sheetId: 'sheetId' in inferredRequest ? (typeof inferredRequest.sheetId === 'number' ? inferredRequest.sheetId : undefined) : undefined,
          range: 'range' in inferredRequest ? (typeof inferredRequest.range === 'string' ? inferredRequest.range : undefined) : undefined,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsAdvancedInput): Intent[] {
    const req = input.request;
    if ('spreadsheetId' in req) {
      const intentByAction: Record<AdvancedAction['action'], Intent['type'] | null> = {
        add_named_range: 'ADD_NAMED_RANGE',
        update_named_range: 'UPDATE_NAMED_RANGE',
        delete_named_range: 'DELETE_NAMED_RANGE',
        list_named_ranges: null,
        get_named_range: null,
        add_protected_range: 'ADD_PROTECTED_RANGE',
        update_protected_range: 'UPDATE_PROTECTED_RANGE',
        delete_protected_range: 'DELETE_PROTECTED_RANGE',
        list_protected_ranges: null,
        set_metadata: 'CREATE_DEVELOPER_METADATA',
        get_metadata: null,
        delete_metadata: 'DELETE_DEVELOPER_METADATA',
        add_banding: 'ADD_BANDING',
        update_banding: 'UPDATE_BANDING',
        delete_banding: 'DELETE_BANDING',
        list_banding: null,
        create_table: null,
        delete_table: null,
        list_tables: null,
      };

      const intentType = intentByAction[req.action];
      if (!intentType) {
        return [];
      }

      const destructiveActions: AdvancedAction['action'][] = [
        'delete_named_range',
        'delete_protected_range',
        'delete_metadata',
        'delete_banding',
        'delete_table',
      ];
      return [{
        type: intentType,
        target: { spreadsheetId: req.spreadsheetId },
        payload: {},
        metadata: {
          sourceTool: this.toolName,
          sourceAction: req.action,
          priority: 1,
          destructive: destructiveActions.includes(req.action),
        },
      }];
    }
    return [];
  }

  // ============================================================
  // Named ranges
  // ============================================================

  private async handleAddNamedRange(
    input: Extract<AdvancedAction, { action: 'add_named_range' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.toGridRange(input.spreadsheetId, input.range);

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          addNamedRange: {
            namedRange: {
              name: input.name,
              range: toGridRange(gridRange),
            },
          },
        }],
      },
    });

    const namedRange = response.data.replies?.[0]?.addNamedRange?.namedRange;
    return this.success('add_named_range', {
      namedRange: namedRange ? this.mapNamedRange(namedRange) : undefined,
    });
  }

  private async handleUpdateNamedRange(
    input: Extract<AdvancedAction, { action: 'update_named_range' }>
  ): Promise<AdvancedResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_named_range', {}, undefined, true);
    }

    const update: sheets_v4.Schema$NamedRange = {
      namedRangeId: input.namedRangeId,
      name: input.name,
    };
    if (input.range) {
      const gridRange = await this.toGridRange(input.spreadsheetId, input.range);
      update.range = toGridRange(gridRange);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateNamedRange: {
            namedRange: update,
            fields: '*',
          },
        }],
      },
    });

    return this.success('update_named_range', {});
  }

  private async handleDeleteNamedRange(
    input: Extract<AdvancedAction, { action: 'delete_named_range' }>
  ): Promise<AdvancedResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_named_range', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteNamedRange: { namedRangeId: input.namedRangeId },
        }],
      },
    });

    return this.success('delete_named_range', {});
  }

  private async handleListNamedRanges(
    input: Extract<AdvancedAction, { action: 'list_named_ranges' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'namedRanges',
    });
    const namedRanges = (response.data.namedRanges ?? []).map(n => this.mapNamedRange(n));
    return this.success('list_named_ranges', { namedRanges });
  }

  private async handleGetNamedRange(
    input: Extract<AdvancedAction, { action: 'get_named_range' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'namedRanges',
    });
    const match = (response.data.namedRanges ?? []).find(n => n.name === input.name);
    if (!match) {
      return this.error({
        code: 'SHEET_NOT_FOUND',
        message: `Named range ${input.name} not found`,
        retryable: false,
      });
    }
    return this.success('get_named_range', { namedRange: this.mapNamedRange(match) });
  }

  // ============================================================
  // Protected ranges
  // ============================================================

  private async handleAddProtectedRange(
    input: Extract<AdvancedAction, { action: 'add_protected_range' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.toGridRange(input.spreadsheetId, input.range);
    const request: sheets_v4.Schema$ProtectedRange = {
      range: toGridRange(gridRange),
      description: input.description,
      warningOnly: input.warningOnly ?? false,
      editors: input.editors,
    };

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          addProtectedRange: { protectedRange: request },
        }],
      },
    });

    const protectedRange = response.data.replies?.[0]?.addProtectedRange?.protectedRange;
    return this.success('add_protected_range', {
      protectedRange: protectedRange ? this.mapProtectedRange(protectedRange) : undefined,
    });
  }

  private async handleUpdateProtectedRange(
    input: Extract<AdvancedAction, { action: 'update_protected_range' }>
  ): Promise<AdvancedResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_protected_range', {}, undefined, true);
    }

    const update: sheets_v4.Schema$ProtectedRange = {
      protectedRangeId: input.protectedRangeId,
      description: input.description,
      warningOnly: input.warningOnly,
      editors: input.editors,
    };
    if (input.range) {
      const gridRange = await this.toGridRange(input.spreadsheetId, input.range);
      update.range = toGridRange(gridRange);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateProtectedRange: {
            protectedRange: update,
            fields: '*',
          },
        }],
      },
    });

    return this.success('update_protected_range', {});
  }

  private async handleDeleteProtectedRange(
    input: Extract<AdvancedAction, { action: 'delete_protected_range' }>
  ): Promise<AdvancedResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_protected_range', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteProtectedRange: { protectedRangeId: input.protectedRangeId },
        }],
      },
    });

    return this.success('delete_protected_range', {});
  }

  private async handleListProtectedRanges(
    input: Extract<AdvancedAction, { action: 'list_protected_ranges' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.protectedRanges,sheets.properties.sheetId',
    });

    const ranges: NonNullable<AdvancedSuccess['protectedRanges']> = [];
    for (const sheet of response.data.sheets ?? []) {
      if (input.sheetId !== undefined && sheet.properties?.sheetId !== input.sheetId) continue;
      for (const pr of sheet.protectedRanges ?? []) {
        ranges.push(this.mapProtectedRange(pr));
      }
    }

    return this.success('list_protected_ranges', { protectedRanges: ranges });
  }

  // ============================================================
  // Metadata
  // ============================================================

  private async handleSetMetadata(
    input: Extract<AdvancedAction, { action: 'set_metadata' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          createDeveloperMetadata: {
            developerMetadata: {
              metadataKey: input.metadataKey,
              metadataValue: input.metadataValue,
              visibility: input.visibility ?? 'DOCUMENT',
              location: input.location,
            },
          },
        }],
      },
    });

    const metaId = response.data.replies?.[0]?.createDeveloperMetadata?.developerMetadata?.metadataId;
    return this.success('set_metadata', { metadataId: metaId ?? undefined });
  }

  private async handleGetMetadata(
    input: Extract<AdvancedAction, { action: 'get_metadata' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.developerMetadata.search({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        dataFilters: input.metadataKey ? [{
          developerMetadataLookup: { metadataKey: input.metadataKey },
        }] : [{
          developerMetadataLookup: {},
        }],
      },
    });

    const metadata = (response.data.matchedDeveloperMetadata ?? []).map(m => ({
      metadataId: m.developerMetadata?.metadataId ?? 0,
      metadataKey: m.developerMetadata?.metadataKey ?? '',
      metadataValue: m.developerMetadata?.metadataValue ?? '',
      visibility: m.developerMetadata?.visibility ?? '',
      location: {
        locationType: m.developerMetadata?.location?.locationType ?? '',
        sheetId: m.developerMetadata?.location?.sheetId ?? undefined,
      },
    }));

    return this.success('get_metadata', { metadata });
  }

  private async handleDeleteMetadata(
    input: Extract<AdvancedAction, { action: 'delete_metadata' }>
  ): Promise<AdvancedResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_metadata', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteDeveloperMetadata: {
            dataFilter: {
              developerMetadataLookup: { metadataId: input.metadataId },
            },
          },
        }],
      },
    });

    return this.success('delete_metadata', {});
  }

  // ============================================================
  // Banding
  // ============================================================

  private async handleAddBanding(
    input: Extract<AdvancedAction, { action: 'add_banding' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.toGridRange(input.spreadsheetId, input.range);

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          addBanding: {
            bandedRange: {
              range: toGridRange(gridRange),
              rowProperties: input.rowProperties,
              columnProperties: input.columnProperties,
            },
          },
        }],
      },
    });

    const bandedRangeId = response.data.replies?.[0]?.addBanding?.bandedRange?.bandedRangeId;
    return this.success('add_banding', { bandedRangeId: bandedRangeId ?? undefined });
  }

  private async handleUpdateBanding(
    input: Extract<AdvancedAction, { action: 'update_banding' }>
  ): Promise<AdvancedResponse> {
    if (input.safety?.dryRun) {
      return this.success('update_banding', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          updateBanding: {
            bandedRange: {
              bandedRangeId: input.bandedRangeId,
              rowProperties: input.rowProperties,
              columnProperties: input.columnProperties,
            },
            fields: '*',
          },
        }],
      },
    });

    return this.success('update_banding', {});
  }

  private async handleDeleteBanding(
    input: Extract<AdvancedAction, { action: 'delete_banding' }>
  ): Promise<AdvancedResponse> {
    if (input.safety?.dryRun) {
      return this.success('delete_banding', {}, undefined, true);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{
          deleteBanding: { bandedRangeId: input.bandedRangeId },
        }],
      },
    });

    return this.success('delete_banding', {});
  }

  private async handleListBanding(
    input: Extract<AdvancedAction, { action: 'list_banding' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.bandedRanges,sheets.properties.sheetId',
    });

    const bandedRanges: NonNullable<AdvancedSuccess['bandedRanges']> = [];
    for (const sheet of response.data.sheets ?? []) {
      if (input.sheetId !== undefined && sheet.properties?.sheetId !== input.sheetId) continue;
      for (const br of sheet.bandedRanges ?? []) {
        bandedRanges.push({
          bandedRangeId: br.bandedRangeId ?? 0,
          range: this.toGridRangeOutput(br.range ?? { sheetId: sheet.properties?.sheetId ?? 0 }),
        });
      }
    }

    return this.success('list_banding', { bandedRanges });
  }

  // ============================================================
  // Helpers
  // ============================================================

  private async toGridRange(
    spreadsheetId: string,
    range: RangeInput
  ): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, range);
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName);

    return {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };
  }

  private async getSheetId(spreadsheetId: string, sheetName?: string): Promise<number> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheets = response.data.sheets ?? [];
    if (!sheetName) {
      return sheets[0]?.properties?.sheetId ?? 0;
    }

    const match = sheets.find(s => s.properties?.title === sheetName);
    if (!match) {
      throw new RangeResolutionError(
        `Sheet "${sheetName}" not found`,
        'SHEET_NOT_FOUND',
        { sheetName, spreadsheetId },
        false
      );
    }
    return match.properties?.sheetId ?? 0;
  }

  private mapNamedRange(named: sheets_v4.Schema$NamedRange): NonNullable<AdvancedSuccess['namedRange']> {
    return {
      namedRangeId: named.namedRangeId ?? '',
      name: named.name ?? '',
      range: this.toGridRangeOutput(named.range ?? { sheetId: 0 }),
    };
  }

  private mapProtectedRange(pr: sheets_v4.Schema$ProtectedRange): NonNullable<AdvancedSuccess['protectedRange']> {
    return {
      protectedRangeId: pr.protectedRangeId ?? 0,
      range: this.toGridRangeOutput(pr.range ?? { sheetId: 0 }),
      description: pr.description ?? undefined,
      warningOnly: pr.warningOnly ?? false,
      requestingUserCanEdit: pr.requestingUserCanEdit ?? false,
      editors: pr.editors ? {
        groups: pr.editors.groups?.filter((g): g is string => g !== null) ?? undefined,
        users: pr.editors.users?.filter((u): u is string => u !== null) ?? undefined,
        domainUsersCanEdit: pr.editors.domainUsersCanEdit ?? undefined,
      } : undefined,
    };
  }

  /**
   * Convert Google Sheets Schema$GridRange (with nullable fields) to our GridRange type
   */
  private toGridRangeOutput(range: sheets_v4.Schema$GridRange): {
    sheetId: number;
    startRowIndex?: number;
    endRowIndex?: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
  } {
    return {
      sheetId: range.sheetId ?? 0,
      startRowIndex: range.startRowIndex ?? undefined,
      endRowIndex: range.endRowIndex ?? undefined,
      startColumnIndex: range.startColumnIndex ?? undefined,
      endColumnIndex: range.endColumnIndex ?? undefined,
    };
  }

  /**
   * Return error for unavailable features
   *
   * Currently unavailable:
   * - create_table, delete_table, list_tables: Requires Google Sheets Tables API
   *   (not yet generally available in Sheets API v4)
   */
  private featureUnavailable(action: AdvancedAction['action']): AdvancedResponse {
    return this.error({
      code: 'FEATURE_UNAVAILABLE',
      message: `${action} is not implemented in this server build. This feature requires API support that is not yet available.`,
      details: {
        action,
        reason: action.includes('table')
          ? 'Google Sheets Tables API is not yet generally available'
          : 'Feature not implemented',
      },
      retryable: false,
      suggestedFix: 'Use Google Sheets UI or extend the handler when API support becomes available.',
    });
  }
}
