/**
 * Tool 3: sheets_values
 * Cell value operations (read/write)
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  ValuesArraySchema,
  RangeInputSchema,
  ValueRenderOptionSchema,
  ValueInputOptionSchema,
  InsertDataOptionSchema,
  MajorDimensionSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

export const SheetsValuesInputSchema = z.discriminatedUnion('action', [
  // READ
  BaseSchema.extend({
    action: z.literal('read'),
    range: RangeInputSchema,
    valueRenderOption: ValueRenderOptionSchema.optional(),
    majorDimension: MajorDimensionSchema.optional(),
  }),

  // WRITE (idempotent - set exact values)
  BaseSchema.extend({
    action: z.literal('write'),
    range: RangeInputSchema,
    values: ValuesArraySchema,
    valueInputOption: ValueInputOptionSchema.optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // APPEND (NOT idempotent - adds rows)
  BaseSchema.extend({
    action: z.literal('append'),
    range: RangeInputSchema,
    values: ValuesArraySchema,
    valueInputOption: ValueInputOptionSchema.optional(),
    insertDataOption: InsertDataOptionSchema.optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // CLEAR
  BaseSchema.extend({
    action: z.literal('clear'),
    range: RangeInputSchema,
    safety: SafetyOptionsSchema.optional(),
  }),

  // BATCH_READ
  BaseSchema.extend({
    action: z.literal('batch_read'),
    ranges: z.array(RangeInputSchema).min(1).max(100),
    valueRenderOption: ValueRenderOptionSchema.optional(),
    majorDimension: MajorDimensionSchema.optional(),
  }),

  // BATCH_WRITE
  BaseSchema.extend({
    action: z.literal('batch_write'),
    data: z.array(z.object({
      range: RangeInputSchema,
      values: ValuesArraySchema,
    })).min(1).max(100),
    valueInputOption: ValueInputOptionSchema.optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // BATCH_CLEAR
  BaseSchema.extend({
    action: z.literal('batch_clear'),
    ranges: z.array(RangeInputSchema).min(1).max(100),
    safety: SafetyOptionsSchema.optional(),
  }),

  // FIND
  BaseSchema.extend({
    action: z.literal('find'),
    range: RangeInputSchema.optional(),
    query: z.string(),
    matchCase: z.boolean().optional().default(false),
    matchEntireCell: z.boolean().optional().default(false),
    includeFormulas: z.boolean().optional().default(false),
    limit: z.number().int().positive().optional().default(100),
  }),

  // REPLACE
  BaseSchema.extend({
    action: z.literal('replace'),
    range: RangeInputSchema.optional(),
    find: z.string(),
    replacement: z.string(),
    matchCase: z.boolean().optional().default(false),
    matchEntireCell: z.boolean().optional().default(false),
    safety: SafetyOptionsSchema.optional(),
  }),
]);

export const SheetsValuesOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Read results
    values: ValuesArraySchema.optional(),
    range: z.string().optional(),
    majorDimension: z.string().optional(),
    // Batch read
    valueRanges: z.array(z.object({
      range: z.string(),
      values: ValuesArraySchema.optional(),
    })).optional(),
    // Write results
    updatedCells: z.number().int().optional(),
    updatedRows: z.number().int().optional(),
    updatedColumns: z.number().int().optional(),
    updatedRange: z.string().optional(),
    // Find results
    matches: z.array(z.object({
      cell: z.string(),
      value: z.string(),
      row: z.number().int(),
      column: z.number().int(),
    })).optional(),
    // Replace results
    replacementsCount: z.number().int().optional(),
    // Large data
    truncated: z.boolean().optional(),
    resourceUri: z.string().optional(),
    // Safety
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SHEETS_VALUES_ANNOTATIONS: ToolAnnotations = {
  title: 'Cell Values',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false, // append is not
  openWorldHint: true,
};

export type SheetsValuesInput = z.infer<typeof SheetsValuesInputSchema>;
export type SheetsValuesOutput = z.infer<typeof SheetsValuesOutputSchema>;
