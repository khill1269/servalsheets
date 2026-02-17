/**
 * GraphQL Resolvers
 *
 * Implements query and mutation resolvers that delegate to MCP handlers.
 */

import { GraphQLError } from 'graphql';
import { TOOL_COUNT, ACTION_COUNT } from '../schemas/index.js';
import { VERSION, MCP_PROTOCOL_VERSION } from '../version.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import type { HandlerContext } from '../handlers/index.js';
import {
  SheetsAdvancedInputSchema,
  SheetsAnalyzeInputSchema,
  SheetsAppsScriptInputSchema,
  SheetsAuthInputSchema,
  SheetsBigQueryInputSchema,
  SheetsCollaborateInputSchema,
  CompositeInputSchema,
  SheetsConfirmInputSchema,
  SheetsCoreInputSchema,
  SheetsDataInputSchema,
  SheetsDependenciesInputSchema,
  SheetsDimensionsInputSchema,
  SheetsFederationInputSchema,
  SheetsFixInputSchema,
  SheetsFormatInputSchema,
  SheetsHistoryInputSchema,
  SheetsQualityInputSchema,
  SheetsSessionInputSchema,
  SheetsTemplatesInputSchema,
  SheetsTransactionInputSchema,
  SheetsVisualizeInputSchema,
  SheetsWebhookInputSchema,
} from '../schemas/index.js';

/**
 * GraphQL context - includes authenticated user and handler context
 */
export interface GraphQLContext {
  handlerContext: HandlerContext;
  userId?: string;
}

/**
 * Main resolvers object
 */
