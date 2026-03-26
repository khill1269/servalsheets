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
import { UserProfileManager, type UserProfile } from './user-profile-manager.js';
import { UnderstandingStore } from './understanding-store.js';

// ============================================================================
// FUZZY MATCHING UTILITIES
// ============================================================================

/**
 * Lightweight fuzzy matching scoring algorithm
 * Returns candidates scored 0.0-1.0, filtered to > 0.3
 */
function fuzzyMatch(query: string, candidates: string[]): Array<{ value: string; score: number }> {
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/);

  return candidates
    .map((candidate) => {
      const normalizedCandidate = candidate.toLowerCase().trim();
      let score = 0;

      // Exact match (highest priority)
      if (normalizedCandidate === normalizedQuery) {
        return { value: candidate, score: 1.0 };
      }

      // Contains full query string
      if (normalizedCandidate.includes(normalizedQuery)) {
        score = 0.85;
      }

      // Word-based overlap scoring
      const candidateWords = normalizedCandidate.split(/[\s_-]+/);
      let matchedWords = 0;
      for (const qw of queryWords) {
        // Exact word match or partial word overlap
        if (candidateWords.some((cw) => cw === qw || cw.includes(qw) || qw.includes(cw))) {
          matchedWords++;
        }
      }
      const wordOverlapScore = (matchedWords / Math.max(queryWords.length, 1)) * 0.75;
      score = Math.max(score, wordOverlapScore);

      // Prefix bonus (first N characters match)
      const prefixLen = Math.min(3, normalizedQuery.length);
      if (normalizedCandidate.startsWith(normalizedQuery.slice(0, prefixLen))) {
        score += 0.1;
      }

      // Character overlap ratio (Levenshtein-lite)
      const commonChars = [...normalizedQuery].filter((c) =>
        normalizedCandidate.includes(c)
      ).length;
      const charRatio = (commonChars / Math.max(normalizedQuery.length, 1)) * 0.5;
      score = Math.max(score, charRatio);

      return { value: candidate, score: Math.min(score, 1.0) };
    })
    .filter((m) => m.score > 0.3)
    .sort((a, b) => b.score - a.score);
}

const MIN_OPERATION_FUZZY_MATCH_SCORE = 0.5;

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
  /** I18N-01: Spreadsheet locale (e.g. 'en_US', 'fr_FR') — from core.get properties */
  locale?: string;
  /** I18N-02: Spreadsheet time zone (e.g. 'America/New_York') — from core.get properties */
  timeZone?: string;
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

export interface Alert {
  /** Unique alert ID */
  id: string;
  /** Alert severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Alert message */
  message: string;
  /** Timestamp when alert was created */
  timestamp: number;
  /** Spreadsheet ID if alert is related to a specific spreadsheet */
  spreadsheetId?: string;
  /** Actionable fix for this alert */
  actionable?: {
    tool: string;
    action: string;
    params: Record<string, unknown>;
  };
  /** Whether the alert has been acknowledged */
  acknowledged: boolean;
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
  /**
   * When true, the tool-call response layer will auto-record operations
   * to the session context (convenience for stateless environments).
   */
  autoRecord: boolean;
}

export interface SessionContextInput {
  activeSpreadsheet?: SpreadsheetContext;
  recentSpreadsheets?: SpreadsheetContext[];
  operationHistory?: OperationRecord[];
  userPreferences?: Partial<UserPreferences>;
  alerts?: Alert[];
}

/**
 * Session context — resolved at each request start via SessionHandler.get_context
 * Enables client-side reference resolution: "the spreadsheet", "undo that"
 */
export interface SessionContext {
  activeSpreadsheet?: SpreadsheetContext;
  /** Most recently used spreadsheets (FIFO, max 10 items) */
  recentSpreadsheets: SpreadsheetContext[];
  /** Last 100 operations (FIFO, newest first) */
  operationHistory: OperationRecord[];
  /** User preferences and settings */
  userPreferences: UserPreferences;
  /** Alerts and notifications */
  alerts: Alert[];
  /** LLM connectors available and configured */
  connectors?: {
    /** Auto-configured (zero-auth) connectors */
    zeroAuth?: string[];
    /** User-authenticated (OAuth) connectors */
    oauthReady?: string[];
  };
}

// ============================================================================
// SESSION CONTEXT MANAGER
// ============================================================================

export class SessionContextManager {
  private activeSpreadsheet?: SpreadsheetContext;
  private recentSpreadsheets: SpreadsheetContext[] = [];
  private operationHistory: OperationRecord[] = [];
  private userPreferences: UserPreferences;
  private alerts: Alert[] = [];
  private userProfile: UserProfileManager;
  private understandingStore: UnderstandingStore;

  // FIFO limits (Session 110 fix)
  private static readonly MAX_RECENT_SPREADSHEETS = 10;
  private static readonly MAX_OPERATION_HISTORY = 100;

