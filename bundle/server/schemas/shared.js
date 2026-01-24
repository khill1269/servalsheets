/**
 * ServalSheets - Shared Schemas
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 */
import { z } from 'zod';
import { SPREADSHEET_ID_REGEX, A1_NOTATION_REGEX, A1_NOTATION_MAX_LENGTH, SHEET_NAME_REGEX, SHEET_NAME_MAX_LENGTH, URL_REGEX, } from '../config/google-limits.js';
// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================
export const MCP_PROTOCOL_VERSION = '2025-11-25';
export const SHEETS_API_VERSION = 'v4';
export const DRIVE_API_VERSION = 'v3';
// ============================================================================
// PRIMITIVE SCHEMAS
// ============================================================================
/** Google Sheets API color format (0-1 scale) */
export const ColorSchema = z
    .object({
    red: z.number().min(0).max(1).optional().default(0),
    green: z.number().min(0).max(1).optional().default(0),
    blue: z.number().min(0).max(1).optional().default(0),
    alpha: z.number().min(0).max(1).optional().default(1),
})
    .describe('RGB color in 0-1 scale');
/** Cell value types */
export const CellValueSchema = z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .describe('Cell value');
/** 2D array of values */
export const ValuesArraySchema = z
    .array(z.array(CellValueSchema))
    .describe('2D array - each inner array is a row');
/** Spreadsheet ID */
export const SpreadsheetIdSchema = z
    .string()
    .min(1)
    .max(100)
    .regex(SPREADSHEET_ID_REGEX, 'Invalid spreadsheet ID format')
    .describe('Spreadsheet ID from URL');
/** Sheet ID (numeric) - coerces strings from MCP clients */
export const SheetIdSchema = z.coerce.number().int().min(0).describe('Numeric sheet ID');
/** A1 Notation */
export const A1NotationSchema = z
    .string()
    .min(1)
    .max(A1_NOTATION_MAX_LENGTH)
    .regex(A1_NOTATION_REGEX, 'Invalid A1 notation format')
    .describe('A1 notation (e.g., "Sheet1!A1:C10", "A1", "A:B", "1:5")');
/** Sheet name */
export const SheetNameSchema = z
    .string()
    .min(1)
    .max(SHEET_NAME_MAX_LENGTH)
    .regex(SHEET_NAME_REGEX, String.raw `Sheet name cannot contain: \ / ? * [ ]`)
    .describe(String.raw `Sheet/tab name (no special chars: \ / ? * [ ])`);
// ============================================================================
// ENUMS (Google Sheets API)
// ============================================================================
export const ValueRenderOptionSchema = z
    .enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
    .default('FORMATTED_VALUE');
