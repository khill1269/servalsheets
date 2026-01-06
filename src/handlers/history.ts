/**
 * ServalSheets - History Handler
 *
 * Handles operation history tracking for debugging and undo foundation.
 */

import { getHistoryService } from '../services/history-service.js';
import type {
  SheetsHistoryInput,
  SheetsHistoryOutput,
  HistoryResponse,
} from '../schemas/history.js';

export interface HistoryHandlerOptions {
  // Options can be added as needed
}

export class HistoryHandler {
  constructor(_options: HistoryHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(input: SheetsHistoryInput): Promise<SheetsHistoryOutput> {
    const { request } = input;
    const historyService = getHistoryService();

    try {
      let response: HistoryResponse;

      switch (request.action) {
        case 'list': {
          let operations;
          if (request.failuresOnly) {
            operations = historyService.getFailures(request.count);
          } else if (request.spreadsheetId) {
            operations = historyService.getBySpreadsheet(request.spreadsheetId, request.count);
          } else {
            operations = historyService.getRecent(request.count || 10);
          }

          response = {
            success: true,
            action: 'list',
            operations: operations.map((op) => ({
              id: op.id,
              tool: op.tool,
              action: op.action,
              spreadsheetId: op.spreadsheetId,
              range: undefined,
              success: op.result === 'success',
              duration: op.duration,
              timestamp: new Date(op.timestamp).getTime(),
              error: op.errorMessage,
            })),
            message: `Retrieved ${operations.length} operation(s)`,
          };
          break;
        }

        case 'get': {
          const operation = historyService.getById(request.operationId);

          if (!operation) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Operation ${request.operationId} not found`,
                retryable: false,
              },
            };
            break;
          }

          response = {
            success: true,
            action: 'get',
            operation: {
              id: operation.id,
              tool: operation.tool,
              action: operation.action,
              params: operation.params,
              result: operation.result === 'success' ? 'success' : operation.result,
              spreadsheetId: operation.spreadsheetId,
              range: undefined,
              success: operation.result === 'success',
              duration: operation.duration,
              timestamp: new Date(operation.timestamp).getTime(),
              error: operation.errorMessage,
            },
            message: 'Operation retrieved',
          };
          break;
        }

        case 'stats': {
          const stats = historyService.getStats();

          response = {
            success: true,
            action: 'stats',
            stats: {
              totalOperations: stats.totalOperations,
              successfulOperations: stats.successfulOperations,
              failedOperations: stats.failedOperations,
              successRate: stats.successRate,
              avgDuration: stats.averageDuration,
              operationsByTool: {},
              recentFailures: stats.failedOperations,
            },
            message: `${stats.totalOperations} operation(s) tracked, ${stats.successRate.toFixed(1)}% success rate`,
          };
          break;
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
