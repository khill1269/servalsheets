import http from 'http';
import { afterEach, describe, expect, it } from 'vitest';
import {
  extractPortFromRedirectUri,
  startCallbackServer,
} from '../../src/utils/oauth-callback-server.js';

/**
 * Pick a random high port within the ephemeral range. Using randomised ports
 * avoids cross-test collisions on busy CI runners since the callback server
 * binds to a caller-supplied port (Google requires pre-registered redirect
 * URIs, so arbitrary port:0 isn't used in production).
 */
function pickPort(): number {
  return 30000 + Math.floor(Math.random() * 20000); // check-math-random-ok
}

/**
 * Poll until the server is accepting connections, then return.
 * startCallbackServer() resolves when the *OAuth callback* arrives, not when
 * the socket is bound — so callers must wait for the server to be ready
 * before sending test requests.
 *
 * All test servers are pinned to 127.0.0.1 (IPv4) so that this poller and
 * the DNS-rebinding test both connect on the same interface, avoiding the
 * macOS localhost→::1 (IPv6) vs 127.0.0.1 (IPv4) split.
 */
async function waitForPort(port: number, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: '/' }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(50, () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
    if (ready) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`oauth-callback-server did not bind to port ${port} within ${timeoutMs}ms`);
}

async function callUrl(url: string): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
    });
    req.on('error', reject);
  });
}

describe('oauth-callback-server', () => {
  const openServers: http.Server[] = [];

  afterEach(async () => {
    for (const s of openServers.splice(0)) {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  it('captures the authorization code on a valid callback', async () => {
    const port = pickPort();
    // Pin to 127.0.0.1 so both waitForPort and callUrl use the same interface.
    const serverPromise = startCallbackServer({ port, host: '127.0.0.1', timeout: 5000 });

    await waitForPort(port);

    const res = await callUrl(`http://127.0.0.1:${port}/callback?code=abc123&state=xyz`);
    expect(res.status).toBe(200);

    const result = await serverPromise;
    expect(result.code).toBe('abc123');
    expect(result.state).toBe('xyz');
  });

  it('surfaces the OAuth error code when the provider returns one', async () => {
    const port = pickPort();
    const serverPromise = startCallbackServer({ port, host: '127.0.0.1', timeout: 5000 });
    await waitForPort(port);

    const res = await callUrl(`http://127.0.0.1:${port}/callback?error=access_denied`);
    expect(res.status).toBe(400);

    const result = await serverPromise;
    expect(result.error).toBe('access_denied');
    expect(result.code).toBeUndefined();
  });

  it('rejects requests with invalid Host header (DNS-rebinding defense)', async () => {
    const port = pickPort();
    const serverPromise = startCallbackServer({ port, host: '127.0.0.1', timeout: 5000 });
    await waitForPort(port);

    // Send a request with a bogus Host header to simulate DNS rebinding.
    // The TCP connection targets 127.0.0.1 (a valid interface) but the
    // HTTP Host header is spoofed — the server must reject this with 400.
    const res = await new Promise<{ status: number }>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: '/callback?code=should_not_work',
          method: 'GET',
          headers: { Host: 'evil.example.com' },
        },
        (r) => {
          r.on('data', () => {});
          r.on('end', () => resolve({ status: r.statusCode ?? 0 }));
        }
      );
      req.on('error', reject);
      req.end();
    });

    expect(res.status).toBe(400);

    // Now deliver a valid callback so the server shuts down.
    await callUrl(`http://127.0.0.1:${port}/callback?code=ok`);
    const result = await serverPromise;
    expect(result.code).toBe('ok');
  });

  it('returns 404 for paths other than /callback', async () => {
    const port = pickPort();
    const serverPromise = startCallbackServer({ port, host: '127.0.0.1', timeout: 5000 });
    await waitForPort(port);

    const res = await callUrl(`http://127.0.0.1:${port}/other-path`);
    expect(res.status).toBe(404);

    // Deliver a valid callback so the server shuts down.
    await callUrl(`http://127.0.0.1:${port}/callback?code=final`);
    await serverPromise;
  });

  it('times out with a clear message when no callback arrives', async () => {
    const port = pickPort();
    await expect(startCallbackServer({ port, timeout: 200 })).rejects.toThrow(/timed out/i);
  });
});

describe('extractPortFromRedirectUri', () => {
  it('parses an explicit port from a redirect URI', () => {
    expect(extractPortFromRedirectUri('http://localhost:3456/callback')).toBe(3456);
  });
  it('defaults to 3000 when port is missing', () => {
    expect(extractPortFromRedirectUri('http://localhost/callback')).toBe(3000);
  });
  it('defaults to 3000 on malformed input', () => {
    expect(extractPortFromRedirectUri('not a url')).toBe(3000);
  });
});
