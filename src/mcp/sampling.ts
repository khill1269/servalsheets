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
import { createRequestAbortError, getRequestContext } from '../utils/request-context.js';
import { getEnv } from '../config/env.js';
import {
  getSpreadsheetContext,
  formatContextForPrompt,
} from '../services/sampling-context-cache.js';
import { compressContext, formatCompressedContext } from '../services/context-compressor.js';

// ============================================================================
// ISSUE-117: GDPR consent gate for Sampling calls
// ============================================================================

/**
 * Optional consent checker registered at server startup.
 * Throws if consent is required but not granted.
 * When null (default), all sampling calls are allowed (backwards-compatible).
 */
let _consentChecker: (() => Promise<void>) | null = null;
const _consentCache = new Map<string, { expiresAt: number; errorMessage?: string }>();

/**
 * Register a GDPR consent check callback. Called before every createMessage().
 * Throw an Error with message 'GDPR_CONSENT_REQUIRED' to block the sampling call.
 *
 * @example
 * registerSamplingConsentChecker(async () => {
 *   const hasConsent = await profileManager.hasConsent(getCurrentUserId());
 *   if (!hasConsent) throw new Error('GDPR_CONSENT_REQUIRED: ...');
 * });
 */
export function registerSamplingConsentChecker(checker: () => Promise<void>): void {
  _consentChecker = checker;
}

function getConsentCacheKey(): string {
  const context = getRequestContext();
  return context?.principalId ?? context?.requestId ?? 'global';
}

function purgeExpiredConsentEntries(nowMs: number): void {
  for (const [key, entry] of _consentCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      _consentCache.delete(key);
    }
  }
}

export function clearSamplingConsentCache(): void {
  _consentCache.clear();
}

export async function assertSamplingConsent(): Promise<void> {
  if (!_consentChecker) {
    return;
  }

  const ttlMs = getEnv().SAMPLING_CONSENT_CACHE_TTL_MS;
  if (ttlMs <= 0) {
    await _consentChecker();
    return;
  }

  const nowMs = Date.now();
  purgeExpiredConsentEntries(nowMs);

  const cacheKey = getConsentCacheKey();
  const cached = _consentCache.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    if (cached.errorMessage) {
      throw new Error(cached.errorMessage);
    }
    return;
  }

  try {
    await _consentChecker();
    _consentCache.set(cacheKey, { expiresAt: nowMs + ttlMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    _consentCache.set(cacheKey, { expiresAt: nowMs + ttlMs, errorMessage: message });
    throw error;
  }
}

// ============================================================================
// Timeout Wrapper (ISSUE-088)
// ============================================================================

/** Default sampling request timeout in ms (configurable via SAMPLING_TIMEOUT_MS env var) */
const SAMPLING_TIMEOUT_MS = parseInt(process.env['SAMPLING_TIMEOUT_MS'] ?? '30000', 10);
type SamplingOperation<T> = Promise<T> | (() => Promise<T>);

function getEffectiveSamplingTimeout(deadline: number | undefined): number {
  if (!Number.isFinite(SAMPLING_TIMEOUT_MS) || SAMPLING_TIMEOUT_MS <= 0) {
    return 30000;
  }
  if (!Number.isFinite(deadline)) {
    return SAMPLING_TIMEOUT_MS;
  }
  return Math.min(SAMPLING_TIMEOUT_MS, Math.max(0, (deadline as number) - Date.now()));
}

/**
 * Wrap a sampling request with a configurable timeout.
 * Respects the current request deadline so sampling never outlasts its parent request.
 * Rejects with a descriptive error if the request exceeds the effective timeout.
 */
export function withSamplingTimeout<T>(operation: SamplingOperation<T>): Promise<T> {
  // Use the remaining request deadline if available, capped at SAMPLING_TIMEOUT_MS
  const ctx = getRequestContext();
  const abortSignal = ctx?.abortSignal;
  const effectiveTimeout = getEffectiveSamplingTimeout(ctx?.deadline);
  const execute = typeof operation === 'function' ? operation : () => operation;

  if (abortSignal?.aborted) {
    return Promise.reject(
      createRequestAbortError(abortSignal.reason, 'Sampling request cancelled by client')
    );
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer) {
        clearTimeout(timer);
      }
      abortSignal?.removeEventListener('abort', onAbort);
    };
    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = (): void => {
      settle(() =>
        reject(createRequestAbortError(abortSignal?.reason, 'Sampling request cancelled by client'))
      );
    };

    abortSignal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      settle(() => reject(new Error(`Sampling request timed out after ${effectiveTimeout}ms`)));
    }, effectiveTimeout);

    Promise.resolve()
      .then(() => execute())
      .then(
        (value) => {
          settle(() => resolve(value));
        },
        (error: unknown) => {
          settle(() => reject(error));
        }
      );
  });
}

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
    throw new Error('Client does not support sampling capability');
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
    throw new Error('Client does not support tool use in sampling');
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

