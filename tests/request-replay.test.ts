import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import {
  RequestReplaySystem,
  getRequestReplaySystem,
  resetRequestReplaySystem,
  type ReplayHandler,
} from '../../src/utils/request-replay.js';
import type { ErrorDetail } from '../../src/schemas/shared.js';

describe('RequestReplaySystem', () => {
  let replaySystem: RequestReplaySystem;
  const testStorageFile = 'test-replay.jsonl';

  beforeEach(() => {
    replaySystem = new RequestReplaySystem({
      enabled: true,
      captureSuccess: true,
      storageFile: testStorageFile,
      maxStorageSize: 100,
    });
  });

  afterEach(() => {
    resetRequestReplaySystem();
    if (existsSync(testStorageFile)) {
      unlinkSync(testStorageFile);
    }
  });

  describe('captureRequest', () => {
    it('should capture a failed request', () => {
      const error: ErrorDetail = {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        category: 'quota',
        severity: 'medium',
        retryable: true,
      };

      const requestId = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: { spreadsheetId: 'abc123', range: 'A1:B10' },
        originalError: error,
      });

      expect(requestId).toBeTruthy();

      const captured = replaySystem.getRequest(requestId);
      expect(captured).toBeDefined();
      expect(captured?.toolName).toBe('sheets_values');
      expect(captured?.action).toBe('read');
      expect(captured?.originalError).toEqual(error);
    });

    it('should capture successful request when captureSuccess is enabled', () => {
      const requestId = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: { spreadsheetId: 'abc123' },
        originalResponse: { data: [[1, 2, 3]] },
      });

      expect(requestId).toBeTruthy();
      const captured = replaySystem.getRequest(requestId);
      expect(captured?.originalResponse).toBeDefined();
    });

    it('should not capture successful request when captureSuccess is disabled', () => {
      const noSuccessSystem = new RequestReplaySystem({
        enabled: true,
        captureSuccess: false,
      });

      const requestId = noSuccessSystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: { spreadsheetId: 'abc123' },
        originalResponse: { data: [[1, 2, 3]] },
      });

      expect(requestId).toBe('');
    });

    it('should return empty string when disabled', () => {
      const disabledSystem = new RequestReplaySystem({ enabled: false });

      const requestId = disabledSystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      expect(requestId).toBe('');
    });

    it('should include metadata when provided', () => {
      const requestId = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'write',
        input: { data: [[1, 2]] },
        metadata: {
          spreadsheetId: 'abc123',
          sheetName: 'Sheet1',
          duration: 250,
          retryCount: 2,
        },
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      const captured = replaySystem.getRequest(requestId);
      expect(captured?.metadata?.spreadsheetId).toBe('abc123');
      expect(captured?.metadata?.sheetName).toBe('Sheet1');
      expect(captured?.metadata?.duration).toBe(250);
      expect(captured?.metadata?.retryCount).toBe(2);
    });

    it('should persist to storage file', () => {
      replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      expect(existsSync(testStorageFile)).toBe(true);
      const content = readFileSync(testStorageFile, 'utf-8');
      expect(content).toContain('sheets_values');
      expect(content).toContain('read');
    });

    it('should enforce max storage size', () => {
      const smallSystem = new RequestReplaySystem({
        enabled: true,
        captureSuccess: true,
        maxStorageSize: 5,
      });

      // Add 10 requests
      for (let i = 0; i < 10; i++) {
        smallSystem.captureRequest({
          toolName: 'sheets_values',
          action: 'read',
          input: { index: i },
          originalResponse: { data: [] },
        });
      }

      const all = smallSystem.getAllRequests();
      expect(all.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getFailedRequests', () => {
    it('should return only failed requests', () => {
      // Add successful request
      replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalResponse: { data: [] },
      });

      // Add failed requests
      for (let i = 0; i < 3; i++) {
        replaySystem.captureRequest({
          toolName: 'sheets_values',
          action: 'write',
          input: { index: i },
          originalError: {
            code: 'RATE_LIMITED',
            message: 'Rate limit',
            category: 'quota',
            severity: 'medium',
            retryable: true,
          },
        });
      }

      const failed = replaySystem.getFailedRequests();
      expect(failed).toHaveLength(3);
      expect(failed.every((req) => req.originalError)).toBe(true);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        replaySystem.captureRequest({
          toolName: 'sheets_values',
          action: 'write',
          input: { index: i },
          originalError: {
            code: 'RATE_LIMITED',
            message: 'Rate limit',
            category: 'quota',
            severity: 'medium',
            retryable: true,
          },
        });
      }

      const failed = replaySystem.getFailedRequests(3);
      expect(failed).toHaveLength(3);
    });
  });

  describe('getRequestsByTool', () => {
    it('should filter requests by tool name', () => {
      replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalResponse: {},
      });

      replaySystem.captureRequest({
        toolName: 'sheets_sheet',
        action: 'add',
        input: {},
        originalResponse: {},
      });

      replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'write',
        input: {},
        originalResponse: {},
      });

      const valuesRequests = replaySystem.getRequestsByTool('sheets_values');
      expect(valuesRequests).toHaveLength(2);
      expect(valuesRequests.every((req) => req.toolName === 'sheets_values')).toBe(true);
    });
  });

  describe('replayRequest', () => {
    it('should replay a request successfully', async () => {
      const mockHandler: ReplayHandler = vi.fn().mockResolvedValue({ success: true, data: [] });
      replaySystem.setReplayHandler(mockHandler);

      const requestId = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: { spreadsheetId: 'abc123', range: 'A1:B10' },
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      const result = await replaySystem.replayRequest(requestId);

      expect(result.success).toBe(true);
      expect(result.response).toEqual({ success: true, data: [] });
      expect(mockHandler).toHaveBeenCalledWith('sheets_values', 'read', {
        spreadsheetId: 'abc123',
        range: 'A1:B10',
      });
    });

    it('should apply input modifications', async () => {
      const mockHandler: ReplayHandler = vi.fn().mockResolvedValue({ success: true });
      replaySystem.setReplayHandler(mockHandler);

      const requestId = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: { spreadsheetId: 'old123' },
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      await replaySystem.replayRequest(requestId, {
        modifyInput: (input) => ({
          ...(input as Record<string, unknown>),
          spreadsheetId: 'new456',
        }),
      });

      expect(mockHandler).toHaveBeenCalledWith('sheets_values', 'read', {
        spreadsheetId: 'new456',
      });
    });

    it('should handle replay failure', async () => {
      const mockHandler: ReplayHandler = vi.fn().mockRejectedValue(new Error('Network error'));
      replaySystem.setReplayHandler(mockHandler);

      const requestId = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      const result = await replaySystem.replayRequest(requestId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REPLAY_FAILED');
    });

    it('should throw when request not found', async () => {
      await expect(replaySystem.replayRequest('non-existent-id')).rejects.toThrow(
        'Request not found'
      );
    });

    it('should throw when replay handler not set', async () => {
      const requestId = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      await expect(replaySystem.replayRequest(requestId)).rejects.toThrow(
        'Replay handler not set'
      );
    });
  });

  describe('replayBatch', () => {
    it('should replay multiple requests', async () => {
      const mockHandler: ReplayHandler = vi
        .fn()
        .mockResolvedValueOnce({ result: 1 })
        .mockResolvedValueOnce({ result: 2 })
        .mockResolvedValueOnce({ result: 3 });

      replaySystem.setReplayHandler(mockHandler);

      const ids = [];
      for (let i = 0; i < 3; i++) {
        const id = replaySystem.captureRequest({
          toolName: 'sheets_values',
          action: 'read',
          input: { index: i },
          originalError: {
            code: 'RATE_LIMITED',
            message: 'Rate limit',
            category: 'quota',
            severity: 'medium',
            retryable: true,
          },
        });
        ids.push(id);
      }

      const results = await replaySystem.replayBatch(ids);

      expect(results).toHaveLength(3);
      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(true);
      expect(results[2]?.success).toBe(true);
    });

    it('should handle partial failures in batch', async () => {
      const mockHandler: ReplayHandler = vi
        .fn()
        .mockResolvedValueOnce({ result: 1 })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ result: 3 });

      replaySystem.setReplayHandler(mockHandler);

      const ids = [];
      for (let i = 0; i < 3; i++) {
        const id = replaySystem.captureRequest({
          toolName: 'sheets_values',
          action: 'read',
          input: { index: i },
          originalError: {
            code: 'RATE_LIMITED',
            message: 'Rate limit',
            category: 'quota',
            severity: 'medium',
            retryable: true,
          },
        });
        ids.push(id);
      }

      const results = await replaySystem.replayBatch(ids);

      expect(results).toHaveLength(3);
      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(false);
      expect(results[2]?.success).toBe(true);
    });
  });

  describe('exportReplayScript', () => {
    it('should generate test script from requests', () => {
      const id1 = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: { spreadsheetId: 'abc123', range: 'A1:B10' },
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      const id2 = replaySystem.captureRequest({
        toolName: 'sheets_sheet',
        action: 'add',
        input: { title: 'New Sheet' },
        originalResponse: { success: true },
      });

      const script = replaySystem.exportReplayScript([id1, id2]);

      expect(script).toContain("import { describe, it, expect } from 'vitest'");
      expect(script).toContain('sheets_values');
      expect(script).toContain('sheets_sheet');
      expect(script).toContain('handleToolCall');
      expect(script).toContain('"spreadsheetId": "abc123"');
    });

    it('should include error comments for failed requests', () => {
      const id = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      const script = replaySystem.exportReplayScript([id]);

      expect(script).toContain('// Original request failed with:');
      expect(script).toContain('// RATE_LIMITED: Rate limit exceeded');
    });

    it('should return empty comment for empty request list', () => {
      const script = replaySystem.exportReplayScript([]);
      expect(script).toBe('// No requests to export');
    });
  });

  describe('exportCurlCommands', () => {
    it('should generate curl commands for replay', () => {
      const id = replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: { spreadsheetId: 'abc123', range: 'A1:B10' },
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
      });

      const commands = replaySystem.exportCurlCommands([id]);

      expect(commands).toContain('#!/bin/bash');
      expect(commands).toContain('sheets_values');
      expect(commands).toContain('read');
      expect(commands).toContain('tools/call');
      expect(commands).toContain('node dist/server.js');
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalResponse: {},
        metadata: { duration: 100 },
      });

      replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'write',
        input: {},
        originalError: {
          code: 'RATE_LIMITED',
          message: 'Rate limit',
          category: 'quota',
          severity: 'medium',
          retryable: true,
        },
        metadata: { duration: 200 },
      });

      replaySystem.captureRequest({
        toolName: 'sheets_sheet',
        action: 'add',
        input: {},
        originalError: {
          code: 'PERMISSION_DENIED',
          message: 'No permission',
          category: 'auth',
          severity: 'high',
          retryable: false,
        },
        metadata: { duration: 150 },
      });

      const stats = replaySystem.getStats();

      expect(stats.total).toBe(3);
      expect(stats.failed).toBe(2);
      expect(stats.succeeded).toBe(1);
      expect(stats.byTool['sheets_values']).toBe(2);
      expect(stats.byTool['sheets_sheet']).toBe(1);
      expect(stats.avgDuration).toBe(150);
    });
  });

  describe('clear', () => {
    it('should clear all requests', () => {
      replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalResponse: {},
      });

      replaySystem.clear();

      expect(replaySystem.getAllRequests()).toHaveLength(0);
    });
  });

  describe('clearOldRequests', () => {
    it('should clear requests older than specified age', () => {
      vi.useFakeTimers();

      // Add request at time 0
      replaySystem.captureRequest({
        toolName: 'sheets_values',
        action: 'read',
        input: {},
        originalResponse: {},
      });

      // Advance time by 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000);

      // Add another request
      replaySystem.captureRequest({
        toolName: 'sheets_sheet',
        action: 'add',
        input: {},
        originalResponse: {},
      });

      // Clear requests older than 30 minutes
      const cleared = replaySystem.clearOldRequests(30 * 60 * 1000);

      expect(cleared).toBe(1);
      expect(replaySystem.getAllRequests()).toHaveLength(1);
      expect(replaySystem.getAllRequests()[0]?.toolName).toBe('sheets_sheet');

      vi.useRealTimers();
    });
  });

  describe('global instance', () => {
    afterEach(() => {
      resetRequestReplaySystem();
      delete process.env.REQUEST_REPLAY_ENABLED;
      delete process.env.REQUEST_REPLAY_CAPTURE_SUCCESS;
      delete process.env.REQUEST_REPLAY_FILE;
    });

    it('should create global instance with environment config', () => {
      process.env.REQUEST_REPLAY_ENABLED = 'true';
      process.env.REQUEST_REPLAY_CAPTURE_SUCCESS = 'true';
      process.env.REQUEST_REPLAY_FILE = 'custom-replay.jsonl';

      const globalSystem = getRequestReplaySystem();

      expect(globalSystem).toBeDefined();
      expect(globalSystem.isEnabled()).toBe(true);
    });

    it('should reuse existing global instance', () => {
      const system1 = getRequestReplaySystem();
      const system2 = getRequestReplaySystem();

      expect(system1).toBe(system2);
    });

    it('should reset global instance', () => {
      const system1 = getRequestReplaySystem();
      resetRequestReplaySystem();
      const system2 = getRequestReplaySystem();

      expect(system1).not.toBe(system2);
    });
  });
});
