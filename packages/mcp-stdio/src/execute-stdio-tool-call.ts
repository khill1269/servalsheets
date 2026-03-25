import type { CallToolResult, ServerNotification } from '@modelcontextprotocol/sdk/types.js';

export interface StdioToolCallExtra {
  sendNotification?: (notification: ServerNotification) => Promise<void>;
  sendRequest?: unknown;
  taskId?: string;
  taskStore?: unknown;
  progressToken?: string | number;
  elicit?: unknown;
  sample?: unknown;
  abortSignal?: AbortSignal;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface StdioToolCallLogger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface StdioMetadataCacheLike {
  clear(): void;
}

export interface StdioToolCallRequestContext {
  logger: StdioToolCallLogger;
  abortSignal?: AbortSignal;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  principalId?: string;
  sessionContext?: unknown;
}

export interface StdioToolCallQueueLike {
  readonly size: number;
  readonly pending: number;
  add<T>(operation: () => Promise<T>): Promise<T>;
}

export interface StdioToolCallConnectionHealthLike {
  recordHeartbeat(toolName: string): void;
}

export type StdioQueuedToolExecutionResult<TResult = unknown> =
  | { kind: 'response'; response: CallToolResult }
  | { kind: 'result'; result: TResult };

export interface ExecuteStdioToolCallInput<
  TRequestContext extends StdioToolCallRequestContext = StdioToolCallRequestContext,
> {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly extra?: StdioToolCallExtra;
  readonly isShutdown: boolean;
  readonly sessionContext?: unknown;
  readonly requestQueue: StdioToolCallQueueLike;
  readonly connectionHealthCheck: StdioToolCallConnectionHealthLike;
}

export interface ExecuteStdioToolCallDependencies<
  TRequestContext extends StdioToolCallRequestContext = StdioToolCallRequestContext,
> {
  readonly ensureResourcesRegistered: () => Promise<void>;
  readonly updateQueueMetrics: (size: number, pending: number) => void;
  readonly createAbortError: (reason?: unknown) => Error;
  readonly extractIdempotencyKeyFromHeaders: (
    headers: Record<string, string | string[] | undefined>
  ) => string | undefined;
  readonly resolveCostTrackingTenantId: (input: {
    headers?: Record<string, string | string[] | undefined>;
  }) => string;
  readonly extractPrincipalIdFromHeaders: (
    headers: Record<string, string | string[] | undefined>
  ) => string | undefined;
  readonly createMetadataCache: () => StdioMetadataCacheLike | undefined;
  readonly createRequestContext: (options: {
    sendNotification?: (notification: ServerNotification) => Promise<void>;
    progressToken?: string | number;
    abortSignal?: AbortSignal;
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
    idempotencyKey?: string;
    principalId?: string;
    metadataCache?: StdioMetadataCacheLike;
    sessionContext?: unknown;
    sendRequest?: unknown;
    taskId?: string;
    taskStore?: unknown;
  }) => TRequestContext;
  readonly runWithRequestContext: <TResult>(
    requestContext: TRequestContext,
    operation: () => Promise<TResult>
  ) => Promise<TResult>;
  readonly buildToolResponse: (payload: Record<string, unknown>) => CallToolResult;
  readonly recordSpreadsheetId: (args: Record<string, unknown>) => void;
  readonly extractActionFromArgs: (args: Record<string, unknown>) => string;
  readonly recordToolExecutionResult: (input: {
    toolName: string;
    action: string;
    durationSeconds: number;
    result: unknown;
    principalId: string;
    warn: (message: string, meta?: unknown) => void;
  }) => void;
  readonly recordToolExecutionException: (input: {
    toolName: string;
    action: string;
    durationSeconds: number;
    principalId: string;
  }) => void;
  readonly isGoogleAuthError: (error: unknown) => boolean;
  readonly convertGoogleAuthError: (error: unknown) => Record<string, unknown>;
  readonly executeWithinRequest: (input: {
    toolName: string;
    args: Record<string, unknown>;
    extra?: StdioToolCallExtra;
    requestContext: TRequestContext;
    costTrackingTenantId: string;
    startTime: number;
  }) => Promise<StdioQueuedToolExecutionResult>;
}

export async function executeStdioToolCall<
  TRequestContext extends StdioToolCallRequestContext = StdioToolCallRequestContext,
>(
  input: ExecuteStdioToolCallInput<TRequestContext>,
  dependencies: ExecuteStdioToolCallDependencies<TRequestContext>
): Promise<CallToolResult> {
  await dependencies.ensureResourcesRegistered();

  const startTime = Date.now();
  dependencies.updateQueueMetrics(input.requestQueue.size, input.requestQueue.pending);

  return input.requestQueue.add(async () => {
    if (input.extra?.abortSignal?.aborted) {
      throw dependencies.createAbortError(input.extra.abortSignal.reason);
    }

    const headers = input.extra?.headers;
    const idempotencyKey = headers
      ? dependencies.extractIdempotencyKeyFromHeaders(headers)
      : undefined;
    const costTrackingTenantId = dependencies.resolveCostTrackingTenantId({ headers });
    const principalId = headers ? dependencies.extractPrincipalIdFromHeaders(headers) : undefined;
    const metadataCache = dependencies.createMetadataCache();

    const requestContext = dependencies.createRequestContext({
      sendNotification: input.extra?.sendNotification,
      progressToken: input.extra?.progressToken,
      abortSignal: input.extra?.abortSignal,
      traceId: input.extra?.traceId,
      spanId: input.extra?.spanId,
      parentSpanId: input.extra?.parentSpanId,
      idempotencyKey,
      principalId: principalId ?? 'anonymous',
      metadataCache,
      sessionContext: input.sessionContext,
      sendRequest: input.extra?.sendRequest,
      taskId: input.extra?.taskId,
      taskStore: input.extra?.taskStore,
    });

    return dependencies
      .runWithRequestContext(requestContext, async () => {
        dependencies.recordSpreadsheetId(input.args);
        input.connectionHealthCheck.recordHeartbeat(input.toolName);

        requestContext.logger.debug('Tool call queued', {
          toolName: input.toolName,
          queueSize: input.requestQueue.size,
          pendingCount: input.requestQueue.pending,
          traceId: requestContext.traceId,
          spanId: requestContext.spanId,
        });

        if (requestContext.abortSignal?.aborted) {
          throw dependencies.createAbortError(requestContext.abortSignal.reason);
        }

        if (input.isShutdown) {
          return dependencies.buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Server is shutting down',
                retryable: false,
              },
            },
          });
        }

        try {
          const executionResult = await dependencies.executeWithinRequest({
            toolName: input.toolName,
            args: input.args,
            extra: input.extra,
            requestContext,
            costTrackingTenantId,
            startTime,
          });

          if (executionResult.kind === 'response') {
            return executionResult.response;
          }

          const duration = (Date.now() - startTime) / 1000;
          const action = dependencies.extractActionFromArgs(input.args);
          dependencies.recordToolExecutionResult({
            toolName: input.toolName,
            action,
            durationSeconds: duration,
            result: executionResult.result,
            principalId: requestContext.principalId ?? 'anonymous',
            warn: (message, meta) => requestContext.logger.warn(message, meta),
          });

          return dependencies.buildToolResponse(executionResult.result as Record<string, unknown>);
        } catch (error) {
          const duration = (Date.now() - startTime) / 1000;
          const action = dependencies.extractActionFromArgs(input.args);

          requestContext.logger.error('Tool call threw exception', {
            tool: input.toolName,
            error,
          });

          if (error instanceof Error && error.name === 'AbortError') {
            return dependencies.buildToolResponse({
              response: {
                success: false,
                error: {
                  code: 'OPERATION_CANCELLED',
                  message: error.message,
                  retryable: false,
                },
              },
            });
          }

          dependencies.recordToolExecutionException({
            toolName: input.toolName,
            action,
            durationSeconds: duration,
            principalId: requestContext.principalId ?? 'anonymous',
          });

          if (dependencies.isGoogleAuthError(error)) {
            requestContext.logger.info('Detected Google auth error, converting to auth flow guidance', {
              tool: input.toolName,
            });
            return dependencies.buildToolResponse(dependencies.convertGoogleAuthError(error));
          }

          return dependencies.buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : String(error),
                retryable: false,
              },
            },
          });
        }
      })
      .finally(() => {
        metadataCache?.clear();
      });
  });
}
