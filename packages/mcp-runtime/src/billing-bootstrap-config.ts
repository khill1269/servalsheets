export interface BillingBootstrapEnv {
  readonly ENABLE_BILLING_INTEGRATION: boolean;
  readonly STRIPE_SECRET_KEY?: string;
  readonly STRIPE_WEBHOOK_SECRET?: string;
  readonly BILLING_CURRENCY?: string;
  readonly BILLING_CYCLE?: 'monthly' | 'annual';
  readonly BILLING_AUTO_INVOICING?: boolean;
}

export interface RuntimeBillingBootstrapConfig {
  readonly enabled: boolean;
  readonly stripeSecretKey?: string;
  readonly webhookSecret?: string;
  readonly currency?: string;
  readonly billingCycle?: 'monthly' | 'annual';
  readonly autoInvoicing?: boolean;
}

export function buildBillingBootstrapConfig(
  envConfig: BillingBootstrapEnv
): RuntimeBillingBootstrapConfig {
  return {
    enabled: envConfig.ENABLE_BILLING_INTEGRATION,
    stripeSecretKey: envConfig.STRIPE_SECRET_KEY,
    webhookSecret: envConfig.STRIPE_WEBHOOK_SECRET,
    currency: envConfig.BILLING_CURRENCY,
    billingCycle: envConfig.BILLING_CYCLE,
    autoInvoicing: envConfig.BILLING_AUTO_INVOICING,
  };
}
