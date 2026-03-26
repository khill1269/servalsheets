/**
 * ServalSheets - Prompt Context Helper
 *
 * Provides runtime context for dynamic prompt generation.
 * Used by prompt callbacks to inject auth state, session context,
 * and client capabilities into prompt text.
 */

import { SessionContextManager } from '../../services/session-context.js';
import { isToolFullyUnavailable } from '../tool-availability.js';

export interface PromptContext {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Active spreadsheet ID from session, if any */
  activeSpreadsheetId: string | null;
  /** Active spreadsheet title from session, if any */
  activeSpreadsheetTitle: string | null;
  /** Whether sampling (AI features) is available */
  hasSampling: boolean;
  /** Whether elicitation (user input forms) is available */
  hasElicitation: boolean;
  /** Whether federation tool is available */
  hasFederation: boolean;
  /** Whether webhook tool is available */
  hasWebhooks: boolean;
  /** Recent operation names for continuity */
  recentActions: string[];
}

// Module-level state set during server initialization
let _sessionContextManager: SessionContextManager | null = null;
let _clientCapabilities: { sampling?: boolean; elicitation?: boolean } = {};
let _isAuthenticated = false;

/**
 * Initialize prompt context with server-level dependencies.
 * Called once during server setup.
 */
export function initPromptContext(options: {
  sessionContextManager?: SessionContextManager;
  clientCapabilities?: { sampling?: boolean; elicitation?: boolean };
}): void {
  if (options.sessionContextManager) {
    _sessionContextManager = options.sessionContextManager;
  }
  if (options.clientCapabilities) {
    _clientCapabilities = options.clientCapabilities;
  }
}

/**
 * Update auth state. Called after successful auth or token refresh.
 */
export function setPromptAuthState(authenticated: boolean): void {
  _isAuthenticated = authenticated;
}

/**
 * Update client capabilities. Called during initialization handshake.
 */
export function setPromptClientCapabilities(caps: {
  sampling?: boolean;
  elicitation?: boolean;
}): void {
  _clientCapabilities = caps;
}

/**
 * Get current prompt context for dynamic prompt generation.
 * Safe to call at any time — returns defaults if not initialized.
 */
export function getPromptContext(): PromptContext {
  const activeSpreadsheet = _sessionContextManager?.getActiveSpreadsheet?.() ?? null;

  const recentOps = _sessionContextManager?.['state']?.operationHistory?.slice(0, 5) ?? [];
  const recentActions = recentOps
    .map((op: { action?: string }) => op.action)
    .filter((action): action is string => Boolean(action));

  return {
    isAuthenticated: _isAuthenticated,
    activeSpreadsheetId: activeSpreadsheet?.spreadsheetId ?? null,
    activeSpreadsheetTitle: activeSpreadsheet?.title ?? null,
    hasSampling: _clientCapabilities.sampling ?? false,
    hasElicitation: _clientCapabilities.elicitation ?? false,
    hasFederation: !isToolFullyUnavailable('sheets_federation'),
    hasWebhooks: !isToolFullyUnavailable('sheets_webhook'),
    recentActions,
  };
}
