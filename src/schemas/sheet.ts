/**
 * Tool 2: sheets_sheet
 * Sheet/tab operations
 * MCP Protocol: 2025-11-25
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  SheetInfoSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ColorSchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

export const SheetsSheetInputSchema = z.discriminatedUnion('action', [
  // ADD
  BaseSchema.extend({
    action: z.literal('add'),
    title: z.string().min(1).max(255),
    index: z.number().int().min(0).optional(),
    rowCount: z.number().int().positive().optional().default(1000),
    columnCount: z.number().int().positive().optional().default(26),
    tabColor: ColorSchema.optional(),
    hidden: z.boolean().optional().default(false),
  }),

  // DELETE
  BaseSchema.extend({
    action: z.literal('delete'),
    sheetId: SheetIdSchema,
    /** If true, don't error when sheet doesn't exist (makes delete idempotent) */
    allowMissing: z.boolean().optional().default(false),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DUPLICATE
  BaseSchema.extend({
    action: z.literal('duplicate'),
    sheetId: SheetIdSchema,
    newTitle: z.string().optional(),
    insertIndex: z.number().int().min(0).optional(),
  }),

  // UPDATE
  BaseSchema.extend({
    action: z.literal('update'),
    sheetId: SheetIdSchema,
    title: z.string().min(1).max(255).optional(),
    index: z.number().int().min(0).optional(),
    hidden: z.boolean().optional(),
    tabColor: ColorSchema.optional(),
    rightToLeft: z.boolean().optional(),
  }),

  // COPY_TO
  BaseSchema.extend({
    action: z.literal('copy_to'),
    sheetId: SheetIdSchema,
    destinationSpreadsheetId: SpreadsheetIdSchema,
  }),

  // LIST
  BaseSchema.extend({
    action: z.literal('list'),
  }),

  // GET
  BaseSchema.extend({
    action: z.literal('get'),
    sheetId: SheetIdSchema,
  }),
]);

export const SheetsSheetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    sheet: SheetInfoSchema.optional(),
    sheets: z.array(SheetInfoSchema).optional(),
    copiedSheetId: z.number().int().optional(),
    /** True if delete was called but sheet was already missing (with allowMissing=true) */
    alreadyDeleted: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

/**
 * Tool annotations for MCP protocol
 * 
 * Note: idempotentHint is false because:
 * - delete: fails on second call unless allowMissing=true
 * - add: creates new sheet each time (different sheetId)
 * - duplicate: creates new sheet each time
 * Only 'update', 'list', 'get' are truly idempotent
 */
export const SHEETS_SHEET_ANNOTATIONS: ToolAnnotations = {
  title: 'Sheet Management',
  readOnlyHint: false,
  destructiveHint: true,  // delete action is destructive
  idempotentHint: false,  // delete without allowMissing fails on repeat
  openWorldHint: true,
};

export type SheetsSheetInput = z.infer<typeof SheetsSheetInputSchema>;
export type SheetsSheetOutput = z.infer<typeof SheetsSheetOutputSchema>;
