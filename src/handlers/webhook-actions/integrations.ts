/**
 * Webhook integration actions: watch_changes, subscribe_workspace,
 * unsubscribe_workspace, list_workspace_subscriptions
 */

import { validateWebhookUrl, getWebhookManager } from '../../services/webhook-manager.js';
import type { SheetsWebhookInput } from '../../schemas/webhook.js';
import type { WebhookWatchChangesInput } from '../../schemas/webhook.js';
import type { WebhookResponse, WebhookHandlerAccess } from './internal.js';
import { ErrorCodes } from './internal.js';
import { logger } from '../../utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * Watch changes via Google Drive files.watch API.
 * Sets up push notifications when a spreadsheet file changes.
 * This is a native Google API feature (not custom webhooks).
 */
export async function handleWatchChanges(
  handler: WebhookHandlerAccess,
  input: WebhookWatchChangesInput
): Promise<WebhookResponse> {
  if (!handler.driveApi) {
    return {
      success: false,
      error: {
        code: ErrorCodes.CONFIG_ERROR,
        message: 'Drive API client not available. watch_changes requires Drive API access.',
        retryable: false,
        resolution: 'Ensure the server is initialized with Drive API scopes.',
      },
    };
  }

  try {
    const channelId = input.channelId ?? `servalsheets-${randomUUID()}`;
    const expiration = Date.now() + (input.expirationMs ?? 43200000);

    // SEC-5: SSRF protection — validate URL before passing to Drive API
    await validateWebhookUrl(input.webhookUrl);

    const response = await handler.driveApi.files.watch({
      fileId: input.spreadsheetId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: input.webhookUrl,
        expiration: String(expiration),
        token: channelId, // Required: echoed as X-Goog-Channel-Token header in callbacks
      },
    });

    const resourceId = response.data.resourceId ?? '';
    await getWebhookManager()?.storeWatchChannel(
      channelId,
      resourceId,
      input.spreadsheetId,
      input.webhookUrl,
      expiration
    );

    logger.info('Drive files.watch channel created', {
      channelId,
      spreadsheetId: input.spreadsheetId,
      resourceId: response.data.resourceId,
      expiration: new Date(expiration).toISOString(),
    });

    return {
      success: true,
      data: {
        success: true,
        message: 'Drive files.watch channel created successfully',
        channelId,
        resourceId: response.data.resourceId ?? '',
        expiration: new Date(expiration).toISOString(),
        spreadsheetId: input.spreadsheetId,
        webhookUrl: input.webhookUrl,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: handler.createErrorDetail(
        error,
        'Failed to create Drive watch channel',
        'watch_changes'
      ),
    };
  }
}

export async function handleSubscribeWorkspace(
  handler: WebhookHandlerAccess,
  req: Extract<SheetsWebhookInput['request'], { action: 'subscribe_workspace' }>
): Promise<WebhookResponse> {
  if (!handler.workspaceEventsService) {
    return {
      success: false as const,
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Workspace Events service not available',
        retryable: false,
      },
    };
  }
  const subscription = await handler.workspaceEventsService.createSubscription(
    req.spreadsheetId,
    req.notificationEndpoint
  );
  return {
    success: true as const,
    data: {
      success: true,
      message: `Subscription created: ${subscription.id}`,
      subscriptionId: subscription.id,
      subscription,
    },
  };
}

export async function handleUnsubscribeWorkspace(
  handler: WebhookHandlerAccess,
  req: Extract<SheetsWebhookInput['request'], { action: 'unsubscribe_workspace' }>
): Promise<WebhookResponse> {
  if (!handler.workspaceEventsService) {
    return {
      success: false as const,
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Workspace Events service not available',
        retryable: false,
      },
    };
  }
  await handler.workspaceEventsService.deleteSubscription(req.subscriptionId);
  return {
    success: true as const,
    data: {
      success: true,
      message: `Subscription deleted: ${req.subscriptionId}`,
    },
  };
}

export async function handleReactivateWorkspace(
  handler: WebhookHandlerAccess,
  req: Extract<SheetsWebhookInput['request'], { action: 'reactivate_workspace' }>
): Promise<WebhookResponse> {
  if (!handler.workspaceEventsService) {
    return {
      success: false as const,
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Workspace Events service not available',
        retryable: false,
      },
    };
  }

  const subscription = await handler.workspaceEventsService.reactivateSubscription(
    req.subscriptionId
  );
  return {
    success: true as const,
    data: {
      success: true,
      message: `Subscription reactivated: ${subscription.id}`,
      subscriptionId: subscription.id,
      subscription,
    },
  };
}

export async function handleListWorkspaceSubscriptions(
  handler: WebhookHandlerAccess,
  req: Extract<SheetsWebhookInput['request'], { action: 'list_workspace_subscriptions' }>
): Promise<WebhookResponse> {
  if (!handler.workspaceEventsService) {
    return {
      success: false as const,
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Workspace Events service not available',
        retryable: false,
      },
    };
  }
  const subs = handler.workspaceEventsService.listSubscriptions(req.spreadsheetId);
  return {
    success: true as const,
    data: {
      subscriptions: subs,
    },
  };
}
