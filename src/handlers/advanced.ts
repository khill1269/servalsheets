/**
 * ServalSheets - Advanced Handler
 *
 * Handles sheets_advanced tool (named ranges, protections, metadata, banding)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsAdvancedInput,
  SheetsAdvancedOutput,
  AdvancedResponse,
  AdvancedRequest,
} from '../schemas/index.js';
import {
  buildA1Notation,
  parseA1Notation,
  buildGridRangeInput,
  toGridRange,
  type GridRangeInput,
  buildPersonChip,
  buildDriveChip,
  buildRichLinkChip,
  parseChipRuns,
  type PersonChipDisplayFormat,
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
    const req = this.inferRequestParameters(unwrapRequest<SheetsAdvancedInput['request']>(input));

    try {
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
          response = await this.handleCreateTable(req);
          break;
        case 'delete_table':
          response = await this.handleDeleteTable(req);
          break;
        case 'list_tables':
          response = await this.handleListTables(req);
          break;
        case 'update_table':
          response = await this.handleUpdateTable(req);
          break;
        case 'rename_table_column':
          response = await this.handleRenameTableColumn(req);
          break;
        case 'set_table_column_properties':
          response = await this.handleSetTableColumnProperties(req);
          break;
        // Smart Chips (June 2025 API)
        case 'add_person_chip':
          response = await this.handleAddPersonChip(req);
          break;
        case 'add_drive_chip':
          response = await this.handleAddDriveChip(req);
          break;
        case 'add_rich_link_chip':
          response = await this.handleAddRichLinkChip(req);
          break;
        case 'list_chips':
          response = await this.handleListChips(req);
          break;
        default: {
          const _exhaustiveCheck: never = req;
          response = this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
        }
      }

      // Track context on success
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: req.spreadsheetId,
          sheetId:
            'sheetId' in req
              ? typeof req.sheetId === 'number'
                ? req.sheetId
                : undefined
              : undefined,
          range:
            'range' in req ? (typeof req.range === 'string' ? req.range : undefined) : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization) - uses base handler implementation
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(response, verbosity) as AdvancedResponse;

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsAdvancedInput): Intent[] {
    const req = unwrapRequest<SheetsAdvancedInput['request']>(input);
    if ('spreadsheetId' in req) {
      const intentByAction: Record<
        SheetsAdvancedInput['request']['action'],
        Intent['type'] | null
      > = {
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
        update_table: null,
        rename_table_column: null,
        set_table_column_properties: null,
        // Smart Chips
        add_person_chip: 'SET_VALUES',
        add_drive_chip: 'SET_VALUES',
        add_rich_link_chip: 'SET_VALUES',
        list_chips: null,
      };

      const intentType = intentByAction[req.action];
      if (!intentType) {
        return [];
      }

      const destructiveActions: AdvancedRequest['action'][] = [
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'add_named_range' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.rangeToGridRange(req.spreadsheetId!, req.range!, this.sheetsApi);

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

    const namedRange = response.data?.replies?.[0]?.addNamedRange?.namedRange;
    return this.success('add_named_range', {
      namedRange: namedRange ? this.mapNamedRange(namedRange) : undefined,
    });
  }

  private async handleUpdateNamedRange(
    req: Extract<SheetsAdvancedInput['request'], { action: 'update_named_range' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('update_named_range', {}, undefined, true);
    }

    const update: sheets_v4.Schema$NamedRange = {
      namedRangeId: req.namedRangeId,
      name: req.name,
    };
    if (req.range) {
      const gridRange = await this.rangeToGridRange(req.spreadsheetId!, req.range, this.sheetsApi);
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'delete_named_range' }>
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
          suggestedFix: 'Review the operation requirements and try again',
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'list_named_ranges' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      fields: 'namedRanges',
    });
    const namedRanges = (response.data.namedRanges ?? []).map((n) => this.mapNamedRange(n));
    return this.success('list_named_ranges', { namedRanges });
  }

  private async handleGetNamedRange(
    req: Extract<SheetsAdvancedInput['request'], { action: 'get_named_range' }>
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'add_protected_range' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.rangeToGridRange(req.spreadsheetId!, req.range!, this.sheetsApi);
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

    const protectedRange = response.data?.replies?.[0]?.addProtectedRange?.protectedRange;
    return this.success('add_protected_range', {
      protectedRange: protectedRange ? this.mapProtectedRange(protectedRange) : undefined,
    });
  }

  private async handleUpdateProtectedRange(
    req: Extract<SheetsAdvancedInput['request'], { action: 'update_protected_range' }>
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
      const gridRange = await this.rangeToGridRange(req.spreadsheetId!, req.range, this.sheetsApi);
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'delete_protected_range' }>
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
          suggestedFix: 'Review the operation requirements and try again',
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'list_protected_ranges' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      fields: 'sheets.protectedRanges,sheets.properties(sheetId,title)',
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'set_metadata' }>
  ): Promise<AdvancedResponse> {
    // Build location - default to spreadsheet-level if not specified
    const location: sheets_v4.Schema$DeveloperMetadataLocation = req.location ?? {
      spreadsheet: true,
    };

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
                location,
              },
            },
          },
        ],
      },
    });

    const metaId =
      response.data?.replies?.[0]?.createDeveloperMetadata?.developerMetadata?.metadataId;
    return this.success('set_metadata', { metadataId: metaId ?? undefined });
  }

  private async handleGetMetadata(
    req: Extract<SheetsAdvancedInput['request'], { action: 'get_metadata' }>
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'delete_metadata' }>
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
          suggestedFix: 'Review the operation requirements and try again',
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'add_banding' }>
  ): Promise<AdvancedResponse> {
    // Pre-validation: Catch common LLM parameter errors before API call
    if (!req.range) {
      return this.error({
        code: 'INVALID_PARAMS',
        message:
          'Missing required "range" parameter. Specify the range to apply banding (e.g., "Sheet1!A1:D10").',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Validate that at least one of rowProperties or columnProperties is provided
    if (!req.rowProperties && !req.columnProperties) {
      return this.error({
        code: 'INVALID_PARAMS',
        message:
          'Banding requires either "rowProperties" or "columnProperties". ' +
          'Example: rowProperties: { headerColor: { red: 0.2, green: 0.4, blue: 0.8 }, ' +
          'firstBandColor: { red: 1, green: 1, blue: 1 }, secondBandColor: { red: 0.9, green: 0.9, blue: 0.9 } }',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Validate color values are in 0-1 range (common LLM mistake: using 0-255)
    const validateColors = (
      props: typeof req.rowProperties | typeof req.columnProperties,
      propName: string
    ): AdvancedResponse | null => {
      if (!props) return null;
      const colorFields = [
        'headerColor',
        'firstBandColor',
        'secondBandColor',
        'footerColor',
      ] as const;
      for (const field of colorFields) {
        const color = props[field];
        if (color) {
          const { red = 0, green = 0, blue = 0 } = color;
          if (red > 1 || green > 1 || blue > 1) {
            return this.error({
              code: 'INVALID_PARAMS',
              message:
                `Color values in ${propName}.${field} must be between 0 and 1 (not 0-255). ` +
                `Received: red=${red}, green=${green}, blue=${blue}. ` +
                `Example: { red: 0.2, green: 0.4, blue: 0.8 } for a blue color.`,
              retryable: false,
              suggestedFix:
                'Check the parameter format and ensure all required parameters are provided',
            });
          }
        }
      }
      return null;
    };

    const rowColorError = validateColors(req.rowProperties, 'rowProperties');
    if (rowColorError) return rowColorError;
    const colColorError = validateColors(req.columnProperties, 'columnProperties');
    if (colColorError) return colColorError;

    const gridRange = await this.rangeToGridRange(req.spreadsheetId!, req.range!, this.sheetsApi);

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

    const bandedRangeId = response.data?.replies?.[0]?.addBanding?.bandedRange?.bandedRangeId;
    return this.success('add_banding', {
      bandedRangeId: bandedRangeId ?? undefined,
    });
  }

  private async handleUpdateBanding(
    req: Extract<SheetsAdvancedInput['request'], { action: 'update_banding' }>
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'delete_banding' }>
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
          suggestedFix: 'Review the operation requirements and try again',
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
    req: Extract<SheetsAdvancedInput['request'], { action: 'list_banding' }>
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
          range: this.gridRangeToOutput(br.range ?? { sheetId: sheet.properties?.sheetId ?? 0 }),
        });
      }
    }

    return this.success('list_banding', { bandedRanges });
  }

  // ============================================================
  // Tables
  // ============================================================

  private async handleCreateTable(
    req: Extract<SheetsAdvancedInput['request'], { action: 'create_table' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('create_table', {}, undefined, true);
    }

    const rangeA1 = await this.resolveRange(req.spreadsheetId!, req.range!);
    const parsed = parseA1Notation(rangeA1);
    const sheetId = await this.getSheetId(req.spreadsheetId!, parsed.sheetName, this.sheetsApi);
    const gridRange: GridRangeInput = {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };

    let columnProperties: sheets_v4.Schema$TableColumnProperties[] | undefined;
    const hasHeaders = req.hasHeaders ?? true;
    const headerRowCount = req.headerRowCount ?? 1;

    if (hasHeaders) {
      // Read header rows (default: 1 row, configurable up to 10)
      const headerRange = buildA1Notation(
        parsed.sheetName,
        parsed.startCol,
        parsed.startRow,
        parsed.endCol,
        parsed.startRow + headerRowCount
      );
      const headerResponse = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: req.spreadsheetId!,
        range: headerRange,
        valueRenderOption: 'FORMATTED_VALUE',
      });

      // Use first header row for column names
      const headerValues = headerResponse.data.values?.[0] ?? [];
      const columnCount = Math.max(parsed.endCol - parsed.startCol, headerValues.length);
      columnProperties = Array.from({ length: columnCount }, (_, index) => ({
        columnIndex: index,
        columnName: headerValues[index] ? String(headerValues[index]) : `Column ${index + 1}`,
      }));
    }

    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            addTable: {
              table: {
                range: toGridRange(gridRange),
                columnProperties,
              },
            },
          },
        ],
      },
    });

    const table = response.data?.replies?.[0]?.addTable?.table;

    return this.success('create_table', {
      table: table
        ? {
            tableId: table.tableId ?? '',
            tableName: req.tableName, // Store for client-side reference
            range: this.gridRangeToOutput(table.range ?? { sheetId }),
            hasHeaders,
            headerRowCount,
          }
        : undefined,
    });
  }

  private async handleDeleteTable(
    req: Extract<SheetsAdvancedInput['request'], { action: 'delete_table' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('delete_table', {}, undefined, true);
    }

    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'delete_table',
        isDestructive: true,
        spreadsheetId: req.spreadsheetId!,
      },
      req.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            deleteTable: {
              tableId: req.tableId,
            },
          },
        ],
      },
    });

    return this.success('delete_table', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleListTables(
    req: Extract<SheetsAdvancedInput['request'], { action: 'list_tables' }>
  ): Promise<AdvancedResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      // Request full table metadata including range and column properties
      fields: 'sheets.tables(tableId,range,columnProperties),sheets.properties.sheetId',
    });

    const tables: NonNullable<AdvancedSuccess['tables']> = [];
    for (const sheet of response.data.sheets ?? []) {
      for (const table of sheet.tables ?? []) {
        const range = table.range;
        const columnCount = table.columnProperties?.length ?? 0;
        const rowCount = range ? (range.endRowIndex ?? 0) - (range.startRowIndex ?? 0) : 0;

        tables.push({
          tableId: table.tableId ?? '',
          tableName: undefined, // Google API doesn't provide table name yet (April 2025)
          range: this.gridRangeToOutput(range ?? { sheetId: sheet.properties?.sheetId ?? 0 }),
          columnCount,
          rowCount,
        });
      }
    }

    return this.success('list_tables', { tables });
  }

  private async handleUpdateTable(
    req: Extract<SheetsAdvancedInput['request'], { action: 'update_table' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('update_table', {}, undefined, true);
    }

    // Build update request
    const updates: sheets_v4.Schema$Request[] = [];

    if (req.range) {
      const rangeA1 = await this.resolveRange(req.spreadsheetId!, req.range);
      const parsed = parseA1Notation(rangeA1);
      const sheetId = await this.getSheetId(req.spreadsheetId!, parsed.sheetName, this.sheetsApi);
      const gridRange: GridRangeInput = {
        sheetId,
        startRowIndex: parsed.startRow,
        endRowIndex: parsed.endRow,
        startColumnIndex: parsed.startCol,
        endColumnIndex: parsed.endCol,
      };

      updates.push({
        updateTable: {
          table: {
            tableId: req.tableId,
            range: toGridRange(gridRange),
          },
          fields: 'range',
        },
      });
    }

    if (updates.length > 0) {
      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: req.spreadsheetId!,
        requestBody: { requests: updates },
      });
    }

    return this.success('update_table', {});
  }

  private async handleRenameTableColumn(
    req: Extract<SheetsAdvancedInput['request'], { action: 'rename_table_column' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('rename_table_column', {}, undefined, true);
    }

    // Get the table to access its column properties
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      fields: 'sheets.tables',
    });

    let targetTable: sheets_v4.Schema$Table | undefined;
    for (const sheet of response.data.sheets ?? []) {
      for (const table of sheet.tables ?? []) {
        if (table.tableId === req.tableId) {
          targetTable = table;
          break;
        }
      }
      if (targetTable) break;
    }

    if (!targetTable) {
      return this.error({
        code: 'NOT_FOUND',
        message: `Table with ID '${req.tableId}' not found`,
        category: 'client',
        retryable: false,
        suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
        details: { tableId: req.tableId },
      });
    }

    // Update column properties
    const columnProperties = targetTable.columnProperties ?? [];
    if (req.columnIndex >= columnProperties.length) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Column index ${req.columnIndex} is out of range (table has ${columnProperties.length} columns)`,
        category: 'client',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
        details: { columnIndex: req.columnIndex, columnCount: columnProperties.length },
      });
    }

    // Create updated column properties array
    const updatedColumnProperties = [...columnProperties];
    updatedColumnProperties[req.columnIndex] = {
      ...updatedColumnProperties[req.columnIndex],
      columnName: req.newName,
    };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            updateTable: {
              table: {
                tableId: req.tableId,
                columnProperties: updatedColumnProperties,
              },
              fields: 'columnProperties',
            },
          },
        ],
      },
    });

    return this.success('rename_table_column', {});
  }

  private async handleSetTableColumnProperties(
    req: Extract<SheetsAdvancedInput['request'], { action: 'set_table_column_properties' }>
  ): Promise<AdvancedResponse> {
    if (req.safety?.dryRun) {
      return this.success('set_table_column_properties', {}, undefined, true);
    }

    // Get the table to access its column properties
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      fields: 'sheets.tables',
    });

    let targetTable: sheets_v4.Schema$Table | undefined;
    for (const sheet of response.data.sheets ?? []) {
      for (const table of sheet.tables ?? []) {
        if (table.tableId === req.tableId) {
          targetTable = table;
          break;
        }
      }
      if (targetTable) break;
    }

    if (!targetTable) {
      return this.error({
        code: 'NOT_FOUND',
        message: `Table with ID '${req.tableId}' not found`,
        category: 'client',
        retryable: false,
        suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
        details: { tableId: req.tableId },
      });
    }

    // Update column properties
    const columnProperties = targetTable.columnProperties ?? [];
    if (req.columnIndex >= columnProperties.length) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Column index ${req.columnIndex} is out of range (table has ${columnProperties.length} columns)`,
        category: 'client',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
        details: { columnIndex: req.columnIndex, columnCount: columnProperties.length },
      });
    }

    // Create updated column properties array
    const updatedColumnProperties = [...columnProperties];
    if (req.columnType) {
      updatedColumnProperties[req.columnIndex] = {
        ...updatedColumnProperties[req.columnIndex],
        columnType: req.columnType,
      };
    }

    const requests: sheets_v4.Schema$Request[] = [
      {
        updateTable: {
          table: {
            tableId: req.tableId,
            columnProperties: updatedColumnProperties,
          },
          fields: 'columnProperties',
        },
      },
    ];

    // If column type is DROPDOWN, add data validation
    if (req.columnType === 'DROPDOWN') {
      // Compute the column data range from table range
      const tableRange = targetTable.range;
      if (!tableRange) {
        return this.error({
          code: 'FAILED_PRECONDITION',
          message: 'Table does not have a valid range',
          category: 'server',
          retryable: false,
          suggestedFix: 'Ensure all preconditions are met before retrying',
          details: { tableId: req.tableId },
        });
      }

      // Calculate the column range
      const startColumnIndex = (tableRange.startColumnIndex ?? 0) + req.columnIndex;
      const endColumnIndex = startColumnIndex + 1;

      // Build data validation rule
      const condition: sheets_v4.Schema$BooleanCondition = {
        type: req.dropdownRange ? 'ONE_OF_RANGE' : 'ONE_OF_LIST',
      };

      if (req.dropdownRange) {
        // Range-based dropdown
        condition.values = [
          {
            userEnteredValue: `=${req.dropdownRange}`,
          },
        ];
      } else if (req.dropdownValues) {
        // Static list dropdown
        condition.values = req.dropdownValues.map((value) => ({
          userEnteredValue: value,
        }));
      }

      const validationRule: sheets_v4.Schema$DataValidationRule = {
        condition,
        showCustomUi: req.dropdownShowDropdown,
        strict: !req.dropdownAllowCustom,
      };

      // Add setDataValidation request
      requests.push({
        setDataValidation: {
          range: toGridRange(
            buildGridRangeInput(
              tableRange.sheetId ?? 0,
              (tableRange.startRowIndex ?? 0) + 1, // Skip header row
              tableRange.endRowIndex ?? undefined,
              startColumnIndex,
              endColumnIndex
            )
          ),
          rule: validationRule,
        },
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests,
      },
    });

    return this.success('set_table_column_properties', {});
  }

  // ============================================================
  // Smart Chips (June 2025 API)
  // ============================================================

  private async handleAddPersonChip(
    req: Extract<SheetsAdvancedInput['request'], { action: 'add_person_chip' }>
  ): Promise<AdvancedResponse> {
    const gridRange = await this.rangeToGridRange(req.spreadsheetId!, req.range!, this.sheetsApi);

    // Build person chip using chipRuns API (June 2025)
    const cellData = buildPersonChip(req.email, req.displayFormat as PersonChipDisplayFormat);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [{ values: [cellData] }],
              fields: 'userEnteredValue,chipRuns',
            },
          },
        ],
      },
    });

    const cellA1 = buildA1Notation(
      '',
      gridRange.startColumnIndex ?? 0,
      gridRange.startRowIndex ?? 0,
      (gridRange.startColumnIndex ?? 0) + 1,
      (gridRange.startRowIndex ?? 0) + 1
    );

    return this.success('add_person_chip', {
      chip: {
        type: 'person' as const,
        cell: cellA1,
        email: req.email,
        displayText: cellData.userEnteredValue?.stringValue ?? req.email,
      },
    });
  }

  private async handleAddDriveChip(
    req: Extract<SheetsAdvancedInput['request'], { action: 'add_drive_chip' }>
  ): Promise<AdvancedResponse> {
    // Validate Drive scope (P3-5: Drive file access required for Drive chips)
    // Accept either drive.file or the broader drive scope (which is a superset)
    const scopes = this.context.auth?.scopes ?? [];
    const hasDriveScope =
      scopes.includes('https://www.googleapis.com/auth/drive.file') ||
      scopes.includes('https://www.googleapis.com/auth/drive');
    if (!hasDriveScope) {
      return this.error({
        code: 'INCREMENTAL_SCOPE_REQUIRED',
        message:
          'Drive file access required. Please grant drive.file or drive scope to write Drive chips.',
        retryable: true,
        suggestedFix: 'Grant the required permissions when prompted',
        details: {
          requiredScope: 'https://www.googleapis.com/auth/drive.file',
          currentScopes: scopes,
        },
      });
    }

    const gridRange = await this.rangeToGridRange(req.spreadsheetId!, req.range!, this.sheetsApi);

    // Build Drive chip using chipRuns API (June 2025)
    const cellData = buildDriveChip(req.fileId, req.displayText);
    const driveUri = `https://drive.google.com/file/d/${req.fileId}/view`;

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [{ values: [cellData] }],
              fields: 'userEnteredValue,chipRuns',
            },
          },
        ],
      },
    });

    const cellA1 = buildA1Notation(
      '',
      gridRange.startColumnIndex ?? 0,
      gridRange.startRowIndex ?? 0,
      (gridRange.startColumnIndex ?? 0) + 1,
      (gridRange.startRowIndex ?? 0) + 1
    );

    return this.success('add_drive_chip', {
      chip: {
        type: 'drive' as const,
        cell: cellA1,
        fileId: req.fileId,
        uri: driveUri,
        displayText: cellData.userEnteredValue?.stringValue ?? req.fileId,
      },
    });
  }

  private async handleAddRichLinkChip(
    req: Extract<SheetsAdvancedInput['request'], { action: 'add_rich_link_chip' }>
  ): Promise<AdvancedResponse> {
    // Validate Drive scope (P3-5: Drive file access required for rich link chips)
    // Accept either drive.file or the broader drive scope (which is a superset)
    const scopes = this.context.auth?.scopes ?? [];
    const hasDriveScope =
      scopes.includes('https://www.googleapis.com/auth/drive.file') ||
      scopes.includes('https://www.googleapis.com/auth/drive');
    if (!hasDriveScope) {
      return this.error({
        code: 'INCREMENTAL_SCOPE_REQUIRED',
        message:
          'Drive file access required. Please grant drive.file or drive scope to write rich link chips.',
        retryable: true,
        suggestedFix: 'Grant the required permissions when prompted',
        details: {
          requiredScope: 'https://www.googleapis.com/auth/drive.file',
          currentScopes: scopes,
        },
      });
    }

    const gridRange = await this.rangeToGridRange(req.spreadsheetId!, req.range!, this.sheetsApi);

    // Build rich link chip using chipRuns API (June 2025)
    const cellData = buildRichLinkChip(req.uri, req.displayText);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId!,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [{ values: [cellData] }],
              fields: 'userEnteredValue,chipRuns',
            },
          },
        ],
      },
    });

    const cellA1 = buildA1Notation(
      '',
      gridRange.startColumnIndex ?? 0,
      gridRange.startRowIndex ?? 0,
      (gridRange.startColumnIndex ?? 0) + 1,
      (gridRange.startRowIndex ?? 0) + 1
    );

    return this.success('add_rich_link_chip', {
      chip: {
        type: 'rich_link' as const,
        cell: cellA1,
        uri: req.uri,
        displayText: cellData.userEnteredValue?.stringValue ?? req.uri,
      },
    });
  }

  private async handleListChips(
    req: Extract<SheetsAdvancedInput['request'], { action: 'list_chips' }>
  ): Promise<AdvancedResponse> {
    // Validate spreadsheet size before loading grid data
    const sizeError = await this.validateGridDataSize(
      req.spreadsheetId!,
      this.sheetsApi,
      req.sheetId
    );
    if (sizeError) return sizeError as AdvancedResponse;

    // Get cell data with chipRuns using optimized field mask
    // Note: includeGridData is expensive but required for chipRuns
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId!,
      includeGridData: true,
      fields: 'sheets(properties.sheetId,data.rowData.values(chipRuns,formattedValue))',
    });

    const chips: Array<{
      type: 'person' | 'drive' | 'rich_link';
      cell: string;
      email?: string;
      fileId?: string;
      uri?: string;
      displayText?: string;
    }> = [];

    for (const sheet of response.data.sheets ?? []) {
      const sheetId = sheet.properties?.sheetId;
      if (req.sheetId !== undefined && sheetId !== req.sheetId) continue;

      for (const gridData of sheet.data ?? []) {
        const startRow = gridData.startRow ?? 0;
        const startCol = gridData.startColumn ?? 0;

        for (let rowIdx = 0; rowIdx < (gridData.rowData?.length ?? 0); rowIdx++) {
          const row = gridData.rowData?.[rowIdx];
          for (let colIdx = 0; colIdx < (row?.values?.length ?? 0); colIdx++) {
            const cell = row?.values?.[colIdx];

            const cellA1 = buildA1Notation(
              '',
              startCol + colIdx,
              startRow + rowIdx,
              startCol + colIdx + 1,
              startRow + rowIdx + 1
            );

            // Parse chip using chipRuns API
            const parsedChip = parseChipRuns(cell ?? {}, cellA1);
            if (!parsedChip) continue;

            // Filter by type
            if (req.chipType !== 'all' && parsedChip.type !== req.chipType) continue;

            // Only include person, drive, and rich_link chips (exclude unknown)
            if (
              parsedChip.type === 'person' ||
              parsedChip.type === 'drive' ||
              parsedChip.type === 'rich_link'
            ) {
              chips.push(
                parsedChip as typeof parsedChip & {
                  type: 'person' | 'drive' | 'rich_link';
                }
              );
            }
          }
        }
      }
    }

    return this.success('list_chips', { chips });
  }

  // ============================================================
  // Helpers
  // ============================================================

  private mapNamedRange(
    named: sheets_v4.Schema$NamedRange
  ): NonNullable<AdvancedSuccess['namedRange']> {
    return {
      namedRangeId: named.namedRangeId ?? '',
      name: named.name ?? '',
      range: this.gridRangeToOutput(named.range ?? { sheetId: 0 }),
    };
  }

  private mapProtectedRange(
    pr: sheets_v4.Schema$ProtectedRange
  ): NonNullable<AdvancedSuccess['protectedRange']> {
    return {
      protectedRangeId: pr.protectedRangeId ?? 0,
      range: this.gridRangeToOutput(pr.range ?? { sheetId: 0 }),
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
}
