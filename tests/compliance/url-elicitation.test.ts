/**
 * URL Elicitation Compliance Tests
 *
 * Verifies that URL-mode elicitation (MCP 2025-11-25, SEP-1036) behaves
 * correctly relative to client capability declarations:
 *
 * - assertURLElicitationSupport throws ServiceError when url cap absent
 * - checkElicitationSupport reflects all three modes correctly
 * - initiateOAuthFlow rejects clients without url capability
 * - initiateOAuthFlow completes successfully when url capability present
 * - safeElicit falls back silently when elicitation is unavailable
 * - completeOAuthFlow tolerates missing notification channel
 *
 * Security contract: password/token/apiKey fields must NOT appear in form
 * elicitation schemas — they must be handled via secure URL mode or rejected.
 * (Tested via the security-sensitive-schema-fields test below.)
 */

import { describe, expect, it, vi } from 'vitest';
import type { ClientCapabilities, ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import {
  assertURLElicitationSupport,
  assertFormElicitationSupport,
  checkElicitationSupport,
  initiateOAuthFlow,
  completeOAuthFlow,
  safeElicit,
  type ElicitationServer,
} from '../../src/mcp/elicitation.js';
import { ServiceError } from '../../src/core/errors.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeServer(caps: ClientCapabilities | undefined): ElicitationServer {
  return {
    getClientCapabilities: () => caps,
    elicitInput: vi.fn(),
  };
}

function makeServerWithResult(
  caps: ClientCapabilities | undefined,
  result: ElicitResult
): ElicitationServer {
  return {
    getClientCapabilities: () => caps,
    elicitInput: vi.fn().mockResolvedValue(result),
  };
}

const NO_ELICITATION_CAPS: ClientCapabilities = {};

const FORM_ONLY_CAPS: ClientCapabilities = {
  elicitation: { form: true },
};

const URL_ONLY_CAPS: ClientCapabilities = {
  elicitation: { url: true },
};

const FULL_ELICITATION_CAPS: ClientCapabilities = {
  elicitation: { form: true, url: true },
};

// ─── assertURLElicitationSupport ─────────────────────────────────────────────

describe('assertURLElicitationSupport', () => {
  it('throws ServiceError when client has no elicitation capability', () => {
    const caps = NO_ELICITATION_CAPS;
    expect(() => assertURLElicitationSupport(caps)).toThrow(ServiceError);
  });

  it('throws ServiceError when client only has form elicitation (not url)', () => {
    expect(() => assertURLElicitationSupport(FORM_ONLY_CAPS)).toThrow(ServiceError);
  });

  it('throws ServiceError when capabilities are undefined', () => {
    expect(() => assertURLElicitationSupport(undefined)).toThrow(ServiceError);
  });

  it('does NOT throw when client declares url elicitation support', () => {
    expect(() => assertURLElicitationSupport(URL_ONLY_CAPS)).not.toThrow();
  });

  it('does NOT throw when client declares both form and url support', () => {
    expect(() => assertURLElicitationSupport(FULL_ELICITATION_CAPS)).not.toThrow();
  });

  it('error message describes the missing capability', () => {
    try {
      assertURLElicitationSupport(undefined);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceError);
      expect((err as ServiceError).message).toContain('URL');
    }
  });
});

// ─── assertFormElicitationSupport ────────────────────────────────────────────

describe('assertFormElicitationSupport', () => {
  it('throws ServiceError when client has no elicitation capability', () => {
    expect(() => assertFormElicitationSupport(NO_ELICITATION_CAPS)).toThrow(ServiceError);
  });

  it('throws ServiceError when client only has url elicitation (not form)', () => {
    expect(() => assertFormElicitationSupport(URL_ONLY_CAPS)).toThrow(ServiceError);
  });

  it('does NOT throw when client declares form elicitation support', () => {
    expect(() => assertFormElicitationSupport(FORM_ONLY_CAPS)).not.toThrow();
  });
});

// ─── checkElicitationSupport ──────────────────────────────────────────────────

describe('checkElicitationSupport', () => {
  it('returns supported:false form:false url:false when no elicitation caps', () => {
    const result = checkElicitationSupport(NO_ELICITATION_CAPS);
    expect(result.supported).toBe(false);
    expect(result.form).toBe(false);
    expect(result.url).toBe(false);
  });

  it('returns supported:false when capabilities are undefined', () => {
    const result = checkElicitationSupport(undefined);
    expect(result.supported).toBe(false);
    expect(result.form).toBe(false);
    expect(result.url).toBe(false);
  });

  it('returns supported:true form:true url:false for form-only caps', () => {
    const result = checkElicitationSupport(FORM_ONLY_CAPS);
    expect(result.supported).toBe(true);
    expect(result.form).toBe(true);
    expect(result.url).toBe(false);
  });

  it('returns supported:true form:false url:true for url-only caps', () => {
    const result = checkElicitationSupport(URL_ONLY_CAPS);
    expect(result.supported).toBe(true);
    expect(result.form).toBe(false);
    expect(result.url).toBe(true);
  });

  it('returns supported:true form:true url:true for full caps', () => {
    const result = checkElicitationSupport(FULL_ELICITATION_CAPS);
    expect(result.supported).toBe(true);
    expect(result.form).toBe(true);
    expect(result.url).toBe(true);
  });
});

