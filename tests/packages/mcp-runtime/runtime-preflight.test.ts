import { describe, expect, it, vi } from 'vitest';

import { prepareRuntimePreflight } from '../../../packages/mcp-runtime/src/index.js';

describe('@serval/mcp-runtime runtime preflight', () => {
  it('loads env, validates the catalog, and computes cost tracking', () => {
    const loadEnv = vi.fn(() => ({
      ENABLE_COST_TRACKING: false,
      ENABLE_BILLING_INTEGRATION: true,
      NODE_ENV: 'test',
    }));
    const validateToolCatalogConfiguration = vi.fn();

    const result = prepareRuntimePreflight({
      loadEnv,
      validateToolCatalogConfiguration,
    });

    expect(loadEnv).toHaveBeenCalledTimes(1);
    expect(validateToolCatalogConfiguration).toHaveBeenCalledTimes(1);
    expect(result.envConfig.NODE_ENV).toBe('test');
    expect(result.costTrackingEnabled).toBe(true);
  });

  it('supports skipping tool-catalog validation when the caller does not need it', () => {
    const result = prepareRuntimePreflight({
      loadEnv: () => ({
        ENABLE_COST_TRACKING: false,
        ENABLE_BILLING_INTEGRATION: false,
      }),
    });

    expect(result.costTrackingEnabled).toBe(false);
  });
});
