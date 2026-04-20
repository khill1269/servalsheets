/**
 * ServalSheets - OAuth Callback Server
 *
 * Temporary HTTP server for capturing OAuth callbacks in STDIO mode.
 * Starts on-demand, captures the authorization code, and auto-closes.
 *
 * Improvements over the original v1 implementation (ISSUE: oauth-port-conflicts):
 *   - AbortSignal support for cancellation from the caller.
 *   - Port-fallback list so a busy port doesn't fail the entire flow.
 *   - EADDRINUSE is surfaced with a targeted, actionable error message
 *     instead of a generic "Failed to start" string.
 *   - Deterministic cleanup: every exit path (success, error, timeout, abort)
 *     routes through `finalize()` which closes the server and clears the
 *     timeout exactly once.
 *
 * Google OAuth desktop app redirect URIs must be pre-registered in the
 * Google Cloud Console, so we cannot pick an arbitrary ephemeral port —
 * callers supply a candidate list they've registered. Dynamic port:0 is
 * still supported for local tests that don't round-trip through Google.
 */

import http from 'http';
import { URL } from 'url';
import { logger } from './logger.js';

export interface CallbackServerOptions {
  /** Primary port to listen on. Defaults to 3000. */
  port?: number;
  /**
   * Additional ports to try if `port` fails with EADDRINUSE. Useful when the
   * OAuth client has multiple redirect URIs registered. Probed in order.
   */
  fallbackPorts?: number[];
  /** Listen host. Defaults to localhost. */
  host?: string;
  /** Timeout after which the server rejects with a timeout error. Defaults to 2min. */
  timeout?: number;
  /** Caller-supplied abort signal for cooperative cancellation. */
  signal?: AbortSignal;
}

export interface CallbackResult {
  code?: string;
  error?: string;
  state?: string;
  /** Port the server actually bound to (useful when fallback ports were tried). */
  boundPort?: number;
}

