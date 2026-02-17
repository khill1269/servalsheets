/**
 * GraphQL Resolvers
 *
 * Implements query and mutation resolvers that delegate to MCP handlers.
 */

import { GraphQLError } from 'graphql';
import { TOOL_REGISTRY, TOOL_COUNT, ACTION_COUNT } from '../schemas/index.js';
import { VERSION, MCP_PROTOCOL_VERSION } from '../version.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import type { HandlerContext } from '../handlers/index.js';
import { createHandlers } from '../handlers/index.js';

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
      return TOOL_REGISTRY.map((schema) => ({
        name: schema.name,
        description: schema.description || '',
        inputSchema: schema.inputSchema,
        actions: schema.actions || [],
        actionCount: schema.actions?.length || 0,
      }));
    },

    /**
     * Get a specific tool by name
     */
    tool: (_parent: unknown, { name }: { name: string }) => {
      const schema = TOOL_REGISTRY.find((s) => s.name === name);
      if (!schema) {
        throw new GraphQLError(`Tool not found: ${name}`, {
          extensions: { code: 'TOOL_NOT_FOUND' },
        });
      }

      return {
        name: schema.name,
        description: schema.description || '',
        inputSchema: schema.inputSchema,
        actions: schema.actions || [],
        actionCount: schema.actions?.length || 0,
      };
    },

    /**
     * Get circuit breaker status
     */
    circuitBreakers: () => {
      const breakers = circuitBreakerRegistry.getAll();
      return breakers.map((entry) => ({
        name: entry.name,
        state: entry.breaker.getState(),
        failureCount: entry.breaker.getFailureCount(),
        successCount: entry.breaker.getSuccessCount(),
        lastFailureTime: entry.breaker.getLastFailureTime(),
      }));
    },

    /**
     * Get spreadsheet metadata
     */
    spreadsheet: async (
      _parent: unknown,
      { spreadsheetId }: { spreadsheetId: string },
      context: GraphQLContext
    ) => {
      const handlers = createHandlers(context.handlerContext);
      const coreHandler = handlers.core;

      try {
        const result = await coreHandler.executeAction({
          request: {
            action: 'get_spreadsheet',
            spreadsheetId,
          },
        });

        if (!result.response?.success) {
          throw new GraphQLError('Failed to fetch spreadsheet', {
            extensions: { code: 'FETCH_FAILED' },
          });
        }

        return {
          spreadsheetId,
          title: result.response.data.properties?.title,
          sheets: result.response.data.sheets,
          properties: result.response.data.properties,
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
      const handlers = createHandlers(context.handlerContext);
      const dataHandler = handlers.data;

      try {
        const result = await dataHandler.executeAction({
          request: {
            action: 'read_range',
            spreadsheetId,
            range,
          },
        });

        if (!result.response?.success) {
          throw new GraphQLError('Failed to read range', {
            extensions: { code: 'READ_FAILED' },
          });
        }

        const values = result.response.data.values || [];
        return {
          range,
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
      const handlers = createHandlers(context.handlerContext);
      const coreHandler = handlers.core;

      try {
        const result = await coreHandler.executeAction({
          request: {
            action: 'list_sheets',
            spreadsheetId,
          },
        });

        if (!result.response?.success) {
          throw new GraphQLError('Failed to list sheets', {
            extensions: { code: 'LIST_FAILED' },
          });
        }

        return result.response.data.sheets || [];
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
      const handlers = createHandlers(context.handlerContext);
      const dataHandler = handlers.data;

      try {
        const result = await dataHandler.executeAction({
          request: {
            action: 'write_range',
            spreadsheetId,
            range,
            values,
          },
        });

        return {
          success: result.response?.success || false,
          message: 'Range written successfully',
          spreadsheetId,
          updatedCells: values.length * (values[0]?.length || 0),
          data: result.response?.data,
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
      const handlers = createHandlers(context.handlerContext);
      const coreHandler = handlers.core;

      try {
        const result = await coreHandler.executeAction({
          request: {
            action: 'create_sheet',
            spreadsheetId,
            title,
            rowCount,
            columnCount,
          },
        });

        return {
          success: result.response?.success || false,
          message: `Sheet "${title}" created successfully`,
          spreadsheetId,
          data: result.response?.data,
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
      const handlers = createHandlers(context.handlerContext);
      const coreHandler = handlers.core;

      try {
        const result = await coreHandler.executeAction({
          request: {
            action: 'delete_sheet',
            spreadsheetId,
            sheetId,
          },
        });

        return {
          success: result.response?.success || false,
          message: 'Sheet deleted successfully',
          spreadsheetId,
          data: result.response?.data,
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
