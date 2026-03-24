import {
  createHandlers,
  type HandlerContext,
  type Handlers,
} from '../handlers/index.js';
import type { GoogleApiClient } from '../services/google-api.js';
import { createTokenBackedGoogleClient } from '../startup/google-client-bootstrap.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import { initializeGoogleAdvancedFeatures } from './google-feature-bootstrap.js';
import { createGoogleHandlerContext } from './google-handler-context.js';

export interface CreateInitializedGoogleHandlerContextOptions<TExtraContext extends object = object> {
  readonly googleClient: GoogleApiClient;
  readonly onProgress?: Parameters<typeof createGoogleHandlerContext<TExtraContext>>[0]['onProgress'];
  readonly requestDeduplicator?: RequestDeduplicator;
  readonly extraContext?: TExtraContext;
}

export interface GoogleHandlerBundle<TContext extends HandlerContext = HandlerContext> {
  readonly context: TContext;
  readonly handlers: Handlers;
}

export interface CreateTokenBackedGoogleHandlerContextOptions<TExtraContext extends object = object>
  extends Omit<CreateInitializedGoogleHandlerContextOptions<TExtraContext>, 'googleClient'> {
  readonly accessToken: string;
  readonly refreshToken?: string;
}

export interface TokenBackedGoogleHandlerContext<TContext extends HandlerContext = HandlerContext> {
  readonly googleClient: GoogleApiClient;
  readonly context: TContext;
}

export interface TokenBackedGoogleHandlerBundle<TContext extends HandlerContext = HandlerContext>
  extends TokenBackedGoogleHandlerContext<TContext> {
  readonly handlers: Handlers;
}

export async function createInitializedGoogleHandlerContext<TExtraContext extends object = object>(
  options: CreateInitializedGoogleHandlerContextOptions<TExtraContext>
): Promise<HandlerContext & TExtraContext> {
  initializeGoogleAdvancedFeatures(options.googleClient);

  return createGoogleHandlerContext({
    googleClient: options.googleClient,
    onProgress: options.onProgress,
    requestDeduplicator: options.requestDeduplicator,
    extraContext: options.extraContext,
  });
}

export async function createInitializedGoogleHandlerBundle<TExtraContext extends object = object>(
  options: CreateInitializedGoogleHandlerContextOptions<TExtraContext>
): Promise<GoogleHandlerBundle<HandlerContext & TExtraContext>> {
  const context = await createInitializedGoogleHandlerContext(options);
  const handlers = createHandlers({
    context,
    sheetsApi: options.googleClient.sheets,
    driveApi: options.googleClient.drive,
    bigqueryApi: options.googleClient.bigquery ?? undefined,
  });

  return {
    context,
    handlers,
  };
}

export async function createTokenBackedInitializedGoogleHandlerContext<
  TExtraContext extends object = object,
>(
  options: CreateTokenBackedGoogleHandlerContextOptions<TExtraContext>
): Promise<TokenBackedGoogleHandlerContext<HandlerContext & TExtraContext>> {
  const googleClient = await createTokenBackedGoogleClient({
    accessToken: options.accessToken,
    refreshToken: options.refreshToken,
  });
  const context = await createInitializedGoogleHandlerContext({
    googleClient,
    onProgress: options.onProgress,
    requestDeduplicator: options.requestDeduplicator,
    extraContext: options.extraContext,
  });

  return {
    googleClient,
    context,
  };
}

export async function createTokenBackedInitializedGoogleHandlerBundle<
  TExtraContext extends object = object,
>(
  options: CreateTokenBackedGoogleHandlerContextOptions<TExtraContext>
): Promise<TokenBackedGoogleHandlerBundle<HandlerContext & TExtraContext>> {
  const { googleClient, context } = await createTokenBackedInitializedGoogleHandlerContext(options);
  const handlers = createHandlers({
    context,
    sheetsApi: googleClient.sheets,
    driveApi: googleClient.drive,
    bigqueryApi: googleClient.bigquery ?? undefined,
  });

  return {
    googleClient,
    context,
    handlers,
  };
}
