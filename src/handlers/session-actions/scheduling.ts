import { BaseHandler } from '../base.js';
import type { SheetsSessionInput, SessionOutput } from '../../schemas/session.js';
import { logger } from '../../utils/logger.js';

export class SessionSchedulingHandler extends BaseHandler {
  async handleScheduleCreate(req: SheetsSessionInput & { action: 'schedule_create' }): Promise<SessionOutput> {
    const { spreadsheetId, cronExpression, taskDescription } = req;

    try {
      const schedule = await this.context.sessionContext.createSchedule(spreadsheetId, {
        cronExpression,
        taskDescription,
      });

      return this.success('schedule_create', { schedule }, false);
    } catch (error) {
      logger.error('Create schedule failed', { spreadsheetId, error });
      throw error;
    }
  }
}
