import {
  createGoogleApiClient,
  type GoogleApiClient,
  type GoogleApiClientOptions,
} from '../services/google-api.js';
import { isGoogleAuthError } from '../utils/auth-guard.js';
import { logger } from '../utils/logger.js';
import {
  getProcessBreadcrumbs,
  shouldAllowDegradedStartup,
} from '../server/runtime-diagnostics.js';

export interface TokenBackedGoogleClientOptions {
  readonly accessToken: string;
  readonly refreshToken?: string;
}

export interface OptionalGoogleClientOptions {
  readonly googleApiOptions?: GoogleApiClientOptions;
  readonly transport?: string;
  readonly nodeEnv?: string;
  readonly allowDegradedExplicitly?: boolean;
}

export async function createTokenBackedGoogleClient(
  options: TokenBackedGoogleClientOptions
): Promise<GoogleApiClient> {
  return createGoogleApiClient({
    accessToken: options.accessToken,
    refreshToken: options.refreshToken,
  });
}

export async function createOptionalGoogleClient(
  options: OptionalGoogleClientOptions
): Promise<GoogleApiClient | null> {
  if (!options.googleApiOptions) {
    return null;
  }

  try {
    return await createGoogleApiClient(options.googleApiOptions);
  } catch (error) {
    if (
      !shouldAllowDegradedStartup(error, {
        transport: options.transport,
        nodeEnv: options.nodeEnv,
        allowDegradedExplicitly: options.allowDegradedExplicitly ?? false,
        isAuthError: isGoogleAuthError,
      })
    ) {
      throw error;
    }

    logger.warn('Google client initialization failed; continuing in auth-only mode', {
      error: error instanceof Error ? error.message : String(error),
      transport: options.transport ?? 'unknown',
      breadcrumbs: getProcessBreadcrumbs(),
    });

    return null;
  }
}
