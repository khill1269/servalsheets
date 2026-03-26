import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { StdioQueuedToolExecutionResult, StdioToolCallExtra } from './execute-stdio-tool-call.js';

export interface ResolveStdioToolCallInput<
  TAuthHandler = unknown,
  THandlers = unknown,
  TContext = unknown,
  TGoogleClient = unknown,
  THandlerMap = unknown,
> {
  readonly toolName: string;
  readonly args: Record<string, unknown>;
  readonly extra?: StdioToolCallExtra;
  readonly authHandler: TAuthHandler | null;
  readonly handlers: THandlers | null;
  readonly context: TContext | null;
  readonly googleClient: TGoogleClient | null;
  readonly cachedHandlerMap: THandlerMap | null;
  readonly requestId: string;
  readonly costTrackingTenantId: string;
  readonly startTime: number;
}

export interface ResolveStdioToolCallDependencies<
  TAuthHandler = unknown,
  THandlers = unknown,
  TContext = unknown,
  TGoogleClient = unknown,
  THandlerMap = unknown,
> {
  readonly handleSheetsAuthToolCall: (
    authHandler: TAuthHandler | null,
    args: Record<string, unknown>
  ) => Promise<{
    authHandler: TAuthHandler | null;
    result: unknown;
  }>;
  readonly setAuthHandler: (authHandler: TAuthHandler | null) => void;
  readonly recordToolCall: (
    toolName: string,
    action: string,
    status: 'success' | 'error',
    durationSeconds: number
  ) => void;
  readonly buildToolResponse: (payload: Record<string, unknown>) => CallToolResult;
  readonly isToolCallAuthExempt: (toolName: string, action: string | undefined) => boolean;
  readonly checkAuthAsync: (
    googleClient: TGoogleClient | null
  ) => Promise<{ authenticated: boolean; error?: unknown }>;
  readonly buildAuthErrorResponse: (error: unknown) => Record<string, unknown>;
  readonly handlePreInitExemptToolCall: (
    toolName: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
  readonly dispatchServerToolCall: (input: {
    toolName: string;
    args: Record<string, unknown>;
    extra?: (Record<string, unknown> & { abortSignal?: AbortSignal }) | undefined;
    rawArgs: Record<string, unknown>;
    rawAction: string | undefined;
    handlers: THandlers;
    authHandler: TAuthHandler | null;
    cachedHandlerMap: THandlerMap | null;
    context: TContext | null;
    googleClient: TGoogleClient | null;
    requestId: string;
    costTrackingTenantId: string;
  }) => Promise<
    | { kind: 'error'; response: CallToolResult; handlerMap: THandlerMap | null }
    | { kind: 'result'; result: unknown; handlerMap: THandlerMap }
  >;
  readonly setCachedHandlerMap: (handlerMap: THandlerMap | null) => void;
}

export async function resolveStdioToolCall<
  TAuthHandler = unknown,
  THandlers = unknown,
  TContext = unknown,
  TGoogleClient = unknown,
  THandlerMap = unknown,
>(
  input: ResolveStdioToolCallInput<TAuthHandler, THandlers, TContext, TGoogleClient, THandlerMap>,
  dependencies: ResolveStdioToolCallDependencies<
    TAuthHandler,
    THandlers,
    TContext,
    TGoogleClient,
    THandlerMap
  >
): Promise<StdioQueuedToolExecutionResult> {
  if (input.toolName === 'sheets_auth') {
    const authResult = await dependencies.handleSheetsAuthToolCall(input.authHandler, input.args);
    dependencies.setAuthHandler(authResult.authHandler);
    const duration = (Date.now() - input.startTime) / 1000;
    dependencies.recordToolCall(input.toolName, 'auth', 'success', duration);
    return {
      kind: 'response',
      response: dependencies.buildToolResponse(authResult.result as Record<string, unknown>),
    };
  }

  const rawArgs = input.args as Record<string, unknown>;
  const rawAction = ((rawArgs['request'] as Record<string, unknown> | undefined)?.[
    'action'
  ] ?? rawArgs['action']) as string | undefined;
  const isExempt = dependencies.isToolCallAuthExempt(input.toolName, rawAction);

  if (!isExempt) {
    const authResult = await dependencies.checkAuthAsync(input.googleClient);
    if (!authResult.authenticated) {
      return {
        kind: 'response',
        response: dependencies.buildToolResponse(
          dependencies.buildAuthErrorResponse(authResult.error ?? {})
        ),
      };
    }
  }

  if (!input.handlers) {
    if (isExempt) {
      const preInitResult = await dependencies.handlePreInitExemptToolCall(input.toolName, input.args);
      if (preInitResult) {
        return {
          kind: 'response',
          response: dependencies.buildToolResponse(preInitResult as Record<string, unknown>),
        };
      }
    }

    return {
      kind: 'response',
      response: dependencies.buildToolResponse({
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Handlers not initialized. This is unexpected after auth check passed.',
            retryable: false,
            resolution: 'Call sheets_auth with action: "status" to verify auth state.',
          },
        },
      }),
    };
  }

  const dispatchResult = await dependencies.dispatchServerToolCall({
    toolName: input.toolName,
    args: input.args,
    extra: input.extra as (Record<string, unknown> & { abortSignal?: AbortSignal }) | undefined,
    rawArgs,
    rawAction,
    handlers: input.handlers,
    authHandler: input.authHandler,
    cachedHandlerMap: input.cachedHandlerMap,
    context: input.context,
    googleClient: input.googleClient,
    requestId: input.requestId,
    costTrackingTenantId: input.costTrackingTenantId,
  });
  dependencies.setCachedHandlerMap(dispatchResult.handlerMap);

  if (dispatchResult.kind === 'error') {
    return {
      kind: 'response',
      response: dispatchResult.response,
    };
  }

  return {
    kind: 'result',
    result: dispatchResult.result,
  };
}
