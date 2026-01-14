/**
 * Tool: sheets_core (Consolidated)
 * Core spreadsheet and sheet/tab operations
 *
 * Consolidates sheets_spreadsheet (8 actions) + sheets_sheet (7 actions) = 15 actions
 * MCP Protocol: 2025-11-25
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  SheetInfoSchema,
  SpreadsheetInfoSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ColorSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// Combines all fields from sheets_spreadsheet (8 actions) + sheets_sheet (7 actions)
export const SheetsCoreInputSchema = z
  .object({
    // Required action discriminator (15 total actions)
    action: z
      .enum([
        // Spreadsheet actions (8)
        'get',
        'create',
        'copy',
        'update_properties',
        'get_url',
        'batch_get',
        'get_comprehensive',
        'list',
        // Sheet/tab actions (7)
        'add_sheet',
        'delete_sheet',
        'duplicate_sheet',
        'update_sheet',
        'copy_sheet_to',
        'list_sheets',
        'get_sheet',
      ])
      .describe('The operation to perform on the spreadsheet or sheet/tab'),

    // ===== SPREADSHEET FIELDS =====

    // Fields for GET, COPY, UPDATE_PROPERTIES, GET_URL, GET_COMPREHENSIVE actions
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      'Spreadsheet ID from URL (required for most actions except create, batch_get)'
    ),
    includeGridData: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include cell data in response (get, get_comprehensive)'),
    ranges: z
      .array(z.string())
      .optional()
      .describe('Specific ranges to fetch if includeGridData=true (get only)'),

    // Fields for CREATE action
    title: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe(
        'Spreadsheet/sheet title (required for: create, add_sheet; optional for: update_properties, update_sheet)'
      ),
    locale: z
      .string()
      .optional()
      .default('en_US')
      .describe('Locale for formatting (create, update_properties)'),
    timeZone: z
      .string()
      .optional()
      .describe('Time zone like America/New_York (create, update_properties)'),
    sheets: z
      .array(
        z.object({
          title: z.string().describe('Sheet/tab title'),
          rowCount: z
            .number()
            .int()
            .positive()
            .optional()
            .default(1000)
            .describe('Initial row count'),
          columnCount: z
            .number()
            .int()
            .positive()
            .optional()
            .default(26)
            .describe('Initial column count'),
          tabColor: ColorSchema.optional().describe('Tab color (RGB)'),
        })
      )
      .optional()
      .describe('Initial sheets/tabs to create (create only)'),

    // Fields for COPY action
    destinationFolderId: z
      .string()
      .optional()
      .describe('Google Drive folder ID to copy into (copy only)'),
    newTitle: z
      .string()
      .optional()
      .describe('Title for the copied spreadsheet/duplicated sheet (copy, duplicate_sheet)'),

    // Fields for UPDATE_PROPERTIES action
    autoRecalc: z
      .enum(['ON_CHANGE', 'MINUTE', 'HOUR'])
      .optional()
      .describe('Automatic recalculation frequency (update_properties only)'),

    // Fields for BATCH_GET action
    spreadsheetIds: z
      .array(SpreadsheetIdSchema)
      .min(1)
      .max(100)
      .optional()
      .describe('Array of spreadsheet IDs 1-100 (required for: batch_get)'),

    // Fields for GET_COMPREHENSIVE action
    maxRowsPerSheet: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe('Max rows per sheet if includeGridData=true (get_comprehensive only)'),

    // Fields for LIST action
    maxResults: z
      .number()
      .int()
      .positive()
      .optional()
      .default(100)
      .describe('Maximum number of spreadsheets to return (list only)'),
    query: z.string().optional().describe('Search query to filter spreadsheets (list only)'),
    orderBy: z
      .enum(['createdTime', 'modifiedTime', 'name', 'viewedByMeTime'])
      .optional()
      .default('modifiedTime')
      .describe('How to order results (list only)'),

    // ===== SHEET/TAB FIELDS =====

    // Fields for sheet/tab operations
    sheetId: SheetIdSchema.optional().describe(
      'Numeric sheet ID (required for: delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, get_sheet)'
    ),

    // Fields for ADD_SHEET action
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Position to insert (0 = first, omit = last) (add_sheet, update_sheet)'),
    rowCount: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1000)
      .describe('Initial row count (default: 1000) (add_sheet)'),
    columnCount: z
      .number()
      .int()
      .positive()
      .optional()
      .default(26)
      .describe('Initial column count (default: 26) (add_sheet)'),
    tabColor: ColorSchema.optional().describe('Tab color (RGB) (add_sheet, update_sheet)'),
    hidden: z
      .boolean()
      .optional()
      .default(false)
      .describe('Hide the sheet (default: false) (add_sheet, update_sheet)'),

    // Fields for DELETE_SHEET action
    allowMissing: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "If true, don't error when sheet doesn't exist - makes delete idempotent (delete_sheet)"
      ),
    safety: SafetyOptionsSchema.optional().describe(
      'Safety options (dryRun, createSnapshot, etc.) (delete_sheet)'
    ),

    // Fields for DUPLICATE_SHEET action
    insertIndex: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Position to insert duplicate (0 = first, omit = after original) (duplicate_sheet)'
      ),

    // Fields for UPDATE_SHEET action
    rightToLeft: z.boolean().optional().describe('Right-to-left text direction (update_sheet)'),

    // Fields for COPY_SHEET_TO action
    destinationSpreadsheetId: SpreadsheetIdSchema.optional().describe(
      'Target spreadsheet ID (required for: copy_sheet_to)'
    ),

    // ===== LLM OPTIMIZATION: VERBOSITY CONTROL =====
    verbosity: z
      .enum(['minimal', 'standard', 'detailed'])
      .optional()
      .default('standard')
      .describe(
        'Response detail level: minimal (summary only, 80% less tokens), standard (balanced), detailed (full metadata)'
      ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        // Spreadsheet actions
        case 'get':
        case 'copy':
        case 'get_url':
        case 'get_comprehensive':
        case 'update_properties':
          return !!data.spreadsheetId;
        case 'create':
          return !!data.title;
        case 'batch_get':
          return !!data.spreadsheetIds && data.spreadsheetIds.length > 0;
        case 'list':
          return true; // No required fields beyond action

        // Sheet/tab actions
        case 'add_sheet':
          return !!data.spreadsheetId && !!data.title;
        case 'delete_sheet':
        case 'duplicate_sheet':
        case 'update_sheet':
        case 'get_sheet':
          return !!data.spreadsheetId && typeof data.sheetId === 'number';
        case 'copy_sheet_to':
          return (
            !!data.spreadsheetId &&
            typeof data.sheetId === 'number' &&
            !!data.destinationSpreadsheetId
          );
        case 'list_sheets':
          return !!data.spreadsheetId;

        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );

const CoreResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Spreadsheet responses
    spreadsheet: SpreadsheetInfoSchema.optional(),
    spreadsheets: z.array(SpreadsheetInfoSchema).optional(),
    url: z.string().optional(),
    newSpreadsheetId: z.string().optional(),
    // Sheet responses
    sheet: SheetInfoSchema.optional(),
    sheets: z.array(SheetInfoSchema).optional(),
    copiedSheetId: z.number().int().optional(),
    /** True if delete was called but sheet was already missing (with allowMissing=true) */
    alreadyDeleted: z.boolean().optional(),
    // Common fields
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
              data: z.array(z.record(z.string(), z.unknown())).optional(),
            })
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

