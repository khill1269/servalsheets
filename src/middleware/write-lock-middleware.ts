/**
 * Per-Spreadsheet Write Lock Middleware
 *
 * Serializes all mutation operations per spreadsheetId using PQueue(concurrency=1).
 * Read operations bypass the lock entirely, maintaining full parallelism.
 *
 * This prevents data corruption from concurrent writes to the same spreadsheet
 * across multiple Claude sessions or parallel tool calls.
 */

import PQueue from 'p-queue';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../core/errors.js';
import { ErrorCodes } from '../handlers/error-codes.js';
import { MUTATION_ACTION_NAMES } from './mutation-actions.constants.js';

// Per-spreadsheet write queues. Max 1 concurrent write per spreadsheet.
const writeLocks = new Map<string, PQueue>();

// Clean idle locks every 5 minutes to prevent memory leaks
const LOCK_CLEANUP_MS = 5 * 60 * 1000;

// Write lock acquisition timeout (default: 30s). Configurable via LOCK_TIMEOUT_MS env var.
const LOCK_TIMEOUT_MS = parseInt(process.env['LOCK_TIMEOUT_MS'] ?? '30000', 10);

/**
 * Mutation actions that require write serialization.
 *
 * Derived from the canonical {@link MUTATION_ACTION_NAMES} list so that the
 * write-lock set and the audit `MUTATION_ACTIONS` set in
 * `src/middleware/audit-middleware.ts` cannot drift apart.
 *
 * @see src/middleware/mutation-actions.constants.ts
 */
export const MUTATION_ACTIONS: ReadonlySet<string> = new Set<string>(MUTATION_ACTION_NAMES);

// Additional mutation actions not currently covered by MUTATION_ACTIONS.
// These actions mutate spreadsheet data/structure and must be serialized.
export const FORCE_WRITE_ACTIONS = new Set<string>([
  // sheets_core
  'add_sheet',
  'update_sheet',
  'duplicate_sheet',
  'copy_sheet_to',
  'batch_update_sheets',
  'move_sheet',
  // sheets_visualize
  'chart_create',
  'chart_update',
  'chart_delete',
  'chart_move',
  'chart_resize',
  'chart_update_data_range',
  'chart_add_trendline',
  'chart_remove_trendline',
  'pivot_create',
  'pivot_update',
  'pivot_delete',
  'pivot_refresh',
  // sheets_advanced
  'add_named_range',
  'update_named_range',
  'delete_named_range',
  'add_protected_range',
  'update_protected_range',
  'delete_protected_range',
  'set_metadata',
  'delete_metadata',
  'add_banding',
  'update_banding',
  'delete_banding',
  'create_table',
  'delete_table',
  'update_table',
  'rename_table_column',
  'set_table_column_properties',
  'add_person_chip',
  'add_drive_chip',
  'add_rich_link_chip',
  'create_named_function',
  'update_named_function',
  'delete_named_function',
  // sheets_collaborate
  'comment_add',
  'comment_update',
  'comment_delete',
  'comment_resolve',
  'comment_reopen',
  'comment_add_reply',
  'comment_update_reply',
  'comment_delete_reply',
  'version_restore_revision',
  'version_keep_revision',
  'version_create_snapshot',
  'version_restore_snapshot',
  'version_delete_snapshot',
  'approval_create',
  'approval_approve',
  'approval_reject',
  'approval_delegate',
  'approval_cancel',
  // sheets_dependencies
  'create_scenario_sheet',
]);

const MUTATION_ACTION_PREFIX =
  /^(write|append|clear|batch_write|batch_clear|cross_write|set_|add_|update_|delete_|remove_|create_|insert|move|copy_|cut_|merge_|unmerge_|apply_|rule_|share_|comment_|approval_|import_|export_|connect|disconnect|refresh|cancel_|deploy|undeploy|run|rollback|commit|queue|begin|subscribe|unsubscribe|watch_|instantiate_|migrate_|bulk_|deduplicate|fill_|standardize_|clean|fix|execute|resolve_)/;

const SPREADSHEET_ID_KEYS = new Set([
  'spreadsheetId',
  'sourceSpreadsheetId',
  'destinationSpreadsheetId',
]);

export function isLikelyMutationAction(action: string): boolean {
  return (
    isMutationAction(action) ||
    FORCE_WRITE_ACTIONS.has(action) ||
    MUTATION_ACTION_PREFIX.test(action)
  );
}

