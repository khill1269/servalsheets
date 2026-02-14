/**
 * Tool: sheets_transaction
 * Multi-operation transaction support with atomicity and auto-rollback.
 */

import { z } from 'zod';
import { ErrorDetailSchema, ResponseMetaSchema, type ToolAnnotations } from './shared.js';

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

const BeginActionSchema = CommonFieldsSchema.extend({
  action: z.literal('begin').describe('Begin a new transaction'),
  spreadsheetId: z.string().min(1).describe('Spreadsheet ID from URL'),
  autoSnapshot: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'NOTE: Currently ignored - snapshots controlled by server config. Metadata-only snapshots may fail for spreadsheets with >50MB metadata (many sheets). For large spreadsheets, use sheets_history for undo instead.'
    ),
  autoRollback: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Auto-rollback on error (default: true). Note: Rollback implementation has limitations - see documentation.'
    ),
  isolationLevel: z
    .enum(['read_uncommitted', 'read_committed', 'serializable'])
    .optional()
    .default('read_committed')
    .describe('Transaction isolation level (default: read_committed)'),
});

const QueueActionSchema = CommonFieldsSchema.extend({
  action: z.literal('queue').describe('Queue an operation in the transaction'),
  transactionId: z.string().min(1).describe('Transaction ID from begin response'),
  operation: z
    .object({
      tool: z
        .string()
        .min(1)
        .max(100, 'Tool name exceeds 100 character limit')
        .describe('Tool name (e.g., sheets_data, sheets_format)'),
      action: z
        .string()
        .min(1)
        .max(100, 'Action name exceeds 100 character limit')
        .describe('Action name (e.g., write, update, format)'),
      params: z
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
        .describe('Operation parameters (string, number, boolean, null, array, or object)'),
    })
    .describe('Operation to queue for batch execution'),
});

const CommitActionSchema = CommonFieldsSchema.extend({
  action: z.literal('commit').describe('Commit a transaction (execute all queued operations)'),
  transactionId: z.string().min(1).describe('Transaction ID from begin response'),
});

const RollbackActionSchema = CommonFieldsSchema.extend({
  action: z.literal('rollback').describe('Rollback a transaction (discard all queued operations)'),
  transactionId: z.string().min(1).describe('Transaction ID from begin response'),
});

const StatusActionSchema = CommonFieldsSchema.extend({
  action: z.literal('status').describe('Get status of a transaction'),
  transactionId: z.string().min(1).describe('Transaction ID from begin response'),
});

const ListActionSchema = CommonFieldsSchema.extend({
  action: z.literal('list').describe('List all active transactions'),
  spreadsheetId: z
    .string()
    .min(1)
    .optional()
    .describe('Filter by spreadsheet ID (omit to show all)'),
});

// ============================================================================
// Combined Input Schema
// ============================================================================

/**
 * All transaction operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsTransactionInputSchema = z.object({
  request: z.discriminatedUnion('action', [
    BeginActionSchema,
    QueueActionSchema,
    CommitActionSchema,
    RollbackActionSchema,
    StatusActionSchema,
    ListActionSchema,
  ]),
});

const TransactionResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    transactionId: z.string().optional().describe('Transaction ID'),
    status: z
      .enum(['pending', 'queued', 'executing', 'committed', 'rolled_back', 'failed'])
      .optional(),
    operationsQueued: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Number of operations queued'),
    operationsExecuted: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Number of operations executed'),
    apiCallsSaved: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .describe('API calls saved by batching'),
    duration: z.coerce.number().optional().describe('Execution duration in ms'),
    snapshotId: z.string().optional().describe('Snapshot ID for rollback'),
    message: z.string().optional(),
    transactions: z
      .array(
        z.object({
          id: z.string(),
          spreadsheetId: z.string(),
          status: z.string(),
          operationCount: z.coerce.number(),
          created: z.string(),
          updated: z.string().optional().describe('Last update time'),
          duration: z.coerce.number().optional().describe('Transaction duration in ms'),
          isolationLevel: z
            .enum(['read_uncommitted', 'read_committed', 'serializable'])
            .optional()
            .describe('Transaction isolation level'),
          snapshotId: z.string().optional().describe('Associated snapshot ID'),
        })
      )
      .optional()
      .describe('List of active transactions'),
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
  title: 'Transaction Support',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export type SheetsTransactionInput = z.infer<typeof SheetsTransactionInputSchema>;
export type SheetsTransactionOutput = z.infer<typeof SheetsTransactionOutputSchema>;
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type TransactionRequest = SheetsTransactionInput['request'];

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type TransactionBeginInput = SheetsTransactionInput['request'] & {
  action: 'begin';
  spreadsheetId: string;
};
export type TransactionQueueInput = SheetsTransactionInput['request'] & {
  action: 'queue';
  transactionId: string;
  operation: { tool: string; action: string; params: Record<string, unknown> };
};
export type TransactionCommitInput = SheetsTransactionInput['request'] & {
  action: 'commit';
  transactionId: string;
};
export type TransactionRollbackInput = SheetsTransactionInput['request'] & {
  action: 'rollback';
  transactionId: string;
};
export type TransactionStatusInput = SheetsTransactionInput['request'] & {
  action: 'status';
  transactionId: string;
};
export type TransactionListInput = SheetsTransactionInput['request'] & { action: 'list' };
