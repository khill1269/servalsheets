import type { Request } from 'express';

export interface ClientIpLogger {
  warn(message: string, meta?: unknown): void;
}

const defaultLogger: ClientIpLogger = {
  warn(message: string, meta?: unknown) {
    console.warn(message, meta);
  },
};

function coerceHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function firstForwardedIp(value: string | string[] | undefined): string | undefined {
  return coerceHeaderValue(value)?.split(',')[0]?.trim();
}

export function normalizeClientIp(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  let ip = raw.trim();
  if (!ip) {
    return undefined;
  }

  if (ip.startsWith('[')) {
    const closingBracket = ip.indexOf(']');
    if (closingBracket > 1) {
      ip = ip.slice(1, closingBracket);
    }
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.replace(/:\d+$/, '');
  }

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice('::ffff:'.length);
  }

  return ip;
}

export function extractTrustedClientIp(
  req: Request,
  fallback = '127.0.0.1',
  log: ClientIpLogger = defaultLogger
): string {
  const trustProxy = Boolean(req.app.get('trust proxy'));
  const forwardedFor = req.headers['x-forwarded-for'];

  if (!trustProxy && forwardedFor) {
    log.warn('Ignoring x-forwarded-for header because trust proxy is disabled', {
      method: req.method,
      path: req.path,
    });
  }

  const candidates = trustProxy
    ? [req.ip, firstForwardedIp(forwardedFor), req.socket.remoteAddress]
    : [req.socket.remoteAddress, req.ip];

  for (const candidate of candidates) {
    const normalized = normalizeClientIp(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return fallback;
}
