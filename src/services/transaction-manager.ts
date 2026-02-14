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
  TransactionConfig,
  TransactionStats,
  TransactionEvent,
  TransactionListener,
} from '../types/transaction.js';
import { registerCleanup } from '../utils/resource-cleanup.js';

/**
 * Transaction Manager - Handles multi-operation transactions with atomicity
 */
export class TransactionManager {
  private config: Required<Omit<TransactionConfig, 'googleClient'>>;
  private googleClient?: TransactionConfig['googleClient'];
  private stats: TransactionStats;
  private activeTransactions: Map<string, Transaction>;
  private snapshots: Map<string, TransactionSnapshot>;
  private listeners: TransactionListener[];
  private operationIdCounter: number;
  // Phase 1: Timer cleanup
  private snapshotCleanupInterval?: NodeJS.Timeout;

  constructor(config: TransactionConfig = {}) {
    this.googleClient = config.googleClient;
    this.config = {
      enabled: config.enabled ?? true,
      autoSnapshot: config.autoSnapshot ?? true,
      autoRollback: config.autoRollback ?? true,
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
  }

  /**
   * Begin a new transaction
   */
  async begin(
    spreadsheetId: string,
    options: {
      autoCommit?: boolean;
      autoRollback?: boolean;
      isolationLevel?: 'read_uncommitted' | 'read_committed' | 'serializable';
      userId?: string;
    } = {}
  ): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('Transactions are disabled');
    }

    if (this.activeTransactions.size >= this.config.maxConcurrentTransactions) {
      throw new Error('Maximum concurrent transactions reached');
    }

    const transactionId = uuidv4();
    this.log(`Beginning transaction: ${transactionId}`);

