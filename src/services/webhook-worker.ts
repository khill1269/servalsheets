/**
 * ServalSheets - Webhook Delivery Worker
 *
 * Background worker that processes webhook delivery jobs from the queue.
 * Handles HTTP delivery with retry logic and HMAC signature verification.
 *
 * Features:
 * - Concurrent delivery processing (configurable workers)
 * - HMAC-SHA256 signature for webhook security
 * - Timeout handling (default: 10 seconds)
 * - Graceful shutdown
 *
 * @category Services
 */

import { createHmac } from 'crypto';
import { logger } from '../utils/logger.js';
import { getWebhookQueue, type WebhookDeliveryJob } from './webhook-queue.js';
import { getWebhookManager } from './webhook-manager.js';

/**
 * Webhook worker configuration
 */
export interface WebhookWorkerConfig {
  /** Number of concurrent workers (default: 2) */
  concurrency: number;
  /** Request timeout in ms (default: 10000 = 10 seconds) */
  timeoutMs: number;
  /** Poll interval when queue is empty (default: 1000 = 1 second) */
  pollIntervalMs: number;
}

/**
 * Webhook Delivery Worker
 *
 * Processes webhook deliveries from the queue.
 */
export class WebhookWorker {
  private config: WebhookWorkerConfig;
  private running: boolean = false;
  private workers: Promise<void>[] = [];

  constructor(config?: Partial<WebhookWorkerConfig>) {
    this.config = {
      concurrency: config?.concurrency ?? 2,
      timeoutMs: config?.timeoutMs ?? 10000,
      pollIntervalMs: config?.pollIntervalMs ?? 1000,
    };

    logger.info('Webhook worker initialized', {
      config: this.config,
    });
  }

  /**
   * Start webhook workers
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Webhook worker already running');
      return;
    }

    this.running = true;

    // Start concurrent workers
    for (let i = 0; i < this.config.concurrency; i++) {
      const workerPromise = this.runWorker(i);
      this.workers.push(workerPromise);
    }

    logger.info('Webhook workers started', {
      concurrency: this.config.concurrency,
    });
  }

  /**
   * Stop webhook workers
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    logger.info('Stopping webhook workers...');
    this.running = false;

    // Wait for all workers to finish
    await Promise.all(this.workers);
    this.workers = [];

    logger.info('Webhook workers stopped');
  }

  /**
   * Worker loop
   */
  private async runWorker(workerId: number): Promise<void> {
    logger.debug('Webhook worker started', { workerId });

    while (this.running) {
      try {
        // Dequeue next job
        const queue = getWebhookQueue();
        const job = await queue.dequeue();

        if (!job) {
          // Queue empty, wait before polling again
          await this.sleep(this.config.pollIntervalMs);
          continue;
        }

        // Process delivery
        await this.processDelivery(job, workerId);
      } catch (error) {
        logger.error('Worker error', { workerId, error });
        await this.sleep(1000); // Backoff on error
      }
    }

    logger.debug('Webhook worker stopped', { workerId });
  }

  /**
   * Process a webhook delivery
   */
  private async processDelivery(job: WebhookDeliveryJob, workerId: number): Promise<void> {
    const startTime = Date.now();

    logger.debug('Processing webhook delivery', {
      workerId,
      deliveryId: job.deliveryId,
      webhookId: job.webhookId,
      attemptCount: job.attemptCount + 1,
      maxAttempts: job.maxAttempts,
    });

    try {
      // Build payload
      const payload = {
        deliveryId: job.deliveryId,
        webhookId: job.webhookId,
        eventType: job.eventType,
        timestamp: new Date().toISOString(),
        data: job.payload,
      };

      // Calculate HMAC signature (if secret provided)
      const payloadStr = JSON.stringify(payload);
      const signature = job.secret
        ? createHmac('sha256', job.secret).update(payloadStr).digest('hex')
        : undefined;

      // Send HTTP POST request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await fetch(job.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ServalSheets-Webhook/1.0',
            'X-Webhook-Signature': signature ? `sha256=${signature}` : 'none',
            'X-Webhook-Delivery': job.deliveryId,
            'X-Webhook-Event': job.eventType,
          },
          body: payloadStr,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;

        if (response.ok) {
          // Success
          const queue = getWebhookQueue();
          await queue.markSuccess(job);

          // Update webhook stats
          const manager = getWebhookManager();
          await manager.recordDelivery(job.webhookId, true);

          logger.info('Webhook delivered successfully', {
            workerId,
            deliveryId: job.deliveryId,
            webhookId: job.webhookId,
            statusCode: response.status,
            durationMs: duration,
            attemptCount: job.attemptCount + 1,
          });
        } else {
          // HTTP error
          const errorText = await response.text().catch(() => 'Unknown error');
          const error = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;

          const queue = getWebhookQueue();
          await queue.markFailure(job, error);

          // Update webhook stats
          const manager = getWebhookManager();
          await manager.recordDelivery(job.webhookId, false);

          logger.warn('Webhook delivery failed', {
            workerId,
            deliveryId: job.deliveryId,
            webhookId: job.webhookId,
            statusCode: response.status,
            error,
            attemptCount: job.attemptCount + 1,
            willRetry: job.attemptCount + 1 < job.maxAttempts,
          });
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Network or timeout error
        const error = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';

        const queue = getWebhookQueue();
        await queue.markFailure(job, error);

        // Update webhook stats
        const manager = getWebhookManager();
        await manager.recordDelivery(job.webhookId, false);

        logger.warn('Webhook delivery failed (network error)', {
          workerId,
          deliveryId: job.deliveryId,
          webhookId: job.webhookId,
          error,
          attemptCount: job.attemptCount + 1,
          willRetry: job.attemptCount + 1 < job.maxAttempts,
        });
      }
    } catch (error) {
      logger.error('Failed to process webhook delivery', {
        workerId,
        deliveryId: job.deliveryId,
        webhookId: job.webhookId,
        error,
      });

      // Mark as failed
      const queue = getWebhookQueue();
      await queue.markFailure(job, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Singleton webhook worker instance
 */
let webhookWorker: WebhookWorker | null = null;

/**
 * Initialize webhook worker
 */
export function initWebhookWorker(config?: Partial<WebhookWorkerConfig>): void {
  if (webhookWorker) {
    logger.warn('Webhook worker already initialized');
    return;
  }

  webhookWorker = new WebhookWorker(config);
  logger.info('Webhook worker singleton initialized');
}

/**
 * Get webhook worker instance
 */
export function getWebhookWorker(): WebhookWorker {
  if (!webhookWorker) {
    throw new Error('Webhook worker not initialized');
  }
  return webhookWorker;
}

/**
 * Reset webhook worker (for testing)
 */
export function resetWebhookWorker(): void {
  webhookWorker = null;
  logger.debug('Webhook worker reset');
}

/**
 * Start webhook worker (convenience function)
 */
export async function startWebhookWorker(): Promise<void> {
  const worker = getWebhookWorker();
  await worker.start();
}

/**
 * Stop webhook worker (convenience function)
 */
export async function stopWebhookWorker(): Promise<void> {
  const worker = getWebhookWorker();
  await worker.stop();
}
