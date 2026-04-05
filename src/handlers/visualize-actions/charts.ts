import { BaseHandler } from '../base.js';
import type { SheetsVisualizeInput, VisualizeOutput } from '../../schemas/visualize.js';
import { logger } from '../../utils/logger.js';

export class VisualizeChartsHandler extends BaseHandler {
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
}
