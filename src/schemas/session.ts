/**
 * ServalSheets - Session Tool Schema
 *
 * Tool for managing conversation-level context.
 * Enables natural language references like "the spreadsheet", "undo that", etc.
 *
 * @module schemas/session
 */

import { z } from 'zod';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Common Schemas
// ============================================================================

const CommonFieldsSchema = z.object({
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

const SetActiveActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_active').describe('Set the active spreadsheet for natural references'),
  spreadsheetId: z.string().describe('Spreadsheet ID from URL'),
  title: z.string().describe('Spreadsheet title for natural reference'),
  sheetNames: z
    .array(z.string())
    .optional()
    .default([])
    .describe('List of sheet names in the spreadsheet (optional, will be fetched if not provided)'),
});

const GetActiveActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_active').describe('Get the currently active spreadsheet'),
});

const GetContextActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_context').describe('Get full conversation context with suggestions'),
});

const RecordOperationActionSchema = CommonFieldsSchema.extend({
  action: z.literal('record_operation').describe('Record a completed operation for undo support'),
  tool: z.string().describe('Tool that was called'),
  toolAction: z.string().describe('Action within the tool'),
  spreadsheetId: z.string().describe('Spreadsheet ID affected'),
  description: z
    .string()
    .min(1, 'Description cannot be empty')
    .max(1000, 'Description exceeds 1000 character limit')
    .describe('Human-readable description (max 1000 chars)'),
  undoable: z.boolean().describe('Whether this operation can be undone'),
  range: z.string().optional().describe('Range affected (A1 notation)'),
  snapshotId: z.string().optional().describe('Snapshot ID if created for rollback'),
  cellsAffected: z.coerce.number().optional().describe('Number of cells affected'),
});

const GetLastOperationActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_last_operation').describe('Get the most recent operation'),
});

const GetHistoryActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_history').describe('Get operation history'),
  limit: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe('Max operations to return (default: 10, max: 20)'),
});

const FindByReferenceActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('find_by_reference')
    .describe('Find spreadsheet or operation by natural language reference'),
  reference: z
    .string()
    .min(1, 'Reference cannot be empty')
    .max(500, 'Reference exceeds 500 character limit')
    .describe(
      'Natural language reference like "that", "the budget", "the last write" (max 500 chars)'
    ),
  referenceType: z
    .enum(['spreadsheet', 'operation'])
    .describe('What to find: spreadsheet or operation'),
});

const UpdatePreferencesActionSchema = CommonFieldsSchema.extend({
  action: z.literal('update_preferences').describe('Update user preferences'),
  confirmationLevel: z
    .enum(['always', 'destructive', 'never'])
    .optional()
    .describe('When to ask for confirmation (always, destructive, or never)'),
  dryRunDefault: z.boolean().optional().describe('Default dry run setting'),
  snapshotDefault: z.boolean().optional().describe('Default snapshot setting'),
});

const GetPreferencesActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_preferences').describe('Get current user preferences'),
});

const SetPendingActionSchema = CommonFieldsSchema.extend({
  action: z.literal('set_pending').describe('Set pending multi-step operation state'),
  type: z.string().describe('Type of pending operation'),
  step: z.coerce.number().describe('Current step number'),
  totalSteps: z.coerce.number().describe('Total number of steps'),
  context: z.record(z.string(), z.unknown()).describe('Operation context data'),
});

const GetPendingActionSchema = CommonFieldsSchema.extend({
  action: z.literal('get_pending').describe('Get pending multi-step operation state'),
});

const ClearPendingActionSchema = CommonFieldsSchema.extend({
  action: z.literal('clear_pending').describe('Clear pending multi-step operation state'),
});

const SaveCheckpointActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('save_checkpoint')
    .describe('Save session state for resuming after context reset'),
  sessionId: z.string().describe('Unique session identifier (e.g., "test-run-1")'),
  description: z.string().optional().describe('Optional description of checkpoint'),
});

const LoadCheckpointActionSchema = CommonFieldsSchema.extend({
  action: z.literal('load_checkpoint').describe('Load and resume from a saved checkpoint'),
  sessionId: z.string().describe('Session ID to resume'),
  timestamp: z.coerce
    .number()
    .optional()
    .describe('Specific checkpoint timestamp (latest if omitted)'),
});

const ListCheckpointsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list_checkpoints').describe('List available checkpoints'),
  sessionId: z.string().optional().describe('Filter by session ID (all if omitted)'),
});

const DeleteCheckpointActionSchema = CommonFieldsSchema.extend({
  action: z.literal('delete_checkpoint').describe('Delete checkpoint(s)'),
  sessionId: z.string().describe('Session ID to delete checkpoints for'),
  timestamp: z.coerce
    .number()
    .optional()
    .describe('Specific checkpoint (all for session if omitted)'),
});

const ResetActionSchema = CommonFieldsSchema.extend({
  action: z.literal('reset').describe('Reset session context to initial state'),
});

// ============================================================================
// Combined Input Schema
// ============================================================================

