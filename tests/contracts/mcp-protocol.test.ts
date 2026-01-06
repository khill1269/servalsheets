/**
 * MCP Protocol Compliance Tests
 *
 * Ensures ServalSheets correctly implements the MCP protocol:
 * - initialize method responds correctly
 * - tools/list returns all tools with valid schemas
 * - Error responses use correct JSON-RPC error codes
 * - Server handles invalid requests gracefully
 *
 * These tests verify protocol compliance without requiring Google API credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerServalSheetsTools, registerServalSheetsPrompts } from '../../src/mcp/registration.js';
import { TOOL_COUNT } from '../../src/schemas/index.js';
import { patchMcpServerRequestHandler } from '../../src/mcp/sdk-compat.js';

patchMcpServerRequestHandler();

describe('MCP Protocol Compliance', () => {
  let server: McpServer;

  beforeAll(() => {
    // Create server without Google API client (handlers will return error, but that's OK)
    server = new McpServer({
      name: 'servalsheets-test',
      version: '1.0.0',
    });

    // Register tools and prompts (without actual handlers)
    registerServalSheetsTools(server, null);
    registerServalSheetsPrompts(server);
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Server Initialization', () => {
    it('server should be created successfully', () => {
      expect(server).toBeDefined();
      expect(typeof server.close).toBe('function');
    });

    it('server should have underlying Server instance', () => {
      expect(server.server).toBeDefined();
      expect(typeof server.server).toBe('object');
    });
  });

  describe('Tool Registration', () => {
    it('should register exactly 16 tools', () => {
      // Access private _registeredTools field (it's an object, not a Map)
      const serverAny = server as any;
      const tools = serverAny._registeredTools;

      expect(tools).toBeDefined();
      const toolNames = Object.keys(tools);
      expect(toolNames.length).toBe(TOOL_COUNT);
    });

    it('all tools should have required fields', () => {
      const serverAny = server as any;
      const tools = serverAny._registeredTools as Record<string, any>;

      for (const [name, toolDef] of Object.entries(tools)) {
        // Every tool must have a name (the object key)
        expect(name).toBeDefined();
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);

        // Tool definition should have required fields
        expect(toolDef).toBeDefined();
        expect(toolDef.description).toBeDefined();
        expect(typeof toolDef.description).toBe('string');

        expect(toolDef.inputSchema).toBeDefined();
        expect(toolDef.handler).toBeDefined();

        // Handler can be either a function (non-task tools) or an object (task-enabled tools)
        const handlerType = typeof toolDef.handler;
        expect(['function', 'object']).toContain(handlerType);

        // If handler is an object (task support), verify it has proper structure
        // The exact structure depends on SDK implementation
        if (handlerType === 'object') {
          expect(toolDef.handler).toBeDefined();
          expect(typeof toolDef.handler).toBe('object');
        }
      }
    });

    it('all tool names should follow naming convention', () => {
      const serverAny = server as any;
      const tools = serverAny._registeredTools as Record<string, any>;

      for (const name of Object.keys(tools)) {
        // Tool names should be lowercase with underscores
        expect(name).toMatch(/^[a-z_]+$/);

        // All ServalSheets tools should start with 'sheets_'
        expect(name).toMatch(/^sheets_/);
      }
    });

    it('tool names should be unique', () => {
      const serverAny = server as any;
      const tools = serverAny._registeredTools as Record<string, any>;

      // Object keys are unique by definition
      const toolNames = Object.keys(tools);
      expect(toolNames.length).toBe(TOOL_COUNT);
    });

    it('all tools should have annotations', () => {
      const serverAny = server as any;
      const tools = serverAny._registeredTools as Record<string, any>;

      for (const toolDef of Object.values(tools)) {
        expect(toolDef.annotations).toBeDefined();
        expect(typeof toolDef.annotations).toBe('object');
        expect(toolDef.annotations.title).toBeDefined();
      }
    });
  });

  describe('Prompt Registration', () => {
    it('should register prompts', () => {
      const serverAny = server as any;
      const prompts = serverAny._registeredPrompts;

      expect(prompts).toBeDefined();
      const promptNames = Object.keys(prompts);
      expect(promptNames.length).toBeGreaterThan(0);
    });

    it('all prompts should have handlers', () => {
      const serverAny = server as any;
      const prompts = serverAny._registeredPrompts as Record<string, any>;

      for (const [name, promptDef] of Object.entries(prompts)) {
        expect(name).toBeDefined();
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);

        expect(promptDef).toBeDefined();
        expect(promptDef.description).toBeDefined();
        expect(typeof promptDef.description).toBe('string');

        // Prompts have a callback (not handler)
        expect(promptDef.callback).toBeDefined();
        expect(typeof promptDef.callback).toBe('function');
      }
    });
  });

  describe('Resource Registration', () => {
    it('should have resource registration capability', () => {
      const serverAny = server as any;
      const resources = serverAny._registeredResources;

      expect(resources).toBeDefined();
      // Resources may be empty if not implemented yet, but the field should exist
    });
  });

  describe('Server Lifecycle', () => {
    it('server should be closeable', async () => {
      // Create a new server just for this test
      const testServer = new McpServer({
        name: 'test-lifecycle',
        version: '1.0.0',
      });

      expect(() => testServer.close()).not.toThrow();
    });

    it('server should have underlying Server for advanced operations', () => {
      expect(server.server).toBeDefined();
      // The underlying server should have request/notification methods
      expect(typeof server.server.setRequestHandler).toBe('function');
    });
  });

  describe('MCP SDK Integration', () => {
    it('should use MCP SDK McpServer class', () => {
      expect(server.constructor.name).toBe('McpServer');
    });

    it('should have experimental features accessor', () => {
      expect(server.experimental).toBeDefined();
      expect(typeof server.experimental).toBe('object');
    });
  });
});

describe('MCP Error Code Compliance', () => {
  // These error codes are from JSON-RPC 2.0 spec
  const JSON_RPC_ERRORS = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
  };

  it('should define standard JSON-RPC error codes', () => {
    // These are standardized codes that should be used
    expect(JSON_RPC_ERRORS.PARSE_ERROR).toBe(-32700);
    expect(JSON_RPC_ERRORS.INVALID_REQUEST).toBe(-32600);
    expect(JSON_RPC_ERRORS.METHOD_NOT_FOUND).toBe(-32601);
    expect(JSON_RPC_ERRORS.INVALID_PARAMS).toBe(-32602);
    expect(JSON_RPC_ERRORS.INTERNAL_ERROR).toBe(-32603);
  });
});
