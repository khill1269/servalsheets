import type { Request, Response } from 'express';

export interface HttpObservabilityCoreLogger {
  info(message: string, meta?: unknown): void;
}

export interface RegisterHttpObservabilityCoreRoutesOptions<
  TApp,
  THealthService,
  TObservabilityOptions,
> {
  readonly app: TApp;
  readonly healthService: THealthService;
  readonly options: TObservabilityOptions & {
    enableOAuth?: boolean;
    oauthConfig?: {
      clientId: string;
      clientSecret: string;
    };
  };
  readonly host: string;
  readonly port: number;
  readonly legacySseEnabled: boolean;
  readonly getSessionCount: () => number;
  readonly serverInfo: {
    name: string;
    version: string;
    protocolVersion: string;
    description: string;
    toolCount: number;
    actionCount: number;
  };
  readonly log?: HttpObservabilityCoreLogger;
}

const defaultLogger: HttpObservabilityCoreLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
};

export function registerHttpObservabilityCoreRoutes<
  TApp extends Pick<
    {
      get(path: string, handler: (req: Request, res: Response) => unknown): void;
      head(path: string, handler: (req: Request, res: Response) => unknown): void;
    },
    'get' | 'head'
  >,
  THealthService extends {
    checkLiveness(): Promise<unknown>;
    checkReadiness(): Promise<{ status: string } & Record<string, unknown>>;
  },
  TObservabilityOptions,
>(options: RegisterHttpObservabilityCoreRoutesOptions<TApp, THealthService, TObservabilityOptions>): void {
  const {
    app,
    healthService,
    options: observabilityOptions,
    host,
    port,
    legacySseEnabled,
    getSessionCount,
    serverInfo,
    log = defaultLogger,
  } = options;

  app.get('/health/live', async (_req: Request, res: Response) => {
    const health = await healthService.checkLiveness();
    res.status(200).json(health);
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    const baseHealth = await healthService.checkReadiness();
    const health: typeof baseHealth & {
      oauth?: {
        enabled: boolean;
        configured: boolean;
      };
      sessions?: {
        hasAuthentication: boolean;
      };
    } = { ...baseHealth };

    if (observabilityOptions.enableOAuth && observabilityOptions.oauthConfig) {
      health.oauth = {
        enabled: true,
        configured: Boolean(
          observabilityOptions.oauthConfig.clientId &&
            observabilityOptions.oauthConfig.clientSecret &&
            !observabilityOptions.oauthConfig.clientSecret.includes('REPLACE_WITH')
        ),
      };
    }

    health.sessions = {
      hasAuthentication: getSessionCount() > 0,
    };

    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  });

  app.get('/health', async (_req: Request, res: Response) => {
    const health = await healthService.checkReadiness();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  });

  app.get('/trace', (req: Request, res: Response) => {
    const traceId = req.headers['x-trace-id'] as string | undefined;
    const spanId = req.headers['x-span-id'] as string | undefined;
    const parentSpanId = req.headers['x-parent-span-id'] as string | undefined;
    const requestId = req.headers['x-request-id'] as string | undefined;

    res.json({
      traceContext: {
        traceId,
        spanId,
        parentSpanId,
        requestId,
      },
      message: 'W3C Trace Context information for this request',
      spec: 'https://www.w3.org/TR/trace-context/',
      usage: 'Include traceparent header in requests: traceparent: 00-<traceId>-<parentId>-01',
    });
  });

  app.get('/info', (req: Request, res: Response) => {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `${host}:${port}`;
    const baseUrl = `${protocol}://${hostHeader}`;
    const transports = legacySseEnabled
      ? ['stdio', 'streamable-http', 'sse']
      : ['stdio', 'streamable-http'];
    const endpoints: Record<string, string> = {
      mcp: `${baseUrl}/mcp`,
      health: `${baseUrl}/health`,
      metrics: `${baseUrl}/metrics`,
      circuitBreakers: `${baseUrl}/metrics/circuit-breakers`,
      stats: `${baseUrl}/stats`,
      traces: `${baseUrl}/traces`,
      tracesRecent: `${baseUrl}/traces/recent`,
      tracesSlow: `${baseUrl}/traces/slow`,
      tracesErrors: `${baseUrl}/traces/errors`,
      tracesStats: `${baseUrl}/traces/stats`,
      apiDocs: `${baseUrl}/api-docs`,
      openapiJson: `${baseUrl}/api-docs/openapi.json`,
      openapiYaml: `${baseUrl}/api-docs/openapi.yaml`,
    };
    if (legacySseEnabled) {
      endpoints['sse'] = `${baseUrl}/sse`;
    }

    res.json({
      name: serverInfo.name,
      version: serverInfo.version,
      description: serverInfo.description,
      tools: serverInfo.toolCount,
      actions: serverInfo.actionCount,
      protocol: `MCP ${serverInfo.protocolVersion}`,
      transports,
      discovery: {
        mcp_configuration: `${baseUrl}/.well-known/mcp-configuration`,
        oauth_authorization_server: `${baseUrl}/.well-known/oauth-authorization-server`,
        oauth_protected_resource: `${baseUrl}/.well-known/oauth-protected-resource`,
      },
      endpoints,
    });
  });

  app.head('/health', (_req: Request, res: Response) => res.status(200).end());
  app.head('/health/live', (_req: Request, res: Response) => res.status(200).end());
  app.head('/health/ready', (_req: Request, res: Response) => res.status(200).end());
  app.head('/info', (_req: Request, res: Response) => res.status(200).end());

  log.info('HTTP observability core routes registered');
}
