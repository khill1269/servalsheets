import type { Request, Response } from 'express';

type WebhookEventType = string;

interface DiffResultLike {
  tier: string;
  sheetChanges?: {
    sheetsAdded: Array<{ title: string }>;
    sheetsRemoved: Array<{ title: string }>;
    sheetsRenamed: Array<{ oldTitle: string; newTitle: string }>;
  };
  samples?: {
    firstRows: unknown[];
    lastRows: unknown[];
    randomRows: unknown[];
  };
  changes?: Array<{ type: string; cell: string }>;
}

interface WebhookRecordLike {
  webhookId: string;
  webhookUrl: string;
  spreadsheetId: string;
  channelId: string;
  resourceId: string;
  eventTypes: string[];
}

interface WebhookManagerLike {
  get(webhookId: string): Promise<WebhookRecordLike | null>;
  diffEngine: {
    captureState(spreadsheetId: string, options: { tier: 'SAMPLE' }): Promise<unknown>;
    compareStates(previousState: unknown, currentState: unknown): Promise<DiffResultLike>;
  };
  getCachedState(spreadsheetId: string): Promise<unknown>;
  cacheState(spreadsheetId: string, state: unknown): Promise<void>;
  recordEventStats(
    webhookId: string,
    detectedEventTypes: string[],
    matchedEventTypes: string[]
  ): Promise<void>;
  handleWorkspaceEvent(event: Record<string, unknown>): Promise<unknown>;
}

interface WebhookQueueLike {
  enqueue(job: unknown): Promise<unknown>;
}

interface FormulaCallbackModule {
  validateHmacSignature(body: string, spreadsheetId: string, signature: string): boolean;
  validateRequestTimestamp(timestamp: number): boolean;
  checkAndRecordReplay(spreadsheetId: string, signature: string): boolean;
  checkRateLimit(spreadsheetId: string): boolean;
  processBatchFormula(
    request: {
      requests: unknown[];
      spreadsheetId: string;
      timestamp: number;
    }
  ): Promise<unknown>;
}

export interface HttpWebhookRoutesLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface RegisterHttpWebhookRoutesOptions {
  readonly webhookMaxAttempts: number;
  readonly getWebhookManager: () => WebhookManagerLike | null;
  readonly getWebhookQueue: () => WebhookQueueLike | null;
  readonly loadFormulaCallbackModule: () => Promise<FormulaCallbackModule>;
  readonly log?: HttpWebhookRoutesLogger;
}

const defaultLogger: HttpWebhookRoutesLogger = {
  info(message: string, meta?: unknown) {
    console.info(message, meta);
  },
  warn(message: string, meta?: unknown) {
    console.warn(message, meta);
  },
  error(message: string, meta?: unknown) {
    console.error(message, meta);
  },
};

export function categorizeChanges(diff: DiffResultLike): WebhookEventType[] {
  const eventTypes = new Set<WebhookEventType>();

  if (diff.sheetChanges) {
    if (diff.sheetChanges.sheetsAdded.length > 0) {
      eventTypes.add('sheet.create');
    }
    if (diff.sheetChanges.sheetsRemoved.length > 0) {
      eventTypes.add('sheet.delete');
    }
    if (diff.sheetChanges.sheetsRenamed.length > 0) {
      eventTypes.add('sheet.rename');
    }
  }

  if (diff.tier === 'SAMPLE' && diff.samples) {
    const hasChanges =
      diff.samples.firstRows.length > 0 ||
      diff.samples.lastRows.length > 0 ||
      diff.samples.randomRows.length > 0;
    if (hasChanges) {
      eventTypes.add('cell.update');
    }
  } else if (diff.tier === 'FULL' && diff.changes) {
    if (diff.changes.length > 0) {
      const hasFormatChanges = diff.changes.some((c) => c.type === 'format');
      if (hasFormatChanges) {
        eventTypes.add('format.update');
      }
      eventTypes.add('cell.update');
    }
  }

  if (eventTypes.size === 0) {
    eventTypes.add('sheet.update');
  }

  return Array.from(eventTypes);
}

