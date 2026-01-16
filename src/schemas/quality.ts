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

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsQualityInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum(['validate', 'detect_conflicts', 'resolve_conflict', 'analyze_impact'])
      .describe('The quality operation to perform'),

    // Fields for VALIDATE action
    value: z.unknown().optional().describe('Value to validate (required for: validate)'),
    rules: z
      .array(z.string())
      .optional()
      .describe('Validation rule IDs to apply - all rules if omitted (validate only)'),
    context: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Validation context: spreadsheetId, sheetName, range, etc. (validate only)'),
    stopOnFirstError: z
      .boolean()
      .optional()
      .describe('Stop validation on first error, default: false (validate only)'),

    // Fields for DETECT_CONFLICTS and ANALYZE_IMPACT actions
    spreadsheetId: z
      .string()
      .min(1)
      .optional()
      .describe('Spreadsheet ID (required for: detect_conflicts, analyze_impact)'),

    // Fields for DETECT_CONFLICTS action
    range: A1NotationSchema.optional().describe(
      'Range to check (A1 notation) (detect_conflicts only)'
    ),
    since: z
      .number()
      .optional()
      .describe('Timestamp to check conflicts since (ms) (detect_conflicts only)'),

    // Fields for RESOLVE_CONFLICT action
    conflictId: z
      .string()
      .min(1)
      .optional()
      .describe('Conflict ID to resolve (required for: resolve_conflict)'),
    strategy: z
      .enum(['keep_local', 'keep_remote', 'merge', 'manual'])
      .optional()
      .describe('Resolution strategy (required for: resolve_conflict)'),
    mergedValue: CellValueSchema.optional().describe('Merged value for manual resolution strategy'),

    // Fields for ANALYZE_IMPACT action
    operation: z
      .object({
        type: z.string().describe('Operation type (e.g., "values_write", "sheet_delete")'),
        tool: z.string().describe('Tool name (e.g., "sheets_values")'),
        action: z.string().describe('Action name (e.g., "write", "clear")'),
        params: z.record(z.string(), z.unknown()).describe('Operation parameters'),
      })
      .optional()
      .describe('Operation to analyze (required for: analyze_impact)'),

    // Safety options (common to all actions)
    safety: SafetyOptionsSchema.optional().describe(
      'Safety options (dryRun to test validation rules without applying, etc.)'
    ),

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
      // Validate required fields based on action
      switch (data.action) {
        case 'validate':
          return data.value !== undefined;
        case 'detect_conflicts':
          return !!data.spreadsheetId;
        case 'resolve_conflict':
          return !!data.conflictId && !!data.strategy;
        case 'analyze_impact':
          return !!data.spreadsheetId && !!data.operation;
        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );

const QualityResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // VALIDATE response fields
    valid: z.boolean().optional(),
    errorCount: z.number().optional(),
    warningCount: z.number().optional(),
    infoCount: z.number().optional(),
    totalChecks: z.number().optional(),
    passedChecks: z.number().optional(),
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
    duration: z.number().optional(),
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
              cellsAffected: z.number().int(),
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
          localVersion: z.number(),
          remoteVersion: z.number(),
          localValue: z.unknown(),
          remoteValue: z.unknown(),
          conflictType: z.enum(['concurrent_write', 'version_mismatch', 'data_race']),
          severity: z.enum(['low', 'medium', 'high', 'critical']),
          detectedAt: z.number(),
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
        version: z.number(),
      })
      .optional(),
    // ANALYZE_IMPACT response fields
    impact: z
      .object({
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        scope: z.object({
          rows: z.number(),
          columns: z.number(),
          cells: z.number(),
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
        estimatedExecutionTime: z.number(),
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
export type QualityValidateInput = SheetsQualityInput & {
  action: 'validate';
  value: unknown;
};

export type QualityDetectConflictsInput = SheetsQualityInput & {
  action: 'detect_conflicts';
  spreadsheetId: string;
};

export type QualityResolveConflictInput = SheetsQualityInput & {
  action: 'resolve_conflict';
  conflictId: string;
  strategy: 'keep_local' | 'keep_remote' | 'merge' | 'manual';
};

export type QualityAnalyzeImpactInput = SheetsQualityInput & {
  action: 'analyze_impact';
  spreadsheetId: string;
  operation: {
    type: string;
    tool: string;
    action: string;
    params: Record<string, unknown>;
  };
};
