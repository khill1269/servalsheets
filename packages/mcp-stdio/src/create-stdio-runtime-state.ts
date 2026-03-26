import type { InitializeStdioRuntimeState } from './initialize-stdio-runtime.js';

export interface CreateStdioRuntimeStateInput<TGoogleClient, TAuthHandler, TContext, THandlers> {
  readonly getGoogleClient: () => TGoogleClient | null;
  readonly setGoogleClient: (value: TGoogleClient | null) => void;
  readonly setAuthHandler: (value: TAuthHandler | null) => void;
  readonly setContext: (value: TContext | null) => void;
  readonly setHandlers: (value: THandlers | null) => void;
  readonly clearCachedHandlerMap: () => void;
}

export function createStdioRuntimeState<TGoogleClient, TAuthHandler, TContext, THandlers>(
  input: CreateStdioRuntimeStateInput<TGoogleClient, TAuthHandler, TContext, THandlers>
): InitializeStdioRuntimeState<TGoogleClient, TAuthHandler, TContext, THandlers> {
  return {
    getGoogleClient: input.getGoogleClient,
    setGoogleClient: input.setGoogleClient,
    setAuthHandler: input.setAuthHandler,
    setContext: input.setContext,
    setHandlers: input.setHandlers,
    invalidateCachedHandlerMap: input.clearCachedHandlerMap,
  };
}
