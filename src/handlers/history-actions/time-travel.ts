import { BaseHandler } from '../base.js';
import type { SheetsHistoryInput, HistoryOutput } from '../../schemas/history.js';
import { logger } from '../../utils/logger.js';

export class HistoryTimeTravelHandler extends BaseHandler {
  async handleTimeline(req: SheetsHistoryInput & { action: 'timeline' }): Promise<HistoryOutput> {
    const { spreadsheetId, range } = req;

    try {
      const timeline = await this.context.historyService.getTimeline(spreadsheetId, range);

      return this.success('timeline', { timeline }, false);
    } catch (error) {
      logger.error('Timeline fetch failed', { spreadsheetId, error });
      throw error;
    }
  }

  async handleDiffRevisions(req: SheetsHistoryInput & { action: 'diff_revisions' }): Promise<HistoryOutput> {
    const { spreadsheetId, revisionId1, revisionId2 } = req;

    try {
      const diff = await this.context.historyService.diffRevisions(spreadsheetId, revisionId1, revisionId2);

      return this.success('diff_revisions', { diff }, false);
    } catch (error) {
      logger.error('Diff revisions failed', { spreadsheetId, error });
      throw error;
    }
  }
}
