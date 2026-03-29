/**
 * ConfirmationPolicy
 *
 * @purpose Defines rules for when Claude must request user confirmation via sheets_confirm (destructive ops, bulk ops, permission changes)
 * @category Quality
 * @usage Read by AI to determine confirmation requirements; provides policy rules, risk assessment, confirmation message templates
 * @dependencies None - pure policy definition
 * @stateful No - stateless policy rules
 * @singleton No - exported as const configuration
 *
 * @example
 * import { CONFIRMATION_POLICY } from './confirmation-policy.js';
 * const requiresConfirmation = CONFIRMATION_POLICY.shouldConfirm(operation);
 * if (requiresConfirmation) await confirmService.request(operation, CONFIRMATION_POLICY.getMessage(operation));
 */

// ============================================================================
// TYPES
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface OperationRisk {
  /** Risk level */
  level: RiskLevel;
  /** Why this risk level */
  reason: string;
  /** Should Claude confirm? */
  requiresConfirmation: boolean;
  /** Specific warning message */
  warning?: string;
}

export interface OperationAnalysis {
  /** Tool being used */
  tool: string;
  /** Action within tool */
  action: string;
  /** Estimated cells affected */
  cellsAffected: number;
  /** Is this destructive? */
  isDestructive: boolean;
  /** Can this be undone? */
  canUndo: boolean;
  /** Risk assessment */
  risk: OperationRisk;
  /** Suggested safety options */
  suggestedSafety: {
    dryRun: boolean;
    createSnapshot: boolean;
  };
}

// ============================================================================
// CONFIRMATION THRESHOLDS
// ============================================================================

/**
 * Thresholds that trigger confirmation requirements
 */
export const CONFIRMATION_THRESHOLDS = {
  /** Cell count thresholds */
  cells: {
    /** Low risk threshold - below this, no confirmation needed */
    low: 50,
    /** Medium risk - suggest confirmation */
    medium: 100,
    /** High risk - require confirmation */
    high: 500,
    /** Critical - always require confirmation + snapshot */
    critical: 1000,
  },

  /** Row/column thresholds for delete operations */
  delete: {
    /** Rows - always confirm deletion of more than this */
    rows: 10,
    /** Columns - always confirm deletion of more than this */
    columns: 3,
    /** Sheets - always confirm sheet deletion */
    sheets: 1,
  },

  /** Multi-step operation thresholds */
  operations: {
    /** Number of steps that triggers confirmation */
    steps: 3,
    /** Number of API calls that triggers confirmation */
    apiCalls: 5,
  },
} as const;

// ============================================================================
// OPERATION RISK CLASSIFICATION
// ============================================================================

/**
 * Operations that are always destructive (data loss possible)
 */
export const DESTRUCTIVE_OPERATIONS = new Set([
  'sheets_data:clear',
  'sheets_data:batch_clear',
  'sheets_data:cut_paste',
  'sheets_core:delete_sheet',
  'sheets_core:batch_delete_sheets',
  'sheets_core:clear_sheet',
  'sheets_dimensions:clear_basic_filter',
  'sheets_dimensions:delete_duplicates',
  'sheets_dimensions:delete_rows',
  'sheets_dimensions:delete_columns',
  'sheets_dimensions:delete_filter_view',
  'sheets_dimensions:delete_slicer',
  'sheets_format:rule_delete_conditional_format',
  'sheets_format:clear_data_validation',
  'sheets_visualize:chart_delete',
  'sheets_visualize:pivot_delete',
  'sheets_advanced:delete_named_range',
  'sheets_advanced:delete_protected_range',
  'sheets_advanced:delete_metadata',
  'sheets_advanced:delete_banding',
  'sheets_collaborate:share_remove',
  'sheets_collaborate:comment_delete',
  'sheets_collaborate:comment_delete_reply',
  'sheets_collaborate:version_delete_snapshot',
  'sheets_collaborate:approval_cancel',
  'sheets_composite:deduplicate',
  'sheets_history:undo',
  'sheets_history:redo',
  'sheets_history:revert_to',
  'sheets_history:clear',
]);

/**
 * Operations that modify data (but can often be undone)
 */
