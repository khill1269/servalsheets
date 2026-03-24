import type { Express } from 'express';
import type { HealthService } from '../server/health.js';
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

export interface RegisterHttpSurfaceRoutesOptions {
  readonly app: Express;
  readonly corsOrigins: string[];
  readonly rateLimitMax: number;
  readonly legacySseEnabled: boolean;
  readonly authenticationRequired: boolean;
  readonly healthService: HealthService;
  readonly observabilityOptions: HttpObservabilityOptions;
  readonly host: string;
  readonly port: number;
  readonly getSessionCount: () => number;
  readonly getUserRateLimiter: () => UserRateLimiter | null;
  readonly sessions: Map<string, unknown>;
  readonly log?: typeof defaultLogger;
  readonly registerWellKnownHandlers?: typeof registerWellKnownHandlers;
  readonly registerHttpObservabilityRoutes?: typeof registerHttpObservabilityRoutes;
  readonly registerHttpWebhookRoutes?: typeof registerHttpWebhookRoutes;
  readonly registerApiRoutes?: typeof registerApiRoutes;
  readonly registerHttpErrorHandler?: typeof registerHttpErrorHandler;
  readonly registerHttpGraphQlAndAdmin?: typeof registerHttpGraphQlAndAdmin;
}

export function registerHttpSurfaceRoutes(options: RegisterHttpSurfaceRoutesOptions): void {
  const {
    app,
    corsOrigins,
    rateLimitMax,
    legacySseEnabled,
    authenticationRequired,
    healthService,
    observabilityOptions,
    host,
    port,
    getSessionCount,
    getUserRateLimiter,
    sessions,
    log = defaultLogger,
    registerWellKnownHandlers: registerWellKnownHandlersImpl = registerWellKnownHandlers,
    registerHttpObservabilityRoutes: registerHttpObservabilityRoutesImpl =
      registerHttpObservabilityRoutes,
    registerHttpWebhookRoutes: registerHttpWebhookRoutesImpl = registerHttpWebhookRoutes,
    registerApiRoutes: registerApiRoutesImpl = registerApiRoutes,
    registerHttpErrorHandler: registerHttpErrorHandlerImpl = registerHttpErrorHandler,
    registerHttpGraphQlAndAdmin: registerHttpGraphQlAndAdminImpl = registerHttpGraphQlAndAdmin,
  } = options;

  registerWellKnownHandlersImpl(app, {
    corsOrigins,
    rateLimitMax,
    legacySseEnabled,
    authenticationRequired,
  });

  registerHttpObservabilityRoutesImpl({
    app,
    healthService,
    options: observabilityOptions,
    host,
    port,
    legacySseEnabled,
    getSessionCount,
    getUserRateLimiter,
  });

  registerHttpWebhookRoutesImpl(app);
  registerApiRoutesImpl(app, {
    samplingServer: null,
  });
  log.info('HTTP Server: =SERVAL() API enabled (POST /api/formula-eval)');

  registerHttpErrorHandlerImpl(app, { log });
  registerHttpGraphQlAndAdminImpl({
    app,
    sessions,
  });
}
