/**
 * Tool: sheets_transaction
 * Multi-operation transaction support with atomicity and auto-rollback.
 */

import { z } from 'zod';
import { ErrorDetailSchema, ResponseMetaSchema, type ToolAnnotations } from './shared.js';

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsTransactionInputSchema = z
  .object({
    // Required action discriminator
    action: z
      .enum(['begin', 'queue', 'commit', 'rollback', 'status', 'list'])
      .describe('The transaction operation to perform'),

    // Fields for BEGIN action
    spreadsheetId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Spreadsheet ID to start transaction for (required for: begin; optional for: list)'
      ),
    autoSnapshot: z
      .boolean()
      .optional()
      .describe(
        'NOTE: Currently ignored - snapshots controlled by server config. Metadata-only snapshots may fail for spreadsheets with >50MB metadata (many sheets). For large spreadsheets, use sheets_history for undo instead. (begin only)'
      ),
    autoRollback: z
      .boolean()
      .optional()
      .describe(
        'Auto-rollback on error (default: true). Note: Rollback implementation has limitations - see documentation. (begin only)'
      ),
    isolationLevel: z
      .enum(['read_uncommitted', 'read_committed', 'serializable'])
      .optional()
      .describe('Transaction isolation level (default: read_committed) (begin only)'),

    // Fields for QUEUE, COMMIT, ROLLBACK, STATUS actions
    transactionId: z
      .string()
      .min(1)
      .optional()
      .describe('Transaction ID (required for: queue, commit, rollback, status)'),

    // Fields for QUEUE action
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
        params: z.record(z.string(), z.unknown()).describe('Operation parameters'),
      })
      .optional()
      .describe('Operation to queue for batch execution (required for: queue)'),

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
        case 'begin':
          return !!data.spreadsheetId;
        case 'queue':
          return !!data.transactionId && !!data.operation;
        case 'commit':
        case 'rollback':
        case 'status':
          return !!data.transactionId;
        case 'list':
          return true; // No required fields beyond action
        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );

const TransactionResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    transactionId: z.string().optional().describe('Transaction ID'),
    status: z
      .enum(['pending', 'queued', 'executing', 'committed', 'rolled_back', 'failed'])
      .optional(),
    operationsQueued: z.number().int().min(0).optional().describe('Number of operations queued'),
    operationsExecuted: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Number of operations executed'),
    apiCallsSaved: z.number().int().min(0).optional().describe('API calls saved by batching'),
    duration: z.number().optional().describe('Execution duration in ms'),
    snapshotId: z.string().optional().describe('Snapshot ID for rollback'),
    message: z.string().optional(),
    transactions: z
      .array(
        z.object({
          id: z.string(),
          spreadsheetId: z.string(),
          status: z.string(),
          operationCount: z.number(),
          created: z.string(),
        })
      )
      .optional()
      .describe('List of transactions'),
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

// Type narrowing helpers for handler methods
// These provide type safety similar to discriminated union Extract<>
export type TransactionBeginInput = SheetsTransactionInput & {
  action: 'begin';
  spreadsheetId: string;
};
export type TransactionQueueInput = SheetsTransactionInput & {
  action: 'queue';
  transactionId: string;
  operation: { tool: string; action: string; params: Record<string, unknown> };
};
export type TransactionCommitInput = SheetsTransactionInput & {
  action: 'commit';
  transactionId: string;
};
export type TransactionRollbackInput = SheetsTransactionInput & {
  action: 'rollback';
  transactionId: string;
};
export type TransactionStatusInput = SheetsTransactionInput & {
  action: 'status';
  transactionId: string;
};
export type TransactionListInput = SheetsTransactionInput & { action: 'list' };
