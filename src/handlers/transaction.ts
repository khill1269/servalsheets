/**
 * ServalSheets - Transaction Handler
 *
 * Handles multi-operation transactions with atomicity and auto-rollback.
 */

import { getTransactionManager } from '../services/transaction-manager.js';
import type {
  SheetsTransactionInput,
  SheetsTransactionOutput,
  TransactionResponse,
} from '../schemas/transaction.js';
import { unwrapRequest } from './base.js';
import { ValidationError } from '../core/errors.js';

export interface TransactionHandlerOptions {
  // Options can be added as needed
}

export class TransactionHandler {
  constructor(_options: TransactionHandlerOptions = {}) {
    // Constructor logic if needed
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: TransactionResponse,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): TransactionResponse {
    if (!response.success || verbosity === 'standard') {
      return response;
    }

    if (verbosity === 'minimal') {
      // For minimal verbosity, strip _meta field
      const { _meta, ...rest } = response as Record<string, unknown>;
      return rest as TransactionResponse;
    }

    return response;
  }

  async handle(input: SheetsTransactionInput): Promise<SheetsTransactionOutput> {
    const req = unwrapRequest<SheetsTransactionInput['request']>(input);
    const transactionManager = getTransactionManager();

    try {
      let response: TransactionResponse;

      switch (req.action) {
        case 'begin': {
          // Type assertion after validation
          if (!req.spreadsheetId) {
            throw new ValidationError(
              'spreadsheetId is required for begin action',
              'spreadsheetId'
            );
          }

          // NOTE: autoSnapshot is controlled by TransactionManager config, not per-transaction
          // The input.autoSnapshot parameter is currently ignored (design limitation)
          const txId = await transactionManager.begin(req.spreadsheetId, {
            autoCommit: false, // Fixed: was incorrectly using req.autoSnapshot
            autoRollback: req.autoRollback ?? true,
            isolationLevel: req.isolationLevel ?? 'read_committed',
          });

          // Warn about snapshot limitations for large spreadsheets
          const snapshotWarning = req.autoSnapshot
            ? ' Note: Snapshots are metadata-only and may fail for very large spreadsheets (>50MB metadata).'
            : '';

          response = {
            success: true,
            action: 'begin',
            transactionId: txId,
            status: 'pending',
            operationsQueued: 0,
            message: `Transaction ${txId} started for spreadsheet ${req.spreadsheetId}.${snapshotWarning}`,
          };
          break;
        }

        case 'queue': {
          // Type assertion after validation
          if (!req.transactionId || !req.operation) {
            throw new ValidationError(
              'transactionId and operation are required for queue action',
              'transactionId'
            );
          }

          await transactionManager.queue(req.transactionId, {
            type: 'custom',
            tool: req.operation.tool,
            action: req.operation.action,
            params: req.operation.params,
          });

          const tx = transactionManager.getTransaction(req.transactionId);

          // Generate warnings for large transactions
          const warnings: string[] = [];
          if (tx.operations.length > 50) {
            warnings.push(
              `Large transaction (${tx.operations.length} operations). Consider splitting into multiple smaller transactions for better reliability and easier debugging.`
            );
          } else if (tx.operations.length > 20) {
            warnings.push(
              `Transaction size is growing (${tx.operations.length} operations). Maximum recommended size is 50 operations.`
            );
          }

          response = {
            success: true,
            action: 'queue',
            transactionId: req.transactionId,
            operationsQueued: tx.operations.length,
            message: `Operation queued. ${tx.operations.length} operation(s) in transaction.`,
            _meta: warnings.length > 0 ? { warnings } : undefined,
          };
          break;
        }

        case 'commit': {
          // Type assertion after validation
          if (!req.transactionId) {
            throw new ValidationError(
              'transactionId is required for commit action',
              'transactionId'
            );
          }

          const result = await transactionManager.commit(req.transactionId);

          if (result.success) {
            response = {
              success: true,
              action: 'commit',
              transactionId: req.transactionId,
              status: 'committed',
              operationsExecuted: result.operationResults.length,
              apiCallsSaved: result.apiCallsSaved,
              duration: result.duration,
              message: `Transaction committed successfully. ${result.operationResults.length} operation(s) executed, ${result.apiCallsSaved} API call(s) saved.`,
            };
          } else {
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: result.error?.message || 'Transaction commit failed',
                retryable: false,
                details: result.rolledBack
                  ? { rollback: 'Transaction was automatically rolled back' }
                  : undefined,
              },
            };
          }
          break;
        }

        case 'rollback': {
          // Type assertion after validation
          if (!req.transactionId) {
            throw new ValidationError(
              'transactionId is required for rollback action',
              'transactionId'
            );
          }

          await transactionManager.rollback(req.transactionId);

          response = {
            success: true,
            action: 'rollback',
            transactionId: req.transactionId,
            status: 'rolled_back',
            message: `Transaction ${req.transactionId} rolled back successfully.`,
          };
          break;
        }

        case 'status': {
          // Type assertion after validation
          if (!req.transactionId) {
            throw new ValidationError(
              'transactionId is required for status action',
              'transactionId'
            );
          }

          const tx = transactionManager.getTransaction(req.transactionId);

          response = {
            success: true,
            action: 'status',
            transactionId: req.transactionId,
            status: tx.status,
            operationsQueued: tx.operations.length,
            snapshotId: tx.snapshot?.id,
            message: `Transaction is ${tx.status} with ${tx.operations.length} operation(s) queued.`,
          };
          break;
        }

        case 'list': {
          const allTransactions = transactionManager.getActiveTransactions();

          // Apply optional filters
          let filteredTransactions = allTransactions;

          if (req.spreadsheetId) {
            filteredTransactions = allTransactions.filter(
              (tx) => tx.spreadsheetId === req.spreadsheetId
            );
          }

          // Sort by creation time (newest first)
          filteredTransactions.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

          // Map transactions to response format with additional details
          const transactions = filteredTransactions.map((tx) => {
            const duration = tx.endTime
              ? tx.endTime - (tx.startTime || 0)
              : Date.now() - (tx.startTime || 0);

            return {
              id: tx.id,
              spreadsheetId: tx.spreadsheetId,
              status: tx.status,
              operationCount: tx.operations.length,
              created: new Date(tx.startTime || 0).toISOString(),
              updated: tx.endTime ? new Date(tx.endTime).toISOString() : undefined,
              duration: tx.status === 'pending' || tx.status === 'queued' ? duration : tx.duration,
              isolationLevel: tx.isolationLevel,
              snapshotId: tx.snapshot?.id,
            };
          });

          // Generate summary statistics
          const summary = {
            total: transactions.length,
            byStatus: {
              pending: transactions.filter((t) => t.status === 'pending').length,
              queued: transactions.filter((t) => t.status === 'queued').length,
              executing: transactions.filter((t) => t.status === 'executing').length,
              committed: transactions.filter((t) => t.status === 'committed').length,
              rolled_back: transactions.filter((t) => t.status === 'rolled_back').length,
              failed: transactions.filter((t) => t.status === 'failed').length,
            },
          };

          // Generate summary info for metadata
          const summaryMessage = [
            `Total: ${summary.total}`,
            `Pending: ${summary.byStatus.pending}`,
            `Queued: ${summary.byStatus.queued}`,
            `Executing: ${summary.byStatus.executing}`,
            `Committed: ${summary.byStatus.committed}`,
            `Rolled Back: ${summary.byStatus.rolled_back}`,
            `Failed: ${summary.byStatus.failed}`,
          ].join(' | ');

          response = {
            success: true,
            action: 'list',
            transactions,
            message: `Found ${transactions.length} active transaction(s). ${summaryMessage}`,
            _meta:
              transactions.length > 0
                ? {
                    summary,
                    suggestions:
                      summary.byStatus.pending > 0 || summary.byStatus.queued > 0
                        ? [
                            {
                              type: 'follow_up' as const,
                              message: `${summary.byStatus.pending + summary.byStatus.queued} transaction(s) awaiting execution`,
                              reason: 'Transactions in pending or queued state',
                              priority: 'medium' as const,
                            },
                          ]
                        : undefined,
                  }
                : undefined,
          };
          break;
        }

        default: {
          // Exhaustive check - TypeScript ensures this is unreachable
          const _exhaustiveCheck: never = req;
          response = {
            success: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Unsupported action: ${(req as { action: string }).action}`,
              retryable: false,
              suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
            },
          };
        }
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = this.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (error) {
      // Catch-all for unexpected errors
      return {
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }
}
