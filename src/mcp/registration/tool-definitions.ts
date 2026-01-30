/**
 * ServalSheets - Tool Definitions
 *
 * Complete tool registry with Zod schemas and metadata.
 *
 * @module mcp/registration/tool-definitions
 */

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodTypeAny } from 'zod';

import {
  TOOL_MODE,
  ESSENTIAL_TOOLS,
  STANDARD_TOOLS,
  DEFER_DESCRIPTIONS,
} from '../../config/constants.js';
import { getLazyLoadTools } from '../../config/schema-optimization.js';
import {
  SheetsAuthInputSchema,
  SheetsAuthOutputSchema,
  SHEETS_AUTH_ANNOTATIONS,
  SheetsCoreInputSchema,
  SheetsCoreOutputSchema,
  SHEETS_CORE_ANNOTATIONS,
  SheetsDataInputSchema,
  SheetsDataOutputSchema,
  SHEETS_DATA_ANNOTATIONS,
  SheetsFormatInputSchema,
  SheetsFormatOutputSchema,
  SHEETS_FORMAT_ANNOTATIONS,
  SheetsDimensionsInputSchema,
  SheetsDimensionsOutputSchema,
  SHEETS_DIMENSIONS_ANNOTATIONS,
  SheetsVisualizeInputSchema,
  SheetsVisualizeOutputSchema,
  SHEETS_VISUALIZE_ANNOTATIONS,
  SheetsCollaborateInputSchema,
  SheetsCollaborateOutputSchema,
  SHEETS_COLLABORATE_ANNOTATIONS,
  SheetsAdvancedInputSchema,
  SheetsAdvancedOutputSchema,
  SHEETS_ADVANCED_ANNOTATIONS,
  SheetsTransactionInputSchema,
  SheetsTransactionOutputSchema,
  SHEETS_TRANSACTION_ANNOTATIONS,
  SheetsQualityInputSchema,
  SheetsQualityOutputSchema,
  SHEETS_QUALITY_ANNOTATIONS,
  SheetsHistoryInputSchema,
  SheetsHistoryOutputSchema,
  SHEETS_HISTORY_ANNOTATIONS,
  // New MCP-native tools
  SheetsConfirmInputSchema,
  SheetsConfirmOutputSchema,
  SHEETS_CONFIRM_ANNOTATIONS,
  SheetsAnalyzeInputSchema,
  SheetsAnalyzeOutputSchema,
  SHEETS_ANALYZE_ANNOTATIONS,
  SheetsFixInputSchema,
  SheetsFixOutputSchema,
  SHEETS_FIX_ANNOTATIONS,
  // Composite operations
  CompositeInputSchema,
  CompositeOutputSchema,
  SHEETS_COMPOSITE_ANNOTATIONS,
  // Session context for NL excellence
  SheetsSessionInputSchema,
  SheetsSessionOutputSchema,
  SHEETS_SESSION_ANNOTATIONS,
  // Tier 7 Enterprise tools
  SheetsTemplatesInputSchema,
  SheetsTemplatesOutputSchema,
  SHEETS_TEMPLATES_ANNOTATIONS,
  SheetsBigQueryInputSchema,
  SheetsBigQueryOutputSchema,
  SHEETS_BIGQUERY_ANNOTATIONS,
  SheetsAppsScriptInputSchema,
  SheetsAppsScriptOutputSchema,
  SHEETS_APPSSCRIPT_ANNOTATIONS,
  // Phase 3 tools
  SheetsWebhookInputSchema,
  SheetsWebhookOutputSchema,
  SHEETS_WEBHOOK_ANNOTATIONS,
  SheetsDependenciesInputSchema,
  SheetsDependenciesOutputSchema,
  SHEETS_DEPENDENCIES_ANNOTATIONS,
  // LLM-optimized descriptions
  TOOL_DESCRIPTIONS,
  TOOL_DESCRIPTIONS_MINIMAL,
} from '../../schemas/index.js';

/**
 * Get the appropriate tool description based on DEFER_DESCRIPTIONS setting.
 *
 * When DEFER_DESCRIPTIONS=true, uses minimal ~100 char descriptions to save ~7,700 tokens.
 * Full documentation available via schema://tools/{toolName} resources.
 */
