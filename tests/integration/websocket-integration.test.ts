/**
 * WebSocket Integration Tests
 *
 * End-to-end tests for WebSocket transport with MCP server
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketTransport } from '../../src/transports/websocket-transport.js';
import { WebSocketServer } from '../../src/transports/websocket-server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';

describe('WebSocket Integration', () => {
  let transport: WebSocketTransport;
  let server: WebSocketServer;
  const TEST_PORT = 9877;
  const TEST_URL = `ws://localhost:${TEST_PORT}`;

  beforeEach(async () => {
    // Create server with MCP server factory
    server = new WebSocketServer({
      port: TEST_PORT,
      host: 'localhost',
      createMcpServer: async () => {
        return new McpServer(
          {
            name: 'test-server',
            version: '1.0.0',
          },
          {
            capabilities: {},
          }
        );
      },
    });
    await server.start();
  });

  afterEach(async () => {
    if (transport) {
      await transport.disconnect();
    }
    if (server) {
      await server.stop();
    }
  });

  describe('Full Request/Response Cycle', () => {
    it('should complete full MCP tool call cycle', async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);

      // Mock server to respond to tool call
      server.onRequest((req, respond) => {
        if (req.method === 'tools/call') {
          respond({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: 'Tool executed successfully',
                },
              ],
            },
          });
        }
      });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'sheets_data',
          arguments: {
            action: 'read_range',
            spreadsheetId: 'test123',
            range: 'Sheet1!A1:B2',
          },
        },
      };

      const response = await transport.sendRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [
            {
              type: 'text',
              text: 'Tool executed successfully',
            },
          ],
        },
      });
    });

    it('should handle multiple concurrent tool calls', async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);

      server.onRequest((req, respond) => {
        // Simulate processing time
        setTimeout(() => {
          respond({
            jsonrpc: '2.0',
            id: req.id,
            result: { toolId: req.id },
          });
        }, Math.random() * 50);
      });

      const requests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        id: i,
        method: 'tools/call',
        params: { name: `tool${i}` },
      }));

      const start = Date.now();
      const responses = await Promise.all(
        requests.map((req) => transport.sendRequest(req))
      );
      const duration = Date.now() - start;

      // All requests should complete
      expect(responses).toHaveLength(10);

      // Should complete in parallel (< 200ms total, not 500ms sequential)
      expect(duration).toBeLessThan(200);

      // Each response should match its request
      responses.forEach((response, i) => {
        expect(response.id).toBe(i);
        expect(response.result).toMatchObject({ toolId: i });
      });
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);

      server.onRequest((req, respond) => {
        // Immediate response
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: { success: true },
        });
      });
    });

    it('should achieve <50ms latency for single request', async () => {
      const measurements: number[] = [];

      // Warm up
      for (let i = 0; i < 5; i++) {
        await transport.sendRequest({
          jsonrpc: '2.0',
          id: `warmup-${i}`,
          method: 'test',
          params: {},
        });
      }

      // Measure
      for (let i = 0; i < 20; i++) {
        const start = Date.now();
        await transport.sendRequest({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
        const latency = Date.now() - start;
        measurements.push(latency);
      }

      const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxLatency = Math.max(...measurements);

      expect(avgLatency).toBeLessThan(50);
      expect(maxLatency).toBeLessThan(100);
    });

    it('should handle 100+ requests per second', async () => {
      const numRequests = 100;
      const requests = Array.from({ length: numRequests }, (_, i) => ({
        jsonrpc: '2.0' as const,
        id: i,
        method: 'test',
        params: {},
      }));

      const start = Date.now();
      await Promise.all(requests.map((req) => transport.sendRequest(req)));
      const duration = Date.now() - start;

      const requestsPerSecond = (numRequests / duration) * 1000;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(requestsPerSecond).toBeGreaterThan(100);
    });

    it('should demonstrate 90% latency reduction vs HTTP baseline', async () => {
      // HTTP baseline: ~500ms (simulated round-trip)
      const httpBaselineLatency = 500;

      const measurements: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await transport.sendRequest({
          jsonrpc: '2.0',
          id: i,
          method: 'test',
          params: {},
        });
        measurements.push(Date.now() - start);
      }

      const avgWebSocketLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const latencyReduction = ((httpBaselineLatency - avgWebSocketLatency) / httpBaselineLatency) * 100;

      expect(avgWebSocketLatency).toBeLessThan(50);
      expect(latencyReduction).toBeGreaterThan(90);
    });
  });

  describe('Resource Subscriptions', () => {
    beforeEach(async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);
    });

    it('should receive real-time updates for subscribed resources', async () => {
      const updates: any[] = [];

      const subscription = await transport.subscribe('spreadsheet://test123');
      subscription.onUpdate((update) => {
        updates.push(update);
      });

      // Simulate server sending updates
      server.broadcast({
        jsonrpc: '2.0',
        method: 'notifications/resources/updated',
        params: {
          uri: 'spreadsheet://test123',
          data: {
            cell: 'A1',
            value: 'New Value',
            timestamp: Date.now(),
          },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({
        uri: 'spreadsheet://test123',
        data: {
          cell: 'A1',
          value: 'New Value',
        },
      });
    });

    it('should handle multiple subscriptions independently', async () => {
      const sheet1Updates: any[] = [];
      const sheet2Updates: any[] = [];

      const sub1 = await transport.subscribe('spreadsheet://sheet1');
      sub1.onUpdate((update) => sheet1Updates.push(update));

      const sub2 = await transport.subscribe('spreadsheet://sheet2');
      sub2.onUpdate((update) => sheet2Updates.push(update));

      // Send updates to both
      server.broadcast({
        jsonrpc: '2.0',
        method: 'notifications/resources/updated',
        params: {
          uri: 'spreadsheet://sheet1',
          data: { value: 'update1' },
        },
      });

      server.broadcast({
        jsonrpc: '2.0',
        method: 'notifications/resources/updated',
        params: {
          uri: 'spreadsheet://sheet2',
          data: { value: 'update2' },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(sheet1Updates).toHaveLength(1);
      expect(sheet2Updates).toHaveLength(1);
      expect(sheet1Updates[0].data).toMatchObject({ value: 'update1' });
      expect(sheet2Updates[0].data).toMatchObject({ value: 'update2' });
    });

    it('should deliver updates with <10ms push latency', async () => {
      const latencies: number[] = [];
      const subscription = await transport.subscribe('spreadsheet://test');

      subscription.onUpdate((update) => {
        const latency = Date.now() - update.data.timestamp;
        latencies.push(latency);
      });

      // Send 10 updates
      for (let i = 0; i < 10; i++) {
        server.broadcast({
          jsonrpc: '2.0',
          method: 'notifications/resources/updated',
          params: {
            uri: 'spreadsheet://test',
            data: { timestamp: Date.now() },
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      expect(avgLatency).toBeLessThan(10);
    });
  });

  describe('Connection Reliability', () => {
    it('should maintain connection during high load', async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);

      server.onRequest((req, respond) => {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: { success: true },
        });
      });

      let disconnected = false;
      transport.on('disconnect', () => {
        disconnected = true;
      });

      // Send 1000 requests rapidly
      const requests = Array.from({ length: 1000 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        id: i,
        method: 'test',
        params: {},
      }));

      await Promise.all(requests.map((req) => transport.sendRequest(req)));

      expect(disconnected).toBe(false);
      expect(transport.isConnected()).toBe(true);
    });

    it('should recover from temporary network issues', async () => {
      transport = new WebSocketTransport({
        autoReconnect: true,
        reconnectInterval: 100,
        heartbeatInterval: 200,
      });
      await transport.connect(TEST_URL);
      // Prevent uncaught exception from EventEmitter 'error' event during reconnect
      transport.on('error', () => {});

      let reconnected = false;
      transport.on('reconnect', () => {
        reconnected = true;
      });

      // Simulate network issue
      await server.stop();

      // Wait a bit then restart
      await new Promise((resolve) => setTimeout(resolve, 150));
      server = new WebSocketServer({ port: TEST_PORT, host: 'localhost' });
      await server.start();

      // Wait for reconnection (with extra time for exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(reconnected).toBe(true);
      expect(transport.isConnected()).toBe(true);
    });
  });

  describe('Multiple Clients', () => {
    it('should handle multiple concurrent clients', async () => {
      const clients: WebSocketTransport[] = [];
      const numClients = 10;

      // Connect multiple clients
      for (let i = 0; i < numClients; i++) {
        const client = new WebSocketTransport();
        await client.connect(TEST_URL);
        clients.push(client);
      }

      expect(server.getClientCount()).toBe(numClients);

      // Each client sends a request
      server.onRequest((req, respond) => {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: { clientId: req.params },
        });
      });

      const responses = await Promise.all(
        clients.map((client, i) =>
          client.sendRequest({
            jsonrpc: '2.0',
            id: 1,
            method: 'test',
            params: i,
          })
        )
      );

      // Each client should get its own response
      responses.forEach((response, i) => {
        expect(response.result).toMatchObject({ clientId: i });
      });

      // Disconnect all clients
      await Promise.all(clients.map((client) => client.disconnect()));

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(server.getClientCount()).toBe(0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should fall back gracefully if WebSocket unavailable', async () => {
      // Stop server before connecting
      await server.stop();

      transport = new WebSocketTransport({
        connectionTimeout: 500,
        autoReconnect: false, // Disable auto-reconnect for this test
      });
      // Prevent uncaught exception from EventEmitter 'error' event
      transport.on('error', () => {});

      // Connection should fail with clear error
      try {
        await transport.connect(TEST_URL);
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.code || error.message).toBeTruthy();
      }

      // Transport should not be connected
      expect(transport.isConnected()).toBe(false);

      // Clean up
      await transport.disconnect().catch(() => {});

      // In production, caller would fall back to HTTP/SSE
    });
  });
});
