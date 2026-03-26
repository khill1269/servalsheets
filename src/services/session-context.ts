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
import { ServiceError } from '../core/errors.js';
import type { RequestContext } from './request-context.js';

export interface SpreadsheetContext {
  spreadsheetId: string;
  title?: string;
  sheetNames?: string[];
  lastAccessed: Date;
}

export interface OperationRecord {
  tool: string;
  action: string;
  timestamp: Date;
  description?: string;
  success: boolean;
  error?: string;
}

export interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface UserPreferences {
  timezone?: string;
  locale?: string;
  autoSnapshot?: boolean;
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

export interface SessionState {
  requestContext?: RequestContext;
  activeSpreadsheet?: SpreadsheetContext;
  recentSpreadsheets: SpreadsheetContext[];
  operationHistory: OperationRecord[];
  undoStack: OperationRecord[];
  redoStack: OperationRecord[];
  alerts: Alert[];
  preferences: UserPreferences;
  lastActivity: Date;
}

export class SessionContextManager {
  private state: SessionState = {
    recentSpreadsheets: [],
    operationHistory: [],
    undoStack: [],
    redoStack: [],
    alerts: [],
    preferences: {},
    lastActivity: new Date(),
  };

  private readonly maxRecentSpreadsheets = 10;
  private readonly maxOperationHistory = 100;

  constructor(initialContext?: RequestContext) {
    if (initialContext) {
      this.state.requestContext = initialContext;
    }
  }

  /**
   * Set the active spreadsheet context
   */
  setActiveSpreadsheet(context: SpreadsheetContext): void {
    this.state.activeSpreadsheet = context;
    this.addRecentSpreadsheet(context);
    this.state.lastActivity = new Date();
  }

  /**
   * Get the active spreadsheet context
   */
  getActiveSpreadsheet(): SpreadsheetContext | undefined {
    return this.state.activeSpreadsheet;
  }

  /**
   * Find a spreadsheet by fuzzy reference (e.g., "the budget", "my CRM")
   */
  findSpreadsheetByReference(reference: string): SpreadsheetContext | undefined {
    const lowerRef = reference.toLowerCase();

    // Exact match first
    const exact = this.state.recentSpreadsheets.find(
      (s) => s.title?.toLowerCase() === lowerRef
    );
    if (exact) return exact;

    // Substring match
    const substring = this.state.recentSpreadsheets.find(
      (s) => s.title?.toLowerCase().includes(lowerRef)
    );
    if (substring) return substring;

    // Default to active
    if (this.state.activeSpreadsheet) return this.state.activeSpreadsheet;

    return undefined;
  }

  /**
   * Record an operation in the history
   */
  recordOperation(operation: Omit<OperationRecord, 'timestamp'>): void {
    const record: OperationRecord = {
      ...operation,
      timestamp: new Date(),
    };

    this.state.operationHistory.push(record);
    if (this.state.operationHistory.length > this.maxOperationHistory) {
      this.state.operationHistory.shift();
    }

    // Clear redo stack on new operation
    this.state.redoStack = [];

    this.state.lastActivity = new Date();
  }

  /**
   * Get recent operations (default last 10)
   */
  getRecentOperations(count: number = 10): OperationRecord[] {
    return this.state.operationHistory.slice(-count);
  }

  /**
   * Push to undo stack
   */
  pushUndo(operation: OperationRecord): void {
    this.state.undoStack.push(operation);
  }

  /**
   * Pop from undo stack
   */
  popUndo(): OperationRecord | undefined {
    return this.state.undoStack.pop();
  }

  /**
   * Push to redo stack
   */
  pushRedo(operation: OperationRecord): void {
    this.state.redoStack.push(operation);
  }

  /**
   * Pop from redo stack
   */
  popRedo(): OperationRecord | undefined {
    return this.state.redoStack.pop();
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: Partial<UserPreferences>): void {
    this.state.preferences = {
      ...this.state.preferences,
      ...preferences,
    };
    this.state.lastActivity = new Date();
  }

  /**
   * Get current preferences
   */
  getPreferences(): UserPreferences {
    return this.state.preferences;
  }

  /**
   * Add or update alert
   */
  addAlert(alert: Alert): void {
    this.state.alerts.push(alert);
    this.state.lastActivity = new Date();
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.state.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): Alert[] {
    return this.state.alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Get the full session state
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Reset the session
   */
  reset(): void {
    this.state = {
      recentSpreadsheets: [],
      operationHistory: [],
      undoStack: [],
      redoStack: [],
      alerts: [],
      preferences: {},
      lastActivity: new Date(),
    };
  }

  private addRecentSpreadsheet(context: SpreadsheetContext): void {
    // Remove duplicate if exists
    this.state.recentSpreadsheets = this.state.recentSpreadsheets.filter(
      (s) => s.spreadsheetId !== context.spreadsheetId
    );

    // Add to front
    this.state.recentSpreadsheets.unshift(context);

    // Keep max size
    if (this.state.recentSpreadsheets.length > this.maxRecentSpreadsheets) {
      this.state.recentSpreadsheets.pop();
    }
  }
}
