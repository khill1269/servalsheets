/**
 * Tool 4: sheets_cells
 * Cell-level operations (notes, validation, hyperlinks)
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  ConditionSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const DataValidationSchema = z.object({
  condition: ConditionSchema,
  inputMessage: z.string().optional(),
  strict: z.boolean().optional().default(true),
  showDropdown: z.boolean().optional().default(true),
});

const CellsActionSchema = z.discriminatedUnion('action', [
  // ADD_NOTE
  BaseSchema.extend({
    action: z.literal('add_note'),
    cell: z.string(),
    note: z.string(),
  }),

  // GET_NOTE
  BaseSchema.extend({
    action: z.literal('get_note'),
    cell: z.string(),
  }),

  // CLEAR_NOTE
  BaseSchema.extend({
    action: z.literal('clear_note'),
    cell: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // SET_VALIDATION
  BaseSchema.extend({
    action: z.literal('set_validation'),
    range: RangeInputSchema,
    validation: DataValidationSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // CLEAR_VALIDATION
  BaseSchema.extend({
    action: z.literal('clear_validation'),
    range: RangeInputSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // SET_HYPERLINK
  BaseSchema.extend({
    action: z.literal('set_hyperlink'),
    cell: z.string(),
    url: z.string().url(),
    label: z.string().optional(),
  }),

  // CLEAR_HYPERLINK
  BaseSchema.extend({
    action: z.literal('clear_hyperlink'),
    cell: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // MERGE
  BaseSchema.extend({
    action: z.literal('merge'),
    range: RangeInputSchema,
    mergeType: z.enum(['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS']).optional().default('MERGE_ALL'),
  }),

  // UNMERGE
  BaseSchema.extend({
    action: z.literal('unmerge'),
    range: RangeInputSchema,
  }),

  // GET_MERGES
  BaseSchema.extend({
    action: z.literal('get_merges'),
    sheetId: SheetIdSchema,
  }),

  // CUT
  BaseSchema.extend({
    action: z.literal('cut'),
    source: RangeInputSchema,
    destination: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // COPY
  BaseSchema.extend({
    action: z.literal('copy'),
    source: RangeInputSchema,
    destination: z.string(),
    pasteType: z.enum([
      'PASTE_NORMAL', 'PASTE_VALUES', 'PASTE_FORMAT',
      'PASTE_NO_BORDERS', 'PASTE_FORMULA',
    ]).optional().default('PASTE_NORMAL'),
  }),
]);

export const SheetsCellsInputSchema = z.object({
  request: CellsActionSchema,
});

const CellsResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    note: z.string().optional(),
    merges: z.array(z.object({
      startRow: z.number().int(),
      endRow: z.number().int(),
      startColumn: z.number().int(),
      endColumn: z.number().int(),
    })).optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsCellsOutputSchema = z.object({
  response: CellsResponseSchema,
});

export const SHEETS_CELLS_ANNOTATIONS: ToolAnnotations = {
  title: 'Cell Operations',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsCellsInput = z.infer<typeof SheetsCellsInputSchema>;
export type SheetsCellsOutput = z.infer<typeof SheetsCellsOutputSchema>;
export type CellsAction = z.infer<typeof CellsActionSchema>;
export type CellsResponse = z.infer<typeof CellsResponseSchema>;
