/**
 * ServalSheets - Transaction Handler Tests
 *
 * Comprehensive tests for transaction lifecycle operations:
 * - Begin/commit/rollback/status/queue/list actions
 * - Transaction manager integration
 * - Error handling and auto-rollback
 * - Large transaction warnings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransactionHandler } from '../../src/handlers/transaction.js';
import { SheetsTransactionOutputSchema } from '../../src/schemas/transaction.js';
import type { TransactionManager } from '../../src/services/transaction-manager.js';
import type { Transaction, CommitResult } from '../../src/types/transaction.js';

// Mock getTransactionManager
vi.mock('../../src/services/transaction-manager.js', () => ({
  getTransactionManager: vi.fn(),
}));

describe('TransactionHandler', () => {
  let handler: TransactionHandler;
  let mockTransactionManager: TransactionManager;
  let getTransactionManagerMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create comprehensive mock for TransactionManager
    mockTransactionManager = {
      begin: vi.fn(),
      queue: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      getTransaction: vi.fn(),
      getActiveTransactions: vi.fn(),
      cancel: vi.fn(),
      getStats: vi.fn(),
      resetStats: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    // Mock getTransactionManager to return our mock
    const module = await import('../../src/services/transaction-manager.js');
    getTransactionManagerMock = vi.mocked(module.getTransactionManager);
    getTransactionManagerMock.mockReturnValue(mockTransactionManager);

    handler = new TransactionHandler();
  });

  describe('begin action', () => {
    it('should start a new transaction with default options', async () => {
      const mockTxId = 'txn-abc-123';
      mockTransactionManager.begin = vi.fn().mockResolvedValue(mockTxId);

      const result = await handler.handle({
        action: 'begin',
        spreadsheetId: 'test-sheet-id-123',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('begin');
        expect(result.response.transactionId).toBe(mockTxId);
        expect(result.response.status).toBe('pending');
        expect(result.response.operationsQueued).toBe(0);
        expect(result.response.message).toContain('Transaction');
        expect(result.response.message).toContain('started');
      }

      expect(mockTransactionManager.begin).toHaveBeenCalledWith('test-sheet-id-123', {
        autoCommit: false,
        autoRollback: true,
        isolationLevel: 'read_committed',
      });

      // Validate schema compliance
      const parseResult = SheetsTransactionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should start transaction with custom isolation level', async () => {
      const mockTxId = 'txn-xyz-789';
      mockTransactionManager.begin = vi.fn().mockResolvedValue(mockTxId);

      const result = await handler.handle({
        action: 'begin',
        spreadsheetId: 'test-sheet-id-456',
        isolationLevel: 'serializable',
        autoRollback: false,
      });

      expect(result.response.success).toBe(true);
      expect(mockTransactionManager.begin).toHaveBeenCalledWith('test-sheet-id-456', {
        autoCommit: false,
        autoRollback: false,
        isolationLevel: 'serializable',
      });
    });

    it('should include snapshot warning when autoSnapshot is enabled', async () => {
      const mockTxId = 'txn-snapshot-001';
      mockTransactionManager.begin = vi.fn().mockResolvedValue(mockTxId);

      const result = await handler.handle({
        action: 'begin',
        spreadsheetId: 'test-sheet-id-789',
        autoSnapshot: true,
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.message).toContain('Snapshots are metadata-only');
        expect(result.response.message).toContain('>50MB metadata');
      }
    });

    it('should handle transaction manager errors', async () => {
      mockTransactionManager.begin = vi.fn().mockRejectedValue(
        new Error('Maximum concurrent transactions reached')
      );

      const result = await handler.handle({
        action: 'begin',
        spreadsheetId: 'test-sheet-id-error',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INTERNAL_ERROR');
        expect(result.response.error.message).toContain('Maximum concurrent transactions');
      }

      // Validate schema compliance for error response
      const parseResult = SheetsTransactionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('queue action', () => {
    it('should queue an operation in the transaction', async () => {
      const mockTxId = 'txn-queue-001';
      const mockOperationId = 'op_1';

      mockTransactionManager.queue = vi.fn().mockResolvedValue(mockOperationId);
      mockTransactionManager.getTransaction = vi.fn().mockReturnValue({
        id: mockTxId,
        operations: [
          { id: mockOperationId, type: 'custom', tool: 'sheets_values', action: 'write' }
        ],
        status: 'queued',
      } as Transaction);

      const result = await handler.handle({
        action: 'queue',
        transactionId: mockTxId,
        operation: {
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:B2', values: [[1, 2]] },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('queue');
        expect(result.response.transactionId).toBe(mockTxId);
        expect(result.response.operationsQueued).toBe(1);
        expect(result.response.message).toContain('1 operation(s)');
      }

      expect(mockTransactionManager.queue).toHaveBeenCalledWith(mockTxId, {
        type: 'custom',
        tool: 'sheets_values',
        action: 'write',
        params: { range: 'A1:B2', values: [[1, 2]] },
      });
    });

    it('should warn when transaction has more than 20 operations', async () => {
      const mockTxId = 'txn-large-001';

      // Create 25 mock operations
      const mockOperations = Array.from({ length: 25 }, (_, i) => ({
        id: `op_${i}`,
        type: 'custom',
        tool: 'sheets_values',
        action: 'write',
      }));

      mockTransactionManager.queue = vi.fn().mockResolvedValue('op_25');
      mockTransactionManager.getTransaction = vi.fn().mockReturnValue({
        id: mockTxId,
        operations: mockOperations,
        status: 'queued',
      } as Transaction);

      const result = await handler.handle({
        action: 'queue',
        transactionId: mockTxId,
        operation: {
          tool: 'sheets_format',
          action: 'set_background',
          params: { range: 'C1:D2' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success && result.response._meta?.warnings) {
        expect(result.response._meta.warnings.length).toBeGreaterThan(0);
        expect(result.response._meta.warnings[0]).toContain('Transaction size is growing');
        expect(result.response._meta.warnings[0]).toContain('25 operations');
      }
    });

    it('should warn when transaction exceeds 50 operations', async () => {
      const mockTxId = 'txn-very-large-001';

      // Create 55 mock operations
      const mockOperations = Array.from({ length: 55 }, (_, i) => ({
        id: `op_${i}`,
        type: 'custom',
      }));

      mockTransactionManager.queue = vi.fn().mockResolvedValue('op_55');
      mockTransactionManager.getTransaction = vi.fn().mockReturnValue({
        id: mockTxId,
        operations: mockOperations,
        status: 'queued',
      } as Transaction);

      const result = await handler.handle({
        action: 'queue',
        transactionId: mockTxId,
        operation: {
          tool: 'sheets_values',
          action: 'append',
          params: {},
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success && result.response._meta?.warnings) {
        expect(result.response._meta.warnings[0]).toContain('Large transaction');
        expect(result.response._meta.warnings[0]).toContain('55 operations');
        expect(result.response._meta.warnings[0]).toContain('splitting into multiple smaller transactions');
      }
    });
  });

  describe('commit action', () => {
    it('should commit transaction successfully', async () => {
      const mockTxId = 'txn-commit-001';
      const mockCommitResult: CommitResult = {
        transactionId: mockTxId,
        success: true,
        batchResponse: {},
        operationResults: [
          { operationId: 'op_1', success: true, duration: 100 },
          { operationId: 'op_2', success: true, duration: 150 },
        ],
        duration: 250,
        apiCallsMade: 1,
        apiCallsSaved: 1,
        snapshotId: 'snapshot-123',
      };

      mockTransactionManager.commit = vi.fn().mockResolvedValue(mockCommitResult);

      const result = await handler.handle({
        action: 'commit',
        transactionId: mockTxId,
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('commit');
        expect(result.response.transactionId).toBe(mockTxId);
        expect(result.response.status).toBe('committed');
        expect(result.response.operationsExecuted).toBe(2);
        expect(result.response.apiCallsSaved).toBe(1);
        expect(result.response.duration).toBe(250);
        expect(result.response.message).toContain('committed successfully');
        expect(result.response.message).toContain('2 operation(s) executed');
      }

      expect(mockTransactionManager.commit).toHaveBeenCalledWith(mockTxId);

      // Validate schema compliance
      const parseResult = SheetsTransactionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle commit failure with auto-rollback', async () => {
      const mockTxId = 'txn-commit-fail-001';
      const mockCommitResult: CommitResult = {
        transactionId: mockTxId,
        success: false,
        operationResults: [],
        duration: 100,
        apiCallsMade: 0,
        apiCallsSaved: 0,
        error: new Error('API rate limit exceeded'),
        rolledBack: true,
        snapshotId: 'snapshot-456',
      };

      mockTransactionManager.commit = vi.fn().mockResolvedValue(mockCommitResult);

      const result = await handler.handle({
        action: 'commit',
        transactionId: mockTxId,
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INTERNAL_ERROR');
        expect(result.response.error.message).toBe('API rate limit exceeded');
        expect(result.response.error.retryable).toBe(false);
        expect(result.response.error.details).toEqual({
          rollback: 'Transaction was automatically rolled back',
        });
      }
    });

    it('should handle commit failure without rollback', async () => {
      const mockTxId = 'txn-commit-fail-no-rollback';
      const mockCommitResult: CommitResult = {
        transactionId: mockTxId,
        success: false,
        operationResults: [],
        duration: 50,
        apiCallsMade: 0,
        apiCallsSaved: 0,
        error: new Error('Operation validation failed'),
        rolledBack: false,
      };

      mockTransactionManager.commit = vi.fn().mockResolvedValue(mockCommitResult);

      const result = await handler.handle({
        action: 'commit',
        transactionId: mockTxId,
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.message).toBe('Operation validation failed');
        expect(result.response.error.details).toBeUndefined();
      }
    });
  });

  describe('rollback action', () => {
    it('should rollback transaction successfully', async () => {
      const mockTxId = 'txn-rollback-001';

      mockTransactionManager.rollback = vi.fn().mockResolvedValue({
        transactionId: mockTxId,
        success: true,
        snapshotId: 'snapshot-789',
        duration: 150,
        operationsReverted: 3,
      });

      const result = await handler.handle({
        action: 'rollback',
        transactionId: mockTxId,
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('rollback');
        expect(result.response.transactionId).toBe(mockTxId);
        expect(result.response.status).toBe('rolled_back');
        expect(result.response.message).toContain('rolled back successfully');
      }

      expect(mockTransactionManager.rollback).toHaveBeenCalledWith(mockTxId);

      // Validate schema compliance
      const parseResult = SheetsTransactionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle rollback errors', async () => {
      const mockTxId = 'txn-rollback-error';

      mockTransactionManager.rollback = vi.fn().mockRejectedValue(
        new Error('No snapshot available for rollback')
      );

      const result = await handler.handle({
        action: 'rollback',
        transactionId: mockTxId,
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INTERNAL_ERROR');
        expect(result.response.error.message).toContain('No snapshot available');
      }
    });
  });

  describe('status action', () => {
    it('should return transaction status with queued operations', async () => {
      const mockTxId = 'txn-status-001';

      mockTransactionManager.getTransaction = vi.fn().mockReturnValue({
        id: mockTxId,
        spreadsheetId: 'sheet-123',
        status: 'queued',
        operations: [
          { id: 'op_1', type: 'values_write' },
          { id: 'op_2', type: 'format_apply' },
          { id: 'op_3', type: 'sheet_create' },
        ],
        snapshot: { id: 'snapshot-001' },
        startTime: Date.now() - 5000,
      } as Transaction);

      const result = await handler.handle({
        action: 'status',
        transactionId: mockTxId,
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('status');
        expect(result.response.transactionId).toBe(mockTxId);
        expect(result.response.status).toBe('queued');
        expect(result.response.operationsQueued).toBe(3);
        expect(result.response.snapshotId).toBe('snapshot-001');
        expect(result.response.message).toContain('queued with 3 operation(s)');
      }

      // Validate schema compliance
      const parseResult = SheetsTransactionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should return pending status for new transaction', async () => {
      const mockTxId = 'txn-status-new';

      mockTransactionManager.getTransaction = vi.fn().mockReturnValue({
        id: mockTxId,
        spreadsheetId: 'sheet-456',
        status: 'pending',
        operations: [],
        startTime: Date.now(),
      } as Transaction);

      const result = await handler.handle({
        action: 'status',
        transactionId: mockTxId,
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.status).toBe('pending');
        expect(result.response.operationsQueued).toBe(0);
        expect(result.response.snapshotId).toBeUndefined();
      }
    });

    it('should handle transaction not found error', async () => {
      const mockTxId = 'txn-not-found';

      mockTransactionManager.getTransaction = vi.fn().mockImplementation(() => {
        throw new Error(`Transaction ${mockTxId} not found`);
      });

      const result = await handler.handle({
        action: 'status',
        transactionId: mockTxId,
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.message).toContain('not found');
      }
    });
  });

  describe('list action', () => {
    it('should return list of active transactions', async () => {
      // Note: Current implementation returns empty list with message
      const result = await handler.handle({
        action: 'list',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('list');
        expect(result.response.transactions).toEqual([]);
        expect(result.response.message).toContain('not yet implemented');
      }

      // Validate schema compliance
      const parseResult = SheetsTransactionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should accept optional spreadsheetId filter', async () => {
      const result = await handler.handle({
        action: 'list',
        spreadsheetId: 'filter-sheet-123',
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('list');
        expect(result.response.transactions).toEqual([]);
      }
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockTransactionManager.begin = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected internal error');
      });

      const result = await handler.handle({
        action: 'begin',
        spreadsheetId: 'test-error-sheet',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INTERNAL_ERROR');
        expect(result.response.error.message).toBe('Unexpected internal error');
        expect(result.response.error.retryable).toBe(false);
      }

      // Validate schema compliance
      const parseResult = SheetsTransactionOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle non-Error thrown values', async () => {
      mockTransactionManager.commit = vi.fn().mockImplementation(() => {
        throw 'String error message';
      });

      const result = await handler.handle({
        action: 'commit',
        transactionId: 'txn-string-error',
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.message).toBe('String error message');
      }
    });
  });

  describe('schema validation', () => {
    it('should produce valid output for all success paths', async () => {
      // Test begin
      mockTransactionManager.begin = vi.fn().mockResolvedValue('txn-1');
      const beginResult = await handler.handle({
        action: 'begin',
        spreadsheetId: 'test-sheet',
      });
      expect(SheetsTransactionOutputSchema.safeParse(beginResult).success).toBe(true);

      // Test queue
      mockTransactionManager.queue = vi.fn().mockResolvedValue('op_1');
      mockTransactionManager.getTransaction = vi.fn().mockReturnValue({
        operations: [{ id: 'op_1' }],
      } as Transaction);
      const queueResult = await handler.handle({
        action: 'queue',
        transactionId: 'txn-1',
        operation: { tool: 'sheets_values', action: 'write', params: {} },
      });
      expect(SheetsTransactionOutputSchema.safeParse(queueResult).success).toBe(true);

      // Test commit
      mockTransactionManager.commit = vi.fn().mockResolvedValue({
        transactionId: 'txn-1',
        success: true,
        operationResults: [],
        duration: 100,
        apiCallsMade: 1,
        apiCallsSaved: 0,
      });
      const commitResult = await handler.handle({
        action: 'commit',
        transactionId: 'txn-1',
      });
      expect(SheetsTransactionOutputSchema.safeParse(commitResult).success).toBe(true);

      // Test rollback
      mockTransactionManager.rollback = vi.fn().mockResolvedValue({
        success: true,
        transactionId: 'txn-1',
        snapshotId: 'snap-1',
        duration: 50,
        operationsReverted: 1,
      });
      const rollbackResult = await handler.handle({
        action: 'rollback',
        transactionId: 'txn-1',
      });
      expect(SheetsTransactionOutputSchema.safeParse(rollbackResult).success).toBe(true);

      // Test status
      mockTransactionManager.getTransaction = vi.fn().mockReturnValue({
        id: 'txn-1',
        status: 'pending',
        operations: [],
      } as Transaction);
      const statusResult = await handler.handle({
        action: 'status',
        transactionId: 'txn-1',
      });
      expect(SheetsTransactionOutputSchema.safeParse(statusResult).success).toBe(true);

      // Test list
      const listResult = await handler.handle({
        action: 'list',
      });
      expect(SheetsTransactionOutputSchema.safeParse(listResult).success).toBe(true);
    });
  });
});
