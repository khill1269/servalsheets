/**
 * Tool: sheets_history
 * Operation history tracking for debugging and undo foundation.
 */

import { z } from 'zod';
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

const HistoryActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    spreadsheetId: z.string().optional().describe('Filter by spreadsheet ID'),
    count: z.number().int().positive().optional().describe('Number of operations to return (default: 10)'),
    failuresOnly: z.boolean().optional().describe('Show only failed operations (default: false)'),
  }),
  z.object({
    action: z.literal('get'),
    operationId: z.string().min(1).describe('Operation ID to retrieve'),
  }),
  z.object({
    action: z.literal('stats'),
  }),
]);

export const SheetsHistoryInputSchema = z.object({
  request: HistoryActionSchema,
});

const HistoryResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // list response
    operations: z.array(z.object({
      id: z.string(),
      tool: z.string(),
      action: z.string(),
      spreadsheetId: z.string().optional(),
      range: z.string().optional(),
      success: z.boolean(),
      duration: z.number(),
      timestamp: z.number(),
      error: z.string().optional(),
    })).optional(),
    // get response
    operation: z.object({
      id: z.string(),
      tool: z.string(),
      action: z.string(),
      params: z.record(z.unknown()),
      result: z.unknown().optional(),
      spreadsheetId: z.string().optional(),
      range: z.string().optional(),
      success: z.boolean(),
      duration: z.number(),
      timestamp: z.number(),
      error: z.string().optional(),
    }).optional(),
    // stats response
    stats: z.object({
      totalOperations: z.number(),
      successfulOperations: z.number(),
      failedOperations: z.number(),
      successRate: z.number(),
      avgDuration: z.number(),
      operationsByTool: z.record(z.number()),
      recentFailures: z.number(),
    }).optional(),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsHistoryOutputSchema = z.object({
  response: HistoryResponseSchema,
});

export const SHEETS_HISTORY_ANNOTATIONS: ToolAnnotations = {
  title: 'Operation History',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export type SheetsHistoryInput = z.infer<typeof SheetsHistoryInputSchema>;
export type SheetsHistoryOutput = z.infer<typeof SheetsHistoryOutputSchema>;
export type HistoryAction = z.infer<typeof HistoryActionSchema>;
export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;
