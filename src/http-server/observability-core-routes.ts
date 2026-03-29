import type { Application } from 'express';
import type { HealthService } from '../server/health.js';
import { ACTION_COUNT, TOOL_COUNT } from '../schemas/action-counts.js';
import { logger as defaultLogger } from '../utils/logger.js';
import { SERVER_INFO, VERSION } from '../version.js';
import {
  registerHttpObservabilityCoreRoutes as registerHttpObservabilityCoreRoutesImpl,
  type HttpObservabilityCoreLogger,
} from '#mcp-http/observability-core-routes';

export type { HttpObservabilityCoreLogger };

export interface HttpServerObservabilityOptions {
  enableOAuth?: boolean;
  oauthConfig?: {
    clientId: string;
    clientSecret: string;
  };
}

export interface RegisterHttpObservabilityCoreRoutesOptions {
  app: Pick<Application, 'get' | 'head'>;
  healthService: HealthService;
  options: HttpServerObservabilityOptions;
  host: string;
  port: number;
  legacySseEnabled: boolean;
  getSessionCount: () => number;
  log?: HttpObservabilityCoreLogger;
}

export function registerHttpObservabilityCoreRoutes(
  options: RegisterHttpObservabilityCoreRoutesOptions
): void {
  registerHttpObservabilityCoreRoutesImpl({
    ...options,
    healthService: options.healthService as unknown as {
      checkLiveness(): Promise<unknown>;
      checkReadiness(): Promise<{ status: string } & Record<string, unknown>>;
    },
    log: (options.log ?? defaultLogger) as HttpObservabilityCoreLogger,
    serverInfo: {
      name: SERVER_INFO.name,
      version: VERSION,
      protocolVersion: SERVER_INFO.protocolVersion,
      description: 'Production-grade Google Sheets MCP server',
      toolCount: TOOL_COUNT,
      actionCount: ACTION_COUNT,
    },
  });
}
