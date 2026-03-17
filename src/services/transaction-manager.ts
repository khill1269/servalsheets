/**
 * TransactionManager
 *
 * @purpose Atomic multi-operation transactions with automatic snapshots, rollback, and 80% API savings (N ops → 1 batchUpdate)
 * @category Core
 * @usage Use for multi-step operations requiring atomicity; queues operations, creates snapshot, executes as single batch, rolls back on error
 * @dependencies sheets_v4, logger, uuid
 * @stateful Yes - maintains active transactions map (txId → state), queued operations, snapshots, metrics (commits, rollbacks, API savings)
 * @singleton Yes - one instance per process to coordinate transactions and prevent conflicts
 *
 * @example
 * const txManager = new TransactionManager(sheetsClient, { autoSnapshot: true, timeout: 30000 });
 * const tx = await txManager.begin(spreadsheetId);
 * await txManager.queue(tx.id, { type: 'write', range: 'A1', values: [[1]] });
 * await txManager.queue(tx.id, { type: 'format', range: 'A1', format: { bold: true } });
 * await txManager.commit(tx.id); // Both ops in single API call
 */

import { promises as fsPromises, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import type { sheets_v4 } from 'googleapis';
import { buildGridRangeInput, toGridRange } from '../utils/google-sheets-helpers.js';
import {
  Transaction,
  TransactionStatus as _TransactionStatus,
  QueuedOperation,
  OperationType,
  TransactionSnapshot,
  CommitResult,
  RollbackResult,
  OperationResult,
  BatchRequest,
  BatchRequestEntry,
  SpreadsheetState,
  TransactionConfig,
  TransactionStats,
  TransactionEvent,
  TransactionListener,
} from '../types/transaction.js';
import { registerCleanup } from '../utils/resource-cleanup.js';
import { getEnv } from '../config/env.js';
import { ServiceError, ValidationError, NotFoundError } from '../core/errors.js';

interface WalEntry {
  seq?: number;
  txId: string;
  type: TransactionEvent['type'];
  ts: number;
  data?: unknown;
}

interface WalRecoveryTransaction {
  transactionId: string;
  spreadsheetId?: string;
  snapshotId?: string;
  queuedOperations: number;
  lastEventType: TransactionEvent['type'];
  lastEventTimestamp: number;
}

export interface WalRecoveryReport {
  enabled: boolean;
  walPath?: string;
  orphanedTransactions: WalRecoveryTransaction[];
}

/**
 * Transaction Manager - Handles multi-operation transactions with atomicity
 */
export class TransactionManager {
  private config: Required<Omit<TransactionConfig, 'googleClient' | 'walDir'>>;
  private googleClient?: TransactionConfig['googleClient'];
  private stats: TransactionStats;
  private activeTransactions: Map<string, Transaction>;
  private snapshots: Map<string, TransactionSnapshot>;
  private listeners: TransactionListener[];
  private operationIdCounter: number;
  // Phase 1: Timer cleanup
  private snapshotCleanupInterval?: NodeJS.Timeout;
  // DR-01: Write-ahead log
  private walEnabled: boolean;
  private walPath: string;
  private walSeq = 0;
  private walReady: Promise<void>;
  private walWriteChain: Promise<void>;
  private walOrphanedTransactions: WalRecoveryTransaction[];

  constructor(config: TransactionConfig = {}) {
    this.googleClient = config.googleClient;
    this.config = {
      enabled: config.enabled ?? true,
      autoSnapshot: config.autoSnapshot ?? true,
      autoRollback: config.autoRollback ?? false,
      maxOperationsPerTransaction: config.maxOperationsPerTransaction ?? 100,
      transactionTimeoutMs: config.transactionTimeoutMs ?? 300000, // 5 minutes
      snapshotRetentionMs: config.snapshotRetentionMs ?? 3600000, // 1 hour
      maxConcurrentTransactions: config.maxConcurrentTransactions ?? 10,
      verboseLogging: config.verboseLogging ?? false,
      defaultIsolationLevel: config.defaultIsolationLevel ?? 'read_committed',
    };

    this.stats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      rolledBackTransactions: 0,
      successRate: 0,
      avgTransactionDuration: 0,
      avgOperationsPerTransaction: 0,
      apiCallsSaved: 0,
      snapshotsCreated: 0,
      activeTransactions: 0,
      totalDataProcessed: 0,
    };

    this.activeTransactions = new Map();
    this.snapshots = new Map();
    this.listeners = [];
    this.operationIdCounter = 0;

    // Start background cleanup
    this.startSnapshotCleanup();

    // DR-01: Initialize write-ahead log (enabled when TRANSACTION_WAL_DIR is set)
    const walDir = config.walDir ?? process.env['TRANSACTION_WAL_DIR'];
    this.walEnabled = !!walDir;
    this.walPath = walDir ? join(walDir, 'transactions.wal.jsonl') : '';
    this.walWriteChain = Promise.resolve();
    this.walOrphanedTransactions = [];
    this.walReady = this.walEnabled ? this.initWal() : Promise.resolve();
  }

  /**
   * Begin a new transaction
   */
  async begin(
    spreadsheetId: string,
    options: {
      autoCommit?: boolean;
      autoRollback?: boolean;
      autoSnapshot?: boolean;
      isolationLevel?: 'read_uncommitted' | 'read_committed' | 'serializable';
      userId?: string;
    } = {}
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new ServiceError('Transactions are disabled', 'CONFIG_ERROR', 'TransactionManager');
    }

    if (this.activeTransactions.size >= this.config.maxConcurrentTransactions) {
      throw new ServiceError(
        'Maximum concurrent transactions reached',
        'QUOTA_EXCEEDED',
        'TransactionManager',
        true
      );
    }

    const transactionId = uuidv4();
    this.log(`Beginning transaction: ${transactionId}`);

    // Create snapshot if auto-snapshot enabled (per-call option overrides config)
    const takeSnapshot =
      options.autoSnapshot !== undefined ? options.autoSnapshot : this.config.autoSnapshot;
    let snapshot: TransactionSnapshot | undefined;
    if (takeSnapshot) {
      snapshot = await this.createSnapshot(spreadsheetId);
      this.log(`Created snapshot: ${snapshot.id}`);
    }

    const transaction: Transaction = {
      id: transactionId,
      spreadsheetId,
      operations: [],
      snapshot,
      status: 'pending',
      startTime: Date.now(),
      userId: options.userId,
      isolationLevel: options.isolationLevel ?? this.config.defaultIsolationLevel,
      autoCommit: options.autoCommit ?? false,
      autoRollback: options.autoRollback ?? this.config.autoRollback,
    };

    this.activeTransactions.set(transactionId, transaction);
    this.stats.totalTransactions++;
    this.stats.activeTransactions++;

    await this.emitEvent({
      type: 'begin',
      transactionId,
      timestamp: Date.now(),
      data: { spreadsheetId, snapshot: snapshot?.id },
    });

    return transactionId;
  }

  /**
   * Queue an operation in the transaction
   */
  async queue(
    transactionId: string,
    operation: {
      type: OperationType;
      tool: string;
      action: string;
      params: Record<string, unknown>;
      dependsOn?: string[];
      estimatedDuration?: number;
    }
  ): Promise<string> {
    const transaction = this.getTransaction(transactionId);

    // FIX: Allow both 'pending' and 'queued' states (Issue #4)
    // After first queue(), status changes to 'queued', so we need to accept both
    if (transaction.status !== 'pending' && transaction.status !== 'queued') {
      throw new ValidationError(
        `Transaction ${transactionId} is not in pending/queued state (current: ${transaction.status})`,
        'transactionId',
        'transaction in pending or queued state'
      );
    }

    if (transaction.operations.length >= this.config.maxOperationsPerTransaction) {
      throw new ServiceError(
        'Maximum operations per transaction reached',
        'QUOTA_EXCEEDED',
        'TransactionManager',
        false
      );
    }

    const operationId = `op_${this.operationIdCounter++}`;
    this.log(`Queuing operation ${operationId} in transaction ${transactionId}`);

    const queuedOp: QueuedOperation = {
      id: operationId,
      type: operation.type,
      tool: operation.tool,
      action: operation.action,
      params: operation.params,
      order: transaction.operations.length,
      estimatedDuration: operation.estimatedDuration,
      dependsOn: operation.dependsOn,
      status: 'pending',
      timestamp: Date.now(),
    };

    transaction.operations.push(queuedOp);
    transaction.status = 'queued';

    await this.emitEvent({
      type: 'queue',
      transactionId,
      timestamp: Date.now(),
      data: {
        operationId,
        operationType: operation.type,
        tool: operation.tool,
        action: operation.action,
        params: operation.params, // DR-01: stored for crash-recovery replay
      },
    });

    return operationId;
  }

  /**
   * Commit the transaction (execute all operations atomically)
   */
  async commit(transactionId: string): Promise<CommitResult> {
    const transaction = this.getTransaction(transactionId);
    const startTime = Date.now();

    this.log(`Committing transaction: ${transactionId}`);
    transaction.status = 'executing';

    try {
      // Validate all operations
      this.validateOperations(transaction);

      // Resolve sheet names to IDs for range-based operations
      const sheetNameMap = await this.buildSheetNameMap(transaction.spreadsheetId);

      // Merge operations into batch request
      const batchRequest = this.mergeToBatchRequest(transaction.operations, sheetNameMap);

      // Capture pre-commit cell values for rollback (write operations only)
      if (transaction.snapshot) {
        await this.capturePreCommitValues(transaction, transaction.snapshot);
      }

      // Execute batch request via Google Sheets API
      const batchResponse = await this.executeBatchRequest(transaction.spreadsheetId, batchRequest);

      // Process results
      const operationResults = this.processOperationResults(transaction.operations, batchResponse);

      // Check for failures
      const failedOps = operationResults.filter((r) => !r.success);
      if (failedOps.length > 0 && transaction.autoRollback) {
        throw new ServiceError(
          `${failedOps.length} operation(s) failed: ${failedOps[0]!.error?.message}`,
          'TRANSACTION_CONFLICT',
          'TransactionManager',
          true
        );
      }

      transaction.status = 'committed';
      transaction.endTime = Date.now();
      transaction.duration = transaction.endTime - transaction.startTime!;

      // Update stats
      this.stats.successfulTransactions++;
      this.updateStats(transaction);

      const apiCallsSaved = Math.max(0, transaction.operations.length - 1);
      this.stats.apiCallsSaved += apiCallsSaved;

      const result: CommitResult = {
        transactionId,
        success: true,
        batchResponse,
        operationResults,
        duration: Date.now() - startTime,
        apiCallsMade: 1,
        apiCallsSaved,
        snapshotId: transaction.snapshot?.id,
      };

      await this.emitEvent({
        type: 'commit',
        transactionId,
        timestamp: Date.now(),
        data: { success: true, operationCount: transaction.operations.length },
      });

      // DR-01: Compact WAL — remove completed transaction's entries
      if (this.walEnabled) {
        await this.compactWal(transactionId);
      }

      // Cleanup
      this.activeTransactions.delete(transactionId);
      this.stats.activeTransactions--;

      return result;
    } catch (error) {
      transaction.status = 'failed';
      transaction.endTime = Date.now();
      transaction.duration = transaction.endTime - transaction.startTime!;

      this.stats.failedTransactions++;
      this.updateStats(transaction);

      let rolledBack = false;
      let rollbackError: Error | undefined;

      // Auto-rollback if configured
      if (transaction.autoRollback && transaction.snapshot) {
        try {
          await this.rollback(transactionId);
          rolledBack = true;
        } catch (rbError) {
          rollbackError = rbError instanceof Error ? rbError : new Error(String(rbError));
        }
      }

      await this.emitEvent({
        type: 'fail',
        transactionId,
        timestamp: Date.now(),
        data: {
          error: error instanceof Error ? error.message : String(error),
          rolledBack,
        },
      });

      // DR-01: Compact WAL for terminal failed transactions.
      if (this.walEnabled) {
        await this.compactWal(transactionId);
      }

      // Cleanup
      this.activeTransactions.delete(transactionId);
      this.stats.activeTransactions--;

      const result: CommitResult = {
        transactionId,
        success: false,
        operationResults: [],
        duration: Date.now() - startTime,
        apiCallsMade: 0,
        apiCallsSaved: 0,
        error: error instanceof Error ? error : new Error(String(error)),
        rolledBack,
        snapshotId: transaction.snapshot?.id,
      };

      if (rollbackError && result.error) {
        result.error = new Error(
          `Transaction failed and rollback failed: ${result.error.message}, Rollback error: ${rollbackError.message}`
        );
      }

      return result;
    }
  }

  /**
   * Rollback a transaction
   */
  async rollback(transactionId: string): Promise<RollbackResult> {
    const transaction = this.getTransaction(transactionId);
    const startTime = Date.now();

    this.log(`Rolling back transaction: ${transactionId}`);

    const snapshot = transaction.snapshot;

    try {
      // Restore snapshot if one was created (metadata-only; see restoreSnapshot for details)
      if (snapshot) {
        await this.restoreSnapshot(snapshot);
      }

      transaction.status = 'rolled_back';
      this.stats.rolledBackTransactions++;

      await this.emitEvent({
        type: 'rollback',
        transactionId,
        timestamp: Date.now(),
        data: { snapshotId: snapshot?.id },
      });

      // DR-01: Compact WAL — remove rolled-back transaction's entries
      if (this.walEnabled) {
        await this.compactWal(transactionId);
      }

      return {
        transactionId,
        success: true,
        snapshotId: snapshot?.id ?? '',
        duration: Date.now() - startTime,
        operationsReverted: transaction.operations.length,
      };
    } catch (error) {
      return {
        transactionId,
        success: false,
        snapshotId: snapshot?.id ?? '',
        duration: Date.now() - startTime,
        operationsReverted: 0,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): Transaction {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new NotFoundError('transaction', transactionId);
    }
    return transaction;
  }

  /**
   * Create a snapshot of spreadsheet state
   *
   * PRODUCTION: Fetches actual spreadsheet state from Google Sheets API
   */
  private async createSnapshot(spreadsheetId: string): Promise<TransactionSnapshot> {
    this.log(`Creating snapshot for spreadsheet: ${spreadsheetId}`);

    if (!this.googleClient) {
      throw new ServiceError(
        'Transaction manager requires Google API client for snapshots. Simulated snapshots have been removed for production safety.',
        'SERVICE_NOT_INITIALIZED',
        'TransactionManager'
      );
    }

    try {
      // Fetch spreadsheet metadata (structure only, NO cell data)
      // CRITICAL FIX: Removed 'data' from fields to prevent massive data fetch
      const response = await this.googleClient.sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false, // Exclude cell data for performance
        fields: 'spreadsheetId,properties,sheets(properties)', // Fixed: removed ',data' which caused 500MB+ fetches
      });

      const state = response.data;

      // Calculate snapshot size with error handling for massive objects
      let size: number;
      try {
        const stateJson = JSON.stringify(state);
        size = stateJson.length;
      } catch (serializationError) {
        // Catch V8 string length limit errors (>512MB)
        if (
          serializationError instanceof RangeError &&
          String(serializationError.message).includes('string longer than')
        ) {
          throw new ServiceError(
            'Snapshot too large to serialize (exceeds 512MB JavaScript limit). This spreadsheet is too large for transactional snapshots. Options: (1) Disable autoSnapshot, (2) Use sheets_history for undo, (3) Reduce spreadsheet size.',
            'PAYLOAD_TOO_LARGE',
            'TransactionManager'
          );
        }
        throw serializationError;
      }

      // Enforce snapshot size limit (prevent memory exhaustion)
      const MAX_SNAPSHOT_SIZE = 50 * 1024 * 1024; // 50MB limit
      if (size > MAX_SNAPSHOT_SIZE) {
        throw new ServiceError(
          `Snapshot too large: ${Math.round(size / 1024 / 1024)}MB exceeds ${MAX_SNAPSHOT_SIZE / 1024 / 1024}MB limit. This spreadsheet has too much metadata for transactional snapshots. Options: (1) Begin transaction with autoSnapshot: false, (2) Use sheets_history instead, (3) Reduce number of sheets.`,
          'PAYLOAD_TOO_LARGE',
          'TransactionManager'
        );
      }

      const snapshot: TransactionSnapshot = {
        id: uuidv4(),
        spreadsheetId,
        state: state as unknown as SpreadsheetState, // Metadata-only snapshot shape is compatible subset
        timestamp: Date.now(),
        size,
      };

      this.snapshots.set(snapshot.id, snapshot);
      this.stats.snapshotsCreated++;

      this.log(`Snapshot created: ${snapshot.id} (${Math.round(size / 1024)}KB metadata-only)`);

      return snapshot;
    } catch (error) {
      this.log(
        `Snapshot creation failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Capture pre-commit cell values for write/clear operations.
   *
   * Fetches current cell values immediately before the batchUpdate so that
   * restoreSnapshot() can write them back if the transaction is rolled back.
   * Scoped to sheets_data write/clear operations only; format changes do not
   * have a simple inverse and must still be undone manually.
   */
  private async capturePreCommitValues(
    transaction: Transaction,
    snapshot: TransactionSnapshot
  ): Promise<void> {
    if (!this.googleClient) return;

    const WRITE_TOOL_ACTIONS = new Set([
      'sheets_data:write',
      'sheets_data:batch_write',
      'sheets_data:clear',
      'sheets_data:batch_clear',
    ]);

    const ranges: string[] = [];
    for (const op of transaction.operations) {
      const toolAction = `${op.tool}:${op.action}`;
      if (WRITE_TOOL_ACTIONS.has(toolAction) && typeof op.params['range'] === 'string') {
        ranges.push(op.params['range'] as string);
      }
    }

    if (ranges.length === 0) return;

    // Deduplicate ranges
    const uniqueRanges = [...new Set(ranges)];

    try {
      const response = await this.googleClient.sheets.spreadsheets.values.batchGet({
        spreadsheetId: transaction.spreadsheetId,
        ranges: uniqueRanges,
      });

      snapshot.preCommitCellData = (response.data.valueRanges ?? []).map((vr) => ({
        range: vr.range ?? '',
        values: (vr.values as unknown[][] | undefined) ?? [],
      }));

      this.log(`Captured pre-commit cell data for ${uniqueRanges.length} range(s)`);
    } catch (error) {
      // Non-fatal: log and continue — rollback will still mark the transaction rolled_back
      this.log(
        `WARNING: Could not capture pre-commit cell data: ${error instanceof Error ? error.message : String(error)}. ` +
          'Rollback will not restore cell values for this transaction.'
      );
    }
  }

  /**
   * Restore snapshot — writes back pre-commit cell data captured before the batchUpdate.
   *
   * Restores cell values for sheets_data write/clear operations.
   * Format changes (sheets_format) and structural changes (sheet add/delete) are NOT
   * reverted automatically; use sheets_history or sheets_collaborate for those.
   */
  private async restoreSnapshot(snapshot: TransactionSnapshot): Promise<void> {
    if (!snapshot.preCommitCellData || snapshot.preCommitCellData.length === 0) {
      this.log(
        `Transaction rolled back. Snapshot ${snapshot.id} has no cell data to restore. ` +
          'For format/structural rollback use sheets_history or sheets_collaborate.'
      );
      return;
    }

    if (!this.googleClient) {
      this.log(
        `Transaction rolled back. Cannot restore cell data — no Google API client. ` +
          `Snapshot ${snapshot.id} captured ${snapshot.preCommitCellData.length} range(s); ` +
          'restore manually via sheets_history or sheets_collaborate.'
      );
      return;
    }

    this.log(`Restoring ${snapshot.preCommitCellData.length} range(s) to pre-transaction state...`);

    try {
      await this.googleClient.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: snapshot.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: snapshot.preCommitCellData.map((d) => ({
            range: d.range,
            values: d.values,
          })),
        },
      });

      this.log(
        `Cell data restored for ${snapshot.preCommitCellData.length} range(s). ` +
          'Note: format changes are not reverted — use sheets_history for full undo.'
      );
    } catch (error) {
      // Non-fatal: log and continue — the transaction is still marked rolled_back
      this.log(
        `WARNING: Failed to restore cell data during rollback: ${error instanceof Error ? error.message : String(error)}. ` +
          `Snapshot ${snapshot.id} contains the pre-transaction values for manual recovery.`
      );
    }
  }

  /**
   * Validate operations before execution
   */
  private validateOperations(transaction: Transaction): void {
    if (transaction.operations.length === 0) {
      throw new ValidationError(
        'No operations to commit',
        'operations',
        'non-empty operations list'
      );
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (opId: string): boolean => {
      if (recursionStack.has(opId)) return true;
      if (visited.has(opId)) return false;

      visited.add(opId);
      recursionStack.add(opId);

      const op = transaction.operations.find((o) => o.id === opId);
      if (op?.dependsOn) {
        for (const depId of op.dependsOn) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(opId);
      return false;
    };

    for (const op of transaction.operations) {
      if (hasCycle(op.id)) {
        throw new ValidationError(
          'Circular dependency detected in operations',
          'operations',
          'acyclic dependency graph'
        );
      }
    }
  }

  /**
   * Merge operations into single batch request
   */
  private mergeToBatchRequest(
    operations: QueuedOperation[],
    sheetNameMap?: Map<string, number>
  ): BatchRequest {
    this.log(`Merging ${operations.length} operations into batch request`);

    const requests: BatchRequestEntry[] = [];
    const unconvertedOps: string[] = [];

    for (const op of operations) {
      // Convert operation to batch request entry
      const entry = this.operationToBatchEntry(op, sheetNameMap);
      if (entry) {
        requests.push(entry);
      } else {
        // Track operations that couldn't be converted
        unconvertedOps.push(`${op.tool}:${op.action} (id: ${op.id})`);
      }
    }

    // Warn if some operations couldn't be converted
    if (unconvertedOps.length > 0) {
      this.log(
        `WARNING: ${unconvertedOps.length} operation(s) could not be converted to batch requests: ${unconvertedOps.join(', ')}. ` +
          `These operations will be skipped. Supported operations: sheets_data (write, clear, merge/unmerge), ` +
          `sheets_format (set_format, set_background, etc.), sheets_core (add/delete/update_sheet), ` +
          `sheets_dimensions (insert/delete rows/columns, freeze), sheets_advanced (named/protected ranges).`
      );
    }

    // Throw if no operations could be converted
    if (requests.length === 0 && operations.length > 0) {
      throw new ValidationError(
        `None of the ${operations.length} queued operation(s) could be converted to batch requests. Unconverted operations: ${unconvertedOps.join(', ')}. Please use supported operations or execute them individually outside of transactions.`,
        'operations',
        'operations convertible to batch requests'
      );
    }

    return {
      requests,
      includeSpreadsheetInResponse: false,
      responseIncludeGridData: false,
    };
  }

  /**
   * Convert operation to batch request entry
   *
   * Converts queued operations into Google Sheets API batchUpdate request entries.
   * Supports: values_write, format_apply, sheet_create, sheet_delete, and 'custom' operations.
   * Custom operations are mapped based on their tool/action parameters.
   */
  private operationToBatchEntry(
    op: QueuedOperation,
    sheetNameMap?: Map<string, number>
  ): BatchRequestEntry | null {
    switch (op.type) {
      case 'values_write':
        return {
          updateCells: {
            range: op.params['range'],
            fields: 'userEnteredValue',
          },
        };

      case 'format_apply':
        return {
          updateCells: {
            range: op.params['range'],
            fields: 'userEnteredFormat',
          },
        };

      case 'sheet_create':
        return {
          addSheet: {
            properties: {
              title: op.params['title'],
            },
          },
        };

      case 'sheet_delete':
        return {
          deleteSheet: {
            sheetId: op.params['sheetId'],
          },
        };

      case 'custom':
        // Convert custom operations based on tool/action
        return this.convertCustomOperation(op, sheetNameMap);

      default:
        this.log(`Unknown operation type: ${op.type}, skipping`);
        return null;
    }
  }

  /**
   * Convert custom operations to batch request entries based on tool/action
   *
   * Maps ServalSheets tool actions to Google Sheets API batchUpdate requests.
   * This enables transaction batching for operations queued via the generic queue() method.
   */
  private convertCustomOperation(
    op: QueuedOperation,
    sheetNameMap?: Map<string, number>
  ): BatchRequestEntry | null {
    const { tool, action, params } = op;
    const toolAction = `${tool}:${action}`;

    this.log(`Converting custom operation: ${toolAction}`);

    switch (toolAction) {
      // sheets_data operations
      case 'sheets_data:write':
      case 'sheets_data:batch_write':
        return this.buildUpdateCellsRequest(params, 'userEnteredValue', false, sheetNameMap);

      case 'sheets_data:clear':
      case 'sheets_data:batch_clear':
        return this.buildUpdateCellsRequest(params, 'userEnteredValue', true, sheetNameMap);

      case 'sheets_data:merge_cells':
        return {
          mergeCells: {
            range: this.parseRangeToGridRange(
              params['range'] as string,
              params['sheetId'] as number,
              sheetNameMap
            ),
            mergeType: (params['mergeType'] as string) || 'MERGE_ALL',
          },
        };

      case 'sheets_data:unmerge_cells':
        return {
          unmergeCells: {
            range: this.parseRangeToGridRange(
              params['range'] as string,
              params['sheetId'] as number,
              sheetNameMap
            ),
          },
        };

      // sheets_format operations
      case 'sheets_format:set_format':
      case 'sheets_format:set_background':
      case 'sheets_format:set_text_format':
      case 'sheets_format:set_number_format':
      case 'sheets_format:set_alignment':
      case 'sheets_format:set_borders':
        return this.buildUpdateCellsRequest(params, 'userEnteredFormat', false, sheetNameMap);

      case 'sheets_format:clear_format':
        return this.buildUpdateCellsRequest(params, 'userEnteredFormat', true, sheetNameMap);

      // sheets_core operations
      case 'sheets_core:add_sheet':
        return {
          addSheet: {
            properties: {
              title: params['title'] as string,
              index: params['index'] as number | undefined,
              sheetId: params['sheetId'] as number | undefined,
              gridProperties: params['gridProperties'] as Record<string, unknown> | undefined,
            },
          },
        };

      case 'sheets_core:delete_sheet':
        return {
          deleteSheet: {
            sheetId: params['sheetId'] as number,
          },
        };

      case 'sheets_core:update_sheet':
        return {
          updateSheetProperties: {
            properties: {
              sheetId: params['sheetId'] as number,
              title: params['title'] as string | undefined,
              index: params['index'] as number | undefined,
              hidden: params['hidden'] as boolean | undefined,
              gridProperties: params['gridProperties'] as Record<string, unknown> | undefined,
            },
            fields: this.buildFieldMask(params),
          },
        };

      // sheets_dimensions operations
      case 'sheets_dimensions:insert_rows':
        return {
          insertRange: {
            range: toGridRange(
              buildGridRangeInput(
                params['sheetId'] as number,
                params['startIndex'] as number,
                (params['startIndex'] as number) + ((params['count'] as number) || 1)
              )
            ),
            shiftDimension: 'ROWS',
          },
        };

      case 'sheets_dimensions:insert_columns':
        return {
          insertRange: {
            range: toGridRange(
              buildGridRangeInput(
                params['sheetId'] as number,
                undefined,
                undefined,
                params['startIndex'] as number,
                (params['startIndex'] as number) + ((params['count'] as number) || 1)
              )
            ),
            shiftDimension: 'COLUMNS',
          },
        };

      case 'sheets_dimensions:delete_rows':
        return {
          deleteRange: {
            range: toGridRange(
              buildGridRangeInput(
                params['sheetId'] as number,
                params['startIndex'] as number,
                params['endIndex'] as number
              )
            ),
            shiftDimension: 'ROWS',
          },
        };

      case 'sheets_dimensions:delete_columns':
        return {
          deleteRange: {
            range: toGridRange(
              buildGridRangeInput(
                params['sheetId'] as number,
                undefined,
                undefined,
                params['startIndex'] as number,
                params['endIndex'] as number
              )
            ),
            shiftDimension: 'COLUMNS',
          },
        };

      case 'sheets_dimensions:freeze_rows':
      case 'sheets_dimensions:freeze_columns':
        return {
          updateSheetProperties: {
            properties: {
              sheetId: params['sheetId'] as number,
              gridProperties: {
                frozenRowCount: params['frozenRowCount'] as number | undefined,
                frozenColumnCount: params['frozenColumnCount'] as number | undefined,
              },
            },
            fields:
              action === 'freeze_rows'
                ? 'gridProperties.frozenRowCount'
                : 'gridProperties.frozenColumnCount',
          },
        };

      // Generic freeze action (used by LLMs via sheets_dimensions tool)
      case 'sheets_dimensions:freeze': {
        const dimension = params['dimension'] as string | undefined;
        const count = params['count'] as number | undefined;
        const isRows = !dimension || dimension.toUpperCase() === 'ROWS';
        return {
          updateSheetProperties: {
            properties: {
              sheetId: params['sheetId'] as number,
              gridProperties: isRows
                ? { frozenRowCount: count ?? 0 }
                : { frozenColumnCount: count ?? 0 },
            },
            fields: isRows ? 'gridProperties.frozenRowCount' : 'gridProperties.frozenColumnCount',
          },
        };
      }

      // sheets_advanced operations
      case 'sheets_advanced:add_named_range':
        return {
          addNamedRange: {
            namedRange: {
              name: params['name'] as string,
              range: this.parseRangeToGridRange(
                params['range'] as string,
                params['sheetId'] as number,
                sheetNameMap
              ),
            },
          },
        };

      case 'sheets_advanced:delete_named_range':
        return {
          deleteNamedRange: {
            namedRangeId: params['namedRangeId'] as string,
          },
        };

      case 'sheets_advanced:add_protected_range':
        return {
          addProtectedRange: {
            protectedRange: {
              range: this.parseRangeToGridRange(
                params['range'] as string,
                params['sheetId'] as number,
                sheetNameMap
              ),
              description: params['description'] as string | undefined,
              warningOnly: params['warningOnly'] as boolean | undefined,
              editors: params['editors'] as Record<string, unknown> | undefined,
            },
          },
        };

      case 'sheets_advanced:delete_protected_range':
        return {
          deleteProtectedRange: {
            protectedRangeId: params['protectedRangeId'] as number,
          },
        };

      default:
        // Operation not supported for batching - log warning
        this.log(
          `Custom operation ${toolAction} cannot be batched. Consider using direct API call.`
        );
        return null;
    }
  }

  /**
   * Build updateCells request for data/format operations
   */
  private buildUpdateCellsRequest(
    params: Record<string, unknown>,
    fields: string,
    clear: boolean = false,
    sheetNameMap?: Map<string, number>
  ): BatchRequestEntry {
    const range = params['range'] as string;
    const sheetId = params['sheetId'] as number | undefined;

    return {
      updateCells: {
        range: this.parseRangeToGridRange(range, sheetId, sheetNameMap),
        rows: clear ? [] : undefined,
        fields,
      },
    };
  }

  /**
   * Parse A1 notation range to GridRange object
   */
  private parseRangeToGridRange(
    range: string | undefined,
    defaultSheetId: number = 0,
    sheetNameMap?: Map<string, number>
  ): sheets_v4.Schema$GridRange {
    if (!range) {
      return toGridRange(buildGridRangeInput(defaultSheetId));
    }

    // Simple parser for A1 notation (e.g., "Sheet1!A1:B10" or "A1:B10")
    const sheetMatch = range.match(/^(?:'([^']+)'!|([^!]+)!)/);
    const sheetName = sheetMatch?.[1] || sheetMatch?.[2];
    const rangeOnly = sheetName ? range.split('!')[1] : range;

    // Resolve sheet ID: use explicit sheetId if provided, else resolve name from map
    let resolvedSheetId = defaultSheetId;
    if (sheetName && sheetNameMap) {
      const mappedId = sheetNameMap.get(sheetName);
      if (mappedId !== undefined) {
        resolvedSheetId = mappedId;
      } else {
        this.log(
          `WARNING: Sheet name '${sheetName}' not found in sheet map, using default sheetId=${defaultSheetId}`
        );
      }
    }

    // Parse cell range (e.g., "A1:B10" or "A1")
    const rangeMatch = rangeOnly?.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
    if (!rangeMatch) {
      return toGridRange(buildGridRangeInput(resolvedSheetId));
    }

    const startCol = this.columnToIndex(rangeMatch[1]!);
    const startRow = parseInt(rangeMatch[2]!, 10) - 1;
    const endCol = rangeMatch[3] ? this.columnToIndex(rangeMatch[3]) + 1 : startCol + 1;
    const endRow = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : startRow + 1;

    return toGridRange(buildGridRangeInput(resolvedSheetId, startRow, endRow, startCol, endCol));
  }

  /**
   * Convert column letter to 0-based index (A=0, B=1, ..., Z=25, AA=26, etc.)
   */
  private columnToIndex(col: string): number {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    return index - 1;
  }

  /**
   * Fetch spreadsheet metadata and build a sheet name → sheetId map.
   * Used at commit time to resolve sheet names in A1 notation ranges.
   */
  private async buildSheetNameMap(spreadsheetId: string): Promise<Map<string, number>> {
    const nameMap = new Map<string, number>();

    if (!this.googleClient) {
      this.log('No Google API client available, cannot resolve sheet names');
      return nameMap;
    }

    try {
      const response = await this.googleClient.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties(sheetId,title)',
      });

      const sheets = response.data.sheets || [];
      for (const sheet of sheets) {
        const title = sheet.properties?.title;
        const sheetId = sheet.properties?.sheetId;
        if (title != null && sheetId != null) {
          nameMap.set(title, sheetId);
        }
      }

      this.log(`Built sheet name map with ${nameMap.size} entries`);
    } catch (error) {
      this.log(`WARNING: Failed to fetch sheet metadata for name resolution: ${error}`);
    }

    return nameMap;
  }

  /**
   * Build field mask from params for updateSheetProperties
   */
  private buildFieldMask(params: Record<string, unknown>): string {
    const fields: string[] = [];
    if (params['title'] !== undefined) fields.push('title');
    if (params['index'] !== undefined) fields.push('index');
    if (params['hidden'] !== undefined) fields.push('hidden');
    if (params['gridProperties'] !== undefined) fields.push('gridProperties');
    return fields.join(',') || 'title';
  }

  /**
   * Execute batch request against Google Sheets API
   *
   * PRODUCTION: Requires Google API client for real execution
   */
  private async executeBatchRequest(
    spreadsheetId: string,
    batchRequest: BatchRequest
  ): Promise<sheets_v4.Schema$BatchUpdateSpreadsheetResponse> {
    this.log(
      `Executing batch request for spreadsheet ${spreadsheetId} with ${batchRequest.requests.length} requests`
    );

    if (!this.googleClient) {
      throw new ServiceError(
        'Transaction manager requires Google API client for execution. Simulated execution has been removed for production safety.',
        'SERVICE_NOT_INITIALIZED',
        'TransactionManager'
      );
    }

    try {
      const response = await this.googleClient.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: batchRequest as sheets_v4.Schema$BatchUpdateSpreadsheetRequest,
      });

      this.log(`Batch request succeeded with ${response.data.replies?.length ?? 0} replies`);
      return response.data;
    } catch (error) {
      this.log(`Batch request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process operation results from batch response
   *
   * PRODUCTION: Parses actual Google Sheets API batch response
   */
  private processOperationResults(
    operations: QueuedOperation[],
    batchResponse: sheets_v4.Schema$BatchUpdateSpreadsheetResponse
  ): OperationResult[] {
    const results: OperationResult[] = [];
    const replies = batchResponse.replies || [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]!;
      const reply = replies[i];

      // Check if reply indicates success (presence of reply without error)
      const success = reply !== undefined && reply !== null;

      results.push({
        operationId: op.id,
        success,
        data: reply || {},
        duration: op.estimatedDuration ?? 100,
        error: success ? undefined : new Error('No reply received from batch request'),
      });
    }

    return results;
  }

  /**
   * Update statistics
   */
  private updateStats(transaction: Transaction): void {
    const totalTx = this.stats.totalTransactions;
    this.stats.successRate = this.stats.successfulTransactions / totalTx;

    if (transaction.duration) {
      this.stats.avgTransactionDuration =
        (this.stats.avgTransactionDuration * (totalTx - 1) + transaction.duration) / totalTx;
    }

    this.stats.avgOperationsPerTransaction =
      (this.stats.avgOperationsPerTransaction * (totalTx - 1) + transaction.operations.length) /
      totalTx;
  }

  /**
   * Start background snapshot cleanup
   */
  private startSnapshotCleanup(): void {
    this.snapshotCleanupInterval = setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];

      for (const [id, snapshot] of this.snapshots.entries()) {
        if (now - snapshot.timestamp > this.config.snapshotRetentionMs) {
          expired.push(id);
        }
      }

      for (const id of expired) {
        this.snapshots.delete(id);
        this.log(`Cleaned up expired snapshot: ${id}`);
      }
    }, 60000); // Every minute

    // Phase 1: Register cleanup to prevent memory leak
    registerCleanup(
      'TransactionManager',
      () => {
        if (this.snapshotCleanupInterval) {
          clearInterval(this.snapshotCleanupInterval);
        }
      },
      'snapshot-cleanup-interval'
    );
  }

  /**
   * Add event listener
   */
  addEventListener(listener: TransactionListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: TransactionListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // ==========================================================================
  // DR-01: Write-Ahead Log (WAL)
  // ==========================================================================

  /**
   * Ensure WAL directory exists and replay any orphaned transactions from a previous crash.
   */
  private async initWal(): Promise<void> {
    try {
      const walDir = dirname(this.walPath);
      if (!existsSync(walDir)) {
        mkdirSync(walDir, { recursive: true, mode: 0o750 });
      }
      await this.replayWal();
    } catch (error) {
      logger.error('WAL initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        walPath: this.walPath,
      });
    }
  }

  /**
   * Append a transaction event to the WAL.
   * Format: one JSON object per line — { seq, txId, type, ts, data }
   */
  private async appendWalEntry(event: TransactionEvent): Promise<void> {
    await this.walReady;
    await this.runWalOperation('append', async () => {
      const entry =
        JSON.stringify({
          seq: ++this.walSeq,
          txId: event.transactionId,
          type: event.type,
          ts: event.timestamp,
          data: event.data ?? {},
        }) + '\n';
      await fsPromises.appendFile(this.walPath, entry, { flag: 'a', mode: 0o640 });
    });
  }

  /**
   * On startup, scan the WAL for transactions that started but never committed or rolled back.
   * These represent in-flight transactions from a previous crash.
   */
  private async replayWal(): Promise<void> {
    if (!existsSync(this.walPath)) return;
    try {
      const content = await fsPromises.readFile(this.walPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const txEvents = new Map<
        string,
        {
          hasBegin: boolean;
          completed: boolean;
          queuedOperations: number;
          spreadsheetId?: string;
          snapshotId?: string;
          lastEventType: TransactionEvent['type'];
          lastEventTimestamp: number;
        }
      >();
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as WalEntry;
          this.walSeq = Math.max(this.walSeq, entry.seq ?? 0);

          const state = txEvents.get(entry.txId) ?? {
            hasBegin: false,
            completed: false,
            queuedOperations: 0,
            lastEventType: entry.type,
            lastEventTimestamp: entry.ts,
          };

          state.lastEventType = entry.type;
          state.lastEventTimestamp = entry.ts;

          if (entry.type === 'begin') {
            state.hasBegin = true;
            const beginData =
              entry.data && typeof entry.data === 'object'
                ? (entry.data as Record<string, unknown>)
                : undefined;
            const spreadsheetId = beginData?.['spreadsheetId'];
            const snapshotId = beginData?.['snapshot'];
            if (typeof spreadsheetId === 'string') {
              state.spreadsheetId = spreadsheetId;
            }
            if (typeof snapshotId === 'string') {
              state.snapshotId = snapshotId;
            }
          }

          if (entry.type === 'queue') {
            state.queuedOperations += 1;
          }

          if (entry.type === 'commit' || entry.type === 'rollback' || entry.type === 'fail') {
            state.completed = true;
          }

          txEvents.set(entry.txId, state);
        } catch {
          // Ignore malformed WAL lines
        }
      }
      const orphaned: WalRecoveryTransaction[] = [];
      for (const [txId, state] of txEvents) {
        if (state.hasBegin && !state.completed) {
          orphaned.push({
            transactionId: txId,
            spreadsheetId: state.spreadsheetId,
            snapshotId: state.snapshotId,
            queuedOperations: state.queuedOperations,
            lastEventType: state.lastEventType,
            lastEventTimestamp: state.lastEventTimestamp,
          });
        }
      }
      this.walOrphanedTransactions = orphaned;

      if (this.walOrphanedTransactions.length > 0) {
        logger.warn('WAL replay: orphaned transactions detected from previous crash', {
          count: this.walOrphanedTransactions.length,
          transactions: this.walOrphanedTransactions.map((tx) => ({
            transactionId: tx.transactionId,
            spreadsheetId: tx.spreadsheetId,
            snapshotId: tx.snapshotId,
            queuedOperations: tx.queuedOperations,
          })),
        });
      } else {
        logger.info('WAL replay: no orphaned transactions', { walPath: this.walPath });
      }
    } catch (error) {
      logger.warn('WAL replay failed', {
        error: error instanceof Error ? error.message : String(error),
        walPath: this.walPath,
      });
    }
  }

  /**
   * Rewrite the WAL removing all entries for a completed transaction.
   * Uses an atomic temp-file rename to prevent partial writes.
   */
  private async compactWal(completedTxId: string): Promise<void> {
    await this.walReady;
    await this.runWalOperation('compact', async () => {
      if (!existsSync(this.walPath)) return;

      const content = await fsPromises.readFile(this.walPath, 'utf8');
      const remaining = content
        .split('\n')
        .filter((line) => {
          if (!line) return false;
          try {
            const entry = JSON.parse(line) as { txId: string };
            return entry.txId !== completedTxId;
          } catch {
            return true; // Keep malformed lines (don't lose data)
          }
        })
        .join('\n');
      const tmpPath = this.walPath + '.tmp';
      await fsPromises.writeFile(tmpPath, remaining ? remaining + '\n' : '', { mode: 0o640 });
      await fsPromises.rename(tmpPath, this.walPath);

      this.walOrphanedTransactions = this.walOrphanedTransactions.filter(
        (tx) => tx.transactionId !== completedTxId
      );
    });
  }

  /**
   * Emit event to listeners
   */
  private async emitEvent(event: TransactionEvent): Promise<void> {
    // DR-01: Append to WAL before notifying listeners.
    if (this.walEnabled) {
      await this.appendWalEntry(event);
    }
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        logger.error('Error in transaction event listener', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          transactionId: event.transactionId,
          eventType: event.type,
        });
      }
    }
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.verboseLogging) {
      logger.debug('[TransactionManager] ' + message);
    }
  }

  /**
   * Get statistics
   */
  getStats(): TransactionStats {
    return { ...this.stats };
  }

  /**
   * Return WAL recovery status captured at startup replay.
   */
  async getWalRecoveryReport(): Promise<WalRecoveryReport> {
    await this.walReady;
    if (!this.walEnabled) {
      return {
        enabled: false,
        orphanedTransactions: [],
      };
    }

    return {
      enabled: true,
      walPath: this.walPath,
      orphanedTransactions: [...this.walOrphanedTransactions],
    };
  }

  /**
   * Discard an orphaned WAL transaction entry (crash recovery cleanup).
   * Removes the transaction from the orphan list and compacts the WAL.
   */
  async discardOrphanedTransaction(transactionId: string): Promise<void> {
    const exists = this.walOrphanedTransactions.some((tx) => tx.transactionId === transactionId);
    if (!exists) {
      throw new NotFoundError('orphaned transaction', transactionId);
    }
    if (this.walEnabled) {
      await this.compactWal(transactionId);
    } else {
      this.walOrphanedTransactions = this.walOrphanedTransactions.filter(
        (tx) => tx.transactionId !== transactionId
      );
    }
    logger.info('Discarded orphaned WAL transaction', { transactionId });
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      rolledBackTransactions: 0,
      successRate: 0,
      avgTransactionDuration: 0,
      avgOperationsPerTransaction: 0,
      apiCallsSaved: 0,
      snapshotsCreated: 0,
      activeTransactions: this.activeTransactions.size,
      totalDataProcessed: 0,
    };
  }

  /**
   * Get all active transactions
   */
  getActiveTransactions(): Transaction[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Cancel a transaction (rollback if snapshot exists)
   */
  async cancel(transactionId: string): Promise<void> {
    const transaction = this.getTransaction(transactionId);

    if (transaction.snapshot) {
      await this.rollback(transactionId);
    } else {
      await this.emitEvent({
        type: 'fail',
        transactionId,
        timestamp: Date.now(),
        data: { error: 'Transaction cancelled without snapshot rollback', cancelled: true },
      });
      if (this.walEnabled) {
        await this.compactWal(transactionId);
      }
    }

    this.activeTransactions.delete(transactionId);
    this.stats.activeTransactions--;
  }

  private runWalOperation(operationName: string, operation: () => Promise<void>): Promise<void> {
    this.walWriteChain = this.walWriteChain.then(async () => {
      try {
        await operation();
      } catch (error) {
        logger.warn('WAL operation failed', {
          operation: operationName,
          error: error instanceof Error ? error.message : String(error),
          walPath: this.walPath,
        });
      }
    });
    return this.walWriteChain;
  }
}

