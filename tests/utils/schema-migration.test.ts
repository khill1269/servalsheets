/**
 * Schema Migration Tests
 *
 * Tests automatic schema migration between versions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateSchema,
  canMigrate,
  registerMigration,
  getAvailableMigrations,
  migrateRequest,
  migrateResponse,
  type MigrationFn,
} from '../../src/utils/schema-migration.js';
import type { SchemaVersion } from '../../src/middleware/schema-version.js';

describe('Schema Migration Utilities', () => {
  describe('migrateSchema', () => {
    it('returns data unchanged when from === to', () => {
      const data = { test: 'value' };
      const result = migrateSchema(data, 'v1', 'v1');
      expect(result).toEqual(data);
    });

    it('migrates v1 to v2 using built-in migration', () => {
      const v1Data = {
        request: {
          action: 'read',
          spreadsheetId: 'abc123',
        },
      };

      const result = migrateSchema(v1Data, 'v1', 'v2');

      // v2 adds 'operation' field (mapped from 'action')
      expect(result.request.operation).toBe('read');
      // v1 'action' field should still exist for backward compat
      expect(result.request.action).toBe('read');
    });

    it('migrates v2 to v1 using built-in migration', () => {
      const v2Data = {
        request: {
          operation: 'read',
          action: 'read', // Both exist during migration period
          spreadsheetId: 'abc123',
        },
      };

      const result = migrateSchema(v2Data, 'v2', 'v1');

      // v1 uses 'action' field
      expect(result.request.action).toBe('read');
      // v2 'operation' field should be removed
      expect(result.request.operation).toBeUndefined();
    });

    it('throws error for unsupported migration path', () => {
      const data = { test: 'value' };

      expect(() => {
        migrateSchema(data, 'v1' as SchemaVersion, 'v99' as SchemaVersion);
      }).toThrow('No migration path found');
    });

    it('handles multi-step migrations via BFS', () => {
      // Register intermediate migration: v1 → v1.5 → v2
      const v1_to_v1_5: MigrationFn = (data) => ({
        ...data,
        intermediateField: 'added',
      });
      const v1_5_to_v2: MigrationFn = (data) => ({
        ...data,
        request: {
          ...data.request,
          operation: data.request.action,
        },
      });

      registerMigration('v1', 'v1.5' as SchemaVersion, v1_to_v1_5);
      registerMigration('v1.5' as SchemaVersion, 'v2', v1_5_to_v2);

      const v1Data = {
        request: {
          action: 'read',
          spreadsheetId: 'abc123',
        },
      };

      // Should find path: v1 → v1.5 → v2
      const result = migrateSchema(v1Data, 'v1', 'v2');

      expect(result.intermediateField).toBe('added');
      expect(result.request.operation).toBe('read');
    });
  });

  describe('canMigrate', () => {
    it('returns true for same version', () => {
      expect(canMigrate('v1', 'v1')).toBe(true);
    });

    it('returns true for built-in migrations', () => {
      expect(canMigrate('v1', 'v2')).toBe(true);
      expect(canMigrate('v2', 'v1')).toBe(true);
    });

    it('returns false for unsupported migrations', () => {
      expect(canMigrate('v1' as SchemaVersion, 'v99' as SchemaVersion)).toBe(false);
    });
  });

  describe('getAvailableMigrations', () => {
    it('includes built-in v1 ↔ v2 migrations', () => {
      const migrations = getAvailableMigrations();

      const hasV1toV2 = migrations.some((m) => m.from === 'v1' && m.to === 'v2');
      const hasV2toV1 = migrations.some((m) => m.from === 'v2' && m.to === 'v1');

      expect(hasV1toV2).toBe(true);
      expect(hasV2toV1).toBe(true);
    });

    it('returns array of migration paths', () => {
      const migrations = getAvailableMigrations();

      expect(Array.isArray(migrations)).toBe(true);
      migrations.forEach((migration) => {
        expect(migration).toHaveProperty('from');
        expect(migration).toHaveProperty('to');
      });
    });
  });

  describe('migrateRequest', () => {
    it('migrates request data between versions', () => {
      const v1Request = {
        request: {
          action: 'read',
          spreadsheetId: 'abc123',
        },
      };

      const v2Request = migrateRequest(v1Request, 'v1', 'v2');

      expect(v2Request.request.operation).toBe('read');
    });
  });

  describe('migrateResponse', () => {
    it('migrates response data between versions', () => {
      const v1Response = {
        success: true,
        data: { values: [['A', 'B']] },
      };

      const v2Response = migrateResponse(v1Response, 'v1', 'v2');

      // Currently v1 and v2 responses have same shape
      expect(v2Response.success).toBe(true);
      expect(v2Response.data).toEqual({ values: [['A', 'B']] });
    });
  });

  describe('Migration Error Handling', () => {
    it('provides clear error message on migration failure', () => {
      const badMigration: MigrationFn = () => {
        throw new Error('Migration logic error');
      };

      registerMigration('v1', 'vBad' as SchemaVersion, badMigration);

      const data = { test: 'value' };

      expect(() => {
        migrateSchema(data, 'v1', 'vBad' as SchemaVersion);
      }).toThrow('Migration failed from v1 to vBad');
    });
  });

  describe('Real-World Migration Scenarios', () => {
    it('handles request with no action field (v1 → v2)', () => {
      const data = {
        request: {
          spreadsheetId: 'abc123',
        },
      };

      // Migration should handle missing action gracefully
      const result = migrateSchema(data, 'v1', 'v2');
      expect(result.request).toBeDefined();
    });

    it('handles nested request structure', () => {
      const data = {
        request: {
          action: 'batch',
          operations: [
            { action: 'read', spreadsheetId: 'abc1' },
            { action: 'write', spreadsheetId: 'abc2' },
          ],
        },
      };

      const result = migrateSchema(data, 'v1', 'v2');

      // Top-level action should be migrated
      expect(result.request.operation).toBe('batch');
      // Note: Built-in migration doesn't handle nested operations
      // In production, this would require custom migration logic
    });
  });

  describe('Bidirectional Migration Consistency', () => {
    it('v1 → v2 → v1 preserves original data', () => {
      const originalV1 = {
        request: {
          action: 'read',
          spreadsheetId: 'abc123',
          range: { a1: 'Sheet1!A1:B10' },
        },
      };

      const v2Data = migrateSchema(originalV1, 'v1', 'v2');
      const backToV1 = migrateSchema(v2Data, 'v2', 'v1');

      // Should get back original structure
      expect(backToV1.request.action).toBe('read');
      expect(backToV1.request.spreadsheetId).toBe('abc123');
      expect(backToV1.request.range).toEqual({ a1: 'Sheet1!A1:B10' });
    });

    it('v2 → v1 → v2 preserves original data', () => {
      const originalV2 = {
        request: {
          operation: 'read',
          action: 'read', // Both fields during transition
          spreadsheetId: 'abc123',
        },
      };

      const v1Data = migrateSchema(originalV2, 'v2', 'v1');
      const backToV2 = migrateSchema(v1Data, 'v1', 'v2');

      // Should preserve operation field
      expect(backToV2.request.operation).toBe('read');
      expect(backToV2.request.action).toBe('read');
    });
  });
});
