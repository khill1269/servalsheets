import { beforeEach, describe, expect, it, vi } from 'vitest';

const googleHandlerBundleMocks = vi.hoisted(() => ({
  createGoogleHandlerContext: vi.fn(),
  createHandlers: vi.fn(),
  initializeGoogleAdvancedFeatures: vi.fn(),
  createTokenBackedGoogleClient: vi.fn(),
}));

vi.mock('../../src/server/google-handler-context.js', () => ({
  createGoogleHandlerContext: googleHandlerBundleMocks.createGoogleHandlerContext,
}));

vi.mock('../../src/handlers/index.js', () => ({
  createHandlers: googleHandlerBundleMocks.createHandlers,
}));

vi.mock('../../src/server/google-feature-bootstrap.js', () => ({
  initializeGoogleAdvancedFeatures: googleHandlerBundleMocks.initializeGoogleAdvancedFeatures,
}));

vi.mock('../../src/startup/google-client-bootstrap.js', () => ({
  createTokenBackedGoogleClient: googleHandlerBundleMocks.createTokenBackedGoogleClient,
}));

import {
  createInitializedGoogleHandlerBundle,
  createInitializedGoogleHandlerContext,
  createTokenBackedInitializedGoogleHandlerBundle,
  createTokenBackedInitializedGoogleHandlerContext,
} from '../../src/server/google-handler-bundle.js';

describe('google handler bundle helper', () => {
  beforeEach(() => {
    googleHandlerBundleMocks.createGoogleHandlerContext.mockReset();
    googleHandlerBundleMocks.createHandlers.mockReset();
    googleHandlerBundleMocks.initializeGoogleAdvancedFeatures.mockReset();
    googleHandlerBundleMocks.createTokenBackedGoogleClient.mockReset();
  });

  it('initializes advanced features before building a handler context', async () => {
    const context = { kind: 'context' };
    const googleClient = { sheets: {}, drive: {} };
    const requestDeduplicator = { kind: 'dedup' };
    const extraContext = { taskStore: { kind: 'task-store' } };
    googleHandlerBundleMocks.createGoogleHandlerContext.mockResolvedValueOnce(context);

    const result = await createInitializedGoogleHandlerContext({
      googleClient: googleClient as never,
      requestDeduplicator: requestDeduplicator as never,
      extraContext,
    });

    expect(googleHandlerBundleMocks.initializeGoogleAdvancedFeatures).toHaveBeenCalledWith(
      googleClient
    );
    expect(googleHandlerBundleMocks.createGoogleHandlerContext).toHaveBeenCalledWith({
      googleClient,
      onProgress: undefined,
      requestDeduplicator,
      extraContext,
    });
    expect(result).toBe(context);
  });

  it('builds handlers on top of the initialized Google handler context', async () => {
    const context = { kind: 'context' };
    const handlers = { data: { kind: 'data' } };
    const googleClient = {
      sheets: { kind: 'sheets' },
      drive: { kind: 'drive' },
      bigquery: { kind: 'bigquery' },
    };
    googleHandlerBundleMocks.createGoogleHandlerContext.mockResolvedValueOnce(context);
    googleHandlerBundleMocks.createHandlers.mockReturnValueOnce(handlers);

    const result = await createInitializedGoogleHandlerBundle({
      googleClient: googleClient as never,
      onProgress: vi.fn(),
    });

    expect(googleHandlerBundleMocks.createHandlers).toHaveBeenCalledWith({
      context,
      sheetsApi: googleClient.sheets,
      driveApi: googleClient.drive,
      bigqueryApi: googleClient.bigquery,
    });
    expect(result).toEqual({ context, handlers });
  });

  it('creates a token-backed Google client before building a handler context', async () => {
    const googleClient = { sheets: {}, drive: {} };
    const context = { kind: 'context' };
    googleHandlerBundleMocks.createTokenBackedGoogleClient.mockResolvedValueOnce(googleClient);
    googleHandlerBundleMocks.createGoogleHandlerContext.mockResolvedValueOnce(context);

    const result = await createTokenBackedInitializedGoogleHandlerContext({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      requestDeduplicator: { kind: 'dedup' } as never,
    });

    expect(googleHandlerBundleMocks.createTokenBackedGoogleClient).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(googleHandlerBundleMocks.initializeGoogleAdvancedFeatures).toHaveBeenCalledWith(
      googleClient
    );
    expect(result).toEqual({ googleClient, context });
  });

  it('builds handlers on top of the token-backed Google client bundle', async () => {
    const googleClient = { sheets: { kind: 'sheets' }, drive: { kind: 'drive' } };
    const context = { kind: 'context' };
    const handlers = { data: { kind: 'data' } };
    googleHandlerBundleMocks.createTokenBackedGoogleClient.mockResolvedValueOnce(googleClient);
    googleHandlerBundleMocks.createGoogleHandlerContext.mockResolvedValueOnce(context);
    googleHandlerBundleMocks.createHandlers.mockReturnValueOnce(handlers);

    const result = await createTokenBackedInitializedGoogleHandlerBundle({
      accessToken: 'access-token',
      refreshToken: undefined,
    });

    expect(googleHandlerBundleMocks.createHandlers).toHaveBeenCalledWith({
      context,
      sheetsApi: googleClient.sheets,
      driveApi: googleClient.drive,
      bigqueryApi: undefined,
    });
    expect(result).toEqual({ googleClient, context, handlers });
  });
});