// Singleton instance
let transactionManagerInstance: TransactionManager | null = null;

/**
 * Initialize transaction manager (call once during server startup)
 */
export function initTransactionManager(
  googleClient?: TransactionConfig['googleClient']
): TransactionManager {
  if (!transactionManagerInstance) {
    const env = getEnv();
    transactionManagerInstance = new TransactionManager({
      enabled: env.TRANSACTIONS_ENABLED,
      autoSnapshot: env.TRANSACTIONS_AUTO_SNAPSHOT,
      autoRollback: env.TRANSACTIONS_AUTO_ROLLBACK,
      maxOperationsPerTransaction: parseInt(process.env['TRANSACTIONS_MAX_OPERATIONS'] || '100'),
      transactionTimeoutMs: parseInt(process.env['TRANSACTIONS_TIMEOUT_MS'] || '300000'),
      snapshotRetentionMs: parseInt(process.env['TRANSACTIONS_SNAPSHOT_RETENTION_MS'] || '3600000'),
      maxConcurrentTransactions: parseInt(process.env['TRANSACTIONS_MAX_CONCURRENT'] || '10'),
      verboseLogging: process.env['TRANSACTIONS_VERBOSE'] === 'true',
      defaultIsolationLevel:
        (process.env['TRANSACTIONS_DEFAULT_ISOLATION'] as
          | 'read_uncommitted'
          | 'read_committed'
          | 'serializable') || 'read_committed',
      googleClient,
      walDir: env.TRANSACTION_WAL_DIR,
    });
  }
  return transactionManagerInstance;
}

/**
 * Get transaction manager instance
 */
export function getTransactionManager(): TransactionManager {
  if (!transactionManagerInstance) {
    throw new ServiceError(
      'Transaction manager not initialized. Call initTransactionManager() first.',
      'SERVICE_NOT_INITIALIZED',
      'TransactionManager'
    );
  }
  return transactionManagerInstance;
}

/**
 * Reset transaction manager (for testing only)
 * @internal
 */
export function resetTransactionManager(): void {
  if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
    throw new ServiceError(
      'resetTransactionManager() can only be called in test environment',
      'INTERNAL_ERROR',
      'TransactionManager'
    );
  }
  transactionManagerInstance = null;
}
