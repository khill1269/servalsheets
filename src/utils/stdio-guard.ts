/**
 * ServalSheets - Stdio Guard
 *
 * In MCP stdio transport mode, the ONLY valid content on stdout is framed
 * JSON-RPC messages. Any other bytes (stray writes, subprocess leak, library
 * banners) corrupt the protocol stream and cause the client to terminate
 * the session as malformed.
 *
 * This guard wraps `process.stdout.write` so that any chunk not starting
 * with `{` or `[` is redirected to stderr with a `[STDIO-GUARD]` prefix
 * instead of hitting stdout. That converts a silent protocol-corruption
 * class of bug into a loud, observable warning.
 *
 * Activation:
 *   - Enabled by default in stdio mode (MCP_TRANSPORT=stdio or unset).
 *   - Disabled when STDIO_GUARD=0 or running under HTTP/SSE transport.
 *
 * Idempotent: calling installStdioGuard() more than once is a no-op.
 *
 * MCP Protocol: 2025-11-25
 */

let installed = false;

function isStdioMode(): boolean {
  // Mirrors the detection used by src/utils/base-logger.ts to stay consistent.
  const transport = process.env['MCP_TRANSPORT'];
  return transport === 'stdio' || !transport;
}

function isGuardEnabled(): boolean {
  const flag = process.env['STDIO_GUARD'];
  if (flag === '0' || flag === 'false') return false;
  return isStdioMode();
}

/**
 * Install the stdout guard. Safe to call multiple times — subsequent calls
 * are no-ops. Must be called as early as possible during bootstrap.
 */
export function installStdioGuard(): void {
  if (installed) return;
  if (!isGuardEnabled()) return;
  installed = true;

  const originalWrite = process.stdout.write.bind(process.stdout);

  // Match any chunk whose first non-whitespace character is `{` or `[`.
  // JSON-RPC messages always start with one of these (object or array).
  function looksLikeJsonFrame(s: string): boolean {
    // Fast path: empty / whitespace-only chunks pass through (e.g. final "\n").
    if (s.length === 0) return true;
    const trimmed = s.trimStart();
    if (trimmed.length === 0) return true;
    const first = trimmed.charCodeAt(0);
    // 0x7B = '{', 0x5B = '['
    return first === 0x7b || first === 0x5b;
  }

  const guarded = function (
    this: NodeJS.WriteStream,
    chunk: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error | null) => void),
    cb?: (err?: Error | null) => void
  ): boolean {
    const asString =
      typeof chunk === 'string'
        ? chunk
        : Buffer.isBuffer(chunk)
          ? chunk.toString('utf8')
          : Buffer.from(chunk).toString('utf8');

    if (looksLikeJsonFrame(asString)) {
      // Preserve original call signature (encoding may be string or callback).
      if (typeof encodingOrCb === 'function') {
        return originalWrite(chunk, encodingOrCb);
      }
      return originalWrite(chunk, encodingOrCb, cb);
    }

    // Non-JSON on stdout — redirect to stderr with a prefix so the operator
    // can see who was about to corrupt the protocol. Truncate long payloads
    // to keep log noise bounded.
    const preview =
      asString.length > 500
        ? `${asString.slice(0, 500)}…(truncated ${asString.length} bytes)`
        : asString;
    const suffix = preview.endsWith('\n') ? '' : '\n';
    process.stderr.write(`[STDIO-GUARD] non-JSON stdout write blocked: ${preview}${suffix}`);

    // Honor the callback so async writers don't hang.
    if (typeof encodingOrCb === 'function') {
      encodingOrCb(null);
    } else if (typeof cb === 'function') {
      cb(null);
    }
    return true;
  };

  // Preserve the `write` typing that callers (including the SDK) rely on.
  process.stdout.write = guarded as typeof process.stdout.write;
}

/**
 * Test-only: check whether the guard is currently installed.
 * Not part of the public API.
 */
export function __isStdioGuardInstalled(): boolean {
  return installed;
}
