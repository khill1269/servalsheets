/**
 * ServalSheets - Fix Tool Schema
 *
 * Automated issue resolution based on analysis results.
 * Takes issues from sheets_analyze and applies fixes.
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
  metadata: z.record(z.string(), z.unknown()).optional(), // Extra context
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
  parameters: z.record(z.string(), z.unknown()).describe('Parameters for the tool'),
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

// Response from sheets_fix
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
  }),
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
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

// INPUT SCHEMA: Discriminated union (1 action)
const FixActionSchema = z.object({
  action: z.literal('fix').describe('Apply automated fixes to identified issues'),
  spreadsheetId: z.string().describe('Spreadsheet ID to fix'),
  issues: z.array(IssueToFixSchema).describe('Issues to fix (from sheets_analyze)'),
  mode: FixModeSchema.optional().describe(
    'preview = show what would be fixed, apply = actually fix'
  ),
  filters: FixFiltersSchema.optional().describe('Filter issues to fix'),
  safety: FixSafetySchema.optional().describe('Safety options'),
  verbosity: VerbositySchema,
});

export const SheetsFixInputSchema = z.object({
  request: z.discriminatedUnion('action', [FixActionSchema]),
});

export const SheetsFixOutputSchema = z.object({
  response: SheetsFixResponseSchema,
});

export type SheetsFixInput = z.infer<typeof SheetsFixInputSchema>;
export type SheetsFixOutput = z.infer<typeof SheetsFixOutputSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type FixRequest = SheetsFixInput['request'];

// Type narrowing helper for handler methods
// This provides type safety similar to discriminated union Extract<>
export type FixInput = SheetsFixInput['request'] & {
  action: 'fix';
  spreadsheetId: string;
  issues: IssueToFix[];
};

// Tool annotations for MCP registration
import type { ToolAnnotations } from './shared.js';

export const SHEETS_FIX_ANNOTATIONS: ToolAnnotations = {
  title: 'Automated Issue Fixing',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};
