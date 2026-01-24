/**
 * Tool: sheets_quality
 * Enterprise quality assurance: validation, conflict detection, and impact analysis.
 *
 * Actions (4):
 * - validate: Data validation with built-in validators
 * - detect_conflicts: Detect concurrent modification conflicts
 * - resolve_conflict: Resolve detected conflicts with strategies
 * - analyze_impact: Pre-execution impact analysis with dependency tracking
 */

import { z } from 'zod';
import {
  A1NotationSchema,
  CellValueSchema,
  ErrorDetailSchema,
  ResponseMetaSchema,
  SafetyOptionsSchema,
  type ToolAnnotations,
} from './shared.js';

// ============================================================================
// Common Schemas
// ============================================================================

const CommonFieldsSchema = z.object({
  safety: SafetyOptionsSchema.optional().describe(
    'Safety options (dryRun to test validation rules without applying, etc.)'
  ),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'
    ),
});

// ============================================================================
// Individual Action Schemas
// ============================================================================

const ValidateActionSchema = CommonFieldsSchema.extend({
  action: z.literal('validate').describe('Validate data using built-in validators'),
  value: z.unknown().describe('Value to validate'),
  rules: z
    .array(z.string())
    .optional()
    .describe('Validation rule IDs to apply - all rules if omitted'),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Validation context: spreadsheetId, sheetName, range, etc.'),
  stopOnFirstError: z
    .boolean()
    .optional()
    .default(false)
    .describe('Stop validation on first error (default: false)'),
});

const DetectConflictsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('detect_conflicts').describe('Detect concurrent modification conflicts'),
  spreadsheetId: z.string().min(1).describe('Spreadsheet ID from URL'),
  range: A1NotationSchema.optional().describe(
    'Range to check (A1 notation) - entire sheet if omitted'
  ),
  since: z
    .number()
    .optional()
    .describe('Timestamp to check conflicts since (ms) - checks all history if omitted'),
});

const ResolveConflictActionSchema = CommonFieldsSchema.extend({
  action: z.literal('resolve_conflict').describe('Resolve a detected conflict with a strategy'),
  conflictId: z.string().min(1).describe('Conflict ID from detect_conflicts response'),
  strategy: z
    .enum(['keep_local', 'keep_remote', 'merge', 'manual'])
    .describe('Resolution strategy: keep_local, keep_remote, merge, or manual'),
  mergedValue: CellValueSchema.optional().describe(
    'Merged value for manual resolution strategy (required if strategy=manual)'
  ),
});

const AnalyzeImpactActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('analyze_impact')
    .describe('Pre-execution impact analysis with dependency tracking'),
  spreadsheetId: z.string().min(1).describe('Spreadsheet ID from URL'),
  operation: z
    .object({
      type: z
        .string()
        .min(1)
        .describe(
          'Operation type (e.g., "values_write", "sheet_delete", "format_update", "dimension_change")'
        ),
      tool: z
        .string()
        .min(1)
        .regex(/^sheets_[a-z]+$/, 'Tool name must start with "sheets_" (e.g., "sheets_data")')
        .describe('Tool name - must be a valid sheets_* tool'),
      action: z
        .string()
        .min(1)
        .describe('Action name within the tool (e.g., "write", "clear", "format")'),
      params: z
        .record(z.string(), z.unknown())
        .describe('Operation parameters that will be passed to the tool'),
    })
    .describe('Operation to analyze for impact before execution'),
});

// ============================================================================
// Combined Input Schema
// ============================================================================