export const MODIFYING_OPERATIONS = new Set([
  'sheets_data:write',
  'sheets_data:append',
  'sheets_data:batch_write',
  'sheets_data:find_replace',
  'sheets_data:merge_cells',
  'sheets_data:unmerge_cells',
  'sheets_format:set_background',
  'sheets_format:set_text_format',
  'sheets_format:set_borders',
  'sheets_format:set_number_format',
  'sheets_format:rule_add_conditional_format',
  'sheets_format:clear_format',
  'sheets_dimensions:insert_rows',
  'sheets_dimensions:insert_columns',
  'sheets_dimensions:move_rows',
  'sheets_dimensions:move_columns',
  'sheets_dimensions:append_rows',
  'sheets_dimensions:append_columns',
  'sheets_dimensions:resize_rows',
  'sheets_dimensions:resize_columns',
  'sheets_dimensions:auto_resize',
  'sheets_dimensions:freeze_rows',
  'sheets_dimensions:freeze_columns',
  'sheets_format:add_conditional_format_rule',
  'sheets_format:set_data_validation',
  'sheets_data:set_validation',
  'sheets_dimensions:set_basic_filter',
  'sheets_dimensions:sort_range',
  'sheets_history:restore_cells',
  'sheets_advanced:add_protected_range',
  'sheets_composite:bulk_update',
]);

/**
 * Operations that are read-only (never need confirmation)
 */
export const READONLY_OPERATIONS = new Set([
  'sheets_auth:status',
  'sheets_core:get',
  'sheets_core:get_url',
  'sheets_core:batch_get',
  'sheets_core:list_sheets',
  'sheets_data:read',
  'sheets_data:batch_read',
  'sheets_analyze:analyze_quality',
  'sheets_analyze:analyze_formulas',
  'sheets_analyze:analyze_data',
  'sheets_analyze:detect_patterns',
  'sheets_quality:validate',
  'sheets_quality:detect_conflicts',
  'sheets_quality:analyze_impact',
  'sheets_history:list',
  'sheets_history:get',
  'sheets_collaborate:version_list_revisions',
  'sheets_session:get_context',
  'sheets_session:get_active',
]);

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

/**
 * Analyze an operation and determine its risk level
 */
