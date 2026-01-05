/**
 * MCP Protocol tools/list Runtime Test
 *
 * Tests the actual MCP server's tools/list response to verify that:
 * 1. All 15 tools are returned
 * 2. Each tool has non-empty input schemas
 * 3. Schemas are valid JSON Schema (not Zod objects)
 * 4. No Zod artifacts (parse, safeParseAsync, etc.) are present
 *
 * This catches runtime issues where schemas might be registered incorrectly
 * despite passing unit tests.
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { TOOL_COUNT } from '../../src/schemas/index.js';

describe('MCP Protocol tools/list', () => {
  const collectResponse = (child: ReturnType<typeof spawn>, id: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      let buffer = '';

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const json = JSON.parse(line);
            if (json.id === id) {
              cleanup();
              resolve(json);
              child.kill();
              return;
            }
          } catch {
            // Ignore non-JSON log lines
          }
        }
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      const timeout = setTimeout(() => {
        cleanup();
        child.kill();
        reject(new Error('Server response timeout'));
      }, 10000);

      const cleanup = () => {
        clearTimeout(timeout);
        child.stdout.off('data', onData);
        child.off('error', onError);
      };

      child.stdout.on('data', onData);
      child.on('error', onError);
    });
  };

  const createJsonRpcHarness = (child: ReturnType<typeof spawn>) => {
    let buffer = '';
    const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line);
          const id = json?.id;
          if (typeof id === 'number' && pending.has(id)) {
            const entry = pending.get(id);
            if (entry) {
              pending.delete(id);
              entry.resolve(json);
            }
          }
        } catch {
          // Ignore non-JSON log lines
        }
      }
    };

    const onError = (err: Error) => {
      for (const entry of pending.values()) {
        entry.reject(err);
      }
      pending.clear();
    };

    child.stdout.on('data', onData);
    child.on('error', onError);

    const request = (payload: Record<string, unknown>, timeoutMs = 10000): Promise<any> => {
      const id = payload['id'];
      if (typeof id !== 'number') {
        return Promise.reject(new Error('Request payload must include numeric id'));
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error('Server response timeout'));
        }, timeoutMs);

        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });

        child.stdin.write(JSON.stringify(payload) + '\n');
      });
    };

    const notify = (payload: Record<string, unknown>) => {
      child.stdin.write(JSON.stringify(payload) + '\n');
    };

    const cleanup = () => {
      child.stdout.off('data', onData);
      child.off('error', onError);
    };

    return { request, notify, cleanup };
  };

  it('should return all 15 tools with non-empty schemas', async () => {
    // Spawn the MCP server as a child process
    const child = spawn('node', ['dist/cli.js']);

    // Send initialize + tools/list requests
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    }) + '\n' + JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    }) + '\n';

    child.stdin.write(request);
    child.stdin.end();

    const parsed = await collectResponse(child, 2);

    expect(parsed).toBeDefined();
    expect(parsed.result).toBeDefined();
    expect(parsed.result.tools).toBeDefined();

    // Verify tool count
    expect(parsed.result.tools).toHaveLength(TOOL_COUNT);
    expect(parsed.result.tools).toHaveLength(15);

    // Verify each tool
    for (const tool of parsed.result.tools) {
      // Tool must have a name
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name).toMatch(/^sheets_/);

      // Tool must have a description
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');

      // Input schema must exist
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe('object');

      // Schema should NOT be empty
      expect(tool.inputSchema.type).toBe('object');

      // Should have properties OR oneOf (not an empty schema)
      const hasProperties = tool.inputSchema.properties &&
                          typeof tool.inputSchema.properties === 'object' &&
                          Object.keys(tool.inputSchema.properties).length > 0;

      const hasOneOf = Array.isArray(tool.inputSchema.oneOf) &&
                      tool.inputSchema.oneOf.length > 0;

      expect(hasProperties || hasOneOf).toBe(true);

      // CRITICAL: Must NOT have Zod methods
      // If these exist, the schema wasn't properly transformed and will cause
      // "v3Schema.safeParseAsync is not a function" errors
      expect(tool.inputSchema.parse).toBeUndefined();
      expect(tool.inputSchema.safeParse).toBeUndefined();
      expect(tool.inputSchema.parseAsync).toBeUndefined();
      expect(tool.inputSchema.safeParseAsync).toBeUndefined();
      expect(tool.inputSchema._def).toBeUndefined();
      expect(tool.inputSchema._type).toBeUndefined();
    }

  }, 15000); // 15 second timeout for this test

  it('should handle tool invocation without safeParseAsync errors', async () => {
    // Spawn the MCP server as a child process
    const child = spawn('node', ['dist/cli.js']);
    let stderrHandler: ((chunk: Buffer) => void) | undefined;
    const stderrPromise = new Promise<never>((_, reject) => {
      stderrHandler = (chunk: Buffer) => {
        const stderr = chunk.toString();
        if (stderr.includes('safeParseAsync is not a function')) {
          reject(new Error('Found safeParseAsync error in stderr: ' + stderr));
        }
      };
      child.stderr.on('data', stderrHandler);
    });

    // Initialize then invoke a tool (will fail due to no credentials, but shouldn't crash)
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
    }) + '\n' + JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'sheets_spreadsheet',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: 'test-id'
          }
        }
      }
    }) + '\n';

    child.stdin.write(request);
    child.stdin.end();

    let parsed: any;
    try {
      parsed = await Promise.race([collectResponse(child, 2), stderrPromise]);
    } finally {
      if (stderrHandler) {
        child.stderr.off('data', stderrHandler);
      }
    }

    expect(parsed).toBeDefined();

    // Should get either an error result (no credentials) or success
    // But NOT a JSON-RPC error about safeParseAsync
    if (parsed.error) {
      // If there's a JSON-RPC error, it should be about credentials or params, not schema validation
      expect(parsed.error.message).not.toContain('safeParseAsync');
      expect(parsed.error.message).not.toContain('is not a function');
    }

  }, 15000);

  it('should support task-augmented tools/call', async () => {
    const child = spawn('node', ['dist/cli.js']);
    const rpc = createJsonRpcHarness(child);

    try {
      const init = await rpc.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {
            tasks: {
              list: {},
              cancel: {},
              requests: {
                tools: {
                  call: {},
                },
              },
            },
          },
          clientInfo: {
            name: 'task-test-client',
            version: '1.0.0',
          },
        },
      });

      expect(init.result?.capabilities?.tasks).toBeDefined();

      rpc.notify({
        jsonrpc: '2.0',
        method: 'initialized',
        params: {},
      });

      const call = await rpc.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'sheets_values',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: 'test-id',
              range: { a1: 'Sheet1!A1:B2' },
            },
          },
          task: { ttl: 60000 },
        },
      });

      const taskId = call.result?.task?.taskId as string | undefined;
      expect(taskId).toBeDefined();
      expect(call.result?.task?.status).toBe('working');

      const deadline = Date.now() + 10000;
      let taskResult: any;
      let requestId = 3;

      while (Date.now() < deadline) {
        taskResult = await rpc.request({
          jsonrpc: '2.0',
          id: requestId++,
          method: 'tasks/result',
          params: { taskId },
        });

        if (taskResult?.result?.structuredContent) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(taskResult?.result).toBeDefined();
      expect(taskResult.result?.isError).toBe(true);
      expect(taskResult.result?.structuredContent?.response?.success).toBe(false);
      expect(taskResult.result?.structuredContent?.response?.error?.message)
        .toContain('Google API client not initialized');
    } finally {
      rpc.cleanup();
      child.kill();
    }
  }, 20000);
});
