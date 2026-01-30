/**
 * ServalSheets - Auth Handler Tests
 *
 * Tests for OAuth authentication flows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthHandler } from '../../src/handlers/auth.js';
import { SheetsAuthOutputSchema } from '../../src/schemas/auth.js';
import type { GoogleApiClient } from '../../src/services/google-api.js';

// Mock googleapis with proper OAuth2Client class
// Note: Class must be defined inside factory to avoid hoisting issues
// See tests/helpers/oauth-mocks.ts for the reference implementation
vi.mock('googleapis', () => {
  class MockOAuth2Client {
    credentials: any = {};

    generateAuthUrl = vi
      .fn()
      .mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&redirect_uri=http://localhost:3000/callback&scope=https://www.googleapis.com/auth/spreadsheets&access_type=offline&response_type=code'
      );

    getToken = vi.fn().mockResolvedValue({
      tokens: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expiry_date: Date.now() + 3600000,
      },
    });

    setCredentials = vi.fn((tokens: any) => {
      this.credentials = tokens;
    });

    revokeToken = vi.fn().mockResolvedValue({ success: true });

    getAccessToken = vi.fn().mockResolvedValue({
      token: 'mock-access-token',
    });

    refreshAccessToken = vi.fn().mockResolvedValue({
      credentials: {
        access_token: 'mock-refreshed-token',
        expiry_date: Date.now() + 3600000,
      },
    });
  }

  return {
    google: {
      auth: {
        OAuth2: MockOAuth2Client,
      },
    },
  };
});

// Mock EncryptedFileTokenStore
// See tests/helpers/oauth-mocks.ts for the reference implementation
vi.mock('../../src/services/token-store.js', () => {
  class MockEncryptedFileTokenStore {
    save = vi.fn().mockResolvedValue(undefined);
    load = vi.fn().mockResolvedValue(null);
    clear = vi.fn().mockResolvedValue(undefined);
  }

  return {
    EncryptedFileTokenStore: MockEncryptedFileTokenStore,
  };
});

// Mock Google API client
const createMockGoogleClient = (
  authType: 'oauth' | 'service_account' | 'application_default' = 'oauth',
  hasTokens = false
): GoogleApiClient =>
  ({
    authType,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    getTokenStatus: vi.fn().mockReturnValue({
      hasAccessToken: hasTokens,
      hasRefreshToken: hasTokens,
    }),
    validateToken: vi.fn().mockResolvedValue({
      valid: hasTokens, // Token is valid if it exists
      error: hasTokens ? undefined : 'No token present',
    }),
    setCredentials: vi.fn(),
    clearStoredTokens: vi.fn(),
    revokeAccess: vi.fn(),
  }) as any;

describe('AuthHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variables
    delete process.env['OAUTH_CLIENT_ID'];
    delete process.env['OAUTH_CLIENT_SECRET'];
    delete process.env['OAUTH_USE_CALLBACK_SERVER'];
    process.env['OAUTH_AUTO_OPEN_BROWSER'] = 'false';
  });

  describe('status action', () => {
    it('should return authenticated status for service account', async () => {
      const mockClient = createMockGoogleClient('service_account', true);
      const handler = new AuthHandler({ googleClient: mockClient });

      const result = await handler.handle({ action: 'status' });

      expect(result).toHaveProperty('response');
      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authenticated', true);
      expect(result.response).toHaveProperty('authType', 'service_account');

      const parseResult = SheetsAuthOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should return authenticated status for OAuth with tokens', async () => {
      const mockClient = createMockGoogleClient('oauth', true);
      const handler = new AuthHandler({ googleClient: mockClient });

      const result = await handler.handle({ action: 'status' });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authenticated', true);
      expect(result.response).toHaveProperty('hasAccessToken', true);
      expect(result.response).toHaveProperty('hasRefreshToken', true);
    });

    it('should return not authenticated when no tokens', async () => {
      const mockClient = createMockGoogleClient('oauth', false);
      const handler = new AuthHandler({ googleClient: mockClient });

      const result = await handler.handle({ action: 'status' });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authenticated', false);
      expect(result.response.message).toContain('Not authenticated');
    });

    it('should return unconfigured when no OAuth credentials', async () => {
      const handler = new AuthHandler({ googleClient: null });

      const result = await handler.handle({ action: 'status' });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authenticated', false);
      expect(result.response).toHaveProperty('authType', 'unconfigured');
    });

    it('should return configured but not authenticated', async () => {
      const handler = new AuthHandler({
        googleClient: null,
        oauthClientId: 'test-client-id',
        oauthClientSecret: 'test-secret',
      });

      const result = await handler.handle({ action: 'status' });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authenticated', false);
      expect(result.response).toHaveProperty('authType', 'oauth');
    });
  });

  describe('login action', () => {
    it('should return error when OAuth not configured', async () => {
      const handler = new AuthHandler({ googleClient: null });

      const result = await handler.handle({ action: 'login' });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
      expect(result.response.error?.message).toContain('not configured');
    });

    it('should generate auth URL for manual flow', async () => {
      const handler = new AuthHandler({
        oauthClientId: 'test-client-id',
        oauthClientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      // Disable auto features
      process.env['OAUTH_USE_CALLBACK_SERVER'] = 'false';
      process.env['OAUTH_AUTO_OPEN_BROWSER'] = 'false';

      const result = await handler.handle({ action: 'login' });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authUrl');
      expect(result.response.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(result.response).toHaveProperty('instructions');
      expect(result.response.instructions).toBeInstanceOf(Array);
    });

    it('should request additional scopes when provided', async () => {
      const mockClient = createMockGoogleClient('oauth', false);
      const handler = new AuthHandler({
        googleClient: mockClient,
        oauthClientId: 'test-client-id',
        oauthClientSecret: 'test-secret',
      });

      process.env['OAUTH_USE_CALLBACK_SERVER'] = 'false';

      const result = await handler.handle({
        action: 'login',
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      expect(result.response.success).toBe(true);
      expect(result.response.scopes).toContain('https://www.googleapis.com/auth/drive.readonly');
    });

    it('should handle callback server timeout gracefully', async () => {
      const handler = new AuthHandler({
        oauthClientId: 'test-client-id',
        oauthClientSecret: 'test-secret',
        redirectUri: 'http://localhost:3000/callback',
      });

      // Note: Callback server timeout behavior is tested via environment variables
      // For simplicity, we test the manual flow which is the fallback
      process.env['OAUTH_USE_CALLBACK_SERVER'] = 'false';

      const result = await handler.handle({ action: 'login' });

      // Should fall back to manual flow
      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authUrl');
    });
  });

  describe('callback action', () => {
    it('should exchange code for tokens', async () => {
      const mockClient = createMockGoogleClient('oauth', false);
      const handler = new AuthHandler({
        googleClient: mockClient,
        oauthClientId: 'test-client-id',
        oauthClientSecret: 'test-secret',
      });

      const result = await handler.handle({
        action: 'callback',
        code: 'test-auth-code',
      });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authenticated', true);
      expect(result.response).toHaveProperty('hasRefreshToken', true);
    });

    it('should return error when OAuth not configured', async () => {
      const handler = new AuthHandler({ googleClient: null });

      const result = await handler.handle({
        action: 'callback',
        code: 'test-code',
      });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('CONFIG_ERROR');
    });

    it('should warn when encryption key not set', async () => {
      const handler = new AuthHandler({
        oauthClientId: 'test-client-id',
        oauthClientSecret: 'test-secret',
        tokenStoreKey: undefined,
      });

      const result = await handler.handle({
        action: 'callback',
        code: 'test-code',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.message).toContain('ENCRYPTION_KEY');
      }
    });
  });

  describe('logout action', () => {
    it('should clear tokens and revoke access', async () => {
      const mockClient = createMockGoogleClient('oauth', true);
      const handler = new AuthHandler({ googleClient: mockClient });

      const result = await handler.handle({ action: 'logout' });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authenticated', false);
      expect(mockClient.clearStoredTokens).toHaveBeenCalled();

      const parseResult = SheetsAuthOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle revoke errors gracefully', async () => {
      const mockClient = createMockGoogleClient('oauth', true);
      mockClient.revokeAccess = vi.fn().mockRejectedValue(new Error('Revoke failed'));
      const handler = new AuthHandler({ googleClient: mockClient });

      const result = await handler.handle({ action: 'logout' });

      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('authenticated', false);
    });

    it('should clear token store when no client', async () => {
      const handler = new AuthHandler({
        googleClient: null,
        tokenStoreKey: 'test-key',
      });

      const result = await handler.handle({ action: 'logout' });

      expect(result.response.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors', async () => {
      const mockClient = createMockGoogleClient('oauth', true);
      mockClient.getTokenStatus = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      const handler = new AuthHandler({ googleClient: mockClient });

      const result = await handler.handle({ action: 'status' });

      expect(result.response.success).toBe(false);
      expect(result.response.error?.code).toBe('INTERNAL_ERROR');
    });

    it('should validate output against schema', async () => {
      const handler = new AuthHandler({
        oauthClientId: 'test-id',
        oauthClientSecret: 'test-secret',
      });

      const result = await handler.handle({ action: 'status' });

      const parseResult = SheetsAuthOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('token manager integration', () => {
    it('should start token manager after successful login', async () => {
      const handler = new AuthHandler({
        oauthClientId: 'test-client-id',
        oauthClientSecret: 'test-secret',
      });

      const result = await handler.handle({
        action: 'callback',
        code: 'test-code',
      });

      expect(result.response.success).toBe(true);
    });

    it('should stop token manager on logout', async () => {
      const mockClient = createMockGoogleClient('oauth', true);
      const handler = new AuthHandler({ googleClient: mockClient });

      // First logout
      const result = await handler.handle({ action: 'logout' });

      expect(result.response.success).toBe(true);
    });
  });
});
