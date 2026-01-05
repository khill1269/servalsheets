/**
 * ServalSheets - MCP Registration Helpers
 * 
 * PRODUCTION-GRADE | MCP 2025-11-25 COMPLIANT
 *
 * Tool registration for multiple transports with SDK compatibility layer.
 * 
 * Architecture:
 * - Schemas use z.discriminatedUnion() for action-based dispatch
 * - SDK compatibility layer converts to JSON Schema for tools/list
 * - Full type safety maintained throughout
 * 
 * @module mcp/registration
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type {
  ToolTaskHandler,
  TaskToolExecution,
} from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import type { ZodTypeAny } from 'zod';

import type { Handlers } from '../handlers/index.js';
import { AuthHandler } from '../handlers/auth.js';
import type { GoogleApiClient } from '../services/google-api.js';
import { createRequestContext, runWithRequestContext } from '../utils/request-context.js';
import { completeRange, completeSpreadsheetId, recordSpreadsheetId } from './completions.js';
import { TOOL_EXECUTION_CONFIG, TOOL_ICONS } from './features-2025-11-25.js';
import {
  isDiscriminatedUnion,
  zodToJsonSchemaCompat,
  verifyJsonSchema,
} from '../utils/schema-compat.js';
import {
  SheetsAuthInputSchema, SheetsAuthOutputSchema, SHEETS_AUTH_ANNOTATIONS,
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
  FirstOperationPromptArgsSchema,
  AnalyzeSpreadsheetPromptArgsSchema,
  TransformDataPromptArgsSchema,
  CreateReportPromptArgsSchema,
  CleanDataPromptArgsSchema,
} from '../schemas/prompts.js';

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
 * 16 tools, 160 actions
 * 
 * Schema Pattern: z.object({ request: z.discriminatedUnion('action', ...) })
 * - Actions are discriminated by `action` within `request`
 * - Responses are discriminated by `success` within `response`
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    name: 'sheets_auth',
    description: '🔐 MANDATORY FIRST STEP: Authentication management. ALWAYS call this with action:"status" before using any other sheets_* tool. Actions: status (check auth), login (get OAuth URL), callback (complete OAuth with code), logout (clear credentials)',
    inputSchema: SheetsAuthInputSchema,
    outputSchema: SheetsAuthOutputSchema,
    annotations: SHEETS_AUTH_ANNOTATIONS,
  },
  {
    name: 'sheets_spreadsheet',
    description: 'Spreadsheet operations: create, get, copy, update properties',
    inputSchema: SheetSpreadsheetInputSchema,
    outputSchema: SheetsSpreadsheetOutputSchema,
    annotations: SHEETS_SPREADSHEET_ANNOTATIONS,
  },
  {
    name: 'sheets_sheet',
    description: 'Sheet/tab operations: add, delete, duplicate, update, list',
    inputSchema: SheetsSheetInputSchema,
    outputSchema: SheetsSheetOutputSchema,
    annotations: SHEETS_SHEET_ANNOTATIONS,
  },
  {
    name: 'sheets_values',
    description: 'Cell values: read, write, append, clear, find, replace',
    inputSchema: SheetsValuesInputSchema,
    outputSchema: SheetsValuesOutputSchema,
    annotations: SHEETS_VALUES_ANNOTATIONS,
  },
  {
    name: 'sheets_cells',
    description: 'Cell operations: notes, validation, hyperlinks, merge',
    inputSchema: SheetsCellsInputSchema,
    outputSchema: SheetsCellsOutputSchema,
    annotations: SHEETS_CELLS_ANNOTATIONS,
  },
  {
    name: 'sheets_format',
    description: 'Formatting: colors, fonts, borders, alignment, presets',
    inputSchema: SheetsFormatInputSchema,
    outputSchema: SheetsFormatOutputSchema,
    annotations: SHEETS_FORMAT_ANNOTATIONS,
  },
  {
    name: 'sheets_dimensions',
    description: 'Rows/columns: insert, delete, move, resize, freeze, group',
    inputSchema: SheetsDimensionsInputSchema,
    outputSchema: SheetsDimensionsOutputSchema,
    annotations: SHEETS_DIMENSIONS_ANNOTATIONS,
  },
  {
    name: 'sheets_rules',
    description: 'Rules: conditional formatting, data validation',
    inputSchema: SheetsRulesInputSchema,
    outputSchema: SheetsRulesOutputSchema,
    annotations: SHEETS_RULES_ANNOTATIONS,
  },
  {
    name: 'sheets_charts',
    description: 'Charts: create, update, delete, move, export',
    inputSchema: SheetsChartsInputSchema,
    outputSchema: SheetsChartsOutputSchema,
    annotations: SHEETS_CHARTS_ANNOTATIONS,
  },
  {
    name: 'sheets_pivot',
    description: 'Pivot tables: create, update, refresh, calculated fields',
    inputSchema: SheetsPivotInputSchema,
    outputSchema: SheetsPivotOutputSchema,
    annotations: SHEETS_PIVOT_ANNOTATIONS,
  },
  {
    name: 'sheets_filter_sort',
    description: 'Filter/sort: basic filter, filter views, slicers, sort',
    inputSchema: SheetsFilterSortInputSchema,
    outputSchema: SheetsFilterSortOutputSchema,
    annotations: SHEETS_FILTER_SORT_ANNOTATIONS,
  },
  {
    name: 'sheets_sharing',
    description: 'Sharing: permissions, transfer ownership, link sharing',
    inputSchema: SheetsSharingInputSchema,
    outputSchema: SheetsSharingOutputSchema,
    annotations: SHEETS_SHARING_ANNOTATIONS,
  },
  {
    name: 'sheets_comments',
    description: 'Comments: add, reply, resolve, delete',
    inputSchema: SheetsCommentsInputSchema,
    outputSchema: SheetsCommentsOutputSchema,
    annotations: SHEETS_COMMENTS_ANNOTATIONS,
  },
  {
    name: 'sheets_versions',
    description: 'Versions: revisions, snapshots, restore, compare',
    inputSchema: SheetsVersionsInputSchema,
    outputSchema: SheetsVersionsOutputSchema,
    annotations: SHEETS_VERSIONS_ANNOTATIONS,
  },
  {
    name: 'sheets_analysis',
    description: 'Analysis: data quality, formula audit, statistics (read-only)',
    inputSchema: SheetsAnalysisInputSchema,
    outputSchema: SheetsAnalysisOutputSchema,
    annotations: SHEETS_ANALYSIS_ANNOTATIONS,
  },
  {
    name: 'sheets_advanced',
    description: 'Advanced: named ranges, protected ranges, metadata, banding',
    inputSchema: SheetsAdvancedInputSchema,
    outputSchema: SheetsAdvancedOutputSchema,
    annotations: SHEETS_ADVANCED_ANNOTATIONS,
  },
] as const;

// ============================================================================
// HANDLER MAPPING
// ============================================================================

/**
 * Creates a map of tool names to handler functions
 * 
 * Each handler receives validated input and returns structured output.
 * The MCP SDK validates input against inputSchema before calling the handler.
 */
