/**
 * ServalSheets - SEP-1577 Sampling Support
 *
 * Enables server-to-client LLM requests for intelligent spreadsheet operations.
 * The server can request the client's LLM to analyze data, generate formulas,
 * and perform agentic tasks with tool support.
 *
 * @module mcp/sampling
 * @see https://spec.modelcontextprotocol.io/specification/2025-11-25/client/sampling/
 */

import type {
  ClientCapabilities,
  CreateMessageRequest,
  CreateMessageResult,
  CreateMessageResultWithTools,
  SamplingMessage,
  Tool,
  TextContent,
  ModelPreferences,
} from '@modelcontextprotocol/sdk/types.js';
import type { sheets_v4 } from 'googleapis';
import { logger } from '../utils/logger.js';
import { getRequestContext } from '../utils/request-context.js';
import { recordSamplingRequest } from '../observability/metrics.js';
import {
  getSpreadsheetContext,
  formatContextForPrompt,
} from '../services/sampling-context-cache.js';
import { compressContext, formatCompressedContext } from '../services/context-compressor.js';
import type { SessionContextManager } from '../services/session-context.js';
import { ServiceError } from '../core/errors.js';

// ============================================================================
// Cell-level citation type (used in sampling responses)
// ============================================================================

/** A citation linking an AI finding to a specific spreadsheet cell or range. */
export interface CellCitation {
  /** A1 notation cell/range reference (e.g., "B14", "Sheet1!C3:C10") */
  cell: string;
  /** Why this cell is cited */
  role: 'source' | 'evidence' | 'anomaly' | 'formula';
}

/**
 * Extract citations array from a JSON sampling response.
 * Returns empty array if no citations found or parse fails.
 */
export function extractCitationsFromResponse(text: string): CellCitation[] {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && 'citations' in parsed) {
      const citations = (parsed as Record<string, unknown>)['citations'];
      if (Array.isArray(citations)) {
        return citations.filter(
          (c): c is CellCitation =>
            typeof c === 'object' &&
            c !== null &&
            typeof (c as Record<string, unknown>)['cell'] === 'string' &&
            typeof (c as Record<string, unknown>)['role'] === 'string'
        );
      }
    }
  } catch {
    // Non-JSON or malformed — citations are best-effort
  }
  return [];
}

// ============================================================================
// ISSUE-117: GDPR consent gate + timeout wrapper
// Implementations live in src/utils/sampling-consent.ts so service/analysis
// layers can import them without depending on the MCP application layer.
// ============================================================================
export {
  registerSamplingConsentChecker,
  clearSamplingConsentCache,
  assertSamplingConsent,
  withSamplingTimeout,
} from '../utils/sampling-consent.js';
export type { SamplingOperation } from '../utils/sampling-consent.js';
import { assertSamplingConsent, withSamplingTimeout } from '../utils/sampling-consent.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Sampling capability check result
 */
export interface SamplingSupport {
  /** Whether client supports basic sampling */
  supported: boolean;
  /** Whether client supports tool use in sampling (SEP-1577) */
  hasTools: boolean;
  /** Whether client supports context inclusion */
  hasContext: boolean;
}

/**
 * Options for data analysis requests
 */
export interface AnalyzeDataOptions {
  /** System prompt for the analysis */
  systemPrompt?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Model preferences */
  modelPreferences?: ModelPreferences;
  /** Temperature for creativity (0-1) */
  temperature?: number;
  /**
   * 16-A1: Optional context enrichment. When provided, pre-fetches spreadsheet
   * schema (headers, column types, formula count) from the sampling-context-cache
   * and prepends it to the prompt. Saves 200-400ms on repeat calls via TTL cache.
   */
  sheetsApi?: sheets_v4.Sheets;
  /** Spreadsheet ID to enrich prompt with cached schema context (requires sheetsApi) */
  spreadsheetId?: string;
  /**
   * Optional session context manager. When provided, recent operations and the
   * active spreadsheet title are prepended to the user prompt so the LLM has
   * richer context about what the user is currently working on.
   */
  sessionContext?: SessionContextManager;
}

/**
 * Options for formula generation
 */
export interface GenerateFormulaOptions {
  /** Include explanation with formula */
  includeExplanation?: boolean;
  /** Maximum tokens */
  maxTokens?: number;
  /** Preferred formula style */
  style?: 'concise' | 'readable' | 'optimized';
  /** Optional session context for richer LLM prompts */
  sessionContext?: SessionContextManager;
}

/**
 * Result from agentic operations
 */
