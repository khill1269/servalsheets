/**
 * Tool 6: sheets_dimensions
 * Row and column operations
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  DimensionSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
  sheetId: SheetIdSchema,
});

const DestructiveBaseSchema = BaseSchema.extend({
  safety: SafetyOptionsSchema.optional(),
});

export const SheetsDimensionsInputSchema = z.discriminatedUnion('action', [
  // INSERT_ROWS
  BaseSchema.extend({
    action: z.literal('insert_rows'),
    startIndex: z.number().int().min(0),
    count: z.number().int().positive().optional().default(1),
    inheritFromBefore: z.boolean().optional().default(false),
  }),

  // INSERT_COLUMNS
  BaseSchema.extend({
    action: z.literal('insert_columns'),
    startIndex: z.number().int().min(0),
    count: z.number().int().positive().optional().default(1),
    inheritFromBefore: z.boolean().optional().default(false),
  }),

  // DELETE_ROWS
  DestructiveBaseSchema.extend({
    action: z.literal('delete_rows'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
    allowMissing: z.boolean().optional().default(false),
  }),

  // DELETE_COLUMNS
  DestructiveBaseSchema.extend({
    action: z.literal('delete_columns'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
    allowMissing: z.boolean().optional().default(false),
  }),

  // MOVE_ROWS
  DestructiveBaseSchema.extend({
    action: z.literal('move_rows'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
    destinationIndex: z.number().int().min(0),
  }),

  // MOVE_COLUMNS
  DestructiveBaseSchema.extend({
    action: z.literal('move_columns'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
    destinationIndex: z.number().int().min(0),
  }),

  // RESIZE_ROWS
  BaseSchema.extend({
    action: z.literal('resize_rows'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
    pixelSize: z.number().positive(),
  }),

  // RESIZE_COLUMNS
  BaseSchema.extend({
    action: z.literal('resize_columns'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
    pixelSize: z.number().positive(),
  }),

  // AUTO_RESIZE
  BaseSchema.extend({
    action: z.literal('auto_resize'),
    dimension: DimensionSchema,
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
  }),

  // HIDE_ROWS
  BaseSchema.extend({
    action: z.literal('hide_rows'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
  }),

  // HIDE_COLUMNS
  BaseSchema.extend({
    action: z.literal('hide_columns'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
  }),

  // SHOW_ROWS
  BaseSchema.extend({
    action: z.literal('show_rows'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
  }),

  // SHOW_COLUMNS
  BaseSchema.extend({
    action: z.literal('show_columns'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
  }),

  // FREEZE_ROWS
  BaseSchema.extend({
    action: z.literal('freeze_rows'),
    frozenRowCount: z.number().int().min(0),
  }),

  // FREEZE_COLUMNS
  BaseSchema.extend({
    action: z.literal('freeze_columns'),
    frozenColumnCount: z.number().int().min(0),
  }),

  // GROUP_ROWS
  BaseSchema.extend({
    action: z.literal('group_rows'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
    depth: z.number().int().min(1).max(8).optional().default(1),
  }),

  // GROUP_COLUMNS
  BaseSchema.extend({
    action: z.literal('group_columns'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
    depth: z.number().int().min(1).max(8).optional().default(1),
  }),

  // UNGROUP_ROWS
  BaseSchema.extend({
    action: z.literal('ungroup_rows'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
  }),

  // UNGROUP_COLUMNS
  BaseSchema.extend({
    action: z.literal('ungroup_columns'),
    startIndex: z.number().int().min(0),
    endIndex: z.number().int().min(1),
  }),

  // APPEND_ROWS
  BaseSchema.extend({
    action: z.literal('append_rows'),
    count: z.number().int().positive(),
  }),

  // APPEND_COLUMNS
  BaseSchema.extend({
    action: z.literal('append_columns'),
    count: z.number().int().positive(),
  }),
]);

export const SheetsDimensionsOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    rowsAffected: z.number().int().optional(),
    columnsAffected: z.number().int().optional(),
    newSize: z.object({
      rowCount: z.number().int(),
      columnCount: z.number().int(),
    }).optional(),
    alreadyMissing: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SHEETS_DIMENSIONS_ANNOTATIONS: ToolAnnotations = {
  title: 'Rows & Columns',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsDimensionsInput = z.infer<typeof SheetsDimensionsInputSchema>;
export type SheetsDimensionsOutput = z.infer<typeof SheetsDimensionsOutputSchema>;
