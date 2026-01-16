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

const _BaseSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema,
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
      dimension: z.enum(['ROWS', 'COLUMNS']),
      startIndex: z.number().int().min(0),
      endIndex: z.number().int().min(1),
    })
    .optional(),
});

// INPUT SCHEMA: Flattened z.object() pattern for MCP SDK compatibility
export const SheetsAdvancedInputSchema = z
  .object({
    // Action discriminator (27 actions: 19 advanced + 8 formula)
    action: z.enum([
      // Named ranges (5)
      'add_named_range',
      'update_named_range',
      'delete_named_range',
      'list_named_ranges',
      'get_named_range',
      // Protected ranges (4)
      'add_protected_range',
      'update_protected_range',
      'delete_protected_range',
      'list_protected_ranges',
      // Metadata (3)
      'set_metadata',
      'get_metadata',
      'delete_metadata',
      // Banding (4)
      'add_banding',
      'update_banding',
      'delete_banding',
      'list_banding',
      // Tables (3)
      'create_table',
      'delete_table',
      'list_tables',
      // Formula intelligence (8, prefixed with formula_)
      'formula_generate',
      'formula_suggest',
      'formula_explain',
      'formula_optimize',
      'formula_fix',
      'formula_trace_precedents',
      'formula_trace_dependents',
      'formula_manage_named_ranges',
    ]),

    // Common fields
    spreadsheetId: SpreadsheetIdSchema.optional(),
    sheetId: SheetIdSchema.optional(),
    range: RangeInputSchema.optional(),
    safety: SafetyOptionsSchema.optional(),

    // Named range fields
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
      .optional(),
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
    visibility: z.enum(['DOCUMENT', 'PROJECT']).optional(),
    location: MetadataLocationSchema.optional(),

    // Banding fields
    bandedRangeId: z.number().int().optional(),
    rowProperties: BandingPropertiesSchema.optional(),
    columnProperties: BandingPropertiesSchema.optional(),

    // Table fields
    tableId: z.string().optional(),
    hasHeaders: z.boolean().optional(),

    // Formula intelligence fields
    // formula_generate fields
    formulaDescription: z.string().optional(),
    context: z
      .object({
        spreadsheetId: SpreadsheetIdSchema.optional(),
        range: RangeInputSchema.optional(),
        sampleData: z.array(z.array(z.unknown())).optional(),
        columnHeaders: z.array(z.string()).optional(),
      })
      .optional(),
    outputType: z.enum(['formula', 'arrayFormula', 'lambda']).optional(),
    complexityLevel: z.enum(['simple', 'intermediate', 'advanced']).optional(),

    // formula_suggest fields
    goal: z.enum(['calculate', 'aggregate', 'lookup', 'transform', 'validate', 'any']).optional(),
    maxSuggestions: z.number().int().min(1).max(10).optional(),

    // formula_explain fields
    formula: z
      .string()
      .min(1, 'Formula cannot be empty')
      .max(
        FORMULA_MAX_LENGTH,
        `Formula exceeds Google Sheets limit of ${FORMULA_MAX_LENGTH} characters`
      )
      .optional(),
    detail: z.enum(['brief', 'detailed', 'step_by_step']).optional(),
    cell: z.string().optional(),

    // formula_optimize fields
    optimizationGoals: z
      .array(z.enum(['performance', 'readability', 'maintainability', 'all']))
      .optional(),

    // formula_fix fields
    errorMessage: z.string().optional(),
    applyFix: z.boolean().optional(),

    // formula_trace_precedents and formula_trace_dependents fields
    depth: z.number().int().min(1).max(10).optional(),
    includeIndirect: z.boolean().optional(),
    scope: z.enum(['sheet', 'workbook']).optional(),

    // formula_manage_named_ranges fields
    operation: z.enum(['create', 'update', 'delete', 'list']).optional(),

    // ===== LLM OPTIMIZATION: VERBOSITY CONTROL =====
    verbosity: z
      .enum(['minimal', 'standard', 'detailed'])
      .optional()
      .default('standard')
      .describe(
        'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
      ),
  })
  .refine(
    (data) => {
      switch (data.action) {
        // === NAMED RANGES ===
        case 'add_named_range':
          return (
            !!data.spreadsheetId && !!data.name && /^[A-Za-z_]\w*$/.test(data.name) && !!data.range
          );

        case 'update_named_range':
          return !!data.spreadsheetId && !!data.namedRangeId && (!!data.name || !!data.range);

        case 'delete_named_range':
          return !!data.spreadsheetId && !!data.namedRangeId;

        case 'list_named_ranges':
          return !!data.spreadsheetId;

        case 'get_named_range':
          return !!data.spreadsheetId && !!data.name;

        // === PROTECTED RANGES ===
        case 'add_protected_range':
          return !!data.spreadsheetId && !!data.range;

        case 'update_protected_range':
          return (
            !!data.spreadsheetId &&
            typeof data.protectedRangeId === 'number' &&
            (!!data.range || !!data.description || data.warningOnly !== undefined || !!data.editors)
          );

        case 'delete_protected_range':
          return !!data.spreadsheetId && typeof data.protectedRangeId === 'number';

        case 'list_protected_ranges':
          return !!data.spreadsheetId;

        // === METADATA ===
        case 'set_metadata':
          return !!data.spreadsheetId && !!data.metadataKey && !!data.metadataValue;

        case 'get_metadata':
          return !!data.spreadsheetId;

        case 'delete_metadata':
          return !!data.spreadsheetId && typeof data.metadataId === 'number';

        // === BANDING ===
        case 'add_banding':
          return !!data.spreadsheetId && !!data.range;

        case 'update_banding':
          return (
            !!data.spreadsheetId &&
            typeof data.bandedRangeId === 'number' &&
            (!!data.rowProperties || !!data.columnProperties)
          );

        case 'delete_banding':
          return !!data.spreadsheetId && typeof data.bandedRangeId === 'number';

        case 'list_banding':
          return !!data.spreadsheetId;

        // === TABLES ===
        case 'create_table':
          return !!data.spreadsheetId && !!data.range;

        case 'delete_table':
          return !!data.spreadsheetId && !!data.tableId;

        case 'list_tables':
          return !!data.spreadsheetId;

        // === FORMULA INTELLIGENCE ===
        case 'formula_generate':
          return !!data.formulaDescription;

        case 'formula_suggest':
          return !!data.spreadsheetId && !!data.range;

        case 'formula_explain':
          return !!data.formula;

        case 'formula_optimize':
          return !!data.spreadsheetId && !!data.range;

        case 'formula_fix':
          return !!data.formula;

        case 'formula_trace_precedents':
          return !!data.spreadsheetId && !!data.cell;

        case 'formula_trace_dependents':
          return !!data.spreadsheetId && !!data.cell;

        case 'formula_manage_named_ranges':
          return !!data.spreadsheetId && !!data.operation;

        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action or invalid field values',
    }
  );

const AdvancedResponseSchema = z.discriminatedUnion('success', [
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
        })
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
        })
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
            })
          )
          .optional(),
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

    // Formula intelligence response fields
    // formula_generate response
    formula: z.string().optional(),
    explanation: z.string().optional(),
    confidence: z.number().min(0).max(100).optional(),
    alternatives: z
      .array(
        z.object({
          formula: z.string(),
          explanation: z.string(),
          complexity: z.string(),
        })
      )
      .optional(),
    warnings: z.array(z.string()).optional(),

    // formula_suggest response
    suggestions: z
      .array(
        z.object({
          formula: z.string(),
          explanation: z.string(),
          useCase: z.string(),
          targetCell: z.string().optional(),
          category: z.enum([
            'calculation',
            'aggregation',
            'lookup',
            'text',
            'date',
            'conditional',
            'array',
          ]),
          confidence: z.number().min(0).max(100),
        })
      )
      .optional(),
    dataAnalysis: z
      .object({
        columnTypes: z.record(z.string(), z.string()),
        hasHeaders: z.boolean(),
        rowCount: z.number().int(),
        columnCount: z.number().int(),
        patterns: z.array(z.string()),
      })
      .optional(),

    // formula_explain response
    components: z
      .array(
        z.object({
          part: z.string(),
          description: z.string(),
          type: z.enum(['function', 'reference', 'operator', 'constant', 'range']),
        })
      )
      .optional(),
    usedFunctions: z.array(z.string()).optional(),
    complexity: z.enum(['simple', 'intermediate', 'advanced', 'expert']).optional(),

    // formula_optimize response
    formulasAnalyzed: z.number().int().min(0).optional(),
    optimizationsFound: z
      .array(
        z.object({
          cell: z.string(),
          currentFormula: z.string(),
          optimizedFormula: z.string(),
          improvement: z.string(),
          category: z.enum([
            'volatile_functions',
            'array_optimization',
            'reference_consolidation',
            'function_simplification',
            'named_range_usage',
          ]),
          estimatedSpeedup: z.string().optional(),
        })
      )
      .optional(),
    summary: z
      .object({
        volatileFunctions: z.number().int(),
        arrayFormulas: z.number().int(),
        excessiveRanges: z.number().int(),
        totalOptimizations: z.number().int(),
      })
      .optional(),

    // formula_fix response
    originalFormula: z.string().optional(),
    fixedFormula: z.string().optional(),
    errorType: z
      .enum(['syntax', 'reference', 'name', 'value', 'div_zero', 'circular', 'unknown'])
      .optional(),
    applied: z.boolean().optional(),

    // formula_trace_precedents response
    precedents: z
      .array(
        z.object({
          cell: z.string(),
          range: z.string().optional(),
          sheetName: z.string().optional(),
          value: z.unknown().optional(),
          hasFormula: z.boolean(),
          depth: z.number().int(),
        })
      )
      .optional(),
    dependencyGraph: z
      .object({
        nodes: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            type: z.enum(['cell', 'range', 'constant', 'function']),
          })
        ),
        edges: z.array(
          z.object({
            from: z.string(),
            to: z.string(),
            label: z.string().optional(),
          })
        ),
      })
      .optional(),

    // formula_trace_dependents response
    value: z.unknown().optional(),
    dependents: z
      .array(
        z.object({
          cell: z.string(),
          sheetName: z.string().optional(),
          formula: z.string(),
          depth: z.number().int(),
        })
      )
      .optional(),
    impactCount: z.number().int().optional(),
    circularReferences: z.array(z.string()).optional(),

    // formula_manage_named_ranges response
    operation: z.enum(['create', 'update', 'delete', 'list']).optional(),

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
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

