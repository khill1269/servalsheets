/**
 * ServalSheets - Fix Tool Schema
 *
 * Automated issue resolution and data cleaning.
 * Takes issues from sheets_analyze and applies fixes (F0),
 * plus automated data cleaning pipeline (F3).
 */

import { z } from 'zod';

// Issue types that can be auto-fixed
export const FixableIssueTypeSchema = z.enum([
  'MULTIPLE_TODAY',
  'FULL_COLUMN_REFS',
  'NO_FROZEN_HEADERS',
  'NO_FROZEN_COLUMNS',
  'NO_PROTECTION',
  'NESTED_IFERROR',
  'EXCESSIVE_CF_RULES',
]);

export type FixableIssueType = z.infer<typeof FixableIssueTypeSchema>;

// Fix modes
export const FixModeSchema = z.enum(['preview', 'apply']);
export type FixMode = z.infer<typeof FixModeSchema>;

// Individual issue to fix
export const IssueToFixSchema = z.object({
  type: FixableIssueTypeSchema,
  severity: z.enum(['low', 'medium', 'high']),
  sheet: z.string().optional(),
  description: z.string(),
  metadata: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.any()),
        z.record(z.string(), z.any()),
      ])
    )
    .optional(), // Extra context
});

export type IssueToFix = z.infer<typeof IssueToFixSchema>;

// Fix request filters
const FixFiltersSchema = z.object({
  severity: z
    .array(z.enum(['low', 'medium', 'high']))
    .optional()
    .describe('Only fix these severities'),
  types: z.array(FixableIssueTypeSchema).optional().describe('Only fix these issue types'),
  sheets: z.array(z.string()).optional().describe('Only fix issues in these sheets'),
  limit: z.number().min(1).max(100).optional().describe('Max number of fixes to apply'),
});

// Fix safety options
const FixSafetySchema = z.object({
  createSnapshot: z.boolean().default(true).describe('Create snapshot before applying fixes'),
  dryRun: z.boolean().default(false).describe('Simulate fixes without applying'),
});

// Operation that will be executed
export const FixOperationSchema = z.object({
  id: z.string().describe('Unique operation ID'),
  issueType: FixableIssueTypeSchema,
  tool: z.string().describe('Tool to call (e.g., sheets_data, sheets_dimensions)'),
  action: z.string().describe('Action to perform'),
  parameters: z
    .record(
      z.string(),
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.any()),
        z.record(z.string(), z.any()),
      ])
    )
    .describe('Parameters for the tool (can be string, number, boolean, null, array, or object)'),
  estimatedImpact: z.string().describe('What this operation will change'),
  risk: z.enum(['low', 'medium', 'high']).describe('Risk level of this operation'),
});

export type FixOperation = z.infer<typeof FixOperationSchema>;