function getDescription(toolName: string): string {
  if (DEFER_DESCRIPTIONS) {
    return TOOL_DESCRIPTIONS_MINIMAL[toolName] ?? TOOL_DESCRIPTIONS[toolName] ?? '';
  }
  return TOOL_DESCRIPTIONS[toolName] ?? '';
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Tool definition with Zod schemas
 *
 * Schemas can be z.object(), z.discriminatedUnion(), or other Zod types.
 * The SDK compatibility layer handles conversion to JSON Schema.
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodTypeAny;
  readonly outputSchema: ZodTypeAny;
  readonly annotations: ToolAnnotations;
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Complete tool registry for ServalSheets
 *
 * 21 tools after consolidation + enterprise additions:
 * - Wave 1: sheets_core (replaces sheets_spreadsheet + sheets_sheet)
 * - Wave 1: sheets_visualize (replaces sheets_charts + sheets_pivot)
 * - Wave 1: sheets_collaborate (replaces sheets_sharing + sheets_comments + sheets_versions)
 * - Wave 2: sheets_format (absorbed sheets_rules conditional formatting + data validation)
 * - Wave 2: sheets_dimensions (absorbed sheets_filter_sort filtering + sorting)
 * - Wave 3: sheets_quality (replaces sheets_validation + sheets_conflict + sheets_impact)
 * - Wave 4: sheets_data (replaces sheets_values + sheets_cells)
 *
 * Schema Pattern: z.object({ request: z.discriminatedUnion('action', ...) })
 * - Actions are discriminated by `action` within `request`
 * - Responses are discriminated by `success` within `response`
 *
 * Note: Removed sheets_plan and sheets_insights (anti-patterns).
 * Replaced with sheets_confirm (Elicitation) and sheets_analyze (Sampling).
 *
 * Descriptions: All tool descriptions are imported from descriptions.ts to maintain
 * a single source of truth for LLM-optimized tool descriptions.
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'sheets_auth',
    description: getDescription('sheets_auth'),
    inputSchema: SheetsAuthInputSchema,
    outputSchema: SheetsAuthOutputSchema,
    annotations: SHEETS_AUTH_ANNOTATIONS,
  },
  {
    name: 'sheets_core',
    description: getDescription('sheets_core'),
    inputSchema: SheetsCoreInputSchema,
    outputSchema: SheetsCoreOutputSchema,
    annotations: SHEETS_CORE_ANNOTATIONS,
  },
  {
    name: 'sheets_data',
    description: getDescription('sheets_data'),
    inputSchema: SheetsDataInputSchema,
    outputSchema: SheetsDataOutputSchema,
    annotations: SHEETS_DATA_ANNOTATIONS,
  },
  {
    name: 'sheets_format',
    description: getDescription('sheets_format'),
    inputSchema: SheetsFormatInputSchema,
    outputSchema: SheetsFormatOutputSchema,
    annotations: SHEETS_FORMAT_ANNOTATIONS,
  },
  {
    name: 'sheets_dimensions',
    description: getDescription('sheets_dimensions'),
    inputSchema: SheetsDimensionsInputSchema,
    outputSchema: SheetsDimensionsOutputSchema,
    annotations: SHEETS_DIMENSIONS_ANNOTATIONS,
  },
  {
    name: 'sheets_visualize',
    description: getDescription('sheets_visualize'),
    inputSchema: SheetsVisualizeInputSchema,
    outputSchema: SheetsVisualizeOutputSchema,
    annotations: SHEETS_VISUALIZE_ANNOTATIONS,
  },
  {
    name: 'sheets_collaborate',
    description: getDescription('sheets_collaborate'),
    inputSchema: SheetsCollaborateInputSchema,
    outputSchema: SheetsCollaborateOutputSchema,
    annotations: SHEETS_COLLABORATE_ANNOTATIONS,
  },
  {
    name: 'sheets_advanced',
    description: getDescription('sheets_advanced'),
    inputSchema: SheetsAdvancedInputSchema,
    outputSchema: SheetsAdvancedOutputSchema,
    annotations: SHEETS_ADVANCED_ANNOTATIONS,
  },
  {
    name: 'sheets_transaction',
    description: getDescription('sheets_transaction'),
    inputSchema: SheetsTransactionInputSchema,
    outputSchema: SheetsTransactionOutputSchema,
    annotations: SHEETS_TRANSACTION_ANNOTATIONS,
  },
  {
    name: 'sheets_quality',
    description: getDescription('sheets_quality'),
    inputSchema: SheetsQualityInputSchema,
    outputSchema: SheetsQualityOutputSchema,
    annotations: SHEETS_QUALITY_ANNOTATIONS,
  },
  {
    name: 'sheets_history',
    description: getDescription('sheets_history'),
    inputSchema: SheetsHistoryInputSchema,
    outputSchema: SheetsHistoryOutputSchema,
    annotations: SHEETS_HISTORY_ANNOTATIONS,
  },
  // ============================================================================
  // MCP-NATIVE TOOLS (Elicitation & Sampling)
  // ============================================================================
  {
    name: 'sheets_confirm',
    description: getDescription('sheets_confirm'),
    inputSchema: SheetsConfirmInputSchema,
    outputSchema: SheetsConfirmOutputSchema,
    annotations: SHEETS_CONFIRM_ANNOTATIONS,
  },
  {
    name: 'sheets_analyze',
    description: getDescription('sheets_analyze'),
    inputSchema: SheetsAnalyzeInputSchema,
    outputSchema: SheetsAnalyzeOutputSchema,
    annotations: SHEETS_ANALYZE_ANNOTATIONS,
  },
  {
    name: 'sheets_fix',
    description: getDescription('sheets_fix'),
    inputSchema: SheetsFixInputSchema,
    outputSchema: SheetsFixOutputSchema,
    annotations: SHEETS_FIX_ANNOTATIONS,
  },
  {
    name: 'sheets_composite',
    description: getDescription('sheets_composite'),
    inputSchema: CompositeInputSchema,
    outputSchema: CompositeOutputSchema,
    annotations: SHEETS_COMPOSITE_ANNOTATIONS,
  },
  {
    name: 'sheets_session',
    description: getDescription('sheets_session'),
    inputSchema: SheetsSessionInputSchema,
    outputSchema: SheetsSessionOutputSchema,
    annotations: SHEETS_SESSION_ANNOTATIONS,
  },
  // ============================================================================
  // TIER 7 ENTERPRISE TOOLS
  // ============================================================================
  {
    name: 'sheets_templates',
    description: getDescription('sheets_templates'),
    inputSchema: SheetsTemplatesInputSchema,
    outputSchema: SheetsTemplatesOutputSchema,
    annotations: SHEETS_TEMPLATES_ANNOTATIONS,
  },
  // ============================================================================
  // TIER 7: BIGQUERY INTEGRATION
  // ============================================================================
  {
    name: 'sheets_bigquery',
    description: getDescription('sheets_bigquery'),
    inputSchema: SheetsBigQueryInputSchema,
    outputSchema: SheetsBigQueryOutputSchema,
    annotations: SHEETS_BIGQUERY_ANNOTATIONS,
  },
  // ============================================================================
  // TIER 7: APPS SCRIPT AUTOMATION
  // ============================================================================
  {
    name: 'sheets_appsscript',
    description: getDescription('sheets_appsscript'),
    inputSchema: SheetsAppsScriptInputSchema,
    outputSchema: SheetsAppsScriptOutputSchema,
    annotations: SHEETS_APPSSCRIPT_ANNOTATIONS,
  },
  // ============================================================================
  // PHASE 3: WEBHOOKS & DEPENDENCIES
  // ============================================================================
  {
    name: 'sheets_webhook',
    description: getDescription('sheets_webhook'),
    inputSchema: SheetsWebhookInputSchema,
    outputSchema: SheetsWebhookOutputSchema,
    annotations: SHEETS_WEBHOOK_ANNOTATIONS,
  },
  {
    name: 'sheets_dependencies',
    description: getDescription('sheets_dependencies'),
    inputSchema: SheetsDependenciesInputSchema,
    outputSchema: SheetsDependenciesOutputSchema,
    annotations: SHEETS_DEPENDENCIES_ANNOTATIONS,
  },
] as const;

