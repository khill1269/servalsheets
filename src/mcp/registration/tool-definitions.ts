/**
 * ServalSheets - Tool Definitions
 *
 * Complete tool registry with Zod schemas and metadata.
 *
 * @module mcp/registration/tool-definitions
 */

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodTypeAny } from "zod";

import {
  SheetsAuthInputSchema,
  SheetsAuthOutputSchema,
  SHEETS_AUTH_ANNOTATIONS,
  SheetSpreadsheetInputSchema,
  SheetsSpreadsheetOutputSchema,
  SHEETS_SPREADSHEET_ANNOTATIONS,
  SheetsSheetInputSchema,
  SheetsSheetOutputSchema,
  SHEETS_SHEET_ANNOTATIONS,
  SheetsValuesInputSchema,
  SheetsValuesOutputSchema,
  SHEETS_VALUES_ANNOTATIONS,
  SheetsCellsInputSchema,
  SheetsCellsOutputSchema,
  SHEETS_CELLS_ANNOTATIONS,
  SheetsFormatInputSchema,
  SheetsFormatOutputSchema,
  SHEETS_FORMAT_ANNOTATIONS,
  SheetsDimensionsInputSchema,
  SheetsDimensionsOutputSchema,
  SHEETS_DIMENSIONS_ANNOTATIONS,
  SheetsRulesInputSchema,
  SheetsRulesOutputSchema,
  SHEETS_RULES_ANNOTATIONS,
  SheetsChartsInputSchema,
  SheetsChartsOutputSchema,
  SHEETS_CHARTS_ANNOTATIONS,
  SheetsPivotInputSchema,
  SheetsPivotOutputSchema,
  SHEETS_PIVOT_ANNOTATIONS,
  SheetsFilterSortInputSchema,
  SheetsFilterSortOutputSchema,
  SHEETS_FILTER_SORT_ANNOTATIONS,
  SheetsSharingInputSchema,
  SheetsSharingOutputSchema,
  SHEETS_SHARING_ANNOTATIONS,
  SheetsCommentsInputSchema,
  SheetsCommentsOutputSchema,
  SHEETS_COMMENTS_ANNOTATIONS,
  SheetsVersionsInputSchema,
  SheetsVersionsOutputSchema,
  SHEETS_VERSIONS_ANNOTATIONS,
  SheetsAnalysisInputSchema,
  SheetsAnalysisOutputSchema,
  SHEETS_ANALYSIS_ANNOTATIONS,
  SheetsAdvancedInputSchema,
  SheetsAdvancedOutputSchema,
  SHEETS_ADVANCED_ANNOTATIONS,
  SheetsTransactionInputSchema,
  SheetsTransactionOutputSchema,
  SHEETS_TRANSACTION_ANNOTATIONS,
  SheetsValidationInputSchema,
  SheetsValidationOutputSchema,
  SHEETS_VALIDATION_ANNOTATIONS,
  SheetsConflictInputSchema,
  SheetsConflictOutputSchema,
  SHEETS_CONFLICT_ANNOTATIONS,
  SheetsImpactInputSchema,
  SheetsImpactOutputSchema,
  SHEETS_IMPACT_ANNOTATIONS,
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
  // LLM-optimized descriptions
  TOOL_DESCRIPTIONS,
} from "../../schemas/index.js";

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
 * 16 core tools + 5 enterprise tools + 3 MCP-native tools + 1 composite tool = 25 tools
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
    name: "sheets_auth",
    description: TOOL_DESCRIPTIONS["sheets_auth"]!,
    inputSchema: SheetsAuthInputSchema,
    outputSchema: SheetsAuthOutputSchema,
    annotations: SHEETS_AUTH_ANNOTATIONS,
  },
  {
    name: "sheets_spreadsheet",
    description: TOOL_DESCRIPTIONS["sheets_spreadsheet"]!,
    inputSchema: SheetSpreadsheetInputSchema,
    outputSchema: SheetsSpreadsheetOutputSchema,
    annotations: SHEETS_SPREADSHEET_ANNOTATIONS,
  },
  {
    name: "sheets_sheet",
    description: TOOL_DESCRIPTIONS["sheets_sheet"]!,
    inputSchema: SheetsSheetInputSchema,
    outputSchema: SheetsSheetOutputSchema,
    annotations: SHEETS_SHEET_ANNOTATIONS,
  },
  {
    name: "sheets_values",
    description: TOOL_DESCRIPTIONS["sheets_values"]!,
    inputSchema: SheetsValuesInputSchema,
    outputSchema: SheetsValuesOutputSchema,
    annotations: SHEETS_VALUES_ANNOTATIONS,
  },
  {
    name: "sheets_cells",
    description: TOOL_DESCRIPTIONS["sheets_cells"]!,
    inputSchema: SheetsCellsInputSchema,
    outputSchema: SheetsCellsOutputSchema,
    annotations: SHEETS_CELLS_ANNOTATIONS,
  },
  {
    name: "sheets_format",
    description: TOOL_DESCRIPTIONS["sheets_format"]!,
    inputSchema: SheetsFormatInputSchema,
    outputSchema: SheetsFormatOutputSchema,
    annotations: SHEETS_FORMAT_ANNOTATIONS,
  },
  {
    name: "sheets_dimensions",
    description: TOOL_DESCRIPTIONS["sheets_dimensions"]!,
    inputSchema: SheetsDimensionsInputSchema,
    outputSchema: SheetsDimensionsOutputSchema,
    annotations: SHEETS_DIMENSIONS_ANNOTATIONS,
  },
  {
    name: "sheets_rules",
    description: TOOL_DESCRIPTIONS["sheets_rules"]!,
    inputSchema: SheetsRulesInputSchema,
    outputSchema: SheetsRulesOutputSchema,
    annotations: SHEETS_RULES_ANNOTATIONS,
  },
  {
    name: "sheets_charts",
    description: TOOL_DESCRIPTIONS["sheets_charts"]!,
    inputSchema: SheetsChartsInputSchema,
    outputSchema: SheetsChartsOutputSchema,
    annotations: SHEETS_CHARTS_ANNOTATIONS,
  },
  {
    name: "sheets_pivot",
    description: TOOL_DESCRIPTIONS["sheets_pivot"]!,
    inputSchema: SheetsPivotInputSchema,
    outputSchema: SheetsPivotOutputSchema,
    annotations: SHEETS_PIVOT_ANNOTATIONS,
  },
  {
    name: "sheets_filter_sort",
    description: TOOL_DESCRIPTIONS["sheets_filter_sort"]!,
    inputSchema: SheetsFilterSortInputSchema,
    outputSchema: SheetsFilterSortOutputSchema,
    annotations: SHEETS_FILTER_SORT_ANNOTATIONS,
  },
  {
    name: "sheets_sharing",
    description: TOOL_DESCRIPTIONS["sheets_sharing"]!,
    inputSchema: SheetsSharingInputSchema,
    outputSchema: SheetsSharingOutputSchema,
    annotations: SHEETS_SHARING_ANNOTATIONS,
  },
  {
    name: "sheets_comments",
    description: TOOL_DESCRIPTIONS["sheets_comments"]!,
    inputSchema: SheetsCommentsInputSchema,
    outputSchema: SheetsCommentsOutputSchema,
    annotations: SHEETS_COMMENTS_ANNOTATIONS,
  },
  {
    name: "sheets_versions",
    description: TOOL_DESCRIPTIONS["sheets_versions"]!,
    inputSchema: SheetsVersionsInputSchema,
    outputSchema: SheetsVersionsOutputSchema,
    annotations: SHEETS_VERSIONS_ANNOTATIONS,
  },
  {
    name: "sheets_analysis",
    description: TOOL_DESCRIPTIONS["sheets_analysis"]!,
    inputSchema: SheetsAnalysisInputSchema,
    outputSchema: SheetsAnalysisOutputSchema,
    annotations: SHEETS_ANALYSIS_ANNOTATIONS,
  },
  {
    name: "sheets_advanced",
    description: TOOL_DESCRIPTIONS["sheets_advanced"]!,
    inputSchema: SheetsAdvancedInputSchema,
    outputSchema: SheetsAdvancedOutputSchema,
    annotations: SHEETS_ADVANCED_ANNOTATIONS,
  },
  {
    name: "sheets_transaction",
    description: TOOL_DESCRIPTIONS["sheets_transaction"]!,
    inputSchema: SheetsTransactionInputSchema,
    outputSchema: SheetsTransactionOutputSchema,
    annotations: SHEETS_TRANSACTION_ANNOTATIONS,
  },
  {
    name: "sheets_validation",
    description: TOOL_DESCRIPTIONS["sheets_validation"]!,
    inputSchema: SheetsValidationInputSchema,
    outputSchema: SheetsValidationOutputSchema,
    annotations: SHEETS_VALIDATION_ANNOTATIONS,
  },
  {
    name: "sheets_conflict",
    description: TOOL_DESCRIPTIONS["sheets_conflict"]!,
    inputSchema: SheetsConflictInputSchema,
    outputSchema: SheetsConflictOutputSchema,
    annotations: SHEETS_CONFLICT_ANNOTATIONS,
  },
  {
    name: "sheets_impact",
    description: TOOL_DESCRIPTIONS["sheets_impact"]!,
    inputSchema: SheetsImpactInputSchema,
    outputSchema: SheetsImpactOutputSchema,
    annotations: SHEETS_IMPACT_ANNOTATIONS,
  },
  {
    name: "sheets_history",
    description: TOOL_DESCRIPTIONS["sheets_history"]!,
    inputSchema: SheetsHistoryInputSchema,
    outputSchema: SheetsHistoryOutputSchema,
    annotations: SHEETS_HISTORY_ANNOTATIONS,
  },
  // ============================================================================
  // MCP-NATIVE TOOLS (Elicitation & Sampling)
  // ============================================================================
  {
    name: "sheets_confirm",
    description: TOOL_DESCRIPTIONS["sheets_confirm"]!,
    inputSchema: SheetsConfirmInputSchema,
    outputSchema: SheetsConfirmOutputSchema,
    annotations: SHEETS_CONFIRM_ANNOTATIONS,
  },
  {
    name: "sheets_analyze",
    description: TOOL_DESCRIPTIONS["sheets_analyze"]!,
    inputSchema: SheetsAnalyzeInputSchema,
    outputSchema: SheetsAnalyzeOutputSchema,
    annotations: SHEETS_ANALYZE_ANNOTATIONS,
  },
  {
    name: "sheets_fix",
    description: TOOL_DESCRIPTIONS["sheets_fix"]!,
    inputSchema: SheetsFixInputSchema,
    outputSchema: SheetsFixOutputSchema,
    annotations: SHEETS_FIX_ANNOTATIONS,
  },
  {
    name: "sheets_composite",
    description: TOOL_DESCRIPTIONS["sheets_composite"]!,
    inputSchema: CompositeInputSchema,
    outputSchema: CompositeOutputSchema,
    annotations: SHEETS_COMPOSITE_ANNOTATIONS,
  },
  {
    name: "sheets_session",
    description: TOOL_DESCRIPTIONS["sheets_session"]!,
    inputSchema: SheetsSessionInputSchema,
    outputSchema: SheetsSessionOutputSchema,
    annotations: SHEETS_SESSION_ANNOTATIONS,
  },
] as const;
