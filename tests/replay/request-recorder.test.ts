/**
 * Request Recorder Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RequestRecorder, type RecordedRequest } from '../../src/services/request-recorder.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

const TEST_DB_PATH = resolve(process.cwd(), '.data', 'test-requests.db');

describe('RequestRecorder', () => {
  let recorder: RequestRecorder;

  beforeEach(() => {
    // Clean up test database if it exists
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }

    recorder = new RequestRecorder(TEST_DB_PATH);
  });

  afterEach(() => {
    recorder.close();

    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe('record', () => {
    it('records a request successfully', () => {
      const entry: Omit<RecordedRequest, 'id'> = {
        timestamp: Date.now(),
        tool_name: 'sheets_data',
        action: 'read',
        spreadsheet_id: 'test-123',
        request_body: JSON.stringify({ action: 'read', range: 'A1:B10' }),
        response_body: JSON.stringify({ success: true, values: [['A', 'B']] }),
        status_code: 200,
        duration_ms: 150,
        error_message: null,
      };

      const id = recorder.record(entry);

      expect(id).toBeTypeOf('number');
      expect(id).toBeGreaterThan(0);
    });

    it('records multiple requests with incremental IDs', () => {
      const entry: Omit<RecordedRequest, 'id'> = {
        timestamp: Date.now(),
        tool_name: 'sheets_core',
        action: 'get',
        spreadsheet_id: 'test-456',
        request_body: '{}',
        response_body: '{}',
        status_code: 200,
        duration_ms: 100,
        error_message: null,
      };

      const id1 = recorder.record(entry);
      const id2 = recorder.record(entry);

      expect(id2).toBe(id1! + 1);
    });

    it('records failed requests with error message', () => {
      const entry: Omit<RecordedRequest, 'id'> = {
        timestamp: Date.now(),
        tool_name: 'sheets_data',
        action: 'write',
        spreadsheet_id: 'test-789',
        request_body: '{}',
        response_body: '{}',
        status_code: 500,
        duration_ms: 50,
        error_message: 'Internal server error',
      };

      const id = recorder.record(entry);
      expect(id).toBeTypeOf('number');

      const retrieved = recorder.getById(id!);
      expect(retrieved?.error_message).toBe('Internal server error');
    });
  });

  describe('getById', () => {
    it('retrieves recorded request by ID', () => {
      const entry: Omit<RecordedRequest, 'id'> = {
        timestamp: Date.now(),
        tool_name: 'sheets_format',
        action: 'set_format',
        spreadsheet_id: 'test-abc',
        request_body: JSON.stringify({ action: 'set_format' }),
        response_body: JSON.stringify({ success: true }),
        status_code: 200,
        duration_ms: 200,
        error_message: null,
      };

      const id = recorder.record(entry);
      const retrieved = recorder.getById(id!);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(id);
      expect(retrieved?.tool_name).toBe('sheets_format');
      expect(retrieved?.action).toBe('set_format');
    });

    it('returns null for non-existent ID', () => {
      const retrieved = recorder.getById(99999);
      expect(retrieved).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Insert test data
      recorder.record({
        timestamp: Date.now() - 10000,
        tool_name: 'sheets_data',
        action: 'read',
        spreadsheet_id: 'test-1',
        request_body: '{}',
        response_body: '{}',
        status_code: 200,
        duration_ms: 100,
        error_message: null,
      });

      recorder.record({
        timestamp: Date.now() - 5000,
        tool_name: 'sheets_data',
        action: 'write',
        spreadsheet_id: 'test-1',
        request_body: '{}',
        response_body: '{}',
        status_code: 200,
        duration_ms: 150,
        error_message: null,
      });

      recorder.record({
        timestamp: Date.now(),
        tool_name: 'sheets_core',
        action: 'get',
        spreadsheet_id: 'test-2',
        request_body: '{}',
        response_body: '{}',
        status_code: 500,
        duration_ms: 50,
        error_message: 'Failed',
      });
    });

    it('queries all requests without filter', () => {
      const results = recorder.query({});
      expect(results.length).toBe(3);
    });

    it('filters by tool name', () => {
      const results = recorder.query({ tool_name: 'sheets_data' });
      expect(results.length).toBe(2);
      expect(results.every((r) => r.tool_name === 'sheets_data')).toBe(true);
    });

    it('filters by action', () => {
      const results = recorder.query({ action: 'read' });
      expect(results.length).toBe(1);
      expect(results[0].action).toBe('read');
    });

    it('filters by spreadsheet ID', () => {
      const results = recorder.query({ spreadsheet_id: 'test-1' });
      expect(results.length).toBe(2);
      expect(results.every((r) => r.spreadsheet_id === 'test-1')).toBe(true);
    });

    it('filters by status code', () => {
      const results = recorder.query({ status_code: 500 });
      expect(results.length).toBe(1);
      expect(results[0].status_code).toBe(500);
    });

    it('filters by has_error', () => {
      const results = recorder.query({ has_error: true });
      expect(results.length).toBe(1);
      expect(results[0].error_message).toBe('Failed');
    });

    it('respects limit', () => {
      const results = recorder.query({ limit: 2 });
      expect(results.length).toBe(2);
    });

    it('returns results in descending timestamp order', () => {
      const results = recorder.query({});
      expect(results[0].timestamp).toBeGreaterThanOrEqual(results[1].timestamp);
      expect(results[1].timestamp).toBeGreaterThanOrEqual(results[2].timestamp);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      // Insert test data
      recorder.record({
        timestamp: Date.now(),
        tool_name: 'sheets_data',
        action: 'read',
        spreadsheet_id: 'test-1',
        request_body: '{}',
        response_body: '{}',
        status_code: 200,
        duration_ms: 100,
        error_message: null,
      });

      recorder.record({
        timestamp: Date.now(),
        tool_name: 'sheets_data',
        action: 'write',
        spreadsheet_id: 'test-1',
        request_body: '{}',
        response_body: '{}',
        status_code: 200,
        duration_ms: 150,
        error_message: null,
      });

      recorder.record({
        timestamp: Date.now(),
        tool_name: 'sheets_core',
        action: 'get',
        spreadsheet_id: 'test-2',
        request_body: '{}',
        response_body: '{}',
        status_code: 500,
        duration_ms: 50,
        error_message: 'Failed',
      });
    });

    it('returns correct total count', () => {
      const stats = recorder.getStats();
      expect(stats.total).toBe(3);
    });

    it('returns correct by_tool counts', () => {
      const stats = recorder.getStats();
      expect(stats.by_tool['sheets_data']).toBe(2);
      expect(stats.by_tool['sheets_core']).toBe(1);
    });

    it('returns correct by_status counts', () => {
      const stats = recorder.getStats();
      expect(stats.by_status[200]).toBe(2);
      expect(stats.by_status[500]).toBe(1);
    });

    it('returns correct error count', () => {
      const stats = recorder.getStats();
      expect(stats.errors).toBe(1);
    });

    it('returns date range', () => {
      const stats = recorder.getStats();
      expect(stats.date_range).not.toBeNull();
      expect(stats.date_range?.earliest).toBeTypeOf('number');
      expect(stats.date_range?.latest).toBeTypeOf('number');
    });
  });

  describe('cleanup', () => {
    it('deletes requests older than specified time', () => {
      const now = Date.now();

      // Insert old and recent requests
      recorder.record({
        timestamp: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        tool_name: 'sheets_data',
        action: 'read',
        spreadsheet_id: 'test-old',
        request_body: '{}',
        response_body: '{}',
        status_code: 200,
        duration_ms: 100,
        error_message: null,
      });

      recorder.record({
        timestamp: now, // Recent
        tool_name: 'sheets_data',
        action: 'read',
        spreadsheet_id: 'test-recent',
        request_body: '{}',
        response_body: '{}',
        status_code: 200,
        duration_ms: 100,
        error_message: null,
      });

      // Cleanup requests older than 5 days
      const deleted = recorder.cleanup(5 * 24 * 60 * 60 * 1000);

      expect(deleted).toBe(1);

      const remaining = recorder.query({});
      expect(remaining.length).toBe(1);
      expect(remaining[0].spreadsheet_id).toBe('test-recent');
    });
  });
});
