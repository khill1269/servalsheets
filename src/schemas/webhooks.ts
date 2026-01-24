/**
 * ServalSheets - Webhook Schemas
 *
 * Schemas for webhook registration, management, and delivery.
 * Supports Google Sheets push notifications via Watch API.
 *
 * @category Schemas
 */

import { z } from 'zod';

/**
 * Webhook actions
 */
export const WebhookActionsSchema = z.enum([
  'register',
  'unregister',
  'list',
  'get',
  'test',
  'get_stats',
]);

/**
 * Webhook event types (Google Sheets changes)
 */
export const WebhookEventTypeSchema = z.enum([
  'sheet.update', // Any change to spreadsheet
  'sheet.create', // New sheet created
  'sheet.delete', // Sheet deleted
  'sheet.rename', // Sheet renamed
  'cell.update', // Cell values changed
  'format.update', // Formatting changed
  'all', // All events
]);

/**
 * Webhook registration input
 */
export const WebhookRegisterInputSchema = z.object({
  action: z.literal('register'),
  spreadsheetId: z.string().min(1, 'Spreadsheet ID required'),
  webhookUrl: z.string().url('Must be a valid HTTPS URL').startsWith('https://'),
  eventTypes: z.array(WebhookEventTypeSchema).min(1, 'At least one event type required'),
  secret: z
    .string()
    .min(16, 'Secret must be at least 16 characters')
    .optional()
    .describe('Secret for HMAC signature verification'),
  expirationMs: z
    .number()
    .int()
    .positive()
    .max(2592000000) // 30 days max
    .optional()
    .default(604800000) // 7 days default
    .describe('Webhook expiration time in milliseconds'),
});

/**
 * Webhook unregister input
 */
export const WebhookUnregisterInputSchema = z.object({
  action: z.literal('unregister'),
  webhookId: z.string().min(1, 'Webhook ID required'),
});

/**
 * Webhook list input
 */
export const WebhookListInputSchema = z.object({
  action: z.literal('list'),
  spreadsheetId: z.string().optional().describe('Filter by spreadsheet ID'),
  active: z.boolean().optional().describe('Filter by active status'),
});

/**
 * Webhook get input
 */
export const WebhookGetInputSchema = z.object({
  action: z.literal('get'),
  webhookId: z.string().min(1, 'Webhook ID required'),
});

/**
 * Webhook test input (sends test payload)
 */
export const WebhookTestInputSchema = z.object({
  action: z.literal('test'),
  webhookId: z.string().min(1, 'Webhook ID required'),
});

/**
 * Webhook stats input
 */
export const WebhookStatsInputSchema = z.object({
  action: z.literal('get_stats'),
  webhookId: z.string().optional().describe('Get stats for specific webhook'),
});

/**
 * Webhook input (discriminated union)
 */
export const SheetsWebhookInputSchema = z.discriminatedUnion('action', [
  WebhookRegisterInputSchema,
  WebhookUnregisterInputSchema,
  WebhookListInputSchema,
  WebhookGetInputSchema,
  WebhookTestInputSchema,
  WebhookStatsInputSchema,
]);

/**
 * Webhook registration response
 */
export const WebhookRegisterResponseSchema = z.object({
  webhookId: z.string(),
  spreadsheetId: z.string(),
  webhookUrl: z.string(),
  eventTypes: z.array(WebhookEventTypeSchema),
  resourceId: z.string().describe('Google Watch API resource ID'),
  channelId: z.string().describe('Google Watch API channel ID'),
  expiresAt: z.string().describe('ISO 8601 timestamp'),
  active: z.boolean(),
  secret: z.string().optional().describe('Webhook secret (only returned on registration)'),
});

/**
 * Webhook info
 */
export const WebhookInfoSchema = z.object({
  webhookId: z.string(),
  spreadsheetId: z.string(),
  webhookUrl: z.string(),
  eventTypes: z.array(WebhookEventTypeSchema),
  resourceId: z.string(),
  channelId: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  active: z.boolean(),
  deliveryCount: z.number().int(),
  failureCount: z.number().int(),
  lastDelivery: z.string().optional(),
  lastFailure: z.string().optional(),
});

/**
 * Webhook delivery attempt
 */
export const WebhookDeliverySchema = z.object({
  deliveryId: z.string(),
  webhookId: z.string(),
  timestamp: z.string(),
  eventType: WebhookEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(['pending', 'success', 'failed', 'retrying']),
  statusCode: z.number().int().optional(),
  error: z.string().optional(),
  attemptCount: z.number().int(),
  nextRetryAt: z.string().optional(),
});

/**
 * Webhook stats
 */
export const WebhookStatsSchema = z.object({
  totalWebhooks: z.number().int(),
  activeWebhooks: z.number().int(),
  totalDeliveries: z.number().int(),
  successfulDeliveries: z.number().int(),
  failedDeliveries: z.number().int(),
  pendingDeliveries: z.number().int(),
  averageDeliveryTimeMs: z.number(),
  webhookStats: z
    .array(
      z.object({
        webhookId: z.string(),
        deliveryCount: z.number().int(),
        successRate: z.number(),
        averageLatencyMs: z.number(),
      })
    )
    .optional(),
});

/**
 * Webhook output response
 */
export const SheetsWebhookOutputSchema = z.union([
  z.object({
    success: z.literal(true),
    data: z.union([
      WebhookRegisterResponseSchema,
      z.object({ success: z.boolean(), message: z.string() }),
      z.object({ webhooks: z.array(WebhookInfoSchema) }),
      z.object({ webhook: WebhookInfoSchema }),
      z.object({ delivery: WebhookDeliverySchema }),
      WebhookStatsSchema,
    ]),
  }),
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
]);

/**
 * Tool annotations for sheets_webhook
 */
export const SHEETS_WEBHOOK_ANNOTATIONS = {
  title: 'Webhook Management',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

// Type exports
export type WebhookActions = z.infer<typeof WebhookActionsSchema>;
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;
export type SheetsWebhookInput = z.infer<typeof SheetsWebhookInputSchema>;
export type WebhookRegisterInput = z.infer<typeof WebhookRegisterInputSchema>;
export type WebhookUnregisterInput = z.infer<typeof WebhookUnregisterInputSchema>;
export type WebhookListInput = z.infer<typeof WebhookListInputSchema>;
export type WebhookGetInput = z.infer<typeof WebhookGetInputSchema>;
export type WebhookTestInput = z.infer<typeof WebhookTestInputSchema>;
export type WebhookStatsInput = z.infer<typeof WebhookStatsInputSchema>;
export type WebhookRegisterResponse = z.infer<typeof WebhookRegisterResponseSchema>;
export type WebhookInfo = z.infer<typeof WebhookInfoSchema>;
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;
export type WebhookStats = z.infer<typeof WebhookStatsSchema>;
export type SheetsWebhookOutput = z.infer<typeof SheetsWebhookOutputSchema>;
