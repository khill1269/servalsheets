/**
 * ServalSheets - Session Handler
 *
 * Handles session context management operations.
 *
 * @module handlers/session
 */

import type { SheetsSessionInput, SheetsSessionOutput } from '../schemas/session.js';
import { PipelineExecutor, type PipelineStep } from '../services/pipeline-executor.js';
import { getPipelineDispatch } from '../services/pipeline-registry.js';
import {
  getSessionContext,
  type SpreadsheetContext,
  type UserPreferences,
} from '../services/session-context.js';
import { getHistoryService } from '../services/history-service.js';
import { unwrapRequest } from './base.js';
import { ValidationError } from '../core/errors.js';
import {
  saveCheckpoint,
  loadCheckpoint,
  loadCheckpointByTimestamp,
  listCheckpointsForSession,
  listAllCheckpoints,
  deleteCheckpoint,
  isCheckpointsEnabled,
  getOperationCount,
  type Checkpoint,
} from '../utils/checkpoint.js';
import { applyVerbosityFilter } from './helpers/verbosity-filter.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { sendProgress } from '../utils/request-context.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// HANDLER CLASS
// ============================================================================

/**
 * Session handler class for lazy loading
 */
export class SessionHandler {
  /** Lazily-initialized pipeline executor (populated on first execute_pipeline call). */
  private pipeline: PipelineExecutor | null = null;

  async handle(input: SheetsSessionInput): Promise<SheetsSessionOutput> {
    const req = unwrapRequest<SheetsSessionInput['request']>(input);
    const verbosity = req.verbosity ?? 'standard';

    // execute_pipeline requires access to this.pipeline (class field), so it
    // is dispatched here rather than in the standalone handleSheetsSession().
    if (req.action === 'execute_pipeline') {
      const result = await this.handleExecutePipeline(
        req as {
          action: 'execute_pipeline';
          steps: PipelineStep[];
          failFast?: boolean;
        }
      );
      const filteredResponse = applyVerbosityFilter(result.response, verbosity);
      return { response: filteredResponse };
    }

    const result = await handleSheetsSession(input);

    // Apply verbosity filtering (LLM optimization)
    const filteredResponse = applyVerbosityFilter(result.response, verbosity);

    return { response: filteredResponse };
  }

