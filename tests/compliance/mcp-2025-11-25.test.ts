/**
 * MCP Protocol 2025-11-25 Compliance Tests
 *
 * Verifies ServalSheets correctly implements the MCP protocol specification.
 * These tests work without live API credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createServalSheetsTestHarness,
  type McpTestHarness,
} from '../helpers/mcp-test-harness.js';
import { TOOL_COUNT, ACTION_COUNT } from '../../src/schemas/index.js';
import { MCP_PROTOCOL_VERSION, VERSION } from '../../src/version.js';

describe('MCP Protocol 2025-11-25 Compliance', () => {
  let harness: McpTestHarness;

  beforeAll(async () => {
    harness = await createServalSheetsTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('Protocol Version', () => {
    it('should use MCP protocol version 2025-11-25', () => {
      expect(MCP_PROTOCOL_VERSION).toBe('2025-11-25');
    });

    it('should have a valid server version', () => {
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('Tool Count Verification', () => {
    it('should have expected tool count defined', () => {
      expect(TOOL_COUNT).toBeGreaterThan(0);
      expect(TOOL_COUNT).toBeLessThanOrEqual(25); // Reasonable upper bound
    });

    it('should have expected action count defined', () => {
      expect(ACTION_COUNT).toBeGreaterThan(0);
      expect(ACTION_COUNT).toBeLessThanOrEqual(300); // Reasonable upper bound
    });
  });

  describe('Tool Call Response Format', () => {
    it('should return structuredContent for tool calls', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      // MCP 2025-11-25 requires structuredContent
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toHaveProperty('response');
    });

    it('should return content array for display', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      // Content array for LLM display
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should have consistent response envelope structure', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      const structured = result.structuredContent as { response: unknown };
      expect(structured).toHaveProperty('response');

      const response = structured.response as { success: boolean };
      expect(response).toHaveProperty('success');
      expect(typeof response.success).toBe('boolean');
    });
  });

  describe('Error Response Format', () => {
    it('should return error response for invalid operations', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_core',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: 'invalid-spreadsheet-id-12345',
          },
        },
      });

      // Should have structuredContent with error
      if (result.structuredContent) {
        const structured = result.structuredContent as {
          response?: { success?: boolean; error?: { code?: string; message?: string } };
        };

        if (structured.response?.success === false) {
          expect(structured.response.error).toBeDefined();
          expect(structured.response.error?.code).toBeDefined();
          expect(structured.response.error?.message).toBeDefined();
        }
      }

      // Content should always be present
      expect(result.content).toBeDefined();
    });

    it('should handle validation errors gracefully', async () => {
      // Call with missing required fields
      const result = await harness.client.callTool({
        name: 'sheets_core',
        arguments: {
          request: {
            // Missing 'action' field
            spreadsheetId: 'test-id',
          },
        },
      });

      // Should return something (error or structured content)
      expect(result.content).toBeDefined();
    });
  });

  describe('Prompts Support', () => {
    it('should support prompts listing', async () => {
      const response = await harness.client.listPrompts();

      expect(response.prompts).toBeDefined();
      expect(Array.isArray(response.prompts)).toBe(true);
    });

    it('should have valid prompt definitions', async () => {
      const response = await harness.client.listPrompts();

      for (const prompt of response.prompts) {
        expect(prompt.name).toBeDefined();
        expect(typeof prompt.name).toBe('string');
      }
    });
  });

  describe('Resources Support', () => {
    it('should support resources listing', async () => {
      const response = await harness.client.listResources();

      expect(response.resources).toBeDefined();
      expect(Array.isArray(response.resources)).toBe(true);
    });
  });
});
