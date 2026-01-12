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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetSpreadsheetInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "get",
        "create",
        "copy",
        "update_properties",
        "get_url",
        "batch_get",
        "get_comprehensive",
        "list",
      ])
      .describe("The operation to perform on the spreadsheet"),

    // Fields for GET action
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for: get, copy, update_properties, get_url, get_comprehensive)",
    ),
    includeGridData: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include cell data in response (get, get_comprehensive)"),
    ranges: z
      .array(z.string())
      .optional()
      .describe("Specific ranges to fetch if includeGridData=true (get only)"),

    // Fields for CREATE action
    title: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe(
        "Spreadsheet title (required for: create; optional for: update_properties)",
      ),
    locale: z
      .string()
      .optional()
      .default("en_US")
      .describe("Locale for formatting (create, update_properties)"),
    timeZone: z
      .string()
      .optional()
      .describe("Time zone like America/New_York (create, update_properties)"),
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
            .describe("Initial row count"),
          columnCount: z
            .number()
            .int()
            .positive()
            .optional()
            .default(26)
            .describe("Initial column count"),
          tabColor: ColorSchema.optional().describe("Tab color (RGB)"),
        }),
      )
      .optional()
      .describe("Initial sheets/tabs to create (create only)"),

    // Fields for COPY action
    destinationFolderId: z
      .string()
      .optional()
      .describe("Google Drive folder ID to copy into (copy only)"),
    newTitle: z
      .string()
      .optional()
      .describe("Title for the copied spreadsheet (copy only)"),

    // Fields for UPDATE_PROPERTIES action
    autoRecalc: z
      .enum(["ON_CHANGE", "MINUTE", "HOUR"])
      .optional()
      .describe("Automatic recalculation frequency (update_properties only)"),

    // Fields for BATCH_GET action
    spreadsheetIds: z
      .array(SpreadsheetIdSchema)
      .min(1)
      .max(100)
      .optional()
      .describe("Array of spreadsheet IDs 1-100 (required for: batch_get)"),

    // Fields for GET_COMPREHENSIVE action
    maxRowsPerSheet: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe(
        "Max rows per sheet if includeGridData=true (get_comprehensive only)",
      ),

    // Fields for LIST action
    maxResults: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe("Maximum number of spreadsheets to return (list only)"),
    query: z
      .string()
      .optional()
      .describe("Search query to filter spreadsheets (list only)"),
    orderBy: z
      .enum(["createdTime", "modifiedTime", "name", "viewedByMeTime"])
      .optional()
      .default("modifiedTime")
      .describe("How to order results (list only)"),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "get":
        case "copy":
        case "get_url":
        case "get_comprehensive":
        case "update_properties":
          return !!data.spreadsheetId;
        case "create":
          return !!data.title;
        case "batch_get":
          return !!data.spreadsheetIds && data.spreadsheetIds.length > 0;
        case "list":
          return true; // No required fields beyond action
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

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
              conditionalFormats: z
                .array(z.record(z.string(), z.unknown()))
                .optional(),
              protectedRanges: z
                .array(z.record(z.string(), z.unknown()))
                .optional(),
              charts: z.array(z.record(z.string(), z.unknown())).optional(),
              filterViews: z
                .array(z.record(z.string(), z.unknown()))
                .optional(),
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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type SpreadsheetGetInput = SheetsSpreadsheetInput & {
  action: "get";
  spreadsheetId: string;
};
export type SpreadsheetCreateInput = SheetsSpreadsheetInput & {
  action: "create";
  title: string;
};
export type SpreadsheetCopyInput = SheetsSpreadsheetInput & {
  action: "copy";
  spreadsheetId: string;
};
export type SpreadsheetUpdatePropertiesInput = SheetsSpreadsheetInput & {
  action: "update_properties";
  spreadsheetId: string;
};
export type SpreadsheetGetUrlInput = SheetsSpreadsheetInput & {
  action: "get_url";
  spreadsheetId: string;
};
export type SpreadsheetBatchGetInput = SheetsSpreadsheetInput & {
  action: "batch_get";
  spreadsheetIds: string[];
};
export type SpreadsheetGetComprehensiveInput = SheetsSpreadsheetInput & {
  action: "get_comprehensive";
  spreadsheetId: string;
};
export type SpreadsheetListInput = SheetsSpreadsheetInput & { action: "list" };