export function createToolHandlerMap(
  handlers: Handlers,
  authHandler?: AuthHandler
): Record<string, (args: unknown) => Promise<unknown>> {
  const map: Record<string, (args: unknown) => Promise<unknown>> = {
    'sheets_spreadsheet': (args) => handlers.spreadsheet.handle(SheetSpreadsheetInputSchema.parse(args)),
    'sheets_sheet': (args) => handlers.sheet.handle(SheetsSheetInputSchema.parse(args)),
    'sheets_values': (args) => handlers.values.handle(SheetsValuesInputSchema.parse(args)),
    'sheets_cells': (args) => handlers.cells.handle(SheetsCellsInputSchema.parse(args)),
    'sheets_format': (args) => handlers.format.handle(SheetsFormatInputSchema.parse(args)),
    'sheets_dimensions': (args) => handlers.dimensions.handle(SheetsDimensionsInputSchema.parse(args)),
    'sheets_rules': (args) => handlers.rules.handle(SheetsRulesInputSchema.parse(args)),
    'sheets_charts': (args) => handlers.charts.handle(SheetsChartsInputSchema.parse(args)),
    'sheets_pivot': (args) => handlers.pivot.handle(SheetsPivotInputSchema.parse(args)),
    'sheets_filter_sort': (args) => handlers.filterSort.handle(SheetsFilterSortInputSchema.parse(args)),
    'sheets_sharing': (args) => handlers.sharing.handle(SheetsSharingInputSchema.parse(args)),
    'sheets_comments': (args) => handlers.comments.handle(SheetsCommentsInputSchema.parse(args)),
    'sheets_versions': (args) => handlers.versions.handle(SheetsVersionsInputSchema.parse(args)),
    'sheets_analysis': (args) => handlers.analysis.handle(SheetsAnalysisInputSchema.parse(args)),
    'sheets_advanced': (args) => handlers.advanced.handle(SheetsAdvancedInputSchema.parse(args)),
  };

  if (authHandler) {
    map['sheets_auth'] = (args) => authHandler.handle(SheetsAuthInputSchema.parse(args));
  }

  return map;
}

