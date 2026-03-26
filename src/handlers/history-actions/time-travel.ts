/**
 * History handler submodule — timeline, diff_revisions, restore_cells actions
 */

import { ErrorCodes } from '../error-codes.js';
import type { drive_v3, sheets_v4 } from 'googleapis';
import type { HistoryResponse } from '../../schemas/history.js';
import type {
  HistoryTimelineInput,
  HistoryDiffRevisionsInput,
  HistoryRestoreCellsInput,
} from '../../schemas/history.js';
import { getTimeline, diffRevisions, restoreCells } from '../../services/revision-timeline.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';
import { confirmDestructiveAction } from '../../mcp/elicitation.js';
import type { SamplingServer } from '../../mcp/sampling.js';
import {
  withSamplingTimeout,
  assertSamplingConsent,
  generateAIInsight,
} from '../../mcp/sampling.js';
import { recordRevisionId } from '../../mcp/completions.js';
import { recordTimeTravelOp } from '../../observability/metrics.js';
import { getSessionContext } from '../../services/session-context.js';
import { sendProgress } from '../../utils/request-context.js';
import type { SnapshotService } from '../../services/snapshot.js';
import type { GoogleApiClient } from '../../services/google-api.js';
import type { SessionContextManager } from '../../services/session-context.js';

export async function handleTimeline(
  req: HistoryTimelineInput,
  driveApi: drive_v3.Drive | undefined,
  samplingServer: SamplingServer | undefined,
  googleClient: GoogleApiClient | undefined,
  sessionContext: SessionContextManager | undefined
): Promise<HistoryResponse> {
  if (!driveApi) {
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Drive API not available for timeline',
        retryable: false,
      },
    };
  }

  await sendProgress(0, 2, 'Scanning revision history...');
  const timeline = await getTimeline(driveApi, req.spreadsheetId, {
    since: req.since,
    until: req.until,
    limit: req.limit,
    googleClient,
  });
  await sendProgress(1, 2, `Found ${timeline.items.length} revision entries`);

  // Wire session context: cache timeline for quick follow-up diff_revisions
  try {
    const session = sessionContext ?? getSessionContext();
    if (timeline.items.length >= 2) {
      const latestId = (timeline.items[0] as { revisionId?: string }).revisionId;
      const previousId = (timeline.items[1] as { revisionId?: string }).revisionId;
      if (latestId && previousId) {
        session.setPendingOperation({
          type: 'timeline',
          step: 1,
          totalSteps: 2,
          context: {
            spreadsheetId: req.spreadsheetId,
            latestRevisionId: latestId,
            previousRevisionId: previousId,
            entryCount: timeline.items.length,
            since: req.since,
            until: req.until,
          },
        });
      }
    }
  } catch {
    /* non-blocking */
  }

  // Wire completions: cache revision IDs for argument autocompletion (ISSUE-062)
  for (const entry of timeline.items) {
    const revId = (entry as unknown as Record<string, unknown>)['revisionId'];
    if (typeof revId === 'string') recordRevisionId(revId);
  }

  // Wire AI insight: narrate change history
  let aiNarrative: string | undefined;
  if (timeline.items.length > 0) {
    const timelineSummary = timeline.items
      .slice(0, 10)
      .map((e) => {
        const entry = e as unknown as Record<string, unknown>;
        const ts = entry['timestamp']
          ? new Date(entry['timestamp'] as string).toISOString()
          : '?';
        const author = entry['author'] ? ` (${entry['author']})` : '';
        const desc = entry['description'] ?? entry['summary'] ?? 'unknown change';
        return `${ts}: ${desc}${author}`;
      })
      .join('; ');
    aiNarrative = await generateAIInsight(
      samplingServer,
      'diffNarrative',
      'Narrate this change timeline — what story does it tell about how this spreadsheet evolved?',
      timelineSummary
    );
  }

  recordTimeTravelOp('timeline', 'success');
  return {
    success: true,
    action: 'timeline',
    timeline: timeline.items,
    activityAvailable: timeline.activityAvailable,
    totalFetched: timeline.totalFetched,
    truncated: timeline.truncated,
    nextPageToken: timeline.nextPageToken,
    ...(aiNarrative !== undefined ? { aiNarrative } : {}),
    message: `Found ${timeline.items.length} revision(s)`,
  };
}

