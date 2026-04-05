import { BaseHandler } from '../base.js';
import type { SheetsHistoryInput, HistoryOutput } from '../../schemas/history.js';
import { logger } from '../../utils/logger.js';

export class HistoryOperationsHandler extends BaseHandler {
  async handleUndo(req: SheetsHistoryInput & { action: 'undo' }): Promise<HistoryOutput> {
    const { spreadsheetId } = req;

    try {
      const result = await this.context.historyService.undo(spreadsheetId);

      return this.success('undo', { undone: true, operation: result }, true);
    } catch (error) {
      logger.error('Undo failed', { spreadsheetId, error });
      throw error;
    }
  }

  async handleRedo(req: SheetsHistoryInput & { action: 'redo' }): Promise<HistoryOutput> {
    const { spreadsheetId } = req;

    try {
      const result = await this.context.historyService.redo(spreadsheetId);

      return this.success('redo', { redone: true, operation: result }, true);
    } catch (error) {
      logger.error('Redo failed', { spreadsheetId, error });
      throw error;
    }
  }
}
