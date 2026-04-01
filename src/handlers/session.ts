/**
 * ServalSheets - Session Handler
 *
 * Handles session context management operations.
 *
 * @module handlers/session
 */

import { ErrorCodes } from './error-codes.js';
import type { SheetsSessionInput, SheetsSessionOutput } from '../schemas/session.js';
import { PipelineExecutor, type PipelineStep } from '../services/pipeline-executor.js';
import { getPipelineDispatch } from '../services/pipeline-registry.js';
import type { SchedulerService } from '../services/scheduler.js';
import { getSessionContext, SessionContextManager } from '../services/session-context.js';
import { unwrapRequest } from './base.js';
import { ValidationError } from '../core/errors.js';
import { applyVerbosityFilter } from './helpers/verbosity-filter.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { sendProgress } from '../utils/request-context.js';
import { logger } from '../utils/logger.js';

// Submodule action handlers
import {
  handleSetActive,
  handleGetActive,
  handleGetContext,
  handleRecordOperation,
  handleGetLastOperation,
} from './session-actions/context.js';
import { handleGetHistory, handleFindByReference } from './session-actions/history.js';
import {
  handleUpdatePreferences,
  handleGetPreferences,
  handleUpdateProfilePreferences,
} from './session-actions/preferences.js';
import {
  handleSetPending,
  handleGetPending,
  handleClearPending,
} from './session-actions/pending.js';
import {
  handleSaveCheckpoint,
  handleLoadCheckpoint,
  handleListCheckpoints,
  handleDeleteCheckpoint,
} from './session-actions/checkpoints.js';
import {
  handleGetAlerts,
  handleAcknowledgeAlert,
  handleClearAlerts,
} from './session-actions/alerts.js';
import {
  handleSetUserId,
  handleGetProfile,
  handleRecordSuccessfulFormula,
  handleRejectSuggestion,
  handleGetTopFormulas,
} from './session-actions/user-profile.js';
import {
  handleScheduleCreate,
  handleScheduleList,
  handleScheduleCancel,
  handleScheduleRunNow,
} from './session-actions/scheduling.js';

// ============================================================================
// MODULE-LEVEL SCHEDULER REGISTRY
// ============================================================================

/** Module-level scheduler instance — set via SessionHandler.setScheduler() */
let _scheduler: SchedulerService | null = null;

function getScheduler(): SchedulerService | null {
  return _scheduler;
}

// ============================================================================
// HANDLER CLASS
// ============================================================================

/**
 * Session handler class for lazy loading
 */
export class SessionHandler {
  /** Lazily-initialized pipeline executor (populated on first execute_pipeline call). */
  private pipeline: PipelineExecutor | null = null;
  private readonly sessionContext?: SessionContextManager;

  constructor(sessionContext?: SessionContextManager) {
    this.sessionContext = sessionContext;
  }

  /** Register a SchedulerService so schedule_* actions are available. */
  setScheduler(scheduler: SchedulerService): void {
    _scheduler = scheduler;
  }

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