// ============================================================================
// RESPONSE BUILDING
// ============================================================================

/**
 * Builds a compliant MCP tool response
 * 
 * MCP 2025-11-25 Response Requirements:
 * - content: Array of content blocks (always present)
 * - structuredContent: Typed object matching outputSchema
 * - isError: true for tool errors (LLM can retry), undefined for success
 * 
 * @param result - The handler result (should match output schema)
 * @returns CallToolResult with content, structuredContent, and optional isError
 */
export function buildToolResponse(result: unknown): CallToolResult {
  let structuredContent: Record<string, unknown>;

  if (typeof result !== 'object' || result === null) {
    structuredContent = {
      response: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Tool handler returned non-object result',
          retryable: false,
        },
      },
    };
  } else if ('response' in result) {
    structuredContent = result as Record<string, unknown>;
  } else if ('success' in result) {
    structuredContent = { response: result as Record<string, unknown> };
  } else {
    structuredContent = {
      response: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Tool handler returned invalid response shape',
          retryable: false,
        },
      },
    };
  }

  const response = structuredContent['response'];
  const responseSuccess = (response && typeof response === 'object')
    ? (response as { success?: boolean }).success
    : undefined;

  // Detect errors from success: false in response (or legacy top-level success)
  const isError = responseSuccess === false
    || (structuredContent['success'] === false);

  return {
    // Human-readable content for display
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    // Typed structured content for programmatic access
    structuredContent,
    // Error flag - only set when true, undefined otherwise (MCP convention)
    isError: isError ? true : undefined,
  };
}

// ============================================================================
// SCHEMA PREPARATION
// ============================================================================

/**
 * Prepares a schema for MCP SDK registration
 * 
 * The MCP SDK v1.25.x has a limitation where normalizeObjectSchema() only
 * recognizes z.object() schemas. Discriminated unions and other Zod types
 * result in empty JSON Schema in tools/list.
 * 
 * This function converts non-object schemas to JSON Schema format to ensure
 * proper serialization in the tools/list response.
 * 
 * @param schema - Zod schema to prepare
 * @returns Schema ready for registerTool() - either original or JSON Schema
 */
export function prepareSchemaForRegistration(schema: ZodTypeAny): AnySchema | Record<string, unknown> {
  // Discriminated unions need conversion to JSON Schema
  if (isDiscriminatedUnion(schema)) {
    return zodToJsonSchemaCompat(schema) as Record<string, unknown>;
  }

  // z.object() and other schemas work natively
  return schema as unknown as AnySchema;
}

function createToolCallHandler(
  tool: ToolDefinition,
  handlerMap: Record<string, (args: unknown) => Promise<unknown>> | null
): (args: Record<string, unknown>, extra?: { requestId?: string | number }) => Promise<CallToolResult> {
  return async (args: Record<string, unknown>, extra?: { requestId?: string | number }) => {
    const requestId = extra?.requestId ? String(extra.requestId) : undefined;
    const requestContext = createRequestContext({ requestId });

    return runWithRequestContext(requestContext, async () => {
      recordSpreadsheetId(args);

      if (!handlerMap) {
        return buildToolResponse({
          response: {
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Google API client not initialized. Please provide credentials.',
              retryable: false,
              suggestedFix: 'Set GOOGLE_APPLICATION_CREDENTIALS or configure OAuth',
            },
          },
        });
      }

      const handler = handlerMap[tool.name];
      if (!handler) {
        return buildToolResponse({
          response: {
            success: false,
            error: {
              code: 'NOT_IMPLEMENTED',
              message: `Handler for ${tool.name} not yet implemented`,
              retryable: false,
              suggestedFix: 'This tool is planned for a future release',
            },
          },
        });
      }

      const result = await handler(args);
      return buildToolResponse(result);
    });
  };
}

