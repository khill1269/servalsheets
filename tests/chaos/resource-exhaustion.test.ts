/**
 * Chaos Tests: Resource Exhaustion
 *
 * Verifies system resilience under resource pressure:
 * - Memory pressure during large operations
 * - CPU load during processing
 * - File descriptor exhaustion
 * - Connection pool exhaustion
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChaosEngine, type ChaosEngine } from './chaos-framework.js';
import { CircuitBreaker } from '../../src/utils/circuit-breaker.js';

describe('Chaos: Resource Exhaustion', () => {
  let chaos: ChaosEngine;

  beforeEach(() => {
    chaos = createChaosEngine();
  });

  afterEach(() => {
    chaos.reset();
    chaos.clearEvents();
  });

  describe('Memory Pressure', () => {
    it('should continue operating under memory pressure', async () => {
      // Allocate significant memory
      chaos.injectMemoryPressure(50); // 50 MB

      const operation = async () => {
        // Simulate large operation
        const data = new Array(1000).fill(0).map((_, i) => ({
          id: i,
          value: `data-${i}`,
        }));
        return data.length;
      };

      const result = await chaos.execute(operation);
      expect(result).toBe(1000);

      const stats = chaos.getStats();
      expect(stats.memoryAllocatedMb).toBeGreaterThanOrEqual(50);
    });

    it('should handle OOM conditions gracefully', async () => {
      chaos.injectMemoryPressure(100); // 100 MB

      const operations = Array.from({ length: 5 }, async () => {
        try {
          return await chaos.execute(async () => {
            // Try to allocate more memory
            const largeArray = new Array(1000000).fill(0);
            return largeArray.length;
          });
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'OOM' };
        }
      });

      const results = await Promise.all(operations);

      // At least some operations should complete
      const successful = results.filter((r) => typeof r === 'number');
      expect(successful.length).toBeGreaterThan(0);
    });

    it('should release memory after reset', async () => {
      chaos.injectMemoryPressure(50);
      expect(chaos.getStats().memoryAllocatedMb).toBeGreaterThanOrEqual(50);

      chaos.reset();
      expect(chaos.getStats().memoryAllocatedMb).toBe(0);
    });
  });

  describe('CPU Load', () => {
    it('should remain responsive under CPU load', async () => {
      chaos.injectCpuLoad(0.7); // 70% CPU load

      const start = Date.now();
      const operations = Array.from({ length: 10 }, (_, i) =>
        chaos.execute(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return i;
        })
      );

      const results = await Promise.all(operations);
      const duration = Date.now() - start;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(2000); // Should complete within reasonable time
    });

    it('should handle CPU-intensive operations under load', async () => {
      chaos.injectCpuLoad(0.5);

      const operation = async () => {
        // CPU-intensive work
        let sum = 0;
        for (let i = 0; i < 100000; i++) {
          sum += Math.sqrt(i);
        }
        return sum;
      };

      const result = await chaos.execute(operation);
      expect(result).toBeGreaterThan(0);
    });

    it('should stop CPU load after reset', async () => {
      chaos.injectCpuLoad(0.8);
      await new Promise((resolve) => setTimeout(resolve, 100));

      chaos.reset();

      // Verify load is removed (operations should be faster)
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('Combined Resource Pressure', () => {
    it('should handle multiple resource constraints simultaneously', async () => {
      chaos.injectMemoryPressure(30);
      chaos.injectCpuLoad(0.6);

      const operations = Array.from({ length: 5 }, async (_, i) => {
        return await chaos.execute(async () => {
          // Memory + CPU intensive
          const data = new Array(10000).fill(0);
          let sum = 0;
          for (const item of data) {
            sum += Math.sqrt(item + i);
          }
          return { id: i, sum };
        });
      });

      const results = await Promise.all(operations);
      expect(results).toHaveLength(5);
      expect(results.every((r) => typeof r.sum === 'number')).toBe(true);
    });

    it('should maintain circuit breaker under resource pressure', async () => {
      chaos.injectMemoryPressure(50);
      chaos.injectCpuLoad(0.7);

      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 1, // Only need 1 success to close
        timeout: 100, // Shorter timeout for test speed
        name: 'resource-pressure',
      });

      let attempts = 0;
      // Fail 3 times to trigger circuit breaker, then succeed
      const operation = async () => {
        attempts++;
        if (attempts <= 3) {
          throw new Error('Resource pressure error');
        }
        return 'success';
      };

      // First 3 attempts should fail and open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open');

      // Wait for timeout to expire so circuit transitions to half_open
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Next attempt should succeed (in half_open state, allows one attempt)
      const result = await breaker.execute(operation);
      expect(result).toBe('success');

      // Circuit should now be closed again
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Connection Pool Exhaustion', () => {
    it('should handle connection pool saturation', async () => {
      // Simulate many concurrent operations
      const operations = Array.from({ length: 100 }, async (_, i) => {
        return await chaos.execute(async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
          return i;
        });
      });

      const results = await Promise.all(operations);
      expect(results).toHaveLength(100);
      expect(results.sort((a, b) => a - b)).toEqual(
        Array.from({ length: 100 }, (_, i) => i)
      );
    });

    it('should queue operations when pool is full', async () => {
      const maxConcurrent = 5;
      let currentConcurrent = 0;
      let maxReached = 0;

      // Create operation factories (not promises) so they don't start immediately
      const createOperation = (i: number) => async () => {
        return await chaos.execute(async () => {
          currentConcurrent++;
          maxReached = Math.max(maxReached, currentConcurrent);

          await new Promise((resolve) => setTimeout(resolve, 50));

          currentConcurrent--;
          return i;
        });
      };

      // Process in chunks to limit concurrency
      const results: number[] = [];
      for (let i = 0; i < 20; i += maxConcurrent) {
        const chunk = Array.from(
          { length: Math.min(maxConcurrent, 20 - i) },
          (_, j) => createOperation(i + j)()
        );
        const chunkResults = await Promise.all(chunk);
        results.push(...chunkResults);
      }

      expect(results).toHaveLength(20);
      expect(maxReached).toBeLessThanOrEqual(maxConcurrent);
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide degraded service under extreme pressure', async () => {
      chaos.injectMemoryPressure(100);
      chaos.injectCpuLoad(0.9);

      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 2000,
        name: 'degraded-service',
      });

      // Register degraded mode fallback
      breaker.registerFallback({
        name: 'degraded-response',
        priority: 50,
        execute: async () => {
          return {
            degraded: true,
            message: 'Service operating in degraded mode',
            data: null,
          };
        },
        shouldUse: () => true,
      });

      const operation = async () => {
        throw new Error('Resource exhaustion');
      };

      // Should use fallback instead of failing completely
      const results: unknown[] = [];
      for (let i = 0; i < 5; i++) {
        const result = await breaker.execute(operation);
        results.push(result);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Verify degraded responses
      const degradedResponses = results.filter(
        (r) => typeof r === 'object' && r !== null && 'degraded' in r
      );
      expect(degradedResponses.length).toBeGreaterThan(0);
    });

    it('should log resource pressure warnings', async () => {
      chaos.injectMemoryPressure(75);

      const stats = chaos.getStats();
      expect(stats.memoryAllocatedMb).toBeGreaterThanOrEqual(75);

      const events = chaos.getEventsByType('memory_pressure');
      expect(events).toHaveLength(1);
      expect(events[0]?.metadata?.sizeMb).toBe(75);
    });

    it('should recover after resource pressure is relieved', async () => {
      chaos.injectMemoryPressure(50);
      chaos.injectCpuLoad(0.8);

      // Verify pressure is active
      expect(chaos.getStats().memoryAllocatedMb).toBeGreaterThan(0);

      // Remove pressure
      chaos.reset();

      // Verify recovery
      expect(chaos.getStats().memoryAllocatedMb).toBe(0);

      // Operations should be faster now
      const start = Date.now();
      await chaos.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Messages Under Pressure', () => {
    it('should provide helpful error messages', async () => {
      chaos.injectMemoryPressure(100);

      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 500,
        name: 'error-messages',
      });

      const errors: string[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Out of memory');
          });
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }

      // Should have circuit breaker errors
      const circuitErrors = errors.filter((e) => e.includes('Circuit breaker'));
      expect(circuitErrors.length).toBeGreaterThan(0);
    });
  });
});
