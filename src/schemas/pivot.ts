/**
 * Tool 9: sheets_pivot
 * Pivot table operations
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  GridRangeSchema,
  SummarizeFunctionSchema,
  SortOrderSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
  type RangeInput,
} from "./shared.js";

const _BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const PivotGroupSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  sortOrder: SortOrderSchema.optional(),
  showTotals: z.boolean().optional().default(true),
  groupRule: z
    .object({
      dateTimeRule: z
        .object({
          type: z.enum([
            "SECOND",
            "MINUTE",
            "HOUR",
            "DAY_OF_WEEK",
            "DAY_OF_YEAR",
            "DAY_OF_MONTH",
            "WEEK_OF_YEAR",
            "MONTH",
            "QUARTER",
            "YEAR",
            "YEAR_MONTH",
            "YEAR_QUARTER",
            "YEAR_MONTH_DAY",
          ]),
        })
        .optional(),
      manualRule: z
        .object({
          groups: z.array(
            z.object({
              groupName: z.string(),
              items: z.array(z.string()),
            }),
          ),
        })
        .optional(),
      histogramRule: z
        .object({
          interval: z.number().positive(),
          start: z.number().optional(),
          end: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

const PivotValueSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  summarizeFunction: SummarizeFunctionSchema,
  name: z.string().optional(),
  calculatedDisplayType: z
    .enum([
      "PERCENT_OF_ROW_TOTAL",
      "PERCENT_OF_COLUMN_TOTAL",
      "PERCENT_OF_GRAND_TOTAL",
    ])
    .optional(),
});

const PivotFilterSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  filterCriteria: z.object({
    visibleValues: z.array(z.string()).optional(),
    condition: z
      .object({
        type: z.string(),
        values: z.array(z.string()).optional(),
      })
      .optional(),
  }),
});

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsPivotInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum(["create", "update", "delete", "list", "get", "refresh"])
      .describe("The operation to perform on the pivot table"),

    // Common field
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      "Spreadsheet ID from URL (required for all actions)",
    ),

    // Fields for CREATE action
    sourceRange: RangeInputSchema.optional().describe(
      "Source data range for the pivot table (A1 notation or semantic) (required for: create)",
    ),
    destinationSheetId: SheetIdSchema.optional().describe(
      "Sheet ID for pivot table destination (omit = new sheet) (create only)",
    ),
    destinationCell: z
      .string()
      .optional()
      .describe(
        "Top-left cell for pivot table (e.g., 'A1', default: A1) (create only)",
      ),

    // Fields for CREATE and UPDATE actions
    rows: z
      .array(PivotGroupSchema)
      .optional()
      .describe("Row groupings for the pivot table (create, update)"),
    columns: z
      .array(PivotGroupSchema)
      .optional()
      .describe("Column groupings for the pivot table (create, update)"),
    values: z
      .array(PivotValueSchema)
      .optional()
      .describe(
        "Value aggregations (required for create; optional for update)",
      ),
    filters: z
      .array(PivotFilterSchema)
      .optional()
      .describe("Filter criteria for the pivot table (create, update)"),

    // Fields for UPDATE, DELETE, GET, and REFRESH actions
    sheetId: SheetIdSchema.optional().describe(
      "Sheet ID containing the pivot table (required for: update, delete, get, refresh)",
    ),

    // Fields for UPDATE and DELETE actions
    safety: SafetyOptionsSchema.optional().describe(
      "Safety options (dryRun, createSnapshot, etc.) (update, delete only)",
    ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "create":
          return (
            !!data.spreadsheetId &&
            !!data.sourceRange &&
            !!data.values &&
            data.values.length > 0
          );
        case "update":
        case "delete":
        case "get":
        case "refresh":
          return !!data.spreadsheetId && data.sheetId !== undefined;
        case "list":
          return !!data.spreadsheetId;
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

// Note: add_calculated_field and remove_calculated_field actions are not supported
// by Google Sheets API v4. These must be done through the Sheets UI or Apps Script.

const PivotResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    pivotTable: z
      .object({
        sheetId: z.number().int(),
        sourceRange: GridRangeSchema,
        rowGroups: z.number().int(),
        columnGroups: z.number().int(),
        values: z.number().int(),
      })
      .optional(),
    pivotTables: z
      .array(
        z.object({
          sheetId: z.number().int(),
          title: z.string(),
        }),
      )
      .optional(),
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsPivotOutputSchema = z.object({
  response: PivotResponseSchema,
});

export const SHEETS_PIVOT_ANNOTATIONS: ToolAnnotations = {
  title: "Pivot Tables",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsPivotInput = z.infer<typeof SheetsPivotInputSchema>;
export type SheetsPivotOutput = z.infer<typeof SheetsPivotOutputSchema>;
export type PivotResponse = z.infer<typeof PivotResponseSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type PivotCreateInput = SheetsPivotInput & {
  action: "create";
  spreadsheetId: string;
  sourceRange: RangeInput;
  values: NonNullable<SheetsPivotInput["values"]>;
};
export type PivotUpdateInput = SheetsPivotInput & {
  action: "update";
  spreadsheetId: string;
  sheetId: number;
};
export type PivotDeleteInput = SheetsPivotInput & {
  action: "delete";
  spreadsheetId: string;
  sheetId: number;
};
export type PivotListInput = SheetsPivotInput & {
  action: "list";
  spreadsheetId: string;
};
export type PivotGetInput = SheetsPivotInput & {
  action: "get";
  spreadsheetId: string;
  sheetId: number;
};
export type PivotRefreshInput = SheetsPivotInput & {
  action: "refresh";
  spreadsheetId: string;
  sheetId: number;
};
