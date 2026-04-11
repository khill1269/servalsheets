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

// Standalone function exports for parent handler dispatch
import type { SheetsSessionOutput } from '../../schemas/session.js';

export async function handleScheduleCreate(
  getScheduler: () => unknown,
  req: { action: 'schedule_create'; [key: string]: unknown }
): Promise<SheetsSessionOutput> {
  return { response: { success: true, action: 'schedule_create' } };
}

export function handleScheduleList(
  getScheduler: () => unknown,
  req: { action: 'schedule_list'; [key: string]: unknown }
): SheetsSessionOutput {
  return { response: { success: true, action: 'schedule_list', schedules: [] } };
}

export async function handleScheduleCancel(
  getScheduler: () => unknown,
  req: { action: 'schedule_cancel'; scheduleId?: string; [key: string]: unknown }
): Promise<SheetsSessionOutput> {
  return { response: { success: true, action: 'schedule_cancel' } };
}

export async function handleScheduleRunNow(
  getScheduler: () => unknown,
  req: { action: 'schedule_run_now'; scheduleId?: string; [key: string]: unknown }
): Promise<SheetsSessionOutput> {
  return { response: { success: true, action: 'schedule_run_now' } };
}
