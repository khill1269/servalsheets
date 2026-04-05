import { BaseHandler } from '../base.js';
import type { SheetsSessionInput, SessionOutput } from '../../schemas/session.js';
import { logger } from '../../utils/logger.js';

export class SessionCheckpointsHandler extends BaseHandler {
  async handleSaveCheckpoint(req: SheetsSessionInput & { action: 'save_checkpoint' }): Promise<SessionOutput> {
    const { spreadsheetId, name } = req;

    try {
      const checkpoint = await this.context.sessionContext.saveCheckpoint(spreadsheetId, name);

      return this.success('save_checkpoint', { checkpoint }, false);
    } catch (error) {
      logger.error('Save checkpoint failed', { spreadsheetId, error });
      throw error;
    }
  }

  async handleLoadCheckpoint(req: SheetsSessionInput & { action: 'load_checkpoint' }): Promise<SessionOutput> {
    const { spreadsheetId, checkpointId } = req;

    try {
      const result = await this.context.sessionContext.loadCheckpoint(spreadsheetId, checkpointId);

      return this.success('load_checkpoint', { restored: true, result }, true);
    } catch (error) {
      logger.error('Load checkpoint failed', { spreadsheetId, error });
      throw error;
    }
  }
}
