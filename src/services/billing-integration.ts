/**
 * Billing Integration Service
 *
 * Stripe integration for subscription management
 */

import Stripe from 'stripe';

export interface BillingConfig {
  stripeSecretKey: string;
}

export class BillingIntegration {
  private stripe: Stripe;

  constructor(config: BillingConfig) {
    this.stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }
}