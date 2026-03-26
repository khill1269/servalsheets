import type { Express } from 'express';
import type { UserRateLimiter } from '../services/user-rate-limiter.js';
import type { HealthService } from '../server/health.js';
import {
  registerHttpObservabilityRoutes as registerPackagedHttpObservabilityRoutes,
  type RegisterHttpObservabilityRoutesOptions as PackagedRegisterHttpObservabilityRoutesOptions,
} from '../../packages/mcp-http/dist/observability-routes.js';
import { registerHttpMetricsRoutes } from './metrics-routes.js';
import {
  registerHttpObservabilityCoreRoutes,
  type HttpServerObservabilityOptions,
} from './observability-core-routes.js';
import { registerHttpOpenApiDocsRoutes } from './openapi-docs-routes.js';
import { registerHttpStatsRoutes } from './stats-routes.js';
import { registerHttpTraceRoutes } from './trace-routes.js';
import { registerHttpWebhookDashboardRoutes } from './webhook-dashboard-routes.js';

export type RegisterHttpObservabilityRoutesOptions = Omit<
  PackagedRegisterHttpObservabilityRoutesOptions<
    Express,
    HealthService,
    UserRateLimiter,
    HttpServerObservabilityOptions
  >,
  | 'registerHttpObservabilityCoreRoutes'
  | 'registerHttpOpenApiDocsRoutes'
  | 'registerHttpMetricsRoutes'
  | 'registerHttpWebhookDashboardRoutes'
  | 'registerHttpStatsRoutes'
  | 'registerHttpTraceRoutes'
> & {
  readonly registerHttpObservabilityCoreRoutes?: typeof registerHttpObservabilityCoreRoutes;
  readonly registerHttpOpenApiDocsRoutes?: typeof registerHttpOpenApiDocsRoutes;
  readonly registerHttpMetricsRoutes?: typeof registerHttpMetricsRoutes;
  readonly registerHttpWebhookDashboardRoutes?: typeof registerHttpWebhookDashboardRoutes;
  readonly registerHttpStatsRoutes?: typeof registerHttpStatsRoutes;
  readonly registerHttpTraceRoutes?: typeof registerHttpTraceRoutes;
};

export function registerHttpObservabilityRoutes(
  options: RegisterHttpObservabilityRoutesOptions
): void {
  const {
    registerHttpObservabilityCoreRoutes:
      registerHttpObservabilityCoreRoutesImpl = registerHttpObservabilityCoreRoutes,
    registerHttpOpenApiDocsRoutes:
      registerHttpOpenApiDocsRoutesImpl = registerHttpOpenApiDocsRoutes,
    registerHttpMetricsRoutes: registerHttpMetricsRoutesImpl = registerHttpMetricsRoutes,
    registerHttpWebhookDashboardRoutes:
      registerHttpWebhookDashboardRoutesImpl = registerHttpWebhookDashboardRoutes,
    registerHttpStatsRoutes: registerHttpStatsRoutesImpl = registerHttpStatsRoutes,
    registerHttpTraceRoutes: registerHttpTraceRoutesImpl = registerHttpTraceRoutes,
    ...rest
  } = options;

  registerPackagedHttpObservabilityRoutes({
    ...rest,
    registerHttpObservabilityCoreRoutes: registerHttpObservabilityCoreRoutesImpl,
    registerHttpOpenApiDocsRoutes: registerHttpOpenApiDocsRoutesImpl,
    registerHttpMetricsRoutes: registerHttpMetricsRoutesImpl,
    registerHttpWebhookDashboardRoutes: registerHttpWebhookDashboardRoutesImpl,
    registerHttpStatsRoutes: registerHttpStatsRoutesImpl,
    registerHttpTraceRoutes: registerHttpTraceRoutesImpl,
  });
}
