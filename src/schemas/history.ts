/**
 * Tool: sheets_history
 * Operation history tracking for debugging and undo foundation.
 */

import { z } from 'zod';
import { ErrorDetailSchema, ResponseMetaSchema, type ToolAnnotations } from './shared.js';

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsHistoryInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum(['list', 'get', 'stats', 'undo', 'redo', 'revert_to', 'clear'])
      .describe('The operation to perform on history'),

    // Fields for LIST action
    spreadsheetId: z
      .string()
      .optional()
      .describe('Filter by spreadsheet ID (list, undo, redo, clear)'),
    count: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Number of operations to return (default: 10) (list only)'),
    failuresOnly: z
      .boolean()
      .optional()
      .describe('Show only failed operations (default: false) (list only)'),

    // Pagination fields (MCP 2025-11-25 compliance)
    cursor: z
      .string()
      .optional()
      .describe('Opaque pagination cursor from previous response (list only)'),
    pageSize: z
      .number()
      .int()
      .positive()
      .max(1000)
      .optional()
      .describe('Maximum number of items per page (default: 100, max: 1000) (list only)'),

    // Fields for GET and REVERT_TO actions
    operationId: z
      .string()
      .min(1)
      .optional()
      .describe('Operation ID to retrieve or revert to (required for: get, revert_to)'),

    // ===== LLM OPTIMIZATION: VERBOSITY CONTROL =====
    verbosity: z
      .enum(['minimal', 'standard', 'detailed'])
      .optional()
      .default('standard')
      .describe(
        'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
      ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case 'get':
        case 'revert_to':
          return !!data.operationId;
        case 'undo':
        case 'redo':
          return !!data.spreadsheetId;
        case 'list':
        case 'stats':
        case 'clear':
          return true; // No required fields beyond action
        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );

const HistoryResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // list response
    operations: z
      .array(
        z.object({
          id: z.string(),
          tool: z.string(),
          action: z.string(),
          spreadsheetId: z.string().optional(),
          range: z.string().optional(),
          success: z.boolean(),
          duration: z.number(),
          timestamp: z.number(),
          error: z.string().optional(),
          snapshotId: z.string().optional(),
        })
      )
      .optional(),
    // Pagination (MCP 2025-11-25)
    nextCursor: z.string().optional().describe('Cursor for next page (null = no more data)'),
    hasMore: z.boolean().optional().describe('True if more history items available'),
    totalCount: z.number().int().optional().describe('Total number of history items'),
    // get response
    operation: z
      .object({
        id: z.string(),
        tool: z.string(),
        action: z.string(),
        params: z.record(z.string(), z.unknown()),
        result: z.unknown().optional(),
        spreadsheetId: z.string().optional(),
        range: z.string().optional(),
        success: z.boolean(),
        duration: z.number(),
        timestamp: z.number(),
        error: z.string().optional(),
        snapshotId: z.string().optional(),
      })
      .optional(),
    // stats response
    stats: z
      .object({
        totalOperations: z.number(),
        successfulOperations: z.number(),
        failedOperations: z.number(),
        successRate: z.number(),
        avgDuration: z.number(),
        operationsByTool: z.record(z.string(), z.number()),
        recentFailures: z.number(),
      })
      .optional(),
    // undo/redo/revert response
    restoredSpreadsheetId: z
      .string()
      .optional()
      .describe('ID of restored spreadsheet (for undo/redo/revert)'),
    operationRestored: z
      .object({
        id: z.string(),
        tool: z.string(),
        action: z.string(),
        timestamp: z.number(),
      })
      .optional()
      .describe('Details of operation that was undone/redone'),
    // clear response
    operationsCleared: z.number().optional().describe('Number of operations cleared'),
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
  title: 'Operation History & Undo',
  readOnlyHint: false, // undo/redo are write operations
  destructiveHint: false,
  idempotentHint: false, // undo/redo change state
  openWorldHint: false,
};

export type SheetsHistoryInput = z.infer<typeof SheetsHistoryInputSchema>;
export type SheetsHistoryOutput = z.infer<typeof SheetsHistoryOutputSchema>;

export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type HistoryListInput = SheetsHistoryInput & { action: 'list' };
export type HistoryGetInput = SheetsHistoryInput & {
  action: 'get';
  operationId: string;
};
export type HistoryStatsInput = SheetsHistoryInput & { action: 'stats' };
export type HistoryUndoInput = SheetsHistoryInput & {
  action: 'undo';
  spreadsheetId: string;
};
export type HistoryRedoInput = SheetsHistoryInput & {
  action: 'redo';
  spreadsheetId: string;
};
export type HistoryRevertToInput = SheetsHistoryInput & {
  action: 'revert_to';
  operationId: string;
};
export type HistoryClearInput = SheetsHistoryInput & { action: 'clear' };
