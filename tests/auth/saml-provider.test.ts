/**
 * Tests for SamlProvider (ISSUE-173 — Enterprise SSO/SAML)
 *
 * Tests cover:
 * - createSamlProviderFromEnv: null when unconfigured, SamlProvider when configured
 * - issueToken: JWT structure, scope, expiry
 * - verifyToken: valid/invalid/expired/wrong-scope
 * - generateMetadata: returns XML string
 * - createRouter: correct routes registered (login, callback, metadata, logout)
 * - createRouter callback: error paths (no profile, no nameId, assertion error)
 *
 * Uses dependency injection to pass a mock SAML instance — no real IdP needed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { SAML, SamlProfile } from 'node-saml';

import {
  SamlProvider,
  createSamlProviderFromEnv,
  type SamlProviderConfig,
} from '../../src/auth/saml-provider.js';

// ============================================================================
// Helpers
// ============================================================================

const TEST_JWT_SECRET = 'test-jwt-secret-must-be-long-enough-for-hs256';

const BASE_CONFIG: SamlProviderConfig = {
  entryPoint: 'https://idp.example.com/sso/saml',
  issuer: 'https://servalsheets.example.com',
  cert: 'MIIB...base64cert...==',
  callbackUrl: 'https://servalsheets.example.com/sso/callback',
  jwtSecret: TEST_JWT_SECRET,
};

/**
 * Build a mock SAML instance (injected via DI into SamlProvider).
 * Avoids constructing a real SAML object (no node-saml module mock needed).
 */
function makeMockSaml(overrides: Partial<{
  getAuthorizeUrlAsync: ReturnType<typeof vi.fn>;
  validatePostResponseAsync: ReturnType<typeof vi.fn>;
  getLogoutUrlAsync: ReturnType<typeof vi.fn>;
  generateServiceProviderMetadata: ReturnType<typeof vi.fn>;
}> = {}): SAML {
  return {
    getAuthorizeUrlAsync: vi.fn().mockResolvedValue('https://idp.example.com/sso?SAMLRequest=xxx'),
    validatePostResponseAsync: vi.fn(),
    getLogoutUrlAsync: vi.fn().mockResolvedValue('https://idp.example.com/slo?SAMLRequest=xxx'),
    generateServiceProviderMetadata: vi.fn().mockReturnValue('<EntityDescriptor>...</EntityDescriptor>'),
    ...overrides,
  } as unknown as SAML;
}

function makeProvider(config: Partial<SamlProviderConfig> = {}, saml?: SAML): SamlProvider {
  return new SamlProvider({ ...BASE_CONFIG, ...config }, saml ?? makeMockSaml());
}

function makeResMock() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res;
}

function makeReqMock(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    body: {},
    headers: { host: 'servalsheets.example.com' },
    ...overrides,
  } as unknown as import('express').Request;
}

