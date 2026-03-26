/**
 * ServalSheets - Tool Definitions
 *
 * Complete tool registry with Zod schemas and metadata.
 *
 * @module mcp/registration/tool-definitions
 */

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodTypeAny } from 'zod';

import { DEFER_DESCRIPTIONS } from '../../config/constants.js';
import { getLazyLoadTools } from '../../config/schema-optimization.js';
import {
  SheetsAuthInputSchema,
  SheetsAuthOutputSchema,
  SheetsCoreInputSchema,
  SheetsCoreOutputSchema,
  SheetsDataInputSchema,
  SheetsDataOutputSchema,
  SheetsFormatInputSchema,
  SheetsFormatOutputSchema,
  SheetsDimensionsInputSchema,
  SheetsDimensionsOutputSchema,
  SheetsVisualizeInputSchema,
  SheetsVisualizeOutputSchema,
  SheetsCollaborateInputSchema,
  SheetsCollaborateOutputSchema,
  SheetsAdvancedInputSchema,
  SheetsAdvancedOutputSchema,
  SheetsTransactionInputSchema,
  SheetsTransactionOutputSchema,
  SheetsQualityInputSchema,
  SheetsQualityOutputSchema,
  SheetsHistoryInputSchema,
  SheetsHistoryOutputSchema,
  // New MCP-native tools
  SheetsConfirmInputSchema,
  SheetsConfirmOutputSchema,
  SheetsAnalyzeInputSchema,
  SheetsAnalyzeOutputSchema,
  SheetsFixInputSchema,
  SheetsFixOutputSchema,
  // Composite operations
  CompositeInputSchema,
  CompositeOutputSchema,
  // Session context for NL excellence
  SheetsSessionInputSchema,
  SheetsSessionOutputSchema,
  // Tier 7 Enterprise tools
  SheetsTemplatesInputSchema,
  SheetsTemplatesOutputSchema,
  SheetsBigQueryInputSchema,
  SheetsBigQueryOutputSchema,
  SheetsAppsScriptInputSchema,
  SheetsAppsScriptOutputSchema,
  // Phase 3 tools
  SheetsWebhookInputSchema,
  SheetsWebhookOutputSchema,
  SheetsDependenciesInputSchema,
  SheetsDependenciesOutputSchema,
  // Feature 3: Federation
  SheetsFederationInputSchema,
  SheetsFederationOutputSchema,
  // Phase 5: Computation Engine
  SheetsComputeInputSchema,
  SheetsComputeOutputSchema,
  // Phase 6: Agent Loop
  SheetsAgentInputSchema,
  SheetsAgentOutputSchema,
  // Wave 6: Live Data Connectors
  SheetsConnectorsInputSchema,
  SheetsConnectorsOutputSchema,
  TOOL_ANNOTATIONS,
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

function getToolAnnotations(toolName: string): ToolAnnotations {
  const annotations = TOOL_ANNOTATIONS[toolName];
  if (!annotations) {
    throw new Error(`Missing TOOL_ANNOTATIONS entry for ${toolName}`);
  }
  return annotations;
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
  readonly title: string;
  readonly description: string;
  readonly inputSchema: ZodTypeAny;
  readonly outputSchema: ZodTypeAny;
  readonly annotations: ToolAnnotations;
  /**
   * Authentication policy used by transport layers.
   * Defaults to `{ requiresAuth: true }` when omitted.
   */
  readonly authPolicy?: ToolAuthPolicy;
}

export interface ToolAuthPolicy {
  /**
   * When false, this tool can be called without Google auth.
   */
  readonly requiresAuth?: boolean;
  /**
   * Per-action auth exemptions for tools that are mostly authenticated.
   */
  readonly exemptActions?: readonly string[];
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Complete tool registry for ServalSheets
 *
 * 25 tools after consolidation + enterprise additions:
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
    title: 'Authentication',
    description: getDescription('sheets_auth'),
    inputSchema: SheetsAuthInputSchema,
    outputSchema: SheetsAuthOutputSchema,
    annotations: getToolAnnotations('sheets_auth'),
    authPolicy: { requiresAuth: false },
  },
  {
    name: 'sheets_core',
    title: 'Spreadsheet & Sheet Management',
    description: getDescription('sheets_core'),
    inputSchema: SheetsCoreInputSchema,
    outputSchema: SheetsCoreOutputSchema,
    annotations: getToolAnnotations('sheets_core'),
  },
  {
    name: 'sheets_data',
    title: 'Cell Data Operations',
    description: getDescription('sheets_data'),
    inputSchema: SheetsDataInputSchema,
    outputSchema: SheetsDataOutputSchema,
    annotations: getToolAnnotations('sheets_data'),
  },
  {
    name: 'sheets_format',
    title: 'Formatting & Styling',
    description: getDescription('sheets_format'),
    inputSchema: SheetsFormatInputSchema,
    outputSchema: SheetsFormatOutputSchema,
    annotations: getToolAnnotations('sheets_format'),
  },
  {
    name: 'sheets_dimensions',
    title: 'Rows, Columns & Sorting',
    description: getDescription('sheets_dimensions'),
    inputSchema: SheetsDimensionsInputSchema,
    outputSchema: SheetsDimensionsOutputSchema,
    annotations: getToolAnnotations('sheets_dimensions'),
  },
  {
    name: 'sheets_visualize',
    title: 'Charts & Pivot Tables',
    description: getDescription('sheets_visualize'),
    inputSchema: SheetsVisualizeInputSchema,
    outputSchema: SheetsVisualizeOutputSchema,
    annotations: getToolAnnotations('sheets_visualize'),
  },
  {
    name: 'sheets_collaborate',
    title: 'Sharing & Collaboration',
    description: getDescription('sheets_collaborate'),
    inputSchema: SheetsCollaborateInputSchema,
    outputSchema: SheetsCollaborateOutputSchema,
    annotations: getToolAnnotations('sheets_collaborate'),
  },
  {
    name: 'sheets_advanced',
    title: 'Named Ranges, Protection & Tables',
    description: getDescription('sheets_advanced'),
    inputSchema: SheetsAdvancedInputSchema,
    outputSchema: SheetsAdvancedOutputSchema,
    annotations: getToolAnnotations('sheets_advanced'),
  },
  {
    name: 'sheets_transaction',
    title: 'Atomic Batch Operations',
    description: getDescription('sheets_transaction'),
    inputSchema: SheetsTransactionInputSchema,
    outputSchema: SheetsTransactionOutputSchema,
    annotations: getToolAnnotations('sheets_transaction'),
  },
  {
    name: 'sheets_quality',
    title: 'Data Validation & Quality',
    description: getDescription('sheets_quality'),
    inputSchema: SheetsQualityInputSchema,
    outputSchema: SheetsQualityOutputSchema,
    annotations: getToolAnnotations('sheets_quality'),
  },
  {
    name: 'sheets_history',
    title: 'Operation History & Undo',
    description: getDescription('sheets_history'),
    inputSchema: SheetsHistoryInputSchema,
    outputSchema: SheetsHistoryOutputSchema,
    annotations: getToolAnnotations('sheets_history'),
    authPolicy: { exemptActions: ['list', 'get', 'stats'] },
  },
  // ============================================================================
  // MCP-NATIVE TOOLS (Elicitation & Sampling)
  // ============================================================================
  {
    name: 'sheets_confirm',
    title: 'User Confirmation & Approval',
    description: getDescription('sheets_confirm'),
    inputSchema: SheetsConfirmInputSchema,
    outputSchema: SheetsConfirmOutputSchema,
    annotations: getToolAnnotations('sheets_confirm'),
    authPolicy: { requiresAuth: false },
  },
  {
    name: 'sheets_analyze',
    title: 'AI-Powered Analysis',
    description: getDescription('sheets_analyze'),
    inputSchema: SheetsAnalyzeInputSchema,
    outputSchema: SheetsAnalyzeOutputSchema,
    annotations: getToolAnnotations('sheets_analyze'),
  },
  {
    name: 'sheets_fix',
    title: 'Auto-Fix Issues',
    description: getDescription('sheets_fix'),
    inputSchema: SheetsFixInputSchema,
    outputSchema: SheetsFixOutputSchema,
    annotations: getToolAnnotations('sheets_fix'),
  },
  {
    name: 'sheets_composite',
    title: 'Multi-Step Operations',
    description: getDescription('sheets_composite'),
    inputSchema: CompositeInputSchema,
    outputSchema: CompositeOutputSchema,
    annotations: getToolAnnotations('sheets_composite'),
    authPolicy: { exemptActions: ['generate_template', 'preview_generation'] },
  },
  {
    name: 'sheets_session',
    title: 'Session & Context Management',
    description: getDescription('sheets_session'),
    inputSchema: SheetsSessionInputSchema,
    outputSchema: SheetsSessionOutputSchema,
    annotations: getToolAnnotations('sheets_session'),
    authPolicy: { requiresAuth: false },
  },
  // ============================================================================
  // TIER 7 ENTERPRISE TOOLS
  // ============================================================================
  {
    name: 'sheets_templates',
    title: 'Spreadsheet Templates',
    description: getDescription('sheets_templates'),
    inputSchema: SheetsTemplatesInputSchema,
    outputSchema: SheetsTemplatesOutputSchema,
    annotations: getToolAnnotations('sheets_templates'),
  },
  // ============================================================================
  // TIER 7: BIGQUERY INTEGRATION
  // ============================================================================
  {
    name: 'sheets_bigquery',
    title: 'BigQuery Integration',
    description: getDescription('sheets_bigquery'),
    inputSchema: SheetsBigQueryInputSchema,
    outputSchema: SheetsBigQueryOutputSchema,
    annotations: getToolAnnotations('sheets_bigquery'),
  },
  // ============================================================================
  // TIER 7: APPS SCRIPT AUTOMATION
  // ============================================================================
  {
    name: 'sheets_appsscript',
    title: 'Apps Script Automation',
    description: getDescription('sheets_appsscript'),
    inputSchema: SheetsAppsScriptInputSchema,
    outputSchema: SheetsAppsScriptOutputSchema,
    annotations: getToolAnnotations('sheets_appsscript'),
  },
  // ============================================================================
  // PHASE 3: WEBHOOKS & DEPENDENCIES
  // ============================================================================
  {
    name: 'sheets_webhook',
    title: 'Webhook Notifications',
    description: getDescription('sheets_webhook'),
    inputSchema: SheetsWebhookInputSchema,
    outputSchema: SheetsWebhookOutputSchema,
    annotations: getToolAnnotations('sheets_webhook'),
  },
  {
    name: 'sheets_dependencies',
    title: 'Formula Dependencies',
    description: getDescription('sheets_dependencies'),
    inputSchema: SheetsDependenciesInputSchema,
    outputSchema: SheetsDependenciesOutputSchema,
    annotations: getToolAnnotations('sheets_dependencies'),
  },
  // ============================================================================
  // FEATURE 3: MCP SERVER FEDERATION
  // ============================================================================
  {
    name: 'sheets_federation',
    title: 'MCP Server Federation',
    description: getDescription('sheets_federation'),
    inputSchema: SheetsFederationInputSchema,
    outputSchema: SheetsFederationOutputSchema,
    annotations: getToolAnnotations('sheets_federation'),
  },
  // ============================================================================
  // PHASE 5: COMPUTATION ENGINE
  // ============================================================================
  {
    name: 'sheets_compute',
    title: 'Computation Engine',
    description: getDescription('sheets_compute'),
    inputSchema: SheetsComputeInputSchema,
    outputSchema: SheetsComputeOutputSchema,
    annotations: getToolAnnotations('sheets_compute'),
  },
  // ============================================================================
  // PHASE 6: AGENT LOOP
  // ============================================================================
  {
    name: 'sheets_agent',
    title: 'Agentic Execution',
    description: getDescription('sheets_agent'),
    inputSchema: SheetsAgentInputSchema,
    outputSchema: SheetsAgentOutputSchema,
    annotations: getToolAnnotations('sheets_agent'),
  },
  // ============================================================================
  // WAVE 6: LIVE DATA CONNECTORS
  // ============================================================================
  {
    name: 'sheets_connectors',
    title: 'Live Data Connectors',
    description: getDescription('sheets_connectors'),
    inputSchema: SheetsConnectorsInputSchema,
    outputSchema: SheetsConnectorsOutputSchema,
    annotations: getToolAnnotations('sheets_connectors'),
  },
] as const;

