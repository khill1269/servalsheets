import { BaseHandler } from '../base.js';
import type { SheetsSessionInput, SessionOutput } from '../../schemas/session.js';
import { logger } from '../../utils/logger.js';

export class SessionContextHandler extends BaseHandler {
  async handleGetContext(req: SheetsSessionInput & { action: 'get_context' }): Promise<SessionOutput> {
    try {
      const context = this.context.sessionContext.getContext();

      return this.success('get_context', { context }, false);
    } catch (error) {
      logger.error('Get context failed', { error });
      throw error;
    }
  }

  async handleSetActive(req: SheetsSessionInput & { action: 'set_active' }): Promise<SessionOutput> {
    const { spreadsheetId } = req;

    try {
      await this.context.sessionContext.setActive(spreadsheetId);

      return this.success('set_active', { active: true }, false);
    } catch (error) {
      logger.error('Set active failed', { spreadsheetId, error });
      throw error;
    }
  }
}

// Standalone function exports for parent handler dispatch
import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager } from '../../services/session-context.js';

export function handleSetActive(
  session: SessionContextManager,
  req: { action: 'set_active'; spreadsheetId?: string; title?: string }
): SheetsSessionOutput {
  if (req.spreadsheetId) {
    session.setActiveSpreadsheet(req.spreadsheetId, req.title);
  }
  return { response: { success: true, action: 'set_active' } };
}

export function handleGetActive(session: SessionContextManager): SheetsSessionOutput {
  const active = session.getActiveSpreadsheet();
  return { response: { success: true, action: 'get_active', spreadsheet: active } };
}

export function handleGetContext(session: SessionContextManager): SheetsSessionOutput {
  const context = session.getContext();
  return { response: { success: true, action: 'get_context', context } };
}

export function handleRecordOperation(
  session: SessionContextManager,
  req: { action: 'record_operation'; tool?: string; operationAction?: string; spreadsheetId?: string; [key: string]: unknown }
): SheetsSessionOutput {
  session.recordOperation({
    tool: req.tool ?? 'unknown',
    action: req.operationAction ?? 'unknown',
    spreadsheetId: req.spreadsheetId,
    timestamp: Date.now(),
  });
  return { response: { success: true, action: 'record_operation' } };
}

export function handleGetLastOperation(session: SessionContextManager): SheetsSessionOutput {
  const operation = session.getLastOperation();
  return { response: { success: true, action: 'get_last_operation', operation } };
}
