/**
 * Tool 15: sheets_advanced
 * Advanced features: named ranges, protected ranges, metadata, banding
 */

import { z } from "zod";
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  GridRangeSchema,
  ColorSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

const BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
});

const NamedRangeSchema = z.object({
  namedRangeId: z.string(),
  name: z.string(),
  range: GridRangeSchema,
});

const ProtectedRangeSchema = z.object({
  protectedRangeId: z.number().int(),
  range: GridRangeSchema,
  description: z.string().optional(),
  warningOnly: z.boolean(),
  requestingUserCanEdit: z.boolean(),
  editors: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
      domainUsersCanEdit: z.boolean().optional(),
    })
    .optional(),
});

const BandingPropertiesSchema = z.object({
  headerColor: ColorSchema.optional(),
  firstBandColor: ColorSchema.optional(),
  secondBandColor: ColorSchema.optional(),
  footerColor: ColorSchema.optional(),
});

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsAdvancedInputSchema = z.discriminatedUnion("action", [
  // === NAMED RANGES ===

  // ADD_NAMED_RANGE
  BaseSchema.extend({
    action: z
      .literal("add_named_range")
      .describe("Create a named range for easy reference"),
    name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    range: RangeInputSchema,
  }),

  // UPDATE_NAMED_RANGE
  BaseSchema.extend({
    action: z
      .literal("update_named_range")
      .describe("Update an existing named range"),
    namedRangeId: z.string(),
    name: z.string().optional(),
    range: RangeInputSchema.optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE_NAMED_RANGE
  BaseSchema.extend({
    action: z.literal("delete_named_range").describe("Delete a named range"),
    namedRangeId: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_NAMED_RANGES
  BaseSchema.extend({
    action: z
      .literal("list_named_ranges")
      .describe("List all named ranges in spreadsheet"),
  }),

  // GET_NAMED_RANGE
  BaseSchema.extend({
    action: z
      .literal("get_named_range")
      .describe("Get details of a specific named range"),
    name: z.string(),
  }),

  // === PROTECTED RANGES ===

  // ADD_PROTECTED_RANGE
  BaseSchema.extend({
    action: z
      .literal("add_protected_range")
      .describe("Protect a range from editing"),
    range: RangeInputSchema,
    description: z.string().optional(),
    warningOnly: z.boolean().optional().default(false),
    editors: z
      .object({
        users: z.array(z.string().email()).optional(),
        groups: z.array(z.string().email()).optional(),
        domainUsersCanEdit: z.boolean().optional(),
      })
      .optional(),
  }),

  // UPDATE_PROTECTED_RANGE
  BaseSchema.extend({
    action: z
      .literal("update_protected_range")
      .describe("Update protection settings for a range"),
    protectedRangeId: z.number().int(),
    range: RangeInputSchema.optional(),
    description: z.string().optional(),
    warningOnly: z.boolean().optional(),
    editors: z
      .object({
        users: z.array(z.string().email()).optional(),
        groups: z.array(z.string().email()).optional(),
        domainUsersCanEdit: z.boolean().optional(),
      })
      .optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE_PROTECTED_RANGE
  BaseSchema.extend({
    action: z
      .literal("delete_protected_range")
      .describe("Remove protection from a range"),
    protectedRangeId: z.number().int(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_PROTECTED_RANGES
  BaseSchema.extend({
    action: z
      .literal("list_protected_ranges")
      .describe("List all protected ranges"),
    sheetId: SheetIdSchema.optional(),
  }),

  // === METADATA ===

  // SET_METADATA
  BaseSchema.extend({
    action: z
      .literal("set_metadata")
      .describe("Set custom metadata on spreadsheet or sheet"),
    metadataKey: z.string(),
    metadataValue: z.string(),
    visibility: z.enum(["DOCUMENT", "PROJECT"]).optional().default("DOCUMENT"),
    location: z
      .object({
        sheetId: SheetIdSchema.optional(),
        dimensionRange: z
          .object({
            sheetId: SheetIdSchema,
            dimension: z.enum(["ROWS", "COLUMNS"]),
            startIndex: z.number().int().min(0),
            endIndex: z.number().int().min(1),
          })
          .optional(),
      })
      .optional(),
  }),

  // GET_METADATA
  BaseSchema.extend({
    action: z.literal("get_metadata").describe("Retrieve metadata values"),
    metadataKey: z.string().optional(),
  }),

  // DELETE_METADATA
  BaseSchema.extend({
    action: z.literal("delete_metadata").describe("Delete metadata entry"),
    metadataId: z.number().int(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // === BANDING ===

  // ADD_BANDING
  BaseSchema.extend({
    action: z
      .literal("add_banding")
      .describe("Add alternating row or column colors"),
    range: RangeInputSchema,
    rowProperties: BandingPropertiesSchema.optional(),
    columnProperties: BandingPropertiesSchema.optional(),
  }),

  // UPDATE_BANDING
  BaseSchema.extend({
    action: z
      .literal("update_banding")
      .describe("Update banding colors and properties"),
    bandedRangeId: z.number().int(),
    rowProperties: BandingPropertiesSchema.optional(),
    columnProperties: BandingPropertiesSchema.optional(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // DELETE_BANDING
  BaseSchema.extend({
    action: z.literal("delete_banding").describe("Remove banding from range"),
    bandedRangeId: z.number().int(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_BANDING
  BaseSchema.extend({
    action: z.literal("list_banding").describe("List all banded ranges"),
    sheetId: SheetIdSchema.optional(),
  }),

  // === TABLES (NEW 2024) ===

  // CREATE_TABLE
  BaseSchema.extend({
    action: z.literal("create_table").describe("Create a structured table"),
    range: RangeInputSchema,
    hasHeaders: z.boolean().optional().default(true),
  }),

  // DELETE_TABLE
  BaseSchema.extend({
    action: z.literal("delete_table").describe("Delete a table"),
    tableId: z.string(),
    safety: SafetyOptionsSchema.optional(),
  }),

  // LIST_TABLES
  BaseSchema.extend({
    action: z.literal("list_tables").describe("List all tables in spreadsheet"),
  }),
]);

const AdvancedResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),

    // Named ranges
    namedRange: NamedRangeSchema.optional(),
    namedRanges: z.array(NamedRangeSchema).optional(),

    // Protected ranges
    protectedRange: ProtectedRangeSchema.optional(),
    protectedRanges: z.array(ProtectedRangeSchema).optional(),
    protectedRangeId: z.number().int().optional(),

    // Metadata
    metadata: z
      .array(
        z.object({
          metadataId: z.number().int(),
          metadataKey: z.string(),
          metadataValue: z.string(),
          visibility: z.string(),
          location: z
            .object({
              locationType: z.string(),
              sheetId: z.number().int().optional(),
            })
            .optional(),
        }),
      )
      .optional(),
    metadataId: z.number().int().optional(),

    // Banding
    bandedRange: z
      .object({
        bandedRangeId: z.number().int(),
        range: GridRangeSchema,
      })
      .optional(),
    bandedRanges: z
      .array(
        z.object({
          bandedRangeId: z.number().int(),
          range: GridRangeSchema,
        }),
      )
      .optional(),
    bandedRangeId: z.number().int().optional(),

    // Tables
    table: z
      .object({
        tableId: z.string(),
        range: GridRangeSchema,
        columns: z
          .array(
            z.object({
              name: z.string(),
              dataType: z.string(),
            }),
          )
          .optional(),
      })
      .optional(),
    tables: z
      .array(
        z.object({
          tableId: z.string(),
          range: GridRangeSchema,
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

export const SheetsAdvancedOutputSchema = z.object({
  response: AdvancedResponseSchema,
});

export const SHEETS_ADVANCED_ANNOTATIONS: ToolAnnotations = {
  title: "Advanced Features",
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsAdvancedInput = z.infer<typeof SheetsAdvancedInputSchema>;
export type SheetsAdvancedOutput = z.infer<typeof SheetsAdvancedOutputSchema>;
export type AdvancedResponse = z.infer<typeof AdvancedResponseSchema>;
