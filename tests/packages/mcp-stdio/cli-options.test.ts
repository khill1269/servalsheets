import { describe, expect, it } from 'vitest';

import { parseCliCommand } from '../../../packages/mcp-stdio/src/cli-options.js';

describe('@serval/mcp-stdio parseCliCommand', () => {
  it('parses stdio and auth flags', () => {
    expect(
      parseCliCommand([
        '--service-account',
        './credentials.json',
        '--access-token',
        'token-value',
        '--stdio',
      ])
    ).toEqual({
      kind: 'run',
      options: {
        serviceAccountKeyPath: './credentials.json',
        accessToken: 'token-value',
        transport: 'stdio',
      },
    });
  });

  it('parses http transport and port', () => {
    expect(parseCliCommand(['--http', '--port', '8080'])).toEqual({
      kind: 'run',
      options: {
        transport: 'http',
        port: 8080,
      },
    });
  });

  it('returns command variants for init, help, and version', () => {
    expect(parseCliCommand(['init'])).toEqual({ kind: 'init' });
    expect(parseCliCommand(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliCommand(['-v'])).toEqual({ kind: 'version' });
  });
});
