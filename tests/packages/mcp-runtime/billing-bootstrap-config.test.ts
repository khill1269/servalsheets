import { describe, expect, it } from 'vitest';

import { buildBillingBootstrapConfig } from '../../../packages/mcp-runtime/src/index.js';

describe('@serval/mcp-runtime billing bootstrap config', () => {
  it('maps billing env fields into runtime bootstrap config', () => {
    const result = buildBillingBootstrapConfig({
      ENABLE_BILLING_INTEGRATION: true,
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_123',
      BILLING_CURRENCY: 'usd',
      BILLING_CYCLE: 'annual',
      BILLING_AUTO_INVOICING: false,
    });

    expect(result).toEqual({
      enabled: true,
      stripeSecretKey: 'sk_test_123',
      webhookSecret: 'whsec_123',
      currency: 'usd',
      billingCycle: 'annual',
      autoInvoicing: false,
    });
  });

  it('preserves undefined optional fields', () => {
    const result = buildBillingBootstrapConfig({
      ENABLE_BILLING_INTEGRATION: false,
    });

    expect(result).toEqual({
      enabled: false,
      stripeSecretKey: undefined,
      webhookSecret: undefined,
      currency: undefined,
      billingCycle: undefined,
      autoInvoicing: undefined,
    });
  });
});
