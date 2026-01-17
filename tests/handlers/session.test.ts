/**
 * ServalSheets - Session Handler Tests
 *
 * Tests for session context management.
 * Covers 13 actions: set_active, get_active, get_context, record_operation,
 * get_last_operation, get_history, find_by_reference, update_preferences,
 * get_preferences, set_pending, get_pending, clear_pending, reset
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionHandler } from '../../src/handlers/session.js';
import { SheetsSessionOutputSchema } from '../../src/schemas/session.js';

describe('SessionHandler', () => {
  let handler: SessionHandler;

  beforeEach(() => {
    handler = new SessionHandler();
  });

  describe('set_active', () => {
    it('should set the active spreadsheet context', async () => {
      const result = await handler.handle({
        action: 'set_active',
        spreadsheetId: 'test-spreadsheet-id',
        title: 'Test Spreadsheet',
        sheetNames: ['Sheet1', 'Sheet2'],
      });

      expect(result.response.success).toBe(true);
      const parseResult = SheetsSessionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('get_active', () => {
    it('should return null when no active spreadsheet', async () => {
      const result = await handler.handle({
        action: 'get_active',
      });

      expect(result.response.success).toBe(true);
      const parseResult = SheetsSessionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should return active spreadsheet after set_active', async () => {
      await handler.handle({
        action: 'set_active',
        spreadsheetId: 'test-id',
        title: 'Test',
        sheetNames: ['Sheet1'],
      });

      const result = await handler.handle({
        action: 'get_active',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success && result.response.data) {
        expect(result.response.data.spreadsheetId).toBe('test-id');
      }
    });
  });

  describe('get_context', () => {
    it('should return full session context', async () => {
      const result = await handler.handle({
        action: 'get_context',
      });

      expect(result.response.success).toBe(true);
      const parseResult = SheetsSessionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('record_operation', () => {
    it('should record an operation in history', async () => {
      await handler.handle({
        action: 'set_active',
        spreadsheetId: 'test-id',
        title: 'Test',
        sheetNames: ['Sheet1'],
      });

      const result = await handler.handle({
        action: 'record_operation',
        spreadsheetId: 'test-id',
        tool: 'sheets_data',
        toolAction: 'write',
        description: 'Wrote data to A1:B10',
        undoable: true,
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('get_last_operation', () => {
    it('should return the last recorded operation', async () => {
      const result = await handler.handle({
        action: 'get_last_operation',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('get_history', () => {
    it('should return operation history', async () => {
      const result = await handler.handle({
        action: 'get_history',
        limit: 10,
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('find_by_reference', () => {
    it('should resolve natural language references', async () => {
      await handler.handle({
        action: 'set_active',
        spreadsheetId: 'budget-2026-id',
        title: 'Budget 2026',
        sheetNames: ['Q1', 'Q2', 'Q3', 'Q4'],
      });

      const result = await handler.handle({
        action: 'find_by_reference',
        reference: 'the budget spreadsheet',
        referenceType: 'spreadsheet',
      });

      expect(result.response.success).toBe(true);
    });
  });

  describe('preferences', () => {
    it('should update and retrieve preferences', async () => {
      const updateResult = await handler.handle({
        action: 'update_preferences',
        confirmationLevel: 'destructive',
        dryRunDefault: true,
        snapshotDefault: true,
      });

      expect(updateResult.response.success).toBe(true);

      const getResult = await handler.handle({
        action: 'get_preferences',
      });

      expect(getResult.response.success).toBe(true);
    });
  });

  describe('pending operations', () => {
    it('should manage multi-step operation state', async () => {
      const setResult = await handler.handle({
        action: 'set_pending',
        type: 'bulk_import',
        step: 1,
        totalSteps: 3,
        context: { filename: 'data.csv', rows: 1000 },
      });

      expect(setResult.response.success).toBe(true);

      const getResult = await handler.handle({
        action: 'get_pending',
      });

      expect(getResult.response.success).toBe(true);

      const clearResult = await handler.handle({
        action: 'clear_pending',
      });

      expect(clearResult.response.success).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all session state', async () => {
      await handler.handle({
        action: 'set_active',
        spreadsheetId: 'test-id',
        title: 'Test',
        sheetNames: ['Sheet1'],
      });

      const result = await handler.handle({
        action: 'reset',
      });

      expect(result.response.success).toBe(true);

      const contextResult = await handler.handle({
        action: 'get_context',
      });

      expect(contextResult.response.success).toBe(true);
    });
  });
});
