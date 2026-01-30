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
          // Phase 1 Fix: Return explicit feature unavailable error instead of silent empty list
          response = {
            success: false,
            error: {
              code: 'UNIMPLEMENTED',
              message:
                'Transaction listing is not yet implemented. TransactionManager does not expose listTransactions() method.',
              retryable: false,
              suggestedFix:
                'Use status action with a specific transactionId to check individual transaction status.',
              details: {
                reason: 'TransactionManager API limitation',
                workaround: 'Track transaction IDs from begin/queue/commit operations',
              },
            },
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