export const ValueInputOptionSchema = z.enum(['RAW', 'USER_ENTERED']).default('USER_ENTERED');
export const InsertDataOptionSchema = z.enum(['OVERWRITE', 'INSERT_ROWS']).default('INSERT_ROWS');
export const MajorDimensionSchema = z.enum(['ROWS', 'COLUMNS']).default('ROWS');
export const DimensionSchema = z.enum(['ROWS', 'COLUMNS']);
export const HorizontalAlignSchema = z.enum(['LEFT', 'CENTER', 'RIGHT']);
export const VerticalAlignSchema = z.enum(['TOP', 'MIDDLE', 'BOTTOM']);
export const WrapStrategySchema = z.enum(['OVERFLOW_CELL', 'LEGACY_WRAP', 'CLIP', 'WRAP']);
export const BorderStyleSchema = z.enum([
    'NONE',
    'DOTTED',
    'DASHED',
    'SOLID',
    'SOLID_MEDIUM',
    'SOLID_THICK',
    'DOUBLE',
]);
export const MergeTypeSchema = z.enum(['MERGE_ALL', 'MERGE_COLUMNS', 'MERGE_ROWS']);
export const PasteTypeSchema = z.enum([
    'PASTE_NORMAL',
    'PASTE_VALUES',
    'PASTE_FORMAT',
    'PASTE_NO_BORDERS',
    'PASTE_FORMULA',
    'PASTE_DATA_VALIDATION',
    'PASTE_CONDITIONAL_FORMATTING',
]);
export const ChartTypeSchema = z.enum([
    'BAR',
    'LINE',
    'AREA',
    'COLUMN',
    'SCATTER',
    'COMBO',
    'STEPPED_AREA',
    'PIE',
    'DOUGHNUT',
    'TREEMAP',
    'WATERFALL',
    'HISTOGRAM',
    'CANDLESTICK',
    'ORG',
    'RADAR',
    'SCORECARD',
    'BUBBLE',
]);
export const LegendPositionSchema = z.enum([
    'BOTTOM_LEGEND',
    'LEFT_LEGEND',
    'RIGHT_LEGEND',
    'TOP_LEGEND',
    'NO_LEGEND',
]);
export const SummarizeFunctionSchema = z.enum([
    'SUM',
    'COUNTA',
    'COUNT',
    'COUNTUNIQUE',
    'AVERAGE',
    'MAX',
    'MIN',
    'MEDIAN',
    'PRODUCT',
    'STDEV',
    'STDEVP',
    'VAR',
    'VARP',
    'CUSTOM',
]);
export const SortOrderSchema = z.enum(['ASCENDING', 'DESCENDING']);
export const PermissionRoleSchema = z.enum([
    'owner',
    'organizer',
    'fileOrganizer',
    'writer',
    'commenter',
    'reader',
]);
export const PermissionTypeSchema = z.enum(['user', 'group', 'domain', 'anyone']);
export const ConditionTypeSchema = z.enum([
    // Number
    'NUMBER_GREATER',
    'NUMBER_GREATER_THAN_EQ',
    'NUMBER_LESS',
    'NUMBER_LESS_THAN_EQ',
    'NUMBER_EQ',
    'NUMBER_NOT_EQ',
    'NUMBER_BETWEEN',
    'NUMBER_NOT_BETWEEN',
    // Text
    'TEXT_CONTAINS',
    'TEXT_NOT_CONTAINS',
    'TEXT_STARTS_WITH',
    'TEXT_ENDS_WITH',
    'TEXT_EQ',
    'TEXT_IS_EMAIL',
    'TEXT_IS_URL',
    // Date
    'DATE_EQ',
    'DATE_BEFORE',
    'DATE_AFTER',
    'DATE_ON_OR_BEFORE',
    'DATE_ON_OR_AFTER',
    'DATE_BETWEEN',
    'DATE_NOT_BETWEEN',
    'DATE_IS_VALID',
    // Other
    'BLANK',
    'NOT_BLANK',
    'CUSTOM_FORMULA',
    'ONE_OF_LIST',
    'ONE_OF_RANGE',
    'BOOLEAN',
]);
// ============================================================================
// ERROR CODES
// ============================================================================
export const ErrorCodeSchema = z.enum([
    // MCP Standard (5 codes)
    'PARSE_ERROR',
    'INVALID_REQUEST',
    'METHOD_NOT_FOUND',
    'INVALID_PARAMS',
    'INTERNAL_ERROR',
    // Authentication & Authorization (4 codes)
    'UNAUTHENTICATED',
    'PERMISSION_DENIED',
    'INVALID_CREDENTIALS',
    'INSUFFICIENT_PERMISSIONS',
    // Quota & Rate Limiting (3 codes)
    'QUOTA_EXCEEDED',
    'RATE_LIMITED',
    'RESOURCE_EXHAUSTED',
    // Spreadsheet Errors (8 codes)
    'SPREADSHEET_NOT_FOUND',
    'SPREADSHEET_TOO_LARGE',
    'SHEET_NOT_FOUND',
    'INVALID_SHEET_ID',
    'DUPLICATE_SHEET_NAME',
    'INVALID_RANGE',
    'RANGE_NOT_FOUND',
    'PROTECTED_RANGE',
    // Data & Formula Errors (4 codes)
    'FORMULA_ERROR',
    'CIRCULAR_REFERENCE',
    'INVALID_DATA_VALIDATION',
    'MERGE_CONFLICT',
    // Feature-Specific Errors (7 codes)
    'CONDITIONAL_FORMAT_ERROR',
    'PIVOT_TABLE_ERROR',
    'CHART_ERROR',
    'FILTER_VIEW_ERROR',
    'NAMED_RANGE_ERROR',
    'DEVELOPER_METADATA_ERROR',
    'DIMENSION_ERROR',
    // Operation Errors (6 codes)
    'BATCH_UPDATE_ERROR',
    'TRANSACTION_ERROR',
    'ABORTED',
    'DEADLINE_EXCEEDED',
    'CANCELLED',
    'DATA_LOSS',
    // Network & Service Errors (5 codes)
    'UNAVAILABLE',
    'UNIMPLEMENTED',
    'UNKNOWN',
    'OUT_OF_RANGE',
    'FAILED_PRECONDITION',
    // Safety Rails (3 codes)
    'PRECONDITION_FAILED',
    'EFFECT_SCOPE_EXCEEDED',
    'EXPLICIT_RANGE_REQUIRED',
    'AMBIGUOUS_RANGE',
    // Features
    'FEATURE_UNAVAILABLE',
    'FEATURE_DEGRADED',
    // Auth & configuration
    'AUTHENTICATION_REQUIRED',
    'AUTH_ERROR',
    'CONFIG_ERROR',
    'VALIDATION_ERROR',
    // Resource/handler lifecycle
    'NOT_FOUND',
    'NOT_IMPLEMENTED',
    'HANDLER_LOAD_ERROR',
    // Session limits
    'TOO_MANY_SESSIONS',
    // Data integrity
    'DATA_ERROR',
    'VERSION_MISMATCH',
    'NO_DATA',
    // Service lifecycle
    'SERVICE_NOT_INITIALIZED',
    'SNAPSHOT_CREATION_FAILED',
    'SNAPSHOT_RESTORE_FAILED',
    // Transactions
    'TRANSACTION_CONFLICT',
    'TRANSACTION_EXPIRED',
    // HTTP Transport
    'SESSION_NOT_FOUND',
    // Batch/Payload
    'PAYLOAD_TOO_LARGE',
    // MCP-native features (SEP-1036, SEP-1577)
    'ELICITATION_UNAVAILABLE',
    'SAMPLING_UNAVAILABLE',
    // Discovery & Replay
    'FORBIDDEN',
    'REPLAY_FAILED',
    // Generic
    'UNKNOWN_ERROR',
]);
// ============================================================================
// COMPOSITE SCHEMAS
// ============================================================================
/** Border specification */
export const BorderSchema = z.object({
    style: BorderStyleSchema,
    color: ColorSchema.optional(),
});
/** Text format */
export const TextFormatSchema = z.object({
    foregroundColor: ColorSchema.optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().positive().optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
});
/** Number format */
export const NumberFormatSchema = z.object({
    type: z
        .enum(['TEXT', 'NUMBER', 'PERCENT', 'CURRENCY', 'DATE', 'TIME', 'DATE_TIME', 'SCIENTIFIC'])
        .optional(),
    pattern: z.string().optional(),
});
/** Cell format */
export const CellFormatSchema = z.object({
    backgroundColor: ColorSchema.optional(),
    textFormat: TextFormatSchema.optional(),
    horizontalAlignment: HorizontalAlignSchema.optional(),
    verticalAlignment: VerticalAlignSchema.optional(),
    wrapStrategy: WrapStrategySchema.optional(),
    numberFormat: NumberFormatSchema.optional(),
    borders: z
        .object({
        top: BorderSchema.optional(),
        bottom: BorderSchema.optional(),
        left: BorderSchema.optional(),
        right: BorderSchema.optional(),
    })
        .optional(),
});
/** Grid range (numeric coordinates) */
export const GridRangeSchema = z.object({
    sheetId: SheetIdSchema,
    startRowIndex: z.number().int().min(0).optional(),
    endRowIndex: z.number().int().min(0).optional(),
    startColumnIndex: z.number().int().min(0).optional(),
    endColumnIndex: z.number().int().min(0).optional(),
});
/** Condition for rules */
export const ConditionSchema = z.object({
    type: ConditionTypeSchema,
    values: z.array(z.string()).optional(),
});
/** Chart position */
export const ChartPositionSchema = z.object({
    anchorCell: z.string(),
    offsetX: z.number().optional().default(0),
    offsetY: z.number().optional().default(0),
    width: z.number().optional().default(600),
    height: z.number().optional().default(400),
});
/** Sort specification */
export const SortSpecSchema = z.object({
    columnIndex: z.number().int().min(0),
    ascending: z.boolean().optional().default(true),
});
// ============================================================================
// SAFETY RAILS
// ============================================================================
/** Effect scope limits */
export const EffectScopeSchema = z.object({
    maxCellsAffected: z.number().int().positive().optional().default(50000),
    maxRowsAffected: z.number().int().positive().optional(),
    maxColumnsAffected: z.number().int().positive().optional(),
    requireExplicitRange: z.boolean().optional().default(false),
});
/** Expected state for optimistic locking */
export const ExpectedStateSchema = z.object({
    version: z.string().optional().describe('Specific version to validate'),
    rowCount: z.number().int().min(0).optional().describe('Expected total row count'),
    columnCount: z.number().int().min(0).optional().describe('Expected total column count'),
    sheetTitle: z.string().optional().describe('Sheet title that must exist'),
    checksum: z.string().optional().describe('MD5 hash of range values to verify'),
    checksumRange: z
        .string()
        .optional()
        .describe('A1 range for checksum calculation (default: A1:J10)'),
    firstRowValues: z.array(z.string()).optional().describe('Expected header values in first row'),
});
/** Safety options for destructive actions */
export const SafetyOptionsSchema = z.object({
    dryRun: z.boolean().optional().default(false),
    expectedState: ExpectedStateSchema.optional(),
    transactionId: z.string().uuid().optional(),
    autoSnapshot: z.boolean().optional().default(true),
    effectScope: EffectScopeSchema.optional(),
});
// ============================================================================
// DIFF ENGINE
// ============================================================================
export const DiffTierSchema = z.enum(['METADATA', 'SAMPLE', 'FULL']).default('METADATA');
export const DiffOptionsSchema = z.object({
    tier: DiffTierSchema.optional(),
    sampleSize: z.number().int().positive().optional().default(10),
    maxFullDiffCells: z.number().int().positive().optional().default(5000),
});
export const CellChangeSchema = z.object({
    cell: z.string(),
    before: CellValueSchema.optional(),
    after: CellValueSchema.optional(),
    type: z.enum(['value', 'format', 'formula', 'note']),
});
export const MetadataDiffSchema = z.object({
    tier: z.literal('METADATA'),
    before: z.object({
        timestamp: z.string(),
        rowCount: z.number().int(),
        columnCount: z.number().int(),
        checksum: z.string(),
    }),
    after: z.object({
        timestamp: z.string(),
        rowCount: z.number().int(),
        columnCount: z.number().int(),
        checksum: z.string(),
    }),
    summary: z.object({
        rowsChanged: z.number().int(),
        estimatedCellsChanged: z.number().int(),
    }),
});
export const SampleDiffSchema = z.object({
    tier: z.literal('SAMPLE'),
    samples: z.object({
        firstRows: z.array(CellChangeSchema),
        lastRows: z.array(CellChangeSchema),
        randomRows: z.array(CellChangeSchema),
    }),
    summary: z.object({
        rowsChanged: z.number().int(),
        cellsSampled: z.number().int(),
    }),
});
export const FullDiffSchema = z.object({
    tier: z.literal('FULL'),
    changes: z.array(CellChangeSchema),
    summary: z.object({
        cellsChanged: z.number().int(),
        cellsAdded: z.number().int(),
        cellsRemoved: z.number().int(),
    }),
});
export const DiffResultSchema = z.discriminatedUnion('tier', [
    MetadataDiffSchema,
    SampleDiffSchema,
    FullDiffSchema,
]);
// ============================================================================
// RANGE RESOLVER
// ============================================================================
export const ResolutionMethodSchema = z.enum([
    'a1_direct',
    'named_range',
    'semantic_header',
    'semantic_search',
]);
export const ResolvedRangeSchema = z.object({
    sheetId: SheetIdSchema,
    sheetName: z.string(),
    a1Notation: z.string(),
    gridRange: GridRangeSchema,
    resolution: z.object({
        method: ResolutionMethodSchema,
        confidence: z.number().min(0).max(1),
        path: z.string(),
        alternatives: z
            .array(z.object({
            a1Notation: z.string(),
            reason: z.string(),
        }))
            .optional(),
    }),
});
export const SemanticRangeQuerySchema = z.object({
    sheet: z.string(),
    column: z.string(),
    includeHeader: z.boolean().optional().default(false),
    rowStart: z.number().int().min(1).optional(),
    rowEnd: z.number().int().min(1).optional(),
});
/**
 * Range input schema that accepts:
 * - Plain string (A1 notation) - transformed to { a1: string }
 * - Object with a1 key: { a1: "Sheet1!A1:B10" }
 * - Object with namedRange key: { namedRange: "MyRange" }
 * - Object with semantic key: { semantic: { sheet: "Sheet1", column: "Name" } }
 * - Object with grid key: { grid: { sheetId: 0, startRowIndex: 0, ... } }
 */
