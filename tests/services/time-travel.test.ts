/**
 * Time-Travel Debugger Tests
 *
 * Tests for checkpoint management, replay, blame analysis, and branching.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeTravelDebugger } from '../../src/services/time-travel.js';
import { CheckpointManager } from '../../src/services/checkpoint-manager.js';
import { OperationReplay } from '../../src/services/operation-replay.js';
import type { OperationHistory } from '../../src/types/history.js';
import type { GoogleApiClient } from '../../src/services/google-api.js';

describe('TimeTravelDebugger', () => {
  let timeTravelDebugger: TimeTravelDebugger;
  let mockGoogleClient: GoogleApiClient;
  let mockHistoryService: {
    getAll: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockGoogleClient = {
      sheets: {
        spreadsheets: {
          get: vi.fn(),
          values: {
            get: vi.fn(),
            batchGet: vi.fn(),
          },
          batchUpdate: vi.fn(),
        },
      },
    } as unknown as GoogleApiClient;

    mockHistoryService = {
      getAll: vi.fn().mockReturnValue([]),
      getById: vi.fn(),
    };

    timeTravelDebugger = new TimeTravelDebugger({
      googleClient: mockGoogleClient,
      historyService: mockHistoryService as any,
      maxCheckpoints: 10,
      compressionEnabled: true,
      autoCheckpointInterval: 0, // Disable auto-checkpoint for tests
    });
  });

  describe('createCheckpoint', () => {
    it('creates checkpoint with current state', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: {
          spreadsheetId,
          properties: { title: 'Test Sheet' },
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      mockHistoryService.getAll.mockReturnValue([
        {
          id: 'op1',
          timestamp: new Date().toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A1', values: [[1]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
        },
      ]);

      const checkpoint = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'test-checkpoint');

      expect(checkpoint).toMatchObject({
        name: 'test-checkpoint',
        operations: expect.any(Array),
        state: expect.any(Object),
        timestamp: expect.any(Number),
      });
      expect(checkpoint.id).toMatch(/^chk-/);
      expect(checkpoint.operations).toHaveLength(1);
    });

    it('auto-prunes old checkpoints when max reached', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: {
          spreadsheetId,
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      // Create max + 1 checkpoints
      for (let i = 0; i < 11; i++) {
        await timeTravelDebugger.createCheckpoint(spreadsheetId, `checkpoint-${i}`);
      }

      const checkpoints = await timeTravelDebugger.listCheckpoints(spreadsheetId);
      expect(checkpoints).toHaveLength(10); // Max limit enforced
      expect(checkpoints[0]?.name).toBe('checkpoint-1'); // First was pruned
    });

    it('calculates checkpoint size with delta compression', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: {
          spreadsheetId,
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      const checkpoint1 = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'first');
      const checkpoint2 = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'second');

      // Second checkpoint should be smaller (delta from first)
      expect(checkpoint2.metadata?.deltaSize).toBeDefined();
      expect(checkpoint2.metadata?.deltaFrom).toBe(checkpoint1.id);
    });
  });

  describe('listCheckpoints', () => {
    it('returns checkpoints in chronological order', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: { spreadsheetId, sheets: [] },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      await timeTravelDebugger.createCheckpoint(spreadsheetId, 'checkpoint-1');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await timeTravelDebugger.createCheckpoint(spreadsheetId, 'checkpoint-2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await timeTravelDebugger.createCheckpoint(spreadsheetId, 'checkpoint-3');

      const checkpoints = await timeTravelDebugger.listCheckpoints(spreadsheetId);

      expect(checkpoints).toHaveLength(3);
      expect(checkpoints.map((c) => c.name)).toEqual([
        'checkpoint-1',
        'checkpoint-2',
        'checkpoint-3',
      ]);
    });
  });

  describe('deleteCheckpoint', () => {
    it('deletes checkpoint and updates dependencies', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: { spreadsheetId, sheets: [] },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      const checkpoint1 = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'first');
      const checkpoint2 = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'second');

      await timeTravelDebugger.deleteCheckpoint(checkpoint1.id);

      const checkpoints = await timeTravelDebugger.listCheckpoints(spreadsheetId);
      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0]?.id).toBe(checkpoint2.id);
    });
  });

  describe('replayToCheckpoint', () => {
    it('replays operations to restore checkpoint state', async () => {
      const spreadsheetId = 'test-spreadsheet';
      const operations: OperationHistory[] = [
        {
          id: 'op1',
          timestamp: new Date(Date.now() - 2000).toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A1', values: [[1]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
        },
        {
          id: 'op2',
          timestamp: new Date(Date.now() - 1000).toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A2', values: [[2]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
        },
      ];

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: { spreadsheetId, sheets: [] },
      });

      mockGoogleClient.sheets.spreadsheets.batchUpdate = vi.fn().mockResolvedValue({
        data: { replies: [{}, {}] },
      });

      mockHistoryService.getAll.mockReturnValue(operations);

      const checkpoint = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'test');

      // Add more operations after checkpoint
      operations.push({
        id: 'op3',
        timestamp: new Date().toISOString(),
        tool: 'sheets_data',
        action: 'write',
        params: { range: 'A3', values: [[3]] },
        result: 'success',
        duration: 100,
        spreadsheetId,
      });

      mockHistoryService.getAll.mockReturnValue(operations);

      const result = await timeTravelDebugger.replayToCheckpoint(checkpoint.id);

      expect(result.success).toBe(true);
      expect(result.operationsReplayed).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThanOrEqual(0); // Allow 0 in test environment
      expect(mockGoogleClient.sheets.spreadsheets.batchUpdate).toHaveBeenCalled();
    });

    it('throws error if checkpoint not found', async () => {
      await expect(timeTravelDebugger.replayToCheckpoint('invalid-id')).rejects.toThrow(
        'Checkpoint invalid-id not found'
      );
    });
  });

  describe('inspectState', () => {
    it('returns checkpoint state snapshot', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: {
          spreadsheetId,
          properties: { title: 'Test Sheet' },
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      const checkpoint = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'test');
      const state = await timeTravelDebugger.inspectState(checkpoint.id);

      expect(state).toMatchObject({
        properties: expect.any(Object),
        sheets: expect.any(Array),
      });
    });
  });

  describe('blameCell', () => {
    it('finds operations that modified a cell', async () => {
      const spreadsheetId = 'test-spreadsheet';
      const operations: OperationHistory[] = [
        {
          id: 'op1',
          timestamp: new Date(Date.now() - 3000).toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A1', values: [[1]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
          userId: 'user1',
        },
        {
          id: 'op2',
          timestamp: new Date(Date.now() - 2000).toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A1:B2', values: [[2, 3], [4, 5]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
          userId: 'user2',
        },
        {
          id: 'op3',
          timestamp: new Date(Date.now() - 1000).toISOString(),
          tool: 'sheets_format',
          action: 'set_background',
          params: { range: 'A1', backgroundColor: { red: 1, green: 0, blue: 0 } },
          result: 'success',
          duration: 100,
          spreadsheetId,
          userId: 'user1',
        },
      ];

      mockHistoryService.getAll.mockReturnValue(operations);

      const blame = await timeTravelDebugger.blameCell(spreadsheetId, 'A1');

      expect(blame).toHaveLength(3);
      expect(blame[0]).toMatchObject({
        range: 'A1',
        operation: expect.objectContaining({ id: 'op1' }),
        user: 'user1',
        changeType: 'value',
      });
      expect(blame[1]).toMatchObject({
        changeType: 'value',
        user: 'user2',
      });
      expect(blame[2]).toMatchObject({
        changeType: 'format',
        user: 'user1',
      });
    });

    it('returns empty array if cell never modified', async () => {
      mockHistoryService.getAll.mockReturnValue([]);

      const blame = await timeTravelDebugger.blameCell('test-spreadsheet', 'Z99');

      expect(blame).toEqual([]);
    });
  });

  describe('blameOperation', () => {
    it('returns detailed operation information', async () => {
      const operation: OperationHistory = {
        id: 'op1',
        timestamp: new Date().toISOString(),
        tool: 'sheets_data',
        action: 'write',
        params: { range: 'A1', values: [[1]] },
        result: 'success',
        duration: 100,
        spreadsheetId: 'test-spreadsheet',
        userId: 'user1',
        cellsAffected: 1,
      };

      mockHistoryService.getById.mockReturnValue(operation);

      const details = await timeTravelDebugger.blameOperation('op1');

      expect(details).toMatchObject({
        operation,
        affectedRanges: expect.any(Array),
        dependentOperations: expect.any(Array),
      });
    });
  });

  describe('createBranch', () => {
    it('creates new branch from current state', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: { spreadsheetId, sheets: [] },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      const checkpoint = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'base');
      const branch = await timeTravelDebugger.createBranch(spreadsheetId, 'experiment', checkpoint.id);

      expect(branch).toMatchObject({
        name: 'experiment',
        fromCheckpoint: checkpoint.id,
        spreadsheetId,
        createdAt: expect.any(Number),
      });
      expect(branch.id).toMatch(/^branch-/);
    });

    it('creates branch from latest checkpoint if none specified', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: { spreadsheetId, sheets: [] },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      await timeTravelDebugger.createCheckpoint(spreadsheetId, 'checkpoint-1');
      const checkpoint2 = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'checkpoint-2');

      const branch = await timeTravelDebugger.createBranch(spreadsheetId, 'experiment');

      expect(branch.fromCheckpoint).toBe(checkpoint2.id);
    });
  });

  describe('switchBranch', () => {
    it('switches to different branch', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: { spreadsheetId, sheets: [] },
      });

      mockGoogleClient.sheets.spreadsheets.batchUpdate = vi.fn().mockResolvedValue({
        data: { replies: [] },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      const checkpoint = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'base');
      const branch = await timeTravelDebugger.createBranch(spreadsheetId, 'experiment', checkpoint.id);

      await timeTravelDebugger.switchBranch(spreadsheetId, branch.name);

      const currentBranch = timeTravelDebugger.getCurrentBranch(spreadsheetId);
      expect(currentBranch).toBe(branch.name);
    });
  });

  describe('mergeBranch', () => {
    it('merges operations from source to target branch', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: { spreadsheetId, sheets: [] },
      });

      mockGoogleClient.sheets.spreadsheets.batchUpdate = vi.fn().mockResolvedValue({
        data: { replies: [] },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      const checkpoint = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'base');
      const branch1 = await timeTravelDebugger.createBranch(spreadsheetId, 'branch1', checkpoint.id);
      const branch2 = await timeTravelDebugger.createBranch(spreadsheetId, 'branch2', checkpoint.id);

      const result = await timeTravelDebugger.mergeBranch(spreadsheetId, branch1.name, branch2.name);

      expect(result).toMatchObject({
        success: true,
        operationsMerged: expect.any(Number),
        conflicts: expect.any(Array),
      });
    });
  });

  describe('getOperationHistory', () => {
    it('returns filtered operation history', async () => {
      const operations: OperationHistory[] = [
        {
          id: 'op1',
          timestamp: new Date(Date.now() - 3000).toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: {},
          result: 'success',
          duration: 100,
          spreadsheetId: 'test-spreadsheet',
        },
        {
          id: 'op2',
          timestamp: new Date(Date.now() - 2000).toISOString(),
          tool: 'sheets_format',
          action: 'set_background',
          params: {},
          result: 'success',
          duration: 100,
          spreadsheetId: 'test-spreadsheet',
        },
      ];

      mockHistoryService.getAll.mockImplementation((filter?: any) => {
        // Mock the filtering logic
        if (filter?.tool) {
          return operations.filter((op) => op.tool === filter.tool);
        }
        return operations;
      });

      const history = await timeTravelDebugger.getOperationHistory('test-spreadsheet', {
        tool: 'sheets_data',
        limit: 10,
      });

      expect(history).toHaveLength(1);
      expect(history[0]?.tool).toBe('sheets_data');
    });
  });

  describe('diffCheckpoints', () => {
    it('returns differences between two checkpoints', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: {
          spreadsheetId,
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      mockHistoryService.getAll.mockReturnValue([
        {
          id: 'op1',
          timestamp: new Date().toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A1', values: [[1]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
        },
      ]);

      const checkpoint1 = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'checkpoint-1');

      // Add more operations
      mockHistoryService.getAll.mockReturnValue([
        {
          id: 'op1',
          timestamp: new Date().toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A1', values: [[1]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
        },
        {
          id: 'op2',
          timestamp: new Date().toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A2', values: [[2]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
        },
      ]);

      const checkpoint2 = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'checkpoint-2');

      const diff = await timeTravelDebugger.diffCheckpoints(checkpoint1.id, checkpoint2.id);

      expect(diff).toMatchObject({
        checkpoint1: checkpoint1.id,
        checkpoint2: checkpoint2.id,
        operationsAdded: expect.any(Array),
        timeDelta: expect.any(Number),
      });
      expect(diff.operationsAdded.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('creates checkpoint in under 200ms', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: {
          spreadsheetId,
          sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
        },
      });

      mockHistoryService.getAll.mockReturnValue([]);

      const startTime = Date.now();
      await timeTravelDebugger.createCheckpoint(spreadsheetId, 'performance-test');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('handles 1000 operations in checkpoint', async () => {
      const spreadsheetId = 'test-spreadsheet';

      mockGoogleClient.sheets.spreadsheets.get = vi.fn().mockResolvedValue({
        data: { spreadsheetId, sheets: [] },
      });

      const operations: OperationHistory[] = [];
      for (let i = 0; i < 1000; i++) {
        operations.push({
          id: `op${i}`,
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          tool: 'sheets_data',
          action: 'write',
          params: { range: `A${i}`, values: [[i]] },
          result: 'success',
          duration: 100,
          spreadsheetId,
        });
      }

      mockHistoryService.getAll.mockReturnValue(operations);

      const checkpoint = await timeTravelDebugger.createCheckpoint(spreadsheetId, 'large-checkpoint');

      expect(checkpoint.operations).toHaveLength(1000);
    });
  });
});
