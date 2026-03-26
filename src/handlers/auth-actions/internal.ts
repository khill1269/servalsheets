/**
 * Internal utilities, types, and OAuth client management for auth handler
 */

import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { randomBytes } from 'crypto';
import { logger } from '../../utils/logger.js';
import { getRecommendedScopes } from '../../config/oauth-scopes.js';
import { getSessionContext } from '../../services/session-context.js';

/** Module-level CSRF state store with 10-minute TTL */
export const pendingStates = new Map<string, number>();

/** Temporary session state storage keyed by OAuth state token */
export const pendingSessionStates = new Map<string, { exportedState: string; expiresAt: number }>();

export function generateOAuthState(): string {
  const state = randomBytes(32).toString('hex');
  pendingStates.set(state, Date.now() + 10 * 60 * 1000);
  // Prune expired entries
  const now = Date.now();
  for (const [key, expiry] of pendingStates) {
    if (expiry < now) pendingStates.delete(key);
  }
  return state;
}

export function verifyOAuthState(state: string | undefined): boolean {
  if (!state) return false;
  const expiry = pendingStates.get(state);
  if (!expiry) return false;
  pendingStates.delete(state);
  return Date.now() < expiry;
}

/** Clean up expired session state entries */
export function cleanupExpiredSessionStates(): void {
  const now = Date.now();
  for (const [key, value] of pendingSessionStates) {
    if (value.expiresAt < now) {
      pendingSessionStates.delete(key);
    }
  }
}

export function createOAuthClient(
  oauthClientId?: string,
  oauthClientSecret?: string,
  redirectUri?: string
): OAuth2Client | null {
  if (!oauthClientId || !oauthClientSecret) {
    return null;
  }
  return new google.auth.OAuth2(oauthClientId, oauthClientSecret, redirectUri);
}

export function createFreshAuthUrl(
  oauthClient: OAuth2Client,
  scopes?: string[]
): string {
  const requestedScopes =
    scopes && scopes.length > 0
      ? Array.from(new Set(scopes))
      : Array.from(getRecommendedScopes());
  const state = generateOAuthState();

  try {
    cleanupExpiredSessionStates();
    const exportedState = getSessionContext().exportState();
    pendingSessionStates.set(state, {
      exportedState,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
  } catch (err) {
    logger.warn('Failed to export session state before OAuth redirect', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: requestedScopes,
    prompt: 'consent',
    include_granted_scopes: true,
    state,
  });
}

export type AuthHandlerAccess = {
  googleClient?: unknown | null;
  oauthClientId?: string;
  oauthClientSecret?: string;
  redirectUri?: string;
  tokenStorePath?: string;
  tokenStoreKey?: string;
  elicitationServer?: unknown;
  pendingOAuthElicitationId?: string;
  tokenManager?: unknown;
  pendingReauthState?: {
    authUrl: string;
    failureCount: number;
    lastError: string;
  };
};
