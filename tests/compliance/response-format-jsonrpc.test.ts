/**
 * Response Format Compliance Tests (JSON-RPC)
 *
 * Verifies structuredContent field using direct JSON-RPC requests.
 * The MCP SDK Client doesn't expose structuredContent, so we test at
 * the JSON-RPC protocol level to verify the server sets it correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ServalSheetsServer } from '../../src/server.js';

describe('Response Format Compliance (JSON-RPC)', () => {
  let server: ServalSheetsServer;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeAll(async () => {
    server = new ServalSheetsServer({});
    await server.initialize();

    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.server.connect(serverTransport);
  });

  afterAll(async () => {
    await server.server.close();
    await server.shutdown();
  });

  /**
   * Send a JSON-RPC request and get the raw response
   */
  async function sendJsonRpcRequest(method: string, params: unknown): Promise<unknown> {
    const request = {
      jsonrpc: '2.0',
      id: Math.random().toString(36).substring(7),
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      // Set up response handler
      clientTransport.onmessage = (message: unknown) => {
        clearTimeout(timeout);
        resolve(message);
      };

      clientTransport.onerror = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };

      // Send request
      clientTransport.send(request);
    });
  }

  describe('structuredContent Field', () => {
    it('should include structuredContent in tools/call response', async () => {
      const response = (await sendJsonRpcRequest('tools/call', {
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      })) as {
        jsonrpc: string;
        id: string;
        result?: {
          content: Array<{ type: string; text: string }>;
          structuredContent?: unknown;
          isError?: boolean;
        };
      };

      expect(response.result).toBeDefined();
      expect(response.result?.structuredContent).toBeDefined();
    });

    it('should have response wrapper in structuredContent', async () => {
      const response = (await sendJsonRpcRequest('tools/call', {
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      })) as {
        result?: {
          structuredContent?: {
            response?: { success?: boolean };
          };
        };
      };

      expect(response.result?.structuredContent).toBeDefined();

      const structured = response.result?.structuredContent as {
        response?: { success?: boolean };
      };

      expect(structured.response).toBeDefined();
    });

    it('should have success boolean in structuredContent.response', async () => {
      const response = (await sendJsonRpcRequest('tools/call', {
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      })) as {
        result?: {
          structuredContent?: {
            response: { success: boolean };
          };
        };
      };

      const structured = response.result?.structuredContent as {
        response: { success: boolean };
      };

      expect(typeof structured.response.success).toBe('boolean');
    });

    it('should include action name in structuredContent.response', async () => {
      const response = (await sendJsonRpcRequest('tools/call', {
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      })) as {
        result?: {
          structuredContent?: {
            response: { action?: string };
          };
        };
      };

      const structured = response.result?.structuredContent as {
        response: { action?: string };
      };

      expect(structured.response.action).toBe('status');
    });

    it('should return consistent structuredContent format across multiple calls', async () => {
      const responses = await Promise.all([
        sendJsonRpcRequest('tools/call', {
          name: 'sheets_auth',
          arguments: { request: { action: 'status' } },
        }),
        sendJsonRpcRequest('tools/call', {
          name: 'sheets_auth',
          arguments: { request: { action: 'status' } },
        }),
      ]);

      for (const response of responses) {
        const result = (
          response as {
            result?: {
              structuredContent?: {
                response: { success: boolean; action: string };
              };
            };
          }
        ).result;

        expect(result?.structuredContent).toBeDefined();

        const structured = result?.structuredContent as {
          response: { success: boolean; action: string };
        };

        expect(structured.response.success).toBeDefined();
        expect(structured.response.action).toBe('status');
      }
    });
  });

  describe('Content and structuredContent Alignment', () => {
    it('should have both content and structuredContent fields', async () => {
      const response = (await sendJsonRpcRequest('tools/call', {
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      })) as {
        result?: {
          content: Array<{ type: string; text: string }>;
          structuredContent?: unknown;
        };
      };

      expect(response.result?.content).toBeDefined();
      expect(Array.isArray(response.result?.content)).toBe(true);
      expect(response.result?.structuredContent).toBeDefined();
    });

    it('should have parseable JSON in content[0].text that matches structuredContent', async () => {
      const response = (await sendJsonRpcRequest('tools/call', {
        name: 'sheets_auth',
        arguments: {
          request: { action: 'status' },
        },
      })) as {
        result?: {
          content: Array<{ type: string; text: string }>;
          structuredContent?: {
            response: { success: boolean; action: string };
          };
        };
      };

      const textContent = response.result?.content.find((c) => c.type === 'text');
      expect(textContent).toBeDefined();

      // Parse JSON from text content
      const parsedText = JSON.parse(textContent!.text);

      // Compare with structuredContent
      expect(parsedText).toEqual(response.result?.structuredContent);
    });
  });

  describe('Error Response structuredContent', () => {
    it('should include structuredContent with success=false for errors', async () => {
      const response = (await sendJsonRpcRequest('tools/call', {
        name: 'sheets_core',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: 'invalid-id-12345',
          },
        },
      })) as {
        result?: {
          structuredContent?: {
            response: { success: boolean; error?: { code: string } };
          };
        };
      };

      const structured = response.result?.structuredContent as {
        response: { success: boolean; error?: { code: string } };
      };

      expect(structured.response.success).toBe(false);
      expect(structured.response.error).toBeDefined();
      expect(structured.response.error?.code).toBeDefined();
    });

    it('should not set isError=true for non-retryable errors', async () => {
      const response = (await sendJsonRpcRequest('tools/call', {
        name: 'sheets_core',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: 'invalid-id-12345',
          },
        },
      })) as {
        result?: {
          isError?: boolean;
          structuredContent?: {
            response: { success: boolean };
          };
        };
      };

      // Non-retryable errors should have success=false but NOT isError=true
      const structured = response.result?.structuredContent as {
        response: { success: boolean };
      };

      expect(structured.response.success).toBe(false);
      // isError should be undefined or false (not true)
      expect(response.result?.isError).not.toBe(true);
    });
  });
});
