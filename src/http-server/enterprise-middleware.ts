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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerPackagedHttpEnterpriseMiddleware(app as any, {
    ...options,
    importTenantIsolationModule:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (options.importTenantIsolationModule ??
        (() => import('../middleware/tenant-isolation.js'))) as any,
    importRbacMiddlewareModule:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (options.importRbacMiddlewareModule ??
        (() => import('../middleware/rbac-middleware.js'))) as any,
    log: options.log ?? defaultLogger,
  });
}