export const RangeInputSchema = z.preprocess((val) => {
    // Transform plain strings to { a1: string } format
    if (typeof val === 'string') {
        return { a1: val };
    }
    return val;
}, z.union([
    z.object({ a1: A1NotationSchema }),
    z.object({ namedRange: z.string() }),
    z.object({ semantic: SemanticRangeQuerySchema }),
    z.object({ grid: GridRangeSchema }),
]));
// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================
/** Error detail */
export const ErrorDetailSchema = z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    retryable: z.boolean().optional().default(false),
    retryAfterMs: z.number().int().positive().optional(),
    suggestedFix: z.string().optional(),
    alternatives: z
        .array(z.object({
        tool: z.string(),
        action: z.string(),
        description: z.string(),
    }))
        .optional(),
    // Agent-actionable fields
    resolution: z.string().optional(),
    resolutionSteps: z.array(z.string()).optional(),
    category: z.enum(['client', 'server', 'network', 'auth', 'quota', 'unknown']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    retryStrategy: z.enum(['exponential_backoff', 'wait_for_reset', 'manual', 'none']).optional(),
    suggestedTools: z.array(z.string()).optional(),
});
/** Mutation summary */
export const MutationSummarySchema = z.object({
    cellsAffected: z.number().int(),
    rowsAffected: z.number().int().optional(),
    columnsAffected: z.number().int().optional(),
    diff: DiffResultSchema.optional(),
    reversible: z.boolean(),
    revertSnapshotId: z.string().optional(),
});
/** Sheet info */
export const SheetInfoSchema = z.object({
    sheetId: z.number().int(),
    title: z.string(),
    index: z.number().int(),
    rowCount: z.number().int(),
    columnCount: z.number().int(),
    hidden: z.boolean().optional().default(false),
    tabColor: ColorSchema.optional(),
});
/** Spreadsheet info */
export const SpreadsheetInfoSchema = z.object({
    spreadsheetId: z.string(),
    title: z.string(),
    url: z.string().optional(),
    locale: z.string().optional(),
    timeZone: z.string().optional(),
    sheets: z.array(SheetInfoSchema).optional(),
    // Additional metadata for list operations
    createdTime: z.string().optional(),
    modifiedTime: z.string().optional(),
    owners: z
        .array(z.object({
        email: z.string().optional(),
        displayName: z.string().optional(),
    }))
        .optional(),
    lastModifiedBy: z.string().optional(),
});
// ============================================================================
// RESPONSE METADATA (Quick Win: Enhanced tool responses)
// ============================================================================
/** Tool suggestion for follow-up or optimization */
export const ToolSuggestionSchema = z.object({
    type: z.enum(['optimization', 'alternative', 'follow_up', 'warning', 'related']),
    message: z.string(),
    tool: z.string().optional(),
    action: z.string().optional(),
    reason: z.string(),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});
/** Cost estimation for the operation */
export const CostEstimateSchema = z.object({
    apiCalls: z.number().int().min(0),
    estimatedLatencyMs: z.number().min(0),
    cellsAffected: z.number().int().min(0).optional(),
    quotaImpact: z
        .object({
        current: z.number().int().min(0),
        limit: z.number().int().min(0),
        remaining: z.number().int().min(0),
    })
        .optional(),
});
/** Response metadata with suggestions and cost info */
export const ResponseMetaSchema = z.object({
    suggestions: z.array(ToolSuggestionSchema).optional(),
    costEstimate: CostEstimateSchema.optional(),
    relatedTools: z.array(z.string()).optional(),
    documentation: z.string().regex(URL_REGEX, 'Invalid URL format').optional(),
    nextSteps: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(), // Safety warnings
    snapshot: z.record(z.string(), z.unknown()).optional(), // Snapshot info for undo
});
//# sourceMappingURL=shared.js.map