// ============================================================================
// Default Prompts
// ============================================================================

/**
 * System prompts for different use cases
 */
export const SAMPLING_PROMPTS = {
  dataAnalysis: `You are an expert data analyst helping users understand their spreadsheet data.
Provide clear, actionable insights. Use specific numbers and percentages when relevant.
Format your response with clear sections if analyzing multiple aspects.
Be concise but thorough.`,

  formulaGeneration: `You are a Google Sheets formula expert.
Generate formulas using Google Sheets syntax (not Excel).
Available functions include: QUERY, ARRAYFORMULA, IMPORTRANGE, GOOGLEFINANCE, etc.
Return ONLY the formula unless asked for explanation.
Use modern array formulas when appropriate.`,

  dataCleaning: `You are a data quality specialist.
Identify issues like: inconsistent formats, duplicates, missing values, typos, outliers.
Prioritize issues by severity and frequency.
Suggest specific fixes with before/after examples.`,

  chartRecommendation: `You are a data visualization expert.
Recommend the best chart type for the given data.
Consider: data relationships, audience, message to convey.
Explain why your recommendation fits the data.`,

  formulaExplanation: `You are a Google Sheets teacher.
Explain formulas in simple terms.
Break down complex formulas into steps.
Provide examples of how each part works.`,

  scenarioNarrative: `You are a financial modeling expert explaining what-if scenarios.
Explain the cascade of changes in plain language — how one change propagates through formulas.
Highlight the most impactful downstream effects and quantify percentage changes.
Flag any cells where the impact exceeds 20% as high-risk.`,

  cleaningStrategy: `You are a data quality engineer advising on data cleaning.
Given the column profiles and sample data, recommend which cleaning rules to apply and in what order.
Prioritize rules that fix the most issues. Explain why each rule matters.
Flag ambiguous cases (e.g., date formats that could be MM/DD or DD/MM).`,

  structureDesign: `You are a spreadsheet architect designing sheet structures.
Given a natural language description, design a complete spreadsheet with:
- Column headers with appropriate types (text, number, currency, date, percentage)
- Formulas for calculated columns (use Google Sheets syntax)
- Conditional formatting rules for key metrics
- Sample data rows that demonstrate the structure
Return a JSON object with sheets, columns, formulas, and formatting.`,

  queryInterpretation: `You are a data query translator.
Convert natural language questions into structured query operations.
Identify: which columns to filter, sort criteria, aggregation functions, join keys.
Return a JSON object with: filters, sort, aggregations, joinConfig.
Always explain your interpretation so the user can verify.`,

  anomalyExplanation: `You are a statistical analyst explaining data anomalies.
For each flagged outlier, explain: what makes it unusual, possible causes, and whether it's likely a data error or a genuine extreme value.
Reference the column context and surrounding values.
Suggest whether to fix, investigate, or keep each anomaly.`,

  templateSuggestion: `You are a productivity consultant recommending spreadsheet templates.
Based on the user's description, suggest which template category fits best.
Recommend specific column structures and formulas for their use case.
Consider industry-specific conventions and best practices.`,

  pipelineDesign: `You are a data pipeline architect.
Design a sequence of transformation steps to move data from source to destination.
Each step should reference a specific ServalSheets action (tool.action format).
Include validation checks between steps and rollback strategies.`,

  diffNarrative: `You are a change management analyst reviewing spreadsheet modifications.
Summarize what changed between revisions in plain language.
Group related changes together (e.g., "Updated all Q2 projections").
Highlight potentially problematic changes (deleted formulas, large value swings).`,

  connectorDiscovery: `You are a data integration specialist.
Given a user's data need description, recommend which data connector to use.
Explain what data each connector provides and how to configure it.
If multiple connectors could work, rank them by relevance and ease of setup.`,

  agentPlanning: `You are a task planning expert for spreadsheet operations.
Given a natural language description of what the user wants to accomplish, generate a step-by-step execution plan.
Each step must reference a specific ServalSheets tool and action (e.g., sheets_data.read, sheets_format.set_format).
Include required parameters for each step. Order steps by dependency.
Return a JSON array of plan steps: [{ tool, action, params, description }].`,
};