export type SheetsAdvancedInput = z.infer<typeof SheetsAdvancedInputSchema>;
export type SheetsAdvancedOutput = z.infer<typeof SheetsAdvancedOutputSchema>;
export type AdvancedResponse = z.infer<typeof AdvancedResponseSchema>;

// ============================================================
// Type narrowing helpers for all 27 actions
// ============================================================

// Named ranges
export function isAddNamedRange(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'add_named_range';
  spreadsheetId: string;
  name: string;
  range: NonNullable<SheetsAdvancedInput['range']>;
} {
  return input.action === 'add_named_range';
}

export function isUpdateNamedRange(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'update_named_range';
  spreadsheetId: string;
  namedRangeId: string;
} {
  return input.action === 'update_named_range';
}

export function isDeleteNamedRange(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'delete_named_range';
  spreadsheetId: string;
  namedRangeId: string;
} {
  return input.action === 'delete_named_range';
}

export function isListNamedRanges(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'list_named_ranges';
  spreadsheetId: string;
} {
  return input.action === 'list_named_ranges';
}

export function isGetNamedRange(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'get_named_range';
  spreadsheetId: string;
  name: string;
} {
  return input.action === 'get_named_range';
}

// Protected ranges
export function isAddProtectedRange(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'add_protected_range';
  spreadsheetId: string;
  range: NonNullable<SheetsAdvancedInput['range']>;
} {
  return input.action === 'add_protected_range';
}

