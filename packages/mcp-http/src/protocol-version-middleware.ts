import type { Request, RequestHandler } from 'express';

export interface HttpProtocolVersionLogger {
  warn(message: string, meta?: unknown): void;
}

export interface CreateHttpProtocolVersionMiddlewareOptions {
  readonly strictProtocolVersion: boolean;
  readonly supportedVersion?: string;
  readonly log?: HttpProtocolVersionLogger;
}

const DEFAULT_SUPPORTED_VERSION = '2025-11-25';

const defaultLogger: HttpProtocolVersionLogger = {
  warn(message: string, meta?: unknown) {
    console.warn(message, meta);
  },
};

function isInitializeRequest(req: Request): boolean {
  const body = req.body as unknown;
  if (!(req.method === 'POST' && req.path.startsWith('/mcp'))) {
    return false;
  }

  if (Array.isArray(body)) {
    return body.some(
      (entry) =>
        entry && typeof entry === 'object' && 'method' in entry && entry.method === 'initialize'
    );
  }

  return Boolean(
    body && typeof body === 'object' && 'method' in body && body.method === 'initialize'
  );
}

export function createHttpProtocolVersionMiddleware(
  options: CreateHttpProtocolVersionMiddlewareOptions
): RequestHandler {
  const {
    strictProtocolVersion,
    supportedVersion = DEFAULT_SUPPORTED_VERSION,
    log = defaultLogger,
  } = options;

  return (req, res, next) => {
    res.setHeader('MCP-Protocol-Version', supportedVersion);

    if (!req.path.startsWith('/sse') && !req.path.startsWith('/mcp')) {
      return next();
    }

    const clientVersion = req.headers['mcp-protocol-version'] as string | undefined;

    if (strictProtocolVersion && !clientVersion && !isInitializeRequest(req)) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: `Missing MCP-Protocol-Version header. Expected MCP-Protocol-Version: ${supportedVersion}`,
        },
      });
      return;
    }

    if (clientVersion && clientVersion !== supportedVersion) {
      log.warn('Request rejected: unsupported MCP protocol version', {
        clientVersion,
        supportedVersion,
        path: req.path,
        method: req.method,
      });

      res.status(400).json({
        error: 'UNSUPPORTED_PROTOCOL_VERSION',
        message: `MCP protocol version '${clientVersion}' is not supported`,
        details: {
          requested: clientVersion,
          supported: supportedVersion,
          spec: 'https://modelcontextprotocol.io/specification/2025-11-25/basic/transports',
        },
      });
      return;
    }

    next();
  };
}
