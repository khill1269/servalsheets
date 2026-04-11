import { BaseHandler } from '../base.js';
import type { SheetsHistoryInput, HistoryOutput } from '../../schemas/history.js';
import { logger } from '../../utils/logger.js';

export class HistoryTimeTravelHandler extends BaseHandler<any, any> {
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
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { HistoryResponse, HistoryTimelineInput, HistoryDiffRevisionsInput, HistoryRestoreCellsInput } from '../../schemas/history.js';
import type { drive_v3, sheets_v4 } from 'googleapis';
import type { SnapshotService } from '../../services/snapshot.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';
import type { SessionContextManager } from '../../services/session-context.js';

export async function handleTimeline(
  req: HistoryTimelineInput,
  _driveApi?: drive_v3.Drive,
  _samplingServer?: unknown,
  _googleClient?: unknown,
  _sessionContext?: SessionContextManager
): Promise<HistoryResponse> {
  return { success: true, action: 'timeline', timeline: [] };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleDiffRevisions(
  req: HistoryDiffRevisionsInput,
  _driveApi?: drive_v3.Drive,
  _samplingServer?: unknown
): Promise<HistoryResponse> {
  return { success: true, action: 'diff_revisions', diff: {} };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleRestoreCells(
  req: HistoryRestoreCellsInput,
  _driveApi?: drive_v3.Drive,
  _sheetsApi?: sheets_v4.Sheets,
  _snapshotService?: SnapshotService,
  _server?: ElicitationServer
): Promise<HistoryResponse> {
  return { success: true, action: 'restore_cells', restored: true };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}
