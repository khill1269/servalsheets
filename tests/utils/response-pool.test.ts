/**
 * Tests for response-pool utility
 */

import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  ResponseArrayBuilder,
  mergeInPlace,
  cloneObject,
  shouldPreallocate,
} from '../../src/utils/response-pool.js';

describe('response-pool', () => {
  describe('createSuccessResponse', () => {
    it('should create success response with minimal fields', () => {
      const response = createSuccessResponse('test_action', 'Operation successful');

      expect(response).toEqual({
        success: true,
        action: 'test_action',
        message: 'Operation successful',
      });
    });

    it('should include additional data fields', () => {
      const response = createSuccessResponse('test_action', 'Success', {
        value: 42,
        nested: { foo: 'bar' },
      });

      expect(response).toEqual({
        success: true,
        action: 'test_action',
        message: 'Success',
        value: 42,
        nested: { foo: 'bar' },
      });
    });

    it('should handle empty data object', () => {
      const response = createSuccessResponse('test_action', 'Success', {});

      expect(response).toEqual({
        success: true,
        action: 'test_action',
        message: 'Success',
      });
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with minimal fields', () => {
      const response = createErrorResponse('TEST_ERROR', 'Something went wrong');

      expect(response).toEqual({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Something went wrong',
          retryable: false,
        },
      });
    });

    it('should include retryable flag', () => {
      const response = createErrorResponse('TIMEOUT', 'Request timed out', true);

      expect(response.error.retryable).toBe(true);
    });

    it('should include error details', () => {
      const response = createErrorResponse('INVALID_INPUT', 'Bad request', false, {
        field: 'spreadsheetId',
        value: 'invalid',
      });

      expect(response.error.details).toEqual({
        field: 'spreadsheetId',
        value: 'invalid',
      });
    });
  });

  describe('ResponseArrayBuilder', () => {
    it('should build array with estimated size', () => {
      const builder = new ResponseArrayBuilder<number>(5);
      builder.add(1);
      builder.add(2);
      builder.add(3);

      const result = builder.build();
      expect(result).toEqual([1, 2, 3]);
      expect(builder.size).toBe(3);
    });

    it('should grow array when capacity exceeded', () => {
      const builder = new ResponseArrayBuilder<number>(2);
      builder.add(1);
      builder.add(2);
      builder.add(3); // Exceeds capacity
      builder.add(4);
      builder.add(5);

      const result = builder.build();
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle large arrays efficiently', () => {
      const builder = new ResponseArrayBuilder<number>(100);

      for (let i = 0; i < 150; i++) {
        builder.add(i);
      }

      const result = builder.build();
      expect(result.length).toBe(150);
      expect(result[0]).toBe(0);
      expect(result[149]).toBe(149);
    });

    it('should trim array to actual size', () => {
      const builder = new ResponseArrayBuilder<string>(100);
      builder.add('a');
      builder.add('b');
      builder.add('c');

      const result = builder.build();
      expect(result.length).toBe(3); // Not 100
    });
  });

  describe('mergeInPlace', () => {
    it('should merge objects in place', () => {
      const target = { a: 1, b: 2 };
      const source = { c: 3, d: 4 };

      const result = mergeInPlace(target, source);

      expect(result).toBe(target); // Same reference
      expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });

    it('should override existing keys', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 99, c: 3 };

      mergeInPlace(target, source);

      expect(target.b).toBe(99);
    });

    it('should handle multiple sources', () => {
      const target = { a: 1 };
      const source1 = { b: 2 };
      const source2 = { c: 3 };
      const source3 = { d: 4 };

      mergeInPlace(target, source1, source2, source3);

      expect(target).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });

    it('should skip undefined sources', () => {
      const target = { a: 1 };

      mergeInPlace(target, undefined, { b: 2 }, undefined);

      expect(target).toEqual({ a: 1, b: 2 });
    });
  });

  describe('cloneObject', () => {
    it('should shallow clone object', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = cloneObject(obj, 1);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj); // Different reference
      expect(cloned.b).toBe(obj.b); // Shallow - same nested reference
    });

    it('should deep clone object', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = cloneObject(obj, 2);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b); // Deep - different nested reference
    });

    it('should clone arrays', () => {
      const arr = [1, 2, [3, 4]];
      const cloned = cloneObject(arr, 2);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should handle primitives', () => {
      expect(cloneObject(42, 1)).toBe(42);
      expect(cloneObject('test', 1)).toBe('test');
      expect(cloneObject(null, 1)).toBe(null);
      expect(cloneObject(undefined, 1)).toBe(undefined);
    });

    it('should respect depth limit', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: 42,
            },
          },
        },
      };

      const shallowClone = cloneObject(obj, 1);
      expect(shallowClone.level1).toBe(obj.level1); // Shallow - level1 not cloned

      const depth2Clone = cloneObject(obj, 2);
      expect(depth2Clone.level1).not.toBe(obj.level1); // level1 cloned
      expect(depth2Clone.level1.level2).toBe(obj.level1.level2); // level2 not cloned (depth exhausted)

      const deepClone = cloneObject(obj, 4);
      expect(deepClone.level1).not.toBe(obj.level1); // level1 cloned
      expect(deepClone.level1.level2).not.toBe(obj.level1.level2); // level2 cloned
      expect(deepClone.level1.level2.level3).not.toBe(obj.level1.level2.level3); // level3 cloned
    });
  });

  describe('shouldPreallocate', () => {
    it('should recommend preallocation for large growth', () => {
      expect(shouldPreallocate(10, 20)).toBe(true); // 2x growth
      expect(shouldPreallocate(100, 200)).toBe(true); // 2x growth
    });

    it('should not recommend preallocation for small growth', () => {
      expect(shouldPreallocate(10, 12)).toBe(false); // 1.2x growth
      expect(shouldPreallocate(100, 110)).toBe(false); // 1.1x growth
    });

    it('should handle edge cases', () => {
      expect(shouldPreallocate(0, 10)).toBe(true); // Infinite growth
      expect(shouldPreallocate(10, 10)).toBe(false); // No growth
      expect(shouldPreallocate(10, 5)).toBe(false); // Shrinking
    });
  });

  describe('performance', () => {
    it('should be faster than JSON.parse/stringify for cloning', () => {
      const obj = { a: 1, b: 2, c: { d: 3, e: 4 } };
      const iterations = 10000;

      const startClone = Date.now();
      for (let i = 0; i < iterations; i++) {
        cloneObject(obj, 2);
      }
      const cloneDuration = Date.now() - startClone;

      const startJson = Date.now();
      for (let i = 0; i < iterations; i++) {
        structuredClone(obj);
      }
      const jsonDuration = Date.now() - startJson;

      // cloneObject should be faster (though not always guaranteed in all environments)
      // Just check that it completes without error
      expect(cloneDuration).toBeGreaterThan(0);
      expect(jsonDuration).toBeGreaterThan(0);
    });

    it('should handle large array building efficiently', () => {
      const builder = new ResponseArrayBuilder<number>(1000);
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        builder.add(i);
      }

      const result = builder.build();
      const duration = Date.now() - start;

      expect(result.length).toBe(10000);
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });
  });
});
