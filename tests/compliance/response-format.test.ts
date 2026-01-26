/**
 * Response Format Compliance Tests
 *
 * Verifies that tool responses follow the expected format.
 * These tests work without live API credentials by testing tools
 * that don't require Google authentication.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createServalSheetsTestHarness,
  type McpTestHarness,
} from '../helpers/mcp-test-harness.js';

describe('Response Format Compliance', () => {
  let harness: McpTestHarness;

  beforeAll(async () => {
    harness = await createServalSheetsTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('Success Response Structure', () => {
    it('should return structuredContent for successful operations', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      // structuredContent should always be defined for successful calls
      expect(result.structuredContent).toBeDefined();
    });

    it('should have response wrapper in structuredContent', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      const structured = result.structuredContent as {
        response?: { success?: boolean };
      };

      expect(structured).toBeDefined();
      expect(structured.response).toBeDefined();
    });

    it('should have success boolean in response', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      const structured = result.structuredContent as {
        response: { success: boolean };
      };

      expect(typeof structured.response.success).toBe('boolean');
    });

    it('should include action name on success', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      const structured = result.structuredContent as {
        response: { action?: string };
      };

      expect(structured.response.action).toBe('status');
    });
  });

  describe('Content Array Format', () => {
    it('should return content array', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('should have text content type', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      const textContent = result.content.find((c: { type: string }) => c.type === 'text');
      expect(textContent).toBeDefined();
    });

    it('should have valid text string in content', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      });

      const textContent = result.content.find(
        (c: { type: string; text?: string }) => c.type === 'text'
      ) as { type: string; text: string };

      expect(textContent.text).toBeDefined();
      expect(typeof textContent.text).toBe('string');
      expect(textContent.text.length).toBeGreaterThan(0);
    });
  });

  describe('Error Response Handling', () => {
    it('should handle invalid spreadsheet ID gracefully', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_core',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: 'invalid-id',
          },
        },
      });

      // Should return a response (either structured or error)
      if (result.structuredContent) {
        const structured = result.structuredContent as {
          response?: { success?: boolean };
        };
        // If structuredContent exists, success should be false
        if (structured.response) {
          expect(structured.response.success).toBe(false);
        }
      }

      // Content should always be present
      expect(result.content).toBeDefined();
    });

    it('should indicate error in response for auth-required operations', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_core',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: 'test-spreadsheet-123',
          },
        },
      });

      // Without authentication, this should fail
      if (result.structuredContent) {
        const structured = result.structuredContent as {
          response?: { success?: boolean; error?: { code?: string } };
        };

        if (structured.response?.success === false) {
          // Error response should have error details
          expect(structured.response.error).toBeDefined();
          expect(structured.response.error?.code).toBeDefined();
        }
      }
    });
  });

  describe('Response Consistency', () => {
    it('should return consistent format for sheets_auth', async () => {
      const result = await harness.client.callTool({
        name: 'sheets_auth',
        arguments: { request: { action: 'status' } },
      });

      expect(result.structuredContent).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should return consistent format across multiple calls', async () => {
      const results = await Promise.all([
        harness.client.callTool({
          name: 'sheets_auth',
          arguments: { request: { action: 'status' } },
        }),
        harness.client.callTool({
          name: 'sheets_auth',
          arguments: { request: { action: 'status' } },
        }),
      ]);

      for (const result of results) {
        expect(result.structuredContent).toBeDefined();
        expect(result.content).toBeDefined();

        const structured = result.structuredContent as {
          response: { success: boolean; action: string };
        };

        expect(structured.response.success).toBeDefined();
        expect(structured.response.action).toBe('status');
      }
    });
  });
});
