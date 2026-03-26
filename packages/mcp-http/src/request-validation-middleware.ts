import type { RequestHandler } from 'express';

export interface HttpRequestValidationLogger {
  warn(message: string, meta?: unknown): void;
}

export interface CreateHttpsEnforcementMiddlewareOptions {
  readonly enabled: boolean;
  readonly log?: HttpRequestValidationLogger;
}

export interface CreateOriginValidationMiddlewareOptions {
  readonly corsOrigins: string[];
  readonly log?: HttpRequestValidationLogger;
}

export interface CreateHostValidationMiddlewareOptions {
  readonly allowedHosts: string[];
  readonly log?: HttpRequestValidationLogger;
}

const defaultLogger: HttpRequestValidationLogger = {
  warn(message: string, meta?: unknown) {
    console.warn(message, meta);
  },
};

export function createHttpsEnforcementMiddleware(
  options: CreateHttpsEnforcementMiddlewareOptions
): RequestHandler {
  const { enabled, log = defaultLogger } = options;

  return (req, res, next) => {
    if (!enabled) {
      return next();
    }

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (isHttps) {
      return next();
    }

    log.warn('Rejected non-HTTPS request in production', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      protocol: req.protocol,
      forwardedProto: req.headers['x-forwarded-proto'],
    });

    res.status(426).json({
      error: 'UPGRADE_REQUIRED',
      message: 'HTTPS is required for all requests in production mode',
      details: {
        reason:
          'Security: OAuth tokens and sensitive data must be transmitted over encrypted connections',
        action: 'Use https:// instead of http:// in your request URL',
      },
    });
  };
}

export function createOriginValidationMiddleware(
  options: CreateOriginValidationMiddlewareOptions
): RequestHandler {
  const { corsOrigins, log = defaultLogger } = options;

  return (req, res, next) => {
    const origin = req.get('origin');
    const referer = req.get('referer');

    if (!origin && !referer) {
      return next();
    }

    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    if (!requestOrigin || corsOrigins.includes(requestOrigin)) {
      return next();
    }

    log.warn('Rejected request with invalid Origin', {
      origin: requestOrigin,
      path: req.path,
      method: req.method,
      ip: req.ip,
      allowedOrigins: corsOrigins,
    });

    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Invalid Origin header',
    });
  };
}

export function createHostValidationMiddleware(
  options: CreateHostValidationMiddlewareOptions
): RequestHandler {
  const { allowedHosts, log = defaultLogger } = options;
  const allowedHostSet = new Set(allowedHosts.map((host) => host.toLowerCase()));

  return (req, res, next) => {
    const host = req.get('host');
    if (!host) {
      return next();
    }

    const hostname = (host.split(':')[0] ?? host).toLowerCase();
    if (allowedHostSet.has(hostname)) {
      return next();
    }

    log.warn('Rejected request with invalid Host header (DNS rebinding protection)', {
      host,
      hostname,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Invalid Host header',
      details: {
        received: hostname,
        hint: 'Set SERVAL_ALLOWED_HOSTS env var to allow additional hostnames',
      },
    });
  };
}
