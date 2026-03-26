import { createHash, randomUUID } from 'crypto';
import express, { type Express, type Request, type Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

export interface HttpTransportLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface HttpTransportSessionsMetric {
  set(value: number): void;
}

export interface HttpTransportSessionLimiter {
  canCreateSession(userId: string): { allowed: boolean; reason?: string };
  registerSession(sessionId: string, userId: string): void;
  unregisterSession(sessionId: string): void;
}

export interface HttpTransportOAuthProvider {
  validateToken(): express.RequestHandler;
  getGoogleToken(req: Request): Promise<string | null | undefined>;
}

export interface HttpTransportRequestContextOptions {
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  principalId?: string;
  idempotencyKey?: string;
}

export interface HttpTransportEventStore {
  clear(): void | Promise<void>;
  replayEventsAfter(
    lastEventId: string,
    options: {
      send(eventId: string, message: unknown): Promise<void> | void;
    }
  ): Promise<unknown>;
}

export interface HttpTransportConnectableServer {
  connect(transport: SSEServerTransport | StreamableHTTPServerTransport): Promise<void> | void;
}

export interface HttpTransportDisposableTaskStore {
  dispose(): void;
}

export interface HttpTransportSession<
  TMcpServer extends HttpTransportConnectableServer,
  TTaskStore extends HttpTransportDisposableTaskStore,
  TEventStore extends HttpTransportEventStore,
  TSecurityContext,
> {
  transport: SSEServerTransport | StreamableHTTPServerTransport;
  mcpServer: TMcpServer;
  taskStore: TTaskStore;
  disposeRuntime?: () => void;
  eventStore?: TEventStore;
  securityContext: TSecurityContext;
  lastActivity: number;
}

export interface RegisterHttpTransportRoutesDependencies<
  TRequestContext,
  TEventStore extends HttpTransportEventStore,
  TSecurityContext,
  TResourceIndicatorValidator,
> {
  readonly sessionsTotal: HttpTransportSessionsMetric;
  readonly extractIdempotencyKeyFromHeaders: (
    headers: Request['headers']
  ) => string | undefined;
  readonly createResourceIndicatorValidator: (
    serverUrl: string
  ) => TResourceIndicatorValidator;
  readonly optionalResourceIndicatorMiddleware: (
    validator: TResourceIndicatorValidator
  ) => express.RequestHandler;
  readonly removeSessionContext: (sessionId: string) => void;
  readonly extractPrincipalIdFromHeaders: (headers: Request['headers']) => string | undefined;
  readonly createRequestContext: (
    options: HttpTransportRequestContextOptions
  ) => TRequestContext;
  readonly runWithRequestContext: <T>(
    context: TRequestContext,
    fn: () => Promise<T>
  ) => Promise<T>;
  readonly sessionLimiter: HttpTransportSessionLimiter;
  readonly log: HttpTransportLogger;
  readonly clearSessionEventStore: (eventStore?: TEventStore) => void;
  readonly createSessionEventStore: (params: {
    sessionId: string;
    eventStoreRedisUrl: string | undefined;
    eventStoreTtlMs: number;
    eventStoreMaxEvents: number;
  }) => TEventStore;
  readonly createSessionSecurityContext: (
    req: Request,
    token: string
  ) => TSecurityContext;
  readonly normalizeMcpSessionHeader: (req: Request) => string | undefined;
  readonly verifySessionSecurityContext: (
    stored: TSecurityContext,
    current: TSecurityContext
  ) => { valid: boolean; reason?: string };
}

export interface RegisterHttpTransportRoutesParams<
  TMcpServer extends HttpTransportConnectableServer,
  TTaskStore extends HttpTransportDisposableTaskStore,
  TEventStore extends HttpTransportEventStore,
  TSecurityContext,
  TRequestContext,
  TResourceIndicatorValidator,
> {
  readonly app: Express;
  readonly enableOAuth: boolean;
  readonly oauth: HttpTransportOAuthProvider | null;
  readonly legacySseEnabled: boolean;
  readonly host: string;
  readonly port: number;
  readonly eventStoreRedisUrl: string | undefined;
  readonly eventStoreTtlMs: number;
  readonly eventStoreMaxEvents: number;
  readonly sessionTimeoutMs: number;
  readonly sessions: Map<
    string,
    HttpTransportSession<TMcpServer, TTaskStore, TEventStore, TSecurityContext>
  >;
  readonly createMcpServerInstance: (
    googleToken?: string,
    googleRefreshToken?: string,
    sessionId?: string
  ) => Promise<{
    mcpServer: TMcpServer;
    taskStore: TTaskStore;
    disposeRuntime: () => void;
  }>;
  readonly dependencies: RegisterHttpTransportRoutesDependencies<
    TRequestContext,
    TEventStore,
    TSecurityContext,
    TResourceIndicatorValidator
  >;
}

export interface RegisterHttpTransportRoutesResult {
  readonly sessionCleanupInterval: NodeJS.Timeout;
  readonly cleanupSessions: () => void;
}

export function registerHttpTransportRoutes<
  TMcpServer extends HttpTransportConnectableServer,
  TTaskStore extends HttpTransportDisposableTaskStore,
  TEventStore extends HttpTransportEventStore,
  TSecurityContext,
  TRequestContext,
  TResourceIndicatorValidator,
>(
  params: RegisterHttpTransportRoutesParams<
    TMcpServer,
    TTaskStore,
    TEventStore,
    TSecurityContext,
    TRequestContext,
    TResourceIndicatorValidator
  >
): RegisterHttpTransportRoutesResult {
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
    sessions,
    createMcpServerInstance,
    dependencies,
  } = params;
  const {
    sessionsTotal,
    extractIdempotencyKeyFromHeaders,
    createResourceIndicatorValidator,
    optionalResourceIndicatorMiddleware,
    removeSessionContext,
    extractPrincipalIdFromHeaders,
    createRequestContext,
    runWithRequestContext,
    sessionLimiter,
    log,
    clearSessionEventStore,
    createSessionEventStore,
    createSessionSecurityContext,
    normalizeMcpSessionHeader,
    verifySessionSecurityContext,
  } = dependencies;

  const getHeaderValue = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const withHttpRequestContext = async <T>(req: Request, fn: () => Promise<T>): Promise<T> => {
    const requestContext = createRequestContext({
      requestId: getHeaderValue(req.headers['x-request-id']),
      traceId: getHeaderValue(req.headers['x-trace-id']),
      spanId: getHeaderValue(req.headers['x-span-id']),
      parentSpanId: getHeaderValue(req.headers['x-parent-span-id']),
      principalId: extractPrincipalIdFromHeaders(req.headers),
      idempotencyKey: extractIdempotencyKeyFromHeaders(req.headers),
    });

    return await runWithRequestContext(requestContext, fn);
  };

  const disposeSession = (
    sessionId: string,
    options?: {
      closeTransport?: boolean;
      reason?: string;
    }
  ): boolean => {
    const session = sessions.get(sessionId);
    if (!session) {
      return false;
    }

    sessions.delete(sessionId);
    sessionsTotal.set(sessions.size);
    sessionLimiter.unregisterSession(sessionId);
    removeSessionContext(sessionId);

    try {
      session.disposeRuntime?.();
    } catch (error) {
      log.error('Failed to dispose session runtime', { sessionId, error });
    }

    try {
      session.taskStore.dispose();
    } catch (error) {
      log.error('Failed to dispose session task store', { sessionId, error });
    }

    clearSessionEventStore(session.eventStore);

    if (options?.closeTransport !== false && typeof session.transport.close === 'function') {
      try {
        session.transport.close();
      } catch (error) {
        log.error('Failed to close session transport', { sessionId, error });
      }
    }

    if (options?.reason) {
      log.info(options.reason, { sessionId });
    }

    return true;
  };

  const sessionCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > sessionTimeoutMs) {
        disposeSession(id, {
          reason: 'Evicted idle session',
        });
      }
    }
  }, 60000);

  const cleanupSessions = (): void => {
    for (const sessionId of [...sessions.keys()]) {
      disposeSession(sessionId);
    }
  };

  function getRequestServerUrl(req: Request): string {
    if (process.env['SERVER_URL']) {
      return process.env['SERVER_URL'];
    }

    const protocol = req.protocol || 'http';
    const requestHost = req.get('host');
    if (requestHost) {
      return `${protocol}://${requestHost}`;
    }

    return `http://${host}:${port}`;
  }

  const validateResourceIndicator: express.RequestHandler = async (req, res, next) => {
    const validator = createResourceIndicatorValidator(getRequestServerUrl(req));
    const middleware = optionalResourceIndicatorMiddleware(validator);
    await middleware(req, res, next);
  };

  const sseMiddleware =
    enableOAuth && oauth
      ? [validateResourceIndicator as express.RequestHandler, oauth.validateToken()]
      : [validateResourceIndicator as express.RequestHandler];

  const legacySseHeaders = {
    Deprecation: 'true',
    Sunset: 'Wed, 29 Apr 2026 00:00:00 GMT',
    Link: '</mcp>; rel="alternate"',
  };

  if (!legacySseEnabled) {
    app.get('/sse', ...sseMiddleware, (_req: Request, res: Response) => {
      res.status(410).set(legacySseHeaders).json({
        error: {
          code: 'DEPRECATED',
          message: 'Legacy SSE transport is disabled. Use /mcp (Streamable HTTP).',
          retryable: false,
        },
      });
    });

    app.post(
      '/sse/message',
      validateResourceIndicator as express.RequestHandler,
      (_req: Request, res: Response) => {
        res.status(410).set(legacySseHeaders).json({
          error: {
            code: 'DEPRECATED',
            message: 'Legacy SSE transport is disabled. Use /mcp (Streamable HTTP).',
            retryable: false,
          },
        });
      }
    );
  } else {
    app.get('/sse', ...sseMiddleware, async (req: Request, res: Response) => {
      const googleToken =
        enableOAuth && oauth
          ? ((await oauth.getGoogleToken(req)) ?? undefined)
          : req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : undefined;

      const userId = googleToken
        ? `google:${createHash('sha256').update(googleToken).digest('hex').substring(0, 16)}`
        : 'anonymous';

      const lastEventId = req.headers['last-event-id'] as string | undefined;
      const requestedSessionId = (req.query['session'] as string | undefined) || lastEventId;

      if (requestedSessionId && sessions.has(requestedSessionId)) {
        const existingSession = sessions.get(requestedSessionId)!;
        const currentSecurityContext = createSessionSecurityContext(req, googleToken || '');
        const securityCheck = verifySessionSecurityContext(
          existingSession.securityContext,
          currentSecurityContext
        );

        if (!securityCheck.valid) {
          log.warn('Session reconnection rejected - security context mismatch', {
            sessionId: requestedSessionId,
            reason: securityCheck.reason,
            userId,
          });

          res.status(403).set(legacySseHeaders).json({
            error: {
              code: 'SESSION_SECURITY_VIOLATION',
              message: `Session reconnection rejected: ${securityCheck.reason}`,
              retryable: false,
            },
          });
          return;
        }

        log.info('SSE session reconnection', {
          sessionId: requestedSessionId,
          userId,
          lastEventId,
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Session-ID', requestedSessionId);
        res.setHeader('X-Reconnected', 'true');
        res.setHeader('Deprecation', legacySseHeaders.Deprecation);
        res.setHeader('Sunset', legacySseHeaders.Sunset);
        res.setHeader('Link', legacySseHeaders.Link);

        res.write(
          `event: reconnect\ndata: {"sessionId":"${requestedSessionId}","status":"reconnected"}\n\n`
        );

        if (lastEventId && existingSession.eventStore) {
          try {
            log.info('Replaying SSE events after reconnection', {
              sessionId: requestedSessionId,
              lastEventId,
            });

            await existingSession.eventStore.replayEventsAfter(lastEventId, {
              send: async (eventId: string, message: unknown) => {
                res.write(`id: ${eventId}\n`);
                res.write(`data: ${JSON.stringify(message)}\n\n`);
              },
            });

            log.info('SSE event replay completed', {
              sessionId: requestedSessionId,
            });
          } catch (error) {
            log.warn('SSE event replay failed', {
              sessionId: requestedSessionId,
              lastEventId,
              error,
            });
          }
        }

        return;
      }

      const limitCheck = sessionLimiter.canCreateSession(userId);
      if (!limitCheck.allowed) {
        res.status(429).set(legacySseHeaders).json({
          error: {
            code: 'TOO_MANY_SESSIONS',
            message: limitCheck.reason,
            retryable: true,
          },
        });
        return;
      }

      const sessionId = randomUUID();

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Session-ID', sessionId);
      res.setHeader('Deprecation', legacySseHeaders.Deprecation);
      res.setHeader('Sunset', legacySseHeaders.Sunset);
      res.setHeader('Link', legacySseHeaders.Link);

      try {
        const transport = new SSEServerTransport('/sse/message', res);

        sessionLimiter.registerSession(sessionId, userId);

        const securityContext = createSessionSecurityContext(req, googleToken || '');
        const eventStore = createSessionEventStore({
          sessionId,
          eventStoreRedisUrl,
          eventStoreTtlMs,
          eventStoreMaxEvents,
        });
        const { mcpServer, taskStore, disposeRuntime } = await createMcpServerInstance(
          googleToken,
          undefined,
          sessionId
        );

        await mcpServer.connect(transport);
        sessions.set(sessionId, {
          transport,
          mcpServer,
          taskStore,
          disposeRuntime,
          securityContext,
          eventStore,
          lastActivity: Date.now(),
        });
        sessionsTotal.set(sessions.size);

        req.on('close', () => {
          disposeSession(sessionId, {
            closeTransport: false,
          });
        });
      } catch (error) {
        res.status(500).set(legacySseHeaders).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to establish SSE connection',
            details:
              process.env['NODE_ENV'] === 'production'
                ? undefined
                : error instanceof Error
                  ? error.message
                  : String(error),
          },
        });
      }
    });

    app.post(
      '/sse/message',
      validateResourceIndicator as express.RequestHandler,
      async (req: Request, res: Response) => {
        const sessionId =
          (req.headers['x-session-id'] as string | undefined) ||
          (req.headers['mcp-session-id'] as string | undefined);

        if (!sessionId) {
          res.status(400).set(legacySseHeaders).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing X-Session-ID header',
            },
          });
          return;
        }

        const session = sessions.get(sessionId);
        if (session) {
          session.lastActivity = Date.now();
        }
        const transport = session?.transport;

        if (!transport) {
          res.status(404).set(legacySseHeaders).json({
            error: {
              code: 'SESSION_NOT_FOUND',
              message: 'Session not found',
            },
          });
          return;
        }

        try {
          if (transport instanceof SSEServerTransport) {
            await withHttpRequestContext(req, async () => {
              await transport.handlePostMessage(req, res);
            });
          } else {
            res.status(400).set(legacySseHeaders).json({
              error: {
                code: 'INVALID_REQUEST',
                message: 'Invalid transport type for SSE message',
              },
            });
          }
        } catch (error) {
          res.status(500).set(legacySseHeaders).json({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to process message',
              details:
                process.env['NODE_ENV'] === 'production'
                  ? undefined
                  : error instanceof Error
                    ? error.message
                    : String(error),
            },
          });
        }
      }
    );
  }

  const streamableMiddleware =
    enableOAuth && oauth
      ? [validateResourceIndicator as express.RequestHandler, oauth.validateToken()]
      : [validateResourceIndicator as express.RequestHandler];

  app.all('/mcp', ...streamableMiddleware, async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const googleToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const userId = googleToken
      ? `google:${createHash('sha256').update(googleToken).digest('hex').substring(0, 16)}`
      : 'anonymous';

    const sessionId = normalizeMcpSessionHeader(req);
    const isPost = req.method === 'POST';

    try {
      let session = sessionId ? sessions.get(sessionId) : undefined;
      if (session) {
        session.lastActivity = Date.now();
      }
      let transport = session?.transport;

      if (sessionId && session && !(transport instanceof StreamableHTTPServerTransport)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Session exists but uses a different transport protocol',
          },
        });
        return;
      }

      if (!transport) {
        if (sessionId && !isPost) {
          res.status(404).json({
            error: {
              code: 'SESSION_NOT_FOUND',
              message: 'Session not found',
            },
          });
          return;
        }
        if (!isPost) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing Mcp-Session-Id header',
            },
          });
          return;
        }

        const body = req.body as unknown;
        const isInitRequest = Array.isArray(body)
          ? body.some((msg) => isInitializeRequest(msg))
          : isInitializeRequest(body);

        if (sessionId && !isInitRequest) {
          res.status(404).json({
            error: {
              code: 'SESSION_NOT_FOUND',
              message: 'Session not found',
            },
          });
          return;
        }

        if (!isInitRequest) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Bad Request: No valid session ID provided',
            },
          });
          return;
        }

        if (sessionId) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message:
                'Mcp-Session-Id must not be provided on initialize; the server generates session IDs',
            },
          });
          return;
        }

        const newSessionId = randomUUID();
        const limitCheck = sessionLimiter.canCreateSession(userId);
        if (!limitCheck.allowed) {
          res.status(429).json({
            error: {
              code: 'TOO_MANY_SESSIONS',
              message: limitCheck.reason,
              retryable: true,
            },
          });
          return;
        }

        const eventStore = createSessionEventStore({
          sessionId: newSessionId,
          eventStoreRedisUrl,
          eventStoreTtlMs,
          eventStoreMaxEvents,
        });
        const newTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
          eventStore: eventStore as never,
        });
        transport = newTransport;

        sessionLimiter.registerSession(newSessionId, userId);

        const securityContext = createSessionSecurityContext(req, googleToken || '');
        const { mcpServer, taskStore, disposeRuntime } = await createMcpServerInstance(
          googleToken,
          undefined,
          newSessionId
        );
        sessions.set(newSessionId, {
          transport: newTransport,
          mcpServer,
          taskStore,
          disposeRuntime,
          eventStore,
          securityContext,
          lastActivity: Date.now(),
        });
        sessionsTotal.set(sessions.size);

        newTransport.onclose = () => {
          disposeSession(newSessionId, {
            closeTransport: false,
          });
        };

        await mcpServer.connect(newTransport);
      } else if (session && transport instanceof StreamableHTTPServerTransport) {
        const currentSecurityContext = createSessionSecurityContext(req, googleToken || '');
        const securityCheck = verifySessionSecurityContext(
          session.securityContext,
          currentSecurityContext
        );

        if (!securityCheck.valid) {
          log.warn('StreamableHTTP session rejected - security context mismatch', {
            sessionId,
            reason: securityCheck.reason,
            userId,
          });

          res.status(403).json({
            error: {
              code: 'SESSION_SECURITY_VIOLATION',
              message: `Session reconnection rejected: ${securityCheck.reason}`,
              retryable: false,
            },
          });
          return;
        }
      }

      if (transport instanceof StreamableHTTPServerTransport) {
        await withHttpRequestContext(req, async () => {
          await transport.handleRequest(req, res, isPost ? req.body : undefined);
        });
      }
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process MCP request',
          details:
            process.env['NODE_ENV'] === 'production'
              ? undefined
              : error instanceof Error
                ? error.message
                : String(error),
        },
      });
    }
  });

  app.delete('/mcp', (req: Request, res: Response) => {
    const sessionId = normalizeMcpSessionHeader(req);
    if (!sessionId) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Mcp-Session-Id header required for session termination',
        },
      });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session ${sessionId} not found`,
        },
      });
      return;
    }

    if (session.securityContext) {
      const callerToken = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : '';
      const currentContext = createSessionSecurityContext(req, callerToken);
      const securityCheck = verifySessionSecurityContext(session.securityContext, currentContext);

      if (!securityCheck.valid) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Session ownership verification failed',
          },
        });
        return;
      }
    }

    disposeSession(sessionId);
    res.status(200).json({ success: true, sessionId });
  });

  app.delete('/session/:sessionId', (req: Request, res: Response) => {
    const sessionId = req.params['sessionId'] as string;

    if (!sessionId) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Session ID required',
        },
      });
      return;
    }

    const session = sessions.get(sessionId);
    if (session) {
      if (session.securityContext) {
        const callerToken = req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.slice(7)
          : '';
        const currentContext = createSessionSecurityContext(req, callerToken);
        const securityCheck = verifySessionSecurityContext(session.securityContext, currentContext);

        if (!securityCheck.valid) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: 'Session ownership verification failed',
            },
          });
          return;
        }
      }

      disposeSession(sessionId);
      res.json({ success: true, message: 'Session terminated' });
    } else {
      res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      });
    }
  });

  return { sessionCleanupInterval, cleanupSessions };
}