function isAddressInUseError(err: unknown): err is NodeJS.ErrnoException {
  return (
    typeof err === 'object' && err !== null && (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
  );
}

async function bindServer(server: http.Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      const addr = server.address();
      const boundPort = typeof addr === 'object' && addr !== null ? addr.port : port;
      resolve(boundPort);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

/**
 * Start a temporary HTTP server to capture OAuth callback.
 * Returns the authorization code when received, the OAuth error if the
 * provider signalled one, or rejects on timeout / unrecoverable bind error.
 */
export async function startCallbackServer(
  options: CallbackServerOptions = {}
): Promise<CallbackResult> {
  const primaryPort = options.port ?? 3000;
  const host = options.host ?? 'localhost';
  const timeout = options.timeout ?? 120000; // 2 minutes default
  const signal = options.signal;
  const candidatePorts = [primaryPort, ...(options.fallbackPorts ?? [])];

  if (signal?.aborted) {
    const reason = signal.reason instanceof Error ? signal.reason.message : 'aborted';
    throw new Error(`OAuth callback aborted before start: ${reason}`);
  }

  let settled = false;
  let boundPort = primaryPort;

  return new Promise<CallbackResult>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;
    let abortListener: (() => void) | undefined;

    // Build allowlist later once the bound port is known (covers fallback).
    let allowedHosts = new Set<string>();

    const server = http.createServer((req, res) => {
      if (settled) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Already processed</h1></body></html>');
        return;
      }

      // DNS-rebinding protection: reject requests with unexpected Host headers
      const requestHost = req.headers.host ?? '';
      if (!allowedHosts.has(requestHost)) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request: invalid Host header');
        return;
      }

      // Parse the callback URL
      const reqUrl = new URL(req.url || '/', `http://${host}:${boundPort}`);

      // Only handle /callback path
      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>404 - Not Found</h1></body></html>');
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');
      const state = reqUrl.searchParams.get('state');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(errorPage(error));
        finalize({ error, state: state || undefined, boundPort });
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(successPage());
        finalize({ code, state: state || undefined, boundPort });
        return;
      }

      // No code or error
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(invalidCallbackPage());
      finalize({ error: 'no_code', boundPort });
    });

    function finalize(result: CallbackResult | Error): void {
      if (settled) return;
      settled = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      if (abortListener && signal) {
        signal.removeEventListener('abort', abortListener);
        abortListener = undefined;
      }

      // Close the server. The close callback runs after in-flight responses
      // have been flushed, so we resolve inside it to prevent handle leaks.
      server.close(() => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      });

      // Safety net: if close() stalls (rare, but possible with hung sockets),
      // forcefully resolve/reject after a short grace period so the caller
      // doesn't hang forever.
      setTimeout(() => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      }, 2000).unref();
    }

    // Wire abort signal.
    if (signal) {
      abortListener = () => {
        const reason = signal.reason instanceof Error ? signal.reason.message : 'aborted';
        finalize(new Error(`OAuth callback aborted: ${reason}`));
      };
      signal.addEventListener('abort', abortListener, { once: true });
    }

    // Timeout.
    timeoutId = setTimeout(() => {
      finalize(new Error(`OAuth callback timed out after ${timeout}ms`));
    }, timeout);

    // Bind with port fallback. Runs asynchronously so we can surface
    // EADDRINUSE with context instead of a bare "listen" error.
    (async () => {
      const attemptedErrors: string[] = [];
      for (const candidate of candidatePorts) {
        try {
          boundPort = await bindServer(server, host, candidate);
          allowedHosts = new Set([
            `localhost:${boundPort}`,
            `127.0.0.1:${boundPort}`,
            `[::1]:${boundPort}`,
            'localhost',
            '127.0.0.1',
          ]);
          logger.info(`OAuth callback server listening on http://${host}:${boundPort}/callback`);
          return;
        } catch (err) {
          if (isAddressInUseError(err)) {
            attemptedErrors.push(`:${candidate} in use`);
            logger.warn(`OAuth callback: port ${candidate} in use, trying fallback`, {
              candidate,
              error: err.message,
            });
            continue;
          }
          finalize(
            new Error(
              `Failed to start callback server on port ${candidate}: ${(err as Error).message}`
            )
          );
          return;
        }
      }

      finalize(
        new Error(
          `Failed to start OAuth callback server. All candidate ports unavailable: ${attemptedErrors.join(
            ', '
          )}. ` + `Close the process occupying them or register additional redirect URIs.`
        )
      );
    })();
  });
}

/**
 * Extract port from redirect URI
 */
export function extractPortFromRedirectUri(redirectUri: string): number {
  try {
    const url = new URL(redirectUri);
    const port = parseInt(url.port, 10);
    return port || 3000;
  } catch {
    return 3000;
  }
}

// ---------------------------------------------------------------------------
// HTML response bodies — extracted to dedicated functions so the request
// handler stays readable and the string templates can be edited in isolation.
// ---------------------------------------------------------------------------

function errorPage(error: string): string {
  return `
    <html>
      <head>
        <title>Authentication Failed</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
          h1 { color: #d32f2f; }
          .error { background: #ffebee; border: 1px solid #d32f2f; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .code { background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; }
        </style>
      </head>
      <body>
        <h1>Authentication Failed</h1>
        <div class="error">
          <strong>Error:</strong> ${escapeHtml(error)}
        </div>
        <p>You can close this window and try again.</p>
      </body>
    </html>
  `;
}

function successPage(): string {
  return `
    <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
          h1 { color: #2e7d32; }
          .success { background: #e8f5e9; border: 1px solid #2e7d32; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .info { color: #666; font-size: 14px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1>Authentication Successful</h1>
        <div class="success">
          <p><strong>You're all set!</strong></p>
          <p>ServalSheets can now access your Google Sheets.</p>
        </div>
        <p class="info">You can close this window and return to Claude.</p>
        <script>
          setTimeout(() => { window.close(); }, 3000);
        </script>
      </body>
    </html>
  `;
}

function invalidCallbackPage(): string {
  return `
    <html>
      <head>
        <title>Invalid Callback</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
          h1 { color: #f57c00; }
        </style>
      </head>
      <body>
        <h1>Invalid Callback</h1>
        <p>No authorization code received.</p>
        <p>Please close this window and try again.</p>
      </body>
    </html>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
