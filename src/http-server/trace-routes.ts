import type { Application, RequestHandler } from 'express';
import {
  registerHttpTraceRoutes as registerHttpTraceRoutesImpl,
  type HttpTraceRoutesLogger,
  type RegisterHttpTraceRoutesOptions as PackagedRegisterHttpTraceRoutesOptions,
} from '#mcp-http/trace-routes';
import { requireAdminAuth } from '../admin/index.js';
import { getTraceAggregator } from '../services/trace-aggregator.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type RegisterHttpTraceRoutesOptions = Omit<
  PackagedRegisterHttpTraceRoutesOptions<Pick<Application, 'get' | 'use'>, RequestHandler>,
  'app' | 'adminMiddleware' | 'getTraceAggregator' | 'importTracingUiModule'
> & {
  readonly adminMiddleware?: RequestHandler;
  readonly getTraceAggregator?: PackagedRegisterHttpTraceRoutesOptions<
    Pick<Application, 'get' | 'use'>,
    RequestHandler
  >['getTraceAggregator'];
  readonly importTracingUiModule?: PackagedRegisterHttpTraceRoutesOptions<
    Pick<Application, 'get' | 'use'>,
    RequestHandler
  >['importTracingUiModule'];
  readonly log?: HttpTraceRoutesLogger;
};

export function registerHttpTraceRoutes(
  app: Pick<Application, 'get' | 'use'>,
  options: RegisterHttpTraceRoutesOptions = {}
): void {
  registerHttpTraceRoutesImpl({
    app,
    adminMiddleware: options.adminMiddleware ?? requireAdminAuth,
    getTraceAggregator: options.getTraceAggregator ?? getTraceAggregator,
    importTracingUiModule: options.importTracingUiModule ?? (() => import('../ui/tracing.js')),
    log: options.log ?? defaultLogger,
  });
}
