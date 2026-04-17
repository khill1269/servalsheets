import type { Application } from 'express';
import { responseRedactionMiddleware } from '../middleware/redaction.js';
import { getRequestRecorder } from '../services/request-recorder.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { addDeprecationHeaders, extractVersionFromRequest } from '../versioning/schema-manager.js';
import { extractTrustedClientIp } from './client-ip.js';
import { createHttpProtocolVersionMiddleware } from './protocol-version-middleware.js';
import {
  createHostValidationMiddleware,
  createHttpsEnforcementMiddleware,
  createOriginValidationMiddleware,
} from './request-validation-middleware.js';
import { registerHttpFoundationMiddleware as registerPackagedHttpFoundationMiddleware } from '../../packages/mcp-http/dist/middleware.js';

export function registerHttpFoundationMiddleware(params: {
  app: Application;
  corsOrigins: string[];
  trustProxy: boolean;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}): void {
  const envConfig = getEnv();

  registerPackagedHttpFoundationMiddleware({
    ...params,
    envConfig: {
      OAUTH_ISSUER: (envConfig['OAUTH_ISSUER'] as string | undefined) ?? '',
      STRICT_MCP_PROTOCOL_VERSION: Boolean(envConfig['STRICT_MCP_PROTOCOL_VERSION']),
    },
    nodeEnv: process.env['NODE_ENV'] ?? '',
    extraAllowedHosts:
      process.env['SERVAL_ALLOWED_HOSTS']?.split(',').map((host) => host.trim().toLowerCase()) ??
      [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createResponseRedactionMiddleware: responseRedactionMiddleware as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getRequestRecorder: getRequestRecorder as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractVersionFromRequest: extractVersionFromRequest as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addDeprecationHeaders: addDeprecationHeaders as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createHttpsEnforcementMiddleware: createHttpsEnforcementMiddleware as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createOriginValidationMiddleware: createOriginValidationMiddleware as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createHostValidationMiddleware: createHostValidationMiddleware as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extractTrustedClientIp: extractTrustedClientIp as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createHttpProtocolVersionMiddleware: createHttpProtocolVersionMiddleware as any,
    log: logger,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}