// Fix result
export const FixResultSchema = z.object({
  operationId: z.string(),
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

export type FixResult = z.infer<typeof FixResultSchema>;

// ─── F3: Cleaning types ───

// Cleaning rule definition
export const CleanRuleSchema = z.object({
  id: z.string().describe('Rule identifier (e.g., trim_whitespace, fix_dates)'),
  column: z
    .string()
    .optional()
    .describe('Column letter or header name to apply rule to (all columns if omitted)'),
  enabled: z.boolean().default(true).describe('Whether this rule is active'),
});

export type CleanRule = z.infer<typeof CleanRuleSchema>;

// Format specification for standardize_formats
export const FormatSpecSchema = z.object({
  column: z.string().describe('Column letter (A, B, ...) or header name'),
  targetFormat: z
    .enum([
      'iso_date',
      'us_date',
      'eu_date',
      'currency_usd',
      'currency_eur',
      'currency_gbp',
      'number_plain',
      'percentage',
      'phone_e164',
      'phone_national',
      'email_lowercase',
      'url_https',
      'title_case',
      'upper_case',
      'lower_case',
      'boolean',
    ])
    .describe('Target format to normalize values to'),
});

export type FormatSpec = z.infer<typeof FormatSpecSchema>;

// Fill strategy for fill_missing
export const FillStrategySchema = z.enum([
  'forward',
  'backward',
  'mean',
  'median',
  'mode',
  'constant',
]);

export type FillStrategy = z.infer<typeof FillStrategySchema>;

// Anomaly detection method
export const AnomalyMethodSchema = z.enum(['iqr', 'zscore', 'modified_zscore']);

export type AnomalyMethod = z.infer<typeof AnomalyMethodSchema>;

// Cell change record (used in cleaning results)
export const CellChangeSchema = z.object({
  row: z.number(),
  col: z.number(),
  cell: z.string().describe('A1 reference (e.g., B5)'),
  oldValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  newValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  rule: z.string().describe('Rule that triggered this change'),
});

export type CellChange = z.infer<typeof CellChangeSchema>;

// Anomaly record
export const AnomalyRecordSchema = z.object({
  cell: z.string().describe('A1 reference'),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  score: z.number().describe('Anomaly score (distance from normal)'),
  column: z.string().describe('Column header or letter'),
  method: AnomalyMethodSchema,
  threshold: z.number(),
  isAnomaly: z.boolean(),
});

export type AnomalyRecord = z.infer<typeof AnomalyRecordSchema>;

// Cleaning recommendation (from suggest_cleaning)
export const CleaningRecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  column: z.string().optional(),
  issueCount: z.number().describe('Number of affected cells'),
  severity: z.enum(['low', 'medium', 'high']),
  suggestedRule: z.string().describe('Rule ID to apply'),
  sampleBefore: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .describe('Sample values before cleaning'),
  sampleAfter: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .describe('Sample values after cleaning'),
});

export type CleaningRecommendation = z.infer<typeof CleaningRecommendationSchema>;

// ─── Response schema ───

// Response from sheets_fix (supports both F0 fix and F3 cleaning actions)
export const SheetsFixResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    mode: FixModeSchema,
    operations: z.array(FixOperationSchema).describe('Operations that were/will be executed'),
    results: z.array(FixResultSchema).optional().describe('Results (only in apply mode)'),
    snapshotId: z.string().optional().describe('Snapshot ID for rollback'),
    summary: z.object({
      total: z.number(),
      applied: z.number().optional(),
      failed: z.number().optional(),
      skipped: z.number().optional(),
    }),
    message: z.string(),
    verificationScore: z.number().min(0).max(100).optional().describe('Re-analyzed quality score'),

    // F3: Cleaning action results
    action: z.string().optional().describe('Action that was executed'),

    // clean action results
    changes: z
      .array(CellChangeSchema)
      .optional()
      .describe('Cell-level changes applied or previewed'),
    cleaningSummary: z
      .object({
        totalCells: z.number(),
        cellsCleaned: z.number(),
        rulesApplied: z.array(z.string()),
        byRule: z.record(z.string(), z.number()).optional(),
      })
      .optional()
      .describe('Cleaning operation summary'),

    // standardize_formats results
    formatChanges: z.array(CellChangeSchema).optional().describe('Format normalization changes'),
    formatSummary: z
      .object({
        columnsProcessed: z.number(),
        cellsChanged: z.number(),
        byFormat: z.record(z.string(), z.number()).optional(),
      })
      .optional()
      .describe('Format standardization summary'),

    // fill_missing results
    fillChanges: z.array(CellChangeSchema).optional().describe('Cells that were filled'),
    fillSummary: z
      .object({
        totalEmpty: z.number(),
        filled: z.number(),
        strategy: FillStrategySchema.optional(),
        byColumn: z.record(z.string(), z.number()).optional(),
      })
      .optional()
      .describe('Fill missing summary'),

    // detect_anomalies results
    anomalies: z.array(AnomalyRecordSchema).optional().describe('Detected anomalies'),
    anomalySummary: z
      .object({
        totalCellsAnalyzed: z.number(),
        anomaliesFound: z.number(),
        method: AnomalyMethodSchema.optional(),
        threshold: z.number().optional(),
        byColumn: z.record(z.string(), z.number()).optional(),
      })
      .optional()
      .describe('Anomaly detection summary'),

    // suggest_cleaning results
    recommendations: z
      .array(CleaningRecommendationSchema)
      .optional()
      .describe('AI-powered cleaning recommendations'),
    dataProfile: z
      .object({
        totalRows: z.number(),
        totalColumns: z.number(),
        nullRate: z.number().describe('Overall null/empty percentage'),
        columnProfiles: z
          .array(
            z.object({
              column: z.string(),
              header: z.string().optional(),
              type: z.string().describe('Detected dominant type'),
              nullCount: z.number(),
              uniqueCount: z.number(),
              sampleValues: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
            })
          )
          .optional(),
      })
      .optional()
      .describe('Data profile used for cleaning suggestions'),
  }),
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z
        .union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
          z.array(z.any()),
          z.record(z.string(), z.any()),
        ])
        .optional(),
      retryable: z.boolean(),
      suggestedFix: z.string().optional(),
    }),
  }),
]);