// ============================================================================
// High-Level Sampling Functions
// ============================================================================

/**
 * Analyze spreadsheet data using the client's LLM
 *
 * @example
 * ```typescript
 * const insights = await analyzeData(server, {
 *   data: [['Product', 'Sales'], ['A', 100], ['B', 200]],
 *   question: 'Which product is performing best?'
 * });
 * ```
 */
export async function analyzeData(
  server: SamplingServer,
  params: {
    data: unknown[][];
    question: string;
    context?: string;
  },
  options: AnalyzeDataOptions = {}
): Promise<string> {
  assertSamplingSupport(server.getClientCapabilities());
  await assertSamplingConsent(); // ISSUE-117: GDPR consent gate

  const {
    systemPrompt = SAMPLING_PROMPTS.dataAnalysis,
    maxTokens = 1000,
    modelPreferences,
    temperature,
    sheetsApi,
    spreadsheetId,
  } = options;

  const formattedData = formatDataForLLM(params.data);

  // 16-A1: Enrich prompt with cached spreadsheet schema context (saves 200-400ms on repeat calls)
  let schemaContext = params.context ?? '';
  if (!schemaContext && sheetsApi && spreadsheetId) {
    try {
      const ctx = await getSpreadsheetContext(sheetsApi, spreadsheetId);
      schemaContext = formatContextForPrompt(ctx);
    } catch {
      // Non-blocking: schema context enrichment is best-effort
    }
  }

  let prompt = `Analyze this spreadsheet data and answer: ${params.question}\n\n`;
  if (schemaContext) {
    prompt += `Context: ${schemaContext}\n\n`;
  }
  prompt += `Data:\n${formattedData}`;

  const result = await withSamplingTimeout(() =>
    server.createMessage({
      messages: [createUserMessage(prompt)],
      systemPrompt,
      maxTokens,
      ...(modelPreferences && { modelPreferences }),
      ...(temperature !== undefined && { temperature }),
    })
  );

  return extractTextFromResult(result);
}

/**
 * Generate a Google Sheets formula from natural language
 *
 * @example
 * ```typescript
 * const formula = await generateFormula(server, {
 *   description: 'Sum all values in column B where column A equals "Active"',
 *   headers: ['Status', 'Amount', 'Date']
 * });
 * // Returns: =SUMIF(A:A,"Active",B:B)
 * ```
 */
