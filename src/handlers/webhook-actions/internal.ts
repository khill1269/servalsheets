/**
 * Internal types shared across webhook-actions submodules.
 */

import type { SheetsWebhookInput, SheetsWebhookOutput } from '../../schemas/webhook.js';
import { ErrorCodes } from '../error-codes.js';
import { WEBHOOK_DURABILITY_MODE } from '../../services/webhook-manager.js';
import type { CircuitBreaker } from '../../utils/circuit-breaker.js';
import type { WorkspaceEventsService } from '../../services/workspace-events.js';
import type { drive_v3 } from 'googleapis';

export type WebhookResponse = SheetsWebhookOutput['response'];
export type ErrorResponse = Extract<WebhookResponse, { success: false }>['error'];

/** Access to WebhookHandler state needed by submodules */
export interface WebhookHandlerAccess {
  driveApi: drive_v3.Drive | undefined;
  deliveryCircuitBreaker: CircuitBreaker;
  workspaceEventsService: WorkspaceEventsService | undefined;
  createErrorDetail(error: unknown, fallbackMessage: string, action: string): ErrorResponse;
  createRedisUnavailableError(action: string): ErrorResponse;
}

/** Re-export for submodule convenience */
export { ErrorCodes, WEBHOOK_DURABILITY_MODE };
export type { SheetsWebhookInput, SheetsWebhookOutput };
