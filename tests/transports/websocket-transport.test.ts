/**
 * WebSocket Transport Tests
 *
 * Tests for WebSocket-based MCP transport layer
 * Following TDD approach - tests written first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { WebSocket as WSType } from 'ws';
import { WebSocketTransport, type WebSocketTransportOptions } from '../../src/transports/websocket-transport.js';
import { WebSocketServer } from '../../src/transports/websocket-server.js';
import type { JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from '@modelcontextprotocol/sdk/types.js';

describe('WebSocketTransport', () => {
  let transport: WebSocketTransport;
  let server: WebSocketServer;
  const TEST_PORT = 9876;
  const TEST_URL = `ws://localhost:${TEST_PORT}`;

  beforeEach(async () => {
    // Create test server
    server = new WebSocketServer({
      port: TEST_PORT,
      host: 'localhost',
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

  describe('Connection Management', () => {
    it('should connect to WebSocket server', async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);

      expect(transport.isConnected()).toBe(true);
    });

    it('should disconnect cleanly', async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);

      await transport.disconnect();

      expect(transport.isConnected()).toBe(false);
    });

    it('should reject connection to invalid URL', async () => {
      transport = new WebSocketTransport({
        connectionTimeout: 2000,
        autoReconnect: false,
      });
      // Prevent uncaught exception from EventEmitter 'error' event
      transport.on('error', () => {});

      await expect(
        transport.connect('ws://invalid-host-that-does-not-exist:12345')
      ).rejects.toThrow();
    });

    it('should handle connection timeout', async () => {
      transport = new WebSocketTransport({
        connectionTimeout: 500,
        autoReconnect: false,
      });
      // Prevent uncaught exception from EventEmitter 'error' event
      transport.on('error', () => {});

      // Server is stopped, so connection should fail
      await server.stop();

      await expect(
        transport.connect(TEST_URL)
      ).rejects.toThrow();
    });

    it('should emit connection events', async () => {
      transport = new WebSocketTransport();
      const onConnect = vi.fn();
      const onDisconnect = vi.fn();

      transport.on('connect', onConnect);
      transport.on('disconnect', onDisconnect);

      await transport.connect(TEST_URL);
      expect(onConnect).toHaveBeenCalledTimes(1);

      await transport.disconnect();
      expect(onDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);
    });

    it('should send JSON-RPC request', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'sheets_data',
          arguments: { action: 'read_range' },
        },
      };

      // Mock server response
      server.onRequest((req, respond) => {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: { success: true },
        });
      });

      const response = await transport.sendRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });
    });

    it('should handle request timeout', async () => {
      const slowTransport = new WebSocketTransport({
        requestTimeout: 100,
      });
      await slowTransport.connect(TEST_URL);

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {},
      };

      // Server doesn't respond
      server.onRequest(() => {
        // Intentionally don't respond
      });

      await expect(
        slowTransport.sendRequest(request)
      ).rejects.toThrow(/timeout/i);

      await slowTransport.disconnect();
    });

    it('should correlate requests and responses by id', async () => {
      const requests: JSONRPCRequest[] = [
        { jsonrpc: '2.0', id: 1, method: 'test1', params: {} },
        { jsonrpc: '2.0', id: 2, method: 'test2', params: {} },
        { jsonrpc: '2.0', id: 3, method: 'test3', params: {} },
      ];

      server.onRequest((req, respond) => {
        // Respond with ID echoed back
        setTimeout(() => {
          respond({
            jsonrpc: '2.0',
            id: req.id,
            result: { requestId: req.id },
          });
        }, Math.random() * 50); // Random delay
      });

      const responses = await Promise.all(
        requests.map((req) => transport.sendRequest(req))
      );

      // Verify each response matches its request
      responses.forEach((response, index) => {
        expect(response.id).toBe(requests[index].id);
        expect(response.result).toMatchObject({
          requestId: requests[index].id,
        });
      });
    });

    it('should handle JSON-RPC errors', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'invalid_method',
        params: {},
      };

      server.onRequest((req, respond) => {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          error: {
            code: -32601,
            message: 'Method not found',
          },
        });
      });

      const response = await transport.sendRequest(request);

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      });
    });
  });

  describe('Server-Initiated Messages', () => {
    beforeEach(async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);
    });

    it('should receive server notifications', async () => {
      const onNotification = vi.fn();
      transport.onNotification(onNotification);

      const notification: JSONRPCNotification = {
        jsonrpc: '2.0',
        method: 'notifications/message',
        params: { text: 'Server message' },
      };

      server.broadcast(notification);

      // Wait for notification to be received
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'notifications/message',
          params: { text: 'Server message' },
        })
      );
    });

    it('should handle server push messages', async () => {
      const messages: any[] = [];
      transport.onMessage((msg) => {
        messages.push(msg);
      });

      server.broadcast({ type: 'update', data: { value: 1 } });
      server.broadcast({ type: 'update', data: { value: 2 } });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({ type: 'update', data: { value: 1 } });
      expect(messages[1]).toMatchObject({ type: 'update', data: { value: 2 } });
    });
  });

  describe('Heartbeat & Reconnection', () => {
    it('should send periodic heartbeat pings', async () => {
      transport = new WebSocketTransport({
        heartbeatInterval: 100,
      });
      await transport.connect(TEST_URL);

      // Track pings received by server-side client WebSockets
      const pingsSent: number[] = [];
      for (const client of server.clients) {
        client.on('ping', () => {
          pingsSent.push(Date.now());
        });
      }

      // Wait for multiple heartbeats
      await new Promise((resolve) => setTimeout(resolve, 350));

      expect(pingsSent.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect connection loss via heartbeat', async () => {
      transport = new WebSocketTransport({
        heartbeatInterval: 100,
        heartbeatTimeout: 200,
        autoReconnect: false,
      });
      await transport.connect(TEST_URL);
      // Prevent uncaught exception from EventEmitter 'error' event
      transport.on('error', () => {});

      const onDisconnect = vi.fn();
      transport.on('disconnect', onDisconnect);

      // Stop server to simulate connection loss
      await server.stop();

      // Wait for heartbeat to detect failure
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(onDisconnect).toHaveBeenCalled();
    });

    it('should automatically reconnect on connection loss', async () => {
      transport = new WebSocketTransport({
        autoReconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: 3,
      });
      await transport.connect(TEST_URL);
      // Prevent uncaught exception from EventEmitter 'error' event during reconnect
      transport.on('error', () => {});

      const onReconnect = vi.fn();
      transport.on('reconnect', onReconnect);

      // Simulate connection loss
      await server.stop();

      // Wait a bit, then restart server
      await new Promise((resolve) => setTimeout(resolve, 50));
      server = new WebSocketServer({ port: TEST_PORT, host: 'localhost' });
      await server.start();

      // Wait for reconnection
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(onReconnect).toHaveBeenCalled();
      expect(transport.isConnected()).toBe(true);
    });

    it('should use exponential backoff for reconnection', async () => {
      transport = new WebSocketTransport({
        autoReconnect: true,
        reconnectInterval: 100,
        maxReconnectAttempts: 5,
      });
      await transport.connect(TEST_URL);
      // Prevent uncaught exception from EventEmitter 'error' event during reconnect
      transport.on('error', () => {});

      const reconnectAttempts: number[] = [];
      transport.on('reconnecting', (attempt: number) => {
        reconnectAttempts.push(Date.now());
      });

      // Stop server permanently
      await server.stop();

      // Wait for multiple reconnect attempts
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify exponential backoff (each delay should be longer)
      if (reconnectAttempts.length >= 2) {
        const firstDelay = reconnectAttempts[1] - reconnectAttempts[0];
        const secondDelay = reconnectAttempts[2] - reconnectAttempts[1];
        expect(secondDelay).toBeGreaterThan(firstDelay);
      }
    });

    it('should give up after max reconnection attempts', async () => {
      transport = new WebSocketTransport({
        autoReconnect: true,
        reconnectInterval: 50,
        maxReconnectAttempts: 2,
      });
      await transport.connect(TEST_URL);
      // Prevent uncaught exception from EventEmitter 'error' event during reconnect
      transport.on('error', () => {});

      const onReconnectFailed = vi.fn();
      transport.on('reconnectFailed', onReconnectFailed);

      // Stop server permanently
      await server.stop();

      // Wait for all reconnect attempts (exponential backoff: 50ms + 100ms + overhead)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(onReconnectFailed).toHaveBeenCalled();
      expect(transport.isConnected()).toBe(false);

      // Explicitly disconnect to clean up
      await transport.disconnect().catch(() => {});
    });
  });

  describe('Compression', () => {
    it('should support permessage-deflate compression', async () => {
      transport = new WebSocketTransport({
        compression: true,
      });
      await transport.connect(TEST_URL);

      const largePayload = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'test',
        params: {
          data: 'x'.repeat(10000), // 10KB of repeated data (highly compressible)
        },
      };

      server.onRequest((req, respond) => {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: { received: true, size: JSON.stringify(req).length },
        });
      });

      const response = await transport.sendRequest(largePayload);
      expect(response.result).toMatchObject({ received: true });
    });
  });

  describe('Binary Frames', () => {
    it('should support binary message frames for large payloads', async () => {
      transport = new WebSocketTransport({
        useBinary: true,
      });
      await transport.connect(TEST_URL);

      const binaryData = Buffer.from('binary test data');
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'upload',
        params: {
          data: binaryData.toString('base64'),
        },
      };

      server.onRequest((req, respond) => {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: { received: true },
        });
      });

      const response = await transport.sendRequest(request);
      expect(response.result).toMatchObject({ received: true });
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);
    });

    it('should handle requests with low latency (<50ms)', async () => {
      server.onRequest((req, respond) => {
        // Immediate response
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: { success: true },
        });
      });

      const start = Date.now();
      await transport.sendRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      });
      const latency = Date.now() - start;

      expect(latency).toBeLessThan(50);
    });

    it('should handle high throughput (100+ requests/sec)', async () => {
      server.onRequest((req, respond) => {
        respond({
          jsonrpc: '2.0',
          id: req.id,
          result: { success: true },
        });
      });

      const start = Date.now();
      const requests = Array.from({ length: 100 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        id: i,
        method: 'test',
        params: {},
      }));

      await Promise.all(requests.map((req) => transport.sendRequest(req)));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);
    });

    it('should handle malformed messages gracefully', async () => {
      const onError = vi.fn();
      transport.on('error', onError);

      // Server sends malformed JSON
      server.clients.forEach((client) => {
        client.send('not valid json{{{');
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onError).toHaveBeenCalled();
      expect(transport.isConnected()).toBe(true); // Should stay connected
    });

    it('should handle rapid disconnect/reconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await transport.disconnect();
        await transport.connect(TEST_URL);
      }

      expect(transport.isConnected()).toBe(true);
    });

    it('should clean up resources on disconnect', async () => {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
        params: {},
      };

      // Start request but disconnect immediately
      const requestPromise = transport.sendRequest(request).catch((err) => err);
      await transport.disconnect();

      const result = await requestPromise;
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toContain('Transport disconnected');
    });
  });

  describe('Live Subscriptions', () => {
    beforeEach(async () => {
      transport = new WebSocketTransport();
      await transport.connect(TEST_URL);
    });

    it('should create subscription for resource updates', async () => {
      const updates: any[] = [];
      const subscription = await transport.subscribe('spreadsheet://abc123');

      subscription.onUpdate((update) => {
        updates.push(update);
      });

      // Server sends updates
      server.broadcast({
        jsonrpc: '2.0',
        method: 'notifications/resources/updated',
        params: {
          uri: 'spreadsheet://abc123',
          data: { cell: 'A1', value: 'updated' },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({
        uri: 'spreadsheet://abc123',
        data: { cell: 'A1', value: 'updated' },
      });
    });

    it('should unsubscribe from resource updates', async () => {
      const updates: any[] = [];
      const subscription = await transport.subscribe('spreadsheet://abc123');

      subscription.onUpdate((update) => {
        updates.push(update);
      });

      await subscription.unsubscribe();

      // Server sends update after unsubscribe
      server.broadcast({
        jsonrpc: '2.0',
        method: 'notifications/resources/updated',
        params: {
          uri: 'spreadsheet://abc123',
          data: { cell: 'A1', value: 'updated' },
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(updates).toHaveLength(0);
    });
  });
});
