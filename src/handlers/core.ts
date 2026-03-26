/**
 * ServalSheets - Core Handler (Spreadsheet Operations)
 *
 * Handles 21 core spreadsheet and sheet management actions.
 */

import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsCoreInput, SheetsCoreOutput } from '../schemas/core.js';
import { ValidationError } from '../core/errors.js';
import { handleBatchDeleteSheets, handleBatchUpdateSheets, handleClearSheet, handleMoveSheet } from './core-actions/sheet-batch.js';
import type { CoreHandlerAccess } from './core-actions/internal.js';

export class SheetsCoreHandler extends BaseHandler<SheetsCoreInput, SheetsCoreOutput> {
  constructor(context: HandlerContext) {
    super('sheets_core', context);
  }

  async handle(input: SheetsCoreInput): Promise<SheetsCoreOutput> {
    try {
      const req = unwrapRequest<SheetsCoreInput['request']>(input);
      this.checkOperationScopes(`${this.toolName}.${req.action}`);

      // Infer parameters from context
      const inferredReq = this.inferRequestParameters(req);

      // Build handler access for submodules
      const handlerAccess = this.buildHandlerAccess();

      switch (inferredReq.action) {
        case 'batch_delete_sheets':
          return await handleBatchDeleteSheets(handlerAccess, inferredReq as any);
        case 'batch_update_sheets':
          return await handleBatchUpdateSheets(handlerAccess, inferredReq as any);
        case 'clear_sheet':
          return await handleClearSheet(handlerAccess, inferredReq as any);
        case 'move_sheet':
          return await handleMoveSheet(handlerAccess, inferredReq as any);
        case 'get':
          return await this.handleGet(inferredReq as any);
        case 'create':
          return await this.handleCreate(inferredReq as any);
        default:
          throw new ValidationError(
            `Unknown action: ${(inferredReq as { action: string }).action}`,
            'action',
            'get | create | list | ...'
          );
      }
    } catch (error) {
      return { response: this.mapError(error) };
    }
  }

  protected createIntents(input: SheetsCoreInput): Intent[] {
    const req = unwrapRequest<SheetsCoreInput['request']>(input);

    // Mutations
    const mutatingActions = ['create', 'delete_sheet', 'update_sheet', 'duplicate_sheet', 'batch_delete_sheets'];
    if (mutatingActions.includes(req.action)) {
      return [
        {
          type: 'SET_VALUES' as const,
          target: { spreadsheetId: req.spreadsheetId },
          payload: { action: req.action },
          metadata: {
            sourceTool: 'sheets_core',
            sourceAction: req.action,
            priority: 0,
            destructive: req.action.includes('delete') || req.action === 'batch_delete_sheets',
          },
        },
      ];
    }

    return [];
  }

  private buildHandlerAccess(): CoreHandlerAccess {
    return {
      context: this.context,
      api: this.context.googleClient.sheets,
      _confirmOperation: this.confirmDestructiveAction.bind(this),
      _createSnapshot: this.createSnapshotIfNeeded.bind(this),
      _mapError: this.mapError.bind(this),
      _makeSuccess: this.success.bind(this),
    };
  }

  private async handleGet(req: { spreadsheetId: string }): Promise<SheetsCoreOutput> {
    if (!req.spreadsheetId) {
      return { response: this.mapError(new ValidationError('spreadsheetId is required', 'spreadsheetId')) };
    }

    try {
      const response = await this.context.cachedApi.get(req.spreadsheetId, { fields: 'spreadsheetId,properties' });
      return { response: this.success('get', { spreadsheet: response }) };
    } catch (error) {
      return { response: this.mapError(error) };
    }
  }

  private async handleCreate(req: { title?: string }): Promise<SheetsCoreOutput> {
    try {
      const response = await this.context.googleClient.sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: req.title || 'Untitled Spreadsheet',
          },
        },
      });
      return { response: this.success('create', { spreadsheetId: response.data.spreadsheetId }) };
    } catch (error) {
      return { response: this.mapError(error) };
    }
  }
}
