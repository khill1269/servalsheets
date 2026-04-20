import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Each test imports a fresh copy of the guard module so `installed` state
 * is reset between tests. We achieve this via `vi.resetModules()` plus a
 * dynamic import — this pattern works on vitest 4.x where the experimental
 * `vi.isolateModulesAsync` does not exist.
 */
async function freshGuardModule() {
  vi.resetModules();
  return (await import('../../src/utils/stdio-guard.js')) as typeof import('../../src/utils/stdio-guard.js');
}

describe('stdio-guard', () => {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalTransport = process.env['MCP_TRANSPORT'];
  const originalFlag = process.env['STDIO_GUARD'];

  beforeEach(() => {
    process.env['MCP_TRANSPORT'] = 'stdio';
    delete process.env['STDIO_GUARD'];
  });

  afterEach(() => {
    // Restore originals so later tests see an unmodified stdout/stderr.
    process.stdout.write = originalStdoutWrite as typeof process.stdout.write;
    process.stderr.write = originalStderrWrite as typeof process.stderr.write;
    if (originalTransport === undefined) delete process.env['MCP_TRANSPORT'];
    else process.env['MCP_TRANSPORT'] = originalTransport;
    if (originalFlag === undefined) delete process.env['STDIO_GUARD'];
    else process.env['STDIO_GUARD'] = originalFlag;
  });

  it('passes JSON frames through to stdout unchanged', async () => {
    const { installStdioGuard } = await freshGuardModule();
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    installStdioGuard();

    process.stdout.write('{"jsonrpc":"2.0","id":1}\n');

    // Guard forwards chunk + (encoding|cb) + cb — trailing args may be undefined.
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy.mock.calls[0]?.[0]).toBe('{"jsonrpc":"2.0","id":1}\n');
  });

  it('redirects non-JSON writes to stderr with [STDIO-GUARD] prefix', async () => {
    const { installStdioGuard } = await freshGuardModule();
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderrSpy = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    installStdioGuard();

    process.stdout.write('this is not JSON');

    // The guarded write should NOT forward to original stdout mock.
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('[STDIO-GUARD] non-JSON stdout write blocked: this is not JSON')
    );
  });

  it('is disabled when STDIO_GUARD=0', async () => {
    process.env['STDIO_GUARD'] = '0';
    const { installStdioGuard, __isStdioGuardInstalled } = await freshGuardModule();
    installStdioGuard();
    expect(__isStdioGuardInstalled()).toBe(false);
  });

  it('is idempotent — second install is a no-op', async () => {
    const { installStdioGuard, __isStdioGuardInstalled } = await freshGuardModule();
    installStdioGuard();
    const afterFirst = process.stdout.write;
    installStdioGuard();
    expect(__isStdioGuardInstalled()).toBe(true);
    expect(process.stdout.write).toBe(afterFirst);
  });

  it('passes through empty / whitespace-only writes (fast path)', async () => {
    const { installStdioGuard } = await freshGuardModule();
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    installStdioGuard();

    process.stdout.write('\n');
    process.stdout.write('');

    expect(stdoutSpy).toHaveBeenCalledTimes(2);
  });
});
