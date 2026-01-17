/**
 * Tool 15: sheets_advanced
 * Advanced features & formula intelligence: named ranges, protected ranges, metadata, banding, and AI-powered formula operations
 *
 * 27 Actions:
 * Named Ranges (5): add_named_range, update_named_range, delete_named_range, list_named_ranges, get_named_range
 * Protected Ranges (4): add_protected_range, update_protected_range, delete_protected_range, list_protected_ranges
 * Metadata (3): set_metadata, get_metadata, delete_metadata
 * Banding (4): add_banding, update_banding, delete_banding, list_banding
 * Tables (3): create_table, delete_table, list_tables
 * Formula Intelligence (8): formula_generate, formula_suggest, formula_explain, formula_optimize, formula_fix, formula_trace_precedents, formula_trace_dependents, formula_manage_named_ranges
 */

import { z } from 'zod';
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
} from './shared.js';
import { FORMULA_MAX_LENGTH, NAMED_RANGE_NAME_MAX_LENGTH } from '../config/google-limits.js';

// ============================================================================
// Common Schemas
// ============================================================================

const CommonFieldsSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
    ),
  safety: SafetyOptionsSchema.optional().describe('Safety options (dryRun, createSnapshot, etc.)'),
});

const NamedRangeSchema = z.object({
  namedRangeId: z.string(),
  name: z
    .string()
    .max(
      NAMED_RANGE_NAME_MAX_LENGTH,
      `Named range name exceeds Google Sheets limit of ${NAMED_RANGE_NAME_MAX_LENGTH} characters`
    ),
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

const EditorsSchema = z.object({
  users: z.array(z.string().email()).optional(),
  groups: z.array(z.string().email()).optional(),
  domainUsersCanEdit: z.boolean().optional(),
});

const MetadataLocationSchema = z.object({
  sheetId: SheetIdSchema.optional(),
  dimensionRange: z
    .object({
      sheetId: SheetIdSchema,
      dimension: z.enum(['ROWS', 'COLUMNS']),
      startIndex: z.number().int().min(0),
      endIndex: z.number().int().min(1),
    })
    .optional(),
});

// ============================================================================
// Named Range Action Schemas (5 actions)
// ============================================================================

const AddNamedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('add_named_range').describe('Add a named range'),
  name: z
    .string()
    .min(1, 'Named range name cannot be empty')
    .max(
      NAMED_RANGE_NAME_MAX_LENGTH,
      `Named range name exceeds Google Sheets limit of ${NAMED_RANGE_NAME_MAX_LENGTH} characters`
    )
    .regex(
      /^[A-Za-z_]\w*$/,
      'Must start with letter/underscore, contain only alphanumeric and underscores'
    )
    .describe('Named range name'),
  range: RangeInputSchema.describe('Range to name'),
});

const UpdateNamedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('update_named_range').describe('Update a named range'),
  namedRangeId: z.string().describe('Named range ID'),
  name: z
    .string()
    .min(1)
    .max(NAMED_RANGE_NAME_MAX_LENGTH)
    .regex(/^[A-Za-z_]\w*$/)
    .optional()
    .describe('New name'),
  range: RangeInputSchema.optional().describe('New range'),
});

const DeleteNamedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_named_range').describe('Delete a named range'),
  namedRangeId: z.string().describe('Named range ID'),
});

const ListNamedRangesActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list_named_ranges').describe('List all named ranges'),
});

const GetNamedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_named_range').describe('Get a named range by name'),
  name: z.string().min(1).describe('Named range name'),
});

// ============================================================================
// Protected Range Action Schemas (4 actions)
// ============================================================================

const AddProtectedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('add_protected_range').describe('Add a protected range'),
  range: RangeInputSchema.describe('Range to protect'),
  description: z.string().optional().describe('Optional description'),
  warningOnly: z.boolean().optional().default(false).describe('Warning only (no protection)'),
  editors: EditorsSchema.optional().describe('Who can edit (users, groups, domain)'),
});

const UpdateProtectedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('update_protected_range').describe('Update a protected range'),
  protectedRangeId: z.number().int().describe('Protected range ID'),
  description: z.string().optional().describe('New description'),
  warningOnly: z.boolean().optional().describe('New warning only setting'),
  editors: EditorsSchema.optional().describe('New editors'),
  range: RangeInputSchema.optional().describe('New range'),
});

const DeleteProtectedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_protected_range').describe('Delete a protected range'),
  protectedRangeId: z.number().int().describe('Protected range ID'),
});

const ListProtectedRangesActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list_protected_ranges').describe('List all protected ranges'),
  sheetId: SheetIdSchema.optional().describe('Filter by sheet ID'),
});

// ============================================================================
// Metadata Action Schemas (3 actions)
// ============================================================================

const SetMetadataActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_metadata').describe('Set developer metadata'),
  metadataKey: z.string().min(1).describe('Metadata key'),
  metadataValue: z.string().describe('Metadata value'),
  visibility: z
    .enum(['DOCUMENT', 'PROJECT'])
    .optional()
    .default('DOCUMENT')
    .describe('Metadata visibility'),
  location: MetadataLocationSchema.optional().describe('Metadata location'),
});

const GetMetadataActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_metadata').describe('Get developer metadata'),
  metadataId: z.number().int().optional().describe('Metadata ID (omit to list all)'),
  metadataKey: z.string().optional().describe('Filter by key'),
});

const DeleteMetadataActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_metadata').describe('Delete developer metadata'),
  metadataId: z.number().int().describe('Metadata ID'),
});

// ============================================================================
// Banding Action Schemas (4 actions)
// ============================================================================

const AddBandingActionSchema = CommonFieldsSchema.extend({
  action: z.literal('add_banding').describe('Add alternating row/column colors'),
  range: RangeInputSchema.describe('Range to apply banding'),
  rowProperties: BandingPropertiesSchema.optional().describe('Row banding properties'),
  columnProperties: BandingPropertiesSchema.optional().describe('Column banding properties'),
});

const UpdateBandingActionSchema = CommonFieldsSchema.extend({
  action: z.literal('update_banding').describe('Update banding properties'),
  bandedRangeId: z.number().int().describe('Banded range ID'),
  rowProperties: BandingPropertiesSchema.optional().describe('New row properties'),
  columnProperties: BandingPropertiesSchema.optional().describe('New column properties'),
});

const DeleteBandingActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_banding').describe('Delete banding'),
  bandedRangeId: z.number().int().describe('Banded range ID'),
});

const ListBandingActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list_banding').describe('List all banding'),
  sheetId: SheetIdSchema.optional().describe('Filter by sheet ID'),
});

// ============================================================================
// Table Action Schemas (3 actions)
// ============================================================================

const CreateTableActionSchema = CommonFieldsSchema.extend({
  action: z.literal('create_table').describe('Create a table (structured data range)'),
  range: RangeInputSchema.describe('Range for the table'),
  hasHeaders: z.boolean().optional().default(true).describe('First row contains headers'),
});

const DeleteTableActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_table').describe('Delete a table'),
  tableId: z.string().describe('Table ID'),
});

const ListTablesActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list_tables').describe('List all tables'),
});

// ============================================================================
// Formula Intelligence Action Schemas (8 actions)
// ============================================================================

