/**
 * History handler submodule — list, get, stats, clear actions
 */

import { ErrorCodes } from '../error-codes.js';
import { getHistoryService } from '../../services/history-service.js';
import { createNotFoundError } from '../../utils/error-factory.js';
import type { HistoryResponse } from '../../schemas/history.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';
import { requestSafetyConfirmation } from '../../utils/safety-helpers.js';

interface ListReq {
  action: 'list';
  failuresOnly?: boolean;
  spreadsheetId?: string;
  count?: number;
}

interface GetReq {
  action: 'get';
  operationId?: string;
}

interface StatsReq {
  action: 'stats';
}

interface ClearReq {
  action: 'clear';
  spreadsheetId?: string;
  server?: ElicitationServer;
}

export async function handleList(req: ListReq): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  let operations;
  if (req.failuresOnly) {
    operations = historyService.getFailures(req.count);
  } else if (req.spreadsheetId) {
    operations = historyService.getBySpreadsheet(req.spreadsheetId, req.count);
  } else {
    operations = historyService.getRecent(req.count || 10);
  }

  return {
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
}

export async function handleGet(req: GetReq): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  const operation = historyService.getById(req.operationId!);

  if (!operation) {
    return {
      success: false,
      error: createNotFoundError({
        resourceType: 'operation',
        resourceId: req.operationId!,
        searchSuggestion: 'Use action "list" to see available operation IDs',
      }),
    };
  }

  return {
    success: true,
    action: 'get',
    operation: {
      id: operation.id,
      tool: operation.tool,
      action: operation.action,
      params: operation.params as Record<
        string,
        string | number | boolean | null | unknown[] | Record<string, unknown>
      >,
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
}

export async function handleStats(_req: StatsReq): Promise<HistoryResponse> {
  const historyService = getHistoryService();
  const stats = historyService.getStats();

  return {
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
}

export async function handleClear(req: ClearReq, server?: ElicitationServer): Promise<HistoryResponse> {
  const historyService = getHistoryService();

  const clearScope = req.spreadsheetId
    ? `operation history for spreadsheet ${req.spreadsheetId}`
    : 'all operation history';
  const confirmation = await requestSafetyConfirmation({
    server,
    operation: 'clear_history',
    details: `Permanently deletes ${clearScope}. The history log cannot be recovered.`,
    context: {
      toolName: 'sheets_history',
      actionName: 'clear',
      operationType: 'clear',
      isDestructive: true,
      spreadsheetId: req.spreadsheetId,
    },
  });
  if (!confirmation.confirmed) {
    return {
      success: false,
      error: {
        code: ErrorCodes.OPERATION_CANCELLED,
        message: confirmation.reason || 'Clear cancelled by user',
        retryable: false,
      },
    };
  }

  let cleared: number;
  if (req.spreadsheetId) {
    cleared = historyService.clearForSpreadsheet(req.spreadsheetId);
  } else {
    cleared = historyService.size();
    historyService.clear();
  }

  return {
    success: true,
    action: 'clear',
    operationsCleared: cleared,
    message: req.spreadsheetId
      ? `Cleared ${cleared} operation(s) for spreadsheet ${req.spreadsheetId}`
      : `Cleared all ${cleared} operation(s)`,
  };
}
