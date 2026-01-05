/**
 * Tool 3: sheets_values
 * Cell value operations (read/write)
 *
 * SCHEMA PATTERN: Top-level z.object() with union inside 'request' property
 * This pattern is durable across MCP SDK upgrades - no custom patching needed.
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
  ResponseMetaSchema,
  DiffOptionsSchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

// Action union (nested inside top-level object)
const ValuesActionSchema = z.discriminatedUnion('action', [
  // READ
  BaseSchema.extend({
    action: z.literal('read'),
    range: RangeInputSchema,
    valueRenderOption: ValueRenderOptionSchema.optional(),
    majorDimension: MajorDimensionSchema.optional(),
    streaming: z.boolean().optional().describe('Enable streaming mode for large reads (chunks data to respect deadlines)'),
    chunkSize: z.number().int().positive().default(1000).optional().describe('Rows per chunk in streaming mode (default: 1000)'),
  }),

  // WRITE (idempotent - set exact values)
  BaseSchema.extend({
    action: z.literal('write'),
    range: RangeInputSchema,
    values: ValuesArraySchema,
    valueInputOption: ValueInputOptionSchema.optional(),
    safety: SafetyOptionsSchema.optional(),
    diffOptions: DiffOptionsSchema.optional(),
    includeValuesInResponse: z.boolean().optional().default(false).describe('Return the written values for verification'),
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
    diffOptions: DiffOptionsSchema.optional(),
    includeValuesInResponse: z.boolean().optional().default(false).describe('Return the written values for verification'),
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

// TOP-LEVEL INPUT SCHEMA (z.object with union inside)
// This pattern works natively with MCP SDK - no custom transformation needed
export const SheetsValuesInputSchema = z.object({
  request: ValuesActionSchema,
});

// Output response union
const ValuesResponseSchema = z.discriminatedUnion('success', [
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
    // Response metadata (suggestions, cost estimates, related tools)
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

// TOP-LEVEL OUTPUT SCHEMA (z.object with union inside)
export const SheetsValuesOutputSchema = z.object({
  response: ValuesResponseSchema,
});

export const SHEETS_VALUES_ANNOTATIONS: ToolAnnotations = {
  title: 'Cell Values',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false, // append is not
  openWorldHint: true,
};

export type SheetsValuesInput = z.infer<typeof SheetsValuesInputSchema>;
export type SheetsValuesOutput = z.infer<typeof SheetsValuesOutputSchema>;

// Type alias for the action union (for handler use)
export type ValuesAction = z.infer<typeof ValuesActionSchema>;
export type ValuesResponse = z.infer<typeof ValuesResponseSchema>;