  constructor() {
    this.userProfile = new UserProfileManager();
    this.understandingStore = new UnderstandingStore();
    this.userPreferences = this.getDefaultPreferences();
  }

  /**
   * Get the current session context snapshot.
   * This is the data returned by SessionHandler.get_context to the LLM client.
   */
  getContext(): SessionContext {
    return {
      activeSpreadsheet: this.activeSpreadsheet,
      recentSpreadsheets: [...this.recentSpreadsheets],
      operationHistory: [...this.operationHistory],
      userPreferences: { ...this.userPreferences },
      alerts: [...this.alerts],
    };
  }

  /**
   * Set the active spreadsheet context
   */
  setActiveSpreadsheet(context: SpreadsheetContext): void {
    this.activeSpreadsheet = context;

    // Add to recent list with FIFO bounding (Session 110 fix)
    const existing = this.recentSpreadsheets.findIndex((s) => s.spreadsheetId === context.spreadsheetId);
    if (existing >= 0) {
      this.recentSpreadsheets.splice(existing, 1);
    }
    this.recentSpreadsheets.unshift(context);
    if (this.recentSpreadsheets.length > SessionContextManager.MAX_RECENT_SPREADSHEETS) {
      this.recentSpreadsheets.pop();
    }

    logger.debug('Session context: active spreadsheet set', {
      spreadsheetId: context.spreadsheetId,
      title: context.title,
    });
  }

  /**
   * Record an operation for undo/redo support
   */
  recordOperation(op: Omit<OperationRecord, 'id' | 'timestamp'>): void {
    const record: OperationRecord = {
      ...op,
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };

    // Add with FIFO bounding (Session 110 fix)
    this.operationHistory.unshift(record);
    if (this.operationHistory.length > SessionContextManager.MAX_OPERATION_HISTORY) {
      this.operationHistory.pop();
    }

    logger.debug('Session context: operation recorded', {
      operationId: record.id,
      tool: op.tool,
      action: op.action,
    });
  }

  /**
   * Find a spreadsheet by reference (fuzzy matching)
   */
  findSpreadsheetByReference(reference: string): SpreadsheetContext | undefined {
    const allSpreadsheets = [
      this.activeSpreadsheet,
      ...this.recentSpreadsheets,
    ].filter(Boolean) as SpreadsheetContext[];

    if (allSpreadsheets.length === 0) {
      return undefined;
    }

    // Try exact matches first
    if (allSpreadsheets.some((s) => s.spreadsheetId === reference)) {
      return allSpreadsheets.find((s) => s.spreadsheetId === reference);
    }

    // Fuzzy match on title
    const candidates = allSpreadsheets.map((s) => s.title);
    const matches = fuzzyMatch(reference, candidates);
    if (matches.length === 0) {
      return undefined;
    }

    const bestMatchTitle = matches[0]!.value;
    return allSpreadsheets.find((s) => s.title === bestMatchTitle);
  }

  /**
   * Get an operation by fuzzy reference
   */
  findOperationByReference(reference: string): OperationRecord | undefined {
    const recentOps = this.operationHistory.slice(0, 10); // Last 10 ops
    const candidates = recentOps.map((op) => op.description);
    const matches = fuzzyMatch(reference, candidates);

    if (matches.length === 0 || !matches[0] || matches[0].score < MIN_OPERATION_FUZZY_MATCH_SCORE) {
      return undefined;
    }

    const bestMatchDesc = matches[0].value;
    return recentOps.find((op) => op.description === bestMatchDesc);
  }

  /**
   * Update user preferences
   */
  updatePreferences(prefs: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...prefs };
    logger.debug('Session context: user preferences updated', { prefs });
  }

  /**
   * Add an alert
   */
  addAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Alert {
    const fullAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };
    this.alerts.push(fullAlert);
    return fullAlert;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Store analysis results for later retrieval (via session.get_understanding)
   */
  recordUnderstanding(spreadsheetId: string, understanding: Record<string, unknown>): void {
    this.understandingStore.store(spreadsheetId, understanding);
  }

  /**
   * Retrieve stored understanding
   */
  getUnderstanding(spreadsheetId: string): Record<string, unknown> | undefined {
    return this.understandingStore.get(spreadsheetId);
  }

  /**
   * Get user profile (timezone, locale, etc.)
   */
  getUserProfile(): UserProfile {
    return this.userProfile.getProfile();
  }

  /**
   * Update user profile
   */
  setUserProfile(profile: Partial<UserProfile>): void {
    this.userProfile.updateProfile(profile);
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      confirmationLevel: 'destructive',
      defaultSafety: {
        dryRun: false,
        createSnapshot: true,
      },
      formatting: {
        headerStyle: 'bold',
        dateFormat: 'YYYY-MM-DD',
        currencyFormat: '$#,##0.00',
      },
      autoRecord: false,
    };
  }
}
