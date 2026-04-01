import compression from 'compression';
import cors from 'cors';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export interface HttpFoundationLogger {
  warn(message: string, meta?: unknown): void;
}

export interface HttpFoundationEnv {
  readonly OAUTH_ISSUER: string;
  readonly STRICT_MCP_PROTOCOL_VERSION: boolean;
}

export interface HttpVersionSelection {
  readonly selectedVersion: string;
  readonly isDeprecated: boolean;
  readonly deprecationWarning?: string;
}

export interface HttpRequestRecorderLike {
  record(entry: {
    timestamp: number;
    tool_name: string;
    action: string;
    spreadsheet_id: string | null;
    request_body: string;
    response_body: string;
    status_code: number;
    duration_ms: number;
    error_message: string | null;
  }): unknown;
}

export interface RegisterHttpFoundationMiddlewareParams<
  TLog extends HttpFoundationLogger,
  TVersionSelection extends HttpVersionSelection,
> {
  readonly app: Application;
  readonly corsOrigins: string[];
  readonly trustProxy: boolean;
  readonly rateLimitWindowMs: number;
  readonly rateLimitMax: number;
  readonly envConfig: HttpFoundationEnv;
  readonly nodeEnv?: string;
  readonly extraAllowedHosts?: string[];
  readonly createResponseRedactionMiddleware: () => express.RequestHandler;
  readonly getRequestRecorder: () => HttpRequestRecorderLike;
  readonly extractVersionFromRequest: (req: Request) => TVersionSelection;
  readonly addDeprecationHeaders: (res: Response, versionSelection: TVersionSelection) => void;
  readonly createHttpsEnforcementMiddleware: (options: {
    enabled: boolean;
    log: TLog;
  }) => express.RequestHandler;
  readonly createOriginValidationMiddleware: (options: {
    corsOrigins: string[];
    log: TLog;
  }) => express.RequestHandler;
  readonly createHostValidationMiddleware: (options: {
    allowedHosts: string[];
    log: TLog;
  }) => express.RequestHandler;
  readonly extractTrustedClientIp: (req: Request) => string;
  readonly createHttpProtocolVersionMiddleware: (options: {
    strictProtocolVersion: boolean;
    log: TLog;
  }) => express.RequestHandler;
  readonly log: TLog;
}

function resolveOauthIssuerHost(issuer: string): string | undefined {
  try {
    return new URL(issuer).host.toLowerCase();
  } catch {
    return undefined;
  }
}

function buildAllowedHosts(
  oauthIssuerHost: string | undefined,
  extraAllowedHosts: string[] | undefined
): string[] {
  return [
    'localhost',
    '127.0.0.1',
    '::1',
    ...(oauthIssuerHost ? [oauthIssuerHost] : []),
    ...(extraAllowedHosts ?? []),
  ];
}

export function registerHttpFoundationMiddleware<
  TLog extends HttpFoundationLogger,
  TVersionSelection extends HttpVersionSelection,
>(
  params: RegisterHttpFoundationMiddlewareParams<TLog, TVersionSelection>
): void {
  const {
    app,
    corsOrigins,
    trustProxy,
    rateLimitWindowMs,
    rateLimitMax,
    envConfig,
    nodeEnv,
    extraAllowedHosts,
    createResponseRedactionMiddleware,
    getRequestRecorder,
    extractVersionFromRequest,
    addDeprecationHeaders,
    createHttpsEnforcementMiddleware,
    createOriginValidationMiddleware,
    createHostValidationMiddleware,
    extractTrustedClientIp,
    createHttpProtocolVersionMiddleware,
    log,
  } = params;

  const oauthIssuerHost = resolveOauthIssuerHost(envConfig.OAUTH_ISSUER);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          connectSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      strictTransportSecurity:
        nodeEnv === 'production'
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
    })
  );

  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024,
    })
  );

  app.use(createResponseRedactionMiddleware());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const versionSelection = extractVersionFromRequest(req);
    addDeprecationHeaders(res, versionSelection);
    (req as Request & { schemaVersion?: string }).schemaVersion = versionSelection.selectedVersion;
    next();
  });

  const recorder = getRequestRecorder();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- must match Express res.json signature
    res.json = function (data: any) {
      const duration = Date.now() - startTime;
      const toolName = req.body?.tool || req.body?.name || 'unknown';
      const action = req.body?.action || req.body?.arguments?.action || 'unknown';
      const spreadsheetId =
        req.body?.spreadsheetId ||
        req.body?.arguments?.spreadsheetId ||
        req.body?.params?.spreadsheetId ||
        null;

      recorder.record({
        timestamp: startTime,
        tool_name: toolName,
        action,
        spreadsheet_id: spreadsheetId,
        request_body: JSON.stringify(req.body || {}),
        response_body: JSON.stringify(data),
        status_code: res.statusCode,
        duration_ms: duration,
        error_message: data?.error ? JSON.stringify(data.error) : null,
      });

      return originalJson(data);
    };

    next();
  });

  app.use(
    createHttpsEnforcementMiddleware({
      enabled: nodeEnv === 'production',
      log,
    })
  );

  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Request-ID',
        'X-Session-ID',
        'MCP-Session-Id',
        'MCP-Protocol-Version',
        'Last-Event-ID',
      ],
      exposedHeaders: ['MCP-Session-Id', 'X-Session-ID', 'MCP-Protocol-Version'],
    })
  );

  app.use(
    createOriginValidationMiddleware({
      corsOrigins,
      log,
    })
  );

  app.use(
    createHostValidationMiddleware({
      allowedHosts: buildAllowedHosts(oauthIssuerHost, extraAllowedHosts),
      log,
    })
  );

  const limiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    // Disable built-in validation — express-rate-limit v8 throws
    // ValidationError for trust proxy configs behind reverse proxies,
    // crashing requests before route handlers run. Trust proxy is
    // configured correctly at the app level (trust proxy = 1).
    validate: false,
    keyGenerator: (req: Request) => {
      const ip = extractTrustedClientIp(req);
      return `${ipKeyGenerator(ip)}:${req.method}:${req.path}`;
    },
    message: { error: 'Too many requests, please try again later' },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/health')) {
      return next();
    }
    limiter(req, res, next);
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const limit = res.getHeader('RateLimit-Limit');
    const remaining = res.getHeader('RateLimit-Remaining');
    const reset = res.getHeader('RateLimit-Reset');

    if (limit) {
      res.setHeader('X-RateLimit-Limit', limit);
    }
    if (remaining) {
      res.setHeader('X-RateLimit-Remaining', remaining);
    }
    if (reset) {
      res.setHeader('X-RateLimit-Reset', reset);
    }

    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  app.use(
    createHttpProtocolVersionMiddleware({
      strictProtocolVersion: envConfig.STRICT_MCP_PROTOCOL_VERSION,
      log,
    })
  );
}
