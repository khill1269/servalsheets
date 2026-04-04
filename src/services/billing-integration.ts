/**
 * Billing Integration Service
 *
 * Stripe v22 integration for subscription and invoice management.
 * Handles customer account linking, subscription lifecycle, and invoice webhooks.
 *
 * MCP Protocol: 2025-11-25
 */

import Stripe from 'stripe';
import { EventEmitter } from 'eventemitter3';
import { logger } from '../utils/logger.js';
import type { RequestContext } from '../types/request-context.js';
import { ErrorCode } from '../schemas/shared.js';

export interface BillingBootstrapConfig {
  enabled: boolean;
  stripeSecretKey?: string;
}

export interface CustomerInfo {
  customerId: string;
  email: string;
  name?: string;
  metadata: Record<string, string>;
}

export interface SubscriptionInfo {
  subscriptionId: string;
  customerId: string;
  status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'trialing';
  plan: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt?: Date;
}

export interface InvoiceInfo {
  invoiceId: string;
  customerId: string;
  subscriptionId?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amount: number;
  currency: string;
  dueDate?: Date;
  paidAt?: Date;
}

export class BillingIntegrationService extends EventEmitter {
  private stripeClient: Stripe | null;
  private config: BillingBootstrapConfig;

  constructor(config: BillingBootstrapConfig) {
    super();
    this.config = config;
    this.stripeClient = null;

    if (config.enabled && config.stripeSecretKey) {
      try {
        this.stripeClient = new Stripe(config.stripeSecretKey, {
          apiVersion: '2026-03-25.dahlia',
        });
        logger.info('Billing service initialized with Stripe v22');
      } catch (error) {
        logger.error('Failed to initialize Stripe client', { error });
      }
    }
  }

  /**
   * Check if billing service is operational
   */
  isOperational(): boolean {
    return this.config.enabled && this.stripeClient !== null;
  }

  /**
   * Create or retrieve a customer
   */
  async getOrCreateCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<CustomerInfo> {
    if (!this.stripeClient) {
      throw new Error('Billing service not initialized', { code: ErrorCode.BILLING_NOT_AVAILABLE });
    }

    try {
      // Search for existing customer
      const customers = await this.stripeClient.customers.list({ email, limit: 1 });

      if (customers.data.length > 0) {
        const customer = customers.data[0];
        return {
          customerId: customer.id,
          email: customer.email || email,
          name: customer.name || name,
          metadata: customer.metadata || {},
        };
      }

      // Create new customer
      const customer = await this.stripeClient.customers.create({
        email,
        name,
        metadata,
      });

      return {
        customerId: customer.id,
        email: customer.email || email,
        name: customer.name,
        metadata: customer.metadata || {},
      };
    } catch (error) {
      logger.error('Failed to get or create customer', { error, email });
      throw error;
    }
  }

