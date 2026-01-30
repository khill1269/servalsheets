/**
 * Tool: sheets_core (Consolidated)
 * Core spreadsheet and sheet/tab operations
 *
 * Consolidates legacy sheets_spreadsheet (8 actions) + sheets_sheet (7 actions) = 15 actions
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

// ============================================================================
// Common Schemas
// ============================================================================

const CommonFieldsSchema = z.object({
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (summary only, 80% less tokens), standard (balanced), detailed (full metadata)'
    ),
});

const SheetSpecSchema = z.object({
  title: z.string().describe('Sheet/tab title'),
  rowCount: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1000)
    .describe('Initial row count (default: 1000)'),
  columnCount: z
    .number()
    .int()
    .positive()
    .optional()
    .default(26)
    .describe('Initial column count (default: 26)'),
  tabColor: ColorSchema.optional().describe('Tab color (RGB)'),
});

// ============================================================================
// Spreadsheet Action Schemas (8 actions)
// ============================================================================

const GetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get').describe('Get spreadsheet metadata'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  includeGridData: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include cell data in response (default: false)'),
  ranges: z
    .array(z.string())
    .optional()
    .describe('Specific ranges to fetch if includeGridData=true'),
});

const CreateActionSchema = CommonFieldsSchema.extend({
  action: z.literal('create').describe('Create a new spreadsheet'),
  title: z.string().min(1).max(255).describe('Spreadsheet title'),
  locale: z
    .string()
    .regex(/^[a-z]{2}_[A-Z]{2}$/, 'Invalid locale format (expected: en_US, fr_FR, etc.)')
    .optional()
    .default('en_US')
    .describe('Locale for formatting (default: en_US)'),
  timeZone: z
    .string()
    .regex(
      /^[A-Za-z_]+\/[A-Za-z_]+$/,
      'Invalid timezone format (expected: America/New_York, Europe/London, etc.)'
    )
    .optional()
    .describe('Time zone like America/New_York'),
  sheets: z.array(SheetSpecSchema).optional().describe('Initial sheets/tabs to create'),
});

const CopyActionSchema = CommonFieldsSchema.extend({
  action: z.literal('copy').describe('Copy an entire spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Source spreadsheet ID'),
  newTitle: z.string().optional().describe('Title for the copied spreadsheet'),
  destinationFolderId: z.string().optional().describe('Google Drive folder ID to copy into'),
});

const UpdatePropertiesActionSchema = CommonFieldsSchema.extend({
  action: z.literal('update_properties').describe('Update spreadsheet properties'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  title: z.string().min(1).max(255).optional().describe('New spreadsheet title'),
  locale: z
    .string()
    .regex(/^[a-z]{2}_[A-Z]{2}$/, 'Invalid locale format')
    .optional()
    .describe('Locale for formatting'),
  timeZone: z
    .string()
    .regex(/^[A-Za-z_]+\/[A-Za-z_]+$/, 'Invalid timezone format')
    .optional()
    .describe('Time zone'),
  autoRecalc: z
    .enum(['ON_CHANGE', 'MINUTE', 'HOUR'])
    .optional()
    .describe('Automatic recalculation frequency'),
});

const GetUrlActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_url').describe('Get the URL of a spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.optional().describe(
    'Optional numeric sheet ID to link to a specific tab (e.g., #gid=0)'
  ),
});

const BatchGetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('batch_get').describe('Get metadata for multiple spreadsheets'),
  spreadsheetIds: z
    .array(SpreadsheetIdSchema)
    .min(1)
    .max(100)
    .describe('Array of spreadsheet IDs (1-100)'),
});

const GetComprehensiveActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_comprehensive').describe('Get comprehensive spreadsheet metadata'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  includeGridData: z.boolean().optional().default(false).describe('Include cell data in response'),
  maxRowsPerSheet: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe('Max rows per sheet if includeGridData=true (default: 100)'),
});

const ListActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list').describe('List user spreadsheets from Google Drive'),
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .default(100)
    .describe('Maximum number of spreadsheets to return (default: 100)'),
  query: z
    .string()
    .max(500, 'Search query exceeds 500 character limit')
    .optional()
    .describe('Search query to filter spreadsheets'),
  orderBy: z
    .enum(['createdTime', 'modifiedTime', 'name', 'viewedByMeTime'])
    .optional()
    .default('modifiedTime')
    .describe('How to order results (default: modifiedTime)'),
});

// ============================================================================
// Sheet/Tab Action Schemas (7 actions)
// ============================================================================

const AddSheetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('add_sheet').describe('Add a new sheet/tab to a spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  title: z.string().min(1).max(255).describe('Sheet/tab title'),
  index: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Position to insert (0 = first, omit = last)'),
  rowCount: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1000)
    .describe('Initial row count (default: 1000)'),
  columnCount: z
    .number()
    .int()
    .positive()
    .optional()
    .default(26)
    .describe('Initial column count (default: 26)'),
  tabColor: ColorSchema.optional().describe('Tab color (RGB)'),
  hidden: z.boolean().optional().default(false).describe('Hide the sheet (default: false)'),
});

const DeleteSheetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_sheet').describe('Delete a sheet/tab from a spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to delete'),
  allowMissing: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, don't error when sheet doesn't exist - makes delete idempotent"),
  safety: SafetyOptionsSchema.optional().describe('Safety options (dryRun, createSnapshot, etc.)'),
});

const DuplicateSheetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('duplicate_sheet').describe('Duplicate a sheet/tab within a spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to duplicate'),
  newTitle: z.string().optional().describe('Title for the duplicated sheet'),
  insertIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Position to insert duplicate (0 = first, omit = after original)'),
});

const UpdateSheetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('update_sheet').describe('Update sheet/tab properties'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to update'),
  title: z.string().min(1).max(255).optional().describe('New sheet title'),
  index: z.coerce.number().int().min(0).optional().describe('New position (0 = first)'),
  tabColor: ColorSchema.optional().describe('Tab color (RGB)'),
  hidden: z.boolean().optional().describe('Hide/show the sheet'),
  rightToLeft: z
    .boolean()
    .optional()
    .default(false)
    .describe('Right-to-left text direction (default: false)'),
});

const CopySheetToActionSchema = CommonFieldsSchema.extend({
  action: z.literal('copy_sheet_to').describe('Copy a sheet/tab to another spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Source spreadsheet ID'),
  sheetId: SheetIdSchema.describe('Numeric sheet ID to copy'),
  destinationSpreadsheetId: SpreadsheetIdSchema.describe('Target spreadsheet ID'),
});

const ListSheetsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list_sheets').describe('List all sheets/tabs in a spreadsheet'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
});

const GetSheetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_sheet').describe('Get metadata for a specific sheet/tab'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetId: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Numeric sheet ID to retrieve (use this OR sheetName)'),
  sheetName: z.string().optional().describe('Sheet name/title to retrieve (use this OR sheetId)'),
});

// ============================================================================
// Batch Sheet Operations (ENHANCED - Issue #2 fix)
// ============================================================================

const BatchDeleteSheetsActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('batch_delete_sheets')
    .describe('Delete multiple sheets in one API call (efficient)'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  sheetIds: z
    .array(SheetIdSchema)
    .min(1)
    .max(100)
    .describe('Array of numeric sheet IDs to delete (1-100)'),
  allowMissing: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, skip sheets that don't exist instead of erroring"),
  safety: SafetyOptionsSchema.optional().describe('Safety options (dryRun, createSnapshot, etc.)'),
});

const BatchUpdateSheetsActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('batch_update_sheets')
    .describe('Update multiple sheet properties in one API call'),
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  updates: z
    .array(
      z.object({
        sheetId: SheetIdSchema.describe('Numeric sheet ID to update'),
        title: z.string().min(1).max(255).optional().describe('New sheet title'),
        index: z.coerce.number().int().min(0).optional().describe('New position (0 = first)'),
        tabColor: ColorSchema.optional().describe('Tab color (RGB)'),
        hidden: z.boolean().optional().describe('Hide/show the sheet'),
      })
    )
    .min(1)
    .max(100)
    .describe('Array of sheet updates (1-100)'),
});

// ============================================================================
// Combined Input Schema
// ============================================================================

/**
 * All core spreadsheet and sheet/tab operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsCoreInputSchema = z.object({
  request: z.discriminatedUnion('action', [
    // Spreadsheet actions (8)
    GetActionSchema,
    CreateActionSchema,
    CopyActionSchema,
    UpdatePropertiesActionSchema,
    GetUrlActionSchema,
    BatchGetActionSchema,
    GetComprehensiveActionSchema,
    ListActionSchema,
    // Sheet/tab actions (7)
    AddSheetActionSchema,
    DeleteSheetActionSchema,
    DuplicateSheetActionSchema,
    UpdateSheetActionSchema,
    CopySheetToActionSchema,
    ListSheetsActionSchema,
    GetSheetActionSchema,
    // Batch operations (Issue #2 fix - efficient multi-sheet operations)
    BatchDeleteSheetsActionSchema,
    BatchUpdateSheetsActionSchema,
  ]),
});

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
    copiedSheetId: z.coerce.number().int().optional(),
    /** True if delete was called but sheet was already missing (with allowMissing=true) */
    alreadyDeleted: z.boolean().optional(),
    // Batch operation responses
    /** Number of sheets deleted in batch operation */
    deletedCount: z.coerce.number().int().optional(),
    /** Sheet IDs that were skipped (didn't exist with allowMissing=true) */
    skippedSheetIds: z.array(z.coerce.number().int()).optional(),
    /** Number of sheets updated in batch operation */
    updatedCount: z.coerce.number().int().optional(),
    // Common fields
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    snapshotId: z.string().optional().describe('Snapshot ID for rollback (if created)'),
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
            sheetsCount: z.coerce.number().int(),
            namedRangesCount: z.coerce.number().int(),
            totalCharts: z.coerce.number().int(),
            totalConditionalFormats: z.coerce.number().int(),
            totalProtectedRanges: z.coerce.number().int(),
            cacheHit: z.boolean(),
            fetchTime: z.coerce.number().int(),
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
/** The unwrapped request type (the discriminated union of actions) */
export type CoreRequest = SheetsCoreInput['request'];