export interface AgenticResult {
  /** Number of actions taken */
  actionsCount: number;
  /** Description of what was done */
  description: string;
  /** Detailed log of actions */
  actions: Array<{
    type: string;
    target: string;
    details: string;
  }>;
  /** Whether the operation completed successfully */
  success: boolean;
}

/**
 * Server interface for sampling (subset of Server methods we need)
 */
export interface SamplingServer {
  getClientCapabilities(): ClientCapabilities | undefined;
  createMessage(
    params: CreateMessageRequest['params']
  ): Promise<CreateMessageResult | CreateMessageResultWithTools>;
}

interface TaskAwareSamplingServer extends SamplingServer {
  createMessage(
    params: CreateMessageRequest['params'],
    options?: {
      signal?: AbortSignal;
    }
  ): Promise<CreateMessageResult | CreateMessageResultWithTools>;
}

const taskAwareSamplingServerCache = new WeakMap<SamplingServer, SamplingServer>();

/**
 * Wraps an MCP server so nested sampling requests preserve task status updates
 * without depending on request-bound related-request delivery.
 *
 * Streamable HTTP clients can miss request-bound nested sampling messages when
 * they are emitted before the per-request SSE response stream is fully ready.
 * Sending sampling via the base server path targets the normal client request
 * channel instead, which is reliable across stdio and Streamable HTTP.
 */
export function createTaskAwareSamplingServer(baseServer: SamplingServer): SamplingServer {
  const cached = taskAwareSamplingServerCache.get(baseServer);
  if (cached) {
    return cached;
  }

  const wrappedServer: SamplingServer = {
    getClientCapabilities(): ClientCapabilities | undefined {
      return baseServer.getClientCapabilities();
    },
    async createMessage(
      params: CreateMessageRequest['params']
    ): Promise<CreateMessageResult | CreateMessageResultWithTools> {
      const requestContext = getRequestContext();
      if (requestContext?.taskId && requestContext.taskStore) {
        await requestContext.taskStore.updateTaskStatus(requestContext.taskId, 'input_required');
      }

      return await (baseServer as TaskAwareSamplingServer).createMessage(params, {
        signal: requestContext?.abortSignal,
      });
    },
  };

  taskAwareSamplingServerCache.set(baseServer, wrappedServer);
  return wrappedServer;
}

/**
 * Advisory model preferences per operation type.
 * These are hints to the client — the client always chooses the final model.
 * Per MCP 2025-11-25, modelPreferences.hints are advisory, not binding.
 */
const DEFAULT_MODEL_HINTS: Record<string, { hints: Array<{ name: string }>; temperature: number }> =
  {
    formulaGeneration: { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.1 },
    dataAnalysis: { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: 0.5 },
    chartRecommendation: { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.3 },
    formulaExplanation: { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.2 },
    dataIssues: { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.3 },
    scenarioNarrative: { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: 0.4 },
    cleaningStrategy: { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: 0.3 },
    structureDesign: { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: 0.5 },
    queryInterpretation: { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: 0.2 },
    anomalyExplanation: { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.3 },
    templateSuggestion: { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.4 },
    pipelineDesign: { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: 0.3 },
    diffNarrative: { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.3 },
    connectorDiscovery: { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.3 },
    agentPlanning: { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: 0.2 },
  };

/**
 * Adaptive model selection based on action type and data size.
 * Returns model hints and temperature for a given operation context.
 *
 * Rules:
 * - Analysis/narrative actions → Sonnet (deeper reasoning)
 * - Simple classification/summary → Haiku (speed)
 * - Large data (>1000 cells) → Sonnet (better at scale)
 * - Write-path operations → Haiku (speed matters for UX)
 */