  /**
   * Get subscription information
   */
  async getSubscription(subscriptionId: string): Promise<SubscriptionInfo | null> {
    if (!this.stripeClient) {
      return null;
    }

    try {
      const subscription = await this.stripeClient.subscriptions.retrieve(subscriptionId);

      // Access subscription period from the first item
      const firstItem = subscription.items.data[0];
      if (!firstItem) {
        logger.warn('Subscription has no items', { subscriptionId });
        return null;
      }

      return {
        subscriptionId: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status as SubscriptionInfo['status'],
        plan: firstItem.price.nickname || firstItem.price.id,
        currentPeriodStart: new Date(firstItem.current_period_start * 1000),
        currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to retrieve subscription', { error, subscriptionId });
      return null;
    }
  }

  /**
   * Create a subscription for a customer
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>
  ): Promise<SubscriptionInfo> {
    if (!this.stripeClient) {
      throw new Error('Billing service not initialized', { code: ErrorCode.BILLING_NOT_AVAILABLE });
    }

    try {
      const subscription = await this.stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata,
      });

      const firstItem = subscription.items.data[0];
      if (!firstItem) {
        throw new Error('Subscription created without items');
      }

      return {
        subscriptionId: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status as SubscriptionInfo['status'],
        plan: firstItem.price.nickname || firstItem.price.id,
        currentPeriodStart: new Date(firstItem.current_period_start * 1000),
        currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
      };
    } catch (error) {
      logger.error('Failed to create subscription', { error, customerId, priceId });
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<SubscriptionInfo> {
    if (!this.stripeClient) {
      throw new Error('Billing service not initialized', { code: ErrorCode.BILLING_NOT_AVAILABLE });
    }

    try {
      const subscription = await this.stripeClient.subscriptions.del(subscriptionId);

      const firstItem = subscription.items.data[0];
      if (!firstItem) {
        throw new Error('Subscription has no items');
      }

      return {
        subscriptionId: subscription.id,
        customerId: subscription.customer as string,
        status: subscription.status as SubscriptionInfo['status'],
        plan: firstItem.price.nickname || firstItem.price.id,
        currentPeriodStart: new Date(firstItem.current_period_start * 1000),
        currentPeriodEnd: new Date(firstItem.current_period_end * 1000),
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to cancel subscription', { error, subscriptionId });
      throw error;
    }
  }

  /**
   * Get invoices for a customer
   */
  async getInvoices(customerId: string, limit: number = 20): Promise<InvoiceInfo[]> {
    if (!this.stripeClient) {
      return [];
    }

    try {
      const invoices = await this.stripeClient.invoices.list({ customer: customerId, limit });

      return invoices.data.map((invoice) => ({
        invoiceId: invoice.id,
        customerId: invoice.customer as string,
        subscriptionId: invoice.subscription as string | undefined,
        status: invoice.status as InvoiceInfo['status'],
        amount: invoice.amount_due,
        currency: invoice.currency,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
        paidAt: invoice.paid_at ? new Date(invoice.paid_at * 1000) : undefined,
      }));
    } catch (error) {
      logger.error('Failed to retrieve invoices', { error, customerId });
      return [];
    }
  }

  /**
   * Get a specific invoice
   */
  async getInvoice(invoiceId: string): Promise<InvoiceInfo | null> {
    if (!this.stripeClient) {
      return null;
    }

    try {
      const invoice = await this.stripeClient.invoices.retrieve(invoiceId);

      return {
        invoiceId: invoice.id,
        customerId: invoice.customer as string,
        subscriptionId: invoice.subscription as string | undefined,
        status: invoice.status as InvoiceInfo['status'],
        amount: invoice.amount_due,
        currency: invoice.currency,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
        paidAt: invoice.paid_at ? new Date(invoice.paid_at * 1000) : undefined,
      };
    } catch (error) {
      logger.error('Failed to retrieve invoice', { error, invoiceId });
      return null;
    }
  }

  /**
   * Handle webhook event for invoice.paid
   */
  async handleInvoicePaid(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (invoice) {
      logger.info('Invoice paid', { invoiceId, customerId: invoice.customerId });
      this.emit('invoice.paid', invoice);
    }
  }

  /**
   * Handle webhook event for invoice.payment_failed
   */
  async handleInvoicePaymentFailed(invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(invoiceId);
    if (invoice) {
      logger.warn('Invoice payment failed', { invoiceId, customerId: invoice.customerId });
      this.emit('invoice.payment_failed', invoice);
    }
  }

  /**
   * Handle webhook event for customer.subscription.updated
   */
  async handleSubscriptionUpdated(subscriptionId: string): Promise<void> {
    const subscription = await this.getSubscription(subscriptionId);
    if (subscription) {
      logger.info('Subscription updated', { subscriptionId, customerId: subscription.customerId });
      this.emit('subscription.updated', subscription);
    }
  }

  /**
   * Handle webhook event for customer.subscription.deleted
   */
  async handleSubscriptionDeleted(subscriptionId: string): Promise<void> {
    logger.info('Subscription deleted', { subscriptionId });
    this.emit('subscription.deleted', subscriptionId);
  }

  /**
   * Get billing status for a customer
   */
  async getBillingStatus(
    customerId: string
  ): Promise<{ subscription?: SubscriptionInfo; invoices: InvoiceInfo[] }> {
    if (!this.stripeClient) {
      return { invoices: [] };
    }

    try {
      const subscriptions = await this.stripeClient.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: 'all',
      });

      const invoices = await this.getInvoices(customerId, 10);

      if (subscriptions.data.length > 0) {
        const subscription = await this.getSubscription(subscriptions.data[0].id);
        return { subscription: subscription || undefined, invoices };
      }

      return { invoices };
    } catch (error) {
      logger.error('Failed to get billing status', { error, customerId });
      return { invoices: [] };
    }
  }
}
