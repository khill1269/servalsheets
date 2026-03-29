/**
 * ServalSheets - Safety Helpers
 *
 * Unified safety patterns for all handlers:
 * - Dry-run support
 * - Snapshot creation
 * - Confirmation requirements
 * - Safety warnings and suggestions
 */

import type { SnapshotService } from '../services/snapshot.js';
import { confirmDestructiveAction, type ElicitationServer } from '../mcp/elicitation.js';
import {
  shouldConfirm,
  DESTRUCTIVE_OPERATIONS,
  MODIFYING_OPERATIONS,
  READONLY_OPERATIONS,
} from '../services/confirmation-policy.js';
import { logger } from './logger.js';

export interface SafetyOptions {
  dryRun?: boolean;
  createSnapshot?: boolean;
  autoSnapshot?: boolean;
  requireConfirmation?: boolean;
}

export interface SafetyContext {
  affectedCells?: number;
  affectedRows?: number;
  affectedColumns?: number;
  isDestructive: boolean;
  operationType: string;
  spreadsheetId?: string;
  toolName?: string;
  actionName?: string;
  userPreference?: 'always' | 'destructive' | 'never';
}

export interface SafetyWarning {
  type:
    | 'snapshot_recommended'
    | 'confirmation_recommended'
    | 'dry_run_recommended'
    | 'large_operation';
  message: string;
  suggestion: string;
}