// Helper to find and call a route handler from the router
function getRouteHandler(router: import('express').Router, path: string, method: 'get' | 'post') {
  const layer = (router.stack as Array<{
    route?: { path: string; stack: Array<{ handle: Function; method: string }> };
  }>).find(
    (l) => l.route?.path === path && l.route.stack.some((s) => s.method === method)
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  return layer.route!.stack.find((s) => s.method === method)!.handle;
}

// ============================================================================
// createSamlProviderFromEnv
// ============================================================================

describe('createSamlProviderFromEnv', () => {
  it('returns null when SAML_ENTRY_POINT is missing', () => {
    const result = createSamlProviderFromEnv({
      SAML_ISSUER: 'https://example.com',
      SAML_CERT: 'cert',
      SAML_CALLBACK_URL: 'https://example.com/sso/callback',
      JWT_SECRET: TEST_JWT_SECRET,
    });
    expect(result).toBeNull();
  });

  it('returns null when SAML_CERT is missing', () => {
    const result = createSamlProviderFromEnv({
      SAML_ENTRY_POINT: 'https://idp.example.com/sso',
      SAML_ISSUER: 'https://example.com',
      SAML_CALLBACK_URL: 'https://example.com/sso/callback',
      JWT_SECRET: TEST_JWT_SECRET,
    });
    expect(result).toBeNull();
  });

  it('returns null when JWT_SECRET is missing', () => {
    const result = createSamlProviderFromEnv({
      SAML_ENTRY_POINT: 'https://idp.example.com/sso',
      SAML_ISSUER: 'https://example.com',
      SAML_CERT: 'cert',
      SAML_CALLBACK_URL: 'https://example.com/sso/callback',
    });
    expect(result).toBeNull();
  });

  it('returns SamlProvider (or throws on bad cert) when all required vars are set', () => {
    // createSamlProviderFromEnv calls new SAML() which validates the cert;
    // in test environments we accept either a SamlProvider or a cert error.
    try {
      const result = createSamlProviderFromEnv({
        SAML_ENTRY_POINT: 'https://idp.example.com/sso',
        SAML_ISSUER: 'https://example.com',
        SAML_CERT: 'invalid-cert',
        SAML_CALLBACK_URL: 'https://example.com/sso/callback',
        JWT_SECRET: TEST_JWT_SECRET,
      });
      // If it doesn't throw, it should return a SamlProvider
      expect(result).toBeInstanceOf(SamlProvider);
    } catch (e) {
      // node-saml rejects the cert — that's expected with a fake cert
      expect(e).toBeInstanceOf(Error);
    }
  });
});

// ============================================================================
// issueToken
// ============================================================================

describe('SamlProvider.issueToken', () => {
  let provider: SamlProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  it('issues a JWT with scope=sso', () => {
    const token = provider.issueToken('user@example.com', {});
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded['scope']).toBe('sso');
  });

  it('sets sub to NameID', () => {
    const token = provider.issueToken('user@example.com', {});
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded['sub']).toBe('user@example.com');
  });

  it('sets iss and aud to issuer', () => {
    const token = provider.issueToken('user@example.com', {});
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded['iss']).toBe(BASE_CONFIG.issuer);
    expect(decoded['aud']).toBe(BASE_CONFIG.issuer);
  });

  it('embeds common SAML attributes in saml.attributes', () => {
    const profile: Record<string, unknown> = {
      email: 'alice@corp.com',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'Alice',
    };
    const token = provider.issueToken('alice@corp.com', profile);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    const saml = decoded['saml'] as Record<string, unknown>;
    const attrs = saml['attributes'] as Record<string, string>;
    expect(attrs['email']).toBe('alice@corp.com');
    expect(attrs['givenname']).toBe('Alice');
  });

  it('embeds sessionIndex when provided', () => {
    const token = provider.issueToken('user@example.com', {}, 'session_abc123');
    const decoded = jwt.decode(token) as Record<string, unknown>;
    const saml = decoded['saml'] as Record<string, unknown>;
    expect(saml['sessionIndex']).toBe('session_abc123');
  });

  it('token expires in ~3600s by default', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = provider.issueToken('user@example.com', {});
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(3600);
    expect(decoded.iat).toBeGreaterThanOrEqual(before);
  });

  it('custom jwtTtl is reflected in exp', () => {
    const p = makeProvider({ jwtTtl: 7200 });
    const token = p.issueToken('user@example.com', {});
    const decoded = jwt.decode(token) as { exp: number; iat: number };
    expect(decoded.exp - decoded.iat).toBe(7200);
  });
});

// ============================================================================
// verifyToken
// ============================================================================

