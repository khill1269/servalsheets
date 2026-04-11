/**
 * Session scheduling action handlers.
 * Covers: schedule_create, schedule_list, schedule_cancel, schedule_run_now
 */

import { ErrorCodes } from '../error-codes.js';
import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SchedulerService } from '../../services/scheduler.js';

export async function handleScheduleCreate(
  getScheduler: () => SchedulerService | null,
  req: {
    action: 'schedule_create';
    spreadsheetId?: string;
    cronExpression?: string;
    description?: string;
    tool?: string;
    actionName?: string;
    params?: Record<string, unknown>;
    operation?: { tool?: string; actionName?: string; action?: string; params?: Record<string, unknown> };
    target?: { tool?: string; actionName?: string; action?: string; params?: Record<string, unknown> };
  }
): Promise<SheetsSessionOutput> {
  const scheduler = getScheduler();
  if (!scheduler) {
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'Scheduler service not available',
          retryable: false,
        },
      },
    };
  }
  const nestedOperation =
    ('operation' in req && req.operation ? req.operation : undefined) ??
    ('target' in req && req.target ? req.target : undefined);
  const tool = req.tool ?? nestedOperation?.tool;
  const actionName = req.actionName ?? nestedOperation?.actionName ?? nestedOperation?.action;
  const params = req.params ?? nestedOperation?.params ?? {};

  if (!tool || !actionName) {
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.INVALID_PARAMS,
          message:
            'schedule_create requires either flat tool/actionName fields or a nested operation with tool and action',
          retryable: false,
        },
      },
    };
  }

  const job = await scheduler.create({
    spreadsheetId: req.spreadsheetId!,
    cronExpression: req.cronExpression!,
    description: req.description!,
    action: { tool, actionName, params },
    enabled: true,
  });
  return {
    response: {
      success: true as const,
      action: 'schedule_create' as const,
      jobId: job.id,
      message: `Scheduled job created: ${job.id}`,
    },
  };
}

export function handleScheduleList(
  getScheduler: () => SchedulerService | null,
  req: { action: 'schedule_list'; spreadsheetId?: string }
): SheetsSessionOutput {
  const scheduler = getScheduler();
  if (!scheduler) {
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'Scheduler service not available',
          retryable: false,
        },
      },
    };
  }
  const jobs = scheduler.list(req.spreadsheetId);
  return {
    response: {
      success: true as const,
      action: 'schedule_list' as const,
      jobs: jobs.map((j) => ({
        ...j,
        tool: j.action.tool,
        actionName: j.action.actionName,
      })),
    },
  };
}

export async function handleScheduleCancel(
  getScheduler: () => SchedulerService | null,
  req: { action: 'schedule_cancel'; jobId: string }
): Promise<SheetsSessionOutput> {
  const scheduler = getScheduler();
  if (!scheduler) {
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'Scheduler service not available',
          retryable: false,
        },
      },
    };
  }
  await scheduler.cancel(req.jobId);
  return {
    response: {
      success: true as const,
      action: 'schedule_cancel' as const,
      jobId: req.jobId,
    },
  };
}

export async function handleScheduleRunNow(
  getScheduler: () => SchedulerService | null,
  req: { action: 'schedule_run_now'; jobId: string }
): Promise<SheetsSessionOutput> {
  const scheduler = getScheduler();
  if (!scheduler) {
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.NOT_FOUND,
          message: 'Scheduler service not available',
          retryable: false,
        },
      },
    };
  }
  await scheduler.runNow(req.jobId);
  return {
    response: {
      success: true as const,
      action: 'schedule_run_now' as const,
      jobId: req.jobId,
      message: 'Job triggered successfully',
    },
  };
}
