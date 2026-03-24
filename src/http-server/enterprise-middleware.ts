import type { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import { logger as defaultLogger } from '../utils/logger.js';

interface TenantIsolationModule {
  tenantIsolationMiddleware(): RequestHandler;
  validateSpreadsheetAccess(): RequestHandler;
}

interface RbacMiddlewareModule {
  rbacMiddleware(): RequestHandler;
}

export interface RegisterHttpEnterpriseMiddlewareOptions {
  readonly enableTenantIsolation?: boolean;
  readonly enableRbac?: boolean;
  readonly importTenantIsolationModule?: () => Promise<TenantIsolationModule>;
  readonly importRbacMiddlewareModule?: () => Promise<RbacMiddlewareModule>;
  readonly log?: typeof defaultLogger;
}

export function registerHttpEnterpriseMiddleware(
  app: Pick<Application, 'use'>,
  options: RegisterHttpEnterpriseMiddlewareOptions
): void {
  const {
    enableTenantIsolation = false,
    enableRbac = false,
    importTenantIsolationModule = () => import('../middleware/tenant-isolation.js'),
    importRbacMiddlewareModule = () => import('../middleware/rbac-middleware.js'),
    log = defaultLogger,
  } = options;

  if (enableTenantIsolation) {
    let tenantModulePromise: Promise<TenantIsolationModule> | null = null;
    let tenantIsolationHandler: RequestHandler | null = null;
    let spreadsheetAccessHandler: RequestHandler | null = null;

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!tenantModulePromise) {
        tenantModulePromise = importTenantIsolationModule();
        log.info('HTTP Server: Tenant isolation middleware enabled');
      }

      void tenantModulePromise
        .then((mod) => {
          tenantIsolationHandler ??= mod.tenantIsolationMiddleware();
          spreadsheetAccessHandler ??= mod.validateSpreadsheetAccess();

          tenantIsolationHandler(req, res, (error?: unknown) => {
            if (error) {
              next(error);
              return;
            }
            spreadsheetAccessHandler?.(req, res, next);
          });
        })
        .catch(next);
    });
  }

  if (enableRbac) {
    let rbacModulePromise: Promise<RbacMiddlewareModule> | null = null;
    let rbacHandler: RequestHandler | null = null;

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!rbacModulePromise) {
        rbacModulePromise = importRbacMiddlewareModule();
        log.info('HTTP Server: RBAC middleware enabled');
      }

      void rbacModulePromise
        .then((mod) => {
          rbacHandler ??= mod.rbacMiddleware();
          rbacHandler(req, res, next);
        })
        .catch(next);
    });
  }
}