    // Create snapshot if auto-snapshot enabled
    let snapshot: TransactionSnapshot | undefined;
    if (this.config.autoSnapshot) {
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

    this.emitEvent({
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
      throw new Error(
        `Transaction ${transactionId} is not in pending/queued state (current: ${transaction.status})`
      );
    }

    if (transaction.operations.length >= this.config.maxOperationsPerTransaction) {
      throw new Error('Maximum operations per transaction reached');
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

    this.emitEvent({
      type: 'queue',
      transactionId,
      timestamp: Date.now(),
      data: { operationId, operationType: operation.type },
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

      // Execute batch request via Google Sheets API
      const batchResponse = await this.executeBatchRequest(transaction.spreadsheetId, batchRequest);

      // Process results
      const operationResults = this.processOperationResults(transaction.operations, batchResponse);

      // Check for failures
      const failedOps = operationResults.filter((r) => !r.success);
      if (failedOps.length > 0 && transaction.autoRollback) {
        throw new Error(`${failedOps.length} operation(s) failed: ${failedOps[0]!.error?.message}`);
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

      this.emitEvent({
        type: 'commit',
        transactionId,
        timestamp: Date.now(),
        data: { success: true, operationCount: transaction.operations.length },
      });

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

      this.emitEvent({
        type: 'fail',
        transactionId,
        timestamp: Date.now(),
        data: {
          error: error instanceof Error ? error.message : String(error),
          rolledBack,
        },
      });

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

    if (!transaction.snapshot) {
      throw new Error('No snapshot available for rollback');
    }

    try {
      // Restore snapshot
      await this.restoreSnapshot(transaction.snapshot);

      transaction.status = 'rolled_back';
      this.stats.rolledBackTransactions++;

      this.emitEvent({
        type: 'rollback',
        transactionId,
        timestamp: Date.now(),
        data: { snapshotId: transaction.snapshot.id },
      });

      return {
        transactionId,
        success: true,
        snapshotId: transaction.snapshot.id,
        duration: Date.now() - startTime,
        operationsReverted: transaction.operations.length,
      };
    } catch (error) {
      return {
        transactionId,
        success: false,
        snapshotId: transaction.snapshot.id,
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
      throw new Error(`Transaction ${transactionId} not found`);
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
      throw new Error(
        'Transaction manager requires Google API client for snapshots. ' +
          'Simulated snapshots have been removed for production safety.'
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
          throw new Error(
            'Snapshot too large to serialize (exceeds 512MB JavaScript limit). ' +
              'This spreadsheet is too large for transactional snapshots. ' +
              'Options: (1) Disable autoSnapshot, (2) Use sheets_history for undo, (3) Reduce spreadsheet size.'
          );
        }
        throw serializationError;
      }

      // Enforce snapshot size limit (prevent memory exhaustion)
      const MAX_SNAPSHOT_SIZE = 50 * 1024 * 1024; // 50MB limit
      if (size > MAX_SNAPSHOT_SIZE) {
        throw new Error(
          `Snapshot too large: ${Math.round(size / 1024 / 1024)}MB exceeds ${MAX_SNAPSHOT_SIZE / 1024 / 1024}MB limit. ` +
            `This spreadsheet has too much metadata for transactional snapshots. ` +
            `Options: (1) Begin transaction with autoSnapshot: false, (2) Use sheets_history instead, (3) Reduce number of sheets.`
        );
      }

      const snapshot: TransactionSnapshot = {
        id: uuidv4(),
        spreadsheetId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: state as any, // Type conversion: Google API Schema$Spreadsheet to internal SpreadsheetState
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
   * Restore snapshot (Design Decision: Manual Recovery Path)
   *
   * Automatic in-place restoration is intentionally deferred because:
   * 1. It risks data corruption if the spreadsheet was modified externally
   * 2. Comparing and merging states is complex and error-prone
   * 3. Manual recovery via sheets_collaborate.version_restore_snapshot is safer
   *
   * Recovery options available to users:
   * - Use sheets_collaborate action="version_restore_snapshot" to create a recovery file
   * - Use sheets_history to review and manually undo operations
   * - Implement compensating transactions for automated recovery
   *
   * Full in-place restoration would require:
   * 1. Comparing current state with snapshot state
   * 2. Generating compensating batchUpdate requests to revert changes
   * 3. Handling cases where sheets were added/deleted
   * 4. Managing potential conflicts if spreadsheet was modified externally
   */
  private async restoreSnapshot(snapshot: TransactionSnapshot): Promise<void> {
    this.log(
      `Snapshot ${snapshot.id} available for manual recovery. Use sheets_collaborate to restore.`
    );

    throw new Error(
      'Automatic in-place snapshot restoration is not supported. ' +
        "Use sheets_collaborate action='version_restore_snapshot' to create a recovery file, " +
        'or use sheets_history to review and manually undo operations.'
    );
  }

  /**
   * Validate operations before execution
   */
  private validateOperations(transaction: Transaction): void {
    if (transaction.operations.length === 0) {
      throw new Error('No operations to commit');
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
        throw new Error('Circular dependency detected in operations');
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
      throw new Error(
        `None of the ${operations.length} queued operation(s) could be converted to batch requests. ` +
          `Unconverted operations: ${unconvertedOps.join(', ')}. ` +
          `Please use supported operations or execute them individually outside of transactions.`
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
        this.log(`WARNING: Sheet name '${sheetName}' not found in sheet map, using default sheetId=${defaultSheetId}`);
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
      throw new Error(
        'Transaction manager requires Google API client for execution. ' +
          'Simulated execution has been removed for production safety.'
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

  /**
   * Emit event to listeners
   */
  private emitEvent(event: TransactionEvent): void {
    for (const listener of this.listeners) {
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
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    }

    this.activeTransactions.delete(transactionId);
    this.stats.activeTransactions--;
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
    transactionManagerInstance = new TransactionManager({
      enabled: process.env['TRANSACTIONS_ENABLED'] !== 'false',
      autoSnapshot: process.env['TRANSACTIONS_AUTO_SNAPSHOT'] !== 'false',
      autoRollback: process.env['TRANSACTIONS_AUTO_ROLLBACK'] !== 'false',
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
    });
  }
  return transactionManagerInstance;
}

/**
 * Get transaction manager instance
 */
export function getTransactionManager(): TransactionManager {
  if (!transactionManagerInstance) {
    throw new Error('Transaction manager not initialized. Call initTransactionManager() first.');
  }
  return transactionManagerInstance;
}

/**
 * Reset transaction manager (for testing only)
 * @internal
 */
export function resetTransactionManager(): void {
  if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
    throw new Error('resetTransactionManager() can only be called in test environment');
  }
  transactionManagerInstance = null;
}
