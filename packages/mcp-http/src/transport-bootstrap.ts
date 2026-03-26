export interface HttpLoggingBridgeLike<TSubscriber> {
  readonly subscribers: Map<string, TSubscriber>;
  installLoggingBridge(): void;
}

export interface RegisterHttpTransportRoutesResult {
  readonly sessionCleanupInterval: NodeJS.Timeout;
  readonly cleanupSessions: () => void;
}

export interface CreateHttpMcpServerInstanceOptions<TSubscriber> {
  readonly googleToken?: string;
  readonly googleRefreshToken?: string;
  readonly sessionId?: string;
  readonly subscribers: Map<string, TSubscriber>;
  readonly installLoggingBridge: () => void;
}

export interface RegisterHttpTransportRoutesParams<
  TApp,
  TOAuth,
  TSession,
  TMcpServerInstance,
> {
  readonly app: TApp;
  readonly enableOAuth: boolean;
  readonly oauth: TOAuth | null;
  readonly legacySseEnabled: boolean;
  readonly host: string;
  readonly port: number;
  readonly eventStoreRedisUrl: string | undefined;
  readonly eventStoreTtlMs: number;
  readonly eventStoreMaxEvents: number;
  readonly sessionTimeoutMs: number;
  readonly sessions: Map<string, TSession>;
  readonly createMcpServerInstance: (
    googleToken?: string,
    googleRefreshToken?: string,
    sessionId?: string
  ) => Promise<TMcpServerInstance>;
}

export interface BootstrapHttpTransportSessionsOptions<
  TApp,
  TOAuth,
  TSubscriber,
  TSession,
  TMcpServerInstance,
> {
  readonly app: TApp;
  readonly enableOAuth: boolean;
  readonly oauth: TOAuth | null;
  readonly legacySseEnabled: boolean;
  readonly host: string;
  readonly port: number;
  readonly eventStoreRedisUrl: string | undefined;
  readonly eventStoreTtlMs: number;
  readonly eventStoreMaxEvents: number;
  readonly sessionTimeoutMs: number;
  readonly loggingBridge: HttpLoggingBridgeLike<TSubscriber>;
  readonly createHttpMcpServerInstance: (
    options: CreateHttpMcpServerInstanceOptions<TSubscriber>
  ) => Promise<TMcpServerInstance>;
  readonly registerHttpTransportRoutes: (
    params: RegisterHttpTransportRoutesParams<TApp, TOAuth, TSession, TMcpServerInstance>
  ) => RegisterHttpTransportRoutesResult;
}

export interface HttpTransportBootstrapResult<TSession> {
  readonly sessions: Map<string, TSession>;
  readonly sessionCleanupInterval: NodeJS.Timeout;
  readonly cleanupSessions: () => void;
}

export function bootstrapHttpTransportSessions<
  TApp,
  TOAuth,
  TSubscriber,
  TSession,
  TMcpServerInstance,
>(
  options: BootstrapHttpTransportSessionsOptions<
    TApp,
    TOAuth,
    TSubscriber,
    TSession,
    TMcpServerInstance
  >
): HttpTransportBootstrapResult<TSession> {
  const {
    app,
    enableOAuth,
    oauth,
    legacySseEnabled,
    host,
    port,
    eventStoreRedisUrl,
    eventStoreTtlMs,
    eventStoreMaxEvents,
    sessionTimeoutMs,
    loggingBridge,
    createHttpMcpServerInstance,
    registerHttpTransportRoutes,
  } = options;

  const sessions = new Map<string, TSession>();
  const createMcpServerInstance = async (
    googleToken?: string,
    googleRefreshToken?: string,
    sessionId?: string
  ) =>
    createHttpMcpServerInstance({
      googleToken,
      googleRefreshToken,
      sessionId,
      subscribers: loggingBridge.subscribers,
      installLoggingBridge: loggingBridge.installLoggingBridge,
    });

  const { sessionCleanupInterval, cleanupSessions } = registerHttpTransportRoutes({
    app,
    enableOAuth,
    oauth,
    legacySseEnabled,
    host,
    port,
    eventStoreRedisUrl,
    eventStoreTtlMs,
    eventStoreMaxEvents,
    sessionTimeoutMs,
    sessions,
    createMcpServerInstance,
  });

  return {
    sessions,
    sessionCleanupInterval,
    cleanupSessions,
  };
}
