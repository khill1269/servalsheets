/**
 * ServalSheets - DocsConnector Security Tests (C4)
 *
 * Regression tests for Drive API query injection fix:
 * single-quote characters in search queries must be escaped before
 * interpolation into the Drive `name contains '...'` query string.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocsConnector } from '../../src/connectors/docs-connector.js';

vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('DocsConnector security (C4: Drive query injection)', () => {
  let connector: DocsConnector;
  let capturedUrl: string | undefined;

  beforeEach(async () => {
    connector = new DocsConnector();
    await connector.configure({ oauth: { accessToken: 'fake-token' } });
    capturedUrl = undefined;

    // Intercept fetch and capture the Drive API URL
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          json: async () => ({ files: [] }),
        } as unknown as Response;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('escapes single quotes in search query before Drive API interpolation', async () => {
    await connector.query('documents/search', { query: "O'Brien" });

    expect(capturedUrl).toBeDefined();
    // The q param should contain the escaped form, not a raw single quote that breaks the query
    const q = new URL(capturedUrl!).searchParams.get('q');
    expect(q).toContain("\\'");
    expect(q).not.toMatch(/name contains '[^'\\]*'[^']/);
  });

  it('escapes backslash before escaping single quotes (prevents double-escape bypass)', async () => {
    // Payload: foo\' — attacker tries to escape our escape
    await connector.query('documents/search', { query: "foo\\'" });

    const q = new URL(capturedUrl!).searchParams.get('q');
    // backslash must be escaped to \\ first, then ' to \'
    expect(q).toContain("\\\\'");
  });

  it('passes benign queries through without modification', async () => {
    await connector.query('documents/search', { query: 'quarterly report' });

    const q = new URL(capturedUrl!).searchParams.get('q');
    expect(q).toContain("name contains 'quarterly report'");
  });

  it('uses empty string when query param is absent', async () => {
    await connector.query('documents/search', {});

    const q = new URL(capturedUrl!).searchParams.get('q');
    expect(q).toContain("name contains ''");
  });
});
