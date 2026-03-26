import type { RequestInfo } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import { getRequestContext } from '../../utils/request-context.js';
import type { RequestContext } from '../../utils/request-context.js';
import { extractAction, extractSpreadsheetId } from './extraction-helpers.js';
import { HistoryService } from '../../services/history-service.js';
import { recordToolCall, recordToolCallLatency, recordError } from '../../observability/metrics.js';
import { recordSelfCorrection } from '../../observability/metrics.js';

export interface ToolExecutionSideEffectInput {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: Error;
  startTime: number;
  requestInfo?: RequestInfo;
}

export async function recordSuccessfulToolExecution(
  input: ToolExecutionSideEffectInput
): Promise<void> {
  const { toolName, args, result, startTime, requestInfo } = input;
  const now = Date.now();
  const latencyMs = now - startTime;

  const action = extractAction(args);
  const spreadsheetId = extractSpreadsheetId(args);
  const requestContext = getRequestContext();

  try {
    recordToolCall(toolName, action, 'success');
    recordToolCallLatency(toolName, action, latencyMs);

    if (spreadsheetId && action) {
      const historyService = await HistoryService.getInstance();
      await historyService.recordOperation({
        tool: toolName,
        action,
        spreadsheetId,
        timestamp: now,
        status: 'success',
        latencyMs,
        args,
        requestId: requestContext.requestId,
        principalId: requestContext.principalId,
      });
    }

    if (requestContext.samplingContext) {
      requestContext.samplingContext.isValid = false;
    }

    if (
      result &&
      typeof result === 'object' &&
      'isSelfCorrection' in result &&
      result.isSelfCorrection === true
    ) {
      recordSelfCorrection(toolName, action, result as Record<string, unknown>);
    }
  } catch (e) {
    logger.warn('Failed to record tool execution side effects', {
      toolName,
      action,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function recordFailedToolExecution(
  input: ToolExecutionSideEffectInput
): Promise<void> {
  const { toolName, args, error, startTime } = input;
  const now = Date.now();
  const latencyMs = now - startTime;

  const action = extractAction(args);
  const spreadsheetId = extractSpreadsheetId(args);
  const requestContext = getRequestContext();

  try {
    recordToolCall(toolName, action, 'failure');
    recordToolCallLatency(toolName, action, latencyMs);
    if (error) {
      recordError(toolName, action, error);
    }

    if (spreadsheetId && action) {
      const historyService = await HistoryService.getInstance();
      await historyService.recordOperation({
        tool: toolName,
        action,
        spreadsheetId,
        timestamp: now,
        status: 'failure',
        latencyMs,
        error: error?.message,
        requestId: requestContext.requestId,
        principalId: requestContext.principalId,
      });
    }

    if (requestContext.samplingContext) {
      requestContext.samplingContext.isValid = false;
    }
  } catch (e) {
    logger.warn('Failed to record tool execution failure side effects', {
      toolName,
      action,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function buildSpanAttributesFromToolCall(
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  latencyMs: number
): Record<string, string | number | boolean> {
  const action = extractAction(args);
  const spreadsheetId = extractSpreadsheetId(args);

  return {
    'tool.name': toolName,
    'tool.action': action || 'unknown',
    'tool.latency_ms': latencyMs,
    ...(spreadsheetId && { 'spreadsheet.id': spreadsheetId }),
    'result.success': result !== null && result !== undefined,
  };
}
