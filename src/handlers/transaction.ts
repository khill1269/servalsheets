/**
 * ServalSheets - Transaction Handler
 *
 * Handles multi-operation transactions with atomicity and auto-rollback.
 */

import { getTransactionManager } from "../services/transaction-manager.js";
import type {
  SheetsTransactionInput,
  SheetsTransactionOutput,
  TransactionResponse,
} from "../schemas/transaction.js";

export interface TransactionHandlerOptions {
  // Options can be added as needed
}

export class TransactionHandler {
  constructor(_options: TransactionHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(
    input: SheetsTransactionInput,
  ): Promise<SheetsTransactionOutput> {
    // Input is now the action directly (no request wrapper)
    const transactionManager = getTransactionManager();

    try {
      let response: TransactionResponse;

      switch (input.action) {
        case "begin": {
          // Type assertion after validation
          if (!input.spreadsheetId) {
            throw new Error("spreadsheetId is required for begin action");
          }

          // NOTE: autoSnapshot is controlled by TransactionManager config, not per-transaction
          // The input.autoSnapshot parameter is currently ignored (design limitation)
          const txId = await transactionManager.begin(input.spreadsheetId, {
            autoCommit: false, // Fixed: was incorrectly using input.autoSnapshot
            autoRollback: input.autoRollback ?? true,
            isolationLevel: input.isolationLevel ?? "read_committed",
          });

          // Warn about snapshot limitations for large spreadsheets
          const snapshotWarning = input.autoSnapshot
            ? " Note: Snapshots are metadata-only and may fail for very large spreadsheets (>50MB metadata)."
            : "";

          response = {
            success: true,
            action: "begin",
            transactionId: txId,
            status: "pending",
            operationsQueued: 0,
            message: `Transaction ${txId} started for spreadsheet ${input.spreadsheetId}.${snapshotWarning}`,
          };
          break;
        }

        case "queue": {
          // Type assertion after validation
          if (!input.transactionId || !input.operation) {
            throw new Error("transactionId and operation are required for queue action");
          }

          await transactionManager.queue(input.transactionId, {
            type: "custom",
            tool: input.operation.tool,
            action: input.operation.action,
            params: input.operation.params,
          });

          const tx = transactionManager.getTransaction(input.transactionId);

          // Generate warnings for large transactions
          const warnings: string[] = [];
          if (tx.operations.length > 50) {
            warnings.push(
              `Large transaction (${tx.operations.length} operations). Consider splitting into multiple smaller transactions for better reliability and easier debugging.`,
            );
          } else if (tx.operations.length > 20) {
            warnings.push(
              `Transaction size is growing (${tx.operations.length} operations). Maximum recommended size is 50 operations.`,
            );
          }

          response = {
            success: true,
            action: "queue",
            transactionId: input.transactionId,
            operationsQueued: tx.operations.length,
            message: `Operation queued. ${tx.operations.length} operation(s) in transaction.`,
            _meta: warnings.length > 0 ? { warnings } : undefined,
          };
          break;
        }

        case "commit": {
          // Type assertion after validation
          if (!input.transactionId) {
            throw new Error("transactionId is required for commit action");
          }

          const result = await transactionManager.commit(input.transactionId);

          if (result.success) {
            response = {
              success: true,
              action: "commit",
              transactionId: input.transactionId,
              status: "committed",
              operationsExecuted: result.operationResults.length,
              apiCallsSaved: result.apiCallsSaved,
              duration: result.duration,
              message: `Transaction committed successfully. ${result.operationResults.length} operation(s) executed, ${result.apiCallsSaved} API call(s) saved.`,
            };
          } else {
            response = {
              success: false,
              error: {
                code: "INTERNAL_ERROR",
                message: result.error?.message || "Transaction commit failed",
                retryable: false,
                details: result.rolledBack
                  ? { rollback: "Transaction was automatically rolled back" }
                  : undefined,
              },
            };
          }
          break;
        }

        case "rollback": {
          // Type assertion after validation
          if (!input.transactionId) {
            throw new Error("transactionId is required for rollback action");
          }

          await transactionManager.rollback(input.transactionId);

          response = {
            success: true,
            action: "rollback",
            transactionId: input.transactionId,
            status: "rolled_back",
            message: `Transaction ${input.transactionId} rolled back successfully.`,
          };
          break;
        }

        case "status": {
          // Type assertion after validation
          if (!input.transactionId) {
            throw new Error("transactionId is required for status action");
          }

          const tx = transactionManager.getTransaction(input.transactionId);

          response = {
            success: true,
            action: "status",
            transactionId: input.transactionId,
            status: tx.status,
            operationsQueued: tx.operations.length,
            snapshotId: tx.snapshot?.id,
            message: `Transaction is ${tx.status} with ${tx.operations.length} operation(s) queued.`,
          };
          break;
        }

        case "list": {
          // Note: TransactionManager doesn't expose a listTransactions method
          // For now, return empty list - will need to add this method to TransactionManager
          response = {
            success: true,
            action: "list",
            transactions: [],
            message: "Transaction listing not yet implemented",
          };
          break;
        }

        default: {
          response = {
            success: false,
            error: {
              code: "INVALID_PARAMS",
              message: `Unsupported action: ${input.action}`,
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
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }
}
