import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import Stripe from 'stripe';
import type { RuntimeBillingBootstrapConfig } from '../../packages/mcp-runtime/dist/billing-bootstrap-config.js';

export interface BillingCustomer {
  tenantId: string;
  customerId: string;
  status: 'active' | 'inactive' | 'cancelled';
  currentPlan: string;
  monthlySpend: number;
  lastBilledDate: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  plan: string;
  status: 'active' | 'past_due' | 'cancelled';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelledAt?: number;
}

export class BillingIntegration extends EventEmitter {
  private stripe: Stripe;
  private cache: LRUCache<string, BillingCustomer>;
  private customerCache: Map<string, string> = new Map(); // tenantId -> customerId

  constructor(apiKey: string) {
    super();
    this.stripe = new Stripe(apiKey);
    this.cache = new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
    });
  }

  async getCustomer(tenantId: string): Promise<BillingCustomer | null> {
    // Check cache first
    const cached = this.cache.get(tenantId);
    if (cached) return cached;

    // Lookup customer
    const customerId = this.customerCache.get(tenantId);
    if (!customerId) return null;

    try {
      const customerResult = await this.stripe.customers.retrieve(customerId);
      const customer = customerResult as Stripe.Customer;
      const result: BillingCustomer = {
        tenantId,
        customerId: customer.id,
        status: customer.deleted ? 'inactive' : 'active',
        currentPlan: this.getPlanFromCustomer(customer),
        monthlySpend: this.getMonthlySpend(customer),
        lastBilledDate: new Date().toISOString(),
      };

      this.cache.set(tenantId, result);
      return result;
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  async createCustomer(tenantId: string, email: string, name: string): Promise<BillingCustomer> {
    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: { tenantId },
    });

    this.customerCache.set(tenantId, customer.id);

    const result: BillingCustomer = {
      tenantId,
      customerId: customer.id,
      status: 'active',
      currentPlan: 'free',
      monthlySpend: 0,
      lastBilledDate: new Date().toISOString(),
    };

    this.cache.set(tenantId, result);
    return result;
  }

  async createSubscription(customerId: string, planId: string): Promise<Subscription> {
    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: planId }],
    });

    return {
      id: subscription.id,
      customerId: subscription.customer as string,
      plan: planId,
      status: subscription.status as 'active' | 'past_due' | 'cancelled',
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
    };
  }

  async generateInvoice(customerId: string): Promise<string> {
    const invoice = await this.stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
    });
    return invoice.id;
  }

  async listInvoices(_tenantId: string, _limit: number = 10): Promise<unknown[]> {
    // Stub: would fetch invoices from Stripe for the given tenant
    return [];
  }

  private getPlanFromCustomer(customer: Stripe.Customer): string {
    // Extract plan from customer metadata or subscriptions
    return customer.metadata?.['plan'] || 'free';
  }

  private getMonthlySpend(customer: Stripe.Customer): number {
    // Calculate from invoices or subscription price
    return 0; // Placeholder
  }
}

let _billingInstance: BillingIntegration | null = null;

/**
 * Initialize the billing integration singleton
 */
export function initializeBillingIntegration(
  config: RuntimeBillingBootstrapConfig
): BillingIntegration | null {
  if (!config.enabled || !config.stripeSecretKey) return null;
  _billingInstance = new BillingIntegration(config.stripeSecretKey);
  return _billingInstance;
}

/**
 * Get the billing integration singleton
 */
export function getBillingIntegration(): BillingIntegration | null {
  return _billingInstance;
}
