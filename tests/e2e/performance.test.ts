/**
 * ServalSheets - E2E Performance Tests
 *
 * Basic performance smoke tests for hosted deployment.
 * Validates that health checks, initialization, and tool discovery
 * meet performance expectations without requiring credentials.
 *
 * Thresholds are designed to be achievable on modern hardware,
 * allowing for network latency and CI/CD environments.
 *
 * @module tests/e2e/performance
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { McpClient } from './helpers.js';

const config = {
  baseUrl: process.env['BASE_URL'] || 'http://localhost:3000',
  requestTimeout: 10000,
};

describe('ServalSheets E2E Performance Tests', () => {
  let client: McpClient;

  beforeAll(async () => {
    client = new McpClient(config.baseUrl, { timeout: config.requestTimeout });
    await client.initialize();
  });

  describe('Health Endpoint Performance', () => {
    it('Health endpoint responds in < 100ms', async () => {
      const start = performance.now();
      const response = await fetch(`${config.baseUrl}/health/live`);
      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    it('Ready endpoint responds in < 100ms', async () => {
      const start = performance.now();
      const response = await fetch(`${config.baseUrl}/health/ready`);
      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    it('Ping endpoint responds in < 50ms', async () => {
      const start = performance.now();
      const response = await fetch(`${config.baseUrl}/ping`);
      const duration = performance.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('MCP Protocol Performance', () => {
    it('Initialize request completes in < 1000ms', async () => {
      const testClient = new McpClient(config.baseUrl, {
        timeout: config.requestTimeout,
      });

      const start = performance.now();
      await testClient.initialize();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('Tool list request completes in < 500ms', async () => {
      const start = performance.now();
      const tools = await client.listTools();
      const duration = performance.now() - start;

      expect(tools.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500);
    });

    it('Tool call (non-destructive) completes in < 1000ms', async () => {
      const start = performance.now();
      await client.callTool('sheets_auth', {
        request: { action: 'status' },
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('Initialize + tools/list completes in < 2000ms', async () => {
      const testClient = new McpClient(config.baseUrl, {
        timeout: config.requestTimeout,
      });

      const start = performance.now();
      await testClient.initialize();
      await testClient.listTools();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Concurrent Request Performance', () => {
    it('10 concurrent health checks complete in < 500ms', async () => {
      const start = performance.now();

      const requests = Array.from({ length: 10 }, () =>
        fetch(`${config.baseUrl}/health/live`)
      );

      const results = await Promise.all(requests);
      const duration = performance.now() - start;

      for (const response of results) {
        expect(response.status).toBe(200);
      }

      expect(duration).toBeLessThan(500);
    });

    it('5 concurrent tool calls complete in < 5000ms', async () => {
      const start = performance.now();

      const calls = Array.from({ length: 5 }, () =>
        client.callTool('sheets_auth', {
          request: { action: 'status' },
        })
      );

      const results = await Promise.all(calls);
      const duration = performance.now() - start;

      expect(results.length).toBe(5);
      expect(duration).toBeLessThan(5000);
    });

    it('10 concurrent tool list requests complete in < 2000ms', async () => {
      const start = performance.now();

      const calls = Array.from({ length: 10 }, () => client.listTools());

      const results = await Promise.all(calls);
      const duration = performance.now() - start;

      expect(results.length).toBe(10);
      for (const toolList of results) {
        expect(toolList.length).toBe(25);
      }

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Throughput Performance', () => {
    it('Can handle 50 sequential health checks without slowdown', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        const response = await fetch(`${config.baseUrl}/health/live`);
        const duration = performance.now() - start;

        expect(response.status).toBe(200);
        durations.push(duration);
      }

      // Check that we're not seeing significant slowdown
      const avgFirstTen = durations.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      const avgLastTen = durations.slice(-10).reduce((a, b) => a + b, 0) / 10;

      // Last 10 shouldn't be more than 2x slower than first 10
      expect(avgLastTen).toBeLessThan(avgFirstTen * 2);
    });

    it('Tool list remains consistent in performance over 10 calls', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const tools = await client.listTools();
        const duration = performance.now() - start;

        expect(tools.length).toBe(25);
        durations.push(duration);
      }

      // Check consistency - standard deviation shouldn't be too high
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + (d - avg) ** 2, 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be < average (indicates reasonable consistency)
      expect(stdDev).toBeLessThan(avg);
    });
  });

  describe('Memory Stability (Smoke Test)', () => {
    it('Memory usage is stable over 50 sequential requests', async () => {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const startMem = process.memoryUsage();

        for (let i = 0; i < 50; i++) {
          await fetch(`${config.baseUrl}/health/live`);
        }

        const endMem = process.memoryUsage();
        const heapDelta = endMem.heapUsed - startMem.heapUsed;

        // Allow for some heap growth but not unbounded
        // This is a basic smoke test, not a full memory leak detection
        const maxAcceptableGrowth = 50 * 1024 * 1024; // 50MB
        expect(heapDelta).toBeLessThan(maxAcceptableGrowth);
      }
    });
  });

  describe('Error Handling Performance', () => {
    it('Invalid requests are rejected quickly', async () => {
      const start = performance.now();

      try {
        await client.callTool('sheets_data', {
          request: {
            action: 'read_range',
            // Missing required params
          },
        });
      } catch (error) {
        // Error is expected
      }

      const duration = performance.now() - start;

      // Error handling should be fast (no timeouts/retries on validation errors)
      expect(duration).toBeLessThan(500);
    });

    it('Invalid JSON is rejected quickly', async () => {
      const start = performance.now();

      try {
        await fetch(`${config.baseUrl}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{invalid',
        });
      } catch (error) {
        // Error is expected
      }

      const duration = performance.now() - start;

      // Should fail fast without retry logic
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Latency Distribution', () => {
    it('Health endpoints show acceptable latency distribution', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await fetch(`${config.baseUrl}/health/live`);
        durations.push(performance.now() - start);
      }

      durations.sort((a, b) => a - b);

      const p50 = durations[Math.floor(durations.length * 0.5)];
      const p95 = durations[Math.floor(durations.length * 0.95)];
      const p99 = durations[Math.floor(durations.length * 0.99)];

      // Reasonable thresholds for health endpoint
      expect(p50).toBeLessThan(50); // Median < 50ms
      expect(p95).toBeLessThan(100); // 95th percentile < 100ms
      expect(p99).toBeLessThan(150); // 99th percentile < 150ms
    });

    it('Tool calls show acceptable latency distribution', async () => {
      const durations: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await client.callTool('sheets_auth', {
          request: { action: 'status' },
        });
        durations.push(performance.now() - start);
      }

      durations.sort((a, b) => a - b);

      const p50 = durations[Math.floor(durations.length * 0.5)];
      const p95 = durations[Math.floor(durations.length * 0.95)];
      const p99 = durations[Math.floor(durations.length * 0.99)];

      // Reasonable thresholds for tool calls
      expect(p50).toBeLessThan(200); // Median < 200ms
      expect(p95).toBeLessThan(500); // 95th percentile < 500ms
      expect(p99).toBeLessThan(1000); // 99th percentile < 1s
    });
  });

  describe('Scalability Smoke Tests', () => {
    it('Server handles 100 rapid requests without degradation', async () => {
      const startTime = performance.now();
      let successCount = 0;
      let errorCount = 0;

      const requests = Array.from({ length: 100 }, () =>
        fetch(`${config.baseUrl}/health/live`)
          .then((r) => {
            if (r.status === 200) successCount++;
          })
          .catch(() => {
            errorCount++;
          })
      );

      await Promise.all(requests);
      const totalTime = performance.now() - startTime;

      expect(successCount).toBe(100);
      expect(errorCount).toBe(0);
      expect(totalTime).toBeLessThan(10000); // 100 requests in < 10s
    });
  });
});
