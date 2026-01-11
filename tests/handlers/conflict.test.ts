/**
 * ServalSheets - Conflict Handler Tests
 *
 * Tests for conflict detection and resolution operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictHandler } from '../../src/handlers/conflict.js';
import { SheetsConflictOutputSchema } from '../../src/schemas/conflict.js';
import type { ConflictDetector } from '../../src/services/conflict-detector.js';
import type {
  Conflict,
  ConflictResolutionResult,
  RangeVersion,
} from '../../src/types/conflict.js';

// Mock the conflict detector singleton getter
vi.mock('../../src/services/conflict-detector.js', () => {
  let mockDetector: ConflictDetector | null = null;

  return {
    getConflictDetector: vi.fn(() => {
      if (!mockDetector) {
        throw new Error('Mock conflict detector not initialized');
      }
      return mockDetector;
    }),
    __setMockDetector: (detector: ConflictDetector) => {
      mockDetector = detector;
    },
  };
});

// Import the mocked module
import { getConflictDetector } from '../../src/services/conflict-detector.js';
const mockModule = await import('../../src/services/conflict-detector.js');

// Helper to create mock conflict detector
const createMockConflictDetector = (): ConflictDetector => ({
  detectConflict: vi.fn(),
  resolveConflict: vi.fn(),
  trackVersion: vi.fn(),
  getStats: vi.fn(),
  resetStats: vi.fn(),
  getActiveConflicts: vi.fn(),
  clearCaches: vi.fn(),
} as any);

// Helper to create mock RangeVersion
const createMockRangeVersion = (
  overrides: Partial<RangeVersion> = {}
): RangeVersion => ({
  spreadsheetId: 'test-spreadsheet-id',
  range: 'Sheet1!A1:B2',
  lastModified: Date.now(),
  modifiedBy: 'user@example.com',
  checksum: 'abc123',
  version: 1,
  ...overrides,
});

// Helper to create mock Conflict
const createMockConflict = (overrides: Partial<Conflict> = {}): Conflict => ({
  id: 'conflict-123',
  type: 'concurrent_modification',
  severity: 'warning',
  spreadsheetId: 'test-spreadsheet-id',
  range: 'Sheet1!A1:B2',
  yourVersion: createMockRangeVersion({ version: 1, modifiedBy: 'you@example.com' }),
  currentVersion: createMockRangeVersion({ version: 2, modifiedBy: 'other@example.com' }),
  timeSinceModification: 60000,
  modifiedBy: 'other@example.com',
  description: 'Range was modified by other@example.com',
  suggestedResolution: 'merge',
  alternativeResolutions: ['overwrite', 'merge', 'cancel', 'last_write_wins'],
  timestamp: Date.now(),
  autoResolvable: true,
  ...overrides,
});

describe('ConflictHandler', () => {
  let handler: ConflictHandler;
  let mockConflictDetector: ConflictDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConflictDetector = createMockConflictDetector();
    (mockModule as any).__setMockDetector(mockConflictDetector);
    handler = new ConflictHandler();
  });

  describe('detect action', () => {
    it('should return empty conflicts list with success message', async () => {
      const result = await handler.handle({
        action: 'detect',
        spreadsheetId: 'test-spreadsheet-id',
      });

      expect(result).toHaveProperty('response');
      expect(result.response.success).toBe(true);
      expect(result.response).toHaveProperty('action', 'detect');
      expect(result.response).toHaveProperty('conflicts');
      expect((result.response as any).conflicts).toEqual([]);
      expect((result.response as any).message).toContain('No conflicts detected');

      // Validate schema compliance
      const parseResult = SheetsConflictOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle detect with range parameter', async () => {
      const result = await handler.handle({
        action: 'detect',
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Sheet1!A1:B2',
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).conflicts).toEqual([]);
    });

    it('should handle detect with since parameter', async () => {
      const result = await handler.handle({
        action: 'detect',
        spreadsheetId: 'test-spreadsheet-id',
        since: Date.now() - 3600000, // 1 hour ago
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).action).toBe('detect');
    });

    it('should validate schema compliance for detect response', async () => {
      const result = await handler.handle({
        action: 'detect',
        spreadsheetId: 'test-spreadsheet-id',
        range: 'Sheet1!A1:Z10',
      });

      const parseResult = SheetsConflictOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('resolve action - successful resolutions', () => {
    it('should successfully resolve conflict with keep_local strategy', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'conflict-123',
        success: true,
        strategyUsed: 'overwrite',
        finalVersion: createMockRangeVersion({ version: 3 }),
        changesApplied: { range: 'Sheet1!A1:B2', totalChanges: 4 },
        duration: 100,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'conflict-123',
        strategy: 'keep_local',
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).action).toBe('resolve');
      expect((result.response as any).conflictId).toBe('conflict-123');
      expect((result.response as any).resolved).toBe(true);
      expect((result.response as any).resolution).toBeDefined();
      expect((result.response as any).resolution.strategy).toBe('keep_local');
      expect((result.response as any).resolution.version).toBe(3);

      expect(mockConflictDetector.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-123',
        strategy: 'overwrite',
        mergeData: undefined,
      });

      // Validate schema
      const parseResult = SheetsConflictOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should successfully resolve conflict with keep_remote strategy', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'conflict-456',
        success: true,
        strategyUsed: 'cancel',
        finalVersion: createMockRangeVersion({ version: 2 }),
        duration: 50,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'conflict-456',
        strategy: 'keep_remote',
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).resolved).toBe(true);
      expect((result.response as any).resolution.strategy).toBe('keep_remote');

      expect(mockConflictDetector.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-456',
        strategy: 'cancel',
        mergeData: undefined,
      });
    });

    it('should successfully resolve conflict with merge strategy', async () => {
      const mergedData = [['A1', 'B1'], ['A2', 'B2']];
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'conflict-789',
        success: true,
        strategyUsed: 'merge',
        finalVersion: createMockRangeVersion({ version: 3 }),
        changesApplied: { range: 'Sheet1!A1:B2', totalChanges: 4 },
        duration: 150,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'conflict-789',
        strategy: 'merge',
        mergedValue: mergedData,
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).resolution.strategy).toBe('merge');
      expect((result.response as any).resolution.finalValue).toBeDefined();

      expect(mockConflictDetector.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-789',
        strategy: 'merge',
        mergeData: mergedData,
      });
    });

    it('should successfully resolve conflict with manual strategy', async () => {
      const manualData = { customMerge: 'result' };
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'conflict-manual',
        success: true,
        strategyUsed: 'manual',
        finalVersion: createMockRangeVersion({ version: 4 }),
        duration: 200,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'conflict-manual',
        strategy: 'manual',
        mergedValue: manualData,
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).resolution.strategy).toBe('manual');

      expect(mockConflictDetector.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict-manual',
        strategy: 'manual',
        mergeData: manualData,
      });
    });
  });

  describe('resolve action - error scenarios', () => {
    it('should handle conflict not found error', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'nonexistent',
        success: false,
        strategyUsed: 'overwrite',
        duration: 10,
        error: new Error('Conflict not found'),
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'nonexistent',
        strategy: 'keep_local',
      });

      expect(result.response.success).toBe(false);
      expect((result.response as any).error).toBeDefined();
      expect((result.response as any).error.code).toBe('INTERNAL_ERROR');
      expect((result.response as any).error.message).toContain('Conflict not found');

      // Validate schema compliance for error
      const parseResult = SheetsConflictOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle resolution failure', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'conflict-fail',
        success: false,
        strategyUsed: 'merge',
        duration: 100,
        error: new Error('Merge failed: incompatible data types'),
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'conflict-fail',
        strategy: 'merge',
      });

      expect(result.response.success).toBe(false);
      expect((result.response as any).error.message).toContain('Merge failed');
    });

    it('should handle unexpected errors during resolution', async () => {
      mockConflictDetector.resolveConflict = vi.fn().mockRejectedValue(
        new Error('Network error')
      );

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'conflict-error',
        strategy: 'keep_local',
      });

      expect(result.response.success).toBe(false);
      expect((result.response as any).error).toBeDefined();
      expect((result.response as any).error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('strategy mapping', () => {
    it('should correctly map keep_local to overwrite', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'test',
        success: true,
        strategyUsed: 'overwrite',
        duration: 50,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      await handler.handle({
        action: 'resolve',
        conflictId: 'test',
        strategy: 'keep_local',
      });

      const call = (mockConflictDetector.resolveConflict as any).mock.calls[0][0];
      expect(call.strategy).toBe('overwrite');
    });

    it('should correctly map keep_remote to cancel', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'test',
        success: true,
        strategyUsed: 'cancel',
        duration: 50,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      await handler.handle({
        action: 'resolve',
        conflictId: 'test',
        strategy: 'keep_remote',
      });

      const call = (mockConflictDetector.resolveConflict as any).mock.calls[0][0];
      expect(call.strategy).toBe('cancel');
    });

    it('should correctly map merge to merge', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'test',
        success: true,
        strategyUsed: 'merge',
        duration: 50,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      await handler.handle({
        action: 'resolve',
        conflictId: 'test',
        strategy: 'merge',
      });

      const call = (mockConflictDetector.resolveConflict as any).mock.calls[0][0];
      expect(call.strategy).toBe('merge');
    });

    it('should correctly map manual to manual', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'test',
        success: true,
        strategyUsed: 'manual',
        duration: 50,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      await handler.handle({
        action: 'resolve',
        conflictId: 'test',
        strategy: 'manual',
      });

      const call = (mockConflictDetector.resolveConflict as any).mock.calls[0][0];
      expect(call.strategy).toBe('manual');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle conflict detector errors gracefully', async () => {
      // Mock resolveConflict to throw an error
      mockConflictDetector.resolveConflict = vi.fn().mockRejectedValue(
        new Error('Conflict detector error: database unavailable')
      );

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'test-id',
        strategy: 'keep_local',
      });

      expect(result.response.success).toBe(false);
      expect((result.response as any).error.code).toBe('INTERNAL_ERROR');
      expect((result.response as any).error.message).toContain('database unavailable');
    });

    it('should handle resolution without final version', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'test',
        success: true,
        strategyUsed: 'cancel',
        duration: 50,
        // No finalVersion provided
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'test',
        strategy: 'keep_remote',
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).resolution.version).toBe(0);
    });

    it('should handle resolution without changes applied', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'test',
        success: true,
        strategyUsed: 'cancel',
        finalVersion: createMockRangeVersion({ version: 2 }),
        duration: 50,
        // No changesApplied
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'test',
        strategy: 'keep_remote',
      });

      expect(result.response.success).toBe(true);
      expect((result.response as any).resolution.finalValue).toBeUndefined();
    });

    it('should validate all response fields match schema', async () => {
      const mockResolution: ConflictResolutionResult = {
        conflictId: 'schema-test',
        success: true,
        strategyUsed: 'merge',
        finalVersion: createMockRangeVersion({ version: 5 }),
        changesApplied: {
          range: 'Sheet1!A1:B2',
          totalChanges: 10,
        },
        duration: 125,
      };

      mockConflictDetector.resolveConflict = vi.fn().mockResolvedValue(mockResolution);

      const result = await handler.handle({
        action: 'resolve',
        conflictId: 'schema-test',
        strategy: 'merge',
        mergedValue: [['val1', 'val2']],
      });

      // Comprehensive schema validation
      const parseResult = SheetsConflictOutputSchema.safeParse(result);
      if (!parseResult.success) {
        console.error('Schema validation errors:', parseResult.error.errors);
      }
      expect(parseResult.success).toBe(true);

      // Verify structure
      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('success', true);
      expect((result.response as any)).toHaveProperty('action', 'resolve');
      expect((result.response as any)).toHaveProperty('conflictId');
      expect((result.response as any)).toHaveProperty('resolved');
      expect((result.response as any)).toHaveProperty('resolution');
    });
  });
});
