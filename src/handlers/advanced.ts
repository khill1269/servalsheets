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
  AdvancedResponse,
} from '../schemas/index.js';
import type { RangeInput } from '../schemas/shared.js';
import {
  parseA1Notation,
  toGridRange,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';

type AdvancedSuccess = Extract<AdvancedResponse, { success: true }>;

export class AdvancedHandler extends BaseHandler<SheetsAdvancedInput, SheetsAdvancedOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_advanced', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsAdvancedInput): Promise<SheetsAdvancedOutput> {
    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(input) as SheetsAdvancedInput;

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
        case 'formula_generate':
        case 'formula_suggest':
        case 'formula_explain':
        case 'formula_optimize':
        case 'formula_fix':
        case 'formula_trace_precedents':
        case 'formula_trace_dependents':
        case 'formula_manage_named_ranges':
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
          sheetId:
            'sheetId' in inferredRequest
              ? typeof inferredRequest.sheetId === 'number'
                ? inferredRequest.sheetId
                : undefined
              : undefined,
          range:
            'range' in inferredRequest
              ? typeof inferredRequest.range === 'string'
                ? inferredRequest.range
                : undefined
              : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization) - uses base handler implementation
      const verbosity = inferredRequest.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(response, verbosity) as AdvancedResponse;

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsAdvancedInput): Intent[] {
    const req = input;
    if ('spreadsheetId' in req) {
      const intentByAction: Record<SheetsAdvancedInput['action'], Intent['type'] | null> = {
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
        // Formula intelligence actions (read-only operations, no intents needed)
        formula_generate: null,
        formula_suggest: null,
        formula_explain: null,
        formula_optimize: null,
        formula_fix: null,
        formula_trace_precedents: null,
        formula_trace_dependents: null,
        formula_manage_named_ranges: null,
      };

      const intentType = intentByAction[req.action];
      if (!intentType) {
        return [];
      }

      const destructiveActions: SheetsAdvancedInput['action'][] = [
        'delete_named_range',
        'delete_protected_range',
        'delete_metadata',
        'delete_banding',
        'delete_table',
      ];
      return [
        {
          type: intentType,
          target: { spreadsheetId: req.spreadsheetId! },
          payload: {},
          metadata: {
            sourceTool: this.toolName,
            sourceAction: req.action,
            priority: 1,
            destructive: destructiveActions.includes(req.action),
          },
        },
      ];
    }
    return [];
  }

  // ============================================================
  // Named ranges
  // ============================================================

  private async handleAddNamedRange(
    req: Extract<SheetsAdvancedInput, { action: 'add_named_range' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.toGridRange(req.spreadsheetId!, req.range!);

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            addNamedRange: {
              namedRange: {
                name: req.name!,
                range: toGridRange(gridRange),
              },
            },
          },
        ],
      },
    });

    const namedRange = response.data.replies?.[0]?.addNamedRange?.namedRange;
    return this.success('add_named_range', {
      namedRange: namedRange ? this.mapNamedRange(namedRange) : undefined,
    });
  }

  private async handleUpdateNamedRange(
    req: Extract<SheetsAdvancedInput, { action: 'update_named_range' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('update_named_range', {}, undefined, true);
    }

    const update: sheets_v4.Schema$NamedRange = {
      namedRangeId: req.namedRangeId,
      name: req.name,
    };
    if (req.range) {
      const gridRange = await this.toGridRange(req.spreadsheetId!, req.range);
      update.range = toGridRange(gridRange);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            updateNamedRange: {
              namedRange: update,
              fields: req.range ? 'name,range' : 'name',
            },
          },
        ],
      },
    });

    return this.success('update_named_range', {});
  }

  private async handleDeleteNamedRange(
    req: Extract<SheetsAdvancedInput, { action: 'delete_named_range' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('delete_named_range', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'delete_named_range',
        `Delete named range (ID: ${req.namedRangeId}) from spreadsheet ${req.spreadsheetId}. This action cannot be undone.`
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
        operationType: 'delete_named_range',
        isDestructive: true,
        spreadsheetId: req.spreadsheetId,
      },
      req.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            deleteNamedRange: { namedRangeId: req.namedRangeId! },
          },
        ],
      },
    });

    return this.success('delete_named_range', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleListNamedRanges(
    req: Extract<SheetsAdvancedInput, { action: 'list_named_ranges' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      fields: 'namedRanges',
    });
    const namedRanges = (response.data.namedRanges ?? []).map((n) => this.mapNamedRange(n));
    return this.success('list_named_ranges', { namedRanges });
  }

  private async handleGetNamedRange(
    req: Extract<SheetsAdvancedInput, { action: 'get_named_range' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      fields: 'namedRanges',
    });
    const match = (response.data.namedRanges ?? []).find((n) => n.name === req.name);
    if (!match) {
      return this.notFoundError('Named range', req.name!);
    }
    return this.success('get_named_range', {
      namedRange: this.mapNamedRange(match),
    });
  }

  // ============================================================
  // Protected ranges
  // ============================================================

  private async handleAddProtectedRange(
    req: Extract<SheetsAdvancedInput, { action: 'add_protected_range' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.toGridRange(req.spreadsheetId!, req.range!);
    const request: sheets_v4.Schema$ProtectedRange = {
      range: toGridRange(gridRange),
      description: req.description,
      warningOnly: req.warningOnly ?? false,
      editors: req.editors,
    };

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            addProtectedRange: { protectedRange: request },
          },
        ],
      },
    });

    const protectedRange = response.data.replies?.[0]?.addProtectedRange?.protectedRange;
    return this.success('add_protected_range', {
      protectedRange: protectedRange ? this.mapProtectedRange(protectedRange) : undefined,
    });
  }

  private async handleUpdateProtectedRange(
    req: Extract<SheetsAdvancedInput, { action: 'update_protected_range' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('update_protected_range', {}, undefined, true);
    }

    const update: sheets_v4.Schema$ProtectedRange = {
      protectedRangeId: req.protectedRangeId,
      description: req.description,
      warningOnly: req.warningOnly,
      editors: req.editors,
    };
    const fields: string[] = [];
    if (req.description !== undefined) fields.push('description');
    if (req.warningOnly !== undefined) fields.push('warningOnly');
    if (req.editors !== undefined) fields.push('editors');
    if (req.range) {
      const gridRange = await this.toGridRange(req.spreadsheetId!, req.range);
      update.range = toGridRange(gridRange);
      fields.push('range');
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            updateProtectedRange: {
              protectedRange: update,
              fields: fields.join(','),
            },
          },
        ],
      },
    });

    return this.success('update_protected_range', {});
  }

  private async handleDeleteProtectedRange(
    req: Extract<SheetsAdvancedInput, { action: 'delete_protected_range' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('delete_protected_range', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'delete_protected_range',
        `Delete protected range (ID: ${req.protectedRangeId}) from spreadsheet ${req.spreadsheetId}. This will remove all protection settings. This action cannot be undone.`
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
        operationType: 'delete_protected_range',
        isDestructive: true,
        spreadsheetId: req.spreadsheetId,
      },
      req.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            deleteProtectedRange: { protectedRangeId: req.protectedRangeId },
          },
        ],
      },
    });

    return this.success('delete_protected_range', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleListProtectedRanges(
    req: Extract<SheetsAdvancedInput, { action: 'list_protected_ranges' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      fields: 'sheets.protectedRanges,sheets.properties.sheetId',
    });

    const ranges: NonNullable<AdvancedSuccess['protectedRanges']> = [];
    for (const sheet of response.data.sheets ?? []) {
      if (req.sheetId !== undefined && sheet.properties?.sheetId !== req.sheetId) continue;
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
    req: Extract<SheetsAdvancedInput, { action: 'set_metadata' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            createDeveloperMetadata: {
              developerMetadata: {
                metadataKey: req.metadataKey,
                metadataValue: req.metadataValue,
                visibility: req.visibility ?? 'DOCUMENT',
                location: req.location,
              },
            },
          },
        ],
      },
    });

    const metaId =
      response.data.replies?.[0]?.createDeveloperMetadata?.developerMetadata?.metadataId;
    return this.success('set_metadata', { metadataId: metaId ?? undefined });
  }

  private async handleGetMetadata(
    req: Extract<SheetsAdvancedInput, { action: 'get_metadata' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.developerMetadata.search({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        dataFilters: req.metadataKey
          ? [
              {
                developerMetadataLookup: { metadataKey: req.metadataKey },
              },
            ]
          : [
              {
                developerMetadataLookup: {},
              },
            ],
      },
    });

    const metadataList = (response.data.matchedDeveloperMetadata ?? []).map((m) => ({
      metadataId: m.developerMetadata?.metadataId ?? 0,
      metadataKey: m.developerMetadata?.metadataKey ?? '',
      metadataValue: m.developerMetadata?.metadataValue ?? '',
    }));

    return this.success('get_metadata', { metadataList });
  }

  private async handleDeleteMetadata(
    req: Extract<SheetsAdvancedInput, { action: 'delete_metadata' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('delete_metadata', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'delete_metadata',
        `Delete developer metadata (ID: ${req.metadataId}) from spreadsheet ${req.spreadsheetId}. This action cannot be undone.`
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
        operationType: 'delete_metadata',
        isDestructive: true,
        spreadsheetId: req.spreadsheetId,
      },
      req.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            deleteDeveloperMetadata: {
              dataFilter: {
                developerMetadataLookup: { metadataId: req.metadataId },
              },
            },
          },
        ],
      },
    });

    return this.success('delete_metadata', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  // ============================================================
  // Banding
  // ============================================================

  private async handleAddBanding(
    req: Extract<SheetsAdvancedInput, { action: 'add_banding' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.toGridRange(req.spreadsheetId!, req.range!);

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            addBanding: {
              bandedRange: {
                range: toGridRange(gridRange),
                rowProperties: req.rowProperties,
                columnProperties: req.columnProperties,
              },
            },
          },
        ],
      },
    });

    const bandedRangeId = response.data.replies?.[0]?.addBanding?.bandedRange?.bandedRangeId;
    return this.success('add_banding', {
      bandedRangeId: bandedRangeId ?? undefined,
    });
  }

  private async handleUpdateBanding(
    req: Extract<SheetsAdvancedInput, { action: 'update_banding' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('update_banding', {}, undefined, true);
    }

    const fields: string[] = [];
    if (req.rowProperties !== undefined) fields.push('rowProperties');
    if (req.columnProperties !== undefined) fields.push('columnProperties');

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            updateBanding: {
              bandedRange: {
                bandedRangeId: req.bandedRangeId,
                rowProperties: req.rowProperties,
                columnProperties: req.columnProperties,
              },
              fields: fields.join(','),
            },
          },
        ],
      },
    });

    return this.success('update_banding', {});
  }

  private async handleDeleteBanding(
    req: Extract<SheetsAdvancedInput, { action: 'delete_banding' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('delete_banding', {}, undefined, true);
    }

    // Request confirmation if elicitation available
    if (this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'delete_banding',
        `Delete banding (ID: ${req.bandedRangeId}) from spreadsheet ${req.spreadsheetId}. This will remove alternating color formatting. This action cannot be undone.`
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
        operationType: 'delete_banding',
        isDestructive: true,
        spreadsheetId: req.spreadsheetId,
      },
      req.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            deleteBanding: { bandedRangeId: req.bandedRangeId },
          },
        ],
      },
    });

    return this.success('delete_banding', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleListBanding(
    req: Extract<SheetsAdvancedInput, { action: 'list_banding' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      fields: 'sheets.bandedRanges,sheets.properties.sheetId',
    });

    const bandedRanges: NonNullable<AdvancedSuccess['bandedRanges']> = [];
    for (const sheet of response.data.sheets ?? []) {
      if (req.sheetId !== undefined && sheet.properties?.sheetId !== req.sheetId) continue;
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

  private async toGridRange(spreadsheetId: string, range: RangeInput): Promise<GridRangeInput> {
    const a1 = await this.resolveRange(spreadsheetId, range);
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };
  }

  private mapNamedRange(
    named: sheets_v4.Schema$NamedRange
  ): NonNullable<AdvancedSuccess['namedRange']> {
    return {
      namedRangeId: named.namedRangeId ?? '',
      name: named.name ?? '',
      range: this.toGridRangeOutput(named.range ?? { sheetId: 0 }),
    };
  }

  private mapProtectedRange(
    pr: sheets_v4.Schema$ProtectedRange
  ): NonNullable<AdvancedSuccess['protectedRange']> {
    return {
      protectedRangeId: pr.protectedRangeId ?? 0,
      range: this.toGridRangeOutput(pr.range ?? { sheetId: 0 }),
      description: pr.description ?? undefined,
      warningOnly: pr.warningOnly ?? false,
      requestingUserCanEdit: pr.requestingUserCanEdit ?? false,
      editors: pr.editors
        ? {
            groups: pr.editors.groups?.filter((g): g is string => g !== null) ?? undefined,
            users: pr.editors.users?.filter((u): u is string => u !== null) ?? undefined,
            domainUsersCanEdit: pr.editors.domainUsersCanEdit ?? undefined,
          }
        : undefined,
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
  private featureUnavailable(action: SheetsAdvancedInput['action']): AdvancedResponse {
    return this.error({
      code: 'FEATURE_UNAVAILABLE',
      message: `${action} is unavailable in this server build. This feature requires API support that is not yet available.`,
      details: {
        action,
        reason: action.includes('table')
          ? 'Google Sheets Tables API is not yet generally available'
          : 'Feature unavailable',
      },
      retryable: false,
      suggestedFix:
        'Use Google Sheets UI or extend the handler when API support becomes available.',
    });
  }
}
