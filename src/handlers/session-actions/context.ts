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
