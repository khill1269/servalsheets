/**
 * ServalSheets - Session Context Manager
 *
 * Provides conversation-level state management for natural language interactions.
 *
 * This is CRITICAL for natural language because:
 * 1. Users say "the spreadsheet" not "spreadsheet ID 1ABC..."
 * 2. Users say "undo that" not "rollback operation xyz"
 * 3. Users expect Claude to remember what we were working on
 *
 * @module services/session-context
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SpreadsheetContext {
  /** Current spreadsheet ID */
  spreadsheetId: string;
  /** Spreadsheet title for natural reference */
  title: string;
  /** When this became the active spreadsheet */
  activatedAt: number;
  /** Sheet names for quick reference */
  sheetNames: string[];
  /** Last accessed range */
  lastRange?: string;
}

export interface OperationRecord {
  /** Unique operation ID */
  id: string;
  /** Tool that was called */
  tool: string;
  /** Action within the tool */
  action: string;
  /** Spreadsheet affected */
  spreadsheetId: string;
  /** Range affected (if applicable) */
  range?: string;
  /** Brief description of what happened */
  description: string;
  /** Timestamp */
  timestamp: number;
  /** Can this operation be undone? */
  undoable: boolean;
  /** Snapshot ID if one was created */
  snapshotId?: string;
  /** Number of cells affected */
  cellsAffected?: number;
}

export interface UserPreferences {
  /** Preferred confirmation level: always, destructive, never */
  confirmationLevel: 'always' | 'destructive' | 'never';
  /** Default safety options */
  defaultSafety: {
    dryRun: boolean;
    createSnapshot: boolean;
  };
  /** Formatting preferences */
  formatting: {
    headerStyle: 'bold' | 'bold-colored' | 'minimal';
    dateFormat: string;
    currencyFormat: string;
  };
}

export interface SessionState {
  /** Current active spreadsheet */
  activeSpreadsheet: SpreadsheetContext | null;
  /** Recently accessed spreadsheets (for "switch to..." commands) */
  recentSpreadsheets: SpreadsheetContext[];
  /** Recent operations for "undo that" support */
  operationHistory: OperationRecord[];
  /** User preferences learned during conversation */
  preferences: UserPreferences;
  /** Pending multi-step operation (for "continue" commands) */
  pendingOperation: {
    type: string;
    step: number;
    totalSteps: number;
    context: Record<string, unknown>;
  } | null;
  /** Session start time */
  startedAt: number;
  /** Last activity time */
  lastActivityAt: number;
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_PREFERENCES: UserPreferences = {
  confirmationLevel: 'destructive',
  defaultSafety: {
    dryRun: false,
    createSnapshot: true,
  },
  formatting: {
    headerStyle: 'bold-colored',
    dateFormat: 'YYYY-MM-DD',
    currencyFormat: '$#,##0.00',
  },
};

function createDefaultState(): SessionState {
  return {
    activeSpreadsheet: null,
    recentSpreadsheets: [],
    operationHistory: [],
    preferences: { ...DEFAULT_PREFERENCES },
    pendingOperation: null,
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  };
}

// ============================================================================
// SESSION CONTEXT MANAGER
// ============================================================================

/**
 * Manages conversation-level context for natural language interactions
 */
export class SessionContextManager {
  private state: SessionState;
  private maxRecentSpreadsheets = 5;
  private maxOperationHistory = 20;

  constructor(initialState?: Partial<SessionState>) {
    this.state = {
      ...createDefaultState(),
      ...initialState,
    };
  }

  // ===========================================================================
  // SPREADSHEET CONTEXT
  // ===========================================================================

  /**
   * Set the active spreadsheet
   *
   * Called when user opens or creates a spreadsheet.
   * Enables natural references like "the spreadsheet" or "this sheet".
   */
  setActiveSpreadsheet(context: SpreadsheetContext): void {
    // Move previous active to recent
    if (this.state.activeSpreadsheet) {
      this.addToRecent(this.state.activeSpreadsheet);
    }

    this.state.activeSpreadsheet = {
      ...context,
      activatedAt: Date.now(),
    };
    this.state.lastActivityAt = Date.now();
  }

  /**
   * Get the active spreadsheet
   *
   * Returns null if no spreadsheet is active.
   * Claude should ask "Which spreadsheet?" if null.
   */
  getActiveSpreadsheet(): SpreadsheetContext | null {
    return this.state.activeSpreadsheet;
  }

  /**
   * Get the active spreadsheet ID or throw helpful error
   */
  requireActiveSpreadsheet(): SpreadsheetContext {
    if (!this.state.activeSpreadsheet) {
      throw new Error(
        'No active spreadsheet. Please specify which spreadsheet to work with, ' +
          "or say 'open [spreadsheet name]' to set one as active."
      );
    }
    return this.state.activeSpreadsheet;
  }

