import type { Express } from 'express';
import { env } from '../config/env.js';
import { getWebhookManager, getWebhookQueue } from '../services/index.js';
import { logger } from '../utils/logger.js';
import {
  categorizeChanges,
  registerHttpWebhookRoutes as registerPackagedHttpWebhookRoutes,
  type RegisterHttpWebhookRoutesOptions as PackagedRegisterHttpWebhookRoutesOptions,
} from '#mcp-http/routes-webhooks';

export { categorizeChanges };

export type RegisterHttpWebhookRoutesOptions = Omit<
  PackagedRegisterHttpWebhookRoutesOptions,
  | 'webhookMaxAttempts'
  | 'getWebhookManager'
  | 'getWebhookQueue'
  | 'loadFormulaCallbackModule'
  | 'log'
> & {
  readonly webhookMaxAttempts?: number;
  readonly getWebhookManager?: PackagedRegisterHttpWebhookRoutesOptions['getWebhookManager'];
  readonly getWebhookQueue?: PackagedRegisterHttpWebhookRoutesOptions['getWebhookQueue'];
  readonly loadFormulaCallbackModule?: PackagedRegisterHttpWebhookRoutesOptions['loadFormulaCallbackModule'];
  readonly log?: typeof logger;
};

export function registerHttpWebhookRoutes(
  app: Express,
  options: RegisterHttpWebhookRoutesOptions = {}
): void {
  registerPackagedHttpWebhookRoutes(app, {
    webhookMaxAttempts: options.webhookMaxAttempts ?? env?.WEBHOOK_MAX_ATTEMPTS ?? 3,
    getWebhookManager: options.getWebhookManager ?? getWebhookManager,
    getWebhookQueue: options.getWebhookQueue ?? getWebhookQueue,
    loadFormulaCallbackModule:
      options.loadFormulaCallbackModule ?? (() => import('../services/formula-callback.js')),
    log: options.log ?? logger,
  });
}