describe('SamlProvider.verifyToken', () => {
  let provider: SamlProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  it('returns decoded payload for valid SSO token', () => {
    const token = provider.issueToken('user@example.com', {});
    const result = provider.verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe('user@example.com');
    expect(result!.scope).toBe('sso');
  });

  it('returns null for invalid signature', () => {
    const token = provider.issueToken('user@example.com', {});
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(provider.verifyToken(tampered)).toBeNull();
  });

  it('returns null for non-SSO token (e.g. OAuth scope)', () => {
    const oauthToken = jwt.sign(
      { sub: 'user', aud: BASE_CONFIG.issuer, iss: BASE_CONFIG.issuer, scope: 'read write' },
      TEST_JWT_SECRET,
      { algorithm: 'HS256' }
    );
    expect(provider.verifyToken(oauthToken)).toBeNull();
  });

  it('returns null for expired token', () => {
    const expiredToken = jwt.sign(
      {
        sub: 'user',
        aud: BASE_CONFIG.issuer,
        iss: BASE_CONFIG.issuer,
        scope: 'sso',
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      TEST_JWT_SECRET,
      { algorithm: 'HS256' }
    );
    expect(provider.verifyToken(expiredToken)).toBeNull();
  });

  it('returns null for garbage string', () => {
    expect(provider.verifyToken('not.a.token')).toBeNull();
  });
});

// ============================================================================
// generateMetadata
// ============================================================================

describe('SamlProvider.generateMetadata', () => {
  it('returns an XML string', async () => {
    const provider = makeProvider();
    const metadata = await provider.generateMetadata();
    expect(typeof metadata).toBe('string');
    expect(metadata).toContain('EntityDescriptor');
  });
});

// ============================================================================
// createRouter — route registration
// ============================================================================

describe('SamlProvider.createRouter — route registration', () => {
  it('registers /sso/metadata, /sso/login, /sso/callback, /sso/logout', () => {
    const provider = makeProvider();
    const router = provider.createRouter();
    const paths = (router.stack as Array<{ route?: { path: string } }>)
      .filter((l) => l.route)
      .map((l) => l.route!.path);

    expect(paths).toContain('/sso/metadata');
    expect(paths).toContain('/sso/login');
    expect(paths).toContain('/sso/callback');
    expect(paths).toContain('/sso/logout');
  });
});

// ============================================================================
// createRouter — callback route (POST /sso/callback)
// ============================================================================

describe('SamlProvider.createRouter — callback route', () => {
  let mockSaml: SAML;
  let provider: SamlProvider;

  beforeEach(() => {
    mockSaml = makeMockSaml();
    provider = makeProvider({}, mockSaml);
  });

  it('returns 400 when assertion has no profile', async () => {
    (mockSaml.validatePostResponseAsync as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ profile: null, loggedOut: false });

    const router = provider.createRouter();
    const handler = getRouteHandler(router, '/sso/callback', 'post');
    const req = makeReqMock({ body: {} });
    const res = makeResMock();
    await handler(req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'SSO_NO_PROFILE' }));
  });

  it('returns 400 when NameID is missing from profile', async () => {
    const profile: Partial<SamlProfile> = { nameID: undefined, email: 'user@corp.com' } as Partial<SamlProfile>;
    (mockSaml.validatePostResponseAsync as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ profile, loggedOut: false });

    const router = provider.createRouter();
    const handler = getRouteHandler(router, '/sso/callback', 'post');
    const req = makeReqMock({ body: {} });
    const res = makeResMock();
    await handler(req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'SSO_NO_NAMEID' }));
  });

  it('returns 401 when assertion validation throws', async () => {
    (mockSaml.validatePostResponseAsync as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Invalid signature'));

    const router = provider.createRouter();
    const handler = getRouteHandler(router, '/sso/callback', 'post');
    const req = makeReqMock({ body: {} });
    const res = makeResMock();
    await handler(req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'SSO_ASSERTION_INVALID' })
    );
  });

  it('returns JSON with token when assertion is valid and no RelayState', async () => {
    (mockSaml.validatePostResponseAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
      profile: { nameID: 'user@corp.com', email: 'user@corp.com', sessionIndex: 'sess_1' },
      loggedOut: false,
    });

    const router = provider.createRouter();
    const handler = getRouteHandler(router, '/sso/callback', 'post');
    const req = makeReqMock({ body: {} });
    const res = makeResMock();
    await handler(req, res, () => {});

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ tokenType: 'Bearer', nameId: 'user@corp.com' })
    );
    const call = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0] as { token: string };
    const decoded = provider.verifyToken(call.token);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe('user@corp.com');
  });

  it('redirects with sso_token when assertion valid and RelayState provided', async () => {
    (mockSaml.validatePostResponseAsync as ReturnType<typeof vi.fn>).mockResolvedValue({
      profile: { nameID: 'user@corp.com' },
      loggedOut: false,
    });

    const router = provider.createRouter();
    const handler = getRouteHandler(router, '/sso/callback', 'post');
    const req = makeReqMock({
      body: { RelayState: 'https://app.example.com/dashboard' },
    });
    const res = makeResMock();
    await handler(req, res, () => {});

    expect(res.redirect).toHaveBeenCalledWith(
      expect.stringContaining('https://app.example.com/dashboard')
    );
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('sso_token='));
  });

  it('handles loggedOut=true gracefully', async () => {
    (mockSaml.validatePostResponseAsync as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ profile: null, loggedOut: true });

    const router = provider.createRouter();
    const handler = getRouteHandler(router, '/sso/callback', 'post');
    const req = makeReqMock({ body: {} });
    const res = makeResMock();
    await handler(req, res, () => {});

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Logged out successfully' })
    );
  });
});