export function analyzeOperation(params: {
  tool: string;
  action: string;
  spreadsheetId?: string;
  range?: string;
  cellCount?: number;
  rowCount?: number;
  columnCount?: number;
  values?: unknown[][];
}): OperationAnalysis {
  const { tool, action, cellCount, rowCount, columnCount, values } = params;
  const operationKey = `${tool}:${action}`;

  // Read-only operations - no confirmation needed
  if (READONLY_OPERATIONS.has(operationKey)) {
    return {
      tool,
      action,
      cellsAffected: 0,
      isDestructive: false,
      canUndo: true,
      risk: {
        level: 'low',
        reason: 'Read-only operation',
        requiresConfirmation: false,
      },
      suggestedSafety: {
        dryRun: false,
        createSnapshot: false,
      },
    };
  }

  // Calculate cells affected
  let estimatedCells = cellCount ?? 0;
  if (!estimatedCells && values) {
    estimatedCells = values.length * (values[0]?.length ?? 1);
  }
  if (!estimatedCells && rowCount && columnCount) {
    estimatedCells = rowCount * columnCount;
  }

  // Check for destructive operations
  const isDestructive = DESTRUCTIVE_OPERATIONS.has(operationKey);
  const isModifying = MODIFYING_OPERATIONS.has(operationKey);

  // Determine risk level
  let risk: OperationRisk;

  if (isDestructive) {
    // Destructive operations
    if (action === 'delete_sheet' && tool === 'sheets_core') {
      risk = {
        level: 'critical',
        reason: 'Deleting entire sheet - all data will be lost',
        requiresConfirmation: true,
        warning: '⚠️ CRITICAL: This will permanently delete the entire sheet and all its data!',
      };
    } else if (tool === 'sheets_core' && action === 'batch_delete_sheets') {
      risk = {
        level: 'critical',
        reason: 'Deleting multiple sheets',
        requiresConfirmation: true,
        warning: '⚠️ CRITICAL: This will permanently delete multiple sheets and all of their data!',
      };
    } else if (tool === 'sheets_core' && action === 'clear_sheet') {
      risk = {
        level: estimatedCells > CONFIRMATION_THRESHOLDS.cells.high ? 'high' : 'medium',
        reason: 'Clearing an entire sheet',
        requiresConfirmation: true,
        warning: '⚠️ This will clear all values or artifacts from the selected sheet',
      };
    } else if (tool === 'sheets_composite' && action === 'deduplicate') {
      const duplicateRows = rowCount ?? estimatedCells;
      risk = {
        level: duplicateRows > CONFIRMATION_THRESHOLDS.delete.rows ? 'high' : 'medium',
        reason: `Removing ${duplicateRows} duplicate rows`,
        requiresConfirmation: duplicateRows > 0,
        warning:
          duplicateRows > 0
            ? `⚠️ This will permanently remove ${duplicateRows} duplicate rows`
            : undefined,
      };
    } else if (tool === 'sheets_history' && action === 'clear') {
      risk = {
        level: 'high',
        reason: 'Clearing recorded operation history',
        requiresConfirmation: true,
        warning: '⚠️ This permanently removes operation history and audit context',
      };
    } else if (
      tool === 'sheets_history' &&
      (action === 'undo' || action === 'redo' || action === 'revert_to')
    ) {
      risk = {
        level: 'high',
        reason: `History recovery operation: ${action}`,
        requiresConfirmation: true,
        warning: '⚠️ This will overwrite the current spreadsheet state with a prior snapshot',
      };
    } else if (action === 'delete_rows') {
      const rowsToDelete = rowCount ?? 0;
      risk = {
        level: rowsToDelete > CONFIRMATION_THRESHOLDS.delete.rows ? 'high' : 'medium',
        reason: `Deleting ${rowsToDelete} rows`,
        requiresConfirmation: rowsToDelete > CONFIRMATION_THRESHOLDS.delete.rows,
        warning:
          rowsToDelete > CONFIRMATION_THRESHOLDS.delete.rows
            ? `⚠️ This will delete ${rowsToDelete} rows of data`
            : undefined,
      };
    } else if (action === 'delete_columns') {
      const columnsToDelete = columnCount ?? 0;
      risk = {
        level: columnsToDelete > CONFIRMATION_THRESHOLDS.delete.columns ? 'high' : 'medium',
        reason: `Deleting ${columnsToDelete} columns`,
        requiresConfirmation: columnsToDelete > CONFIRMATION_THRESHOLDS.delete.columns,
        warning:
          columnsToDelete > CONFIRMATION_THRESHOLDS.delete.columns
            ? `⚠️ This will delete ${columnsToDelete} columns of data`
            : undefined,
      };
    } else if (action === 'clear') {
      risk = {
        level: estimatedCells > CONFIRMATION_THRESHOLDS.cells.high ? 'high' : 'medium',
        reason: `Clearing ${estimatedCells} cells`,
        requiresConfirmation: estimatedCells > CONFIRMATION_THRESHOLDS.cells.medium,
        warning: `⚠️ This will clear ${estimatedCells} cells`,
      };
    } else {
      risk = {
        level: 'medium',
        reason: 'Destructive operation',
        requiresConfirmation: true,
      };
    }
  } else if (isModifying) {
    // Modifying operations - risk based on cell count
    if (tool === 'sheets_history' && action === 'restore_cells') {
      risk = {
        level: estimatedCells > 10 ? 'high' : 'medium',
        reason: `Restoring ${estimatedCells} historical cells`,
        requiresConfirmation: estimatedCells > 10,
        warning:
          estimatedCells > 10
            ? `⚠️ This will overwrite ${estimatedCells} current cells with historical values`
            : undefined,
      };
    } else if (tool === 'sheets_advanced' && action === 'add_protected_range') {
      risk = {
        level: 'high',
        reason: 'Changing spreadsheet edit permissions with a protected range',
        requiresConfirmation: true,
        warning: '⚠️ This will restrict editing access for the targeted range',
      };
    } else if (
      tool === 'sheets_dimensions' &&
      (action === 'insert_rows' || action === 'insert_columns')
    ) {
      const count = action === 'insert_rows' ? (rowCount ?? 0) : (columnCount ?? 0);
      risk = {
        level: count > 10 ? 'high' : 'medium',
        reason: `Inserting ${count} ${action === 'insert_rows' ? 'rows' : 'columns'}`,
        requiresConfirmation: count > 10,
        warning:
          count > 10
            ? `⚠️ This will shift existing ${action === 'insert_rows' ? 'rows' : 'columns'} and modify sheet structure`
            : undefined,
      };
    } else if (
      tool === 'sheets_dimensions' &&
      (action === 'append_rows' || action === 'append_columns')
    ) {
      const count = action === 'append_rows' ? (rowCount ?? 0) : (columnCount ?? 0);
      risk = {
        level: count > 10 ? 'high' : 'medium',
        reason: `Appending ${count} ${action === 'append_rows' ? 'rows' : 'columns'}`,
        requiresConfirmation: count > 10,
        warning:
          count > 10
            ? `⚠️ This will increase sheet dimensions by ${count} ${action === 'append_rows' ? 'rows' : 'columns'}`
            : undefined,
      };
    } else if (
      tool === 'sheets_dimensions' &&
      (action === 'move_rows' || action === 'move_columns')
    ) {
      const count = action === 'move_rows' ? (rowCount ?? 0) : (columnCount ?? 0);
      risk = {
        level: 'medium',
        reason: `Reordering ${count} ${action === 'move_rows' ? 'rows' : 'columns'}`,
        requiresConfirmation: true,
        warning: `⚠️ This will reorder existing ${action === 'move_rows' ? 'rows' : 'columns'} and may disrupt formulas or filters`,
      };
    } else if (tool === 'sheets_composite' && action === 'bulk_update') {
      const rowsToUpdate = rowCount ?? 0;
      risk = {
        level:
          rowsToUpdate > 10 || estimatedCells > CONFIRMATION_THRESHOLDS.cells.high
            ? 'high'
            : estimatedCells > CONFIRMATION_THRESHOLDS.cells.medium
              ? 'medium'
              : 'low',
        reason: `Bulk updating ${rowsToUpdate || estimatedCells} record(s)`,
        requiresConfirmation:
          rowsToUpdate > 10 || estimatedCells > CONFIRMATION_THRESHOLDS.cells.high,
        warning:
          rowsToUpdate > 10 || estimatedCells > CONFIRMATION_THRESHOLDS.cells.high
            ? `⚠️ This will update ${rowsToUpdate || estimatedCells} records across multiple rows`
            : undefined,
      };
    } else if (tool === 'sheets_format' && action === 'clear_format') {
      risk = {
        level: estimatedCells > CONFIRMATION_THRESHOLDS.cells.high ? 'high' : 'medium',
        reason: `Clearing formatting for ${estimatedCells} cells`,
        requiresConfirmation: estimatedCells > CONFIRMATION_THRESHOLDS.cells.high,
        warning:
          estimatedCells > CONFIRMATION_THRESHOLDS.cells.high
            ? `⚠️ This will remove formatting from ${estimatedCells} cells`
            : undefined,
      };
    } else if (estimatedCells > CONFIRMATION_THRESHOLDS.cells.critical) {
      risk = {
        level: 'high',
        reason: `Modifying ${estimatedCells} cells (large operation)`,
        requiresConfirmation: true,
        warning: `This will modify ${estimatedCells} cells. Consider using dryRun first.`,
      };
    } else if (estimatedCells > CONFIRMATION_THRESHOLDS.cells.high) {
      risk = {
        level: 'medium',
        reason: `Modifying ${estimatedCells} cells`,
        requiresConfirmation: true,
      };
    } else if (estimatedCells > CONFIRMATION_THRESHOLDS.cells.medium) {
      risk = {
        level: 'medium',
        reason: `Modifying ${estimatedCells} cells`,
        requiresConfirmation: false, // Suggest but don't require
      };
    } else {
      risk = {
        level: 'low',
        reason: `Small modification (${estimatedCells} cells)`,
        requiresConfirmation: false,
      };
    }
  } else {
    // Unknown operation - be cautious
    risk = {
      level: 'medium',
      reason: 'Unknown operation type',
      requiresConfirmation: estimatedCells > CONFIRMATION_THRESHOLDS.cells.medium,
    };
  }

  return {
    tool,
    action,
    cellsAffected: estimatedCells,
    isDestructive,
    canUndo: !isDestructive || action !== 'delete',
    risk,
    suggestedSafety: {
      dryRun: risk.level === 'high' || risk.level === 'critical',
      createSnapshot: isDestructive || risk.level === 'high' || risk.level === 'critical',
    },
  };
}

