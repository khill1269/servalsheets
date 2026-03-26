export interface HttpGraphQlAdminLogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface HttpGraphQlAdminProgressEvent {
  phase?: string;
  current: number;
  total?: number;
  message?: string;
  spreadsheetId?: string;
}

export interface HttpGraphQlAdminRequestDeduplicator {
  getStats(): {
    totalRequests: number;
  };
}

export interface HttpGraphQlAdminSessionSummary {
  id: string;
  clientName: string;
  clientVersion: string;
  createdAt: number;
}

export interface RegisterHttpGraphQlAndAdminOptions<
  TApp,
  TContext,
  TRequestDeduplicator extends HttpGraphQlAdminRequestDeduplicator,
> {
  readonly app: TApp;
  readonly sessions: Map<string, unknown>;
  readonly createAuthenticationError: (message: string) => Error;
  readonly createTokenBackedInitializedGoogleHandlerContext: (options: {
    accessToken: string;
    refreshToken?: string;
    onProgress: (event: HttpGraphQlAdminProgressEvent) => Promise<void> | void;
    requestDeduplicator: TRequestDeduplicator;
  }) => Promise<{
    context: TContext;
  }>;
  readonly requestDeduplicator: TRequestDeduplicator;
  readonly log: HttpGraphQlAdminLogger;
  readonly addGraphQLEndpoint: (
    app: TApp,
    getHandlerContextForGraphQL: (authToken?: string) => Promise<TContext>
  ) => Promise<unknown>;
  readonly addAdminRoutes: (
    app: TApp,
    sessionManager: {
      getAllSessions: () => HttpGraphQlAdminSessionSummary[];
      getSessionCount: () => number;
      getTotalRequests: () => number;
    }
  ) => void;
}

export function registerHttpGraphQlAndAdmin<
  TApp,
  TContext,
  TRequestDeduplicator extends HttpGraphQlAdminRequestDeduplicator,
>(
  options: RegisterHttpGraphQlAndAdminOptions<TApp, TContext, TRequestDeduplicator>
): void {
  const {
    app,
    sessions,
    createAuthenticationError,
    createTokenBackedInitializedGoogleHandlerContext,
    requestDeduplicator,
    log,
    addGraphQLEndpoint,
    addAdminRoutes,
  } = options;

  const getHandlerContextForGraphQL = async (authToken?: string): Promise<TContext> => {
    if (!authToken) {
      throw createAuthenticationError('Authentication required for GraphQL endpoint');
    }

    const googleRuntime = await createTokenBackedInitializedGoogleHandlerContext({
      accessToken: authToken,
      refreshToken: undefined,
      onProgress: async (event) => {
        log.debug('GraphQL operation progress', {
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

  void addGraphQLEndpoint(app, getHandlerContextForGraphQL)
    .then(() => {
      log.info('GraphQL endpoint initialized at /graphql');
    })
    .catch((error) => {
      log.error('Failed to initialize GraphQL endpoint', { error });
    });

  addAdminRoutes(app, {
    getAllSessions: () =>
      Array.from(sessions.entries()).map(([id]) => ({
        id,
        clientName: 'MCP Client',
        clientVersion: '1.0.0',
        createdAt: Date.now(),
      })),
    getSessionCount: () => sessions.size,
    getTotalRequests: () => {
      const stats = requestDeduplicator.getStats();
      return stats.totalRequests;
    },
  });
}
