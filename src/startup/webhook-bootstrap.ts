import type { GoogleApiClient } from '../services/google-api.js';
import { initWebhookManager, resetWebhookManager } from '../services/webhook-manager.js';
import { initWebhookQueue, resetWebhookQueue } from '../services/webhook-queue.js';

export const DEFAULT_WEBHOOK_ENDPOINT = 'https://localhost:3000/webhook';

export interface InitializeWebhookBootstrapOptions {
  readonly googleClient: GoogleApiClient;
  readonly redisClient?: unknown | null;
  readonly webhookEndpoint?: string;
  readonly resetExisting?: boolean;
}

export function initializeWebhookBootstrap(options: InitializeWebhookBootstrapOptions): {
  webhookEndpoint: string;
} {
  const redisClient = options.redisClient ?? null;
  const webhookEndpoint =
    options.webhookEndpoint ?? process.env['WEBHOOK_ENDPOINT'] ?? DEFAULT_WEBHOOK_ENDPOINT;

  if (options.resetExisting) {
    resetWebhookQueue();
    resetWebhookManager();
  }

  initWebhookQueue(redisClient);
  initWebhookManager(redisClient, options.googleClient, webhookEndpoint);

  return { webhookEndpoint };
}
