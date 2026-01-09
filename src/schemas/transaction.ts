/**
 * Tool: sheets_transaction
 * Multi-operation transaction support with atomicity and auto-rollback.
 */

import { z } from "zod";
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from "./shared.js";

// INPUT SCHEMA: Direct discriminated union (no wrapper)
// This exposes all fields at top level for proper MCP client UX
export const SheetsTransactionInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("begin").describe("Begin a new transaction"),
    spreadsheetId: z
      .string()
      .min(1)
      .describe("Spreadsheet ID to start transaction for"),
    autoSnapshot: z
      .boolean()
      .optional()
      .describe(
        "NOTE: Currently ignored - snapshots controlled by server config. Metadata-only snapshots may fail for spreadsheets with >50MB metadata (many sheets). For large spreadsheets, use sheets_history for undo instead.",
      ),
    autoRollback: z
      .boolean()
      .optional()
      .describe(
        "Auto-rollback on error (default: true). Note: Rollback implementation has limitations - see documentation.",
      ),
    isolationLevel: z
      .enum(["read_uncommitted", "read_committed", "serializable"])
      .optional()
      .describe("Transaction isolation level (default: read_committed)"),
  }),
  z.object({
    action: z.literal("queue").describe("Queue an operation in the transaction"),
    transactionId: z
      .string()
      .min(1)
      .describe("Transaction ID to queue operation in"),
    operation: z
      .object({
        tool: z
          .string()
          .min(1)
          .describe("Tool name (e.g., sheets_values, sheets_format)"),
        action: z
          .string()
          .min(1)
          .describe("Action name (e.g., write, update, format)"),
        params: z.record(z.unknown()).describe("Operation parameters"),
      })
      .describe("Operation to queue for batch execution"),
  }),
  z.object({
    action: z.literal("commit").describe("Commit and execute all queued operations"),
    transactionId: z.string().min(1).describe("Transaction ID to commit"),
  }),
  z.object({
    action: z.literal("rollback").describe("Rollback transaction without executing"),
    transactionId: z.string().min(1).describe("Transaction ID to rollback"),
  }),
  z.object({
    action: z.literal("status").describe("Check transaction status"),
    transactionId: z.string().min(1).describe("Transaction ID to check status"),
  }),
  z.object({
    action: z.literal("list").describe("List all active transactions"),
    spreadsheetId: z.string().optional().describe("Filter by spreadsheet ID"),
  }),
]);

const TransactionResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    action: z.string(),
    transactionId: z.string().optional().describe("Transaction ID"),
    status: z
      .enum([
        "pending",
        "queued",
        "executing",
        "committed",
        "rolled_back",
        "failed",
      ])
      .optional(),
    operationsQueued: z
      .number()
      .optional()
      .describe("Number of operations queued"),
    operationsExecuted: z
      .number()
      .optional()
      .describe("Number of operations executed"),
    apiCallsSaved: z
      .number()
      .optional()
      .describe("API calls saved by batching"),
    duration: z.number().optional().describe("Execution duration in ms"),
    snapshotId: z.string().optional().describe("Snapshot ID for rollback"),
    message: z.string().optional(),
    transactions: z
      .array(
        z.object({
          id: z.string(),
          spreadsheetId: z.string(),
          status: z.string(),
          operationCount: z.number(),
          created: z.string(),
        }),
      )
      .optional()
      .describe("List of transactions"),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsTransactionOutputSchema = z.object({
  response: TransactionResponseSchema,
});

export const SHEETS_TRANSACTION_ANNOTATIONS: ToolAnnotations = {
  title: "Transaction Support",
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export type SheetsTransactionInput = z.infer<
  typeof SheetsTransactionInputSchema
>;
export type SheetsTransactionOutput = z.infer<
  typeof SheetsTransactionOutputSchema
>;
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;
