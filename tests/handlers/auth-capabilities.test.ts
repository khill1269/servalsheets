/**
 * Tests that sheets_auth.status exposes a first-class capabilities block
 * so LLM clients can branch on elicitation/sampling/completions/resources
 * support without drilling into readiness.*.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthHandler } from '../../src/handlers/auth.js';
import { SheetsAuthOutputSchema } from '../../src/schemas/auth.js';
import type { GoogleApiClient } from '../../src/services/google-api.js';

// Silence real callback server / token store during tests
vi.mock('../../src/services/token-store.js', () => {
  class MockEncryptedFileTokenStore {
    save = vi.fn().mockResolvedValue(undefined);
    load = vi.fn().mockResolvedValue(null);
    clear = vi.fn().mockResolvedValue(undefined);
  }
  return { EncryptedFileTokenStore: MockEncryptedFileTokenStore };
});

function createMockGoogleClient(
  authType: 'oauth' | 'service_account' = 'service_account',
  hasTokens = true
): GoogleApiClient {
  return {
    authType,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    getTokenStatus: vi.fn().mockReturnValue({
      hasAccessToken: hasTokens,
      hasRefreshToken: hasTokens,
    }),
    validateToken: vi.fn().mockResolvedValue({ valid: hasTokens }),
    setCredentials: vi.fn(),
    setScopes: vi.fn(),
    clearStoredTokens: vi.fn(),
    revokeAccess: vi.fn(),
  } as unknown as GoogleApiClient;
}

describe('sheets_auth.status capabilities block', () => {
  beforeEach(() => {
    delete process.env['OAUTH_CLIENT_ID'];
    delete process.env['OAUTH_CLIENT_SECRET'];
  });

  it('includes capabilities with elicitation/sampling/completions/resources booleans (service account)', async () => {
    const handler = new AuthHandler({ googleClient: createMockGoogleClient('service_account') });
    const result = await handler.handle({ action: 'status' } as any);

    expect(result.response.success).toBe(true);
    const response = result.response as Record<string, unknown>;
    expect(response).toHaveProperty('capabilities');

    const caps = response.capabilities as Record<string, unknown>;
    expect(typeof caps.elicitation).toBe('boolean');
    expect(typeof caps.sampling).toBe('boolean');
    expect(typeof caps.completions).toBe('boolean');
    expect(typeof caps.resources).toBe('boolean');

    // Server statically declares completions + resources — always true.
    expect(caps.completions).toBe(true);
    expect(caps.resources).toBe(true);

    // Full schema round-trips — the new field is accepted by the output schema.
    expect(SheetsAuthOutputSchema.safeParse(result).success).toBe(true);
  });

  it('includes capabilities when unauthenticated (no google client)', async () => {
    const handler = new AuthHandler({ googleClient: null });
    const result = await handler.handle({ action: 'status' } as any);

    expect(result.response.success).toBe(true);
    const caps = (result.response as Record<string, unknown>).capabilities as
      | Record<string, unknown>
      | undefined;
    expect(caps).toBeDefined();
    expect(typeof caps!.elicitation).toBe('boolean');
    expect(typeof caps!.sampling).toBe('boolean');
  });

  it('capabilities.elicitation mirrors readiness.elicitation.supported', async () => {
    const handler = new AuthHandler({ googleClient: createMockGoogleClient('service_account') });
    const result = await handler.handle({ action: 'status' } as any);

    const response = result.response as Record<string, any>;
    expect(response.capabilities.elicitation).toBe(response.readiness.elicitation.supported);
    expect(response.capabilities.sampling).toBe(response.readiness.sampling.available);
  });

  it('status returns authenticated=true when google client has tokens', async () => {
    const handler = new AuthHandler({ googleClient: createMockGoogleClient('service_account', true) });
    const result = await handler.handle({ action: 'status' } as any);

    expect(result.response.success).toBe(true);
    const response = result.response as Record<string, unknown>;
    expect(response.authenticated).toBe(true);
  });

  it('status returns authenticated=false when oauth client has no valid tokens', async () => {
    // service_account auth always reports authenticated=true; use oauth to test
    // the token-validation path where hasTokens=false → authenticated=false.
    const handler = new AuthHandler({
      googleClient: createMockGoogleClient('oauth', false),
    });
    const result = await handler.handle({ action: 'status' } as any);

    expect(result.response.success).toBe(true);
    const response = result.response as Record<string, unknown>;
    expect(response.authenticated).toBe(false);
  });

  it('status returns authType=service_account for service account client', async () => {
    const handler = new AuthHandler({
      googleClient: createMockGoogleClient('service_account', true),
    });
    const result = await handler.handle({ action: 'status' } as any);

    expect(result.response.success).toBe(true);
    const response = result.response as Record<string, unknown>;
    expect(response.authType).toBe('service_account');
  });

  it('status returns authType=oauth for oauth client', async () => {
    const handler = new AuthHandler({
      googleClient: createMockGoogleClient('oauth', true),
    });
    const result = await handler.handle({ action: 'status' } as any);

    expect(result.response.success).toBe(true);
    const response = result.response as Record<string, unknown>;
    expect(response.authType).toBe('oauth');
  });

  it('status includes readiness block with elicitation and sampling fields', async () => {
    const handler = new AuthHandler({ googleClient: createMockGoogleClient('service_account') });
    const result = await handler.handle({ action: 'status' } as any);

    const response = result.response as Record<string, any>;
    expect(response.readiness).toBeDefined();
    expect(response.readiness.elicitation).toBeDefined();
    expect(typeof response.readiness.elicitation.supported).toBe('boolean');
    expect(response.readiness.sampling).toBeDefined();
    expect(typeof response.readiness.sampling.available).toBe('boolean');
  });

  it('status action is schema-valid (SheetsAuthOutputSchema round-trip)', async () => {
    const handler = new AuthHandler({ googleClient: null });
    const result = await handler.handle({ action: 'status' } as any);
    const parsed = SheetsAuthOutputSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it('login returns a response (success or structured error) when no OAuth creds', async () => {
    const handler = new AuthHandler({ googleClient: null });
    const result = await handler.handle({ action: 'login' } as any);

    // Without valid OAuth credentials configured, login returns a response —
    // must not throw and must have a success field.
    expect(result.response).toBeDefined();
    expect(typeof result.response.success).toBe('boolean');
  });
});
