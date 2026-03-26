/**
 * ServalSheets - Data Handler
 *
 * Thin dispatch class for sheets_data tool (25 actions).
 * Delegates to modular action handlers in data-actions/ subdirectory.
 */

import { BaseHandler, unwrapRequest, type HandlerContext } from './base.js';
import type { SheetsDataInput, SheetsDataOutput } from '../schemas/data.js';
import type { Intent } from '../core/intent.js';

// Import submodule handlers
import { handleReadAction } from './data-actions/read.js';
import { handleWriteAction } from './data-actions/write.js';
import { handleAppendAction } from './data-actions/append.js';
import { handleClearAction } from './data-actions/clear.js';
import { handleBatchReadAction } from './data-actions/batch-read.js';
import { handleBatchWriteAction } from './data-actions/batch-write.js';
import { handleBatchClearAction } from './data-actions/batch-clear.js';
import { handleFindReplaceAction } from './data-actions/find-replace.js';
import { handleCopyPasteAction } from './data-actions/copy-paste.js';
import { handleCutPasteAction } from './data-actions/cut-paste.js';
import { handleMergeCellsAction } from './data-actions/merge-cells.js';
import { handleUnmergeCellsAction } from './data-actions/unmerge-cells.js';
import { handleGetMergesAction } from './data-actions/get-merges.js';
import { handleAddNoteAction } from './data-actions/add-note.js';
import { handleGetNoteAction } from './data-actions/get-note.js';
import { handleClearNoteAction } from './data-actions/clear-note.js';
import { handleSetHyperlinkAction } from './data-actions/set-hyperlink.js';
import { handleClearHyperlinkAction } from './data-actions/clear-hyperlink.js';
import { handleCrossReadAction } from './data-actions/cross-read.js';
import { handleCrossQueryAction } from './data-actions/cross-query.js';
import { handleCrossWriteAction } from './data-actions/cross-write.js';
import { handleCrossCompareAction } from './data-actions/cross-compare.js';
import { handleSmartFillAction } from './data-actions/smart-fill.js';
import { handleAutoFillAction } from './data-actions/auto-fill.js';
import { handleDetectSpillRangesAction } from './data-actions/detect-spill-ranges.js';

/**
 * Handler access interface for submodule handlers
 * Exposes protected BaseHandler capabilities
 */
export interface DataHandlerAccess {
  readonly toolName: string;
  readonly context: HandlerContext;
  sendProgress(current: number, total: number, message?: string): Promise<void>;
  confirmDestructiveAction(opts: {
    description: string;
    impact?: string;
    impacts?: string[];
    requiresSnapshot?: boolean;
  }): Promise<void>;
  createSnapshotIfNeeded(): Promise<string | undefined>;
}

/**
 * Utility to create handler access from BaseHandler instance
 */
function createHandlerAccess(handler: SheetsDataHandler): DataHandlerAccess {
  return {
    toolName: handler.toolName,
    context: handler.context,
    sendProgress: (current, total, message) => handler.sendProgress(current, total, message),
    confirmDestructiveAction: (opts) => handler.confirmDestructiveAction(opts),
    createSnapshotIfNeeded: () => handler.createSnapshotIfNeeded(),
  };
}

export class SheetsDataHandler extends BaseHandler<SheetsDataInput, SheetsDataOutput> {
  constructor(context: HandlerContext) {
    super('sheets_data', context);
  }

  protected createIntents(_input: SheetsDataInput): Intent[] {
    // Data handler uses direct API calls, not batch compiler
    return [];
  }

  async handle(input: SheetsDataInput): Promise<SheetsDataOutput> {
    const req = unwrapRequest<SheetsDataInput['request']>(input) as SheetsDataInput['request'];

    const handlerAccess = createHandlerAccess(this);

    switch (req.action) {
      case 'read':
        return handleReadAction(req as any, handlerAccess);
      case 'write':
        return handleWriteAction(req as any, handlerAccess);
      case 'append':
        return handleAppendAction(req as any, handlerAccess);
      case 'clear':
        return handleClearAction(req as any, handlerAccess);
      case 'batch_read':
        return handleBatchReadAction(req as any, handlerAccess);
      case 'batch_write':
        return handleBatchWriteAction(req as any, handlerAccess);
      case 'batch_clear':
        return handleBatchClearAction(req as any, handlerAccess);
      case 'find_replace':
        return handleFindReplaceAction(req as any, handlerAccess);
      case 'copy_paste':
        return handleCopyPasteAction(req as any, handlerAccess);
      case 'cut_paste':
        return handleCutPasteAction(req as any, handlerAccess);
      case 'merge_cells':
        return handleMergeCellsAction(req as any, handlerAccess);
      case 'unmerge_cells':
        return handleUnmergeCellsAction(req as any, handlerAccess);
      case 'get_merges':
        return handleGetMergesAction(req as any, handlerAccess);
      case 'add_note':
        return handleAddNoteAction(req as any, handlerAccess);
      case 'get_note':
        return handleGetNoteAction(req as any, handlerAccess);
      case 'clear_note':
        return handleClearNoteAction(req as any, handlerAccess);
      case 'set_hyperlink':
        return handleSetHyperlinkAction(req as any, handlerAccess);
      case 'clear_hyperlink':
        return handleClearHyperlinkAction(req as any, handlerAccess);
      case 'cross_read':
        return handleCrossReadAction(req as any, handlerAccess);
      case 'cross_query':
        return handleCrossQueryAction(req as any, handlerAccess);
      case 'cross_write':
        return handleCrossWriteAction(req as any, handlerAccess);
      case 'cross_compare':
        return handleCrossCompareAction(req as any, handlerAccess);
      case 'smart_fill':
        return handleSmartFillAction(req as any, handlerAccess);
      case 'auto_fill':
        return handleAutoFillAction(req as any, handlerAccess);
      case 'detect_spill_ranges':
        return handleDetectSpillRangesAction(req as any, handlerAccess);
      default:
        return {
          response: {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Unknown action: ${(req as any).action}`,
              retryable: false,
            },
          },
        };
    }
  }
}
