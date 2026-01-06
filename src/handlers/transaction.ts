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

export interface TransactionHandlerOptions {
  // Options can be added as needed
}

export class TransactionHandler {
  constructor(_options: TransactionHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(input: SheetsTransactionInput): Promise<SheetsTransactionOutput> {
    const { request } = input;
    const transactionManager = getTransactionManager();

    try {
      let response: TransactionResponse;

      switch (request.action) {
        case 'begin': {
          const txId = await transactionManager.begin(request.spreadsheetId, {
            autoCommit: request.autoSnapshot ?? false,
            autoRollback: request.autoRollback ?? true,
            isolationLevel: request.isolationLevel ?? 'read_committed',
          });

          response = {
            success: true,
            action: 'begin',
            transactionId: txId,
            status: 'pending',
            operationsQueued: 0,
            message: `Transaction ${txId} started for spreadsheet ${request.spreadsheetId}`,
          };
          break;
        }

        case 'queue': {
          await transactionManager.queue(request.transactionId, {
            type: 'custom',
            tool: request.operation.tool,
            action: request.operation.action,
            params: request.operation.params,
          });

          const tx = transactionManager.getTransaction(request.transactionId);
          response = {
            success: true,
            action: 'queue',
            transactionId: request.transactionId,
            operationsQueued: tx.operations.length,
            message: `Operation queued. ${tx.operations.length} operation(s) in transaction.`,
          };
          break;
        }

        case 'commit': {
          const result = await transactionManager.commit(request.transactionId);

          if (result.success) {
            response = {
              success: true,
              action: 'commit',
              transactionId: request.transactionId,
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
          await transactionManager.rollback(request.transactionId);

          response = {
            success: true,
            action: 'rollback',
            transactionId: request.transactionId,
            status: 'rolled_back',
            message: `Transaction ${request.transactionId} rolled back successfully.`,
          };
          break;
        }

        case 'status': {
          const tx = transactionManager.getTransaction(request.transactionId);

          response = {
            success: true,
            action: 'status',
            transactionId: request.transactionId,
            status: tx.status,
            operationsQueued: tx.operations.length,
            snapshotId: tx.snapshot?.id,
            message: `Transaction is ${tx.status} with ${tx.operations.length} operation(s) queued.`,
          };
          break;
        }

        case 'list': {
          // Note: TransactionManager doesn't expose a listTransactions method
          // For now, return empty list - will need to add this method to TransactionManager
          response = {
            success: true,
            action: 'list',
            transactions: [],
            message: 'Transaction listing not yet implemented',
          };
          break;
        }

        default: {
          // TypeScript exhaustiveness check
          const exhaustiveCheck: never = request;
          response = {
            success: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Unsupported action: ${(exhaustiveCheck as { action: string }).action}`,
              retryable: false,
            },
          };
        }
      }

      return { response };
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