function collectSpreadsheetIds(
  value: unknown,
  ids: Set<string>,
  parentKey?: string,
  depth: number = 0
): void {
  if (depth > 8 || value == null) return;

  if (typeof value === 'string') {
    if (parentKey && SPREADSHEET_ID_KEYS.has(parentKey)) {
      ids.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    if (parentKey === 'spreadsheetIds') {
      for (const entry of value) {
        if (typeof entry === 'string') ids.add(entry);
      }
      return;
    }
    // Skip scanning large value payload arrays (e.g., cell matrices) for IDs.
    if (parentKey === 'values' || parentKey === 'data') return;
    for (const entry of value) {
      collectSpreadsheetIds(entry, ids, undefined, depth + 1);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      collectSpreadsheetIds(entry, ids, key, depth + 1);
    }
  }
}

/**
 * Get or create a write lock queue for a spreadsheet.
 * Each queue has concurrency=1, serializing writes to that spreadsheet.
 */
export function getWriteLock(spreadsheetId: string): PQueue {
  let queue = writeLocks.get(spreadsheetId);
  if (!queue) {
    queue = new PQueue({ concurrency: 1, timeout: LOCK_TIMEOUT_MS });
    writeLocks.set(spreadsheetId, queue);
    logger.debug('Write lock created for spreadsheet', {
      spreadsheetId,
      timeoutMs: LOCK_TIMEOUT_MS,
    });
  }
  return queue;
}

/**
 * Check if an action is a mutation that requires write serialization.
 */
export function isMutationAction(action: string): boolean {
  return MUTATION_ACTIONS.has(action as Parameters<typeof MUTATION_ACTIONS.has>[0]);
}

/**
 * Extract action and spreadsheetId from normalized tool args.
 * Supports both envelope format { request: { action, spreadsheetId, ... } }
 * and flat format { action, spreadsheetId, ... } to prevent write-lock bypass
 * when args arrive without a request envelope.
 */
export function extractWriteLockParams(normalizedArgs: Record<string, unknown>): {
  action?: string;
  spreadsheetIds: string[];
} {
  const req = normalizedArgs['request'] as Record<string, unknown> | undefined;
  const ids = new Set<string>();

  if (req && typeof req === 'object') {
    collectSpreadsheetIds(req, ids);
  }

  // Also check flat format (args without request envelope)
  if (ids.size === 0) {
    collectSpreadsheetIds(normalizedArgs, ids);
  }

  const action = (req?.['action'] ?? normalizedArgs['action']) as string | undefined;
  return { action: typeof action === 'string' ? action : undefined, spreadsheetIds: [...ids] };
}

async function withMultipleWriteLocks<T>(
  spreadsheetIds: string[],
  fn: () => Promise<T>
): Promise<T> {
  const lockOrder = [...new Set(spreadsheetIds)].sort();
  if (lockOrder.length === 0) return fn();

  const executeAt = async (index: number): Promise<T> => {
    if (index >= lockOrder.length) return fn();
    const spreadsheetId = lockOrder[index];
    if (!spreadsheetId) {
      return executeAt(index + 1);
    }
    const lock = getWriteLock(spreadsheetId);
    return lock.add(async () => executeAt(index + 1)) as Promise<T>;
  };

  return executeAt(0);
}

/**
 * Execute a handler with write-lock serialization if the action is a mutation
 * targeting a specific spreadsheet. Reads bypass the lock entirely.
 */
export async function withWriteLock<T>(
  normalizedArgs: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const { action, spreadsheetIds } = extractWriteLockParams(normalizedArgs);

  if (action && spreadsheetIds.length > 0 && isLikelyMutationAction(action)) {
    logger.debug('Acquiring write lock(s)', {
      action,
      spreadsheets: spreadsheetIds,
      lockCount: spreadsheetIds.length,
    });
    try {
      return await withMultipleWriteLocks(spreadsheetIds, fn);
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new ServiceError(
          `Write lock acquisition timed out after ${LOCK_TIMEOUT_MS}ms for action '${action}'. ` +
            'Another operation is holding the write lock. Retry after the concurrent write completes.',
          ErrorCodes.LOCK_TIMEOUT,
          'WriteLockMiddleware',
          true // retryable
        );
      }
      throw err;
    }
  }

  // Not a mutation or no spreadsheet target — execute immediately without lock
  return fn();
}

/**
 * Remove idle lock queues (no pending or running tasks) to prevent memory leaks.
 */
export function cleanupIdleLocks(): void {
  let cleaned = 0;
  for (const [id, queue] of writeLocks.entries()) {
    if (queue.size === 0 && queue.pending === 0) {
      writeLocks.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug('Cleaned up idle write locks', { cleaned, remaining: writeLocks.size });
  }
}

/**
 * Periodic idle-lock cleanup timer.
 *
 * Previously a module-load `setInterval` (unref'd). That meant any test or
 * one-shot script that imported this module started a real timer the
 * instant the file was loaded, even if no write-lock was ever acquired.
 * The lifecycle was invisible to tests and could not be deterministically
 * stopped before a graceful shutdown.
 *
 * Now wired explicitly from `src/startup/lifecycle.ts:startBackgroundTasks`
 * via the idempotent `start*` / `stop*` pair below.
 */
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the idle-lock cleanup timer. Idempotent: calling while the timer
 * is already running is a no-op.
 */
export function startWriteLockCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupIdleLocks, LOCK_CLEANUP_MS);
  // unref so the timer alone cannot keep the process alive
  cleanupInterval.unref?.();
}

/**
 * Stop the idle-lock cleanup timer. Safe to call when the timer was never
 * started (no-op).
 */
export function stopWriteLockCleanup(): void {
  if (!cleanupInterval) return;
  clearInterval(cleanupInterval);
  cleanupInterval = null;
}

/**
 * Get current write lock statistics (for diagnostics).
 */
export function getWriteLockStats(): {
  activeSpreadsheets: number;
  locks: Array<{ spreadsheetId: string; pending: number; running: number }>;
} {
  const locks: Array<{ spreadsheetId: string; pending: number; running: number }> = [];
  for (const [id, queue] of writeLocks.entries()) {
    locks.push({ spreadsheetId: id, pending: queue.size, running: queue.pending });
  }
  return { activeSpreadsheets: writeLocks.size, locks };
}