export async function generateFormula(
  server: SamplingServer,
  params: {
    description: string;
    headers?: string[];
    sampleData?: unknown[][];
    existingFormulas?: string[];
  },
  options: GenerateFormulaOptions = {}
): Promise<string> {
  assertSamplingSupport(server.getClientCapabilities());
  await assertSamplingConsent(); // ISSUE-117: GDPR consent gate

  const { includeExplanation = false, maxTokens = 300, style = 'readable' } = options;

  let prompt = `Generate a Google Sheets formula for: ${params.description}\n\n`;

  if (params.headers) {
    prompt += `Column headers: ${params.headers.join(', ')}\n`;
  }

  if (params.sampleData) {
    prompt += `Sample data:\n${formatDataForLLM(params.sampleData, { maxRows: 5 })}\n`;
  }

  if (params.existingFormulas?.length) {
    prompt += `\nExisting formulas in sheet (for reference):\n${params.existingFormulas.join('\n')}\n`;
  }

  prompt += `\nStyle preference: ${style}`;

  if (!includeExplanation) {
    prompt += '\n\nReturn ONLY the formula, no explanation.';
  }

  const defaults = DEFAULT_MODEL_HINTS['formulaGeneration']!;
  const result = await withSamplingTimeout(() =>
    server.createMessage({
      messages: [createUserMessage(prompt)],
      systemPrompt: SAMPLING_PROMPTS.formulaGeneration,
      maxTokens,
      modelPreferences: { hints: defaults.hints },
      temperature: defaults.temperature,
    })
  );

  let formula = extractTextFromResult(result).trim();

  // Clean up common formatting issues
  if (!includeExplanation) {
    // Remove markdown code blocks if present
    formula = formula.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
    // Remove leading = if duplicated
    formula = formula.replace(/^=+/, '=');
    // Ensure formula starts with =
    if (!formula.startsWith('=')) {
      formula = '=' + formula;
    }
  }

  return formula;
}

/**
 * Get chart type recommendation for data
 */
export async function recommendChart(
  server: SamplingServer,
  params: {
    data: unknown[][];
    purpose?: string;
    audience?: string;
  }
): Promise<{
  chartType: string;
  reason: string;
  alternatives: string[];
}> {
  assertSamplingSupport(server.getClientCapabilities());
  await assertSamplingConsent(); // ISSUE-117: GDPR consent gate

  let prompt = 'Recommend the best chart type for this data.\n\n';
  prompt += `Data:\n${formatDataForLLM(params.data, { maxRows: 20 })}\n\n`;

  if (params.purpose) {
    prompt += `Purpose: ${params.purpose}\n`;
  }
  if (params.audience) {
    prompt += `Audience: ${params.audience}\n`;
  }

  prompt += `\nRespond in this exact JSON format:
{
  "chartType": "COLUMN|LINE|PIE|SCATTER|AREA|BAR",
  "reason": "Brief explanation",
  "alternatives": ["Alternative1", "Alternative2"]
}`;

  const chartDefaults = DEFAULT_MODEL_HINTS['chartRecommendation']!;
  const result = await withSamplingTimeout(() =>
    server.createMessage({
      messages: [createUserMessage(prompt)],
      systemPrompt: SAMPLING_PROMPTS.chartRecommendation,
      maxTokens: 300,
      modelPreferences: { hints: chartDefaults.hints },
      temperature: chartDefaults.temperature,
    })
  );

  const text = extractTextFromResult(result);

  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    logger.warn('Failed to parse chart suggestion JSON', {
      error: error instanceof Error ? error.message : String(error),
      textLength: text.length,
    });
  }

  return {
    chartType: 'COLUMN',
    reason: text,
    alternatives: [],
  };
}

/**
 * Explain a complex formula
 */
export async function explainFormula(
  server: SamplingServer,
  formula: string,
  options: { detailed?: boolean } = {}
): Promise<string> {
  assertSamplingSupport(server.getClientCapabilities());
  await assertSamplingConsent(); // ISSUE-117: GDPR consent gate

  const prompt = options.detailed
    ? `Explain this Google Sheets formula in detail, breaking down each part:\n\n${formula}`
    : `Briefly explain what this Google Sheets formula does:\n\n${formula}`;

  const explainDefaults = DEFAULT_MODEL_HINTS['formulaExplanation']!;
  const result = await withSamplingTimeout(() =>
    server.createMessage({
      messages: [createUserMessage(prompt)],
      systemPrompt: SAMPLING_PROMPTS.formulaExplanation,
      maxTokens: options.detailed ? 800 : 300,
      modelPreferences: { hints: explainDefaults.hints },
      temperature: explainDefaults.temperature,
    })
  );

  return extractTextFromResult(result);
}

