/**
 * Tests for Google API Client
 *
 * Tests the GoogleApiClient class including initialization,
 * token management, scopes, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock googleapis before importing the module
vi.mock('googleapis', () => {
  // Create a mock class for OAuth2
  class MockOAuth2 {
    credentials = {};
    setCredentials = vi.fn();
    on = vi.fn();
    off = vi.fn();
    generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth');
    getToken = vi.fn().mockResolvedValue({ tokens: { access_token: 'test-token' } });
  }

  // Create a mock class for GoogleAuth
  class MockGoogleAuth {
    getClient = vi.fn().mockResolvedValue({
      credentials: {},
      setCredentials: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    });
  }

  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
        GoogleAuth: MockGoogleAuth,
      },
      sheets: vi.fn().mockReturnValue({
        spreadsheets: {
          get: vi.fn(),
          values: { get: vi.fn(), update: vi.fn() },
        },
      }),
      drive: vi.fn().mockReturnValue({
        files: { list: vi.fn(), get: vi.fn() },
      }),
      bigquery: vi.fn().mockReturnValue({
        datasets: { list: vi.fn(), get: vi.fn() },
        tables: { list: vi.fn(), get: vi.fn() },
        jobs: { query: vi.fn(), get: vi.fn() },
      }),
    },
  };
});

// Mock token store
vi.mock('../services/token-store.js', () => ({
  EncryptedFileTokenStore: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock token manager
vi.mock('../services/token-manager.js', () => ({
  TokenManager: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    forceRefresh: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock circuit breaker
vi.mock('../utils/circuit-breaker.js', () => ({
  CircuitBreaker: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation((fn) => fn()),
    getStats: vi.fn().mockReturnValue({ state: 'closed', failures: 0 }),
  })),
}));

// Mock config
vi.mock('../config/env.js', () => ({
  getCircuitBreakerConfig: vi.fn().mockReturnValue({
    failureThreshold: 5,
    resetTimeout: 30000,
  }),
}));

// Mock HTTP/2 detector
vi.mock('../utils/http2-detector.js', () => ({
  logHTTP2Capabilities: vi.fn(),
  validateHTTP2Config: vi.fn().mockReturnValue({ warnings: [] }),
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  GoogleApiClient,
  DEFAULT_SCOPES,
  ELEVATED_SCOPES,
  READONLY_SCOPES,
  type GoogleApiClientOptions,
} from '../../src/services/google-api.js';

describe('GoogleApiClient', () => {
  let client: GoogleApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (client) {
      await client.destroy?.();
    }
  });

  describe('constructor', () => {
    it('should create client with default options', () => {
      client = new GoogleApiClient();
      expect(client).toBeDefined();
      expect(client.authType).toBe('application_default');
    });

    it('should detect service account auth type', () => {
      client = new GoogleApiClient({
        serviceAccountKeyPath: '/path/to/key.json',
      });
      expect(client.authType).toBe('service_account');
    });

    it('should detect oauth auth type', () => {
      client = new GoogleApiClient({
        credentials: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      });
      expect(client.authType).toBe('oauth');
    });

    it('should detect access token auth type', () => {
      client = new GoogleApiClient({
        accessToken: 'test-access-token',
      });
      expect(client.authType).toBe('access_token');
    });

    it('should use default scopes by default', () => {
      client = new GoogleApiClient();
      expect(client.scopes).toEqual(DEFAULT_SCOPES);
    });

    it('should use elevated scopes when requested', () => {
      client = new GoogleApiClient({ elevatedAccess: true });
      expect(client.scopes).toEqual(ELEVATED_SCOPES);
    });

    it('should use custom scopes when provided', () => {
      const customScopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
      client = new GoogleApiClient({ scopes: customScopes });
      expect(client.scopes).toEqual(customScopes);
    });
  });

  describe('scopes exports', () => {
    it('should export DEFAULT_SCOPES with spreadsheets and drive.file', () => {
      expect(DEFAULT_SCOPES).toContain('https://www.googleapis.com/auth/spreadsheets');
      expect(DEFAULT_SCOPES).toContain('https://www.googleapis.com/auth/drive.file');
    });

    it('should export ELEVATED_SCOPES with full drive access', () => {
      expect(ELEVATED_SCOPES).toContain('https://www.googleapis.com/auth/spreadsheets');
      expect(ELEVATED_SCOPES).toContain('https://www.googleapis.com/auth/drive');
    });

    it('should export READONLY_SCOPES', () => {
      expect(READONLY_SCOPES).toContain('https://www.googleapis.com/auth/spreadsheets.readonly');
      expect(READONLY_SCOPES).toContain('https://www.googleapis.com/auth/drive.readonly');
    });
  });

  describe('initialize', () => {
    it('should initialize with OAuth credentials', async () => {
      client = new GoogleApiClient({
        credentials: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      await client.initialize();

      // Should not throw
      expect(client.sheets).toBeDefined();
      expect(client.drive).toBeDefined();
    });

    it('should initialize with access token', async () => {
      client = new GoogleApiClient({
        accessToken: 'test-access-token',
      });

      await client.initialize();

      expect(client.sheets).toBeDefined();
    });
  });

  describe('sheets getter', () => {
    it('should throw ServiceError when not initialized', () => {
      client = new GoogleApiClient();

      expect(() => client.sheets).toThrow('Google API client not initialized');
    });

    it('should return sheets API when initialized', async () => {
      client = new GoogleApiClient({
        credentials: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      });

      await client.initialize();

      expect(client.sheets).toBeDefined();
      expect(client.sheets.spreadsheets).toBeDefined();
    });
  });

  describe('drive getter', () => {
    it('should throw ServiceError when not initialized', () => {
      client = new GoogleApiClient();

      expect(() => client.drive).toThrow('Google API client not initialized');
    });

    it('should return drive API when initialized', async () => {
      client = new GoogleApiClient({
        credentials: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      });

      await client.initialize();

      expect(client.drive).toBeDefined();
      expect(client.drive.files).toBeDefined();
    });
  });

  describe('oauth2 getter', () => {
    it('should throw ServiceError when not initialized', () => {
      client = new GoogleApiClient();

      expect(() => client.oauth2).toThrow('Google API client not initialized');
    });
  });

  describe('getTokenStatus', () => {
    it('should return empty status when not initialized', () => {
      client = new GoogleApiClient();

      const status = client.getTokenStatus();

      expect(status.hasAccessToken).toBe(false);
      expect(status.hasRefreshToken).toBe(false);
    });
  });

  describe('hasElevatedAccess', () => {
    it('should return false for default scopes', () => {
      client = new GoogleApiClient();
      expect(client.hasElevatedAccess).toBe(false);
    });

    it('should return true for elevated scopes', () => {
      client = new GoogleApiClient({ elevatedAccess: true });
      expect(client.hasElevatedAccess).toBe(true);
    });
  });

  describe('scopes getter', () => {
    it('should return a copy of scopes (not the original array)', () => {
      client = new GoogleApiClient();
      const scopes1 = client.scopes;
      const scopes2 = client.scopes;

      expect(scopes1).toEqual(scopes2);
      expect(scopes1).not.toBe(scopes2); // Different array instances
    });
  });
});

describe('GoogleApiClient token management', () => {
  it('should handle token store initialization', () => {
    const client = new GoogleApiClient({
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      },
      tokenStorePath: '/tmp/tokens.encrypted',
      tokenStoreKey: '0'.repeat(64), // 64-char hex key
    });

    expect(client).toBeDefined();
  });

  it('should accept custom token store', () => {
    const customStore = {
      load: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const client = new GoogleApiClient({
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      },
      tokenStore: customStore,
    });

    expect(client).toBeDefined();
  });
});

describe('GoogleApiClient options', () => {
  it('should accept retry options', () => {
    const client = new GoogleApiClient({
      retryOptions: {
        maxRetries: 5,
        initialDelayMs: 1000,
      },
    });

    expect(client).toBeDefined();
  });

  it('should accept timeout option', () => {
    const client = new GoogleApiClient({
      timeoutMs: 30000,
    });

    expect(client).toBeDefined();
  });
});