/**
 * All session context operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsSessionInputSchema = z.object({
  request: z.discriminatedUnion('action', [
    SetActiveActionSchema,
    GetActiveActionSchema,
    GetContextActionSchema,
    RecordOperationActionSchema,
    GetLastOperationActionSchema,
    GetHistoryActionSchema,
    FindByReferenceActionSchema,
    UpdatePreferencesActionSchema,
    GetPreferencesActionSchema,
    SetPendingActionSchema,
    GetPendingActionSchema,
    ClearPendingActionSchema,
    SaveCheckpointActionSchema,
    LoadCheckpointActionSchema,
    ListCheckpointsActionSchema,
    DeleteCheckpointActionSchema,
    ResetActionSchema,
  ]),
});

export type SheetsSessionInput = z.infer<typeof SheetsSessionInputSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type SessionRequest = SheetsSessionInput['request'];

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

const SpreadsheetContextSchema = z.object({
  spreadsheetId: z.string(),
  title: z.string(),
  activatedAt: z.coerce.number(),
  sheetNames: z.array(z.string()),
  lastRange: z.string().optional(),
});

const OperationRecordSchema = z.object({
  id: z.string(),
  tool: z.string(),
  action: z.string(),
  spreadsheetId: z.string(),
  range: z.string().optional(),
  description: z.string(),
  timestamp: z.coerce.number(),
  undoable: z.boolean(),
  snapshotId: z.string().optional(),
  cellsAffected: z.coerce.number().optional(),
});

const PreferencesSchema = z.object({
  confirmationLevel: z.enum(['always', 'destructive', 'never']),
  defaultSafety: z.object({
    dryRun: z.boolean(),
    createSnapshot: z.boolean(),
  }),
  formatting: z.object({
    headerStyle: z.enum(['bold', 'bold-colored', 'minimal']),
    dateFormat: z.string(),
    currencyFormat: z.string(),
  }),
});

const PendingOperationSchema = z
  .object({
    type: z.string(),
    step: z.coerce.number(),
    totalSteps: z.coerce.number(),
    context: z.record(z.string(), z.unknown()),
  })
  .nullable();

const SessionActionSchema = z.enum([
  'set_active',
  'get_active',
  'get_context',
  'record_operation',
  'get_last_operation',
  'get_history',
  'find_by_reference',
  'update_preferences',
  'get_preferences',
  'set_pending',
  'get_pending',
  'clear_pending',
  'save_checkpoint',
  'load_checkpoint',
  'list_checkpoints',
  'delete_checkpoint',
  'reset',
]);

// Success responses
const SessionSuccessSchema = z.object({
  success: z.literal(true),
  action: SessionActionSchema,
  spreadsheet: SpreadsheetContextSchema.nullable().optional(),
  recentSpreadsheets: z.array(SpreadsheetContextSchema).optional(),
  summary: z.string().optional(),
  activeSpreadsheet: SpreadsheetContextSchema.nullable().optional(),
  lastOperation: OperationRecordSchema.nullable().optional(),
  pendingOperation: PendingOperationSchema.optional(),
  suggestedActions: z.array(z.string()).optional(),
  operationId: z.string().optional(),
  operation: OperationRecordSchema.nullable().optional(),
  operations: z.array(OperationRecordSchema).optional(),
  found: z.boolean().optional(),
  preferences: PreferencesSchema.optional(),
  pending: PendingOperationSchema.optional(),
  message: z.string().optional(),
  // Checkpoint fields
  checkpointPath: z.string().optional(),
  checkpoint: z
    .object({
      sessionId: z.string(),
      timestamp: z.coerce.number(),
      createdAt: z.string(),
      description: z.string().optional(),
      completedSteps: z.coerce.number(),
      spreadsheetTitle: z.string().optional(),
    })
    .optional(),
  checkpoints: z
    .array(
      z.object({
        sessionId: z.string(),
        timestamp: z.coerce.number(),
        createdAt: z.string(),
        description: z.string().optional(),
        completedSteps: z.coerce.number(),
        spreadsheetTitle: z.string().optional(),
      })
    )
    .optional(),
  deleted: z.boolean().optional(),
});

// Error response
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean(),
  }),
});

// Combined output - discriminates on success for MCP schema compliance
export const SheetsSessionOutputSchema = z.object({
  response: z.discriminatedUnion('success', [SessionSuccessSchema, ErrorResponseSchema]),
});

export type SheetsSessionOutput = z.infer<typeof SheetsSessionOutputSchema>;

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

export const SHEETS_SESSION_ANNOTATIONS: ToolAnnotations = {
  title: 'Session Context',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

// ============================================================================
// TOOL DESCRIPTION
// ============================================================================

export const SHEETS_SESSION_DESCRIPTION = `🧠 Manage conversation context for natural language interactions. Enables references like "the spreadsheet", "undo that", "continue".

**Why This Tool Matters:**
Users don't say "spreadsheet ID 1ABC..." - they say "the spreadsheet" or "my budget".
This tool tracks what we're working with so Claude can understand natural references.

**Quick Examples:**
• Set active: {"action":"set_active","spreadsheetId":"1ABC...","title":"Q4 Budget"} (sheetNames optional)
• Get context: {"action":"get_context"} → Returns summary + suggestions
• Find reference: {"action":"find_by_reference","reference":"that","type":"operation"} → Finds last operation
• Record op: {"action":"record_operation","tool":"sheets_data","toolAction":"write",...}

**Natural Language Support:**
• "the spreadsheet" → get_active returns current spreadsheet
• "undo that" → find_by_reference finds last undoable operation
• "switch to the budget" → find_by_reference finds by title
• "continue" → get_pending returns multi-step operation state

**When to Use:**
1. ALWAYS call get_context at conversation start
2. Call set_active after opening/creating a spreadsheet
3. Call record_operation after any write operation
4. Call find_by_reference when user uses natural references

**Common Workflows:**
1. Start: get_context → Understand current state
2. After open: set_active → Remember which spreadsheet
3. After write: record_operation → Enable undo
4. User says "undo": find_by_reference → Find operation to undo

**Best Practice:**
Call get_context when unsure what user means - it provides suggestions!`;
