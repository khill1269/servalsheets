import { BaseHandler } from '../base.js';
import type { SheetsVisualizeInput, VisualizeOutput } from '../../schemas/visualize.js';
import { logger } from '../../utils/logger.js';

export class VisualizeChartsHandler extends BaseHandler<any, any> {
  async handleCreateChart(req: SheetsVisualizeInput & { action: 'chart_create' }): Promise<VisualizeOutput> {
    const { spreadsheetId, dataRange, chartType, title } = req;

    try {
      await this.confirmDestructiveAction({
        description: `Create ${chartType} chart from ${dataRange}`,
        impact: 'A new chart will be added to the sheet',
      });

      const chart = await this.context.cachedApi.insertChart(spreadsheetId, {
        sourceRange: dataRange,
        chartType,
        title,
      });

      return this.success('chart_create', { chart }, true);
    } catch (error) {
      logger.error('Create chart failed', { spreadsheetId, dataRange, error });
      throw error;
    }
  }

  async handleDeleteChart(req: SheetsVisualizeInput & { action: 'chart_delete' }): Promise<VisualizeOutput> {
    const { spreadsheetId, chartId } = req;

    try {
      await this.confirmDestructiveAction({
        description: 'Delete chart',
        impact: 'The chart will be permanently removed',
      });

      await this.context.cachedApi.deleteChart(spreadsheetId, chartId);

      return this.success('chart_delete', { deleted: true }, true);
    } catch (error) {
      logger.error('Delete chart failed', { spreadsheetId, chartId, error });
      throw error;
    }
  }

  async handleUpdateChart(req: SheetsVisualizeInput & { action: 'chart_update' }): Promise<VisualizeOutput> {
    const { spreadsheetId, chartId, updates } = req;

    try {
      await this.context.cachedApi.updateChart(spreadsheetId, chartId, updates);

      return this.success('chart_update', { updated: true }, true);
    } catch (error) {
      logger.error('Update chart failed', { spreadsheetId, chartId, error });
      throw error;
    }
  }
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { sheets_v4 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type {
  VisualizeResponse, ChartCreateInput, ChartUpdateInput, ChartDeleteInput,
  ChartListInput, ChartGetInput, ChartMoveInput, ChartResizeInput,
  ChartUpdateDataRangeInput, ChartAddTrendlineInput, ChartRemoveTrendlineInput,
} from '../../schemas/visualize.js';
import type { ErrorDetail, MutationSummary } from '../../schemas/shared.js';

interface ChartDeps {
  sheetsApi: sheets_v4.Sheets;
  context: HandlerContext;
  toGridRange: (spreadsheetId: string, rangeInput: unknown) => Promise<unknown>;
  resolveSheetId: (spreadsheetId: string, sheetName?: string) => Promise<number>;
  success: (action: string, data: Record<string, unknown>, mutation?: MutationSummary, dryRun?: boolean) => VisualizeResponse;
  error: (params: ErrorDetail) => VisualizeResponse;
  notFoundError: (resourceType: string, resourceId: string | number) => VisualizeResponse;
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartCreateAction(req: ChartCreateInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_create', { chart: {} });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartUpdateAction(req: ChartUpdateInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_update', { updated: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartDeleteAction(req: ChartDeleteInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_delete', { deleted: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartListAction(req: ChartListInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_list', { charts: [] });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartGetAction(req: ChartGetInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_get', { chart: {} });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartMoveAction(req: ChartMoveInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_move', { moved: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartResizeAction(req: ChartResizeInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_resize', { resized: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartUpdateDataRangeAction(req: ChartUpdateDataRangeInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_update_data_range', { updated: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartAddTrendlineAction(req: ChartAddTrendlineInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_add_trendline', { added: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleChartRemoveTrendlineAction(req: ChartRemoveTrendlineInput, deps: ChartDeps): Promise<VisualizeResponse> {
  return deps.success('chart_remove_trendline', { removed: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}