/**
 * Analyze a multi-step operation plan
 */
export function analyzeOperationPlan(
  steps: Array<{
    tool: string;
    action: string;
    cellCount?: number;
  }>
): {
  totalRisk: RiskLevel;
  requiresConfirmation: boolean;
  highestRiskStep: number;
  summary: string;
} {
  let highestRisk: RiskLevel = 'low';
  let highestRiskStep = 0;
  let totalCells = 0;
  let hasDestructive = false;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const analysis = analyzeOperation(step);
    totalCells += analysis.cellsAffected;

    if (analysis.isDestructive) hasDestructive = true;

    const riskOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
    if (riskOrder.indexOf(analysis.risk.level) > riskOrder.indexOf(highestRisk)) {
      highestRisk = analysis.risk.level;
      highestRiskStep = i;
    }
  }

  // Multi-step operations get elevated risk
  const stepCount = steps.length;
  let totalRisk = highestRisk;
  if (stepCount >= CONFIRMATION_THRESHOLDS.operations.steps && totalRisk === 'low') {
    totalRisk = 'medium';
  }

  return {
    totalRisk,
    requiresConfirmation:
      totalRisk === 'high' ||
      totalRisk === 'critical' ||
      hasDestructive ||
      stepCount >= CONFIRMATION_THRESHOLDS.operations.steps,
    highestRiskStep,
    summary: `${stepCount} steps, ${totalCells} cells affected, ${hasDestructive ? 'includes destructive operations' : 'no destructive operations'}`,
  };
}

