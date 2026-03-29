import type { Application, RequestHandler } from 'express';
import {
  registerHttpMetricsRoutes as registerHttpMetricsRoutesImpl,
  type HttpMetricsRoutesLogger,
  type RegisterHttpMetricsRoutesOptions as PackagedRegisterHttpMetricsRoutesOptions,
} from '#mcp-http/metrics-routes';
import { requireAdminAuth } from '../admin/index.js';
import { metricsHandler } from '../observability/metrics.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import { logger as defaultLogger } from '../utils/logger.js';

export type RegisterHttpMetricsRoutesOptions = Omit<
  PackagedRegisterHttpMetricsRoutesOptions<
    Pick<Application, 'get'>,
    RequestHandler,
    RequestHandler
  >,
  'app' | 'adminMiddleware' | 'metricsHandler' | 'getCircuitBreakers'
> & {
  readonly adminMiddleware?: RequestHandler;
  readonly metricsHandler?: RequestHandler;
  readonly getCircuitBreakers?: PackagedRegisterHttpMetricsRoutesOptions<
    Pick<Application, 'get'>,
    RequestHandler,
    RequestHandler
  >['getCircuitBreakers'];
  readonly log?: HttpMetricsRoutesLogger;
};

export function registerHttpMetricsRoutes(
  app: Pick<Application, 'get'>,
  options: RegisterHttpMetricsRoutesOptions = {}
): void {
  registerHttpMetricsRoutesImpl({
    app,
    adminMiddleware: options.adminMiddleware ?? requireAdminAuth,
    metricsHandler: options.metricsHandler ?? metricsHandler,
    getCircuitBreakers: options.getCircuitBreakers ?? (() => circuitBreakerRegistry.getAll()),
    log: options.log ?? defaultLogger,
  });
}
