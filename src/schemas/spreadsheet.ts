/**
 * Tool 1: sheets_spreadsheet
 * Spreadsheet-level operations
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetInfoSchema,
  SpreadsheetInfoSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ColorSchema,
  type ToolAnnotations,
} from './shared.js';

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

export const SheetSpreadsheetInputSchema = z.discriminatedUnion('action', [
  // GET
  z.object({
    action: z.literal('get'),
    spreadsheetId: SpreadsheetIdSchema,
    includeGridData: z.boolean().optional().default(false),
    ranges: z.array(z.string()).optional(),
  }),

  // CREATE
  z.object({
    action: z.literal('create'),
    title: z.string().min(1).max(255),
    locale: z.string().optional().default('en_US'),
    timeZone: z.string().optional(),
    sheets: z.array(z.object({
      title: z.string(),
      rowCount: z.number().int().positive().optional().default(1000),
      columnCount: z.number().int().positive().optional().default(26),
      tabColor: ColorSchema.optional(),
    })).optional(),
  }),

  // COPY
  BaseSchema.extend({
    action: z.literal('copy'),
    destinationFolderId: z.string().optional(),
    newTitle: z.string().optional(),
  }),

  // UPDATE_PROPERTIES
  BaseSchema.extend({
    action: z.literal('update_properties'),
    title: z.string().optional(),
    locale: z.string().optional(),
    timeZone: z.string().optional(),
    autoRecalc: z.enum(['ON_CHANGE', 'MINUTE', 'HOUR']).optional(),
  }),

  // GET_URL
  BaseSchema.extend({
    action: z.literal('get_url'),
  }),

  // BATCH_GET
  z.object({
    action: z.literal('batch_get'),
    spreadsheetIds: z.array(SpreadsheetIdSchema).min(1).max(100),
  }),
]);

export const SheetsSpreadsheetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    spreadsheet: SpreadsheetInfoSchema.optional(),
    spreadsheets: z.array(SpreadsheetInfoSchema).optional(),
    url: z.string().optional(),
    newSpreadsheetId: z.string().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SHEETS_SPREADSHEET_ANNOTATIONS: ToolAnnotations = {
  title: 'Spreadsheet',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsSpreadsheetInput = z.infer<typeof SheetSpreadsheetInputSchema>;
export type SheetsSpreadsheetOutput = z.infer<typeof SheetsSpreadsheetOutputSchema>;
