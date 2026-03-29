import type { Request } from 'express';
import { logger } from '../utils/logger.js';
import {
  extractTrustedClientIp as extractTrustedClientIpImpl,
  normalizeClientIp,
  type ClientIpLogger,
} from '#mcp-http/client-ip';

export { normalizeClientIp, type ClientIpLogger };

export function extractTrustedClientIp(req: Request, fallback = '127.0.0.1'): string {
  return extractTrustedClientIpImpl(req, fallback, logger as ClientIpLogger);
}
