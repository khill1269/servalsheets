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

// Standalone function exports for parent handler dispatch
import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager } from '../../services/session-context.js';

export function handleUpdatePreferences(
  session: SessionContextManager,
  req: { action: 'update_preferences'; [key: string]: unknown }
): SheetsSessionOutput {
  const { action, ...preferences } = req;
  session.updatePreferences(preferences);
  return { response: { success: true, action: 'update_preferences' } };
}

export function handleGetPreferences(session: SessionContextManager): SheetsSessionOutput {
  const preferences = session.getPreferences();
  return { response: { success: true, action: 'get_preferences', preferences } };
}

export async function handleUpdateProfilePreferences(
  session: SessionContextManager,
  req: { action: 'update_profile_preferences'; [key: string]: unknown }
): Promise<SheetsSessionOutput> {
  return { response: { success: true, action: 'update_profile_preferences' } };
}
