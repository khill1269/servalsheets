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
});