  private async handleExecutePipeline(req: {
    action: 'execute_pipeline';
    steps: PipelineStep[];
    failFast?: boolean;
  }): Promise<SheetsSessionOutput> {
    try {
      // Lazily initialise from registry (populated by createToolHandlerMap)
      if (!this.pipeline) {
        const dispatch = getPipelineDispatch();
        if (!dispatch) {
          throw new ValidationError(
            'Pipeline executor not available — ensure session handler is fully initialized',
            'pipeline'
          );
        }
        this.pipeline = new PipelineExecutor(dispatch);
      }

      await sendProgress(0, req.steps.length, `Starting pipeline (${req.steps.length} steps)`);

      const pipelineResult = await this.pipeline.executePipeline(req.steps, {
        failFast: req.failFast ?? true,
      });

      await sendProgress(
        pipelineResult.stepsCompleted,
        pipelineResult.stepsTotal,
        pipelineResult.success
          ? 'Pipeline completed'
          : `Pipeline failed at step: ${pipelineResult.failedAt}`
      );

      return {
        response: {
          success: true as const,
          action: 'execute_pipeline' as const,
          stepsCompleted: pipelineResult.stepsCompleted,
          stepsTotal: pipelineResult.stepsTotal,
          pipelineResults: pipelineResult.results,
          ...(pipelineResult.failedAt ? { failedAt: pipelineResult.failedAt } : {}),
          pipelineDurationMs: pipelineResult.durationMs,
        },
      };
    } catch (error) {
      return {
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }
}

// ============================================================================
// HANDLER FUNCTION
// ============================================================================

/**
 * Handle session context operations
 */
export async function handleSheetsSession(input: SheetsSessionInput): Promise<SheetsSessionOutput> {
  const session = getSessionContext();
  const req = unwrapRequest<SheetsSessionInput['request']>(input);
  const { action } = req;

  try {
    switch (action) {
      case 'set_active': {
        const { spreadsheetId, title, sheetNames } = req;
        if (typeof spreadsheetId !== 'string' || spreadsheetId.trim().length === 0) {
          throw new ValidationError('Missing required parameter: spreadsheetId', 'spreadsheetId');
        }
        // Title is optional - use spreadsheetId as fallback if not provided
        // This allows LLMs to quickly set active without knowing the title
        const resolvedTitle = title ?? `Spreadsheet ${spreadsheetId.slice(0, 8)}...`;
        const context: SpreadsheetContext = {
          spreadsheetId,
          title: resolvedTitle,
          sheetNames: sheetNames ?? [],
          activatedAt: Date.now(),
        };
        session.setActiveSpreadsheet(context);
        return {
          response: {
            success: true,
            action: 'set_active',
            spreadsheet: context,
            summary: session.getContextSummary(),
            ...(title === undefined && {
              message:
                'Title was auto-generated from spreadsheetId. Provide title for better natural language references.',
            }),
          },
        };
      }

      case 'get_active': {
        return {
          response: {
            success: true,
            action: 'get_active',
            spreadsheet: session.getActiveSpreadsheet(),
            recentSpreadsheets: session.getRecentSpreadsheets(),
            summary: session.getContextSummary(),
          },
        };
      }

      case 'get_context': {
        // session.getPendingOperation() context field is `Record<string, unknown>`,
        // while PendingOperationSchema expects a more specific value union. The runtime
        // value is always compatible — cast the whole return as the output type.
        return {
          response: {
            success: true,
            action: 'get_context',
            summary: session.getContextSummary(),
            activeSpreadsheet: session.getActiveSpreadsheet(),
            lastOperation: session.getLastOperation(),
            pendingOperation: session.getPendingOperation(),
            suggestedActions: session.suggestNextActions(),
          },
        } as SheetsSessionOutput;
      }

      case 'record_operation': {
        const {
          tool,
          toolAction,
          spreadsheetId,
          range,
          description,
          undoable,
          snapshotId,
          cellsAffected,
        } = req;

        // Type assertion: refine() validates required fields are defined for record_operation action
        const operationId = session.recordOperation({
          tool: tool!,
          action: toolAction!,
          spreadsheetId: spreadsheetId!,
          range,
          description: description!,
          undoable: undoable!,
          snapshotId,
          cellsAffected,
        });

        // Sync operation to HistoryService so sheets_history:get can find it
        const historyService = getHistoryService();
        historyService.record({
          id: operationId,
          timestamp: new Date().toISOString(),
          tool: tool!,
          action: toolAction!,
          params: {
            range,
            description,
            undoable,
          },
          result: 'success',
          duration: 0,
          spreadsheetId: spreadsheetId!,
          cellsAffected,
          snapshotId,
        });

        return {
          response: {
            success: true,
            action: 'record_operation',
            operationId,
          },
        };
      }

      case 'get_last_operation': {
        return {
          response: {
            success: true,
            action: 'get_last_operation',
            operation: session.getLastOperation(),
          },
        };
      }

      case 'get_history': {
        const limit = req.limit ?? 10;
        return {
          response: {
            success: true,
            action: 'get_history',
            operations: session.getOperationHistory(limit),
          },
        };
      }

      case 'find_by_reference': {
        const { reference, referenceType } = req;
        if (typeof reference !== 'string' || reference.trim().length === 0) {
          throw new ValidationError('Missing required parameter: reference', 'reference');
        }

        // Type assertion: refine() validates these are defined for find_by_reference action
        if (referenceType === 'spreadsheet') {
          const spreadsheet = session.findSpreadsheetByReference(reference);
          return {
            response: {
              success: true,
              action: 'find_by_reference',
              found: spreadsheet !== null,
              spreadsheet,
            },
          };
        } else {
          const operation = session.findOperationByReference(reference);
          return {
            response: {
              success: true,
              action: 'find_by_reference',
              found: operation !== null,
              operation,
            },
          };
        }
      }

      case 'update_preferences': {
        const { confirmationLevel, dryRunDefault, snapshotDefault } = req;
        const updates: Partial<UserPreferences> = {};

        if (confirmationLevel) {
          const validLevels: UserPreferences['confirmationLevel'][] = [
            'always',
            'destructive',
            'never',
          ];
          if (validLevels.includes(confirmationLevel as UserPreferences['confirmationLevel'])) {
            updates.confirmationLevel = confirmationLevel as UserPreferences['confirmationLevel'];
          }
        }
        if (dryRunDefault !== undefined || snapshotDefault !== undefined) {
          updates.defaultSafety = {
            dryRun: dryRunDefault ?? session.getPreferences().defaultSafety.dryRun,
            createSnapshot:
              snapshotDefault ?? session.getPreferences().defaultSafety.createSnapshot,
          };
        }

        session.updatePreferences(updates);

        return {
          response: {
            success: true,
            action: 'update_preferences',
            preferences: session.getPreferences(),
          },
        };
      }

      case 'get_preferences': {
        return {
          response: {
            success: true,
            action: 'get_preferences',
            preferences: session.getPreferences(),
          },
        };
      }

      case 'set_pending': {
        const { type, step, totalSteps, context } = req;
        // Type assertion: refine() validates these are defined for set_pending action
        session.setPendingOperation({
          type: type!,
          step: step!,
          totalSteps: totalSteps!,
          context: context! as Record<
            string,
            string | number | boolean | unknown[] | Record<string, unknown> | null
          >,
        });
        // getPendingOperation() context field is `Record<string, unknown>`, which
        // the output schema narrows further. Cast the return as the output type.
        return {
          response: {
            success: true,
            action: 'set_pending',
            pending: session.getPendingOperation(),
          },
        } as SheetsSessionOutput;
      }

      case 'get_pending': {
        return {
          response: {
            success: true,
            action: 'get_pending',
            pending: session.getPendingOperation(),
          },
        } as SheetsSessionOutput;
      }

      case 'clear_pending': {
        session.clearPendingOperation();
        return {
          response: {
            success: true,
            action: 'clear_pending',
            pending: null,
          },
        };
      }

      case 'save_checkpoint': {
        if (!isCheckpointsEnabled()) {
          return {
            response: {
              success: false,
              error: {
                code: 'CHECKPOINTS_DISABLED',
                message: 'Checkpoints disabled. Set ENABLE_CHECKPOINTS=true in .env.local',
                retryable: false,
              },
            },
          };
        }

        await sendProgress(0, 100, 'Saving checkpoint...');
        const { sessionId, description } = req;
        const activeSpreadsheet = session.getActiveSpreadsheet();
        const history = session.getOperationHistory(100);

        const checkpoint: Checkpoint = {
          sessionId: sessionId!,
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
          description,
          completedSteps: getOperationCount(),
          completedOperations: history.map((op) => `${op.tool}.${op.action}`),
          spreadsheetId: activeSpreadsheet?.spreadsheetId,
          spreadsheetTitle: activeSpreadsheet?.title,
          sheetNames: activeSpreadsheet?.sheetNames,
          lastRange: activeSpreadsheet?.lastRange,
          context: {},
          // UserPreferences is a typed interface; Checkpoint.preferences is
          // Record<string, unknown>. The runtime values are always compatible.
          preferences: session.getPreferences() as unknown as Record<string, unknown>,
        };

        const filepath = await saveCheckpoint(checkpoint);
        await sendProgress(100, 100, 'Checkpoint saved');

        return {
          response: {
            success: true,
            action: 'save_checkpoint',
            checkpointPath: filepath,
            checkpoint: {
              sessionId: checkpoint.sessionId,
              timestamp: checkpoint.timestamp,
              createdAt: checkpoint.createdAt,
              description: checkpoint.description,
              completedSteps: checkpoint.completedSteps,
              spreadsheetTitle: checkpoint.spreadsheetTitle,
            },
            message: `Checkpoint saved. Resume with: sheets_session.load_checkpoint({sessionId: "${sessionId}"})`,
          },
        };
      }

      case 'load_checkpoint': {
        if (!isCheckpointsEnabled()) {
          return {
            response: {
              success: false,
              error: {
                code: 'CHECKPOINTS_DISABLED',
                message: 'Checkpoints disabled. Set ENABLE_CHECKPOINTS=true in .env.local',
                retryable: false,
              },
            },
          };
        }

        const { sessionId, timestamp } = req;
        const checkpoint = timestamp
          ? await loadCheckpointByTimestamp(sessionId!, timestamp)
          : await loadCheckpoint(sessionId!);

        if (!checkpoint) {
          return {
            response: {
              success: false,
              error: {
                code: 'CHECKPOINT_NOT_FOUND',
                message: `No checkpoint found for session "${sessionId}"`,
                retryable: false,
              },
            },
          };
        }

        // Restore session state
        if (checkpoint.spreadsheetId && checkpoint.spreadsheetTitle) {
          session.setActiveSpreadsheet({
            spreadsheetId: checkpoint.spreadsheetId,
            title: checkpoint.spreadsheetTitle,
            sheetNames: checkpoint.sheetNames || [],
            activatedAt: Date.now(),
            lastRange: checkpoint.lastRange,
          });
        }

        return {
          response: {
            success: true,
            action: 'load_checkpoint',
            checkpoint: {
              sessionId: checkpoint.sessionId,
              timestamp: checkpoint.timestamp,
              createdAt: checkpoint.createdAt,
              description: checkpoint.description,
              completedSteps: checkpoint.completedSteps,
              spreadsheetTitle: checkpoint.spreadsheetTitle,
            },
            message: `Resumed from checkpoint. ${checkpoint.completedSteps} steps already completed.`,
          },
        };
      }

      case 'list_checkpoints': {
        if (!isCheckpointsEnabled()) {
          return {
            response: {
              success: true,
              action: 'list_checkpoints',
              checkpoints: [],
              message: 'Checkpoints disabled. Set ENABLE_CHECKPOINTS=true in .env.local',
            },
          };
        }

        const { sessionId } = req;
        const checkpoints = sessionId
          ? await listCheckpointsForSession(sessionId)
          : await listAllCheckpoints();

        return {
          response: {
            success: true,
            action: 'list_checkpoints',
            checkpoints,
          },
        };
      }

      case 'delete_checkpoint': {
        if (!isCheckpointsEnabled()) {
          return {
            response: {
              success: false,
              error: {
                code: 'CHECKPOINTS_DISABLED',
                message: 'Checkpoints disabled. Set ENABLE_CHECKPOINTS=true in .env.local',
                retryable: false,
              },
            },
          };
        }

        const { sessionId, timestamp } = req;
        const deleted = await deleteCheckpoint(sessionId!, timestamp);

        return {
          response: {
            success: true,
            action: 'delete_checkpoint',
            deleted,
            message: deleted
              ? `Checkpoint(s) deleted for session "${sessionId}"`
              : `No checkpoints found for session "${sessionId}"`,
          },
        };
      }

      case 'reset': {
        session.reset();
        return {
          response: {
            success: true,
            action: 'reset',
            message: 'Session context cleared. Ready for a fresh start!',
          },
        };
      }

      case 'get_alerts': {
        const { onlyUnacknowledged, severity } = req;

        const alerts = session.getAlerts({
          onlyUnacknowledged: onlyUnacknowledged ?? true,
          severity,
        });

        // Alert type from session-context has `actionable` params typed as
        // Record<string, unknown>, while the output schema uses a specific value union.
        // The runtime values are always compatible.
        return {
          response: {
            success: true,
            action: 'get_alerts' as const,
            alerts,
            count: alerts.length,
            hasCritical: alerts.some((a) => a.severity === 'critical'),
          },
        } as SheetsSessionOutput;
      }

      case 'acknowledge_alert': {
        const { alertId } = req;
        const acknowledged = session.acknowledgeAlert(alertId!);
        if (!acknowledged) {
          throw new ValidationError(`Alert not found: ${alertId}`, 'alertId');
        }
        return {
          response: {
            success: true,
            action: 'acknowledge_alert' as const,
            alertId: alertId!,
            message: 'Alert acknowledged',
          },
        };
      }

      case 'clear_alerts': {
        session.clearAlerts();
        return {
          response: {
            success: true,
            action: 'clear_alerts' as const,
            message: 'All alerts cleared',
          },
        };
      }

      case 'set_user_id': {
        const { userId } = req as { userId: string };
        await session.setUserId(userId);
        return {
          response: {
            success: true,
            action: 'set_user_id' as const,
            userId,
            message: 'User profile loaded',
          },
        };
      }

      case 'get_profile': {
        const profile = await session.getUserProfile();
        return {
          response: {
            success: true,
            action: 'get_profile' as const,
            profile,
          },
        };
      }

      case 'update_profile_preferences': {
        const { preferences } = req as { preferences: Record<string, unknown> };
        await session.updateUserPreferences(preferences);
        return {
          response: {
            success: true,
            action: 'update_profile_preferences' as const,
            message: 'Preferences updated',
          },
        };
      }

      case 'record_successful_formula': {
        const { formula, useCase } = req as { formula: string; useCase: string };
        await session.recordSuccessfulFormula(formula, useCase);
        return {
          response: {
            success: true,
            action: 'record_successful_formula' as const,
            message: 'Formula recorded',
          },
        };
      }

      case 'reject_suggestion': {
        const { suggestion } = req as { suggestion: string };
        await session.rejectSuggestion(suggestion);
        return {
          response: {
            success: true,
            action: 'reject_suggestion' as const,
            message: 'Suggestion rejected and recorded',
          },
        };
      }

      case 'get_top_formulas': {
        const { limit } = req as { limit?: number };
        const formulas = await session.getTopFormulas(limit);
        return {
          response: {
            success: true,
            action: 'get_top_formulas' as const,
            formulas,
          },
        };
      }

      case 'execute_pipeline': {
        // Intercepted by SessionHandler.handle() before this function is called.
        // This branch satisfies the exhaustiveness check but is unreachable in production.
        throw new ValidationError(
          'execute_pipeline must be dispatched via SessionHandler.handle()',
          'action'
        );
      }

      default: {
        const exhaustiveCheck: never = action;
        throw new ValidationError(`Unknown action: ${exhaustiveCheck}`, 'action');
      }
    }
  } catch (error) {
    logger.error('Session handler error', {
      action,
      error,
    });
    return {
      response: {
        success: false,
        error: mapStandaloneError(error),
      },
    };
  }
}
