import type { Express } from 'express';
import type { HealthService } from '../server/health.js';
import {
  registerHttpSurfaceRoutes as registerPackagedHttpSurfaceRoutes,
  type RegisterHttpSurfaceRoutesOptions as PackagedRegisterHttpSurfaceRoutesOptions,
} from '../../packages/mcp-http/dist/route-surface.js';
import { registerWellKnownHandlers } from '../server/well-known.js';
import type { UserRateLimiter } from '../services/user-rate-limiter.js';
import { logger as defaultLogger } from '../utils/logger.js';
import { registerHttpErrorHandler } from './error-handler.js';
import { registerHttpGraphQlAndAdmin } from './graphql-admin.js';
import { registerApiRoutes } from './routes-api.js';
import { registerHttpObservabilityRoutes } from './routes-observability.js';
import { registerHttpWebhookRoutes } from './routes-webhooks.js';

interface HttpObservabilityOptions {
  readonly enableOAuth?: boolean;
  readonly oauthConfig?: {
    clientId: string;
    clientSecret: string;
  };
}

export type RegisterHttpSurfaceRoutesOptions = Omit<
  PackagedRegisterHttpSurfaceRoutesOptions<
    Express,
    HealthService,
    UserRateLimiter,
    HttpObservabilityOptions
  >,
  | 'registerWellKnownHandlers'
  | 'registerHttpObservabilityRoutes'
  | 'registerHttpWebhookRoutes'
  | 'registerApiRoutes'
  | 'registerHttpErrorHandler'
  | 'registerHttpGraphQlAndAdmin'
> & {
  readonly log?: typeof defaultLogger;
  readonly registerWellKnownHandlers?: typeof registerWellKnownHandlers;
  readonly registerHttpObservabilityRoutes?: typeof registerHttpObservabilityRoutes;
  readonly registerHttpWebhookRoutes?: typeof registerHttpWebhookRoutes;
  readonly registerApiRoutes?: typeof registerApiRoutes;
  readonly registerHttpErrorHandler?: typeof registerHttpErrorHandler;
  readonly registerHttpGraphQlAndAdmin?: typeof registerHttpGraphQlAndAdmin;
};

export function registerHttpSurfaceRoutes(options: RegisterHttpSurfaceRoutesOptions): void {
  const {
    registerWellKnownHandlers: registerWellKnownHandlersImpl = registerWellKnownHandlers,
    registerHttpObservabilityRoutes:
      registerHttpObservabilityRoutesImpl = registerHttpObservabilityRoutes,
    registerHttpWebhookRoutes: registerHttpWebhookRoutesImpl = registerHttpWebhookRoutes,
    registerApiRoutes: registerApiRoutesImpl = registerApiRoutes,
    registerHttpErrorHandler: registerHttpErrorHandlerImpl = registerHttpErrorHandler,
    registerHttpGraphQlAndAdmin: registerHttpGraphQlAndAdminImpl = registerHttpGraphQlAndAdmin,
    log = defaultLogger,
    ...rest
  } = options;

  registerPackagedHttpSurfaceRoutes({
    ...rest,
    log,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerWellKnownHandlers: registerWellKnownHandlersImpl as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerHttpObservabilityRoutes: registerHttpObservabilityRoutesImpl as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerHttpWebhookRoutes: registerHttpWebhookRoutesImpl as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerApiRoutes: registerApiRoutesImpl as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerHttpErrorHandler: registerHttpErrorHandlerImpl as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerHttpGraphQlAndAdmin: registerHttpGraphQlAndAdminImpl as any,
  });
}
