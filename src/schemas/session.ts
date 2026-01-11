/**
 * ServalSheets - Session Tool Schema
 *
 * Tool for managing conversation-level context.
 * Enables natural language references like "the spreadsheet", "undo that", etc.
 *
 * @module schemas/session
 */

import { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// INPUT SCHEMAS (Actions)
// ============================================================================

const SetActiveSpreadsheetSchema = z.object({
  action: z.literal("set_active"),
  spreadsheetId: z.string().describe("Spreadsheet ID to set as active"),
  title: z.string().describe("Spreadsheet title for natural reference"),
  sheetNames: z.array(z.string()).describe("List of sheet names"),
});

const GetActiveSpreadsheetSchema = z.object({
  action: z.literal("get_active"),
});

const GetContextSchema = z.object({
  action: z.literal("get_context"),
});

const RecordOperationSchema = z.object({
  action: z.literal("record_operation"),
  tool: z.string().describe("Tool that was called"),
  toolAction: z.string().describe("Action within the tool"),
  spreadsheetId: z.string().describe("Spreadsheet affected"),
  range: z.string().optional().describe("Range affected"),
  description: z.string().describe("Human-readable description"),
  undoable: z.boolean().describe("Can this be undone?"),
  snapshotId: z.string().optional().describe("Snapshot ID if created"),
  cellsAffected: z.number().optional().describe("Number of cells affected"),
});

const GetLastOperationSchema = z.object({
  action: z.literal("get_last_operation"),
});

const GetHistorySchema = z.object({
  action: z.literal("get_history"),
  limit: z.number().min(1).max(20).optional().describe("Max operations to return (default: 10)"),
});

const FindByReferenceSchema = z.object({
  action: z.literal("find_by_reference"),
  reference: z.string().describe("Natural language reference like 'that', 'the budget', 'the last write'"),
  type: z.enum(["spreadsheet", "operation"]).describe("What to find"),
});

const UpdatePreferencesSchema = z.object({
  action: z.literal("update_preferences"),
  confirmationLevel: z.enum(["always", "destructive", "never"]).optional(),
  dryRunDefault: z.boolean().optional(),
  snapshotDefault: z.boolean().optional(),
});

const GetPreferencesSchema = z.object({
  action: z.literal("get_preferences"),
});

const SetPendingOperationSchema = z.object({
  action: z.literal("set_pending"),
  type: z.string().describe("Type of pending operation"),
  step: z.number().describe("Current step number"),
  totalSteps: z.number().describe("Total steps"),
  context: z.record(z.string(), z.unknown()).describe("Operation context data"),
});

const GetPendingOperationSchema = z.object({
  action: z.literal("get_pending"),
});

const ClearPendingOperationSchema = z.object({
  action: z.literal("clear_pending"),
});

const ResetSessionSchema = z.object({
  action: z.literal("reset"),
});

// ============================================================================
// COMBINED INPUT SCHEMA
// ============================================================================

export const SheetsSessionInputSchema = z.discriminatedUnion("action", [
  SetActiveSpreadsheetSchema,
  GetActiveSpreadsheetSchema,
  GetContextSchema,
  RecordOperationSchema,
  GetLastOperationSchema,
  GetHistorySchema,
  FindByReferenceSchema,
  UpdatePreferencesSchema,
  GetPreferencesSchema,
  SetPendingOperationSchema,
  GetPendingOperationSchema,
  ClearPendingOperationSchema,
  ResetSessionSchema,
]);

export type SheetsSessionInput = z.infer<typeof SheetsSessionInputSchema>;

// ============================================================================
// OUTPUT SCHEMAS
// ============================================================================

const SpreadsheetContextSchema = z.object({
  spreadsheetId: z.string(),
  title: z.string(),
  activatedAt: z.number(),
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
  timestamp: z.number(),
  undoable: z.boolean(),
  snapshotId: z.string().optional(),
  cellsAffected: z.number().optional(),
});

const PreferencesSchema = z.object({
  confirmationLevel: z.enum(["always", "destructive", "never"]),
  defaultSafety: z.object({
    dryRun: z.boolean(),
    createSnapshot: z.boolean(),
  }),
  formatting: z.object({
    headerStyle: z.enum(["bold", "bold-colored", "minimal"]),
    dateFormat: z.string(),
    currencyFormat: z.string(),
  }),
});

const PendingOperationSchema = z.object({
  type: z.string(),
  step: z.number(),
  totalSteps: z.number(),
  context: z.record(z.string(), z.unknown()),
}).nullable();

// Success responses
const SetActiveSuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal("set_active"),
  spreadsheet: SpreadsheetContextSchema,
});

const GetActiveSuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal("get_active"),
  spreadsheet: SpreadsheetContextSchema.nullable(),
  recentSpreadsheets: z.array(SpreadsheetContextSchema),
});

const GetContextSuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal("get_context"),
  summary: z.string(),
  activeSpreadsheet: SpreadsheetContextSchema.nullable(),
  lastOperation: OperationRecordSchema.nullable(),
  pendingOperation: PendingOperationSchema,
  suggestedActions: z.array(z.string()),
});

const RecordOperationSuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal("record_operation"),
  operationId: z.string(),
});

const GetLastOperationSuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal("get_last_operation"),
  operation: OperationRecordSchema.nullable(),
});

const GetHistorySuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal("get_history"),
  operations: z.array(OperationRecordSchema),
});

const FindByReferenceSuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal("find_by_reference"),
  found: z.boolean(),
  spreadsheet: SpreadsheetContextSchema.nullable().optional(),
  operation: OperationRecordSchema.nullable().optional(),
});

const PreferencesSuccessSchema = z.object({
  success: z.literal(true),
  action: z.enum(["update_preferences", "get_preferences"]),
  preferences: PreferencesSchema,
});

const PendingSuccessSchema = z.object({
  success: z.literal(true),
  action: z.enum(["set_pending", "get_pending", "clear_pending"]),
  pending: PendingOperationSchema,
});

const ResetSuccessSchema = z.object({
  success: z.literal(true),
  action: z.literal("reset"),
  message: z.string(),
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

// Combined output
export const SheetsSessionOutputSchema = z.object({
  response: z.union([
    SetActiveSuccessSchema,
    GetActiveSuccessSchema,
    GetContextSuccessSchema,
    RecordOperationSuccessSchema,
    GetLastOperationSuccessSchema,
    GetHistorySuccessSchema,
    FindByReferenceSuccessSchema,
    PreferencesSuccessSchema,
    PendingSuccessSchema,
    ResetSuccessSchema,
    ErrorResponseSchema,
  ]),
});

export type SheetsSessionOutput = z.infer<typeof SheetsSessionOutputSchema>;

// ============================================================================
// TOOL ANNOTATIONS
// ============================================================================

export const SHEETS_SESSION_ANNOTATIONS: ToolAnnotations = {
  title: "Session Context",
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
• Set active: {"action":"set_active","spreadsheetId":"1ABC...","title":"Q4 Budget","sheetNames":["Data","Summary"]}
• Get context: {"action":"get_context"} → Returns summary + suggestions
• Find reference: {"action":"find_by_reference","reference":"that","type":"operation"} → Finds last operation
• Record op: {"action":"record_operation","tool":"sheets_values","toolAction":"write",...}

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