export interface SnapshotResult {
  snapshotId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ConfirmationDecision {
  required: boolean;
  reason: string;
  suggestDryRun: boolean;
  suggestSnapshot: boolean;
  source: 'policy' | 'legacy';
}

export interface RuntimeConfirmationResult {
  confirmed: boolean;
  required: boolean;
  reason?: string;
  outcome: 'not_required' | 'accepted' | 'declined' | 'cancelled' | 'unavailable' | 'timed_out';
  source: 'policy' | 'legacy';
}

function resolveToolAndAction(context: SafetyContext): { tool: string; action: string } | null {
  if (context.toolName && context.actionName) {
    return {
      tool: context.toolName,
      action: context.actionName,
    };
  }

  if (context.operationType.includes(':')) {
    const [tool, action] = context.operationType.split(':');
    if (tool && action) {
      return { tool, action };
    }
  }

  if (!context.toolName) {
    return null;
  }

  if (context.toolName === 'sheets_dimensions' && context.operationType === 'delete') {
    if ((context.affectedColumns ?? 0) > 0) {
      return { tool: context.toolName, action: 'delete_columns' };
    }
    if ((context.affectedRows ?? 0) > 0) {
      return { tool: context.toolName, action: 'delete_rows' };
    }
  }

  const action = context.actionName ?? context.operationType;
  return action ? { tool: context.toolName, action } : null;
}

function isPolicyOwnedOperation(operation: { tool: string; action: string }): boolean {
  const key = `${operation.tool}:${operation.action}`;
  return (
    DESTRUCTIVE_OPERATIONS.has(key) || MODIFYING_OPERATIONS.has(key) || READONLY_OPERATIONS.has(key)
  );
}

export function getConfirmationDecision(context: SafetyContext): ConfirmationDecision {
  const resolved = resolveToolAndAction(context);
  if (resolved && isPolicyOwnedOperation(resolved)) {
    const decision = shouldConfirm({
      tool: resolved.tool,
      action: resolved.action,
      cellCount: context.affectedCells,
      rowCount: context.affectedRows,
      columnCount: context.affectedColumns,
      userPreference: context.userPreference,
    });

    return {
      required: decision.confirm,
      reason: decision.reason,
      suggestDryRun: decision.suggestDryRun,
      suggestSnapshot: decision.suggestSnapshot,
      source: 'policy',
    };
  }

  const { affectedCells = 0, affectedRows = 0, isDestructive } = context;

  if (isDestructive && affectedCells > 100) {
    return {
      required: true,
      reason: `Destructive operation affects ${affectedCells} cells`,
      suggestDryRun: affectedCells > 50,
      suggestSnapshot: true,
      source: 'legacy',
    };
  }

  if (context.operationType.includes('delete') && affectedRows > 10) {
    return {
      required: true,
      reason: `Delete operation affects ${affectedRows} rows`,
      suggestDryRun: false,
      suggestSnapshot: true,
      source: 'legacy',
    };
  }

  return {
    required: false,
    reason: 'Operation is below confirmation threshold',
    suggestDryRun: false,
    suggestSnapshot: isDestructive,
    source: 'legacy',
  };
}

/**
 * Determine if operation requires confirmation based on size/risk
 */
export function requiresConfirmation(context: SafetyContext): boolean {
  return getConfirmationDecision(context).required;
}

export async function requestSafetyConfirmation(params: {
  server?: ElicitationServer;
  operation: string;
  details: string;
  context: SafetyContext;
  skipIfElicitationUnavailable?: boolean;
  logger?: {
    warn?: (message: string, ...args: unknown[]) => void;
    error?: (message: string, ...args: unknown[]) => void;
  };
}): Promise<RuntimeConfirmationResult> {
  const decision = getConfirmationDecision(params.context);

  if (!decision.required) {
    return {
      confirmed: true,
      required: false,
      reason: decision.reason,
      outcome: 'not_required',
      source: decision.source,
    };
  }

  if (!params.server) {
    const reason =
      'Interactive confirmation is unavailable for an operation that requires confirmation.';
    params.logger?.warn?.('Blocking confirmation-required operation without elicitation', {
      operation: params.operation,
      operationType: params.context.operationType,
      source: decision.source,
      skipIfElicitationUnavailable: params.skipIfElicitationUnavailable,
    });

    if (params.skipIfElicitationUnavailable) {
      return {
        confirmed: true,
        required: true,
        reason,
        outcome: 'unavailable',
        source: decision.source,
      };
    }

    return {
      confirmed: false,
      required: true,
      reason,
      outcome: 'unavailable',
      source: decision.source,
    };
  }

  try {
    const confirmation = await confirmDestructiveAction(
      params.server,
      params.operation,
      params.details
    );

    return {
      confirmed: confirmation.confirmed,
      required: true,
      reason: confirmation.reason ?? decision.reason,
      outcome: confirmation.outcome,
      source: decision.source,
    };
  } catch (error) {
    const reason = 'Interactive confirmation failed for an operation that requires confirmation.';
    params.logger?.error?.('Confirmation request failed', {
      operation: params.operation,
      operationType: params.context.operationType,
      error: error instanceof Error ? error.message : String(error),
      source: decision.source,
    });

    return {
      confirmed: false,
      required: true,
      reason,
      outcome: 'unavailable',
      source: decision.source,
    };
  }
}

/**
 * Generate safety warnings and suggestions for operation
 */
export function generateSafetyWarnings(
  context: SafetyContext,
  safetyOptions?: SafetyOptions
): SafetyWarning[] {
  const warnings: SafetyWarning[] = [];
  const { affectedCells = 0, affectedRows = 0, isDestructive, operationType } = context;
  const snapshotRequested = safetyOptions?.createSnapshot ?? safetyOptions?.autoSnapshot ?? false;
  const confirmationDecision = getConfirmationDecision(context);

  // Recommend confirmation for large/destructive operations
  if (confirmationDecision.required && !safetyOptions?.requireConfirmation) {
    warnings.push({
      type: 'confirmation_recommended',
      message: `This operation affects ${affectedCells > 0 ? `${affectedCells} cells` : `${affectedRows} rows`}`,
      suggestion: 'Consider using sheets_confirm to review the plan before execution',
    });
  }

  // Recommend snapshot for destructive operations
  if (isDestructive && !snapshotRequested && !safetyOptions?.dryRun) {
    warnings.push({
      type: 'snapshot_recommended',
      message: `${operationType} is destructive and cannot be undone without a snapshot`,
      suggestion: 'Add {"safety":{"createSnapshot":true}} for instant undo capability',
    });
  }

  // Recommend dry-run for first-time operations
  if (isDestructive && !safetyOptions?.dryRun && affectedCells > 50) {
    warnings.push({
      type: 'dry_run_recommended',
      message: 'Preview changes before executing',
      suggestion: 'Use {"safety":{"dryRun":true}} to see what will change without executing',
    });
  }

  // Warn about large operations
  if (affectedCells > 1000 || affectedRows > 500) {
    warnings.push({
      type: 'large_operation',
      message: `Large operation (${affectedCells || affectedRows} ${affectedCells > 0 ? 'cells' : 'rows'})`,
      suggestion: 'Consider using sheets_transaction to batch operations for better performance',
    });
  }

  return warnings;
}

/**
 * Create snapshot if requested and operation is destructive
 */
export async function createSnapshotIfNeeded(
  snapshotService: SnapshotService | undefined,
  context: SafetyContext,
  safetyOptions?: SafetyOptions
): Promise<SnapshotResult | null> {
  const snapshotRequested = safetyOptions?.createSnapshot ?? safetyOptions?.autoSnapshot ?? false;

  // Only create snapshot if requested AND operation is destructive
  if (!snapshotRequested || !context.isDestructive) {
    return null;
  }

  if (!snapshotService) {
    logger.warn('Snapshot requested but snapshotService not available', {
      operationType: context.operationType,
    });
    return null;
  }

  if (!context.spreadsheetId) {
    logger.warn('Snapshot requested but spreadsheetId not provided', {
      operationType: context.operationType,
    });
    return null;
  }

  try {
    const snapshot = await snapshotService.create(
      context.spreadsheetId,
      `Before ${context.operationType}`
    );

    logger.info('Snapshot created for safety', {
      snapshotId: (snapshot as { id?: string }).id,
      operationType: context.operationType,
      spreadsheetId: context.spreadsheetId,
    });

    return {
      snapshotId: (snapshot as { id?: string }).id ?? '',
      createdAt: new Date().toISOString(),
      metadata: {
        operationType: context.operationType,
        affectedCells: context.affectedCells,
        affectedRows: context.affectedRows,
      },
    };
  } catch (error) {
    logger.error('Failed to create safety snapshot', {
      error: error instanceof Error ? error.message : String(error),
      operationType: context.operationType,
      spreadsheetId: context.spreadsheetId,
    });
    return null;
  }
}

/**
 * Calculate affected cells from range
 */
export function calculateAffectedCells(range?: string): number {
  if (!range) return 0;

  // Parse A1 notation range (e.g., "A1:D10" = 4 cols × 10 rows = 40 cells)
  const match = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  if (!match) return 0;

  const [, startCol, startRow, endCol, endRow] = match;
  if (!startCol || !startRow || !endCol || !endRow) return 0;

  const colStart = columnToNumber(startCol);
  const colEnd = columnToNumber(endCol);
  const rowStart = parseInt(startRow, 10);
  const rowEnd = parseInt(endRow, 10);

  const cols = colEnd - colStart + 1;
  const rows = rowEnd - rowStart + 1;

  return cols * rows;
}

/**
 * Convert column letter to number (A=1, B=2, ..., Z=26, AA=27, etc.)
 */
function columnToNumber(col: string): number {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num;
}

/**
 * Extract affected rows from dimension operations
 */
export function calculateAffectedRows(startIndex: number, count: number): number {
  return count;
}

/**
 * Format safety warnings for response
 */
export function formatSafetyWarnings(warnings: SafetyWarning[]): string[] {
  return warnings.map((w) => `${w.message}. ${w.suggestion}`);
}

/**
 * Check if dry-run mode should return preview
 */
export function shouldReturnPreview(safetyOptions?: SafetyOptions): boolean {
  return safetyOptions?.dryRun === true;
}

/**
 * Build snapshot info for response
 */
export function buildSnapshotInfo(
  snapshot: SnapshotResult | null
): Record<string, unknown> | undefined {
  // OK: Explicit empty - typed as optional, no snapshot provided
  if (!snapshot) return undefined; // OK: Explicit empty

  return {
    snapshotId: snapshot.snapshotId,
    createdAt: snapshot.createdAt,
    undoInstructions: [
      `To undo: sheets_collaborate action="version_restore_snapshot" snapshotId="${snapshot.snapshotId}"`,
      'Or: sheets_history action="undo"',
    ],
  };
}