export type SheetsFixResponse = z.infer<typeof SheetsFixResponseSchema>;

// Verbosity level for response filtering
const VerbositySchema = z
  .enum(['minimal', 'standard', 'detailed'])
  .optional()
  .default('standard')
  .describe(
    'Response verbosity: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
  );

// ─── INPUT SCHEMAS ───

// Original fix action (F0)
const FixActionSchema = z.object({
  action: z.literal('fix').describe('Apply automated fixes to identified issues'),
  spreadsheetId: z.string().describe('Spreadsheet ID to fix'),
  issues: z
    .array(IssueToFixSchema)
    .describe(
      'Issues to fix (from sheets_analyze). Each issue needs: { type: "volatile_formula"|"missing_freeze"|..., severity: "low"|"medium"|"high", description: "...", sheet?: "Sheet1", metadata?: {} }'
    ),
  mode: FixModeSchema.optional().describe(
    'preview = show what would be fixed, apply = actually fix'
  ),
  filters: FixFiltersSchema.optional().describe('Filter issues to fix'),
  safety: FixSafetySchema.optional().describe('Safety options'),
  verbosity: VerbositySchema,
});

// F3: Automated Data Cleaning actions

const CleanActionSchema = z.object({
  action: z.literal('clean').describe('Auto-detect and fix common data quality issues'),
  spreadsheetId: z.string().describe('Spreadsheet ID'),
  range: z.string().describe('A1 range to clean (e.g., "Sheet1!A1:Z100")'),
  rules: z
    .array(CleanRuleSchema)
    .optional()
    .describe(
      'Specific cleaning rules to apply. If omitted, auto-detects applicable rules. Built-in rules: trim_whitespace, normalize_case, fix_dates, fix_numbers, fix_booleans, remove_duplicates, fix_emails, fix_phones, fix_urls, fix_currency'
    ),
  mode: FixModeSchema.optional()
    .default('preview')
    .describe('preview = show what would change, apply = write changes'),
  safety: FixSafetySchema.optional().describe('Safety options'),
  verbosity: VerbositySchema,
});

const StandardizeFormatsActionSchema = z.object({
  action: z
    .literal('standardize_formats')
    .describe('Normalize date, currency, phone, and text formats in specified columns'),
  spreadsheetId: z.string().describe('Spreadsheet ID'),
  range: z.string().describe('A1 range to standardize (e.g., "Sheet1!A1:Z100")'),
  columns: z
    .array(FormatSpecSchema)
    .describe(
      'Columns and their target formats. Example: [{ column: "A", targetFormat: "iso_date" }, { column: "C", targetFormat: "currency_usd" }]'
    ),
  mode: FixModeSchema.optional()
    .default('preview')
    .describe('preview = show what would change, apply = write changes'),
  safety: FixSafetySchema.optional().describe('Safety options'),
  verbosity: VerbositySchema,
});

