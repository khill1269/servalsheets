/**
 * ServalSheets - Session Handler
 *
 * Handles session context management operations.
 *
 * @module handlers/session
 */

import type { SheetsSessionInput, SheetsSessionOutput } from "../schemas/session.js";
import {
  getSessionContext,
  type SpreadsheetContext,
} from "../services/session-context.js";

// ============================================================================
// HANDLER CLASS
// ============================================================================

/**
 * Session handler class for lazy loading
 */
export class SessionHandler {
  async handle(input: SheetsSessionInput): Promise<SheetsSessionOutput> {
    return handleSheetsSession(input);
  }
}

// ============================================================================
// HANDLER FUNCTION
// ============================================================================

/**
 * Handle session context operations
 */
export async function handleSheetsSession(
  input: SheetsSessionInput,
): Promise<SheetsSessionOutput> {
  const session = getSessionContext();
  const { action } = input;

  try {
    switch (action) {
      case "set_active": {
        const { spreadsheetId, title, sheetNames } = input;
        const context: SpreadsheetContext = {
          spreadsheetId,
          title,
          sheetNames,
          activatedAt: Date.now(),
        };
        session.setActiveSpreadsheet(context);
        return {
          response: {
            success: true,
            action: "set_active",
            spreadsheet: context,
          },
        };
      }

      case "get_active": {
        return {
          response: {
            success: true,
            action: "get_active",
            spreadsheet: session.getActiveSpreadsheet(),
            recentSpreadsheets: session.getRecentSpreadsheets(),
          },
        };
      }

      case "get_context": {
        return {
          response: {
            success: true,
            action: "get_context",
            summary: session.getContextSummary(),
            activeSpreadsheet: session.getActiveSpreadsheet(),
            lastOperation: session.getLastOperation(),
            pendingOperation: session.getPendingOperation(),
            suggestedActions: session.suggestNextActions(),
          },
        };
      }

      case "record_operation": {
        const {
          tool,
          toolAction,
          spreadsheetId,
          range,
          description,
          undoable,
          snapshotId,
          cellsAffected,
        } = input;

        const operationId = session.recordOperation({
          tool,
          action: toolAction,
          spreadsheetId,
          range,
          description,
          undoable,
          snapshotId,
          cellsAffected,
        });

        return {
          response: {
            success: true,
            action: "record_operation",
            operationId,
          },
        };
      }

      case "get_last_operation": {
        return {
          response: {
            success: true,
            action: "get_last_operation",
            operation: session.getLastOperation(),
          },
        };
      }

      case "get_history": {
        const limit = input.limit ?? 10;
        return {
          response: {
            success: true,
            action: "get_history",
            operations: session.getOperationHistory(limit),
          },
        };
      }

      case "find_by_reference": {
        const { reference, type } = input;

        if (type === "spreadsheet") {
          const spreadsheet = session.findSpreadsheetByReference(reference);
          return {
            response: {
              success: true,
              action: "find_by_reference",
              found: spreadsheet !== null,
              spreadsheet,
            },
          };
        } else {
          const operation = session.findOperationByReference(reference);
          return {
            response: {
              success: true,
              action: "find_by_reference",
              found: operation !== null,
              operation,
            },
          };
        }
      }

      case "update_preferences": {
        const { confirmationLevel, dryRunDefault, snapshotDefault } = input;
        const updates: Record<string, unknown> = {};

        if (confirmationLevel) {
          updates["confirmationLevel"] = confirmationLevel;
        }
        if (dryRunDefault !== undefined || snapshotDefault !== undefined) {
          updates["defaultSafety"] = {
            dryRun: dryRunDefault ?? session.getPreferences().defaultSafety.dryRun,
            createSnapshot: snapshotDefault ?? session.getPreferences().defaultSafety.createSnapshot,
          };
        }

        session.updatePreferences(updates as never);

        return {
          response: {
            success: true,
            action: "update_preferences",
            preferences: session.getPreferences(),
          },
        };
      }

      case "get_preferences": {
        return {
          response: {
            success: true,
            action: "get_preferences",
            preferences: session.getPreferences(),
          },
        };
      }

      case "set_pending": {
        const { type, step, totalSteps, context } = input;
        session.setPendingOperation({ type, step, totalSteps, context });
        return {
          response: {
            success: true,
            action: "set_pending",
            pending: session.getPendingOperation(),
          },
        };
      }

      case "get_pending": {
        return {
          response: {
            success: true,
            action: "get_pending",
            pending: session.getPendingOperation(),
          },
        };
      }

      case "clear_pending": {
        session.clearPendingOperation();
        return {
          response: {
            success: true,
            action: "clear_pending",
            pending: null,
          },
        };
      }

      case "reset": {
        session.reset();
        return {
          response: {
            success: true,
            action: "reset",
            message: "Session context cleared. Ready for a fresh start!",
          },
        };
      }

      default: {
        const exhaustiveCheck: never = action;
        throw new Error(`Unknown action: ${exhaustiveCheck}`);
      }
    }
  } catch (error) {
    return {
      response: {
        success: false,
        error: {
          code: "SESSION_ERROR",
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      },
    };
  }
}
