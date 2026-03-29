import { describe, expect, it } from 'vitest';

import { prepareStdioBootstrap } from '../../../packages/mcp-stdio/src/prepare-stdio-bootstrap.js';

describe('@serval/mcp-stdio prepareStdioBootstrap', () => {
  it('runs bootstrap steps in order', async () => {
    const calls: string[] = [];
    const options = { taskStore: undefined };

    await prepareStdioBootstrap(options, {
      warnIfDefaultCredentialsInHttpMode: () => calls.push('warn'),
      enforceProductionOAuthConfig: () => calls.push('oauth'),
      registerSamplingConsentGuard: () => calls.push('sampling'),
      ensureTaskStoreConfigured: async (received) => {
        calls.push('task-store');
        expect(received).toBe(options);
      },
      initializeCacheInfrastructure: async () => {
        calls.push('cache');
      },
    });

    expect(calls).toEqual(['warn', 'oauth', 'sampling', 'task-store', 'cache']);
  });
});