/**
 * Identify data quality issues
 */
export async function identifyDataIssues(
  server: SamplingServer,
  params: {
    data: unknown[][];
    columnTypes?: Record<string, string>;
  }
): Promise<
  Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    location: string;
    description: string;
    suggestedFix: string;
  }>
> {
  assertSamplingSupport(server.getClientCapabilities());
  await assertSamplingConsent(); // ISSUE-117: GDPR consent gate

  let prompt = 'Identify data quality issues in this spreadsheet data.\n\n';
  prompt += `Data:\n${formatDataForLLM(params.data, { maxRows: 50 })}\n\n`;

  if (params.columnTypes) {
    prompt += `Expected column types: ${JSON.stringify(params.columnTypes)}\n\n`;
  }

  prompt += `Respond with a JSON array of issues:
[{
  "type": "missing_value|duplicate|inconsistent_format|invalid_type|outlier|typo",
  "severity": "critical|high|medium|low",
  "location": "Row X, Column Y",
  "description": "What's wrong",
  "suggestedFix": "How to fix it"
}]`;

  const result = await withSamplingTimeout(() =>
    server.createMessage({
      messages: [createUserMessage(prompt)],
      systemPrompt: SAMPLING_PROMPTS.dataCleaning,
      maxTokens: 1500,
    })
  );

  const text = extractTextFromResult(result);

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    logger.warn('Failed to parse data cleaning issues JSON', {
      error: error instanceof Error ? error.message : String(error),
      textLength: text.length,
    });
  }

  return [];
}

// ============================================================================
// Agentic Operations (SEP-1577 with Tools)
// ============================================================================

/**
 * Tools available for agentic data operations
 */
export const AGENTIC_TOOLS: Tool[] = [
  {
    name: 'read_range',
    description: 'Read values from a spreadsheet range',
    inputSchema: {
      type: 'object',
      properties: {
        range: {
          type: 'string',
          description: 'A1 notation range (e.g., "Sheet1!A1:C10")',
        },
      },
      required: ['range'],
    },
  },
  {
    name: 'write_cell',
    description: 'Write a value to a specific cell',
    inputSchema: {
      type: 'object',
      properties: {
        cell: { type: 'string', description: 'Cell address (e.g., "A1")' },
        value: { type: 'string', description: 'Value to write' },
      },
      required: ['cell', 'value'],
    },
  },
  {
    name: 'find_issues',
    description: 'Find data quality issues in a range',
    inputSchema: {
      type: 'object',
      properties: {
        range: { type: 'string', description: 'Range to analyze' },
        issueTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types of issues to look for',
        },
      },
      required: ['range'],
    },
  },
  {
    name: 'apply_fix',
    description: 'Apply a fix to a data issue',
    inputSchema: {
      type: 'object',
      properties: {
        cell: { type: 'string', description: 'Cell to fix' },
        oldValue: { type: 'string', description: 'Current value' },
        newValue: { type: 'string', description: 'Corrected value' },
        reason: { type: 'string', description: 'Why this fix is needed' },
      },
      required: ['cell', 'oldValue', 'newValue', 'reason'],
    },
  },
  {
    name: 'set_data_validation',
    description: 'Set data validation on a range',
    inputSchema: {
      type: 'object',
      properties: {
        range: { type: 'string', description: 'Range to validate (A1 notation)' },
        condition: {
          type: 'object',
          description:
            'Validation condition (e.g., ONE_OF_LIST, NUMBER_BETWEEN, DATE_AFTER, CUSTOM_FORMULA)',
        },
        inputMessage: { type: 'string', description: 'Help text shown on cell selection' },
        strict: { type: 'boolean', description: 'Reject invalid input (default true)' },
        showDropdown: { type: 'boolean', description: 'Show dropdown for list validations' },
      },
      required: ['range', 'condition'],
    },
  },
  {
    name: 'report_complete',
    description: 'Report that the task is complete',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Summary of actions taken' },
        changesCount: { type: 'number', description: 'Number of changes made' },
      },
      required: ['summary', 'changesCount'],
    },
  },
];

