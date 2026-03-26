import { beforeEach, describe, expect, it, vi } from 'vitest';

const graphqlAdminMocks = vi.hoisted(() => ({
  addAdminRoutes: vi.fn(),
  addGraphQLEndpoint: vi.fn(),
  createTokenBackedInitializedGoogleHandlerContext: vi.fn(),
  requestDeduplicator: {
    getStats: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/core/index.js', async () => {
  class MockAuthenticationError extends Error {}
  return {
    AuthenticationError: MockAuthenticationError,
  };
});

vi.mock('../../src/admin/index.js', () => ({
  addAdminRoutes: graphqlAdminMocks.addAdminRoutes,
}));

vi.mock('../../src/graphql/index.js', () => ({
  addGraphQLEndpoint: graphqlAdminMocks.addGraphQLEndpoint,
}));

vi.mock('../../src/server/google-handler-bundle.js', () => ({
  createTokenBackedInitializedGoogleHandlerContext:
    graphqlAdminMocks.createTokenBackedInitializedGoogleHandlerContext,
}));

vi.mock('../../src/utils/request-deduplication.js', () => ({
  requestDeduplicator: graphqlAdminMocks.requestDeduplicator,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: graphqlAdminMocks.logger,
}));

import { registerHttpGraphQlAndAdmin } from '../../src/http-server/graphql-admin.js';

describe('http graphql/admin registration', () => {
  beforeEach(() => {
    graphqlAdminMocks.addAdminRoutes.mockReset();
    graphqlAdminMocks.addGraphQLEndpoint.mockReset();
    graphqlAdminMocks.createTokenBackedInitializedGoogleHandlerContext.mockReset();
    graphqlAdminMocks.requestDeduplicator.getStats.mockReset();
    graphqlAdminMocks.logger.debug.mockReset();
    graphqlAdminMocks.logger.info.mockReset();
    graphqlAdminMocks.logger.error.mockReset();

    graphqlAdminMocks.addGraphQLEndpoint.mockResolvedValue(undefined);
    graphqlAdminMocks.requestDeduplicator.getStats.mockReturnValue({ totalRequests: 42 });
    graphqlAdminMocks.createTokenBackedInitializedGoogleHandlerContext.mockResolvedValue({
      context: { kind: 'handler-context' },
    });
  });

  it('registers GraphQL and admin handlers using token-backed context creation', async () => {
    const app = { kind: 'app' };
    const sessions = new Map([['session-1', { kind: 'session' }]]);

    registerHttpGraphQlAndAdmin({
      app: app as never,
      sessions,
    });

    expect(graphqlAdminMocks.addGraphQLEndpoint).toHaveBeenCalledOnce();
    expect(graphqlAdminMocks.addAdminRoutes).toHaveBeenCalledOnce();

    const getHandlerContextForGraphQL =
      graphqlAdminMocks.addGraphQLEndpoint.mock.calls[0]?.[1];
    expect(getHandlerContextForGraphQL).toBeTypeOf('function');

    await expect(getHandlerContextForGraphQL()).rejects.toThrow(
      'Authentication required for GraphQL endpoint'
    );

    const context = await getHandlerContextForGraphQL('access-token');
    expect(context).toEqual({ kind: 'handler-context' });

    const googleRuntimeOptions =
      graphqlAdminMocks.createTokenBackedInitializedGoogleHandlerContext.mock.calls[0]?.[0];
    expect(googleRuntimeOptions).toMatchObject({
      accessToken: 'access-token',
      refreshToken: undefined,
      requestDeduplicator: graphqlAdminMocks.requestDeduplicator,
    });
    expect(googleRuntimeOptions?.onProgress).toBeTypeOf('function');

    await googleRuntimeOptions?.onProgress?.({
      phase: 'resolve',
      current: 1,
      total: 2,
      message: 'Working',
      spreadsheetId: 'sheet-1',
    });

    expect(graphqlAdminMocks.logger.debug).toHaveBeenCalledWith(
      'GraphQL operation progress',
      {
        phase: 'resolve',
        progress: '1/2',
        message: 'Working',
        spreadsheetId: 'sheet-1',
      }
    );

    const sessionManager = graphqlAdminMocks.addAdminRoutes.mock.calls[0]?.[1];
    expect(sessionManager.getSessionCount()).toBe(1);
    expect(sessionManager.getTotalRequests()).toBe(42);
    expect(sessionManager.getAllSessions()).toEqual([
      expect.objectContaining({
        id: 'session-1',
        clientName: 'MCP Client',
        clientVersion: '1.0.0',
      }),
    ]);
  });
});
