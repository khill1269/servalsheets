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
  SamplingMessage,
  Tool,
  TextContent,
  ModelPreferences,
} from "@modelcontextprotocol/sdk/types.js";

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
  style?: "concise" | "readable" | "optimized";
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
    params: CreateMessageRequest["params"],
  ): Promise<CreateMessageResult>;
}

// ============================================================================
// Capability Detection
// ============================================================================

/**
 * Check if the client supports sampling and its sub-features
 */
export function checkSamplingSupport(
  clientCapabilities: ClientCapabilities | undefined,
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
export function assertSamplingSupport(
  clientCapabilities: ClientCapabilities | undefined,
): void {
  if (!clientCapabilities?.sampling) {
    throw new Error("Client does not support sampling capability");
  }
}

/**
 * Assert that sampling with tools is supported
 */
export function assertSamplingToolsSupport(
  clientCapabilities: ClientCapabilities | undefined,
): void {
  assertSamplingSupport(clientCapabilities);
  if (!clientCapabilities?.sampling?.tools) {
    throw new Error("Client does not support tool use in sampling");
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract text content from sampling result
 */
export function extractTextFromResult(result: CreateMessageResult): string {
  const content = Array.isArray(result.content)
    ? result.content
    : [result.content];
  return content
    .filter((block): block is TextContent => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/**
 * Create a user message for sampling
 */
export function createUserMessage(text: string): SamplingMessage {
  return {
    role: "user",
    content: { type: "text", text },
  };
}

/**
 * Create an assistant message for multi-turn conversations
 */
export function createAssistantMessage(text: string): SamplingMessage {
  return {
    role: "assistant",
    content: { type: "text", text },
  };
}

/**
 * Format spreadsheet data for LLM consumption
 */
export function formatDataForLLM(
  data: unknown[][],
  options: {
    maxRows?: number;
    includeRowNumbers?: boolean;
    format?: "json" | "csv" | "markdown";
  } = {},
): string {
  const {
    maxRows = 100,
    includeRowNumbers = true,
    format = "markdown",
  } = options;

  const truncatedData = data.slice(0, maxRows);
  const wasTruncated = data.length > maxRows;

  let formatted: string;

  switch (format) {
    case "json":
      formatted = JSON.stringify(truncatedData, null, 2);
      break;

    case "csv":
      formatted = truncatedData
        .map((row, i) => {
          const cells = row
            .map((cell) =>
              typeof cell === "string" && cell.includes(",")
                ? `"${cell}"`
                : String(cell ?? ""),
            )
            .join(",");
          return includeRowNumbers ? `${i + 1},${cells}` : cells;
        })
        .join("\n");
      break;

    case "markdown":
    default:
      if (truncatedData.length === 0) {
        formatted = "(empty)";
      } else {
        const headers = truncatedData[0] as unknown[];
        const rows = truncatedData.slice(1);

        // Header row
        const headerRow = includeRowNumbers
          ? `| # | ${headers.map((h) => String(h ?? "")).join(" | ")} |`
          : `| ${headers.map((h) => String(h ?? "")).join(" | ")} |`;

        // Separator
        const separator = includeRowNumbers
          ? `|---|${headers.map(() => "---").join("|")}|`
          : `|${headers.map(() => "---").join("|")}|`;

        // Data rows
        const dataRows = rows.map((row, i) => {
          const cells = (row as unknown[])
            .map((cell) => String(cell ?? ""))
            .join(" | ");
          return includeRowNumbers ? `| ${i + 2} | ${cells} |` : `| ${cells} |`;
        });

        formatted = [headerRow, separator, ...dataRows].join("\n");
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
  options: AnalyzeDataOptions = {},
): Promise<string> {
  assertSamplingSupport(server.getClientCapabilities());

  const {
    systemPrompt = SAMPLING_PROMPTS.dataAnalysis,
    maxTokens = 1000,
    modelPreferences,
    temperature,
  } = options;

  const formattedData = formatDataForLLM(params.data);

  let prompt = `Analyze this spreadsheet data and answer: ${params.question}\n\n`;
  if (params.context) {
    prompt += `Context: ${params.context}\n\n`;
  }
  prompt += `Data:\n${formattedData}`;

  const result = await server.createMessage({
    messages: [createUserMessage(prompt)],
    systemPrompt,
    maxTokens,
    ...(modelPreferences && { modelPreferences }),
    ...(temperature !== undefined && { temperature }),
  });

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
  options: GenerateFormulaOptions = {},
): Promise<string> {
  assertSamplingSupport(server.getClientCapabilities());

  const {
    includeExplanation = false,
    maxTokens = 300,
    style = "readable",
  } = options;

  let prompt = `Generate a Google Sheets formula for: ${params.description}\n\n`;

  if (params.headers) {
    prompt += `Column headers: ${params.headers.join(", ")}\n`;
  }

  if (params.sampleData) {
    prompt += `Sample data:\n${formatDataForLLM(params.sampleData, { maxRows: 5 })}\n`;
  }

  if (params.existingFormulas?.length) {
    prompt += `\nExisting formulas in sheet (for reference):\n${params.existingFormulas.join("\n")}\n`;
  }

  prompt += `\nStyle preference: ${style}`;

  if (!includeExplanation) {
    prompt += "\n\nReturn ONLY the formula, no explanation.";
  }

  const result = await server.createMessage({
    messages: [createUserMessage(prompt)],
    systemPrompt: SAMPLING_PROMPTS.formulaGeneration,
    maxTokens,
  });

  let formula = extractTextFromResult(result).trim();

  // Clean up common formatting issues
  if (!includeExplanation) {
    // Remove markdown code blocks if present
    formula = formula.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
    // Remove leading = if duplicated
    formula = formula.replace(/^=+/, "=");
    // Ensure formula starts with =
    if (!formula.startsWith("=")) {
      formula = "=" + formula;
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
  },
): Promise<{
  chartType: string;
  reason: string;
  alternatives: string[];
}> {
  assertSamplingSupport(server.getClientCapabilities());

  let prompt = "Recommend the best chart type for this data.\n\n";
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

  const result = await server.createMessage({
    messages: [createUserMessage(prompt)],
    systemPrompt: SAMPLING_PROMPTS.chartRecommendation,
    maxTokens: 300,
  });

  const text = extractTextFromResult(result);

  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback parsing
  }

  return {
    chartType: "COLUMN",
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
  options: { detailed?: boolean } = {},
): Promise<string> {
  assertSamplingSupport(server.getClientCapabilities());

  const prompt = options.detailed
    ? `Explain this Google Sheets formula in detail, breaking down each part:\n\n${formula}`
    : `Briefly explain what this Google Sheets formula does:\n\n${formula}`;

  const result = await server.createMessage({
    messages: [createUserMessage(prompt)],
    systemPrompt: SAMPLING_PROMPTS.formulaExplanation,
    maxTokens: options.detailed ? 800 : 300,
  });

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
  },
): Promise<
  Array<{
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    location: string;
    description: string;
    suggestedFix: string;
  }>
> {
  assertSamplingSupport(server.getClientCapabilities());

  let prompt = "Identify data quality issues in this spreadsheet data.\n\n";
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

  const result = await server.createMessage({
    messages: [createUserMessage(prompt)],
    systemPrompt: SAMPLING_PROMPTS.dataCleaning,
    maxTokens: 1500,
  });

  const text = extractTextFromResult(result);

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback
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
    name: "read_range",
    description: "Read values from a spreadsheet range",
    inputSchema: {
      type: "object",
      properties: {
        range: {
          type: "string",
          description: 'A1 notation range (e.g., "Sheet1!A1:C10")',
        },
      },
      required: ["range"],
    },
  },
  {
    name: "write_cell",
    description: "Write a value to a specific cell",
    inputSchema: {
      type: "object",
      properties: {
        cell: { type: "string", description: 'Cell address (e.g., "A1")' },
        value: { type: "string", description: "Value to write" },
      },
      required: ["cell", "value"],
    },
  },
  {
    name: "find_issues",
    description: "Find data quality issues in a range",
    inputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range to analyze" },
        issueTypes: {
          type: "array",
          items: { type: "string" },
          description: "Types of issues to look for",
        },
      },
      required: ["range"],
    },
  },
  {
    name: "apply_fix",
    description: "Apply a fix to a data issue",
    inputSchema: {
      type: "object",
      properties: {
        cell: { type: "string", description: "Cell to fix" },
        oldValue: { type: "string", description: "Current value" },
        newValue: { type: "string", description: "Corrected value" },
        reason: { type: "string", description: "Why this fix is needed" },
      },
      required: ["cell", "oldValue", "newValue", "reason"],
    },
  },
  {
    name: "add_validation",
    description: "Add data validation to a range",
    inputSchema: {
      type: "object",
      properties: {
        range: { type: "string", description: "Range to validate" },
        validationType: {
          type: "string",
          enum: ["list", "number", "date", "text_length", "custom"],
          description: "Type of validation",
        },
        criteria: { type: "string", description: "Validation criteria" },
      },
      required: ["range", "validationType", "criteria"],
    },
  },
  {
    name: "report_complete",
    description: "Report that the task is complete",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Summary of actions taken" },
        changesCount: { type: "number", description: "Number of changes made" },
      },
      required: ["summary", "changesCount"],
    },
  },
];

/**
 * Check if client supports agentic operations (sampling with tools)
 */
export function supportsAgenticOperations(
  clientCapabilities: ClientCapabilities | undefined,
): boolean {
  return !!clientCapabilities?.sampling?.tools;
}

/**
 * Create agentic sampling request parameters
 */
export function createAgenticRequest(
  task: string,
  context: string,
  tools: Tool[] = AGENTIC_TOOLS,
): CreateMessageRequest["params"] {
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
    toolChoice: { mode: "auto" },
    maxTokens: 2000,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type {
  CreateMessageRequest,
  CreateMessageResult,
  SamplingMessage,
  Tool,
  ModelPreferences,
};
