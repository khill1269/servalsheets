/**
 * Shared schemas used across all tools
 */

import { z } from 'zod';

// Error codes (source of truth)
export const ErrorCodeSchema = z.enum([
  'INVALID_SPREADSHEET_ID',
  'INVALID_SHEET_NAME',
  'INVALID_RANGE',
  'SHEET_NOT_FOUND',
  'RANGE_NOT_FOUND',
  'INSUFFICIENT_PERMISSIONS',
  'QUOTA_EXCEEDED',
  'RATE_LIMIT_EXCEEDED',
  'INVALID_REQUEST',
  'INTERNAL_ERROR',
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'INVALID_VALUE',
  'TIMEOUT',
  'CONNECTION_ERROR',
  'PARSING_ERROR',
  'VALIDATION_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'SESSION_ERROR',
  'TRANSACTION_ERROR',
  'OPERATION_CANCELLED',
  'OPERATION_NOT_SUPPORTED',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

// Common error response
export const ErrorDetailSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.record(z.any()).optional(),
  timestamp: z.string().datetime().optional(),
  traceId: z.string().optional(),
});

export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

// Response metadata
export const ResponseMetaSchema = z.object({
  executionTimeMs: z.number().int().nonnegative().optional(),
  apiCalls: z.number().int().nonnegative().optional(),
  quotaCost: z.number().int().nonnegative().optional(),
  cached: z.boolean().optional(),
  warning: z.string().optional(),
  traceId: z.string().optional(),
});

export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

// Common input schemas
export const A1NotationSchema = z.string().regex(/^'?[A-Za-z]+[0-9]+('[A-Za-z]+[0-9]+)?$/, 'Invalid A1 notation');
export const RangeInputSchema = z.object({
  spreadsheetId: z.string().optional(),
  range: z.string(),
});

export const SafetyOptionsSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  snapshot: z.boolean().optional().default(true),
  confirmDestructive: z.boolean().optional().default(true),
});

export type SafetyOptions = z.infer<typeof SafetyOptionsSchema>;

// Tool annotations (MCP)
export interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}
