/**
 * Tool Response Normalization
 *
 * Standardizes MCP tool response structure with metadata injection,
 * pagination hints, and collection metadata.
 */

import type { ToolResult } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../../utils/logger.js';

export interface StructuredContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: unknown;
  mimeType?: string;
}

export interface PaginationMeta {
  cursor?: string;
  hasMore: boolean;
  limit?: number;
  offset?: number;
}

export interface CollectionMeta {
  count: number;
  total?: number;
  filtered?: boolean;
}

export function normalizeStructuredContent(
  response: unknown
): StructuredContent | StructuredContent[] | null {
  if (!response) {
    return null;
  }

  if (Array.isArray(response)) {
    return response.map((item) => normalizeStructuredContent(item) as StructuredContent).filter(Boolean);
  }

  if (typeof response === 'string') {
    return { type: 'text', text: response };
  }

  if (typeof response === 'object' && 'type' in response) {
    return response as StructuredContent;
  }

  return { type: 'text', text: JSON.stringify(response) };
}

export function sanitizeErrorPayload(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') {
    return { code: 'INTERNAL_ERROR', message: String(error) };
  }

  const errorObj = error as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  const allowedKeys = ['code', 'message', 'retryable', 'retryAfterMs', 'details', 'suggestedFix'];
  for (const key of allowedKeys) {
    if (key in errorObj) {
      sanitized[key] = errorObj[key];
    }
  }

  if (!sanitized.code) {
    sanitized.code = 'INTERNAL_ERROR';
  }
  if (!sanitized.message) {
    sanitized.message = 'An error occurred';
  }

  return sanitized;
}

export function injectStandardPaginationMeta(
  response: Record<string, unknown>,
  pagination?: PaginationMeta
): void {
  if (!pagination) {
    return;
  }

  const meta = (response._meta as Record<string, unknown>) || {};
  meta.pagination = {
    hasMore: pagination.hasMore,
    ...(pagination.cursor && { cursor: pagination.cursor }),
    ...(pagination.limit && { limit: pagination.limit }),
    ...(pagination.offset !== undefined && { offset: pagination.offset }),
  };
  response._meta = meta;
}

export function injectStandardCollectionMeta(
  response: Record<string, unknown>,
  collection?: CollectionMeta
): void {
  if (!collection) {
    return;
  }

  const meta = (response._meta as Record<string, unknown>) || {};
  meta.collection = {
    count: collection.count,
    ...(collection.total !== undefined && { total: collection.total }),
    ...(collection.filtered && { filtered: true }),
  };
  response._meta = meta;
}
