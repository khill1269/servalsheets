/**
 * GraphQL Server Setup
 *
 * Configures Apollo Server with schema, resolvers, and authentication.
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import type { Express, Request, Response } from 'express';
import { json } from 'express';
import { typeDefs } from './schema.js';
import { resolvers, type GraphQLContext } from './resolvers.js';
import type { HandlerContext } from '../handlers/index.js';
import { logger } from '../utils/logger.js';

/**
 * Create and configure Apollo Server
 */
export function createApolloServer() {
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    formatError: (formattedError, error) => {
      // Log errors for debugging
      logger.error('GraphQL Error', {
        message: formattedError.message,
        path: formattedError.path,
        extensions: formattedError.extensions,
      });

      // Don't expose internal error details in production
      if (process.env['NODE_ENV'] === 'production') {
        return {
          message: formattedError.message,
          extensions: {
            code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR',
          },
        };
      }

      return formattedError;
    },
    introspection: process.env['NODE_ENV'] !== 'production',
  });

  return server;
}

/**
 * Add GraphQL endpoint to Express app
 */
export async function addGraphQLEndpoint(
  app: Express,
  getHandlerContext: (req: Request) => HandlerContext
): Promise<void> {
  const server = createApolloServer();

  await server.start();

  app.use(
    '/graphql',
    json(),
    expressMiddleware(server, {
      context: async ({ req }): Promise<GraphQLContext> => {
        // Extract user ID from auth header (if present)
        const authHeader = req.headers['authorization'];
        const userId = authHeader?.replace('Bearer ', '');

        // Get handler context for this request
        const handlerContext = getHandlerContext(req as Request);

        return {
          handlerContext,
          userId,
        };
      },
    })
  );

  logger.info('GraphQL endpoint enabled at /graphql', {
    introspection: process.env['NODE_ENV'] !== 'production',
    playground: 'Apollo Sandbox (studio.apollographql.com/sandbox)',
  });
}