export function registerHttpWebhookRoutes(
  app: Pick<{ post(path: string, handler: (req: Request, res: Response) => unknown): void }, 'post'>,
  options: RegisterHttpWebhookRoutesOptions
): void {
  const {
    webhookMaxAttempts,
    getWebhookManager,
    getWebhookQueue,
    loadFormulaCallbackModule,
    log = defaultLogger,
  } = options;

  app.post('/webhook/drive-callback', async (req: Request, res: Response) => {
    try {
      const channelId = req.get('x-goog-channel-id');
      const resourceState = req.get('x-goog-resource-state');
      const resourceId = req.get('x-goog-resource-id');
      const channelToken = req.get('x-goog-channel-token');
      const messageNumberStr = req.get('x-goog-message-number');

      if (!channelId || !resourceState || !resourceId || !channelToken || !messageNumberStr) {
        log.warn('Invalid Drive webhook callback: missing headers', {
          headers: req.headers,
        });
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required webhook headers',
          },
        });
        return;
      }

      const messageNumber = parseInt(messageNumberStr, 10);
      if (isNaN(messageNumber)) {
        log.warn('Invalid Drive webhook callback: invalid message number', {
          messageNumber: messageNumberStr,
        });
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid message number',
          },
        });
        return;
      }

      if (resourceState === 'sync') {
        log.info('Drive webhook sync event acknowledged', { channelId });
        res.status(200).send('OK');
        return;
      }

      const webhookManager = getWebhookManager();
      if (!webhookManager) {
        log.error('Webhook manager not initialized');
        res.status(503).json({
          error: {
            code: 'SERVICE_NOT_INITIALIZED',
            message: 'Webhook manager not available',
          },
        });
        return;
      }

      const webhook = await webhookManager.get(channelToken);
      if (!webhook) {
        log.warn('Webhook not found for callback', { webhookId: channelToken });
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Webhook not found',
          },
        });
        return;
      }

      if (webhook.channelId !== channelId || webhook.resourceId !== resourceId) {
        log.warn('Webhook validation failed - ID mismatch', {
          webhookId: channelToken,
          headerChannelId: channelId,
          storedChannelId: webhook.channelId,
          headerResourceId: resourceId,
          storedResourceId: webhook.resourceId,
        });
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Unauthorized webhook - ID mismatch',
          },
        });
        return;
      }

      log.info('Webhook validation passed', {
        webhookId: channelToken,
        channelId,
        resourceId,
      });

      let detectedEventTypes: WebhookEventType[] = [];
      let changeDetails: Record<string, unknown> | undefined;

      try {
        const currentState = await webhookManager.diffEngine.captureState(webhook.spreadsheetId, {
          tier: 'SAMPLE',
        });
        const previousState = await webhookManager.getCachedState(webhook.spreadsheetId);

        if (previousState) {
          const diff = await webhookManager.diffEngine.compareStates(previousState, currentState);
          detectedEventTypes = categorizeChanges(diff);

          const cellRanges: string[] = [];
          if (diff.tier === 'FULL' && diff.changes && diff.changes.length > 0) {
            const cells = diff.changes.slice(0, 10).map((c) => c.cell);
            if (cells.length > 0) {
              cellRanges.push(cells.join(', '));
            }
          } else if (diff.tier === 'SAMPLE' && diff.samples) {
            const totalSamples =
              diff.samples.firstRows.length +
              diff.samples.lastRows.length +
              diff.samples.randomRows.length;
            if (totalSamples > 0) {
              cellRanges.push(`${totalSamples} cells changed (detected via sampling)`);
            }
          }

          if (diff.sheetChanges) {
            changeDetails = {
              sheetsAdded: diff.sheetChanges.sheetsAdded.map((s) => s.title),
              sheetsRemoved: diff.sheetChanges.sheetsRemoved.map((s) => s.title),
              sheetsRenamed: diff.sheetChanges.sheetsRenamed.map((s) => ({
                from: s.oldTitle,
                to: s.newTitle,
              })),
              cellRanges,
            };
          }

          log.info('Drive webhook changes detected', {
            webhookId: webhook.webhookId,
            spreadsheetId: webhook.spreadsheetId,
            detectedEventTypes,
            changeDetails,
          });
        } else {
          const eventTypeMap: Record<string, 'sheet.update' | 'sheet.delete'> = {
            update: 'sheet.update',
            trash: 'sheet.delete',
          };
          detectedEventTypes = [eventTypeMap[resourceState] || 'sheet.update'];

          log.info('Drive webhook no previous state - using fallback', {
            webhookId: webhook.webhookId,
            spreadsheetId: webhook.spreadsheetId,
            resourceState,
            eventType: detectedEventTypes[0],
          });
        }

        await webhookManager.cacheState(webhook.spreadsheetId, currentState);
      } catch (diffError) {
        log.warn('Failed to detect changes via DiffEngine - using fallback', {
          webhookId: webhook.webhookId,
          spreadsheetId: webhook.spreadsheetId,
          error: diffError instanceof Error ? diffError.message : String(diffError),
        });

        const eventTypeMap: Record<string, 'sheet.update' | 'sheet.delete'> = {
          update: 'sheet.update',
          trash: 'sheet.delete',
        };
        detectedEventTypes = [eventTypeMap[resourceState] || 'sheet.update'];
      }

      const matchedEventTypes = detectedEventTypes.filter(
        (eventType) => webhook.eventTypes.includes(eventType) || webhook.eventTypes.includes('all')
      );

      if (matchedEventTypes.length === 0) {
        log.info('Drive webhook events filtered out - no matching subscriptions', {
          webhookId: webhook.webhookId,
          spreadsheetId: webhook.spreadsheetId,
          detected: detectedEventTypes,
          subscribed: webhook.eventTypes,
        });

        res.status(200).send('OK');
        return;
      }

      const webhookQueue = getWebhookQueue();
      if (!webhookQueue) {
        log.error('Webhook queue not initialized');
        res.status(503).json({
          error: {
            code: 'SERVICE_NOT_INITIALIZED',
            message: 'Webhook queue not available',
          },
        });
        return;
      }

      for (const eventType of matchedEventTypes) {
        await webhookQueue.enqueue({
          webhookId: webhook.webhookId,
          webhookUrl: webhook.webhookUrl,
          eventType,
          payload: {
            channelId,
            resourceId,
            resourceState,
            spreadsheetId: webhook.spreadsheetId,
            messageNumber,
            timestamp: new Date().toISOString(),
            changeDetails,
          },
          secret: undefined,
          maxAttempts: webhookMaxAttempts,
          scheduledAt: Date.now(),
        });
      }

      await webhookManager.recordEventStats(
        webhook.webhookId,
        detectedEventTypes,
        matchedEventTypes
      );

      log.info('Drive webhook events enqueued', {
        webhookId: webhook.webhookId,
        spreadsheetId: webhook.spreadsheetId,
        eventTypes: matchedEventTypes,
        filteredOut: detectedEventTypes.length - matchedEventTypes.length,
      });

      res.status(200).send('OK');
    } catch (error) {
      log.error('Drive webhook callback error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process webhook callback',
        },
      });
    }
  });

  app.post('/webhook/workspace-events', (req: Request, res: Response) => {
    const event = req.body as Record<string, unknown>;
    const eventId =
      (event['id'] as string | undefined) ?? (event['messageId'] as string | undefined);
    log.info('Received Workspace Events push notification', { eventId });

    res.status(200).json({ received: true });

    void (async () => {
      try {
        const webhookManager = getWebhookManager();
        await webhookManager?.handleWorkspaceEvent(event);
      } catch (error) {
        log.warn('Workspace event processing skipped', {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  });

  app.post('/api/serval-formula', async (req: Request, res: Response) => {
    try {
      const body = JSON.stringify(req.body);
      const spreadsheetId = req.headers['x-serval-spreadsheetid'] as string;
      const signature = req.headers['x-serval-signature'] as string;

      if (!spreadsheetId || !signature) {
        res.status(401).json({ error: 'Missing authentication headers' });
        return;
      }

      const {
        validateHmacSignature,
        validateRequestTimestamp,
        checkAndRecordReplay,
        checkRateLimit,
        processBatchFormula,
      } = await loadFormulaCallbackModule();

      const batchRequest = req.body as {
        requests?: unknown;
        spreadsheetId?: unknown;
        timestamp?: unknown;
      };

      if (
        !batchRequest ||
        !Array.isArray(batchRequest.requests) ||
        typeof batchRequest.spreadsheetId !== 'string' ||
        typeof batchRequest.timestamp !== 'number'
      ) {
        res.status(400).json({ error: 'Invalid request payload' });
        return;
      }

      if (batchRequest.spreadsheetId !== spreadsheetId) {
        res.status(403).json({ error: 'Spreadsheet header mismatch' });
        return;
      }

      if (!validateRequestTimestamp(batchRequest.timestamp)) {
        res.status(401).json({ error: 'Stale or invalid request timestamp' });
        return;
      }

      if (!validateHmacSignature(body, spreadsheetId, signature)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      if (!checkAndRecordReplay(spreadsheetId, signature)) {
        res.status(409).json({ error: 'Replay request rejected' });
        return;
      }

      if (!checkRateLimit(spreadsheetId)) {
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
      }

      const results = await processBatchFormula(
        batchRequest as Parameters<typeof processBatchFormula>[0]
      );
      res.status(200).json({ results });
    } catch (err) {
      log.error('SERVAL formula callback error', { error: String(err) });
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