/**
 * Check if client supports agentic operations (sampling with tools)
 */
export function supportsAgenticOperations(
  clientCapabilities: ClientCapabilities | undefined
): boolean {
  return !!clientCapabilities?.sampling?.tools;
}

/**
 * Create agentic sampling request parameters
 */
export function createAgenticRequest(
  task: string,
  context: string,
  tools: Tool[] = AGENTIC_TOOLS
): CreateMessageRequest['params'] {
  return {
    messages: [createUserMessage(`${task}\n\nContext:\n${context}`)],
    systemPrompt: `You are an autonomous spreadsheet assistant. Use the available tools to complete the task.
Work step by step:
1. First, understand the current state
2. Identify what needs to be done
3. Make changes using the appropriate tools
4. Verify your changes
5. Report completion

Be careful with destructive operations. Always explain your reasoning.`,
    tools,
    toolChoice: { mode: 'auto' },
    maxTokens: 2000,
  };
}

// ============================================================================
// Streaming Support (SEP-1577 Optimization)
// ============================================================================

/**
 * Progress callback for streaming operations
 */
export type StreamingProgressCallback = (event: {
  phase: 'preparing' | 'sending' | 'receiving' | 'processing' | 'complete';
  progress?: number;
  total?: number;
  partialResult?: string;
  message?: string;
}) => void;

/**
 * Options for streaming sampling operations
 */
export interface StreamingSamplingOptions extends AnalyzeDataOptions {
  /** Callback for progress updates */
  onProgress?: StreamingProgressCallback;
  /** Chunk size for processing large datasets */
  chunkSize?: number;
  /** Maximum concurrent chunks */
  maxConcurrency?: number;
}

/**
 * Chunked result for large dataset analysis
 */
export interface ChunkedAnalysisResult {
  /** Results for each chunk */
  chunks: Array<{
    chunkIndex: number;
    startRow: number;
    endRow: number;
    analysis: string;
  }>;
  /** Aggregated summary across all chunks */
  summary: string;
  /** Total rows analyzed */
  totalRows: number;
  /** Processing time in ms */
  processingTime: number;
}

/**
 * Analyze large datasets in chunks with streaming progress
 *
 * For datasets larger than the chunk size, this function:
 * 1. Splits data into manageable chunks
 * 2. Analyzes each chunk with progress reporting
 * 3. Aggregates results into a summary
 *
 * @example
 * ```typescript
 * const result = await analyzeDataStreaming(server, {
 *   data: largeDataset, // 10,000 rows
 *   question: 'What are the sales trends?'
 * }, {
 *   chunkSize: 500,
 *   onProgress: (event) => logger.debug(`${event.phase}: ${event.progress}/${event.total}`)
 * });
 * ```
 */