// ============================================================================
// TOOL FILTERING BY MODE
// ============================================================================

/**
 * All 25 tools — always registered (MCP 2025-11-25 approach)
 *
 * Payload size managed by DEFER_DESCRIPTIONS + DEFER_SCHEMAS (auto-on for
 * STDIO / Claude Desktop): tools/list stays ~5KB regardless of action count.
 * Full schemas load on-demand via schema://tools/{name} MCP resources.
 *
 * The server emits notifications/tools/list_changed when runtime state
 * changes (OAuth, session, federation). Clients re-request tools/list.
 *
 * LAZY_LOAD_ENTERPRISE=true or LAZY_LOAD_TOOLS=a,b can still exclude
 * specific tools for specialized deployments.
 */
export const ACTIVE_TOOL_DEFINITIONS: readonly ToolDefinition[] = (() => {
  const lazyLoadTools = getLazyLoadTools();
  return TOOL_DEFINITIONS.filter((t) => !lazyLoadTools.includes(t.name));
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

const EMPTY_ACTION_LIST: readonly string[] = [];
const DEFAULT_TOOL_AUTH_POLICY: Readonly<Required<ToolAuthPolicy>> = {
  requiresAuth: true,
  exemptActions: EMPTY_ACTION_LIST,
};

/**
 * Resolve auth policy for a tool (with defaults applied).
 */
export function getToolAuthPolicy(toolName: string): Readonly<Required<ToolAuthPolicy>> {
  const definition = getToolDefinition(toolName);
  if (!definition?.authPolicy) {
    return DEFAULT_TOOL_AUTH_POLICY;
  }

  return {
    requiresAuth: definition.authPolicy.requiresAuth ?? true,
    exemptActions: definition.authPolicy.exemptActions ?? EMPTY_ACTION_LIST,
  };
}

/**
 * Whether a specific tool call is exempt from authentication.
 */
export function isToolCallAuthExempt(toolName: string, action?: string): boolean {
  const policy = getToolAuthPolicy(toolName);
  if (!policy.requiresAuth) {
    return true;
  }
  return Boolean(action && policy.exemptActions.includes(action));
}

// ---------------------------------------------------------------------------
// Architecture bridge: provide TOOL_DEFINITIONS input schemas to the services
// layer without requiring services to import from mcp/registration (G3 fix).
// ---------------------------------------------------------------------------
import { registerToolInputSchemas } from '../../services/agent-engine.js';

registerToolInputSchemas(new Map(TOOL_DEFINITIONS.map((t) => [t.name, t.inputSchema] as const)));