const FormulaGenerateActionSchema = CommonFieldsSchema.extend({
  action: z.literal('formula_generate').describe('Generate formula from natural language'),
  formulaDescription: z.string().min(1).describe('Natural language description of desired formula'),
  context: z
    .object({
      spreadsheetId: SpreadsheetIdSchema.optional(),
      range: RangeInputSchema.optional(),
      sampleData: z.array(z.array(z.unknown())).optional(),
      columnHeaders: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Context for formula generation'),
  outputType: z
    .enum(['formula', 'arrayFormula', 'lambda'])
    .optional()
    .default('formula')
    .describe('Type of formula to generate'),
  complexityLevel: z
    .enum(['simple', 'intermediate', 'advanced'])
    .optional()
    .default('intermediate')
    .describe('Complexity level'),
});

const FormulaSuggestActionSchema = CommonFieldsSchema.extend({
  action: z.literal('formula_suggest').describe('Suggest formulas based on data patterns'),
  range: RangeInputSchema.describe('Range to analyze for suggestions'),
  goal: z
    .enum(['calculate', 'aggregate', 'lookup', 'transform', 'validate', 'any'])
    .optional()
    .default('any')
    .describe('Formula goal'),
  maxSuggestions: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe('Number of suggestions'),
});

const FormulaExplainActionSchema = CommonFieldsSchema.extend({
  action: z.literal('formula_explain').describe('Explain what a formula does'),
  formula: z
    .string()
    .min(1, 'Formula cannot be empty')
    .max(
      FORMULA_MAX_LENGTH,
      `Formula exceeds Google Sheets limit of ${FORMULA_MAX_LENGTH} characters`
    )
    .optional()
    .describe('Formula to explain (optional if cell provided)'),
  cell: z.string().optional().describe('Cell reference (A1 notation)'),
  detail: z
    .enum(['brief', 'detailed', 'step_by_step'])
    .optional()
    .default('detailed')
    .describe('Level of detail'),
  sheetId: SheetIdSchema.optional().describe('Sheet ID for cell reference'),
});

const FormulaOptimizeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('formula_optimize').describe('Optimize a formula for performance/readability'),
  formula: z.string().min(1).max(FORMULA_MAX_LENGTH).optional().describe('Formula to optimize'),
  cell: z.string().optional().describe('Cell reference'),
  sheetId: SheetIdSchema.optional().describe('Sheet ID for cell reference'),
  optimizationGoals: z
    .array(z.enum(['performance', 'readability', 'maintainability', 'all']))
    .optional()
    .default(['all'])
    .describe('Optimization goals'),
});

const FormulaFixActionSchema = CommonFieldsSchema.extend({
  action: z.literal('formula_fix').describe('Fix a broken formula'),
  formula: z.string().min(1).max(FORMULA_MAX_LENGTH).optional().describe('Formula to fix'),
  cell: z.string().optional().describe('Cell reference'),
  sheetId: SheetIdSchema.optional().describe('Sheet ID for cell reference'),
  errorMessage: z.string().optional().describe('Error message if known'),
  applyFix: z.boolean().optional().default(false).describe('Apply fix automatically'),
});

const FormulaTracePrecedentsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('formula_trace_precedents').describe('Find cells that feed into a formula'),
  cell: z.string().describe('Cell reference to trace'),
  sheetId: SheetIdSchema.optional().describe('Sheet ID'),
  depth: z.number().int().min(1).max(10).optional().default(1).describe('Trace depth (1-10)'),
  includeIndirect: z.boolean().optional().default(false).describe('Include INDIRECT references'),
  scope: z.enum(['sheet', 'workbook']).optional().default('sheet').describe('Trace scope'),
});

const FormulaTraceDependentsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('formula_trace_dependents').describe('Find cells that depend on a cell'),
  cell: z.string().describe('Cell reference to trace'),
  sheetId: SheetIdSchema.optional().describe('Sheet ID'),
  depth: z.number().int().min(1).max(10).optional().default(1).describe('Trace depth (1-10)'),
  includeIndirect: z.boolean().optional().default(false).describe('Include INDIRECT references'),
  scope: z.enum(['sheet', 'workbook']).optional().default('sheet').describe('Trace scope'),
});

const FormulaManageNamedRangesActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('formula_manage_named_ranges')
    .describe('Suggest named ranges for formula readability'),
  range: RangeInputSchema.optional().describe('Range to analyze'),
  operation: z
    .enum(['create', 'update', 'delete', 'list'])
    .optional()
    .default('list')
    .describe('Operation to perform'),
});

// ============================================================================
// Combined Input Schema
// ============================================================================

