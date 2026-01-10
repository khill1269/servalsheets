/**
 * Tool 1: sheets_spreadsheet
 * Spreadsheet-level operations
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetInfoSchema as _SheetInfoSchema,
  SpreadsheetInfoSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema as _SafetyOptionsSchema,
  MutationSummarySchema,
  ColorSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetSpreadsheetInputSchema = z.discriminatedUnion("action", [
  // GET
  z.object({
    action: z
      .literal("get")
      .describe("Get spreadsheet metadata and properties"),
    spreadsheetId: SpreadsheetIdSchema.describe("Spreadsheet ID from URL"),
    includeGridData: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include cell data in response (default: false)"),
    ranges: z
      .array(z.string())
      .optional()
      .describe(
        "Specific ranges to fetch if includeGridData=true (A1 notation)",
      ),
  }),

  // CREATE
  z.object({
    action: z.literal("create").describe("Create a new spreadsheet"),
    title: z.string().min(1).max(255).describe("Spreadsheet title"),
    locale: z
      .string()
      .optional()
      .default("en_US")
      .describe("Locale for formatting (default: en_US)"),
    timeZone: z
      .string()
      .optional()
      .describe("Time zone (e.g., America/New_York)"),
    sheets: z
      .array(
        z.object({
          title: z.string().describe("Sheet/tab title"),
          rowCount: z
            .number()
            .int()
            .positive()
            .optional()
            .default(1000)
            .describe("Initial row count (default: 1000)"),
          columnCount: z
            .number()
            .int()
            .positive()
            .optional()
            .default(26)
            .describe("Initial column count (default: 26)"),
          tabColor: ColorSchema.optional().describe("Tab color (RGB)"),
        }),
      )
      .optional()
      .describe(
        "Initial sheets/tabs to create (default: 1 sheet named 'Sheet1')",
      ),
  }),

  // COPY
  BaseSchema.extend({
    action: z.literal("copy").describe("Copy/duplicate a spreadsheet"),
    destinationFolderId: z
      .string()
      .optional()
      .describe("Google Drive folder ID to copy into (optional)"),
    newTitle: z
      .string()
      .optional()
      .describe("Title for the copied spreadsheet (optional)"),
  }),

  // UPDATE_PROPERTIES
  BaseSchema.extend({
    action: z
      .literal("update_properties")
      .describe("Update spreadsheet properties"),
    title: z.string().optional().describe("New spreadsheet title"),
    locale: z.string().optional().describe("New locale for formatting"),
    timeZone: z.string().optional().describe("New time zone"),
    autoRecalc: z
      .enum(["ON_CHANGE", "MINUTE", "HOUR"])
      .optional()
      .describe("Automatic recalculation frequency"),
  }),

  // GET_URL
  BaseSchema.extend({
    action: z.literal("get_url").describe("Get the web URL for a spreadsheet"),
  }),

  // BATCH_GET
  z.object({
    action: z
      .literal("batch_get")
      .describe("Get metadata for multiple spreadsheets efficiently"),
    spreadsheetIds: z
      .array(SpreadsheetIdSchema)
      .min(1)
      .max(100)
      .describe("Array of spreadsheet IDs (1-100 spreadsheets)"),
  }),

  // GET_COMPREHENSIVE (Phase 2 optimization - single call for all metadata)
  z.object({
    action: z
      .literal("get_comprehensive")
      .describe(
        "Get comprehensive metadata (sheets, named ranges, formats, etc.)",
      ),
    spreadsheetId: SpreadsheetIdSchema.describe("Spreadsheet ID from URL"),
    includeGridData: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include sample cell data for analysis"),
    maxRowsPerSheet: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe("Max rows to fetch per sheet if includeGridData=true"),
  }),

  // LIST (enumerate user's spreadsheets)
  z.object({
    action: z
      .literal("list")
      .describe("List user's spreadsheets from Google Drive"),
    maxResults: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe("Maximum number of spreadsheets to return"),
    query: z
      .string()
      .optional()
      .describe(
        "Search query to filter spreadsheets (e.g., \"name contains 'Budget'\")",
      ),
    orderBy: z
      .enum(["createdTime", "modifiedTime", "name", "viewedByMeTime"])
      .optional()
      .default("modifiedTime")
      .describe("How to order results"),
  }),
]);

const SpreadsheetResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    spreadsheet: SpreadsheetInfoSchema.optional(),
    spreadsheets: z.array(SpreadsheetInfoSchema).optional(),
    url: z.string().optional(),
    newSpreadsheetId: z.string().optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    // Comprehensive metadata (get_comprehensive action)
    comprehensiveMetadata: z
      .object({
        spreadsheetId: z.string(),
        properties: z.record(z.string(), z.unknown()).optional(),
        namedRanges: z.array(z.record(z.string(), z.unknown())).optional(),
        sheets: z
          .array(
            z.object({
              properties: z.record(z.string(), z.unknown()).optional(),
              conditionalFormats: z.array(z.record(z.string(), z.unknown())).optional(),
              protectedRanges: z.array(z.record(z.string(), z.unknown())).optional(),
              charts: z.array(z.record(z.string(), z.unknown())).optional(),
              filterViews: z.array(z.record(z.string(), z.unknown())).optional(),
              basicFilter: z.record(z.string(), z.unknown()).optional(),
              merges: z.array(z.record(z.string(), z.unknown())).optional(),
              data: z.array(z.record(z.string(), z.unknown())).optional(), // Array of GridData objects from Google Sheets API
            }),
          )
          .optional(),
        stats: z
          .object({
            sheetsCount: z.number().int(),
            namedRangesCount: z.number().int(),
            totalCharts: z.number().int(),
            totalConditionalFormats: z.number().int(),
            totalProtectedRanges: z.number().int(),
            cacheHit: z.boolean(),
            fetchTime: z.number().int(),
          })
          .optional(),
      })
      .optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsSpreadsheetOutputSchema = z.object({
  response: SpreadsheetResponseSchema,
});

export const SHEETS_SPREADSHEET_ANNOTATIONS: ToolAnnotations = {
  title: "Spreadsheet",
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsSpreadsheetInput = z.infer<
  typeof SheetSpreadsheetInputSchema
>;
export type SheetsSpreadsheetOutput = z.infer<
  typeof SheetsSpreadsheetOutputSchema
>;
export type SpreadsheetResponse = z.infer<typeof SpreadsheetResponseSchema>;
