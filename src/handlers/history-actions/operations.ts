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

// Standalone function exports for parent handler dispatch
import type { HistoryResponse } from '../../schemas/history.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';
import { getHistoryService } from '../../services/history-service.js';

export async function handleList(req: { action: 'list'; spreadsheetId?: string; limit?: number }): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  const operations = historyService.list(req.spreadsheetId!, req.limit ?? 50);
  return { success: true, action: 'list', operations };
}

export async function handleGet(req: { action: 'get'; operationId?: string }): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  const operation = historyService.getById(req.operationId!);
  return { success: true, action: 'get', operation: operation ?? undefined };
}

export async function handleStats(req: { action: 'stats'; spreadsheetId?: string }): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  const stats = historyService.getStats(req.spreadsheetId!);
  return { success: true, action: 'stats', stats };
}

export async function handleClear(
  req: { action: 'clear'; spreadsheetId?: string },
  _server?: ElicitationServer
): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  historyService.clear(req.spreadsheetId!);
  return { success: true, action: 'clear', message: 'History cleared' };
}