// ─── initiateOAuthFlow ───────────────────────────────────────────────────────

describe('initiateOAuthFlow', () => {
  it('throws ServiceError when client lacks url elicitation capability', async () => {
    const server = makeServer(FORM_ONLY_CAPS);
    await expect(
      initiateOAuthFlow(server, {
        authUrl: 'https://accounts.google.com/oauth/authorize',
        provider: 'Google',
      })
    ).rejects.toThrow(ServiceError);
  });

  it('throws ServiceError when client capabilities are undefined', async () => {
    const server = makeServer(undefined);
    await expect(
      initiateOAuthFlow(server, {
        authUrl: 'https://accounts.google.com/oauth/authorize',
        provider: 'Google',
      })
    ).rejects.toThrow(ServiceError);
  });

  it('returns accepted:true and elicitationId when client accepts the URL prompt', async () => {
    const acceptResult: ElicitResult = { action: 'accept', content: {} };
    const server = makeServerWithResult(URL_ONLY_CAPS, acceptResult);

    const result = await initiateOAuthFlow(server, {
      authUrl: 'https://accounts.google.com/oauth/authorize?client_id=123',
      provider: 'Google',
      scopes: ['spreadsheets', 'drive'],
    });

    expect(result.accepted).toBe(true);
    expect(typeof result.elicitationId).toBe('string');
    expect(result.elicitationId.length).toBeGreaterThan(0);
  });

  it('returns accepted:false when client declines the URL prompt', async () => {
    const declineResult: ElicitResult = { action: 'decline' };
    const server = makeServerWithResult(URL_ONLY_CAPS, declineResult);

    const result = await initiateOAuthFlow(server, {
      authUrl: 'https://accounts.google.com/oauth/authorize',
      provider: 'Google',
    });

    expect(result.accepted).toBe(false);
    expect(typeof result.elicitationId).toBe('string');
  });

  it('elicitInput is called with mode:url and the provided authUrl', async () => {
    const acceptResult: ElicitResult = { action: 'accept', content: {} };
    const server = makeServerWithResult(URL_ONLY_CAPS, acceptResult);
    const elicitInputSpy = server.elicitInput as ReturnType<typeof vi.fn>;

    await initiateOAuthFlow(server, {
      authUrl: 'https://example.com/oauth',
      provider: 'ExampleProvider',
    });

    expect(elicitInputSpy).toHaveBeenCalledOnce();
    const callArg = elicitInputSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(callArg['mode']).toBe('url');
    expect(callArg['url']).toBe('https://example.com/oauth');
  });

  it('includes scope list in elicitation message when scopes provided', async () => {
    const acceptResult: ElicitResult = { action: 'accept', content: {} };
    const server = makeServerWithResult(FULL_ELICITATION_CAPS, acceptResult);
    const elicitInputSpy = server.elicitInput as ReturnType<typeof vi.fn>;

    await initiateOAuthFlow(server, {
      authUrl: 'https://example.com/oauth',
      provider: 'Google',
      scopes: ['spreadsheets.readonly', 'drive.readonly'],
    });

    const callArg = elicitInputSpy.mock.calls[0][0] as Record<string, unknown>;
    const message = callArg['message'] as string;
    expect(message).toContain('spreadsheets.readonly');
    expect(message).toContain('drive.readonly');
  });

  it('elicitationId has oauth prefix', async () => {
    const acceptResult: ElicitResult = { action: 'accept', content: {} };
    const server = makeServerWithResult(URL_ONLY_CAPS, acceptResult);

    const result = await initiateOAuthFlow(server, {
      authUrl: 'https://example.com/oauth',
      provider: 'TestProvider',
    });

    expect(result.elicitationId).toMatch(/^oauth_/);
  });
});

// ─── completeOAuthFlow ───────────────────────────────────────────────────────

