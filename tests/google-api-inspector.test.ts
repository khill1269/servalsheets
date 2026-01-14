import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GoogleApiInspector,
  getGoogleApiInspector,
  resetGoogleApiInspector,
} from '../../src/utils/google-api-inspector.js';

describe('GoogleApiInspector', () => {
  let inspector: GoogleApiInspector;

  beforeEach(() => {
    inspector = new GoogleApiInspector({ enabled: true, includeBody: true, maxHistorySize: 10 });
  });

  afterEach(() => {
    resetGoogleApiInspector();
  });

  describe('interceptRequest', () => {
    it('should intercept a Google API request', () => {
      const requestId = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: { Authorization: 'Bearer token123' },
        api: 'sheets',
        operation: 'spreadsheets.get',
      });

      expect(requestId).toBeTruthy();

      const pair = inspector.getRequestResponsePair(requestId);
      expect(pair).toBeUndefined(); // No response yet
    });

    it('should include request body when enabled', () => {
      const requestId = inspector.interceptRequest({
        method: 'POST',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123/values:append',
        headers: {},
        body: { values: [[1, 2, 3]] },
        api: 'sheets',
        operation: 'spreadsheets.values.append',
      });

      const history = inspector.getCallHistory();
      // Request only, no response yet, so history is empty
      expect(history).toHaveLength(0);
    });

    it('should return empty string when disabled', () => {
      const disabledInspector = new GoogleApiInspector({ enabled: false });
      const requestId = disabledInspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });

      expect(requestId).toBe('');
    });
  });

  describe('recordResponse', () => {
    it('should record response for a request', () => {
      const requestId = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });

      inspector.recordResponse(requestId, {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { spreadsheetId: 'abc123', properties: { title: 'My Sheet' } },
        duration: 150,
        quotaUsed: { reads: 1, writes: 0 },
      });

      const pair = inspector.getRequestResponsePair(requestId);
      expect(pair).toBeDefined();
      expect(pair?.response.status).toBe(200);
      expect(pair?.response.duration).toBe(150);
      expect(pair?.response.quotaUsed?.reads).toBe(1);
    });

    it('should add to call history', () => {
      const requestId = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });

      inspector.recordResponse(requestId, {
        status: 200,
        headers: {},
        duration: 100,
      });

      const history = inspector.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.request.method).toBe('GET');
      expect(history[0]?.response.status).toBe(200);
    });

    it('should maintain history size limit', () => {
      const smallInspector = new GoogleApiInspector({ enabled: true, maxHistorySize: 3 });

      // Add 5 requests/responses
      for (let i = 0; i < 5; i++) {
        const reqId = smallInspector.interceptRequest({
          method: 'GET',
          url: `https://sheets.googleapis.com/v4/spreadsheets/id${i}`,
          headers: {},
          api: 'sheets',
          operation: 'spreadsheets.get',
        });

        smallInspector.recordResponse(reqId, {
          status: 200,
          headers: {},
          duration: 100,
        });
      }

      const history = smallInspector.getCallHistory();
      expect(history).toHaveLength(3);
    });
  });

  describe('exportCurl', () => {
    it('should export GET request as curl command', () => {
      const requestId = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: { Authorization: 'Bearer token123' },
        api: 'sheets',
        operation: 'spreadsheets.get',
      });

      const curl = inspector.exportCurl(requestId);

      expect(curl).toContain("curl -X GET 'https://sheets.googleapis.com/v4/spreadsheets/abc123'");
      expect(curl).toContain("-H 'Authorization: Bearer token123'");
    });

    it('should export POST request with body', () => {
      const requestId = inspector.interceptRequest({
        method: 'POST',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123/values:append',
        headers: { 'Content-Type': 'application/json' },
        body: { values: [[1, 2, 3]] },
        api: 'sheets',
        operation: 'spreadsheets.values.append',
      });

      const curl = inspector.exportCurl(requestId);

      expect(curl).toContain("curl -X POST");
      expect(curl).toContain("-d '{\"values\":[[1,2,3]]}'");
    });

    it('should throw for non-existent request', () => {
      expect(() => {
        inspector.exportCurl('non-existent-id');
      }).toThrow('Request not found');
    });
  });

  describe('exportPostman', () => {
    it('should export as Postman collection', () => {
      const req1 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });

      const req2 = inspector.interceptRequest({
        method: 'POST',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123/values:append',
        headers: {},
        body: { values: [[1, 2]] },
        api: 'sheets',
        operation: 'spreadsheets.values.append',
      });

      const postman = inspector.exportPostman([req1, req2]);
      const collection = JSON.parse(postman);

      expect(collection).toHaveProperty('info');
      expect(collection.info.name).toBe('ServalSheets API Calls');
      expect(collection).toHaveProperty('item');
      expect(collection.item).toHaveLength(2);
      expect(collection.item[0].name).toBe('spreadsheets.get');
      expect(collection.item[1].name).toBe('spreadsheets.values.append');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      // Sheets API call (success)
      const req1 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });
      inspector.recordResponse(req1, {
        status: 200,
        headers: {},
        duration: 100,
        quotaUsed: { reads: 1, writes: 0 },
      });

      // Drive API call (success)
      const req2 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://www.googleapis.com/drive/v3/files/abc123',
        headers: {},
        api: 'drive',
        operation: 'files.get',
      });
      inspector.recordResponse(req2, {
        status: 200,
        headers: {},
        duration: 150,
        quotaUsed: { reads: 1, writes: 0 },
      });

      // Sheets API call (error)
      const req3 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/invalid',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });
      inspector.recordResponse(req3, {
        status: 404,
        headers: {},
        duration: 50,
      });

      const stats = inspector.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byApi.sheets).toBe(2);
      expect(stats.byApi.drive).toBe(1);
      expect(stats.byStatus[200]).toBe(2);
      expect(stats.byStatus[404]).toBe(1);
      expect(stats.byOperation['spreadsheets.get']).toBe(2);
      expect(stats.totalDuration).toBe(300);
      expect(stats.averageDuration).toBe(100);
      expect(stats.totalQuotaReads).toBe(2);
      expect(stats.totalQuotaWrites).toBe(0);
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('getFailedRequests', () => {
    it('should return failed requests', () => {
      // Success
      const req1 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });
      inspector.recordResponse(req1, { status: 200, headers: {}, duration: 100 });

      // Error
      const req2 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/invalid',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });
      inspector.recordResponse(req2, { status: 404, headers: {}, duration: 50 });

      const failed = inspector.getFailedRequests();

      expect(failed).toHaveLength(1);
      expect(failed[0]?.response.status).toBe(404);
    });

    it('should respect limit parameter', () => {
      // Add multiple failures
      for (let i = 0; i < 5; i++) {
        const reqId = inspector.interceptRequest({
          method: 'GET',
          url: `https://sheets.googleapis.com/v4/spreadsheets/id${i}`,
          headers: {},
          api: 'sheets',
          operation: 'spreadsheets.get',
        });
        inspector.recordResponse(reqId, { status: 404, headers: {}, duration: 50 });
      }

      const failed = inspector.getFailedRequests(3);
      expect(failed).toHaveLength(3);
    });
  });

  describe('getSlowRequests', () => {
    it('should return slow requests sorted by duration', () => {
      const req1 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc1',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });
      inspector.recordResponse(req1, { status: 200, headers: {}, duration: 2000 });

      const req2 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc2',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });
      inspector.recordResponse(req2, { status: 200, headers: {}, duration: 500 });

      const req3 = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc3',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });
      inspector.recordResponse(req3, { status: 200, headers: {}, duration: 1500 });

      const slow = inspector.getSlowRequests(1000, 10);

      expect(slow).toHaveLength(2);
      expect(slow[0]?.response.duration).toBe(2000); // Sorted by duration desc
      expect(slow[1]?.response.duration).toBe(1500);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      const reqId = inspector.interceptRequest({
        method: 'GET',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/abc123',
        headers: {},
        api: 'sheets',
        operation: 'spreadsheets.get',
      });
      inspector.recordResponse(reqId, { status: 200, headers: {}, duration: 100 });

      expect(inspector.getCallHistory()).toHaveLength(1);

      inspector.clear();

      expect(inspector.getCallHistory()).toHaveLength(0);
      expect(inspector.getStats().total).toBe(0);
    });
  });

  describe('global inspector', () => {
    afterEach(() => {
      resetGoogleApiInspector();
      delete process.env.GOOGLE_API_TRACE_ENABLED;
      delete process.env.GOOGLE_API_TRACE_BODY;
    });

    it('should create global inspector with environment config', () => {
      process.env.GOOGLE_API_TRACE_ENABLED = 'true';
      process.env.GOOGLE_API_TRACE_BODY = 'true';

      const globalInspector = getGoogleApiInspector();

      expect(globalInspector).toBeDefined();
      expect(globalInspector.isEnabled()).toBe(true);
    });

    it('should reuse existing global inspector', () => {
      const inspector1 = getGoogleApiInspector();
      const inspector2 = getGoogleApiInspector();

      expect(inspector1).toBe(inspector2);
    });
  });
});
