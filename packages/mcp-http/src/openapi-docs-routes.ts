import type { Request, Response } from 'express';

export interface HttpOpenApiDocsLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface RegisterHttpOpenApiDocsRoutesOptions<
  TApp,
  TSwaggerServe = unknown,
  TSwaggerSetup = unknown,
> {
  readonly app: TApp;
  readonly openapiJsonPath: string | null | undefined;
  readonly openapiYamlPath: string | null | undefined;
  readonly existsSync: (path: string) => boolean;
  readonly readFileSync: (path: string, encoding: string) => string;
  readonly swaggerServe: TSwaggerServe;
  readonly swaggerSetup: (spec: unknown, options: Record<string, unknown>) => TSwaggerSetup;
  readonly log?: HttpOpenApiDocsLogger;
}

const defaultLogger: HttpOpenApiDocsLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
  warn(message: string, meta?: unknown) {
    console.warn(message, meta);
  },
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export function registerHttpOpenApiDocsRoutes<
  TApp extends Pick<
    {
      get(path: string, handler: (req: Request, res: Response) => unknown): void;
      use(...args: unknown[]): void;
    },
    'get' | 'use'
  >,
  TSwaggerServe,
  TSwaggerSetup,
>(
  options: RegisterHttpOpenApiDocsRoutesOptions<TApp, TSwaggerServe, TSwaggerSetup>
): void {
  const {
    app,
    openapiJsonPath,
    openapiYamlPath,
    existsSync,
    readFileSync,
    swaggerServe,
    swaggerSetup,
    log = defaultLogger,
  } = options;

  app.get('/api-docs/openapi.json', (_req: Request, res: Response) => {
    try {
      if (openapiJsonPath && existsSync(openapiJsonPath)) {
        const spec = JSON.parse(readFileSync(openapiJsonPath, 'utf-8'));
        res.json(spec);
      } else {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'OpenAPI spec not generated. Run: npm run gen:openapi',
          },
        });
      }
    } catch (error) {
      log.error('Failed to serve OpenAPI spec', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load OpenAPI spec',
        },
      });
    }
  });

  app.get('/api-docs/openapi.yaml', (_req: Request, res: Response) => {
    try {
      if (openapiYamlPath && existsSync(openapiYamlPath)) {
        const spec = readFileSync(openapiYamlPath, 'utf-8');
        res.set('Content-Type', 'text/yaml');
        res.send(spec);
      } else {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'OpenAPI spec not generated. Run: npm run gen:openapi',
          },
        });
      }
    } catch (error) {
      log.error('Failed to serve OpenAPI spec', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load OpenAPI spec',
        },
      });
    }
  });

  if (openapiJsonPath && existsSync(openapiJsonPath)) {
    try {
      const openapiSpec = JSON.parse(readFileSync(openapiJsonPath, 'utf-8'));
      app.use(
        '/api-docs',
        swaggerServe,
        swaggerSetup(openapiSpec, {
          customCss: '.swagger-ui .topbar { display: none }',
          customSiteTitle: 'ServalSheets API Documentation',
          customfavIcon: '/favicon.ico',
        })
      );
      log.info('Swagger UI enabled at /api-docs');
    } catch (error) {
      log.warn('Failed to load OpenAPI spec for Swagger UI', { error });
    }
  } else {
    app.get('/api-docs', (_req: Request, res: Response) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message:
            'API documentation not available. Generate OpenAPI spec with: npm run gen:openapi',
          hint: 'Run the generator script to create openapi.json and enable interactive documentation',
        },
      });
    });
  }
}
