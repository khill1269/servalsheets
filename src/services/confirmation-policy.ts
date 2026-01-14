/**
 * ServalSheets - Confirmation Policy
 *
 * Defines WHEN Claude should request user confirmation.
 * This is critical for safety and user trust.
 *
 * Claude reads this to know when to use sheets_confirm.
 *
 * @module services/confirmation-policy
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
const DESTRUCTIVE_OPERATIONS = new Set([
  'sheets_values:clear',
  'sheets_sheet:delete',
  'sheets_dimensions:delete_rows',
  'sheets_dimensions:delete_columns',
  'sheets_rules:remove_rule',
  'sheets_charts:delete',
  'sheets_pivot:delete',
  'sheets_advanced:remove_protection',
  'sheets_sharing:revoke',
  'sheets_comments:delete',
]);

/**
 * Operations that modify data (but can often be undone)
 */
const MODIFYING_OPERATIONS = new Set([
  'sheets_values:write',
  'sheets_values:append',
  'sheets_values:batch_write',
  'sheets_values:replace',
  'sheets_cells:merge',
  'sheets_cells:unmerge',
  'sheets_format:set_colors',
  'sheets_format:set_font',
  'sheets_format:set_borders',
  'sheets_format:set_number_format',
  'sheets_format:conditional_format',
  'sheets_dimensions:insert_rows',
  'sheets_dimensions:insert_columns',
  'sheets_dimensions:resize',
  'sheets_dimensions:freeze_rows',
  'sheets_dimensions:freeze_columns',
  'sheets_rules:add_conditional_format',
  'sheets_rules:add_validation',
  'sheets_filter_sort:set_filter',
  'sheets_filter_sort:sort_range',
]);

/**
 * Operations that are read-only (never need confirmation)
 */
const READONLY_OPERATIONS = new Set([
  'sheets_auth:status',
  'sheets_spreadsheet:get',
  'sheets_spreadsheet:get_url',
  'sheets_spreadsheet:batch_get',
  'sheets_sheet:list',
  'sheets_values:read',
  'sheets_values:batch_read',
  'sheets_values:find',
  'sheets_cells:get_properties',
  'sheets_analysis:data_quality',
  'sheets_analysis:formula_audit',
  'sheets_analysis:statistics',
  'sheets_analysis:detect_patterns',
  'sheets_validation:validate_operation',
  'sheets_validation:check_conflicts',
  'sheets_impact:analyze',
  'sheets_impact:get_dependencies',
  'sheets_history:list',
  'sheets_history:get',
  'sheets_versions:list_revisions',
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
    if (action === 'delete' && tool === 'sheets_sheet') {
      risk = {
        level: 'critical',
        reason: 'Deleting entire sheet - all data will be lost',
        requiresConfirmation: true,
        warning: '⚠️ CRITICAL: This will permanently delete the entire sheet and all its data!',
      };
    } else if (rowCount && rowCount > CONFIRMATION_THRESHOLDS.delete.rows) {
      risk = {
        level: 'high',
        reason: `Deleting ${rowCount} rows`,
        requiresConfirmation: true,
        warning: `⚠️ This will delete ${rowCount} rows of data`,
      };
    } else if (columnCount && columnCount > CONFIRMATION_THRESHOLDS.delete.columns) {
      risk = {
        level: 'high',
        reason: `Deleting ${columnCount} columns`,
        requiresConfirmation: true,
        warning: `⚠️ This will delete ${columnCount} columns of data`,
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
    if (estimatedCells > CONFIRMATION_THRESHOLDS.cells.critical) {
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