  /**
   * Find spreadsheet by natural reference
   *
   * Handles: "the budget", "Q4 report", "my CRM", etc.
   */
  findSpreadsheetByReference(reference: string): SpreadsheetContext | null {
    const lowerRef = reference.toLowerCase();

    // Check active first
    if (this.state.activeSpreadsheet) {
      if (this.matchesReference(this.state.activeSpreadsheet, lowerRef)) {
        return this.state.activeSpreadsheet;
      }
    }

    // Check recent
    for (const ss of this.state.recentSpreadsheets) {
      if (this.matchesReference(ss, lowerRef)) {
        return ss;
      }
    }

    return null;
  }

  private matchesReference(ss: SpreadsheetContext, reference: string): boolean {
    const lowerTitle = ss.title.toLowerCase();

    // Exact or contains match
    if (lowerTitle === reference || lowerTitle.includes(reference)) {
      return true;
    }

    // Handle "the X" or "my X"
    const stripped = reference.replace(/^(the|my|our)\s+/, '');
    if (lowerTitle.includes(stripped)) {
      return true;
    }

    return false;
  }

  /**
   * Get recent spreadsheets for "switch to..." or "show recent"
   */
  getRecentSpreadsheets(): SpreadsheetContext[] {
    return [...this.state.recentSpreadsheets];
  }

  private addToRecent(context: SpreadsheetContext): void {
    // Remove if already in recent
    this.state.recentSpreadsheets = this.state.recentSpreadsheets.filter(
      (ss) => ss.spreadsheetId !== context.spreadsheetId
    );

    // Add to front
    this.state.recentSpreadsheets.unshift(context);

    // Trim to max
    if (this.state.recentSpreadsheets.length > this.maxRecentSpreadsheets) {
      this.state.recentSpreadsheets = this.state.recentSpreadsheets.slice(
        0,
        this.maxRecentSpreadsheets
      );
    }
  }

  /**
   * Update last accessed range
   */
  setLastRange(range: string): void {
    if (this.state.activeSpreadsheet) {
      this.state.activeSpreadsheet.lastRange = range;
    }
    this.state.lastActivityAt = Date.now();
  }

  // ===========================================================================
  // OPERATION HISTORY
  // ===========================================================================

