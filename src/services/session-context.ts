/**
 * SessionContextManager (Business Layer)
 *
 * Enables natural language interactions by resolving references like "the spreadsheet", "undo that", "my CRM".
 *
 * ## Context Hierarchy
 *
 * ServalSheets uses a 3-layer context system:
 *
 * ```
 * 1. RequestContext (Protocol Layer)
 *    ↓ contains
 * 2. SessionContext (Business Layer) ← YOU ARE HERE
 *    ↓ contains
 * 3. ContextManager (Inference Layer)
 * ```
 *
 * ## SessionContext - Business Layer
 *
 * **Purpose**: Domain-specific conversation state and spreadsheet tracking
 * **Lifetime**: Client connection/conversation session (minutes to hours)
 * **Scope**: One instance per MCP client connection
 *
 * **Contains**:
 * - Active spreadsheet context (ID, title, sheet names)
 * - Recent spreadsheets (max 10, for "open my Budget")
 * - Operation history (max 100, for "undo that")
 * - User preferences (timezone, locale, naming patterns)
 * - Pending operations (for multi-step workflows)
 *
 * **When to use**:
 * - Resolving conversational references ("the spreadsheet", "my CRM")
 * - Supporting undo/redo operations
 * - Tracking what the user is currently working on
 * - Maintaining conversation history for context
 *
 * **Different from**:
 * - {@link RequestContext} - MCP protocol metadata (requestId, tracing)
 * - {@link ContextManager} - Parameter inference cache (last used IDs)
 *
 * @category Core
 * @dependencies logger
 * @stateful Yes - maintains conversation state
 * @singleton No - one per session
 *
 * @example
 * const manager = new SessionContextManager();
 * manager.setActiveSpreadsheet({ spreadsheetId: '1ABC', title: 'Budget' });
 * const found = manager.findSpreadsheetByReference('the budget'); // resolves to '1ABC'
 * manager.recordOperation({ tool: 'sheets_data', action: 'write', description: 'Updated Q1 data' });
 *
 * @see docs/architecture/CONTEXT_LAYERS.md for full hierarchy
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
  private readonly maxRecentSpreadsheets = 5;
  private readonly maxOperationHistory = 20;
  private readonly maxSheetNames = 100; // Limit sheet names to prevent memory issues
  private readonly maxDescriptionLength = 500; // Limit operation descriptions
  private readonly maxStateStringLength = 10_000_000; // 10MB limit for JSON state

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

    // Limit sheet names to prevent memory issues with large spreadsheets
    const limitedSheetNames = context.sheetNames.slice(0, this.maxSheetNames);

    this.state.activeSpreadsheet = {
      ...context,
      sheetNames: limitedSheetNames,
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

    // Truncate description if too long to prevent memory issues
    const truncatedDescription =
      record.description.length > this.maxDescriptionLength
        ? record.description.slice(0, this.maxDescriptionLength - 3) + '...'
        : record.description;

    const fullRecord: OperationRecord = {
      ...record,
      description: truncatedDescription,
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
   *
   * Safely serializes state with length checks to prevent exceeding JavaScript string limits.
   * Returns truncated state summary if full serialization would exceed limits.
   */
  exportState(): string {
    try {
      // Create a safe copy of state with trimmed arrays
      const safeState: SessionState = {
        ...this.state,
        recentSpreadsheets: this.state.recentSpreadsheets.map((ss) => ({
          ...ss,
          sheetNames: ss.sheetNames.slice(0, 10), // Only first 10 sheet names per spreadsheet
        })),
        operationHistory: this.state.operationHistory.slice(0, this.maxOperationHistory),
      };

      const serialized = JSON.stringify(safeState);

      // Check if serialization exceeds safe limits
      if (serialized.length > this.maxStateStringLength) {
        logger.warn('Session state too large, returning minimal state', {
          component: 'session-context',
          actualSize: serialized.length,
          maxSize: this.maxStateStringLength,
        });

        // Return minimal state with only essential info
        const minimalState: Partial<SessionState> = {
          activeSpreadsheet: this.state.activeSpreadsheet
            ? {
                ...this.state.activeSpreadsheet,
                sheetNames: this.state.activeSpreadsheet.sheetNames.slice(0, 5),
              }
            : null,
          preferences: this.state.preferences,
          startedAt: this.state.startedAt,
          lastActivityAt: this.state.lastActivityAt,
        };

        return JSON.stringify(minimalState);
      }

      return serialized;
    } catch (error) {
      logger.error('Failed to export session state', {
        component: 'session-context',
        error: error instanceof Error ? error.message : String(error),
      });
      // Return minimal fallback state
      return JSON.stringify({ startedAt: this.state.startedAt, lastActivityAt: Date.now() });
    }
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
   * Truncates long strings to prevent memory issues.
   */
  getContextSummary(): string {
    const parts: string[] = [];
    const maxSummaryLength = 2000; // Limit total summary length

    // Active spreadsheet
    if (this.state.activeSpreadsheet) {
      const sheetNamesToShow = this.state.activeSpreadsheet.sheetNames.slice(0, 3);
      const sheetNamesStr = sheetNamesToShow.join(', ');
      const truncatedTitle =
        this.state.activeSpreadsheet.title.length > 100
          ? this.state.activeSpreadsheet.title.slice(0, 97) + '...'
          : this.state.activeSpreadsheet.title;

      parts.push(
        `Currently working with: "${truncatedTitle}" ` +
          `(${this.state.activeSpreadsheet.sheetNames.length} sheets: ` +
          `${sheetNamesStr}` +
          `${this.state.activeSpreadsheet.sheetNames.length > 3 ? '...' : ''})`
      );

      if (this.state.activeSpreadsheet.lastRange) {
        const truncatedRange =
          this.state.activeSpreadsheet.lastRange.length > 100
            ? this.state.activeSpreadsheet.lastRange.slice(0, 97) + '...'
            : this.state.activeSpreadsheet.lastRange;
        parts.push(`Last accessed: ${truncatedRange}`);
      }
    } else {
      parts.push('No spreadsheet currently active.');
    }

    // Last operation
    const lastOp = this.getLastOperation();
    if (lastOp) {
      const truncatedDesc =
        lastOp.description.length > 200
          ? lastOp.description.slice(0, 197) + '...'
          : lastOp.description;
      parts.push(`Last operation: ${truncatedDesc}`);
    }

    // Pending operation
    if (this.state.pendingOperation) {
      const truncatedType =
        this.state.pendingOperation.type.length > 100
          ? this.state.pendingOperation.type.slice(0, 97) + '...'
          : this.state.pendingOperation.type;
      parts.push(
        `Pending: ${truncatedType} ` +
          `(step ${this.state.pendingOperation.step}/${this.state.pendingOperation.totalSteps})`
      );
    }

    const summary = parts.join('\n');

    // Final safety check
    if (summary.length > maxSummaryLength) {
      return summary.slice(0, maxSummaryLength - 3) + '...';
    }

    return summary;
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
