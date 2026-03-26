import { describe, expect, it, vi } from 'vitest';
import { registerHttpOpenApiDocsRoutes } from '../../src/http-server/openapi-docs-routes.js';

function createJsonResponseDouble() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headers: new Map<string, string>(),
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: any, body: unknown) {
      this.body = body;
      return this;
    }),
    set: vi.fn(function (this: any, key: string, value: string) {
      this.headers.set(key, value);
      return this;
    }),
    send: vi.fn(function (this: any, body: unknown) {
      this.body = body;
      return this;
    }),
  };
}

describe('http openapi docs routes', () => {
  it('registers a fallback /api-docs route when specs are unavailable', () => {
    const get = vi.fn();
    const use = vi.fn();

    registerHttpOpenApiDocsRoutes({
      app: { get, use } as never,
      openapiJsonPath: null,
      openapiYamlPath: null,
      existsSync: vi.fn(() => false),
    });

    expect(get).toHaveBeenCalledWith('/api-docs/openapi.json', expect.any(Function));
    expect(get).toHaveBeenCalledWith('/api-docs/openapi.yaml', expect.any(Function));
    expect(get).toHaveBeenCalledWith('/api-docs', expect.any(Function));
    expect(use).not.toHaveBeenCalled();

    const fallbackHandler = get.mock.calls.find(([path]) => path === '/api-docs')?.[1];
    const res = createJsonResponseDouble();
    fallbackHandler?.({} as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'API documentation not available. Generate OpenAPI spec with: npm run gen:openapi',
        hint: 'Run the generator script to create openapi.json and enable interactive documentation',
      },
    });
  });

  it('registers swagger ui when the JSON spec exists', () => {
    const get = vi.fn();
    const use = vi.fn();
    const swaggerSetup = vi.fn(() => 'swagger-setup');
    const readSpec = vi.fn(() => JSON.stringify({ openapi: '3.1.0', info: { title: 'ServalSheets' } }));

    registerHttpOpenApiDocsRoutes({
      app: { get, use } as never,
      openapiJsonPath: '/tmp/openapi.json',
      openapiYamlPath: '/tmp/openapi.yaml',
      existsSync: vi.fn((path: string) => path === '/tmp/openapi.json'),
      readFileSync: readSpec,
      swaggerServe: 'swagger-serve',
      swaggerSetup,
    });

    expect(swaggerSetup).toHaveBeenCalledWith(
      { openapi: '3.1.0', info: { title: 'ServalSheets' } },
      expect.objectContaining({
        customSiteTitle: 'ServalSheets API Documentation',
      })
    );
    expect(use).toHaveBeenCalledWith('/api-docs', 'swagger-serve', 'swagger-setup');
  });
});