export const SheetsCoreOutputSchema = z.object({
  response: CoreResponseSchema,
});

/**
 * Tool annotations for MCP protocol
 *
 * Combines annotations from spreadsheet and sheet tools:
 * - readOnlyHint: false (can modify data)
 * - destructiveHint: true (delete_sheet is destructive)
 * - idempotentHint: false (create, add, duplicate create new entities; delete without allowMissing fails)
 * - openWorldHint: true (interacts with Google Sheets API)
 */
export const SHEETS_CORE_ANNOTATIONS: ToolAnnotations = {
  title: 'Core Operations',
  readOnlyHint: false,
  destructiveHint: true, // delete_sheet action is destructive
  idempotentHint: false, // create/add create new entities
  openWorldHint: true,
};

export type SheetsCoreInput = z.infer<typeof SheetsCoreInputSchema>;
export type SheetsCoreOutput = z.infer<typeof SheetsCoreOutputSchema>;
export type CoreResponse = z.infer<typeof CoreResponseSchema>;

// Type narrowing helpers for handler methods (15 action types)
// Spreadsheet actions
export type CoreGetInput = SheetsCoreInput & {
  action: 'get';
  spreadsheetId: string;
};
export type CoreCreateInput = SheetsCoreInput & {
  action: 'create';
  title: string;
};
export type CoreCopyInput = SheetsCoreInput & {
  action: 'copy';
  spreadsheetId: string;
};
export type CoreUpdatePropertiesInput = SheetsCoreInput & {
  action: 'update_properties';
  spreadsheetId: string;
};
export type CoreGetUrlInput = SheetsCoreInput & {
  action: 'get_url';
  spreadsheetId: string;
};
export type CoreBatchGetInput = SheetsCoreInput & {
  action: 'batch_get';
  spreadsheetIds: string[];
};
export type CoreGetComprehensiveInput = SheetsCoreInput & {
  action: 'get_comprehensive';
  spreadsheetId: string;
};
export type CoreListInput = SheetsCoreInput & { action: 'list' };

// Sheet/tab actions
export type CoreAddSheetInput = SheetsCoreInput & {
  action: 'add_sheet';
  spreadsheetId: string;
  title: string;
};
export type CoreDeleteSheetInput = SheetsCoreInput & {
  action: 'delete_sheet';
  spreadsheetId: string;
  sheetId: number;
};
export type CoreDuplicateSheetInput = SheetsCoreInput & {
  action: 'duplicate_sheet';
  spreadsheetId: string;
  sheetId: number;
};
export type CoreUpdateSheetInput = SheetsCoreInput & {
  action: 'update_sheet';
  spreadsheetId: string;
  sheetId: number;
};
export type CoreCopySheetToInput = SheetsCoreInput & {
  action: 'copy_sheet_to';
  spreadsheetId: string;
  sheetId: number;
  destinationSpreadsheetId: string;
};
export type CoreListSheetsInput = SheetsCoreInput & {
  action: 'list_sheets';
  spreadsheetId: string;
};
export type CoreGetSheetInput = SheetsCoreInput & {
  action: 'get_sheet';
  spreadsheetId: string;
  sheetId: number;
};
