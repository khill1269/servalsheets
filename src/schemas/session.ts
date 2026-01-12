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
// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// ============================================================================
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()

export const SheetsSessionInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum([
        "set_active",
        "get_active",
        "get_context",
        "record_operation",
        "get_last_operation",
        "get_history",
        "find_by_reference",
        "update_preferences",
        "get_preferences",
        "set_pending",
        "get_pending",
        "clear_pending",
        "reset",
      ])
      .describe("The operation to perform on the session"),

    // Fields for SET_ACTIVE action
    spreadsheetId: z
      .string()
      .optional()
      .describe(
        "Spreadsheet ID to set as active (required for: set_active, record_operation)",
      ),
    title: z
      .string()
      .optional()
      .describe(
        "Spreadsheet title for natural reference (required for: set_active)",
      ),
    sheetNames: z
      .array(z.string())
      .optional()
      .describe("List of sheet names (required for: set_active)"),

    // Fields for RECORD_OPERATION action
    tool: z
      .string()
      .optional()
      .describe("Tool that was called (required for: record_operation)"),
    toolAction: z
      .string()
      .optional()
      .describe("Action within the tool (required for: record_operation)"),
    range: z.string().optional().describe("Range affected (record_operation)"),
    description: z
      .string()
      .optional()
      .describe("Human-readable description (required for: record_operation)"),
    undoable: z
      .boolean()
      .optional()
      .describe("Can this be undone? (required for: record_operation)"),
    snapshotId: z
      .string()
      .optional()
      .describe("Snapshot ID if created (record_operation)"),
    cellsAffected: z
      .number()
      .optional()
      .describe("Number of cells affected (record_operation)"),

    // Fields for GET_HISTORY action
    limit: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .describe("Max operations to return (get_history, default: 10)"),

    // Fields for FIND_BY_REFERENCE action
    reference: z
      .string()
      .optional()
      .describe(
        "Natural language reference like 'that', 'the budget', 'the last write' (required for: find_by_reference)",
      ),
    referenceType: z
      .enum(["spreadsheet", "operation"])
      .optional()
      .describe("What to find (required for: find_by_reference)"),

    // Fields for UPDATE_PREFERENCES action
    confirmationLevel: z
      .enum(["always", "destructive", "never"])
      .optional()
      .describe("Confirmation level (update_preferences)"),
    dryRunDefault: z
      .boolean()
      .optional()
      .describe("Default dry run setting (update_preferences)"),
    snapshotDefault: z
      .boolean()
      .optional()
      .describe("Default snapshot setting (update_preferences)"),

    // Fields for SET_PENDING action
    type: z
      .string()
      .optional()
      .describe("Type of pending operation (required for: set_pending)"),
    step: z
      .number()
      .optional()
      .describe("Current step number (required for: set_pending)"),
    totalSteps: z
      .number()
      .optional()
      .describe("Total steps (required for: set_pending)"),
    context: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Operation context data (required for: set_pending)"),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        case "set_active":
          return !!data.spreadsheetId && !!data.title && !!data.sheetNames;
        case "record_operation":
          return (
            !!data.tool &&
            !!data.toolAction &&
            !!data.spreadsheetId &&
            !!data.description &&
            data.undoable !== undefined
          );
        case "find_by_reference":
          return !!data.reference && !!data.referenceType;
        case "set_pending":
          return (
            !!data.type &&
            data.step !== undefined &&
            data.totalSteps !== undefined &&
            !!data.context
          );
        case "get_active":
        case "get_context":
        case "get_last_operation":
        case "get_history":
        case "update_preferences":
        case "get_preferences":
        case "get_pending":
        case "clear_pending":
        case "reset":
          return true; // No required fields beyond action
        default:
          return false;
      }
    },
    {
      message: "Missing required fields for the specified action",
    },
  );

export type SheetsSessionInput = z.infer<typeof SheetsSessionInputSchema>;

// ============================================================================
// TYPE NARROWING HELPERS
// ============================================================================

export function isSetActiveAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "set_active";
  spreadsheetId: string;
  title: string;
  sheetNames: string[];
} {
  return input.action === "set_active";
}

export function isGetActiveAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "get_active";
} {
  return input.action === "get_active";
}

export function isGetContextAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "get_context";
} {
  return input.action === "get_context";
}

export function isRecordOperationAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "record_operation";
  tool: string;
  toolAction: string;
  spreadsheetId: string;
  description: string;
  undoable: boolean;
  range?: string;
  snapshotId?: string;
  cellsAffected?: number;
} {
  return input.action === "record_operation";
}

export function isGetLastOperationAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "get_last_operation";
} {
  return input.action === "get_last_operation";
}

export function isGetHistoryAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "get_history";
  limit?: number;
} {
  return input.action === "get_history";
}

export function isFindByReferenceAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "find_by_reference";
  reference: string;
  referenceType: "spreadsheet" | "operation";
} {
  return input.action === "find_by_reference";
}

export function isUpdatePreferencesAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "update_preferences";
  confirmationLevel?: "always" | "destructive" | "never";
  dryRunDefault?: boolean;
  snapshotDefault?: boolean;
} {
  return input.action === "update_preferences";
}

export function isGetPreferencesAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "get_preferences";
} {
  return input.action === "get_preferences";
}

export function isSetPendingAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "set_pending";
  type: string;
  step: number;
  totalSteps: number;
  context: Record<string, unknown>;
} {
  return input.action === "set_pending";
}

export function isGetPendingAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "get_pending";
} {
  return input.action === "get_pending";
}

export function isClearPendingAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "clear_pending";
} {
  return input.action === "clear_pending";
}

export function isResetAction(
  input: SheetsSessionInput,
): input is SheetsSessionInput & {
  action: "reset";
} {
  return input.action === "reset";
}

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

const PendingOperationSchema = z
  .object({
    type: z.string(),
    step: z.number(),
    totalSteps: z.number(),
    context: z.record(z.string(), z.unknown()),
  })
  .nullable();

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