  /**
   * Record an operation for "undo" support
   */
  recordOperation(record: Omit<OperationRecord, 'id' | 'timestamp'>): string {
    const id = `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const fullRecord: OperationRecord = {
      ...record,
      id,
      timestamp: Date.now(),
    };

    this.state.operationHistory.unshift(fullRecord);

    // Trim to max
    if (this.state.operationHistory.length > this.maxOperationHistory) {
      this.state.operationHistory = this.state.operationHistory.slice(0, this.maxOperationHistory);
    }

    this.state.lastActivityAt = Date.now();
    return id;
  }

  /**
   * Get the last operation (for "undo that")
   */
  getLastOperation(): OperationRecord | null {
    return this.state.operationHistory[0] ?? null;
  }

  /**
   * Get last undoable operation
   */
  getLastUndoableOperation(): OperationRecord | null {
    return this.state.operationHistory.find((op) => op.undoable) ?? null;
  }

  /**
   * Get operation history
   */
  getOperationHistory(limit: number = 10): OperationRecord[] {
    return this.state.operationHistory.slice(0, limit);
  }

  /**
   * Find operation by natural reference
   *
   * Handles: "that", "the last write", "the format change", etc.
   */
  findOperationByReference(reference: string): OperationRecord | null {
    const lowerRef = reference.toLowerCase();

    // "that" or "the last" = most recent
    if (lowerRef === 'that' || lowerRef === 'the last' || lowerRef === 'it') {
      return this.getLastOperation();
    }

    // "the last write" or "the write"
    const actionMatch = lowerRef.match(/(?:the\s+)?(?:last\s+)?(\w+)/);
    if (actionMatch) {
      const action = actionMatch[1]!;
      return (
        this.state.operationHistory.find(
          (op) => op.action.toLowerCase().includes(action) || op.tool.toLowerCase().includes(action)
        ) ?? null
      );
    }

    return null;
  }

  // ===========================================================================
  // USER PREFERENCES
  // ===========================================================================

  /**
   * Update user preferences
   */
  updatePreferences(updates: Partial<UserPreferences>): void {
    this.state.preferences = {
      ...this.state.preferences,
      ...updates,
    };
    this.state.lastActivityAt = Date.now();
  }

  /**
   * Get current preferences
   */
  getPreferences(): UserPreferences {
    return { ...this.state.preferences };
  }

  /**
   * Learn preference from user behavior
   *
   * Called when user confirms/skips confirmations, uses certain formats, etc.
   */
  learnPreference(key: string, value: unknown): void {
    switch (key) {
      case 'skipConfirmation':
        this.state.preferences.confirmationLevel = 'never';
        break;
      case 'alwaysConfirm':
        this.state.preferences.confirmationLevel = 'always';
        break;
      case 'dateFormat':
        if (typeof value === 'string') {
          this.state.preferences.formatting.dateFormat = value;
        }
        break;
      case 'currencyFormat':
        if (typeof value === 'string') {
          this.state.preferences.formatting.currencyFormat = value;
        }
        break;
    }
    this.state.lastActivityAt = Date.now();
  }

  // ===========================================================================
  // PENDING OPERATIONS
  // ===========================================================================

  /**
   * Set pending multi-step operation
   *
   * For complex operations that span multiple turns.
   */
  setPendingOperation(operation: SessionState['pendingOperation']): void {
    this.state.pendingOperation = operation;
    this.state.lastActivityAt = Date.now();
  }

  /**
   * Get pending operation (for "continue" commands)
   */
  getPendingOperation(): SessionState['pendingOperation'] {
    return this.state.pendingOperation;
  }

  /**
   * Clear pending operation
   */
  clearPendingOperation(): void {
    this.state.pendingOperation = null;
    this.state.lastActivityAt = Date.now();
  }

  // ===========================================================================
  // STATE MANAGEMENT
  // ===========================================================================

  /**
   * Get full session state (for debugging/persistence)
   */
  getState(): SessionState {
    return { ...this.state };
  }

  /**
   * Reset session state
   */
  reset(): void {
    this.state = createDefaultState();
  }

  /**
   * Export state for persistence
   */
  exportState(): string {
    return JSON.stringify(this.state);
  }

  /**
   * Import state from persistence
   */
  importState(json: string): void {
    try {
      const imported = JSON.parse(json) as SessionState;
      this.state = {
        ...createDefaultState(),
        ...imported,
      };
    } catch (error) {
      logger.error('Failed to import session state', {
        component: 'session-context',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  // ===========================================================================
  // NATURAL LANGUAGE HELPERS
  // ===========================================================================

  /**
   * Get context summary for Claude
   *
   * Returns a natural language summary of current context
   * that Claude can use to understand the conversation state.
   */
  getContextSummary(): string {
    const parts: string[] = [];

    // Active spreadsheet
    if (this.state.activeSpreadsheet) {
      parts.push(
        `Currently working with: "${this.state.activeSpreadsheet.title}" ` +
          `(${this.state.activeSpreadsheet.sheetNames.length} sheets: ` +
          `${this.state.activeSpreadsheet.sheetNames.slice(0, 3).join(', ')}` +
          `${this.state.activeSpreadsheet.sheetNames.length > 3 ? '...' : ''})`
      );

      if (this.state.activeSpreadsheet.lastRange) {
        parts.push(`Last accessed: ${this.state.activeSpreadsheet.lastRange}`);
      }
    } else {
      parts.push('No spreadsheet currently active.');
    }

    // Last operation
    const lastOp = this.getLastOperation();
    if (lastOp) {
      parts.push(`Last operation: ${lastOp.description}`);
    }

    // Pending operation
    if (this.state.pendingOperation) {
      parts.push(
        `Pending: ${this.state.pendingOperation.type} ` +
          `(step ${this.state.pendingOperation.step}/${this.state.pendingOperation.totalSteps})`
      );
    }

    return parts.join('\n');
  }

  /**
   * Suggest next actions based on context
   */
  suggestNextActions(): string[] {
    const suggestions: string[] = [];

    if (!this.state.activeSpreadsheet) {
      suggestions.push('Open or create a spreadsheet to get started');
      if (this.state.recentSpreadsheets.length > 0) {
        suggestions.push(`Switch to recent: ${this.state.recentSpreadsheets[0]!.title}`);
      }
    } else {
      const lastOp = this.getLastOperation();
      if (lastOp?.action === 'read') {
        suggestions.push('Analyze the data for quality issues');
        suggestions.push('Create a chart from this data');
      } else if (lastOp?.action === 'write') {
        suggestions.push('Format the cells you just updated');
        suggestions.push('Verify the changes look correct');
      }
    }

    return suggestions;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let sessionContext: SessionContextManager | null = null;

/**
 * Get or create the session context manager singleton
 */
export function getSessionContext(): SessionContextManager {
  if (!sessionContext) {
    sessionContext = new SessionContextManager();
  }
  return sessionContext;
}

/**
 * Reset the session context (for testing or new sessions)
 */
export function resetSessionContext(): void {
  sessionContext = new SessionContextManager();
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SessionContext = {
  SessionContextManager,
  getSessionContext,
  resetSessionContext,
};
