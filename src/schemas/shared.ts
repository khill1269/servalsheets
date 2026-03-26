/**
 * Shared schema types and error models.
 * Centralized definitions for all tool responses, error codes, and common patterns.
 */

import { z } from 'zod';

// ============================================================================
// Error Codes (authoritative list)
// ============================================================================

export const ErrorCodeSchema = z.enum([
  'INVALID_PARAMS',
  'NOT_FOUND',
  'PERMISSION_DENIED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'QUOTA_EXCEEDED',
  'TIMEOUT',
  'INVALID_STATE',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'FAILED_PRECONDITION',
  'NOT_IMPLEMENTED',
  'UNKNOWN',
  'TASK_CANCELLED',
  'AUTHENTICATION_FAILED',
  'CONFIG_ERROR',
  'VALIDATION_ERROR',
  'RESOURCE_EXHAUSTED',
  'UNAVAILABLE',
  'DATA_LOSS',
  'UNAUTHENTICATED',
  'SESSION_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

// ============================================================================
// Error Detail (structured error response)
// ============================================================================

export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  retryable?: boolean;
  retryAfterMs?: number;
  fixableVia?: {
    tool: string;
    action: string;
    params?: Record<string, unknown>;
  };
  suggestedFix?: string;
  resolutionSteps?: string[];
  suggestedTools?: string[];
  details?: Record<string, unknown>;
}

// ============================================================================
// Response Envelope
// ============================================================================

export interface SuccessResponse<T = unknown> {
  success: true;
  action?: string;
  data?: T;
  _meta?: {
    ai?: boolean;
    mode?: string;
    source?: string;
  };
}

export interface ErrorResponse {
  success: false;
  error?: ErrorDetail | { code?: string; message?: string };
  _meta?: {
    trace?: string;
  };
}

export type ToolResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// ============================================================================
// Common Patterns
// ============================================================================

// A1 Notation validation (e.g., "A1", "B2:C10", "Sheet1!A1:D100")
export const A1NotationSchema = z.string()
  .regex(/^[']?[A-Za-z0-9_]+[']?![A-Z$]*\d+(?::[A-Z$]*\d+)?$|^[A-Z$]*\d+(?::[A-Z$]*\d+)?$/, {
    message: 'Invalid A1 notation (e.g., "A1", "B2:C10", "Sheet1!A1:D100")',
  });

// Chart type enum
export const ChartTypeSchema = z.enum([
  'AREA',
  'BAR',
  'COLUMN',
  'COMBO',
  'HISTOGRAM',
  'LINE',
  'SCATTER',
  'STEPPED_AREA',
  'PIE',
  'DOUGHNUT',
  'TREEMAP',
  'WATERFALL',
  'CANDLESTICK',
  'ORG',
  'RADAR',
  'SCORECARD',
  'BUBBLE',
]);

export type ChartType = z.infer<typeof ChartTypeSchema>;

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationInput {
  cursor?: string;
  pageSize?: number;
  maxResults?: number;
}

export interface PaginationOutput {
  cursor?: string;
  hasMore?: boolean;
}

// ============================================================================
// Verbosity Filter
// ============================================================================

export type VerbosityLevel = 'minimal' | 'standard' | 'detailed';

export function applyVerbosityFilter<T extends Record<string, unknown>>(
  data: T,
  verbosity: VerbosityLevel = 'standard'
): T {
  if (verbosity === 'detailed') return data;
  if (verbosity === 'minimal') {
    // Keep only essential fields
    const essential: Record<string, unknown> = {};
    const essentialKeys = ['success', 'action', 'error', 'data', 'values', 'response'];
    for (const key of essentialKeys) {
      if (key in data) essential[key] = data[key];
    }
    return (Object.keys(essential).length > 0 ? essential : data) as T;
  }
  return data;
}