export async function analyzeDataStreaming(
  server: SamplingServer,
  params: {
    data: unknown[][];
    question: string;
    context?: string;
  },
  options: StreamingSamplingOptions = {}
): Promise<ChunkedAnalysisResult> {
  assertSamplingSupport(server.getClientCapabilities());

  const {
    chunkSize = 500,
    onProgress,
    systemPrompt = SAMPLING_PROMPTS.dataAnalysis,
    maxTokens = 1000,
    modelPreferences,
  } = options;

  const startTime = Date.now();
  const headers = params.data[0] as unknown[];
  const dataRows = params.data.slice(1);
  const totalRows = dataRows.length;

  // If data is small enough, use regular analysis
  if (totalRows <= chunkSize) {
    onProgress?.({ phase: 'preparing', message: 'Dataset small enough for single analysis' });

    const result = await analyzeData(server, params, {
      systemPrompt,
      maxTokens,
      modelPreferences,
    });

    return {
      chunks: [
        {
          chunkIndex: 0,
          startRow: 1,
          endRow: totalRows,
          analysis: result,
        },
      ],
      summary: result,
      totalRows,
      processingTime: Date.now() - startTime,
    };
  }

  // Split into chunks
  const chunks: unknown[][][] = [];
  for (let i = 0; i < dataRows.length; i += chunkSize) {
    chunks.push([headers, ...dataRows.slice(i, Math.min(i + chunkSize, dataRows.length))]);
  }

  onProgress?.({
    phase: 'preparing',
    progress: 0,
    total: chunks.length,
    message: `Splitting ${totalRows} rows into ${chunks.length} chunks`,
  });

  // Analyze each chunk
  const chunkResults: ChunkedAnalysisResult['chunks'] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const startRow = i * chunkSize + 1;
    const endRow = Math.min((i + 1) * chunkSize, totalRows);

    onProgress?.({
      phase: 'processing',
      progress: i,
      total: chunks.length,
      message: `Analyzing rows ${startRow}-${endRow}`,
    });

    const chunkQuestion = `${params.question}\n\n(This is chunk ${i + 1} of ${chunks.length}, rows ${startRow}-${endRow})`;

    const analysis = await analyzeData(
      server,
      {
        data: chunk,
        question: chunkQuestion,
        context: params.context,
      },
      { systemPrompt, maxTokens, modelPreferences }
    );

    chunkResults.push({
      chunkIndex: i,
      startRow,
      endRow,
      analysis,
    });

    onProgress?.({
      phase: 'processing',
      progress: i + 1,
      total: chunks.length,
      partialResult: analysis,
      message: `Completed chunk ${i + 1} of ${chunks.length}`,
    });
  }

  // Generate summary from all chunks
  onProgress?.({
    phase: 'processing',
    message: 'Generating summary from all chunks',
  });

  const summaryPrompt = `Based on these ${chunks.length} partial analyses of a ${totalRows}-row dataset, provide a unified summary:

${chunkResults.map((r) => `--- Rows ${r.startRow}-${r.endRow} ---\n${r.analysis}`).join('\n\n')}

Original question: ${params.question}

Provide a cohesive summary that synthesizes insights from all chunks.`;

  await assertSamplingConsent(); // ISSUE-117: consent gate for summary generation
  const summary = await withSamplingTimeout(() =>
    server.createMessage({
      messages: [createUserMessage(summaryPrompt)],
      systemPrompt:
        'Synthesize multiple partial analyses into a cohesive summary. Identify patterns that span across chunks. Be concise but comprehensive.',
      maxTokens: maxTokens * 2, // More tokens for summary
      ...(modelPreferences && { modelPreferences }),
    })
  );

  onProgress?.({
    phase: 'complete',
    progress: chunks.length,
    total: chunks.length,
    message: 'Analysis complete',
  });

  return {
    chunks: chunkResults,
    summary: extractTextFromResult(summary),
    totalRows,
    processingTime: Date.now() - startTime,
  };
}

/**
 * Stream tool results incrementally for agentic operations
 *
 * This function allows processing tool results as they arrive,
 * rather than waiting for the complete response.
 */
export async function* streamAgenticOperation(
  server: SamplingServer,
  task: string,
  context: string,
  toolHandler: (
    toolName: string,
    args: Record<string, unknown>
  ) => Promise<{ result: unknown; continue: boolean }>
): AsyncGenerator<
  {
    type: 'tool_call' | 'tool_result' | 'text' | 'complete';
    data: unknown;
  },
  AgenticResult,
  undefined
