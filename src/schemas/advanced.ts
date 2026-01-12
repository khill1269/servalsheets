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

const _BaseSchema = z.object({
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

// Editors schema for protected ranges
const EditorsSchema = z.object({
  users: z.array(z.string().email()).optional(),
  groups: z.array(z.string().email()).optional(),
  domainUsersCanEdit: z.boolean().optional(),
});

// Location schema for metadata
const MetadataLocationSchema = z.object({
  sheetId: SheetIdSchema.optional(),
  dimensionRange: z
    .object({
      sheetId: SheetIdSchema,
      dimension: z.enum(["ROWS", "COLUMNS"]),
      startIndex: z.number().int().min(0),
      endIndex: z.number().int().min(1),
    })
    .optional(),
});

// INPUT SCHEMA: Flattened z.object() pattern for MCP SDK compatibility
export const SheetsAdvancedInputSchema = z
  .object({
    // Action discriminator
    action: z.enum([
      // Named ranges
      "add_named_range",
      "update_named_range",
      "delete_named_range",
      "list_named_ranges",
      "get_named_range",
      // Protected ranges
      "add_protected_range",
      "update_protected_range",
      "delete_protected_range",
      "list_protected_ranges",
      // Metadata
      "set_metadata",
      "get_metadata",
      "delete_metadata",
      // Banding
      "add_banding",
      "update_banding",
      "delete_banding",
      "list_banding",
      // Tables
      "create_table",
      "delete_table",
      "list_tables",
    ]),

    // Common fields
    spreadsheetId: SpreadsheetIdSchema.optional(),
    sheetId: SheetIdSchema.optional(),
    range: RangeInputSchema.optional(),
    safety: SafetyOptionsSchema.optional(),

    // Named range fields
    name: z.string().optional(),
    namedRangeId: z.string().optional(),

    // Protected range fields
    protectedRangeId: z.number().int().optional(),
    description: z.string().optional(),
    warningOnly: z.boolean().optional(),
    editors: EditorsSchema.optional(),

    // Metadata fields
    metadataKey: z.string().optional(),
    metadataValue: z.string().optional(),
    metadataId: z.number().int().optional(),
    visibility: z.enum(["DOCUMENT", "PROJECT"]).optional(),
    location: MetadataLocationSchema.optional(),

    // Banding fields
    bandedRangeId: z.number().int().optional(),
    rowProperties: BandingPropertiesSchema.optional(),
    columnProperties: BandingPropertiesSchema.optional(),

    // Table fields
    tableId: z.string().optional(),
    hasHeaders: z.boolean().optional(),
  })
  .refine(
    (data) => {
      switch (data.action) {
        // === NAMED RANGES ===
        case "add_named_range":
          return (
            !!data.spreadsheetId &&
            !!data.name &&
            /^[A-Za-z_][A-Za-z0-9_]*$/.test(data.name) &&
            !!data.range
          );

        case "update_named_range":
          return (
            !!data.spreadsheetId &&
            !!data.namedRangeId &&
            (!!data.name || !!data.range)
          );

        case "delete_named_range":
          return !!data.spreadsheetId && !!data.namedRangeId;

        case "list_named_ranges":
          return !!data.spreadsheetId;

        case "get_named_range":
          return !!data.spreadsheetId && !!data.name;

        // === PROTECTED RANGES ===
        case "add_protected_range":
          return !!data.spreadsheetId && !!data.range;

        case "update_protected_range":
          return (
            !!data.spreadsheetId &&
            typeof data.protectedRangeId === "number" &&
            (!!data.range ||
              !!data.description ||
              data.warningOnly !== undefined ||
              !!data.editors)
          );

        case "delete_protected_range":
          return (
            !!data.spreadsheetId && typeof data.protectedRangeId === "number"
          );

        case "list_protected_ranges":
          return !!data.spreadsheetId;

        // === METADATA ===
        case "set_metadata":
          return (
            !!data.spreadsheetId && !!data.metadataKey && !!data.metadataValue
          );

        case "get_metadata":
          return !!data.spreadsheetId;

        case "delete_metadata":
          return !!data.spreadsheetId && typeof data.metadataId === "number";

        // === BANDING ===
        case "add_banding":
          return !!data.spreadsheetId && !!data.range;

        case "update_banding":
          return (
            !!data.spreadsheetId &&
            typeof data.bandedRangeId === "number" &&
            (!!data.rowProperties || !!data.columnProperties)
          );

        case "delete_banding":
          return !!data.spreadsheetId && typeof data.bandedRangeId === "number";

        case "list_banding":
          return !!data.spreadsheetId;

        // === TABLES ===
        case "create_table":
          return !!data.spreadsheetId && !!data.range;

        case "delete_table":
          return !!data.spreadsheetId && !!data.tableId;

        case "list_tables":
          return !!data.spreadsheetId;

        default:
          return false;
      }
    },
    {
      message:
        "Missing required fields for the specified action or invalid field values",
    },
  );

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

// ============================================================
// Type narrowing helpers for all 21 actions
// ============================================================

// Named ranges
export function isAddNamedRange(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "add_named_range";
  spreadsheetId: string;
  name: string;
  range: NonNullable<SheetsAdvancedInput["range"]>;
} {
  return input.action === "add_named_range";
}

export function isUpdateNamedRange(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "update_named_range";
  spreadsheetId: string;
  namedRangeId: string;
} {
  return input.action === "update_named_range";
}

export function isDeleteNamedRange(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "delete_named_range";
  spreadsheetId: string;
  namedRangeId: string;
} {
  return input.action === "delete_named_range";
}

export function isListNamedRanges(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "list_named_ranges";
  spreadsheetId: string;
} {
  return input.action === "list_named_ranges";
}

export function isGetNamedRange(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "get_named_range";
  spreadsheetId: string;
  name: string;
} {
  return input.action === "get_named_range";
}

// Protected ranges
export function isAddProtectedRange(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "add_protected_range";
  spreadsheetId: string;
  range: NonNullable<SheetsAdvancedInput["range"]>;
} {
  return input.action === "add_protected_range";
}

export function isUpdateProtectedRange(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "update_protected_range";
  spreadsheetId: string;
  protectedRangeId: number;
} {
  return input.action === "update_protected_range";
}

export function isDeleteProtectedRange(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "delete_protected_range";
  spreadsheetId: string;
  protectedRangeId: number;
} {
  return input.action === "delete_protected_range";
}

export function isListProtectedRanges(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "list_protected_ranges";
  spreadsheetId: string;
} {
  return input.action === "list_protected_ranges";
}

// Metadata
export function isSetMetadata(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "set_metadata";
  spreadsheetId: string;
  metadataKey: string;
  metadataValue: string;
} {
  return input.action === "set_metadata";
}

export function isGetMetadata(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "get_metadata";
  spreadsheetId: string;
} {
  return input.action === "get_metadata";
}

export function isDeleteMetadata(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "delete_metadata";
  spreadsheetId: string;
  metadataId: number;
} {
  return input.action === "delete_metadata";
}

// Banding
export function isAddBanding(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "add_banding";
  spreadsheetId: string;
  range: NonNullable<SheetsAdvancedInput["range"]>;
} {
  return input.action === "add_banding";
}

export function isUpdateBanding(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "update_banding";
  spreadsheetId: string;
  bandedRangeId: number;
} {
  return input.action === "update_banding";
}

export function isDeleteBanding(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "delete_banding";
  spreadsheetId: string;
  bandedRangeId: number;
} {
  return input.action === "delete_banding";
}

export function isListBanding(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "list_banding";
  spreadsheetId: string;
} {
  return input.action === "list_banding";
}

// Tables
export function isCreateTable(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "create_table";
  spreadsheetId: string;
  range: NonNullable<SheetsAdvancedInput["range"]>;
} {
  return input.action === "create_table";
}

export function isDeleteTable(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "delete_table";
  spreadsheetId: string;
  tableId: string;
} {
  return input.action === "delete_table";
}

export function isListTables(
  input: SheetsAdvancedInput,
): input is SheetsAdvancedInput & {
  action: "list_tables";
  spreadsheetId: string;
} {
  return input.action === "list_tables";
}
