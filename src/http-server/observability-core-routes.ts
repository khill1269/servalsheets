import type { Application, Request, Response } from 'express';
import type { HealthService } from '../server/health.js';
import { ACTION_COUNT, TOOL_COUNT } from '../schemas/action-counts.js';
import { MCP_PROTOCOL_VERSION } from '../config/protocol.js';
import { logger as defaultLogger } from '../utils/logger.js';
import { SERVER_INFO, VERSION } from '../version.js';
import {
  registerHttpObservabilityCoreRoutes as registerHttpObservabilityCoreRoutesImpl,
  type HttpObservabilityCoreLogger,
} from '../../packages/mcp-http/dist/observability-core-routes.js';

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

  // SEP-2127 Server Cards (draft) — forward-compatible static discovery endpoint.
  // Returns server metadata without requiring MCP connection or auth.
  // Schema will evolve as SEP-2127 stabilizes; this is a minimal compliant subset.
  options.app.get(
    '/.well-known/mcp/server-card.json',
    (_req: Request, res: Response): void => {
      res.json({
        name: SERVER_INFO.name,
        version: VERSION,
        protocolVersion: MCP_PROTOCOL_VERSION,
        description: SERVER_INFO.description,
        capabilities: {
          tools: { count: TOOL_COUNT, actions: ACTION_COUNT },
          resources: { subscribe: true, listChanged: true },
          prompts: {},
          completions: {},
          tasks: {},
          logging: {},
        },
        transports: ['stdio', 'streamable-http'],
        authentication: { type: 'oauth2' },
      });
    }
  );
}