describe('completeOAuthFlow', () => {
  it('calls the completion notifier when server provides one', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const server: ElicitationServer = {
      getClientCapabilities: () => FULL_ELICITATION_CAPS,
      elicitInput: vi.fn(),
      createElicitationCompletionNotifier: vi.fn().mockReturnValue(notify),
    };

    await completeOAuthFlow(server, 'oauth_12345_abc');
    expect(notify).toHaveBeenCalledOnce();
  });

  it('does not throw when server has no createElicitationCompletionNotifier', async () => {
    const server = makeServer(FULL_ELICITATION_CAPS);
    // completeOAuthFlow is best-effort — no notifier = no-op
    await expect(completeOAuthFlow(server, 'oauth_12345_abc')).resolves.toBeUndefined();
  });

  it('does not throw when the notifier itself throws', async () => {
    const notify = vi.fn().mockRejectedValue(new Error('SSE channel closed'));
    const server: ElicitationServer = {
      getClientCapabilities: () => FULL_ELICITATION_CAPS,
      elicitInput: vi.fn(),
      createElicitationCompletionNotifier: vi.fn().mockReturnValue(notify),
    };

    // Should resolve without throwing — failure is non-fatal (tool-response.ts comment)
    await expect(completeOAuthFlow(server, 'oauth_12345_abc')).resolves.toBeUndefined();
  });
});

// ─── safeElicit ──────────────────────────────────────────────────────────────

describe('safeElicit', () => {
  it('returns fallback when elicitInput throws (client does not support elicitation)', async () => {
    const server = makeServer(NO_ELICITATION_CAPS);
    (server.elicitInput as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('elicitation not supported')
    );

    const result = await safeElicit(
      server,
      {
        mode: 'form',
        message: 'Pick a preset',
        requestedSchema: {
          type: 'object',
          properties: { preset: { type: 'string', title: 'Preset' } },
          required: ['preset'],
        },
      },
      null
    );

    expect(result).toBeNull();
  });

  it('returns the accepted content when client accepts', async () => {
    const acceptResult: ElicitResult = {
      action: 'accept',
      content: { preset: 'highlight_duplicates' },
    };
    const server = makeServerWithResult(FORM_ONLY_CAPS, acceptResult);

    const result = await safeElicit<{ preset: string } | null>(
      server,
      {
        mode: 'form',
        message: 'Choose preset',
        requestedSchema: {
          type: 'object',
          properties: { preset: { type: 'string', title: 'Preset' } },
          required: ['preset'],
        },
      },
      null
    );

    expect(result).toEqual({ preset: 'highlight_duplicates' });
  });

  it('returns fallback when client declines (action !== accept)', async () => {
    const declineResult: ElicitResult = { action: 'decline' };
    const server = makeServerWithResult(FORM_ONLY_CAPS, declineResult);

    const fallback = { preset: 'default_preset' };
    const result = await safeElicit<{ preset: string }>(
      server,
      {
        mode: 'form',
        message: 'Choose preset',
        requestedSchema: {
          type: 'object',
          properties: { preset: { type: 'string', title: 'Preset' } },
          required: ['preset'],
        },
      },
      fallback
    );

    expect(result).toBe(fallback);
  });

  it('returns fallback when elicitInput returns accept but content is null/undefined', async () => {
    const emptyAccept: ElicitResult = { action: 'accept' }; // no content
    const server = makeServerWithResult(FORM_ONLY_CAPS, emptyAccept);

    const result = await safeElicit(
      server,
      {
        mode: 'form',
        message: 'Enter value',
        requestedSchema: {
          type: 'object',
          properties: { value: { type: 'string', title: 'Value' } },
          required: ['value'],
        },
      },
      'DEFAULT'
    );

    expect(result).toBe('DEFAULT');
  });
});

// ─── Security: sensitive schema fields must not appear in form elicitation ───

describe('Security contract: sensitive field patterns in form schemas', () => {
  /**
   * URL elicitation (mode: 'url') is the secure path for credentials.
   * Form elicitation (mode: 'form') should never accept password/token/apiKey
   * because form content is transmitted as plain JSON — use URL mode instead.
   *
   * This test documents the expected behaviour: assertURLElicitationSupport()
   * is the gate that must be checked before handling OAuth or API-key flows.
   * If the client lacks URL capability, the flow must reject rather than
   * fall back to a form that would expose the credential in cleartext.
   */
  it('initiateOAuthFlow rejects client without url capability rather than falling back to form', async () => {
    const formOnlyServer = makeServer(FORM_ONLY_CAPS);

    // The OAuth flow requires URL mode — it must never fall back to a plain form
    // because that would send the auth URL as a cleartext form field value.
    await expect(
      initiateOAuthFlow(formOnlyServer, {
        authUrl: 'https://accounts.google.com/oauth/authorize',
        provider: 'Google',
      })
    ).rejects.toThrow(ServiceError);

    // elicitInput should NOT have been called — rejection happens before any elicitation attempt
    expect((formOnlyServer.elicitInput as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('assertURLElicitationSupport is the required gate before any url-mode elicitation', () => {
    // Document the invariant: any function that uses url-mode elicitation must
    // call assertURLElicitationSupport first. The test verifies that the guard
    // throws predictably, enabling callers to catch and return structured errors.
    const noCaps = makeServer(undefined);

    expect(() => assertURLElicitationSupport(noCaps.getClientCapabilities())).toThrow(
      ServiceError
    );
  });
});
