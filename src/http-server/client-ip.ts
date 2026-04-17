import type { Request } from 'express';
import { logger } from '../utils/logger.js';
import {
  extractTrustedClientIp as extractTrustedClientIpImpl,
  normalizeClientIp,
  type ClientIpLogger,
} from '../../packages/mcp-http/dist/client-ip.js';

export { normalizeClientIp, type ClientIpLogger };

export function extractTrustedClientIp(req: Request, fallback = '127.0.0.1'): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return extractTrustedClientIpImpl(req as any, fallback, logger as ClientIpLogger);
}