// ============================================================================
// CONFIRMATION DECISION
// ============================================================================

/**
 * Should Claude confirm this operation?
 *
 * Call this before any write operation to determine if confirmation is needed.
 */
export function shouldConfirm(params: {
  tool: string;
  action: string;
  cellCount?: number;
  rowCount?: number;
  columnCount?: number;
  userPreference?: 'always' | 'destructive' | 'never';
}): {
  confirm: boolean;
  reason: string;
  suggestDryRun: boolean;
  suggestSnapshot: boolean;
} {
  const { userPreference = 'destructive' } = params;

  // User said never confirm
  if (userPreference === 'never') {
    return {
      confirm: false,
      reason: 'User preference: never confirm',
      suggestDryRun: false,
      suggestSnapshot: false,
    };
  }

  const analysis = analyzeOperation(params);

  // User said always confirm
  if (userPreference === 'always' && !READONLY_OPERATIONS.has(`${params.tool}:${params.action}`)) {
    return {
      confirm: true,
      reason: 'User preference: always confirm',
      suggestDryRun: analysis.suggestedSafety.dryRun,
      suggestSnapshot: analysis.suggestedSafety.createSnapshot,
    };
  }

  // Default: confirm based on risk
  return {
    confirm: analysis.risk.requiresConfirmation,
    reason: analysis.risk.reason,
    suggestDryRun: analysis.suggestedSafety.dryRun,
    suggestSnapshot: analysis.suggestedSafety.createSnapshot,
  };
}

// ============================================================================
// CLAUDE GUIDANCE (for tool descriptions)
// ============================================================================

/**
 * Generate guidance text for Claude about when to confirm
 */
export function getConfirmationGuidance(): string {
  return `
## When to Request User Confirmation (sheets_confirm)

### ALWAYS Confirm:
- Deleting sheets, rows (>10), or columns (>3)
- Clearing more than 100 cells
- Operations affecting more than 500 cells
- Any operation the user hasn't explicitly requested
- Multi-step operations (3+ steps)
- Sharing or permission changes
- Replacing/overwriting existing data

### SUGGEST Confirmation:
- Operations affecting 50-100 cells
- Formatting large ranges
- Adding validation rules to existing data
- Any batch operation

### NO Confirmation Needed:
- Read operations (get, read, list, find)
- Small writes (<50 cells) that user explicitly requested
- Single cell updates
- Analysis operations

### How to Use sheets_confirm:
1. Build a plan with steps
2. Call sheets_confirm with the plan
3. Wait for user response
4. Only proceed if approved

### Example:
User: "Delete all the empty rows"
Claude: (detects this could delete many rows)
1. First, analyze to count empty rows
2. If >10 rows, call sheets_confirm with plan
3. Show: "Found 47 empty rows. Delete them?"
4. User confirms → Execute
5. User declines → Abort
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConfirmationPolicy = {
  CONFIRMATION_THRESHOLDS,
  DESTRUCTIVE_OPERATIONS,
  MODIFYING_OPERATIONS,
  READONLY_OPERATIONS,
  analyzeOperation,
  analyzeOperationPlan,
  shouldConfirm,
  getConfirmationGuidance,
};