function createToolTaskHandler(
  toolName: string,
  runTool: (args: Record<string, unknown>, extra?: { requestId?: string | number }) => Promise<CallToolResult>
): ToolTaskHandler<AnySchema> {
  return {
    createTask: async (args, extra) => {
      if (!extra.taskStore) {
        throw new Error(`[${toolName}] Task store not configured`);
      }

      const task = await extra.taskStore.createTask({
        ttl: extra.taskRequestedTtl ?? undefined,
      });

      const taskStore = extra.taskStore;
      void (async () => {
        try {
          const result = await runTool(args as Record<string, unknown>, extra);
          await taskStore.storeTaskResult(task.taskId, 'completed', result);
        } catch (error) {
          const errorResult = buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : String(error),
                retryable: false,
              },
            },
          });
          try {
            await taskStore.storeTaskResult(task.taskId, 'failed', errorResult);
          } catch (storeError) {
            console.error(`[${toolName}] Failed to store task result`, storeError);
          }
        }
      })();

      return { task };
    },
    getTask: async (_args, extra) => {
      if (!extra.taskStore) {
        throw new Error(`[${toolName}] Task store not configured`);
      }
      return await extra.taskStore.getTask(extra.taskId);
    },
    getTaskResult: async (_args, extra) => {
      if (!extra.taskStore) {
        throw new Error(`[${toolName}] Task store not configured`);
      }
      return await extra.taskStore.getTaskResult(extra.taskId) as CallToolResult;
    },
  };
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Registers all ServalSheets tools with the MCP server
 * 
 * Handles SDK compatibility for discriminated union schemas.
 * 
 * @param server - McpServer instance
 * @param handlers - Tool handlers (null if not authenticated)
 */
export function registerServalSheetsTools(
  server: McpServer,
  handlers: Handlers | null,
  options?: { googleClient?: GoogleApiClient | null }
): void {
  const authHandler = new AuthHandler({
    googleClient: options?.googleClient ?? null,
    elicitationServer: server.server,
  });

  const handlerMap = handlers
    ? createToolHandlerMap(handlers, authHandler)
    : { 'sheets_auth': (args: unknown) => authHandler.handle(SheetsAuthInputSchema.parse(args)) };

  for (const tool of TOOL_DEFINITIONS) {
    // Prepare schemas for SDK registration
    const inputSchemaForRegistration = prepareSchemaForRegistration(tool.inputSchema);
    const outputSchemaForRegistration = prepareSchemaForRegistration(tool.outputSchema);

    // Development-only schema validation (only for JSON Schema objects)
    if (process.env['NODE_ENV'] !== 'production') {
      const isZodSchema = (schema: unknown): boolean =>
        Boolean(schema && typeof schema === 'object' && '_def' in (schema as Record<string, unknown>));

      if (!isZodSchema(inputSchemaForRegistration)) {
        verifyJsonSchema(inputSchemaForRegistration);
      }
      if (!isZodSchema(outputSchemaForRegistration)) {
        verifyJsonSchema(outputSchemaForRegistration);
      }
    }

    // Register tool with prepared schemas
    // Type assertion needed due to TypeScript's deep type instantiation limits
    const execution = TOOL_EXECUTION_CONFIG[tool.name];
    const supportsTasks = execution?.taskSupport && execution.taskSupport !== 'forbidden';
    const runTool = createToolCallHandler(tool, handlerMap);

    if (supportsTasks) {
      const taskHandler = createToolTaskHandler(tool.name, runTool);
      const taskSupport = execution?.taskSupport === 'required' ? 'required' : 'optional';
      const taskExecution = {
        ...(execution ?? {}),
        taskSupport,
      } as TaskToolExecution;

      server.experimental.tasks.registerToolTask<AnySchema, AnySchema>(
        tool.name,
        {
          title: tool.annotations.title,
          description: tool.description,
          inputSchema: tool.inputSchema as AnySchema,
          outputSchema: tool.outputSchema as AnySchema,
          annotations: tool.annotations,
          execution: taskExecution,
        },
        taskHandler
      );
      continue;
    }

    (server.registerTool as (
      name: string,
      config: {
        title?: string;
        description?: string;
        inputSchema?: unknown;
        outputSchema?: unknown;
        annotations?: ToolAnnotations;
        icons?: import('@modelcontextprotocol/sdk/types.js').Icon[];
        execution?: import('@modelcontextprotocol/sdk/types.js').ToolExecution;
      },
      cb: (args: Record<string, unknown>, extra?: { requestId?: string | number }) => Promise<CallToolResult>
    ) => void)(
      tool.name,
      {
        title: tool.annotations.title,
        description: tool.description,
        inputSchema: inputSchemaForRegistration,
        outputSchema: outputSchemaForRegistration,
        annotations: tool.annotations,
        icons: TOOL_ICONS[tool.name],
        execution,
      },
      runTool
    );
  }
}


// ============================================================================
// RESOURCES REGISTRATION
// ============================================================================

