import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DEGRADED_STARTUP_PATTERNS,
  getProcessBreadcrumbs,
  shouldAllowDegradedStartup,
} from '../../../packages/mcp-runtime/src/index.js';

describe('@serval/mcp-runtime runtime diagnostics', () => {
  it('builds process breadcrumbs with memory stats and extra fields', () => {
    const breadcrumbs = getProcessBreadcrumbs({
      resourcesRegistered: true,
    }) as {
      pid: number;
      uptimeSeconds: number;
      memory: Record<string, number>;
      resourcesRegistered: boolean;
    };

    expect(breadcrumbs.pid).toBeTypeOf('number');
    expect(breadcrumbs.uptimeSeconds).toBeTypeOf('number');
    expect(breadcrumbs.memory['rssMb']).toBeTypeOf('number');
    expect(breadcrumbs.memory['heapUsedMb']).toBeTypeOf('number');
    expect(breadcrumbs.resourcesRegistered).toBe(true);
  });

  it('allows degraded startup in stdio mode for auth errors', () => {
    const authMatcher = vi.fn(() => true);

    const allowed = shouldAllowDegradedStartup(new Error('boom'), {
      transport: 'stdio',
      isAuthError: authMatcher,
    });

    expect(allowed).toBe(true);
    expect(authMatcher).toHaveBeenCalledTimes(1);
  });

  it('allows degraded startup when known credential/network patterns match', () => {
    const allowed = shouldAllowDegradedStartup(new Error('Could not load the default credentials'), {
      transport: 'stdio',
    });

    expect(allowed).toBe(true);
  });

  it('rejects degraded startup outside stdio/test/explicit mode', () => {
    const allowed = shouldAllowDegradedStartup(new Error('google auth failed'), {
      transport: 'http',
      nodeEnv: 'production',
      allowDegradedExplicitly: false,
    });

    expect(allowed).toBe(false);
  });

  it('exposes the default degraded-startup pattern list', () => {
    expect(DEFAULT_DEGRADED_STARTUP_PATTERNS).toContain('oauth');
    expect(DEFAULT_DEGRADED_STARTUP_PATTERNS).toContain('invalid_grant');
  });
});