> {
  assertSamplingToolsSupport(server.getClientCapabilities());
  await assertSamplingConsent(); // ISSUE-117: consent gate for agentic sampling loop

  const actions: AgenticResult['actions'] = [];
  let continueLoop = true;
  let iterationCount = 0;
  const maxIterations = 10;

  let params = createAgenticRequest(task, context);

  while (continueLoop && iterationCount < maxIterations) {
    iterationCount++;

    const result = await withSamplingTimeout(() => server.createMessage(params));

    // Process content
    const contentBlocks = Array.isArray(result.content) ? result.content : [result.content];

    // Preserve assistant turn in conversation history for subsequent iterations
    params = {
      ...params,
      messages: [...params.messages, { role: 'assistant', content: result.content }],
    };

    for (const block of contentBlocks) {
      if (block.type === 'text') {
        yield { type: 'text', data: block.text };
      } else if (block.type === 'tool_use') {
        yield {
          type: 'tool_call',
          data: { name: block.name, arguments: block.input },
        };

        // Execute tool
        const actionResult = await toolHandler(block.name, block.input as Record<string, unknown>);

        yield { type: 'tool_result', data: actionResult.result };

        actions.push({
          type: block.name,
          target: JSON.stringify(block.input),
          details: JSON.stringify(actionResult.result),
        });

        const serializedResult = (() => {
          try {
            return JSON.stringify(actionResult.result);
          } catch {
            return String(actionResult.result);
          }
        })();

        params = {
          ...params,
          messages: [
            ...params.messages,
            {
              role: 'user',
              content: {
                type: 'tool_result',
                toolUseId: block.id,
                content: [{ type: 'text', text: serializedResult }],
              },
            },
          ],
        };

        if (!actionResult.continue) {
          continueLoop = false;
        }
      }
    }

    // Check stop reason
    if (
      result.stopReason === 'endTurn' ||
      result.stopReason === 'stopSequence' ||
      result.stopReason === 'maxTokens' ||
      result.stopReason === 'toolUse'
    ) {
      continueLoop = false;
    }
  }

  yield { type: 'complete', data: { actionsCount: actions.length } };

  return {
    actionsCount: actions.length,
    description: `Completed ${actions.length} actions in ${iterationCount} iterations`,
    actions,
    success: true,
  };
}

// ============================================================================
// AI Insight Helper (P1 Sampling Explosion)
// ============================================================================

/**
 * Generate an AI insight for any handler action. Gracefully returns undefined
 * if sampling is unavailable, consent is denied, or the call times out.
 * This is the standard pattern for adding sampling to handler actions.
 *
 * @param server - SamplingServer from handler context (may be undefined)
 * @param promptType - Key from SAMPLING_PROMPTS (e.g., 'scenarioNarrative')
 * @param question - The specific question to answer
 * @param data - Relevant data to include in the prompt
 * @param options - Optional overrides for maxTokens, temperature, etc.
 * @returns AI-generated insight string, or undefined if unavailable
 */
export async function generateAIInsight(
  server: SamplingServer | undefined,
  promptType: keyof typeof SAMPLING_PROMPTS,
  question: string,
  data?: unknown,
  options?: { maxTokens?: number; context?: string }
): Promise<string | undefined> {
  if (!server) return undefined;

  try {
    assertSamplingSupport(server.getClientCapabilities());
    await assertSamplingConsent();

    const systemPrompt = SAMPLING_PROMPTS[promptType] ?? SAMPLING_PROMPTS.dataAnalysis;
    const modelHint = getModelHint(promptType);

    let prompt = question;
    if (data) {
      const formattedData =
        Array.isArray(data) && Array.isArray(data[0])
          ? formatDataForLLM(data as unknown[][])
          : typeof data === 'string'
            ? data
            : JSON.stringify(data, null, 2).slice(0, 4000);
      prompt += `\n\nData:\n${formattedData}`;
    }
    if (options?.context) {
      prompt += `\n\nContext: ${options.context}`;
    }

    const result = await withSamplingTimeout(() =>
      server.createMessage({
        messages: [createUserMessage(prompt)],
        systemPrompt,
        maxTokens: options?.maxTokens ?? 500,
        modelPreferences: { hints: modelHint.hints },
        temperature: modelHint.temperature,
      })
    );

    return extractTextFromResult(result);
  } catch (err) {
    logger.debug('AI insight generation skipped', {
      promptType,
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return undefined;
  }
}

// ============================================================================
// Exports
// ============================================================================

export type {
  CreateMessageRequest,
  CreateMessageResult,
  CreateMessageResultWithTools,
  SamplingMessage,
  Tool,
  ModelPreferences,
};