export function getModelHint(
  operationType: string,
  dataSize?: number
): { hints: Array<{ name: string }>; temperature: number } {
  const knownHint = DEFAULT_MODEL_HINTS[operationType];
  if (knownHint) {
    if (dataSize && dataSize > 1000 && knownHint.hints[0]?.name.includes('haiku')) {
      return { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: knownHint.temperature };
    }
    return knownHint;
  }
  if (dataSize && dataSize > 1000) {
    return { hints: [{ name: 'claude-sonnet-4-latest' }], temperature: 0.4 };
  }
  return { hints: [{ name: 'claude-3-5-haiku-latest' }], temperature: 0.3 };
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Check if the client supports sampling and its sub-features
 */
export function checkSamplingSupport(
  clientCapabilities: ClientCapabilities | undefined
): SamplingSupport {
  return {
    supported: !!clientCapabilities?.sampling,
    hasTools: !!clientCapabilities?.sampling?.tools,
    hasContext: !!clientCapabilities?.sampling?.context,
  };
}

/**
 * Assert that sampling is supported, throw if not
 */
export function assertSamplingSupport(clientCapabilities: ClientCapabilities | undefined): void {
  if (!clientCapabilities?.sampling) {
    throw new ServiceError(
      'Client does not support sampling capability',
      'INTERNAL_ERROR',
      'sampling'
    );
  }
}

/**
 * Assert that sampling with tools is supported
 */
export function assertSamplingToolsSupport(
  clientCapabilities: ClientCapabilities | undefined
): void {
  assertSamplingSupport(clientCapabilities);
  if (!clientCapabilities?.sampling?.tools) {
    throw new ServiceError(
      'Client does not support tool use in sampling',
      'INTERNAL_ERROR',
      'sampling'
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract text content from sampling result
 */
export function extractTextFromResult(
  result: CreateMessageResult | CreateMessageResultWithTools
): string {
  const content = Array.isArray(result.content) ? result.content : [result.content];
  return content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * Create a user message for sampling
 */
export function createUserMessage(text: string): SamplingMessage {
  return {
    role: 'user',
    content: { type: 'text', text },
  };
}

/**
 * Create an assistant message for multi-turn conversations
 */
export function createAssistantMessage(text: string): SamplingMessage {
  return {
    role: 'assistant',
    content: { type: 'text', text },
  };
}

/**
 * 16-A1: Enrich a system prompt string with cached spreadsheet schema context.
 * Use this in handlers that call `server.createMessage()` directly:
 *
 * ```typescript
 * const enrichedPrompt = await enrichSystemPromptWithContext(
 *   this.sheetsApi, req.spreadsheetId, baseSystemPrompt
 * );
 * await server.createMessage({ ..., systemPrompt: enrichedPrompt });
 * ```
 *
 * Non-blocking: returns baseSystemPrompt unchanged on error.
 */
export async function enrichSystemPromptWithContext(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  baseSystemPrompt: string
): Promise<string> {
  try {
    const ctx = await getSpreadsheetContext(sheetsApi, spreadsheetId);
    const hint = formatContextForPrompt(ctx);
    return hint ? `${hint}\n\n${baseSystemPrompt}` : baseSystemPrompt;
  } catch {
    return baseSystemPrompt;
  }
}

/**
 * Format spreadsheet data for LLM consumption
 */
export function formatDataForLLM(
  data: unknown[][],
  options: {
    maxRows?: number;
    includeRowNumbers?: boolean;
    format?: 'json' | 'csv' | 'markdown';
    /** Use context compression for large datasets (default: true) */
    compress?: boolean;
  } = {}
): string {
  const { maxRows = 100, includeRowNumbers = true, format = 'markdown', compress = true } = options;

  // Context compression for large datasets (80-96% token reduction)
  // Threshold: 200+ rows triggers compression instead of naive truncation
  if (compress && data.length > 200) {
    const compressed = compressContext(data, {
      strategy: 'auto',
      maxSampleRows: Math.min(maxRows, 15),
      maxColumns: 20,
      includeTypes: true,
      includeStats: true,
    });
    return formatCompressedContext(compressed);
  }

  const truncatedData = data.slice(0, maxRows);
  const wasTruncated = data.length > maxRows;

  let formatted: string;

  switch (format) {
    case 'json':
      formatted = JSON.stringify(truncatedData, null, 2);
      break;

    case 'csv':
      formatted = truncatedData
        .map((row, i) => {
          const cells = row
            .map((cell) =>
              typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : String(cell ?? '')
            )
            .join(',');
          return includeRowNumbers ? `${i + 1},${cells}` : cells;
        })
        .join('\n');
      break;

    case 'markdown':
    default:
      if (truncatedData.length === 0) {
        formatted = '(empty)';
      } else {
        const headers = truncatedData[0] as unknown[];
        const rows = truncatedData.slice(1);

        // Header row
        const headerRow = includeRowNumbers
          ? `| # | ${headers.map((h) => String(h ?? '')).join(' | ')} |`
          : `| ${headers.map((h) => String(h ?? '')).join(' | ')} |`;

        // Separator
        const separator = includeRowNumbers
          ? `|---|${headers.map(() => '---').join('|')}|`
          : `|${headers.map(() => '---').join('|')}|`;

        // Data rows
        const dataRows = rows.map((row, i) => {
          const cells = (row as unknown[]).map((cell) => String(cell ?? '')).join(' | ');
          return includeRowNumbers ? `| ${i + 2} | ${cells} |` : `| ${cells} |`;
        });

        formatted = [headerRow, separator, ...dataRows].join('\n');
      }
      break;
  }

  if (wasTruncated) {
    formatted += `\n\n(Showing ${maxRows} of ${data.length} rows)`;
  }

  return formatted;
}
