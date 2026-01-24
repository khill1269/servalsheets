/**
 * Tool: sheets_history
 * Operation history tracking for debugging and undo foundation.
 */
import { z } from 'zod';
import { ErrorDetailSchema, ResponseMetaSchema } from './shared.js';
// ============================================================================
// Common Schemas
// ============================================================================
const CommonFieldsSchema = z.object({
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'),
});
// ============================================================================
// Individual Action Schemas
// ============================================================================
const ListActionSchema = CommonFieldsSchema.extend({
    action: z.literal('list').describe('List operation history'),
    spreadsheetId: z
        .string()
        .min(1, 'Spreadsheet ID cannot be empty')
        .optional()
        .describe('Filter by spreadsheet ID (omit to show all)'),
    count: z
        .number()
        .int()
        .positive()
        .optional()
        .default(10)
        .describe('Number of operations to return (default: 10)'),
    failuresOnly: z
        .boolean()
        .optional()
        .default(false)
        .describe('Show only failed operations (default: false)'),
    cursor: z.string().optional().describe('Opaque pagination cursor from previous response'),
    pageSize: z
        .number()
        .int()
        .positive()
        .max(1000)
        .optional()
        .default(100)
        .describe('Maximum number of items per page (default: 100, max: 1000)'),
});
const GetActionSchema = CommonFieldsSchema.extend({
    action: z.literal('get').describe('Get details of a specific operation'),
    operationId: z.string().min(1).describe('Operation ID to retrieve'),
});
const StatsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('stats').describe('Get operation history statistics'),
});
const UndoActionSchema = CommonFieldsSchema.extend({
    action: z.literal('undo').describe('Undo the last operation on a spreadsheet'),
    spreadsheetId: z
        .string()
        .min(1, 'Spreadsheet ID cannot be empty')
        .describe('Spreadsheet ID from URL'),
});
const RedoActionSchema = CommonFieldsSchema.extend({
    action: z.literal('redo').describe('Redo the last undone operation on a spreadsheet'),
    spreadsheetId: z
        .string()
        .min(1, 'Spreadsheet ID cannot be empty')
        .describe('Spreadsheet ID from URL'),
});
const RevertToActionSchema = CommonFieldsSchema.extend({
    action: z.literal('revert_to').describe('Revert to a specific operation in history'),
    operationId: z.string().min(1).describe('Operation ID to revert to'),
});
const ClearActionSchema = CommonFieldsSchema.extend({
    action: z.literal('clear').describe('Clear operation history'),
    spreadsheetId: z
        .string()
        .min(1, 'Spreadsheet ID cannot be empty')
        .optional()
        .describe('Filter by spreadsheet ID (omit to clear all history)'),
});
// ============================================================================
// Combined Input Schema
// ============================================================================
/**
 * All history operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsHistoryInputSchema = z.object({
    request: z.discriminatedUnion('action', [
        ListActionSchema,
        GetActionSchema,
        StatsActionSchema,
        UndoActionSchema,
        RedoActionSchema,
        RevertToActionSchema,
        ClearActionSchema,
    ]),
});
const HistoryResponseSchema = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        action: z.string(),
        // list response
        operations: z
            .array(z.object({
            id: z.string(),
            tool: z.string(),
            action: z.string(),
            spreadsheetId: z.string().optional(),
            range: z.string().optional(),
            success: z.boolean(),
            duration: z.coerce.number(),
            timestamp: z.coerce.number(),
            error: z.string().optional(),
            snapshotId: z.string().optional(),
        }))
            .optional(),
        // Pagination (MCP 2025-11-25)
        nextCursor: z.string().optional().describe('Cursor for next page (null = no more data)'),
        hasMore: z.boolean().optional().describe('True if more history items available'),
        totalCount: z.coerce.number().int().optional().describe('Total number of history items'),
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
            duration: z.coerce.number(),
            timestamp: z.coerce.number(),
            error: z.string().optional(),
            snapshotId: z.string().optional(),
        })
            .optional(),
        // stats response
        stats: z
            .object({
            totalOperations: z.coerce.number(),
            successfulOperations: z.coerce.number(),
            failedOperations: z.coerce.number(),
            successRate: z.coerce.number(),
            avgDuration: z.coerce.number(),
            operationsByTool: z.record(z.string(), z.coerce.number()),
            recentFailures: z.coerce.number(),
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
            timestamp: z.coerce.number(),
        })
            .optional()
            .describe('Details of operation that was undone/redone'),
        // clear response
        operationsCleared: z.coerce.number().optional().describe('Number of operations cleared'),
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
export const SHEETS_HISTORY_ANNOTATIONS = {
    title: 'Operation History & Undo',
    readOnlyHint: false, // undo/redo are write operations
    destructiveHint: false,
    idempotentHint: false, // undo/redo change state
    openWorldHint: false,
};
//# sourceMappingURL=history.js.map