// Type narrowing helpers for handler methods (15 action types)
// Spreadsheet actions
export type CoreGetInput = SheetsCoreInput['request'] & {
  action: 'get';
  spreadsheetId: string;
};
export type CoreCreateInput = SheetsCoreInput['request'] & {
  action: 'create';
  title: string;
};
export type CoreCopyInput = SheetsCoreInput['request'] & {
  action: 'copy';
  spreadsheetId: string;
};
export type CoreUpdatePropertiesInput = SheetsCoreInput['request'] & {
  action: 'update_properties';
  spreadsheetId: string;
};
export type CoreGetUrlInput = SheetsCoreInput['request'] & {
  action: 'get_url';
  spreadsheetId: string;
  sheetId?: number;
};
export type CoreBatchGetInput = SheetsCoreInput['request'] & {
  action: 'batch_get';
  spreadsheetIds: string[];
};
export type CoreGetComprehensiveInput = SheetsCoreInput['request'] & {
  action: 'get_comprehensive';
  spreadsheetId: string;
};
export type CoreListInput = SheetsCoreInput['request'] & { action: 'list' };

// Sheet/tab actions
export type CoreAddSheetInput = SheetsCoreInput['request'] & {
  action: 'add_sheet';
  spreadsheetId: string;
  title: string;
};
export type CoreDeleteSheetInput = SheetsCoreInput['request'] & {
  action: 'delete_sheet';
  spreadsheetId: string;
  sheetId: number;
};
export type CoreDuplicateSheetInput = SheetsCoreInput['request'] & {
  action: 'duplicate_sheet';
  spreadsheetId: string;
  sheetId: number;
};
export type CoreUpdateSheetInput = SheetsCoreInput['request'] & {
  action: 'update_sheet';
  spreadsheetId: string;
  sheetId: number;
};
export type CoreCopySheetToInput = SheetsCoreInput['request'] & {
  action: 'copy_sheet_to';
  spreadsheetId: string;
  sheetId: number;
  destinationSpreadsheetId: string;
};
export type CoreListSheetsInput = SheetsCoreInput['request'] & {
  action: 'list_sheets';
  spreadsheetId: string;
};
export type CoreGetSheetInput = SheetsCoreInput['request'] & {
  action: 'get_sheet';
  spreadsheetId: string;
  sheetId?: number;
  sheetName?: string;
};

// Batch operations (Issue #2 fix)
export type CoreBatchDeleteSheetsInput = SheetsCoreInput['request'] & {
  action: 'batch_delete_sheets';
  spreadsheetId: string;
  sheetIds: number[];
};
export type CoreBatchUpdateSheetsInput = SheetsCoreInput['request'] & {
  action: 'batch_update_sheets';
  spreadsheetId: string;
  updates: Array<{
    sheetId: number;
    title?: string;
    index?: number;
    tabColor?: { red: number; green: number; blue: number; alpha?: number };
    hidden?: boolean;
  }>;
};