export async function handleDiffRevisions(
  req: HistoryDiffRevisionsInput,
  driveApi: drive_v3.Drive | undefined,
  samplingServer: SamplingServer | undefined
): Promise<HistoryResponse> {
  if (!driveApi) {
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Drive API not available for diff',
        retryable: false,
      },
    };
  }

  const diff = await diffRevisions(
    driveApi,
    req.spreadsheetId,
    req.revisionId1,
    req.revisionId2
  );

  // If sampling is available, generate an explanation of the diff
  let aiExplanation: string | undefined;
  if (samplingServer) {
    try {
      const changeCount = diff.cellChanges?.length ?? 0;
      const sampleChanges = (diff.cellChanges ?? [])
        .slice(0, 5)
        .map(
          (c: { cell: string; oldValue?: unknown; newValue?: unknown }) =>
            `${c.cell}: ${String(c.oldValue ?? '')} → ${String(c.newValue ?? '')}`
        )
        .join('; ');
      await assertSamplingConsent(); // ISSUE-226: GDPR consent gate
      const explanationResult = await withSamplingTimeout(() =>
        samplingServer!.createMessage({
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `In 1-2 sentences, explain what changed between revision ${req.revisionId1} and ${req.revisionId2} of spreadsheet '${req.spreadsheetId}'. There were ${changeCount} cell change(s)${sampleChanges ? ': ' + sampleChanges : ''}.`,
              },
            },
          ],
          maxTokens: 256,
        })
      );
      const text = Array.isArray(explanationResult.content)
        ? ((
            explanationResult.content.find((c) => c.type === 'text') as
              | { text: string }
              | undefined
          )?.text ?? '')
        : ((explanationResult.content as { text?: string }).text ?? '');
      aiExplanation = text.trim();
    } catch {
      // Non-blocking: sampling failure should not block the diff response
    }
  }

  // Wire AI insight: explain why changes matter
  let aiNarrative: string | undefined;
  if (diff.cellChanges && diff.cellChanges.length > 0) {
    const changeSummary = (
      diff.cellChanges as Array<{ cell: string; oldValue?: unknown; newValue?: unknown }>
    )
      .slice(0, 8)
      .map((c) => `${c.cell}: ${String(c.oldValue ?? '')} → ${String(c.newValue ?? '')}`)
      .join('; ');
    aiNarrative = await generateAIInsight(
      samplingServer,
      'diffNarrative',
      'Explain what changed between these revisions and why it matters',
      changeSummary
    );
  }

  recordTimeTravelOp('diff_revisions', 'success');
  return {
    success: true,
    action: 'diff_revisions',
    diff,
    message: diff.summary.metadataOnly
      ? 'Cell-level diff unavailable — Google Drive API exports current version only, not historical revisions for Workspace files. Metadata comparison (timestamps, authors) is shown instead. For cell-level change tracking, use sheets_history.timeline which tracks ServalSheets operations.'
      : !diff.isHistorical
        ? `Found ${diff.cellChanges?.length ?? 0} cell change(s) — WARNING: one or both revisions could not be exported from Drive history (revision export unavailable for this file age or format). Diff may reflect current file state rather than the requested revision.`
        : `Found ${diff.cellChanges?.length ?? 0} cell change(s)`,
    ...(aiExplanation !== undefined ? { aiExplanation } : {}),
    ...(aiNarrative !== undefined ? { aiNarrative } : {}),
  };
}

export async function handleRestoreCells(
  req: HistoryRestoreCellsInput,
  driveApi: drive_v3.Drive | undefined,
  sheetsApi: sheets_v4.Sheets | undefined,
  snapshotService: SnapshotService | undefined,
  server: ElicitationServer | undefined
): Promise<HistoryResponse> {
  if (!driveApi || !sheetsApi) {
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Drive/Sheets API not available for restore',
        retryable: false,
      },
    };
  }

  if (req.safety?.dryRun) {
    return {
      success: true,
      action: 'restore_cells',
      restored: req.cells.map((c) => ({ cell: c })),
      message: `Dry run: would restore ${req.cells.length} cell(s) from revision ${req.revisionId}`,
    };
  }

  // Create snapshot before restoring (before confirmation per safety rail order)
  let snapshotId: string | undefined;
  if (req.safety?.createSnapshot !== false && snapshotService) {
    snapshotId = await snapshotService.create(req.spreadsheetId, 'Pre-restore backup');
  }

  // Require confirmation when restoring >10 cells (bulk operation threshold)
  if (req.cells.length > 10 && server) {
    const confirmation = await confirmDestructiveAction(
      server,
      'restore_cells',
      `Restore ${req.cells.length} cells from revision ${req.revisionId} in spreadsheet ${req.spreadsheetId}. This will overwrite current cell values.`
    );
    if (!confirmation.confirmed) {
      return {
        success: false,
        error: {
          code: ErrorCodes.PRECONDITION_FAILED,
          message: confirmation.reason || 'User cancelled the bulk restore operation',
          retryable: false,
          suggestedFix: 'Restore fewer cells at a time, or use safety.dryRun to preview first',
        },
      };
    }
  }

  const restored = await restoreCells(
    driveApi,
    sheetsApi,
    req.spreadsheetId,
    req.revisionId,
    req.cells
  );

  recordTimeTravelOp('restore_cells', 'success');
  return {
    success: true,
    action: 'restore_cells',
    restored,
    snapshotId,
    message: `Restored ${restored.length} cell(s) from revision ${req.revisionId}`,
  };
}