/**
 * Registers ServalSheets resources with the MCP server
 * 
 * Resources provide read-only access to spreadsheet metadata via URI templates.
 * 
 * @param server - McpServer instance
 * @param googleClient - Google API client (null if not authenticated)
 */
export function registerServalSheetsResources(server: McpServer, googleClient: GoogleApiClient | null): void {
  const spreadsheetTemplate = new ResourceTemplate('sheets:///{spreadsheetId}', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
    },
  });

  const rangeTemplate = new ResourceTemplate('sheets:///{spreadsheetId}/{range}', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
      range: async (value) => completeRange(value),
    },
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

  server.registerResource(
    'spreadsheet_range',
    rangeTemplate,
    {
      title: 'Spreadsheet Range',
      description: 'Google Sheets range values (A1 notation)',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const rawRange = variables['range'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId) ? rawSpreadsheetId[0] : rawSpreadsheetId;
      const encodedRange = Array.isArray(rawRange) ? rawRange[0] : rawRange;
      const range = typeof encodedRange === 'string'
        ? decodeURIComponent(encodedRange)
        : undefined;

      if (!spreadsheetId || typeof spreadsheetId !== 'string' || !range) {
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
        const valuesResponse = await googleClient.sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(valuesResponse.data, null, 2),
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

// ============================================================================
// PROMPTS REGISTRATION
// ============================================================================

/**
 * Registers ServalSheets prompts with the MCP server
 * 
 * Prompts provide guided workflows and templates for common operations.
 * 
 * @param server - McpServer instance
 */
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

I'm your Google Sheets assistant with 15 powerful tools and 156 actions.

## 🚀 Quick Start
Test spreadsheet: \`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms\`

## 📊 Capabilities
• Data Operations: Read, write, batch operations
• Analysis: Data quality, statistics, formula audit
• Formatting: Colors, fonts, conditional formatting
• Advanced: Charts, pivots, sharing, versions

## 🛡️ Safety Features
• Dry-run mode, effect limits, auto-snapshots

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
            text: `🔍 Testing ServalSheets connection!

Test spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms

Please run:
1. sheets_spreadsheet action: "get"
2. sheets_values action: "read", range: "Sheet1!A1:D10"
3. sheets_analysis action: "structure_analysis"

If tests pass, you're ready!`,
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
    async (args: any) => {
      const spreadsheetId = args['spreadsheetId'] || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `👶 First ServalSheets operation!

Spreadsheet: ${spreadsheetId}

Steps:
1. Read data: sheets_spreadsheet action "get"
2. Analyze quality: sheets_analysis action "data_quality"
3. Get statistics: sheets_analysis action "statistics"
4. Format headers: sheets_format (use dryRun first!)

Safety tips: Always read before modify, use dryRun for destructive ops.`,
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
    async (args: any) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔬 Analyzing: ${args['spreadsheetId']}

Run comprehensive analysis:
1. Metadata: sheets_spreadsheet action "get"
2. Data Quality: sheets_analysis action "data_quality"
3. Structure: sheets_analysis action "structure_analysis"
4. Formula Audit: sheets_analysis action "formula_audit"

Provide: quality score, issues found, recommended fixes.`,
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
    async (args: any) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🔄 Transform data

Spreadsheet: ${args['spreadsheetId']}
Range: ${args['range']}
Transform: ${args['transformation']}

Workflow:
1. Read current data
2. Plan transformation
3. Preview (dryRun: true)
4. Get confirmation
5. Execute with safety limits
6. Verify results`,
          },
        }],
      };
    }
  );

  server.registerPrompt(
    'create_report',
    {
      description: '📈 Generate a formatted report from spreadsheet data',
      argsSchema: CreateReportPromptArgsSchema,
    },
    async (args: any) => {
      const reportType = args['reportType'] || 'summary';
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `📈 Creating ${reportType} report from ${args['spreadsheetId']}

Steps:
1. Read source data
2. Create "Report" sheet
3. Add summary statistics
4. Apply formatting
${reportType === 'charts' ? '5. Add charts\n' : ''}
Final: Auto-resize, freeze header, add timestamp`,
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
    async (args: any) => {
      return {
        messages: [{
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `🧹 Cleaning data: ${args['spreadsheetId']}, range ${args['range']}

Phases:
1. Analysis: Run data quality check
2. Plan: Identify duplicates, empty cells, format issues
3. Preview: Show changes with dryRun
4. Execute: Apply with auto-snapshot
5. Validate: Compare before/after`,
          },
        }],
      };
    }
  );
}
