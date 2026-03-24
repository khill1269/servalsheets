import type { Express } from 'express';
import {
  AuthenticationError,
} from '../core/index.js';
import { addAdminRoutes, type AdminSessionManager } from '../admin/index.js';
import { addGraphQLEndpoint } from '../graphql/index.js';
import type { HandlerContext } from '../handlers/index.js';
import { requestDeduplicator } from '../utils/request-deduplication.js';
import { logger } from '../utils/logger.js';
import { createTokenBackedInitializedGoogleHandlerContext } from '../server/google-handler-bundle.js';

export function registerHttpGraphQlAndAdmin(params: {
  app: Express;
  sessions: Map<string, unknown>;
}): void {
  const { app, sessions } = params;

  // GraphQL handler context factory
  const getHandlerContextForGraphQL = async (authToken?: string): Promise<HandlerContext> => {
    if (!authToken) {
      throw new AuthenticationError('Authentication required for GraphQL endpoint');
    }

    const googleRuntime = await createTokenBackedInitializedGoogleHandlerContext({
      accessToken: authToken,
      refreshToken: undefined, // GraphQL uses bearer tokens, no refresh token
      onProgress: async (event) => {
        logger.debug('GraphQL operation progress', {
          phase: event.phase,
          progress: `${event.current}/${event.total}`,
          message: event.message,
          spreadsheetId: event.spreadsheetId,
        });
      },
      requestDeduplicator,
    });

    return googleRuntime.context;
  };

  // Initialize GraphQL endpoint (P3-1)
  addGraphQLEndpoint(app, getHandlerContextForGraphQL)
    .then(() => {
      logger.info('GraphQL endpoint initialized at /graphql');
    })
    .catch((error) => {
      logger.error('Failed to initialize GraphQL endpoint', { error });
    });

  // Session manager for admin dashboard
  const sessionManager: AdminSessionManager = {
    getAllSessions: () => {
      return Array.from(sessions.entries()).map(([id]) => ({
        id,
        clientName: 'MCP Client',
        clientVersion: '1.0.0',
        createdAt: Date.now(), // Approximate - sessions don't track creation time
      }));
    },
    getSessionCount: () => sessions.size,
    getTotalRequests: () => {
      // Approximate - use deduplication stats as proxy
      const stats = requestDeduplicator.getStats();
      return stats.totalRequests;
    },
  };

  // Initialize Admin Dashboard (P3-7)
  addAdminRoutes(app, sessionManager);
}