// ============================================================================
// TOOL FILTERING BY MODE
// ============================================================================

/**
 * Get the list of allowed tool names for the current mode
 */
function getAllowedToolNames(): readonly string[] {
  switch (TOOL_MODE) {
    case 'lite':
      return ESSENTIAL_TOOLS;
    case 'standard':
      return STANDARD_TOOLS;
    case 'full':
    default:
      return TOOL_DEFINITIONS.map((t) => t.name);
  }
}

/**
 * Filtered tool definitions based on SERVAL_TOOL_MODE and lazy loading
 *
 * Use this instead of TOOL_DEFINITIONS for registration.
 * - 'full': All 21 tools (~41K tokens)
 * - 'standard': 12 tools (~25K tokens)
 * - 'lite': 8 tools (~15K tokens)
 *
 * Additional filtering:
 * - LAZY_LOAD_ENTERPRISE=true: Excludes enterprise tools (saves ~10K tokens)
 * - LAZY_LOAD_TOOLS=tool1,tool2: Excludes specific tools
 */
export const ACTIVE_TOOL_DEFINITIONS: readonly ToolDefinition[] = (() => {
  const allowedNames = getAllowedToolNames();
  const lazyLoadTools = getLazyLoadTools();

  return TOOL_DEFINITIONS.filter((t) => {
    // Must be in allowed tool mode
    if (!allowedNames.includes(t.name)) return false;
    // Must not be lazy-loaded
    if (lazyLoadTools.includes(t.name)) return false;
    return true;
  });
})();

/**
 * Get lazy-loaded tool definitions (for on-demand loading)
 *
 * These tools are not included in the initial tools/list response
 * but can be loaded later via tool discovery.
 */
export function getLazyToolDefinitions(): readonly ToolDefinition[] {
  const lazyLoadTools = getLazyLoadTools();
  return TOOL_DEFINITIONS.filter((t) => lazyLoadTools.includes(t.name));
}

/**
 * Get a specific tool definition by name (includes lazy-loaded tools)
 */
export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}
