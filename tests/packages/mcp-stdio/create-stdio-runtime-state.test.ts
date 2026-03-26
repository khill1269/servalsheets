import { describe, expect, it, vi } from 'vitest';

import { createStdioRuntimeState } from '../../../packages/mcp-stdio/src/create-stdio-runtime-state.js';

describe('@serval/mcp-stdio createStdioRuntimeState', () => {
  it('maps the clear handler hook to invalidateCachedHandlerMap', () => {
    const clearCachedHandlerMap = vi.fn();
    const getGoogleClient = vi.fn(() => ({ id: 'google-client' }));
    const setGoogleClient = vi.fn();
    const setAuthHandler = vi.fn();
    const setContext = vi.fn();
    const setHandlers = vi.fn();

    const state = createStdioRuntimeState({
      getGoogleClient,
      setGoogleClient,
      setAuthHandler,
      setContext,
      setHandlers,
      clearCachedHandlerMap,
    });

    expect(state.getGoogleClient()).toEqual({ id: 'google-client' });
    state.setGoogleClient(null);
    state.setAuthHandler(null);
    state.setContext(null);
    state.setHandlers(null);
    state.invalidateCachedHandlerMap();

    expect(getGoogleClient).toHaveBeenCalledOnce();
    expect(setGoogleClient).toHaveBeenCalledWith(null);
    expect(setAuthHandler).toHaveBeenCalledWith(null);
    expect(setContext).toHaveBeenCalledWith(null);
    expect(setHandlers).toHaveBeenCalledWith(null);
    expect(clearCachedHandlerMap).toHaveBeenCalledOnce();
  });
});