export const resolvers = {
  Query: {
    /**
     * Get server information
     */
    serverInfo: () => ({
      version: VERSION,
      protocolVersion: MCP_PROTOCOL_VERSION,
      toolCount: TOOL_COUNT,
      actionCount: ACTION_COUNT,
      uptime: process.uptime(),
      status: 'operational',
    }),

    /**
     * List all available tools
     */
    tools: () => {
      const schemas = [
        { name: 'sheets_advanced', schema: SheetsAdvancedInputSchema },
        { name: 'sheets_analyze', schema: SheetsAnalyzeInputSchema },
        { name: 'sheets_appsscript', schema: SheetsAppsScriptInputSchema },
        { name: 'sheets_auth', schema: SheetsAuthInputSchema },
        { name: 'sheets_bigquery', schema: SheetsBigQueryInputSchema },
        { name: 'sheets_collaborate', schema: SheetsCollaborateInputSchema },
        { name: 'sheets_composite', schema: CompositeInputSchema },
        { name: 'sheets_confirm', schema: SheetsConfirmInputSchema },
        { name: 'sheets_core', schema: SheetsCoreInputSchema },
        { name: 'sheets_data', schema: SheetsDataInputSchema },
        { name: 'sheets_dependencies', schema: SheetsDependenciesInputSchema },
        { name: 'sheets_dimensions', schema: SheetsDimensionsInputSchema },
        { name: 'sheets_federation', schema: SheetsFederationInputSchema },
        { name: 'sheets_fix', schema: SheetsFixInputSchema },
        { name: 'sheets_format', schema: SheetsFormatInputSchema },
        { name: 'sheets_history', schema: SheetsHistoryInputSchema },
        { name: 'sheets_quality', schema: SheetsQualityInputSchema },
        { name: 'sheets_session', schema: SheetsSessionInputSchema },
        { name: 'sheets_templates', schema: SheetsTemplatesInputSchema },
        { name: 'sheets_transaction', schema: SheetsTransactionInputSchema },
        { name: 'sheets_visualize', schema: SheetsVisualizeInputSchema },
        { name: 'sheets_webhook', schema: SheetsWebhookInputSchema },
      ];

      return schemas.map(({ name, schema }) => {
        const actions = 'shape' in schema && 'action' in schema.shape
          ? (schema.shape.action as any)._def?.values || []
          : [];

        return {
          name,
          description: schema.description || '',
          inputSchema: schema,
          actions,
          actionCount: actions.length,
        };
      });
    },

    /**
     * Get a specific tool by name
     */
    tool: (_parent: unknown, { name }: { name: string }) => {
      const schemaMap: Record<string, any> = {
        sheets_advanced: SheetsAdvancedInputSchema,
        sheets_analyze: SheetsAnalyzeInputSchema,
        sheets_appsscript: SheetsAppsScriptInputSchema,
        sheets_auth: SheetsAuthInputSchema,
        sheets_bigquery: SheetsBigQueryInputSchema,
        sheets_collaborate: SheetsCollaborateInputSchema,
        sheets_composite: CompositeInputSchema,
        sheets_confirm: SheetsConfirmInputSchema,
        sheets_core: SheetsCoreInputSchema,
        sheets_data: SheetsDataInputSchema,
        sheets_dependencies: SheetsDependenciesInputSchema,
        sheets_dimensions: SheetsDimensionsInputSchema,
        sheets_federation: SheetsFederationInputSchema,
        sheets_fix: SheetsFixInputSchema,
        sheets_format: SheetsFormatInputSchema,
        sheets_history: SheetsHistoryInputSchema,
        sheets_quality: SheetsQualityInputSchema,
        sheets_session: SheetsSessionInputSchema,
        sheets_templates: SheetsTemplatesInputSchema,
        sheets_transaction: SheetsTransactionInputSchema,
        sheets_visualize: SheetsVisualizeInputSchema,
        sheets_webhook: SheetsWebhookInputSchema,
      };

      const schema = schemaMap[name];
      if (!schema) {
        throw new GraphQLError(`Tool not found: ${name}`, {
          extensions: { code: 'TOOL_NOT_FOUND' },
        });
      }

      const actions = 'shape' in schema && 'action' in schema.shape
        ? (schema.shape.action as any)._def?.values || []
        : [];

      return {
        name,
        description: schema.description || '',
        inputSchema: schema,
        actions,
        actionCount: actions.length,
      };
    },

    /**
     * Get circuit breaker status
     */
    circuitBreakers: () => {
      const breakers = circuitBreakerRegistry.getAll();
      return breakers.map((entry) => {
        const stats = entry.breaker.getStats();
        return {
          name: entry.name,
          state: stats.state,
          failureCount: stats.failureCount,
          successCount: stats.successCount,
          lastFailureTime: stats.lastFailure,
        };
      });
    },

    /**
     * Get spreadsheet metadata
     */
    spreadsheet: async (
      _parent: unknown,
      { spreadsheetId }: { spreadsheetId: string },
      context: GraphQLContext
    ) => {
      try {
        // Use Google Sheets API directly
        const googleClient = context.handlerContext.googleClient;
        if (!googleClient) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const sheetsApi = googleClient.sheets;
        const response = await sheetsApi.spreadsheets.get({
          spreadsheetId,
        });

        return {
          spreadsheetId,
          title: response.data.properties?.title,
          sheets: response.data.sheets,
          properties: response.data.properties,
        };
      } catch (error) {
        throw new GraphQLError('Failed to fetch spreadsheet', {
          extensions: {
            code: 'FETCH_FAILED',
            originalError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },

    /**
     * Read a range of data
     */
    readRange: async (
      _parent: unknown,
      { spreadsheetId, range }: { spreadsheetId: string; range: string },
      context: GraphQLContext
    ) => {
      try {
        // Use Google Sheets API directly
        const googleClient = context.handlerContext.googleClient;
        if (!googleClient) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const sheetsApi = googleClient.sheets;
        const response = await sheetsApi.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const values = response.data.values || [];
        return {
          range: response.data.range || range,
          values,
          rowCount: values.length,
          columnCount: values[0]?.length || 0,
        };
      } catch (error) {
        throw new GraphQLError('Failed to read range', {
          extensions: {
            code: 'READ_FAILED',
            originalError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },

    /**
     * List all sheets in a spreadsheet
     */
    listSheets: async (
      _parent: unknown,
      { spreadsheetId }: { spreadsheetId: string },
      context: GraphQLContext
    ) => {
      try {
        // Use Google Sheets API directly
        const googleClient = context.handlerContext.googleClient;
        if (!googleClient) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const sheetsApi = googleClient.sheets;
        const response = await sheetsApi.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets(properties(sheetId,title,index,gridProperties))',
        });

        return response.data.sheets || [];
      } catch (error) {
        throw new GraphQLError('Failed to list sheets', {
          extensions: {
            code: 'LIST_FAILED',
            originalError: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },
  },

  Mutation: {
    /**
     * Write data to a range
     */
    writeRange: async (
      _parent: unknown,
      {
        spreadsheetId,
        range,
        values,
      }: { spreadsheetId: string; range: string; values: string[][] },
      context: GraphQLContext
    ) => {
      try {
        // Use Google Sheets API directly
        const googleClient = context.handlerContext.googleClient;
        if (!googleClient) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const sheetsApi = googleClient.sheets;
        const response = await sheetsApi.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values,
          },
        });

        return {
          success: true,
          message: 'Range written successfully',
          spreadsheetId,
          updatedCells: response.data.updatedCells || 0,
          data: response.data,
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to write range',
          error: {
            code: 'WRITE_FAILED',
            message: error instanceof Error ? error.message : String(error),
            details: {},
          },
        };
      }
    },

    /**
     * Create a new sheet
     */
    createSheet: async (
      _parent: unknown,
      {
        spreadsheetId,
        title,
        rowCount = 1000,
        columnCount = 26,
      }: { spreadsheetId: string; title: string; rowCount?: number; columnCount?: number },
      context: GraphQLContext
    ) => {
      try {
        // Use Google Sheets API directly
        const googleClient = context.handlerContext.googleClient;
        if (!googleClient) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const sheetsApi = googleClient.sheets;
        const response = await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title,
                    gridProperties: {
                      rowCount,
                      columnCount,
                    },
                  },
                },
              },
            ],
          },
        });

        return {
          success: true,
          message: `Sheet "${title}" created successfully`,
          spreadsheetId,
          data: response.data.replies?.[0]?.addSheet,
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to create sheet',
          error: {
            code: 'CREATE_FAILED',
            message: error instanceof Error ? error.message : String(error),
            details: {},
          },
        };
      }
    },

    /**
     * Delete a sheet
     */
    deleteSheet: async (
      _parent: unknown,
      { spreadsheetId, sheetId }: { spreadsheetId: string; sheetId: number },
      context: GraphQLContext
    ) => {
      try {
        // Use Google Sheets API directly
        const googleClient = context.handlerContext.googleClient;
        if (!googleClient) {
          throw new GraphQLError('Authentication required', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const sheetsApi = googleClient.sheets;
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteSheet: {
                  sheetId,
                },
              },
            ],
          },
        });

        return {
          success: true,
          message: 'Sheet deleted successfully',
          spreadsheetId,
        };
      } catch (error) {
        return {
          success: false,
          message: 'Failed to delete sheet',
          error: {
            code: 'DELETE_FAILED',
            message: error instanceof Error ? error.message : String(error),
            details: {},
          },
        };
      }
    },
  },
};
