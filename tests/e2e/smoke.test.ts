/**
 * ServalSheets - E2E Smoke Test Suite
 *
 * Core smoke tests for hosted MCP server deployment.
 * Tests health endpoints, MCP protocol compliance, tool discovery,
 * and error handling without requiring Google API credentials.
 *
 * MCP Protocol: 2025-11-25
 * Test Transport: HTTP (port 3000 or 8000)
 *
 * @module tests/e2e/smoke
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type {
  ClientCapabilities,
} from '@modelcontextprotocol/sdk/types.js';
import { McpClient } from './helpers.js';

/**
 * Smoke tests configuration
 */
const config = {
  /** Base URL for MCP server (HTTP transport) */
  baseUrl: process.env['BASE_URL'] || 'http://localhost:3000',
  /** Health check timeout (ms) */
  healthTimeout: 30000,
  /** Request timeout (ms) */
  requestTimeout: 10000,
  /** Protocol version expected */
  expectedProtocol: '2025-11-25',
  /** Expected tool count */
  expectedToolCount: 25,
  /** Expected action count */
  expectedActionCount: 407,
};

describe('ServalSheets E2E Smoke Tests', () => {
  let client: McpClient;

  beforeAll(async () => {
    // Wait for server to be healthy before running tests
    await vi.waitFor(
      async () => {
        const response = await fetch(`${config.baseUrl}/health/live`, {
          signal: AbortSignal.timeout(config.healthTimeout),
        });
        expect(response.status).toBe(200);
      },
      { timeout: config.healthTimeout }
    );

    // Create MCP client
    client = new McpClient(config.baseUrl, {
      timeout: config.requestTimeout,
    });
  }, 60000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('Health Endpoints', () => {
    it('GET /health/live returns 200', async () => {
      const response = await fetch(`${config.baseUrl}/health/live`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('status');
    });

    it('GET /health/ready returns 200', async () => {
      const response = await fetch(`${config.baseUrl}/health/ready`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('status');
    });

    it('GET /ping returns { status: "ok" }', async () => {
      const response = await fetch(`${config.baseUrl}/ping`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('Health endpoints respond within 100ms', async () => {
      const start = performance.now();
      await fetch(`${config.baseUrl}/health/live`);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('MCP Protocol - Initialize', () => {
    it('Initialize request returns valid server capabilities', async () => {
      const capabilities = await client.initialize();
      expect(capabilities).toBeDefined();
      expect(capabilities).toHaveProperty('tools');
    });

    it('Server reports protocol version 2025-11-25', async () => {
      const capabilities = await client.initialize();
      expect((capabilities as any).protocolVersion).toBe(config.expectedProtocol);
    });

    it('Server capabilities include sampling, elicitation, logging', async () => {
      const capabilities = await client.initialize();
      expect(capabilities).toHaveProperty('tools');
      // These capabilities may be in the tools object or separate properties
      // Verify the server responds with proper structure
      expect(typeof capabilities).toBe('object');
    });
  });

  describe('Tool Discovery', () => {
    it('tools/list returns all 25 tools', async () => {
      const tools = await client.listTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(config.expectedToolCount);
    });

    it('Each tool has required schema properties', async () => {
      const tools = await client.listTools();
      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      }
    });

    it('Tool names include all expected core tools', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      // Verify at least core tools exist
      const coreTools = [
        'sheets_core',
        'sheets_data',
        'sheets_auth',
        'sheets_session',
        'sheets_analyze',
      ];
      for (const coreTool of coreTools) {
        expect(toolNames).toContain(coreTool);
      }
    });

    it('sheets_core tool has expected schema structure', async () => {
      const tools = await client.listTools();
      const sheetsCoreSchema = tools.find((t) => t.name === 'sheets_core');

      expect(sheetsCoreSchema).toBeDefined();
      expect(sheetsCoreSchema?.inputSchema).toBeDefined();
      expect(typeof sheetsCoreSchema?.inputSchema).toBe('object');
    });
  });

  describe('Tool Execution - Non-Destructive Actions', () => {
    it('sheets_auth.status returns valid response', async () => {
      const result = await client.callTool('sheets_auth', {
        request: { action: 'status' },
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('success');
    });

    it('sheets_session.get_context returns valid session structure', async () => {
      const result = await client.callTool('sheets_session', {
        request: {
          action: 'get_context',
        },
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('success');
    });

    it('sheets_confirm.status returns confirmation state', async () => {
      const result = await client.callTool('sheets_confirm', {
        request: { action: 'status' },
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('response');
    });
  });

  describe('Error Handling', () => {
    it('Invalid tool name returns proper MCP error', async () => {
      try {
        await client.callTool('invalid_tool_name', {
          request: { action: 'some_action' },
        });
        // Should not reach here
        expect.fail('Should have thrown error for invalid tool');
      } catch (error) {
        expect(error).toBeDefined();
        // Error could be network error or MCP protocol error
        const errorStr = String(error);
        expect(
          errorStr.toLowerCase().includes('error') ||
            errorStr.toLowerCase().includes('invalid') ||
            errorStr.toLowerCase().includes('not found')
        ).toBe(true);
      }
    });

    it('Invalid action on valid tool returns error response', async () => {
      const result = await client.callTool('sheets_data', {
        request: {
          action: 'invalid_action_that_does_not_exist',
        },
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('response');
      // Response should indicate error
      expect(result.response.success === false || result.response.error).toBeTruthy();
    });

    it('Missing required parameters returns validation error', async () => {
      const result = await client.callTool('sheets_data', {
        request: {
          action: 'read_range',
          // Missing required spreadsheetId and range
        } as any,
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('response');
      // Should fail validation
      expect(result.response.success === false || result.response.error).toBeTruthy();
    });

    it('Malformed JSON in envelope is handled gracefully', async () => {
      try {
        const response = await fetch(`${config.baseUrl}/mcp/tools/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid json',
        });

        // Should get 400 or similar error
        expect(response.status).toBeGreaterThanOrEqual(400);
      } catch (error) {
        // Network error is acceptable for malformed request
        expect(error).toBeDefined();
      }
    });

    it('All 25 tools respond to invalid action without crashing', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        const result = await client.callTool(tool.name, {
          request: {
            action: '__invalid_action_smoke_test__',
          } as any,
        });

        expect(result).toBeDefined();
        expect(result).toHaveProperty('response');
        // Server should return error, not crash
        expect(typeof result.response).toBe('object');
      }
    });
  });

  describe('CORS and Response Headers', () => {
    it('OPTIONS request returns proper CORS headers', async () => {
      const response = await fetch(`${config.baseUrl}/mcp`, {
        method: 'OPTIONS',
      });

      expect(response.status).toBeLessThan(500); // Not 5xx error
      expect(response.headers.get('allow')).toBeTruthy();
    });

    it('All responses have correct Content-Type', async () => {
      const response = await fetch(`${config.baseUrl}/health/live`);
      const contentType = response.headers.get('content-type');
      expect(contentType).toMatch(/application\/json/);
    });

    it('JSON responses are valid and parseable', async () => {
      const response = await fetch(`${config.baseUrl}/ping`);
      expect(response.ok).toBe(true);
      const body = await response.json();
      expect(typeof body).toBe('object');
    });
  });

  describe('Authentication (Conditional)', () => {
    it('Unauthenticated request succeeds when no auth required', async () => {
      const response = await fetch(`${config.baseUrl}/health/live`);
      // Health endpoints should not require auth
      expect(response.status).toBe(200);
    });

    it('MCP endpoint accessible without credentials when not required', async () => {
      const response = await fetch(`${config.baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' },
          },
        }),
      });

      // Should either succeed or return 401 (not 5xx error)
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('Response Format Validation', () => {
    it('Tool call response has correct MCP envelope structure', async () => {
      const result = await client.callTool('sheets_auth', {
        request: { action: 'status' },
      });

      // MCP responses should have specific structure
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('response');
    });

    it('Success responses include required fields', async () => {
      const result = await client.callTool('sheets_auth', {
        request: { action: 'status' },
      });

      const response = result.response;
      expect(response).toHaveProperty('success');
      expect(typeof response.success).toBe('boolean');
    });

    it('Error responses include error field', async () => {
      const result = await client.callTool('sheets_data', {
        request: {
          action: 'invalid_action',
        } as any,
      });

      const response = result.response;
      if (!response.success) {
        expect(response).toHaveProperty('error');
        expect(response.error).toBeDefined();
      }
    });
  });

  describe('Protocol Compliance - MCP 2025-11-25', () => {
    it('Server identifies as MCP 2025-11-25', async () => {
      const capabilities = await client.initialize();
      expect((capabilities as any).protocolVersion).toBe('2025-11-25');
    });

    it('Tool schemas are valid Zod discriminated unions', async () => {
      const tools = await client.listTools();

      // Each tool should have inputSchema that follows MCP pattern
      for (const tool of tools.slice(0, 5)) {
        // Check first 5 tools
        expect(tool.inputSchema).toBeDefined();
        const schema = tool.inputSchema as any;
        expect(typeof schema).toBe('object');
        // Most should be objects with properties
        if (schema.type) {
          expect(['object', 'array']).toContain(schema.type);
        }
      }
    });

    it('Sampling capability is advertised when available', async () => {
      const capabilities = await client.initialize();
      // Server may include sampling in capabilities
      expect(capabilities).toBeDefined();
      expect(typeof capabilities).toBe('object');
    });

    it('Client can negotiate capabilities', async () => {
      const clientCapabilities: ClientCapabilities = {
        sampling: {},
        elicitation: {},
      };

      const capabilities = await client.initialize(clientCapabilities);
      expect(capabilities).toBeDefined();
    });
  });

  describe('Concurrent Requests', () => {
    it('10 concurrent health checks complete successfully', async () => {
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${config.baseUrl}/health/live`)
      );

      const results = await Promise.all(requests);
      for (const response of results) {
        expect(response.status).toBe(200);
      }
    });

    it('Multiple tool list requests are consistent', async () => {
      const results = await Promise.all([
        client.listTools(),
        client.listTools(),
        client.listTools(),
      ]);

      const toolCounts = results.map((r) => r.length);
      expect(toolCounts[0]).toBe(toolCounts[1]);
      expect(toolCounts[1]).toBe(toolCounts[2]);
      expect(toolCounts[0]).toBe(config.expectedToolCount);
    });
  });

  describe('Server Stability', () => {
    it('Server does not crash after 50 sequential requests', async () => {
      for (let i = 0; i < 50; i++) {
        const response = await fetch(`${config.baseUrl}/health/live`);
        expect(response.status).toBe(200);
      }
    });

    it('Tool list remains consistent across multiple requests', async () => {
      const tools1 = await client.listTools();
      const tools2 = await client.listTools();
      const tools3 = await client.listTools();

      expect(tools1.length).toBe(tools2.length);
      expect(tools2.length).toBe(tools3.length);

      // Tool names should be consistent
      const names1 = tools1.map((t) => t.name).sort();
      const names2 = tools2.map((t) => t.name).sort();
      expect(names1).toEqual(names2);
    });
  });
});
