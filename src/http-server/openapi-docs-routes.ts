import { existsSync, readFileSync } from 'fs';
import type { Application } from 'express';
import * as swaggerUi from 'swagger-ui-express';
import { logger as defaultLogger } from '../utils/logger.js';
import { resolveOpenApiJsonPath, resolveOpenApiYamlPath } from '../utils/runtime-paths.js';
import {
  registerHttpOpenApiDocsRoutes as registerHttpOpenApiDocsRoutesImpl,
  type HttpOpenApiDocsLogger,
} from '../../packages/mcp-http/dist/openapi-docs-routes.js';

export type { HttpOpenApiDocsLogger };

export interface RegisterHttpOpenApiDocsRoutesOptions {
  app: Pick<Application, 'get' | 'use'>;
  openapiJsonPath?: string | null | undefined;
  openapiYamlPath?: string | null | undefined;
  existsSync?: (path: string) => boolean;
  readFileSync?: (path: string, encoding: string) => string;
  swaggerServe?: unknown;
  swaggerSetup?: (spec: unknown, options: Record<string, unknown>) => unknown;
  log?: HttpOpenApiDocsLogger;
}

export function registerHttpOpenApiDocsRoutes(options: RegisterHttpOpenApiDocsRoutesOptions): void {
  registerHttpOpenApiDocsRoutesImpl({
    app: options.app,
    openapiJsonPath: options.openapiJsonPath ?? resolveOpenApiJsonPath(),
    openapiYamlPath: options.openapiYamlPath ?? resolveOpenApiYamlPath(),
    existsSync: options.existsSync ?? existsSync,
    readFileSync:
      options.readFileSync ??
      ((path: string, encoding: string) => readFileSync(path, encoding as BufferEncoding)),
    swaggerServe: options.swaggerServe ?? swaggerUi.serve,
    swaggerSetup:
      options.swaggerSetup ??
      (swaggerUi.setup as unknown as (spec: unknown, options: Record<string, unknown>) => unknown),
    log: (options.log ?? defaultLogger) as HttpOpenApiDocsLogger,
  });
}
