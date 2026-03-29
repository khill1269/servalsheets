import type { Application, RequestHandler } from 'express';
import {
  registerHttpWebhookDashboardRoutes as registerHttpWebhookDashboardRoutesImpl,
  type HttpWebhookDashboardLogger,
  type RegisterHttpWebhookDashboardRoutesOptions as PackagedRegisterHttpWebhookDashboardRoutesOptions,
} from '#mcp-http/webhook-dashboard-routes';
import { requireAdminAuth } from '../admin/index.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type RegisterHttpWebhookDashboardRoutesOptions = Omit<
  PackagedRegisterHttpWebhookDashboardRoutesOptions<Pick<Application, 'get'>, RequestHandler>,
  'app' | 'adminMiddleware' | 'loadWebhookDashboardData'
> & {
  readonly adminMiddleware?: RequestHandler;
  readonly loadWebhookDashboardData?: PackagedRegisterHttpWebhookDashboardRoutesOptions<
    Pick<Application, 'get'>,
    RequestHandler
  >['loadWebhookDashboardData'];
  readonly log?: HttpWebhookDashboardLogger;
};

export function registerHttpWebhookDashboardRoutes(
  app: Pick<Application, 'get'>,
  options: RegisterHttpWebhookDashboardRoutesOptions = {}
): void {
  registerHttpWebhookDashboardRoutesImpl({
    app,
    adminMiddleware: options.adminMiddleware ?? requireAdminAuth,
    loadWebhookDashboardData:
      options.loadWebhookDashboardData ??
      (async (spreadsheetId?: string) => {
        const { getWebhookManager, getWebhookQueue } = await import('../services/index.js');
        const manager = getWebhookManager();
        const queue = getWebhookQueue();
        return {
          webhooks: await manager.list(spreadsheetId, undefined),
          queueStats: await queue.getStats(),
        };
      }),
    log: options.log ?? defaultLogger,
  });
}
