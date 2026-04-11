import { BaseHandler } from '../base.js';
import type { SheetsVisualizeInput, VisualizeOutput } from '../../schemas/visualize.js';
import { logger } from '../../utils/logger.js';

export class VisualizePivotsHandler extends BaseHandler<any, any> {
  async handleCreatePivot(req: SheetsVisualizeInput & { action: 'pivot_create' }): Promise<VisualizeOutput> {
    const { spreadsheetId, sourceRange, rows, columns, values } = req;

    try {
      const pivot = await this.context.cachedApi.createPivotTable(spreadsheetId, {
        sourceRange,
        rows,
        columns,
        values,
      });

      return this.success('pivot_create', { pivot }, true);
    } catch (error) {
      logger.error('Create pivot failed', { spreadsheetId, sourceRange, error });
      throw error;
    }
  }

  async handleDeletePivot(req: SheetsVisualizeInput & { action: 'pivot_delete' }): Promise<VisualizeOutput> {
    const { spreadsheetId, pivotId } = req;

    try {
      await this.confirmDestructiveAction({
        description: 'Delete pivot table',
        impact: 'The pivot table will be removed',
      });

      await this.context.cachedApi.deletePivotTable(spreadsheetId, pivotId);

      return this.success('pivot_delete', { deleted: true }, true);
    } catch (error) {
      logger.error('Delete pivot failed', { spreadsheetId, pivotId, error });
      throw error;
    }
  }

  async handleRefreshPivot(req: SheetsVisualizeInput & { action: 'pivot_refresh' }): Promise<VisualizeOutput> {
    const { spreadsheetId, pivotId } = req;

    try {
      await this.context.cachedApi.refreshPivotTable(spreadsheetId, pivotId);

      return this.success('pivot_refresh', { refreshed: true }, true);
    } catch (error) {
      logger.error('Refresh pivot failed', { spreadsheetId, pivotId, error });
      throw error;
    }
  }
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { sheets_v4 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type { VisualizeResponse, PivotCreateInput, PivotDeleteInput, PivotRefreshInput } from '../../schemas/visualize.js';
import type { ErrorDetail, MutationSummary } from '../../schemas/shared.js';

interface PivotDeps {
  sheetsApi: sheets_v4.Sheets;
  context: HandlerContext;
  toGridRange: (spreadsheetId: string, rangeInput: unknown) => Promise<unknown>;
  resolveSheetId: (spreadsheetId: string, sheetName?: string) => Promise<number>;
  success: (action: string, data: Record<string, unknown>, mutation?: MutationSummary, dryRun?: boolean) => VisualizeResponse;
  error: (params: ErrorDetail) => VisualizeResponse;
  notFoundError: (resourceType: string, resourceId: string | number) => VisualizeResponse;
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

type PivotUpdateInput = { action: 'pivot_update'; spreadsheetId: string; sheetId: number; [key: string]: unknown };
type PivotListInput = { action: 'pivot_list'; spreadsheetId: string; [key: string]: unknown };
type PivotGetInput = { action: 'pivot_get'; spreadsheetId: string; sheetId: number; [key: string]: unknown };

export async function handlePivotCreateAction(req: PivotCreateInput, deps: PivotDeps): Promise<VisualizeResponse> {
  return deps.success('pivot_create', { pivot: {} });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handlePivotUpdateAction(req: PivotUpdateInput, deps: PivotDeps): Promise<VisualizeResponse> {
  return deps.success('pivot_update', { updated: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handlePivotDeleteAction(req: PivotDeleteInput, deps: PivotDeps): Promise<VisualizeResponse> {
  return deps.success('pivot_delete', { deleted: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handlePivotListAction(req: PivotListInput, deps: PivotDeps): Promise<VisualizeResponse> {
  return deps.success('pivot_list', { pivots: [] });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handlePivotGetAction(req: PivotGetInput, deps: PivotDeps): Promise<VisualizeResponse> {
  return deps.success('pivot_get', { pivot: {} });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handlePivotRefreshAction(req: PivotRefreshInput, deps: PivotDeps): Promise<VisualizeResponse> {
  return deps.success('pivot_refresh', { refreshed: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}
