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
      OAUTH_ISSUER: envConfig.OAUTH_ISSUER,
      STRICT_MCP_PROTOCOL_VERSION: envConfig.STRICT_MCP_PROTOCOL_VERSION,
    },
    nodeEnv: process.env['NODE_ENV'],
    extraAllowedHosts:
      process.env['SERVAL_ALLOWED_HOSTS']?.split(',').map((host) => host.trim().toLowerCase()) ??
      [],
    createResponseRedactionMiddleware: responseRedactionMiddleware,
    getRequestRecorder,
    extractVersionFromRequest,
    addDeprecationHeaders,
    createHttpsEnforcementMiddleware,
    createOriginValidationMiddleware,
    createHostValidationMiddleware,
    extractTrustedClientIp,
    createHttpProtocolVersionMiddleware,
    log: logger,
  });
}
