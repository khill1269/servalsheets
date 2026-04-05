import { BaseHandler } from '../base.js';
import type { SheetsSessionInput, SessionOutput } from '../../schemas/session.js';
import { logger } from '../../utils/logger.js';

export class SessionPreferencesHandler extends BaseHandler {
  async handleUpdatePreferences(req: SheetsSessionInput & { action: 'update_preferences' }): Promise<SessionOutput> {
    const { preferences } = req;

    try {
      await this.context.sessionContext.updatePreferences(preferences);

      return this.success('update_preferences', { updated: true }, false);
    } catch (error) {
      logger.error('Update preferences failed', { error });
      throw error;
    }
  }
}
