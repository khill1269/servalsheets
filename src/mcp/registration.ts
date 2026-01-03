/**
 * ServalSheets - MCP Registration Helpers
 *
 * Shared tool/resource/prompt registration for multiple transports.
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

import type { Handlers } from '../handlers/index.js';
import type { GoogleApiClient } from '../services/google-api.js';
import { createRequestContext, runWithRequestContext } from '../utils/request-context.js';
import {
  SheetSpreadsheetInputSchema, SheetsSpreadsheetOutputSchema, SHEETS_SPREADSHEET_ANNOTATIONS,
  SheetsSheetInputSchema, SheetsSheetOutputSchema, SHEETS_SHEET_ANNOTATIONS,
  SheetsValuesInputSchema, SheetsValuesOutputSchema, SHEETS_VALUES_ANNOTATIONS,
  SheetsCellsInputSchema, SheetsCellsOutputSchema, SHEETS_CELLS_ANNOTATIONS,
  SheetsFormatInputSchema, SheetsFormatOutputSchema, SHEETS_FORMAT_ANNOTATIONS,
  SheetsDimensionsInputSchema, SheetsDimensionsOutputSchema, SHEETS_DIMENSIONS_ANNOTATIONS,
  SheetsRulesInputSchema, SheetsRulesOutputSchema, SHEETS_RULES_ANNOTATIONS,
  SheetsChartsInputSchema, SheetsChartsOutputSchema, SHEETS_CHARTS_ANNOTATIONS,
  SheetsPivotInputSchema, SheetsPivotOutputSchema, SHEETS_PIVOT_ANNOTATIONS,
  SheetsFilterSortInputSchema, SheetsFilterSortOutputSchema, SHEETS_FILTER_SORT_ANNOTATIONS,
  SheetsSharingInputSchema, SheetsSharingOutputSchema, SHEETS_SHARING_ANNOTATIONS,
  SheetsCommentsInputSchema, SheetsCommentsOutputSchema, SHEETS_COMMENTS_ANNOTATIONS,
  SheetsVersionsInputSchema, SheetsVersionsOutputSchema, SHEETS_VERSIONS_ANNOTATIONS,
  SheetsAnalysisInputSchema, SheetsAnalysisOutputSchema, SHEETS_ANALYSIS_ANNOTATIONS,
  SheetsAdvancedInputSchema, SheetsAdvancedOutputSchema, SHEETS_ADVANCED_ANNOTATIONS,
} from '../schemas/index.js';
import {
  WelcomePromptArgsSchema,
  SetupTestPromptArgsSchema,
  FirstOperationPromptArgsSchema,
  AnalyzeSpreadsheetPromptArgsSchema,
  TransformDataPromptArgsSchema,
  CreateReportPromptArgsSchema,
  CleanDataPromptArgsSchema,
} from '../schemas/prompts.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: AnySchema;
  outputSchema: AnySchema;
  annotations: ToolAnnotations;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'sheets_spreadsheet',
    inputSchema: SheetSpreadsheetInputSchema,
    outputSchema: SheetsSpreadsheetOutputSchema,
    annotations: SHEETS_SPREADSHEET_ANNOTATIONS,
    description: 'Spreadsheet operations: create, get, copy, update properties',
  },
  {
    name: 'sheets_sheet',
    inputSchema: SheetsSheetInputSchema,
    outputSchema: SheetsSheetOutputSchema,
    annotations: SHEETS_SHEET_ANNOTATIONS,
    description: 'Sheet/tab operations: add, delete, duplicate, update, list',
  },
  {
    name: 'sheets_values',
    inputSchema: SheetsValuesInputSchema,
    outputSchema: SheetsValuesOutputSchema,
    annotations: SHEETS_VALUES_ANNOTATIONS,
    description: 'Cell values: read, write, append, clear, find, replace',
  },
  {
    name: 'sheets_cells',
    inputSchema: SheetsCellsInputSchema,
    outputSchema: SheetsCellsOutputSchema,
    annotations: SHEETS_CELLS_ANNOTATIONS,
    description: 'Cell operations: notes, validation, hyperlinks, merge',
  },
  {
    name: 'sheets_format',
    inputSchema: SheetsFormatInputSchema,
    outputSchema: SheetsFormatOutputSchema,
    annotations: SHEETS_FORMAT_ANNOTATIONS,
    description: 'Formatting: colors, fonts, borders, alignment, presets',
  },
  {
    name: 'sheets_dimensions',
    inputSchema: SheetsDimensionsInputSchema,
    outputSchema: SheetsDimensionsOutputSchema,
    annotations: SHEETS_DIMENSIONS_ANNOTATIONS,
    description: 'Rows/columns: insert, delete, move, resize, freeze, group',
  },
  {
    name: 'sheets_rules',
    inputSchema: SheetsRulesInputSchema,
    outputSchema: SheetsRulesOutputSchema,
    annotations: SHEETS_RULES_ANNOTATIONS,
    description: 'Rules: conditional formatting, data validation',
  },
  {
    name: 'sheets_charts',
    inputSchema: SheetsChartsInputSchema,
    outputSchema: SheetsChartsOutputSchema,
    annotations: SHEETS_CHARTS_ANNOTATIONS,
    description: 'Charts: create, update, delete, move, export',
  },
  {
    name: 'sheets_pivot',
    inputSchema: SheetsPivotInputSchema,
    outputSchema: SheetsPivotOutputSchema,
    annotations: SHEETS_PIVOT_ANNOTATIONS,
    description: 'Pivot tables: create, update, refresh, calculated fields',
  },
  {
    name: 'sheets_filter_sort',
    inputSchema: SheetsFilterSortInputSchema,
    outputSchema: SheetsFilterSortOutputSchema,
    annotations: SHEETS_FILTER_SORT_ANNOTATIONS,
    description: 'Filter/sort: basic filter, filter views, slicers, sort',
  },
  {
    name: 'sheets_sharing',
    inputSchema: SheetsSharingInputSchema,
    outputSchema: SheetsSharingOutputSchema,
    annotations: SHEETS_SHARING_ANNOTATIONS,
    description: 'Sharing: permissions, transfer ownership, link sharing',
  },
  {
    name: 'sheets_comments',
    inputSchema: SheetsCommentsInputSchema,
    outputSchema: SheetsCommentsOutputSchema,
    annotations: SHEETS_COMMENTS_ANNOTATIONS,
    description: 'Comments: add, reply, resolve, delete',
  },
  {
    name: 'sheets_versions',
    inputSchema: SheetsVersionsInputSchema,
    outputSchema: SheetsVersionsOutputSchema,
    annotations: SHEETS_VERSIONS_ANNOTATIONS,
    description: 'Versions: revisions, snapshots, restore, compare',
  },
  {
    name: 'sheets_analysis',
    inputSchema: SheetsAnalysisInputSchema,
    outputSchema: SheetsAnalysisOutputSchema,
    annotations: SHEETS_ANALYSIS_ANNOTATIONS,
    description: 'Analysis: data quality, formula audit, statistics (read-only)',
  },
  {
    name: 'sheets_advanced',
    inputSchema: SheetsAdvancedInputSchema,
    outputSchema: SheetsAdvancedOutputSchema,
    annotations: SHEETS_ADVANCED_ANNOTATIONS,
    description: 'Advanced: named ranges, protected ranges, metadata, banding',
  },
];

export function createToolHandlerMap(handlers: Handlers): Record<string, (a: unknown) => Promise<unknown>> {
  // Type assertion is safe here because:
  // 1. MCP SDK validates args against inputSchema before calling the handler
  // 2. Each handler's input type matches its corresponding schema
  // 3. Handlers perform additional validation internally
  return {
    'sheets_values': (a) => handlers.values.handle(SheetsValuesInputSchema.parse(a)),
    'sheets_spreadsheet': (a) => handlers.spreadsheet.handle(SheetSpreadsheetInputSchema.parse(a)),
    'sheets_sheet': (a) => handlers.sheet.handle(SheetsSheetInputSchema.parse(a)),
    'sheets_cells': (a) => handlers.cells.handle(SheetsCellsInputSchema.parse(a)),
    'sheets_format': (a) => handlers.format.handle(SheetsFormatInputSchema.parse(a)),
    'sheets_dimensions': (a) => handlers.dimensions.handle(SheetsDimensionsInputSchema.parse(a)),
    'sheets_rules': (a) => handlers.rules.handle(SheetsRulesInputSchema.parse(a)),
    'sheets_charts': (a) => handlers.charts.handle(SheetsChartsInputSchema.parse(a)),
    'sheets_pivot': (a) => handlers.pivot.handle(SheetsPivotInputSchema.parse(a)),
    'sheets_filter_sort': (a) => handlers.filterSort.handle(SheetsFilterSortInputSchema.parse(a)),
    'sheets_sharing': (a) => handlers.sharing.handle(SheetsSharingInputSchema.parse(a)),
    'sheets_comments': (a) => handlers.comments.handle(SheetsCommentsInputSchema.parse(a)),
    'sheets_versions': (a) => handlers.versions.handle(SheetsVersionsInputSchema.parse(a)),
    'sheets_analysis': (a) => handlers.analysis.handle(SheetsAnalysisInputSchema.parse(a)),
    'sheets_advanced': (a) => handlers.advanced.handle(SheetsAdvancedInputSchema.parse(a)),
  };
}

export function buildToolResponse(result: unknown): CallToolResult {
  const structuredContent =
    typeof result === 'object' && result !== null
      ? (result as Record<string, unknown>)
      : {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Tool handler returned non-object result',
            retryable: false,
          },
        };

  const isError =
    typeof structuredContent === 'object' &&
    structuredContent !== null &&
    'success' in structuredContent &&
    structuredContent['success'] === false;

  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError: isError ? true : undefined,
  };
}

export function registerServalSheetsTools(server: McpServer, handlers: Handlers | null): void {
  const handlerMap = handlers ? createToolHandlerMap(handlers) : null;

  for (const tool of TOOL_DEFINITIONS) {
    server.registerTool(
      tool.name,
      {
        title: tool.annotations.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      async (args: Record<string, unknown>, extra?: { requestId?: string | number }) => {
        const requestId = extra?.requestId ? String(extra.requestId) : undefined;
        const requestContext = createRequestContext({ requestId });
        return runWithRequestContext(requestContext, async () => {
          if (!handlerMap) {
            return buildToolResponse({
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Google API client not initialized. Please provide credentials.',
                retryable: false,
                suggestedFix: 'Set GOOGLE_APPLICATION_CREDENTIALS or provide a Bearer token',
              },
            });
          }

          const handler = handlerMap[tool.name];
          if (!handler) {
            return buildToolResponse({
              success: false,
              error: {
                code: 'METHOD_NOT_FOUND',
                message: `Handler for ${tool.name} not yet implemented`,
                retryable: false,
                suggestedFix: 'This tool is planned for a future release',
              },
            });
          }

          const result = await handler(args);
          return buildToolResponse(result);
        });
      }
    );
  }
}

export function registerServalSheetsResources(server: McpServer, googleClient: GoogleApiClient | null): void {
  const spreadsheetTemplate = new ResourceTemplate('sheets:///{spreadsheetId}', {
    list: undefined,
  });

  server.registerResource(
    'spreadsheet',
    spreadsheetTemplate,
    {
      title: 'Spreadsheet',
      description: 'Google Sheets spreadsheet metadata (properties and sheet list)',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId) ? rawSpreadsheetId[0] : rawSpreadsheetId;

      if (!spreadsheetId || typeof spreadsheetId !== 'string') {
        return { contents: [] };
      }

      if (!googleClient) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ error: 'Not authenticated' }),
          }],
        };
      }

      try {
        const sheetsResponse = await googleClient.sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'properties,sheets.properties',
        });

        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(sheetsResponse.data, null, 2),
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          }],
        };
      }
    }
  );
}

export function registerServalSheetsPrompts(server: McpServer): void {
  // === ONBOARDING PROMPTS ===

  server.registerPrompt(
    'welcome',
    {
      description: '🎉 Welcome to ServalSheets! Get started with this guided introduction.',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🎉 Welcome to ServalSheets!

I'm your Google Sheets assistant with 15 powerful tools and 158 actions. Let me show you what I can do:

## 🚀 Quick Start

**Test your connection:**
Use the test spreadsheet: \`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms\`

Try asking me:
• "List all sheets in spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
• "Read cells A1:D10 from the first sheet"

## 📊 What I Can Do

**Data Operations:**
• Read and write cell values
• Batch operations for efficiency
• Semantic range queries (find columns by header name)

**Analysis:**
• Data quality checks
• Statistics and correlations
• Formula auditing
• Duplicate detection

**Formatting & Visualization:**
• Cell formatting (colors, fonts, numbers)
• Conditional formatting rules
• Charts and pivot tables

**Advanced Features:**
• Version history and restore
• Sharing and permissions
• Comments and collaboration
• Named ranges and protection

## 🛡️ Safety Features

I always prioritize safety:
• **Dry-run mode**: Preview changes before executing
• **Effect scope limits**: Prevent accidental large-scale changes
• **Auto-snapshots**: Backup before destructive operations
• **Expected state validation**: Ensure data hasn't changed

## 💡 Tips for Best Results

1. **Be specific**: Include spreadsheet IDs and ranges
2. **Use safety features**: Ask for dry-run on destructive operations
3. **Batch operations**: I can handle multiple ranges at once
4. **Ask questions**: I'll guide you through complex tasks

## 🎯 Ready to Start?

Try one of these:
• "Test my connection" (I'll verify your setup)
• "Show me what you can do with spreadsheet: <your-id>"
• "Help me analyze my data quality"

What would you like to do first?`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'test_connection',
    {
      description: '🔍 Test your ServalSheets connection with a public spreadsheet',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔍 Let's test your ServalSheets connection!

I'll use a public test spreadsheet to verify everything is working.

Test spreadsheet ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

Please perform these tests:

1. **List all sheets** - Get metadata about the spreadsheet
   Tool: sheets_spreadsheet, action: "get"

2. **Read sample data** - Get values from the first sheet
   Tool: sheets_values, action: "read", range: "Sheet1!A1:D10"

3. **Analyze structure** - Understand the data layout
   Tool: sheets_analysis, action: "structure_analysis"

If all tests pass, you're ready to use ServalSheets with your own spreadsheets!

**For your own spreadsheets:**
• Service accounts: Share your sheet with the service account email
• OAuth: You automatically have access to your own sheets

Let's start the test!`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'first_operation',
    {
      description: '👶 Your first ServalSheets operation - a guided walkthrough',
      argsSchema: FirstOperationPromptArgsSchema,
    },
    async (args) => {
      const spreadsheetId = args.spreadsheetId || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `👶 Let's do your first ServalSheets operation!

**Spreadsheet ID:** ${spreadsheetId}

I'll guide you through a complete workflow:

## Step 1: Read the Data 📖

First, let's see what's in the spreadsheet:
• Use \`sheets_spreadsheet\` with action \`"get"\`
• Get the list of sheets and their properties

## Step 2: Analyze Quality 🔍

Check if the data is clean:
• Use \`sheets_analysis\` with action \`"data_quality"\`
• Look for duplicates, empty cells, type mismatches

## Step 3: Get Statistics 📊

Understand the data distribution:
• Use \`sheets_analysis\` with action \`"statistics"\`
• Get mean, median, min, max for numeric columns

## Step 4: Format Headers ✨

Make the headers stand out:
• Use \`sheets_format\` with action \`"set_text_format"\`
• Make row 1 bold and centered
• **Use dry_run first!** to preview changes

## Safety Tips 🛡️

• Always read data before modifying
• Use \`safety: { dryRun: true }\` for destructive operations
• Check \`cellsAffected\` in dry-run results
• For write operations, use \`effectScope: { maxCellsAffected: 100 }\`

Ready? Let's start with Step 1!`,
          },
        }],
      };
    }
  );

  // === ANALYSIS PROMPTS ===

  server.registerPrompt(
    'analyze_spreadsheet',
    {
      description: '🔬 Comprehensive analysis of spreadsheet data quality and structure',
      argsSchema: AnalyzeSpreadsheetPromptArgsSchema,
    },
    async (args) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔬 Analyzing spreadsheet: ${args.spreadsheetId}

Please perform a comprehensive analysis:

## 1. Metadata & Structure
Tool: sheets_spreadsheet, action: "get"
• Get sheet names, row/column counts
• Identify data ranges

## 2. Data Quality Check
Tool: sheets_analysis, action: "data_quality"
• Completeness (empty cells)
• Duplicates (entire rows or key columns)
• Type consistency (mixed types in columns)
• Outliers and anomalies

## 3. Structure Analysis
Tool: sheets_analysis, action: "structure_analysis"
• Header row detection
• Data types per column
• Recommended data validation rules

## 4. Formula Audit (if applicable)
Tool: sheets_analysis, action: "formula_audit"
• Broken references
• Volatile functions
• Circular dependencies

## 5. Summary Report
Provide:
• Overall data quality score
• List of issues found
• Recommended fixes
• Suggested improvements

Begin the analysis now.`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'transform_data',
    {
      description: '🔄 Transform data in a spreadsheet range with safety checks',
      argsSchema: TransformDataPromptArgsSchema,
    },
    async (args) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔄 Data transformation requested

**Spreadsheet:** ${args.spreadsheetId}
**Range:** ${args.range}
**Transformation:** ${args.transformation}

## Safe Transformation Workflow:

### Step 1: Read Current Data
Tool: sheets_values, action: "read"
• Get current values
• Store for comparison

### Step 2: Plan Transformation
• Understand the transformation requirements
• Identify which tools to use
• Estimate cells affected

### Step 3: Preview Changes (DRY RUN)
• Apply transformation with \`safety: { dryRun: true }\`
• Review \`cellsAffected\` and \`diff\`
• Check for unintended effects

### Step 4: User Confirmation
• Show preview to user
• Explain what will change
• Wait for explicit approval

### Step 5: Execute Transformation
• Use appropriate safety options:
  - \`effectScope: { maxCellsAffected: <reasonable-limit> }\`
  - \`expectedState: { rowCount: <current-count> }\`
  - \`autoSnapshot: true\` (creates backup)

### Step 6: Verify Results
• Read transformed data
• Compare with expected outcome
• Report success or issues

Begin the transformation workflow now.`,
          },
        }],
      };
    }
  );

  // === QUICK START PROMPTS ===

  server.registerPrompt(
    'create_report',
    {
      description: '📈 Generate a formatted report from spreadsheet data',
      argsSchema: CreateReportPromptArgsSchema,
    },
    async (args) => {
      const reportType = args.reportType || 'summary';
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `📈 Creating ${reportType} report from ${args.spreadsheetId}

I'll create a professional report with:

1. **Read Source Data**
   • Identify data range
   • Get headers and values

2. **Create Report Sheet**
   • Add new sheet called "Report"
   • Set up structure

3. **Add Summary Statistics**
   • Calculate totals, averages
   • Add formulas for key metrics

4. **Apply Formatting**
   • Header row: Bold, colored background
   • Number formatting for values
   • Borders and alignment

5. **Add Visualizations** ${reportType === 'charts' ? '(Charts Included)' : ''}
   ${reportType === 'charts' ? '• Create relevant charts\n   • Position charts appropriately' : ''}

6. **Final Polish**
   • Auto-resize columns
   • Freeze header row
   • Add timestamp

Starting report creation...`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'clean_data',
    {
      description: '🧹 Clean and standardize data in a spreadsheet range',
      argsSchema: CleanDataPromptArgsSchema,
    },
    async (args) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🧹 Data cleaning workflow for ${args.spreadsheetId}, range ${args.range}

I'll clean your data systematically:

## Phase 1: Analysis
• Run data quality check
• Identify issues (duplicates, empty cells, formatting)
• Report findings to user

## Phase 2: Cleaning Plan
Based on issues found:
• Remove duplicate rows
• Fill or remove empty cells
• Standardize formats
• Fix data types

## Phase 3: Preview (DRY RUN)
• Show what will be cleaned
• Estimate impact
• Get user confirmation

## Phase 4: Execute Cleaning
• Apply changes with safety limits
• Create backup (auto-snapshot)
• Verify results

## Phase 5: Validation
• Re-run quality check
• Compare before/after
• Report improvements

Starting data cleaning analysis...`,
          },
        }],
      };
    }
  );
}