export function isUpdateProtectedRange(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'update_protected_range';
  spreadsheetId: string;
  protectedRangeId: number;
} {
  return input.action === 'update_protected_range';
}

export function isDeleteProtectedRange(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'delete_protected_range';
  spreadsheetId: string;
  protectedRangeId: number;
} {
  return input.action === 'delete_protected_range';
}

export function isListProtectedRanges(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'list_protected_ranges';
  spreadsheetId: string;
} {
  return input.action === 'list_protected_ranges';
}

// Metadata
export function isSetMetadata(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'set_metadata';
  spreadsheetId: string;
  metadataKey: string;
  metadataValue: string;
} {
  return input.action === 'set_metadata';
}

export function isGetMetadata(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'get_metadata';
  spreadsheetId: string;
} {
  return input.action === 'get_metadata';
}

export function isDeleteMetadata(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'delete_metadata';
  spreadsheetId: string;
  metadataId: number;
} {
  return input.action === 'delete_metadata';
}

// Banding
export function isAddBanding(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'add_banding';
  spreadsheetId: string;
  range: NonNullable<SheetsAdvancedInput['range']>;
} {
  return input.action === 'add_banding';
}

export function isUpdateBanding(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'update_banding';
  spreadsheetId: string;
  bandedRangeId: number;
} {
  return input.action === 'update_banding';
}

