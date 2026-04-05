import { BaseHandler } from '../base.js';
import type { SheetsVisualizeInput, VisualizeOutput } from '../../schemas/visualize.js';
import { logger } from '../../utils/logger.js';

export class VisualizePivotsHandler extends BaseHandler {
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
}
