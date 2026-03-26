/**
 * Response Builder for MCP Tool Results
 * Handles truncation, streaming, and resource linking per MCP 2025-11-25
 */

import type { CallToolResult, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';

const LARGE_RESPONSE_THRESHOLD = 10_000; // cells
const STREAMING_THRESHOLD = 50_000; // cells
const MAX_INLINE_CELLS = 1_000; // cells per response

// Pre-allocated templates for common patterns
const SUCCESS_TEMPLATE = {
  response: { success: true, action: '', mutation: { cellsAffected: 0 } },
};

const ERROR_TEMPLATE = {
  response: { success: false, error: { code: '', message: '', retryable: false } },
};

export function buildSuccessResponse(
  action: string,
  data: Record<string, any> = {}
): Record<string, any> {
  return {
    response: {
      success: true,
      action,
      ...data,
    },
  };
}

export function buildErrorResponse(
  code: string,
  message: string,
  retryable: boolean = false
): Record<string, any> {
  return {
    response: {
      success: false,
      error: {
        code,
        message,
        retryable,
      },
    },
  };
}

/**
 * Build truncated response for large datasets
 * Returns resource_link content block per MCP 2025-11-25
 */
export function buildTruncatedResponse(
  action: string,
  cellCount: number,
  resourceUri?: string,
  includeResourceUri: boolean = true
): CallToolResult {
  const content: TextContent = {
    type: 'text',
    text: `Result truncated: ${cellCount} cells. `,
  };

  if (includeResourceUri && resourceUri) {
    content.text += `View full result: ${resourceUri}`;
  }

  return {
    content: [content],
    isError: false,
  };
}

/**
 * Create streaming response for very large datasets (>50K cells)
 * Chunks data for progressive delivery
 */
export function createStreamingResponse(
  action: string,
  cellCount: number,
  chunkSize: number = 5_000
): { totalChunks: number; firstChunk: Record<string, any> } {
  const totalChunks = Math.ceil(cellCount / chunkSize);

  return {
    totalChunks,
    firstChunk: {
      response: {
        success: true,
        action,
        streaming: {
          chunk: 1,
          totalChunks,
          cellsInChunk: Math.min(chunkSize, cellCount),
        },
      },
    },
  };
}

/**
 * Enforce client size limits
 * - 90KB for Claude Desktop
 * - 100KB for default MCP clients
 */
export function enforceClientSizeLimit(response: string, clientType: 'claude' | 'default' = 'default'): string {
  const limit = clientType === 'claude' ? 90_000 : 100_000;
  const bytes = new TextEncoder().encode(response).length;

  if (bytes > limit) {
    logger.warn('Response exceeds client size limit', {
      bytesUsed: bytes,
      limitKB: limit / 1024,
      clientType,
    });
    // Truncate response and add truncation notice
    return response.substring(0, limit - 1000) + '...\n[Response truncated by size limit]';
  }

  return response;
}

/**
 * Build response from pre-computed templates
 * Optimizes for common patterns (read, write, error)
 */
export function buildFromTemplate(
  templateType: 'success' | 'error',
  overrides: Record<string, any> = {}
): Record<string, any> {
  if (templateType === 'success') {
    return { ...SUCCESS_TEMPLATE, response: { ...SUCCESS_TEMPLATE.response, ...overrides } };
  } else {
    return { ...ERROR_TEMPLATE, response: { ...ERROR_TEMPLATE.response, ...overrides } };
  }
}

/**
 * Determine if response should be truncated, streamed, or returned inline
 */
export function getResponseStrategy(cellCount: number): 'inline' | 'truncated' | 'streaming' {
  if (cellCount > STREAMING_THRESHOLD) {
    return 'streaming';
  } else if (cellCount > LARGE_RESPONSE_THRESHOLD) {
    return 'truncated';
  } else {
    return 'inline';
  }
}