export function isDeleteBanding(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'delete_banding';
  spreadsheetId: string;
  bandedRangeId: number;
} {
  return input.action === 'delete_banding';
}

export function isListBanding(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'list_banding';
  spreadsheetId: string;
} {
  return input.action === 'list_banding';
}

// Tables
export function isCreateTable(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'create_table';
  spreadsheetId: string;
  range: NonNullable<SheetsAdvancedInput['range']>;
} {
  return input.action === 'create_table';
}

export function isDeleteTable(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'delete_table';
  spreadsheetId: string;
  tableId: string;
} {
  return input.action === 'delete_table';
}

export function isListTables(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'list_tables';
  spreadsheetId: string;
} {
  return input.action === 'list_tables';
}

// Formula intelligence
export function isFormulaGenerate(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'formula_generate';
  formulaDescription: string;
} {
  return input.action === 'formula_generate';
}

export function isFormulaSuggest(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'formula_suggest';
  spreadsheetId: string;
  range: NonNullable<SheetsAdvancedInput['range']>;
} {
  return input.action === 'formula_suggest';
}

export function isFormulaExplain(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'formula_explain';
  formula: string;
} {
  return input.action === 'formula_explain';
}

export function isFormulaOptimize(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'formula_optimize';
  spreadsheetId: string;
  range: NonNullable<SheetsAdvancedInput['range']>;
} {
  return input.action === 'formula_optimize';
}

export function isFormulaFix(input: SheetsAdvancedInput): input is SheetsAdvancedInput & {
  action: 'formula_fix';
  formula: string;
} {
  return input.action === 'formula_fix';
}

export function isFormulaTracePrecedents(
  input: SheetsAdvancedInput
): input is SheetsAdvancedInput & {
  action: 'formula_trace_precedents';
  spreadsheetId: string;
  cell: string;
} {
  return input.action === 'formula_trace_precedents';
}

export function isFormulaTraceDependents(
  input: SheetsAdvancedInput
): input is SheetsAdvancedInput & {
  action: 'formula_trace_dependents';
  spreadsheetId: string;
  cell: string;
} {
  return input.action === 'formula_trace_dependents';
}

export function isFormulaManageNamedRanges(
  input: SheetsAdvancedInput
): input is SheetsAdvancedInput & {
  action: 'formula_manage_named_ranges';
  spreadsheetId: string;
  operation: 'create' | 'update' | 'delete' | 'list';
} {
  return input.action === 'formula_manage_named_ranges';
}
