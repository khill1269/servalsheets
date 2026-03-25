/**
 * ServalSheets - History Handler
 *
 * Handles operation history tracking, undo/redo functionality, and debugging.
 * Actions delegated to submodules:
 *   operations.ts    — list, get, stats, clear
 *   undo-redo.ts     — undo, redo, revert_to
 *   time-travel.ts   — timeline, diff_revisions, restore_cells
 */

import type { drive_v3, sheets_v4 } from 'googleapis';
import { SnapshotService } from '../services/snapshot.js';
import { unwrapRequest } from './base.js';
import type {
  SheetsHistoryInput,
  SheetsHistoryOutput,
  HistoryTimelineInput,
  HistoryDiffRevisionsInput,
  HistoryRestoreCellsInput,
} from '../schemas/history.js';
import type { ElicitationServer } from '../mcp/elicitation.js';
import type { SamplingServer } from '../mcp/sampling.js';
import { applyVerbosityFilter } from './helpers/verbosity-filter.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { logger } from '../utils/logger.js';
import type { HistoryHandlerOptions } from '../types/history-handler-options.js';
import type { HistoryResponse } from '../schemas/history.js';
import { handleList, handleGet, handleStats, handleClear } from './history-actions/operations.js';
import { handleUndo, handleRedo, handleRevertTo } from './history-actions/undo-redo.js';
import {
  handleTimeline,
  handleDiffRevisions,
  handleRestoreCells,
} from './history-actions/time-travel.js';

export type { HistoryHandlerOptions } from '../types/history-handler-options.js';

export class HistoryHandler {
  private snapshotService?: SnapshotService;
  private driveApi?: drive_v3.Drive;
  private sheetsApi?: sheets_v4.Sheets;
  private server?: ElicitationServer;
  private samplingServer?: SamplingServer;
  private googleClient?: import('../services/google-api.js').GoogleApiClient;
  private sessionContext?: HistoryHandlerOptions['sessionContext'];

  constructor(options: HistoryHandlerOptions = {}) {
    this.snapshotService = options.snapshotService;
    this.driveApi = options.driveApi;
    this.sheetsApi = options.sheetsApi;
    this.server = options.server;
    this.samplingServer = options.samplingServer;
    this.googleClient = options.googleClient;
    this.sessionContext = options.sessionContext;
  }

  async handle(input: SheetsHistoryInput): Promise<SheetsHistoryOutput> {
    const req = unwrapRequest<SheetsHistoryInput['request']>(input);

    try {
      let response: HistoryResponse;

      switch (req.action) {
        case 'list':
          response = await handleList(req);
          break;

        case 'get':
          response = await handleGet(req);
          break;

        case 'stats':
          response = await handleStats(req);
          break;

        case 'undo':
          response = await handleUndo(req, this.snapshotService, this.server);
          break;

        case 'redo':
          response = await handleRedo(req, this.snapshotService, this.server);
          break;

        case 'revert_to':
          response = await handleRevertTo(req, this.snapshotService, this.server);
          break;

        case 'clear':
          response = await handleClear(req, this.server);
          break;

        case 'timeline':
          response = await handleTimeline(
            req as HistoryTimelineInput,
            this.driveApi,
            this.samplingServer,
            this.googleClient,
            this.sessionContext
          );
          break;

        case 'diff_revisions':
          response = await handleDiffRevisions(
            req as HistoryDiffRevisionsInput,
            this.driveApi,
            this.samplingServer
          );
          break;

        case 'restore_cells':
          response = await handleRestoreCells(
            req as HistoryRestoreCellsInput,
            this.driveApi,
            this.sheetsApi,
            this.snapshotService,
            this.server
          );
          break;

        default: {
          const _exhaustiveCheck: never = req;
          response = {
            success: false,
            error: {
              code: 'INVALID_PARAMS' as const,
              message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
              retryable: false,
              suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
            },
          };
        }
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (error) {
      logger.error('History handler error', { action: req.action, error });
      return {
        response: {
          success: false,
          error: mapStandaloneError(error),
        },
      };
    }
  }
}