    const result = await handleSheetsSession(input, this.sessionContext);

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
            code: ErrorCodes.INTERNAL_ERROR,
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
export async function handleSheetsSession(
  input: SheetsSessionInput,
  sessionContext?: SessionContextManager
): Promise<SheetsSessionOutput> {
  const session = sessionContext ?? getSessionContext();
  const req = unwrapRequest<SheetsSessionInput['request']>(input);
  const { action } = req;

  try {
    switch (action) {
      case 'set_active':
        return await handleSetActive(session, req as Parameters<typeof handleSetActive>[1]);

      case 'get_active':
        return handleGetActive(session);

      case 'get_context':
        return handleGetContext(session);

      case 'record_operation':
        return handleRecordOperation(session, req as Parameters<typeof handleRecordOperation>[1]);

      case 'get_last_operation':
        return handleGetLastOperation(session);

      case 'get_history':
        return handleGetHistory(session, req as Parameters<typeof handleGetHistory>[1]);

      case 'find_by_reference':
        return handleFindByReference(session, req as Parameters<typeof handleFindByReference>[1]);

      case 'update_preferences':
        return handleUpdatePreferences(
          session,
          req as Parameters<typeof handleUpdatePreferences>[1]
        );

      case 'get_preferences':
        return handleGetPreferences(session);

      case 'update_profile_preferences':
        return await handleUpdateProfilePreferences(
          session,
          req as Parameters<typeof handleUpdateProfilePreferences>[1]
        );

      case 'set_pending':
        return handleSetPending(session, req as Parameters<typeof handleSetPending>[1]);

      case 'get_pending':
        return handleGetPending(session);

      case 'clear_pending':
        return handleClearPending(session);

      case 'save_checkpoint':
        return await handleSaveCheckpoint(
          session,
          req as Parameters<typeof handleSaveCheckpoint>[1]
        );

      case 'load_checkpoint':
        return await handleLoadCheckpoint(
          session,
          req as Parameters<typeof handleLoadCheckpoint>[1]
        );

      case 'list_checkpoints':
        return await handleListCheckpoints(req as Parameters<typeof handleListCheckpoints>[0]);

      case 'delete_checkpoint':
        return await handleDeleteCheckpoint(req as Parameters<typeof handleDeleteCheckpoint>[0]);

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

      case 'get_alerts':
        return handleGetAlerts(session, req as Parameters<typeof handleGetAlerts>[1]);

      case 'acknowledge_alert':
        return handleAcknowledgeAlert(session, req as Parameters<typeof handleAcknowledgeAlert>[1]);

      case 'clear_alerts':
        return handleClearAlerts(session);

      case 'set_user_id':
        return await handleSetUserId(session, req as Parameters<typeof handleSetUserId>[1]);

      case 'get_profile':
        return await handleGetProfile(session);

      case 'record_successful_formula':
        return await handleRecordSuccessfulFormula(
          session,
          req as Parameters<typeof handleRecordSuccessfulFormula>[1]
        );

      case 'reject_suggestion':
        return await handleRejectSuggestion(
          session,
          req as Parameters<typeof handleRejectSuggestion>[1]
        );

      case 'get_top_formulas':
        return await handleGetTopFormulas(
          session,
          req as Parameters<typeof handleGetTopFormulas>[1]
        );

      case 'schedule_create':
        return await handleScheduleCreate(
          getScheduler,
          req as Parameters<typeof handleScheduleCreate>[1]
        );

      case 'schedule_list':
        return handleScheduleList(getScheduler, req as Parameters<typeof handleScheduleList>[1]);

      case 'schedule_cancel':
        return await handleScheduleCancel(
          getScheduler,
          req as Parameters<typeof handleScheduleCancel>[1]
        );

      case 'schedule_run_now':
        return await handleScheduleRunNow(
          getScheduler,
          req as Parameters<typeof handleScheduleRunNow>[1]
        );

      case 'execute_pipeline': {
        // Intercepted by SessionHandler.handle() before this function is called.
        // This branch satisfies the exhaustiveness check but is unreachable in production.
        throw new ValidationError(
          'execute_pipeline must be dispatched via SessionHandler.handle()',
          'action'
        );
      }

      case 'compact_session': {
        const keepRecent = (req as { keepRecent?: number }).keepRecent ?? 5;
        const history = session.getOperationHistory(20);
        const operationsBeforeCompact = history.length;

        if (operationsBeforeCompact <= keepRecent) {
          return {
            response: {
              success: true,
              action: 'compact_session',
              message: `History has ${operationsBeforeCompact} operation(s) — nothing to compact (keepRecent=${keepRecent}).`,
              operationsBefore: operationsBeforeCompact,
              operationsAfter: operationsBeforeCompact,
              compacted: 0,
            },
          };
        }

        // Generate a text digest from operations that will be replaced
        const toSummarize = history.slice(keepRecent);
        const digestLines = toSummarize.map((op) => `${op.tool}.${op.action}: ${op.description}`);
        const digest = `[Compacted ${toSummarize.length} operations] ${digestLines.join('; ')}`;

        session.compactHistory(digest, keepRecent);
        const afterCount = session.getOperationHistory(20).length;

        return {
          response: {
            success: true,
            action: 'compact_session',
            message: `Compacted ${toSummarize.length} older operations into a digest. Kept ${keepRecent} recent operations.`,
            operationsBefore: operationsBeforeCompact,
            operationsAfter: afterCount,
            compacted: toSummarize.length,
          },
        };
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
