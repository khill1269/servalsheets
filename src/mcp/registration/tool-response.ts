/**
 * Tool Response Builder
 *
 * Builds standardized MCP CallToolResult responses with metadata injection,
 * response validation, and verbosity filtering.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';
import { getRequestContext } from '../../utils/request-context.js';
import type { SessionContextManager } from '../../services/session-context.js';
import { sanitizeErrorPayload, injectStandardPaginationMeta, injectStandardCollectionMeta } from './tool-response-normalization.js';

export interface ToolResponseBuilderInput {
  response: unknown;
  action?: string;
  pagination?: { hasMore: boolean; cursor?: string; limit?: number; offset?: number };
  collection?: { count: number; total?: number; filtered?: boolean };
  sessionContext?: SessionContextManager;
  confidenceScore?: number;
  taskHint?: string;
  onboardingHint?: string;
}

export function buildToolResponse(input: ToolResponseBuilderInput | Record<string, unknown>): CallToolResult {
  // Handle legacy direct response format
  if (!('response' in input) && !('action' in input)) {
    return buildFromLegacyFormat(input as Record<string, unknown>);
  }

  const normalizedInput = input as ToolResponseBuilderInput;
  const response = normalizedInput.response as Record<string, unknown>;

  if (!response) {
    return { content: [{ type: 'text', text: 'No response' }], isError: false };
  }

  // Handle error responses
  if (response.success === false && response.error) {
    const error = sanitizeErrorPayload(response.error);
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error }) }],
      isError: true,
    };
  }

  // Inject pagination metadata
  if (normalizedInput.pagination) {
    injectStandardPaginationMeta(response, normalizedInput.pagination);
  }

  // Inject collection metadata
  if (normalizedInput.collection) {
    injectStandardCollectionMeta(response, normalizedInput.collection);
  }

  // Inject confidence and task hints
  const meta = (response._meta as Record<string, unknown>) || {};
  if (normalizedInput.confidenceScore !== undefined) {
    meta.confidence = normalizedInput.confidenceScore;
  }
  if (normalizedInput.taskHint) {
    meta.taskHint = normalizedInput.taskHint;
  }
  if (normalizedInput.onboardingHint) {
    meta.onboardingHint = normalizedInput.onboardingHint;
  }
  response._meta = meta;

  // Record in session context
  if (normalizedInput.sessionContext && normalizedInput.action) {
    try {
      normalizedInput.sessionContext.recordOperation({
        tool: 'unknown',
        action: normalizedInput.action,
        success: response.success !== false,
        timestamp: Date.now(),
      });
    } catch (e) {
      logger.warn('Failed to record operation in session context', { error: e });
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(response) }],
    isError: response.success === false,
  };
}

function buildFromLegacyFormat(input: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(input) }],
    isError: false,
  };
}

export function validateOutputSchema(response: unknown, schema?: unknown): boolean {
  // Advisory validation - non-blocking
  if (!schema || typeof schema !== 'object') {
    return true; // OK: No schema provided
  }

  if (!response || typeof response !== 'object') {
    logger.debug('Output validation: response is not an object');
    return false;
  }

  // Basic shape check: response should have 'success' or 'error' or 'action'
  const responseObj = response as Record<string, unknown>;
  const hasSuccessKey = 'success' in responseObj;
  const hasErrorKey = 'error' in responseObj;
  const hasActionKey = 'action' in responseObj;
  const hasDataKey = 'data' in responseObj;

  return hasSuccessKey || hasErrorKey || hasActionKey || hasDataKey;
}

export function applyVerbosityFilter(
  response: Record<string, unknown>,
  verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'
): Record<string, unknown> {
  if (verbosity === 'detailed') {
    return response; // Return full response
  }

  if (verbosity === 'minimal') {
    // Strip details, keep only action + status
    const filtered: Record<string, unknown> = {};
    filtered.success = response.success;
    filtered.action = response.action;
    if (response.error) {
      filtered.error = response.error;
    }
    return filtered;
  }

  // 'standard': Return as-is (natural middle ground)
  return response;
}

export function extractConfidenceScore(response: Record<string, unknown>): number | undefined {
  if ('confidence' in response && typeof response.confidence === 'number') {
    return response.confidence;
  }

  const meta = response._meta as Record<string, unknown> | undefined;
  if (meta && 'confidence' in meta && typeof meta.confidence === 'number') {
    return meta.confidence;
  }

  return undefined;
}
