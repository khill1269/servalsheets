/**
 * SessionContextManager
 *
 * @purpose Enables natural language interactions by resolving references like "the spreadsheet", "undo that", "my CRM"
 * @category Core
 * @usage Essential for conversational AI - tracks active spreadsheet, operation history, user preferences, pending operations
 * @dependencies logger
 * @stateful Yes - maintains active spreadsheet context, recent spreadsheets (max 10), operation history (max 100), user preferences
 * @singleton No - one instance per conversation/session to maintain isolated context
 *
 * @example
 * const manager = new SessionContextManager();
 * manager.setActiveSpreadsheet({ spreadsheetId: '1ABC', title: 'Budget' });
 * const found = manager.findSpreadsheetByReference('the budget'); // resolves to '1ABC'
 * manager.recordOperation({ tool: 'sheets_data', action: 'write', description: 'Updated Q1 data' });
 */
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
/**
 * Manages conversation-level context for natural language interactions
 */
export declare class SessionContextManager {
    private state;
    private readonly maxRecentSpreadsheets;
    private readonly maxOperationHistory;
    private readonly maxSheetNames;
    private readonly maxDescriptionLength;
    private readonly maxStateStringLength;
    constructor(initialState?: Partial<SessionState>);
    /**
     * Set the active spreadsheet
     *
     * Called when user opens or creates a spreadsheet.
     * Enables natural references like "the spreadsheet" or "this sheet".
     */
    setActiveSpreadsheet(context: SpreadsheetContext): void;
    /**
     * Get the active spreadsheet
     *
     * Returns null if no spreadsheet is active.
     * Claude should ask "Which spreadsheet?" if null.
     */
    getActiveSpreadsheet(): SpreadsheetContext | null;
    /**
     * Get the active spreadsheet ID or throw helpful error
     */
    requireActiveSpreadsheet(): SpreadsheetContext;
    /**
     * Find spreadsheet by natural reference
     *
     * Handles: "the budget", "Q4 report", "my CRM", etc.
     */
    findSpreadsheetByReference(reference: string): SpreadsheetContext | null;
    private matchesReference;
    /**
     * Get recent spreadsheets for "switch to..." or "show recent"
     */
    getRecentSpreadsheets(): SpreadsheetContext[];
    private addToRecent;
    /**
     * Update last accessed range
     */
    setLastRange(range: string): void;
    /**
     * Record an operation for "undo" support
     */
    recordOperation(record: Omit<OperationRecord, 'id' | 'timestamp'>): string;
    /**
     * Get the last operation (for "undo that")
     */
    getLastOperation(): OperationRecord | null;
    /**
     * Get last undoable operation
     */
    getLastUndoableOperation(): OperationRecord | null;
    /**
     * Get operation history
     */
    getOperationHistory(limit?: number): OperationRecord[];
    /**
     * Find operation by natural reference
     *
     * Handles: "that", "the last write", "the format change", etc.
     */
    findOperationByReference(reference: string): OperationRecord | null;
    /**
     * Update user preferences
     */
    updatePreferences(updates: Partial<UserPreferences>): void;
    /**
     * Get current preferences
     */
    getPreferences(): UserPreferences;
    /**
     * Learn preference from user behavior
     *
     * Called when user confirms/skips confirmations, uses certain formats, etc.
     */
    learnPreference(key: string, value: unknown): void;
    /**
     * Set pending multi-step operation
     *
     * For complex operations that span multiple turns.
     */
    setPendingOperation(operation: SessionState['pendingOperation']): void;
    /**
     * Get pending operation (for "continue" commands)
     */
    getPendingOperation(): SessionState['pendingOperation'];
    /**
     * Clear pending operation
     */
    clearPendingOperation(): void;
    /**
     * Get full session state (for debugging/persistence)
     */
    getState(): SessionState;
    /**
     * Reset session state
     */
    reset(): void;
    /**
     * Export state for persistence
     *
     * Safely serializes state with length checks to prevent exceeding JavaScript string limits.
     * Returns truncated state summary if full serialization would exceed limits.
     */
    exportState(): string;
    /**
     * Import state from persistence
     */
    importState(json: string): void;
    /**
     * Get context summary for Claude
     *
     * Returns a natural language summary of current context
     * that Claude can use to understand the conversation state.
     * Truncates long strings to prevent memory issues.
     */
    getContextSummary(): string;
    /**
     * Suggest next actions based on context
     */
    suggestNextActions(): string[];
}
/**
 * Get or create the session context manager singleton
 */
export declare function getSessionContext(): SessionContextManager;
/**
 * Reset the session context (for testing or new sessions)
 */
export declare function resetSessionContext(): void;
export declare const SessionContext: {
    SessionContextManager: typeof SessionContextManager;
    getSessionContext: typeof getSessionContext;
    resetSessionContext: typeof resetSessionContext;
};
//# sourceMappingURL=session-context.d.ts.map