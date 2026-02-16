/**
 * Idempotency Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IdempotencyManager } from '../../src/services/idempotency-manager.js';
import { ACTION_METADATA } from '../../src/schemas/action-metadata.js';

describe('IdempotencyManager', () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    manager = new IdempotencyManager({ maxSize: 100, ttl: 1000 });
  });

  describe('isIdempotent', () => {
    it('should correctly identify idempotent operations', () => {
      expect(manager.isIdempotent('sheets_data', 'read')).toBe(true);
      expect(manager.isIdempotent('sheets_core', 'get')).toBe(true);
      expect(manager.isIdempotent('sheets_data', 'write')).toBe(true);
    });

    it('should correctly identify non-idempotent operations', () => {
      expect(manager.isIdempotent('sheets_data', 'append')).toBe(false);
      expect(manager.isIdempotent('sheets_core', 'create')).toBe(false);
      expect(manager.isIdempotent('sheets_core', 'add_sheet')).toBe(false);
    });

    it('should return false for unknown operations', () => {
      expect(manager.isIdempotent('unknown_tool', 'unknown_action')).toBe(false);
    });
  });

  describe('getCachedResult / storeResult', () => {
    it('should cache and retrieve operation results', () => {
      const key = 'test-key-123';
      const result = { success: true, data: 'test' };
      const fingerprint = 'test-fingerprint';

      // Initially no cache
      expect(manager.getCachedResult(key, 'sheets_data', 'read', fingerprint)).toBeUndefined();

      // Store result
      manager.storeResult(key, 'sheets_data', 'read', fingerprint, result);

      // Retrieve from cache
      expect(manager.getCachedResult(key, 'sheets_data', 'read', fingerprint)).toEqual(result);
    });

    it('should reject cached result if fingerprint differs', () => {
      const key = 'test-key-123';
      const result = { success: true, data: 'test' };
      const fingerprint1 = 'fingerprint-1';
      const fingerprint2 = 'fingerprint-2';

      manager.storeResult(key, 'sheets_data', 'read', fingerprint1, result);

      // Different fingerprint should return undefined
      expect(manager.getCachedResult(key, 'sheets_data', 'read', fingerprint2)).toBeUndefined();

      // Same fingerprint should return result
      expect(manager.getCachedResult(key, 'sheets_data', 'read', fingerprint1)).toEqual(result);
    });

    it('should handle cache expiration', async () => {
      const key = 'test-key-expire';
      const result = { success: true };
      const fingerprint = 'test-fp';

      // Create manager with very short TTL
      const shortTtlManager = new IdempotencyManager({ ttl: 100 });

      shortTtlManager.storeResult(key, 'sheets_data', 'read', fingerprint, result);

      // Should exist immediately
      expect(shortTtlManager.getCachedResult(key, 'sheets_data', 'read', fingerprint)).toEqual(
        result
      );

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be expired
      expect(
        shortTtlManager.getCachedResult(key, 'sheets_data', 'read', fingerprint)
      ).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should check if key exists', () => {
      const key = 'test-key-has';
      const fingerprint = 'test-fp';

      expect(manager.has(key)).toBe(false);

      manager.storeResult(key, 'sheets_data', 'read', fingerprint, { success: true });

      expect(manager.has(key)).toBe(true);
    });
  });

  describe('delete', () => {
    it('should remove key from cache', () => {
      const key = 'test-key-delete';
      const fingerprint = 'test-fp';

      manager.storeResult(key, 'sheets_data', 'read', fingerprint, { success: true });
      expect(manager.has(key)).toBe(true);

      manager.delete(key);
      expect(manager.has(key)).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cached results', () => {
      manager.storeResult('key1', 'sheets_data', 'read', 'fp1', { data: 1 });
      manager.storeResult('key2', 'sheets_data', 'read', 'fp2', { data: 2 });

      expect(manager.getStats().size).toBe(2);

      manager.clear();

      expect(manager.getStats().size).toBe(0);
      expect(manager.has('key1')).toBe(false);
      expect(manager.has('key2')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('utilizationPercent');

      expect(stats.maxSize).toBe(100);
      expect(stats.size).toBe(0);
      expect(stats.utilizationPercent).toBe(0);
    });

    it('should update stats as cache grows', () => {
      manager.storeResult('key1', 'sheets_data', 'read', 'fp1', { data: 1 });
      manager.storeResult('key2', 'sheets_data', 'read', 'fp2', { data: 2 });

      const stats = manager.getStats();
      expect(stats.size).toBe(2);
      expect(stats.utilizationPercent).toBe(2);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when max size reached', () => {
      const smallManager = new IdempotencyManager({ maxSize: 3 });

      smallManager.storeResult('key1', 'sheets_data', 'read', 'fp1', { data: 1 });
      smallManager.storeResult('key2', 'sheets_data', 'read', 'fp2', { data: 2 });
      smallManager.storeResult('key3', 'sheets_data', 'read', 'fp3', { data: 3 });

      expect(smallManager.getStats().size).toBe(3);
      expect(smallManager.has('key1')).toBe(true);

      // Add 4th entry - should evict key1
      smallManager.storeResult('key4', 'sheets_data', 'read', 'fp4', { data: 4 });

      expect(smallManager.getStats().size).toBe(3);
      expect(smallManager.has('key1')).toBe(false);
      expect(smallManager.has('key4')).toBe(true);
    });
  });

  describe('ACTION_METADATA coverage', () => {
    it('should have idempotent field for all actions', () => {
      for (const [_tool, actions] of Object.entries(ACTION_METADATA)) {
        for (const [_action, metadata] of Object.entries(actions)) {
          expect(metadata).toHaveProperty('idempotent');
          expect(typeof metadata.idempotent).toBe('boolean');
        }
      }
    });

    it('should correctly classify write operations', () => {
      // Write operations with same params should be idempotent
      expect(ACTION_METADATA['sheets_data']!['write']!.idempotent).toBe(true);
      expect(ACTION_METADATA['sheets_data']!['batch_write']!.idempotent).toBe(true);

      // Append operations are NOT idempotent
      expect(ACTION_METADATA['sheets_data']!['append']!.idempotent).toBe(false);

      // Creation operations are NOT idempotent
      expect(ACTION_METADATA['sheets_core']!['create']!.idempotent).toBe(false);
      expect(ACTION_METADATA['sheets_core']!['add_sheet']!.idempotent).toBe(false);
    });

    it('should classify read operations as idempotent', () => {
      // All read operations should be idempotent
      expect(ACTION_METADATA['sheets_data']!['read']!.idempotent).toBe(true);
      expect(ACTION_METADATA['sheets_data']!['batch_read']!.idempotent).toBe(true);
      expect(ACTION_METADATA['sheets_core']!['get']!.idempotent).toBe(true);
    });
  });
});
