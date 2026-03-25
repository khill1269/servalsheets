import type { Express } from 'express';
import { AuthenticationError } from '../core/index.js';
import { addAdminRoutes } from '../admin/index.js';
import { addGraphQLEndpoint } from '../graphql/index.js';
import { requestDeduplicator } from '../utils/request-deduplication.js';
import { logger } from '../utils/logger.js';
import { createTokenBackedInitializedGoogleHandlerContext } from '../server/google-handler-bundle.js';
import { registerHttpGraphQlAndAdmin as registerPackagedHttpGraphQlAndAdmin } from '../../packages/mcp-http/dist/graphql-admin.js';

export function registerHttpGraphQlAndAdmin(params: {
  app: Express;
  sessions: Map<string, unknown>;
}): void {
  registerPackagedHttpGraphQlAndAdmin({
    ...params,
    createAuthenticationError: (message) => new AuthenticationError(message),
    createTokenBackedInitializedGoogleHandlerContext,
    requestDeduplicator,
    log: logger,
    addGraphQLEndpoint,
    addAdminRoutes,
  });
}
