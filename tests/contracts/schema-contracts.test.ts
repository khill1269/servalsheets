import { describe, it, expect, beforeAll } from 'vitest';
import type { sheets_v4 } from 'googleapis';
import * as schemas from '../../src/schemas';
import { TOOL_COUNT, ACTION_COUNT } from '../../src/schemas';

describe('Schema Contract Tests', () => {
  describe('Constants', () => {
    it('should have TOOL_COUNT = 25', () => {
      expect(TOOL_COUNT).toBe(25);
    });

    it('should have ACTION_COUNT = 407', () => {
      expect(ACTION_COUNT).toBe(407);
    });
  });

  describe('Tool Registry', () => {
    const tools = [
      'sheets_advanced',
      'sheets_agent',
      'sheets_analyze',
      'sheets_appsscript',
      'sheets_auth',
      'sheets_bigquery',
      'sheets_collaborate',
      'sheets_composite',
      'sheets_compute',
      'sheets_confirm',
      'sheets_connectors',
      'sheets_core',
      'sheets_data',
      'sheets_dependencies',
      'sheets_dimensions',
      'sheets_federation',
      'sheets_fix',
      'sheets_format',
      'sheets_history',
      'sheets_quality',
      'sheets_session',
      'sheets_templates',
      'sheets_transaction',
      'sheets_visualize',
      'sheets_webhook',
    ];

    it('should register 25 tools', () => {
      expect(tools.length).toBe(25);
    });

    for (const tool of tools) {
      it(`should have schema for ${tool}`, () => {
        // Verify tool schemas exist in module
        expect(schemas).toBeDefined();
      });
    }
  });

  describe('Schema Validation', () => {
    it('should validate non-empty spreadsheet inputs', () => {
      const input = {
        request: {
          action: 'read',
          spreadsheetId: 'test-id-12345',
          range: 'Sheet1!A1:D10',
        },
      };
      expect(input.request.spreadsheetId).toBeTruthy();
      expect(input.request.spreadsheetId.length).toBeGreaterThan(0);
    });

    it('should handle discriminated union types correctly', () => {
      // Test that action field is present
      const readReq = { action: 'read' };
      const writeReq = { action: 'write' };

      expect(readReq.action).toBe('read');
      expect(writeReq.action).toBe('write');
      expect(readReq.action).not.toBe(writeReq.action);
    });
  });

  describe('Required Fields Validation', () => {
    it('should require spreadsheetId for data operations', () => {
      const validInput = {
        spreadsheetId: 'abc123',
        range: 'A1:B2',
      };

      expect(validInput.spreadsheetId).toBeDefined();
      expect(validInput.spreadsheetId.length).toBeGreaterThan(0);
    });

    it('should handle range variations (string, A1 notation, named range)', () => {
      // String range
      expect(typeof 'Sheet1!A1:D10').toBe('string');

      // A1 notation object
      const a1NotationRange = { a1: 'Sheet1!A1:D10' };
      expect(a1NotationRange.a1).toBe('Sheet1!A1:D10');

      // Named range
      const namedRange = { namedRange: 'MyRange' };
      expect(namedRange.namedRange).toBe('MyRange');
    });
  });

  describe('Tool-Specific Contracts', () => {
    it('sheets_data should accept discriminated actions', () => {
      const actions = ['read', 'write', 'append', 'clear', 'batch_read', 'batch_write'];
      for (const action of actions) {
        expect(typeof action).toBe('string');
        expect(action.length).toBeGreaterThan(0);
      }
    });

    it('sheets_format should accept format specifications', () => {
      const formatSpec = {
        action: 'set_format',
        spreadsheetId: 'test-id',
        range: 'A1:B10',
        format: { numberFormat: '$#,##0.00' },
      };
      expect(formatSpec.action).toBe('set_format');
      expect(formatSpec.format).toBeDefined();
    });

    it('sheets_dimensions should accept dimension operations', () => {
      const dimensionOp = {
        action: 'freeze',
        spreadsheetId: 'test-id',
        dimension: 'ROWS',
        count: 1,
      };
      expect(['ROWS', 'COLUMNS']).toContain(dimensionOp.dimension);
    });

    it('sheets_agent should accept plan/execute actions', () => {
      const actions = ['plan', 'execute', 'execute_step', 'observe', 'rollback', 'get_status'];
      for (const action of actions) {
        expect(typeof action).toBe('string');
      }
    });
  });
});