const FillMissingActionSchema = z.object({
  action: z
    .literal('fill_missing')
    .describe('Fill empty cells using a statistical or fixed strategy'),
  spreadsheetId: z.string().describe('Spreadsheet ID'),
  range: z.string().describe('A1 range to fill (e.g., "Sheet1!A1:Z100")'),
  strategy: FillStrategySchema.describe(
    'Fill strategy: forward (last known value), backward (next known value), mean, median, mode (column statistics), constant (user-provided value)'
  ),
  constantValue: z
    .union([z.string(), z.number(), z.boolean()])
    .optional()
    .describe('Value to fill when strategy=constant'),
  columns: z
    .array(z.string())
    .optional()
    .describe('Specific columns to fill (all columns if omitted)'),
  mode: FixModeSchema.optional()
    .default('preview')
    .describe('preview = show what would be filled, apply = write values'),
  safety: FixSafetySchema.optional().describe('Safety options'),
  verbosity: VerbositySchema,
});

const DetectAnomaliesActionSchema = z.object({
  action: z.literal('detect_anomalies').describe('Flag statistical outliers in numeric columns'),
  spreadsheetId: z.string().describe('Spreadsheet ID'),
  range: z.string().describe('A1 range to analyze (e.g., "Sheet1!A1:Z100")'),
  method: AnomalyMethodSchema.optional()
    .default('iqr')
    .describe(
      'Detection method: iqr (interquartile range), zscore (standard deviations), modified_zscore (robust)'
    ),
  threshold: z
    .number()
    .optional()
    .describe('Anomaly threshold (default: 1.5 for IQR, 3.0 for zscore, 3.5 for modified_zscore)'),
  columns: z
    .array(z.string())
    .optional()
    .describe('Specific numeric columns to analyze (auto-detects numeric columns if omitted)'),
  verbosity: VerbositySchema,
});

const SuggestCleaningActionSchema = z.object({
  action: z
    .literal('suggest_cleaning')
    .describe('Profile data and provide AI-powered cleaning recommendations (read-only)'),
  spreadsheetId: z.string().describe('Spreadsheet ID'),
  range: z.string().describe('A1 range to profile (e.g., "Sheet1!A1:Z100")'),
  maxRecommendations: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe('Maximum number of recommendations to return'),
  verbosity: VerbositySchema,
});

// ─── Combined input schema ───

export const SheetsFixInputSchema = z.object({
  request: z.discriminatedUnion('action', [
    FixActionSchema,
    CleanActionSchema,
    StandardizeFormatsActionSchema,
    FillMissingActionSchema,
    DetectAnomaliesActionSchema,
    SuggestCleaningActionSchema,
  ]),
});

export const SheetsFixOutputSchema = z.object({
  response: SheetsFixResponseSchema,
});

export type SheetsFixInput = z.infer<typeof SheetsFixInputSchema>;
export type SheetsFixOutput = z.infer<typeof SheetsFixOutputSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type FixRequest = SheetsFixInput['request'];

// Type narrowing helpers for handler methods
export type FixInput = SheetsFixInput['request'] & {
  action: 'fix';
  spreadsheetId: string;
  issues: IssueToFix[];
};

export type CleanInput = SheetsFixInput['request'] & {
  action: 'clean';
  spreadsheetId: string;
  range: string;
};

export type StandardizeFormatsInput = SheetsFixInput['request'] & {
  action: 'standardize_formats';
  spreadsheetId: string;
  range: string;
  columns: FormatSpec[];
};

export type FillMissingInput = SheetsFixInput['request'] & {
  action: 'fill_missing';
  spreadsheetId: string;
  range: string;
  strategy: FillStrategy;
};

export type DetectAnomaliesInput = SheetsFixInput['request'] & {
  action: 'detect_anomalies';
  spreadsheetId: string;
  range: string;
};

export type SuggestCleaningInput = SheetsFixInput['request'] & {
  action: 'suggest_cleaning';
  spreadsheetId: string;
  range: string;
};

// Tool annotations for MCP registration
import type { ToolAnnotations } from './shared.js';

export const SHEETS_FIX_ANNOTATIONS: ToolAnnotations = {
  title: 'Automated Issue Fixing & Data Cleaning',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};
