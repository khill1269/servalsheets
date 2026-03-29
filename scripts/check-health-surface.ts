import { createHttpServer } from '../src/http-server.js';

type Handler = (req: Record<string, unknown>, res: ReturnType<typeof createResponseDouble>) => unknown;

function createResponseDouble() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
  };
}

function getRouteHandler(app: unknown, method: 'get' | 'head', path: string): Handler {
  const stack = (app as { router?: { stack?: Array<Record<string, unknown>> } }).router?.stack ?? [];

  for (const layer of stack) {
    const route = layer['route'] as
      | {
          path?: string;
          methods?: Record<string, boolean>;
          stack?: Array<{ handle?: Handler }>;
        }
      | undefined;

    if (route?.path !== path || route.methods?.[method] !== true) {
      continue;
    }

    const handler = route.stack?.[0]?.handle;
    if (handler) {
      return handler;
    }
  }

  throw new Error(`Missing ${method.toUpperCase()} handler for ${path}`);
}

async function expectJsonStatus(
  handler: Handler,
  expectedStatusCode: number,
  expectedStatus: string
): Promise<unknown> {
  const response = createResponseDouble();
  await handler({}, response);

  if (response.statusCode !== expectedStatusCode) {
    throw new Error(`Expected HTTP ${expectedStatusCode}, got ${response.statusCode}`);
  }

  const status = (response.body as { status?: string } | undefined)?.status;
  if (status !== expectedStatus) {
    throw new Error(`Expected status "${expectedStatus}", got ${JSON.stringify(response.body)}`);
  }

  return response.body;
}

async function expectHeadOk(handler: Handler): Promise<void> {
  const response = createResponseDouble();
  await handler({}, response);

  if (response.statusCode !== 200) {
    throw new Error(`Expected HEAD /health to return 200, got ${response.statusCode}`);
  }
}

async function main(): Promise<void> {
  process.env['ENABLE_METRICS_SERVER'] = 'false';

  const server = createHttpServer({ host: '127.0.0.1', port: 0 });
  const app = server.app;

  try {
    const live = await expectJsonStatus(
      getRouteHandler(app, 'get', '/health/live'),
      200,
      'healthy'
    );
    const ready = await expectJsonStatus(
      getRouteHandler(app, 'get', '/health/ready'),
      200,
      'healthy'
    );
    const health = await expectJsonStatus(getRouteHandler(app, 'get', '/health'), 200, 'healthy');
    await expectHeadOk(getRouteHandler(app, 'head', '/health'));

    console.log(
      JSON.stringify(
        {
          ok: true,
          routes: {
            '/health/live': (live as { status?: string }).status,
            '/health/ready': (ready as { status?: string }).status,
            '/health': (health as { status?: string }).status,
            'HEAD /health': 200,
          },
        },
        null,
        2
      )
    );
  } finally {
    await server.stop();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