/**
 * All quality assurance operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsQualityInputSchema = z.object({
  request: z.discriminatedUnion('action', [
    ValidateActionSchema,
    DetectConflictsActionSchema,
    ResolveConflictActionSchema,
    AnalyzeImpactActionSchema,
  ]),
});

const QualityResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // VALIDATE response fields
    valid: z.boolean().optional(),
    errorCount: z.coerce.number().optional(),
    warningCount: z.coerce.number().optional(),
    infoCount: z.coerce.number().optional(),
    totalChecks: z.coerce.number().optional(),
    passedChecks: z.coerce.number().optional(),
    errors: z
      .array(
        z.object({
          ruleId: z.string(),
          ruleName: z.string(),
          severity: z.enum(['error', 'warning', 'info']),
          message: z.string(),
          actualValue: z.unknown().optional(),
          expectedValue: z.unknown().optional(),
          path: z.string().optional(),
        })
      )
      .optional(),
    warnings: z
      .array(
        z.object({
          ruleId: z.string(),
          ruleName: z.string(),
          message: z.string(),
        })
      )
      .optional(),
    duration: z.coerce.number().optional(),
    // Dry run preview
    dryRun: z.boolean().optional().describe('True if this was a dry run (no changes applied)'),
    validationPreview: z
      .object({
        wouldApply: z.boolean().describe('Whether validation would be applied'),
        affectedCells: z
          .number()
          .int()
          .optional()
          .describe('Number of cells that would be affected'),
        rulesPreview: z
          .array(
            z.object({
              ruleId: z.string(),
              condition: z.string(),
              cellsAffected: z.coerce.number().int(),
            })
          )
          .optional(),
      })
      .optional()
      .describe('Preview of what would happen (when dryRun=true)'),
    // DETECT_CONFLICTS response fields
    conflicts: z
      .array(
        z.object({
          id: z.string(),
          spreadsheetId: z.string(),
          range: z.string(),
          localVersion: z.coerce.number(),
          remoteVersion: z.coerce.number(),
          localValue: z.unknown(),
          remoteValue: z.unknown(),
          conflictType: z.enum(['concurrent_write', 'version_mismatch', 'data_race']),
          severity: z.enum(['low', 'medium', 'high', 'critical']),
          detectedAt: z.coerce.number(),
          suggestedStrategy: z.enum(['keep_local', 'keep_remote', 'merge', 'manual']),
        })
      )
      .optional(),
    // RESOLVE_CONFLICT response fields
    conflictId: z.string().optional(),
    resolved: z.boolean().optional(),
    resolution: z
      .object({
        strategy: z.string(),
        finalValue: z.unknown(),
        version: z.coerce.number(),
      })
      .optional(),
    // ANALYZE_IMPACT response fields
    impact: z
      .object({
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        scope: z.object({
          rows: z.coerce.number(),
          columns: z.coerce.number(),
          cells: z.coerce.number(),
          sheets: z.array(z.string()),
        }),
        affectedResources: z.object({
          formulas: z.array(z.string()),
          charts: z.array(z.string()),
          pivotTables: z.array(z.string()),
          validationRules: z.array(z.string()),
          namedRanges: z.array(z.string()),
          protectedRanges: z.array(z.string()),
        }),
        estimatedExecutionTime: z.coerce.number(),
        warnings: z.array(
          z.object({
            severity: z.enum(['low', 'medium', 'high', 'critical']),
            message: z.string(),
            affectedResources: z.array(z.string()).optional(),
          })
        ),
        recommendations: z.array(
          z.object({
            action: z.string(),
            reason: z.string(),
            priority: z.enum(['low', 'medium', 'high']),
          })
        ),
        canProceed: z.boolean(),
        requiresConfirmation: z.boolean(),
      })
      .optional(),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsQualityOutputSchema = z.object({
  response: QualityResponseSchema,
});

export const SHEETS_QUALITY_ANNOTATIONS: ToolAnnotations = {
  title: 'Quality Assurance',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export type SheetsQualityInput = z.infer<typeof SheetsQualityInputSchema>;
export type SheetsQualityOutput = z.infer<typeof SheetsQualityOutputSchema>;
export type QualityResponse = z.infer<typeof QualityResponseSchema>;

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type QualityValidateInput = SheetsQualityInput['request'] & {
  action: 'validate';
  value: unknown;
};

export type QualityDetectConflictsInput = SheetsQualityInput['request'] & {
  action: 'detect_conflicts';
  spreadsheetId: string;
};

export type QualityResolveConflictInput = SheetsQualityInput['request'] & {
  action: 'resolve_conflict';
  conflictId: string;
  strategy: 'keep_local' | 'keep_remote' | 'merge' | 'manual';
};

export type QualityAnalyzeImpactInput = SheetsQualityInput['request'] & {
  action: 'analyze_impact';
  spreadsheetId: string;
  operation: {
    type: string;
    tool: string;
    action: string;
    params: Record<string, unknown>;
  };
};
