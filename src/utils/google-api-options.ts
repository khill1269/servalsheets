import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { GoogleApiClientOptions } from '../services/google-api.js';
import { getDefaultTokenStorePath, sanitizeTokenStorePath } from './auth-paths.js';

interface ResolveGoogleApiOptionsOverrides {
  serviceAccountKeyPath?: string;
  accessToken?: string;
}

/**
 * Resolve inline GOOGLE_SERVICE_ACCOUNT_KEY JSON to a temporary key file path.
 *
 * Fly.io secrets are env vars (no file mounts), so this bridges the gap:
 * the inline JSON is written to a temp file and GOOGLE_APPLICATION_CREDENTIALS
 * is pointed at it. The file is created with 0600 permissions.
 */
function resolveInlineServiceAccountKey(): string | undefined {
  const inlineKey = process.env['GOOGLE_SERVICE_ACCOUNT_KEY'];
  if (!inlineKey) return undefined;

  try {
    JSON.parse(inlineKey); // Validate JSON
    const keyDir = join(tmpdir(), 'servalsheets-sa');
    mkdirSync(keyDir, { recursive: true, mode: 0o700 });
    const keyPath = join(keyDir, 'service-account-key.json');
    writeFileSync(keyPath, inlineKey, { mode: 0o600 });
    return keyPath;
  } catch {
    return undefined; // OK: Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY — fall through to other auth methods
  }
}

export function resolveGoogleApiOptionsFromEnv(
  overrides: ResolveGoogleApiOptionsOverrides = {}
): GoogleApiClientOptions | undefined {
  // Service account: CLI override → GOOGLE_APPLICATION_CREDENTIALS → inline JSON
  const serviceAccountKeyPath =
    overrides.serviceAccountKeyPath ??
    process.env['GOOGLE_APPLICATION_CREDENTIALS'] ??
    resolveInlineServiceAccountKey();
  const accessToken = overrides.accessToken ?? process.env['GOOGLE_ACCESS_TOKEN'];
  const clientId = process.env['GOOGLE_CLIENT_ID'] ?? process.env['OAUTH_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? process.env['OAUTH_CLIENT_SECRET'];
  const redirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? process.env['OAUTH_REDIRECT_URI'];
  const tokenStoreKey = process.env['ENCRYPTION_KEY'];
  const rawTokenStorePath =
    process.env['GOOGLE_TOKEN_STORE_PATH'] ??
    (tokenStoreKey ? getDefaultTokenStorePath() : undefined);
  const tokenStorePath = rawTokenStorePath ? sanitizeTokenStorePath(rawTokenStorePath) : undefined;

  const sharedGoogleOptions = {
    tokenStorePath,
    tokenStoreKey,
  };

  if (serviceAccountKeyPath) {
    return {
      serviceAccountKeyPath,
      ...sharedGoogleOptions,
    };
  }

  if (accessToken) {
    return {
      accessToken,
      ...sharedGoogleOptions,
    };
  }

  if (clientId && clientSecret) {
    return {
      credentials: { clientId, clientSecret, redirectUri },
      ...sharedGoogleOptions,
    };
  }

  return undefined; // OK: no OAuth config available
}
