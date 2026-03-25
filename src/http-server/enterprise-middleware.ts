import type { Application } from 'express';
import {
  registerHttpEnterpriseMiddleware as registerPackagedHttpEnterpriseMiddleware,
  type RegisterHttpEnterpriseMiddlewareOptions as PackagedRegisterHttpEnterpriseMiddlewareOptions,
} from '../../packages/mcp-http/dist/enterprise-middleware.js';
import { logger as defaultLogger } from '../utils/logger.js';
export type RegisterHttpEnterpriseMiddlewareOptions = Omit<
  PackagedRegisterHttpEnterpriseMiddlewareOptions,
  'importTenantIsolationModule' | 'importRbacMiddlewareModule'
> & {
  readonly importTenantIsolationModule?: PackagedRegisterHttpEnterpriseMiddlewareOptions['importTenantIsolationModule'];
  readonly importRbacMiddlewareModule?: PackagedRegisterHttpEnterpriseMiddlewareOptions['importRbacMiddlewareModule'];
  readonly log?: typeof defaultLogger;
};

export function registerHttpEnterpriseMiddleware(
  app: Pick<Application, 'use'>,
  options: RegisterHttpEnterpriseMiddlewareOptions
): void {
  registerPackagedHttpEnterpriseMiddleware(app, {
    ...options,
    importTenantIsolationModule:
      options.importTenantIsolationModule ?? (() => import('../middleware/tenant-isolation.js')),
    importRbacMiddlewareModule:
      options.importRbacMiddlewareModule ?? (() => import('../middleware/rbac-middleware.js')),
    log: options.log ?? defaultLogger,
  });
}