/**
 * All advanced operation inputs (27 actions)
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsAdvancedInputSchema = z.discriminatedUnion('action', [
  // Named ranges (5)
  AddNamedRangeActionSchema,
  UpdateNamedRangeActionSchema,
  DeleteNamedRangeActionSchema,
  ListNamedRangesActionSchema,
  GetNamedRangeActionSchema,
  // Protected ranges (4)
  AddProtectedRangeActionSchema,
  UpdateProtectedRangeActionSchema,
  DeleteProtectedRangeActionSchema,
  ListProtectedRangesActionSchema,
  // Metadata (3)
  SetMetadataActionSchema,
  GetMetadataActionSchema,
  DeleteMetadataActionSchema,
  // Banding (4)
  AddBandingActionSchema,
  UpdateBandingActionSchema,
  DeleteBandingActionSchema,
  ListBandingActionSchema,
  // Tables (3)
  CreateTableActionSchema,
  DeleteTableActionSchema,
  ListTablesActionSchema,
  // Formula intelligence (8)
  FormulaGenerateActionSchema,
  FormulaSuggestActionSchema,
  FormulaExplainActionSchema,
  FormulaOptimizeActionSchema,
  FormulaFixActionSchema,
  FormulaTracePrecedentsActionSchema,
  FormulaTraceDependentsActionSchema,
  FormulaManageNamedRangesActionSchema,
]);

const AdvancedResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // Named range fields
    namedRange: NamedRangeSchema.optional(),
    namedRanges: z.array(NamedRangeSchema).optional(),
    // Protected range fields
    protectedRange: ProtectedRangeSchema.optional(),
    protectedRanges: z.array(ProtectedRangeSchema).optional(),
    // Metadata fields
    metadata: z
      .object({
        metadataId: z.number().int(),
        metadataKey: z.string(),
        metadataValue: z.string(),
        visibility: z.enum(['DOCUMENT', 'PROJECT']),
        location: MetadataLocationSchema.optional(),
      })
      .optional(),
    metadataList: z
      .array(
        z.object({
          metadataId: z.number().int(),
          metadataKey: z.string(),
          metadataValue: z.string(),
        })
      )
      .optional(),
    // Banding fields
    bandedRange: z
      .object({
        bandedRangeId: z.number().int(),
        range: GridRangeSchema,
        rowProperties: BandingPropertiesSchema.optional(),
        columnProperties: BandingPropertiesSchema.optional(),
      })
      .optional(),
    bandedRanges: z
      .array(
        z.object({
          bandedRangeId: z.number().int(),
          range: GridRangeSchema,
        })
      )
      .optional(),
    // Table fields
    table: z
      .object({
        tableId: z.string(),
        range: GridRangeSchema,
        hasHeaders: z.boolean(),
      })
      .optional(),
    tables: z
      .array(
        z.object({
          tableId: z.string(),
          range: GridRangeSchema,
        })
      )
      .optional(),
    // Formula intelligence fields
    formula: z.string().optional(),
    suggestions: z
      .array(
        z.object({
          formula: z.string(),
          description: z.string(),
          confidence: z.number().min(0).max(1),
        })
      )
      .optional(),
    explanation: z.string().optional(),
    optimizedFormula: z.string().optional(),
    improvements: z
      .array(
        z.object({
          type: z.string(),
          before: z.string(),
          after: z.string(),
          benefit: z.string(),
        })
      )
      .optional(),
    precedents: z
      .array(
        z.object({
          cell: z.string(),
          formula: z.string().optional(),
        })
      )
      .optional(),
    dependents: z
      .array(
        z.object({
          cell: z.string(),
          formula: z.string().optional(),
        })
      )
      .optional(),
    // Common fields
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
  title: 'Advanced Features & Formula Intelligence',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsAdvancedInput = z.infer<typeof SheetsAdvancedInputSchema>;
export type SheetsAdvancedOutput = z.infer<typeof SheetsAdvancedOutputSchema>;
export type AdvancedResponse = z.infer<typeof AdvancedResponseSchema>;

// Type narrowing helpers for handler methods (27 action types)
// Named ranges
export type AdvancedAddNamedRangeInput = SheetsAdvancedInput & {
  action: 'add_named_range';
  spreadsheetId: string;
  name: string;
  range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedUpdateNamedRangeInput = SheetsAdvancedInput & {
  action: 'update_named_range';
  spreadsheetId: string;
  namedRangeId: string;
};
export type AdvancedDeleteNamedRangeInput = SheetsAdvancedInput & {
  action: 'delete_named_range';
  spreadsheetId: string;
  namedRangeId: string;
};
export type AdvancedListNamedRangesInput = SheetsAdvancedInput & {
  action: 'list_named_ranges';
  spreadsheetId: string;
};
export type AdvancedGetNamedRangeInput = SheetsAdvancedInput & {
  action: 'get_named_range';
  spreadsheetId: string;
  name: string;
};

// Protected ranges
export type AdvancedAddProtectedRangeInput = SheetsAdvancedInput & {
  action: 'add_protected_range';
  spreadsheetId: string;
  range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedUpdateProtectedRangeInput = SheetsAdvancedInput & {
  action: 'update_protected_range';
  spreadsheetId: string;
  protectedRangeId: number;
};
export type AdvancedDeleteProtectedRangeInput = SheetsAdvancedInput & {
  action: 'delete_protected_range';
  spreadsheetId: string;
  protectedRangeId: number;
};
export type AdvancedListProtectedRangesInput = SheetsAdvancedInput & {
  action: 'list_protected_ranges';
  spreadsheetId: string;
};

// Metadata
export type AdvancedSetMetadataInput = SheetsAdvancedInput & {
  action: 'set_metadata';
  spreadsheetId: string;
  metadataKey: string;
  metadataValue: string;
};
export type AdvancedGetMetadataInput = SheetsAdvancedInput & {
  action: 'get_metadata';
  spreadsheetId: string;
};
export type AdvancedDeleteMetadataInput = SheetsAdvancedInput & {
  action: 'delete_metadata';
  spreadsheetId: string;
  metadataId: number;
};

// Banding
export type AdvancedAddBandingInput = SheetsAdvancedInput & {
  action: 'add_banding';
  spreadsheetId: string;
  range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedUpdateBandingInput = SheetsAdvancedInput & {
  action: 'update_banding';
  spreadsheetId: string;
  bandedRangeId: number;
};
export type AdvancedDeleteBandingInput = SheetsAdvancedInput & {
  action: 'delete_banding';
  spreadsheetId: string;
  bandedRangeId: number;
};
export type AdvancedListBandingInput = SheetsAdvancedInput & {
  action: 'list_banding';
  spreadsheetId: string;
};

// Tables
export type AdvancedCreateTableInput = SheetsAdvancedInput & {
  action: 'create_table';
  spreadsheetId: string;
  range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedDeleteTableInput = SheetsAdvancedInput & {
  action: 'delete_table';
  spreadsheetId: string;
  tableId: string;
};
export type AdvancedListTablesInput = SheetsAdvancedInput & {
  action: 'list_tables';
  spreadsheetId: string;
};

// Formula intelligence
export type AdvancedFormulaGenerateInput = SheetsAdvancedInput & {
  action: 'formula_generate';
  spreadsheetId: string;
  formulaDescription: string;
};
export type AdvancedFormulaSuggestInput = SheetsAdvancedInput & {
  action: 'formula_suggest';
  spreadsheetId: string;
  range: z.infer<typeof RangeInputSchema>;
};
export type AdvancedFormulaExplainInput = SheetsAdvancedInput & {
  action: 'formula_explain';
  spreadsheetId: string;
};
export type AdvancedFormulaOptimizeInput = SheetsAdvancedInput & {
  action: 'formula_optimize';
  spreadsheetId: string;
};
export type AdvancedFormulaFixInput = SheetsAdvancedInput & {
  action: 'formula_fix';
  spreadsheetId: string;
};
export type AdvancedFormulaTracePrecedentsInput = SheetsAdvancedInput & {
  action: 'formula_trace_precedents';
  spreadsheetId: string;
  cell: string;
};
export type AdvancedFormulaTraceDependentsInput = SheetsAdvancedInput & {
  action: 'formula_trace_dependents';
  spreadsheetId: string;
  cell: string;
};
export type AdvancedFormulaManageNamedRangesInput = SheetsAdvancedInput & {
  action: 'formula_manage_named_ranges';
  spreadsheetId: string;
};
