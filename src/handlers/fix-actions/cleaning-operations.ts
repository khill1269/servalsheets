/**
 * Cleaning Operations (F3)
 *
 * Handles: clean, standardize_formats, fill_missing actions
 */

import { CleaningEngine, parseRangeOffset } from '../../services/cleaning-engine.js';
import { withSamplingTimeout, assertSamplingConsent } from '../../mcp/sampling.js';
import { recordCleaningOp } from '../../observability/metrics.js';
import { extractRangeA1 } from '../../utils/range-helpers.js';
import type {
  CleanInput,
  StandardizeFormatsInput,
  FillMissingInput,
  SheetsFixOutput,
} from '../../schemas/fix.js';
import type { FixHandlerAccess } from './internal.js';

// ISSUE-047: CleaningEngine is stateless — use module-level singleton to avoid
// recreating the instance (and its pre-compiled rule arrays) on every action call.
const _cleaningEngine = new CleaningEngine();

export async function handleCleanAction(
  handler: FixHandlerAccess,
  req: CleanInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  let resolvedInput = req;

  // Wizard: If no specific rules are provided, elicit cleaning mode
  if (
    (!resolvedInput.rules || resolvedInput.rules.length === 0) &&
    handler.context?.server?.elicitInput
  ) {
    try {
      const wizard = await handler.context.server.elicitInput({
        message: 'Ready to clean data. Preview first or apply directly?',
        requestedSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              title: 'Cleaning mode',
              description: 'Preview changes first (safe) or apply directly?',
              enum: ['preview', 'apply'],
            },
          },
        },
      });
      const wizardContent = wizard?.content as Record<string, unknown> | undefined;
      const mode =
        wizardContent?.['mode'] === 'preview' || wizardContent?.['mode'] === 'apply'
          ? wizardContent['mode']
          : undefined;
      if (wizard?.action === 'accept' && mode) {
        resolvedInput = { ...resolvedInput, mode };
      }
    } catch {
      // Elicitation not available — default to preview mode
      if (!resolvedInput.mode) {
        resolvedInput = { ...resolvedInput, mode: 'preview' as const };
      }
    }
  }

  if (!resolvedInput.spreadsheetId || !resolvedInput.range) {
    recordCleaningOp('clean', 'unknown', 'error');
    return {
      response: handler._mapError(new Error('Missing required fields: spreadsheetId and range')),
    };
  }

  const mode = resolvedInput.mode ?? 'preview';
  const engine = _cleaningEngine; // ISSUE-047: reuse module-level singleton

  const rangeA1 = extractRangeA1(resolvedInput.range);
  await handler._sendProgress(0, 3, 'Fetching data for cleaning...');

  // Fetch data from the range
  const data = await handler._fetchRangeData(resolvedInput.spreadsheetId, rangeA1);
  const rangeOffset = parseRangeOffset(rangeA1);

  await handler._sendProgress(1, 3, 'Analyzing data and applying cleaning rules...');

  // Run cleaning
  const result = await engine.clean(data, resolvedInput.rules, rangeOffset);

  // Apply mode: write changes back
  if (mode === 'apply' && result.changes.length > 0) {
    const snapshot =
      resolvedInput.safety?.createSnapshot !== false
        ? await handler._createSnapshot(resolvedInput.spreadsheetId)
        : undefined;

    await handler._writeChanges(resolvedInput.spreadsheetId, rangeA1, data, result.changes, rangeOffset);

    handler._trackContextFromRequest({ spreadsheetId: resolvedInput.spreadsheetId });

    // Wire session context: record applied cleaning rules for learning
    try {
      if (handler.context.sessionContext && result.summary.rulesApplied.length > 0) {
        handler.context.sessionContext.recordOperation({
          tool: 'sheets_fix',
          action: 'clean',
          spreadsheetId: resolvedInput.spreadsheetId,
          range: rangeA1,
          description: `Cleaned ${result.summary.cellsCleaned} cell(s) using rules: ${result.summary.rulesApplied.join(', ')}`,
          undoable: !!snapshot?.revisionId,
          snapshotId: snapshot?.revisionId,
          cellsAffected: result.summary.cellsCleaned,
        });
      }
    } catch {
      /* non-blocking */
    }

    await handler._sendProgress(3, 3, `Cleaning complete: ${result.summary.cellsCleaned} cell(s) updated`);

    const response = {
      success: true as const,
      mode: 'apply' as const,
      action: 'clean',
      operations: [],
      summary: { total: result.changes.length, applied: result.changes.length },
      message: `Cleaned ${result.summary.cellsCleaned} cell(s) using ${result.summary.rulesApplied.length} rule(s).`,
      snapshotId: snapshot?.revisionId,
      changes: result.changes,
      cleaningSummary: result.summary,
    };
    recordCleaningOp('clean', 'apply', 'success');
    return { response: handler._applyVerbosityFilter(response, verbosity) };
  }

  // Wire AI-powered cleaning recommendation after completion (both modes)
  let aiRecommendation: string | undefined;
  if (handler.context.samplingServer && result.changes.length > 0) {
    try {
      await assertSamplingConsent(); // ISSUE-226: GDPR consent gate
      const recResult = await withSamplingTimeout(() =>
        handler.context.samplingServer!.createMessage({
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Evaluate these data cleaning results:\n- Rules applied: ${result.summary.rulesApplied.join(', ')}\n- Cells cleaned: ${result.summary.cellsCleaned}\n- Total changes: ${result.changes.length}\n\nRecommend any follow-up cleaning steps or optimizations.`,
              },
            },
          ],
          maxTokens: 256,
        })
      );
      const text = Array.isArray(recResult.content)
        ? ((recResult.content.find((c) => c.type === 'text') as { text: string } | undefined)?.text ?? '')
        : ((recResult.content as { text?: string }).text ?? '');
      aiRecommendation = text.trim();
    } catch {
      // Non-blocking: sampling failure should not block the response
    }
  }

  await handler._sendProgress(
    3,
    3,
    `Preview complete: ${result.summary.cellsCleaned} cell(s) would be cleaned`
  );

  // Preview mode
  const response = {
    success: true as const,
    mode: 'preview' as const,
    action: 'clean',
    operations: [],
    summary: { total: result.changes.length },
    message: `Preview: ${result.summary.cellsCleaned} cell(s) would be cleaned using ${result.summary.rulesApplied.length} rule(s). Use mode="apply" to execute.`,
    changes: result.changes,
    cleaningSummary: result.summary,
    ...(aiRecommendation !== undefined ? { aiRecommendation } : {}),
  };
  recordCleaningOp('clean', 'preview', 'success');
  return { response: handler._applyVerbosityFilter(response, verbosity) };
}

export async function handleStandardizeFormatsAction(
  handler: FixHandlerAccess,
  req: StandardizeFormatsInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  if (!req.spreadsheetId || !req.range || !req.columns) {
    recordCleaningOp('standardize_formats', 'unknown', 'error');
    return {
      response: handler._mapError(
        new Error('Missing required fields: spreadsheetId, range, and columns')
      ),
    };
  }

  const mode = req.mode ?? 'preview';
  const engine = _cleaningEngine; // ISSUE-047: reuse module-level singleton

  await handler._sendProgress(0, 3, 'Fetching data for format standardization...');

  const data = await handler._fetchRangeData(req.spreadsheetId, extractRangeA1(req.range));
  const rangeOffset = parseRangeOffset(extractRangeA1(req.range));

  await handler._sendProgress(1, 3, `Standardizing formats across ${req.columns.length} column(s)...`);

  const result = await engine.standardizeFormats(data, req.columns, rangeOffset);

  if (mode === 'apply' && result.changes.length > 0) {
    const snapshot =
      req.safety?.createSnapshot !== false ? await handler._createSnapshot(req.spreadsheetId) : undefined;

    await handler._writeChanges(req.spreadsheetId, extractRangeA1(req.range), data, result.changes, rangeOffset);

    handler._trackContextFromRequest({ spreadsheetId: req.spreadsheetId });

    try {
      if (handler.context.sessionContext) {
        handler.context.sessionContext.recordOperation({
          tool: 'sheets_fix',
          action: 'standardize_formats',
          spreadsheetId: req.spreadsheetId,
          range: extractRangeA1(req.range),
          description: `Standardized ${result.summary.cellsChanged} cell(s) across ${result.summary.columnsProcessed} column(s)`,
          undoable: !!snapshot?.revisionId,
          snapshotId: snapshot?.revisionId,
          cellsAffected: result.summary.cellsChanged,
        });
      }
    } catch {
      /* non-blocking */
    }

    await handler._sendProgress(
      3,
      3,
      `Format standardization complete: ${result.summary.cellsChanged} cell(s) updated`
    );

    const response = {
      success: true as const,
      mode: 'apply' as const,
      action: 'standardize_formats',
      operations: [],
      summary: { total: result.changes.length, applied: result.changes.length },
      message: `Standardized ${result.summary.cellsChanged} cell(s) across ${result.summary.columnsProcessed} column(s).`,
      snapshotId: snapshot?.revisionId,
      formatChanges: result.changes,
      formatSummary: result.summary,
    };
    recordCleaningOp('standardize_formats', 'apply', 'success');
    return { response: handler._applyVerbosityFilter(response, verbosity) };
  }

  // Wire AI detection of ambiguous format conversions after completion
  let aiWarnings: string | undefined;
  if (handler.context.samplingServer && result.changes.length > 0) {
    try {
      await assertSamplingConsent(); // ISSUE-226: GDPR consent gate
      const warnResult = await withSamplingTimeout(() =>
        handler.context.samplingServer!.createMessage({
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Identify ambiguous format conversions that might produce incorrect results:\n- Format specs: ${req.columns.map((c) => `${c.column}→${c.targetFormat}`).join(', ')}\n- Cells changed: ${result.summary.cellsChanged}\n- Columns processed: ${result.summary.columnsProcessed}\n\nWarn about date ambiguities (MM/DD vs DD/MM), locale mismatches, or potential data loss.`,
              },
            },
          ],
          maxTokens: 256,
        })
      );
      const text = Array.isArray(warnResult.content)
        ? ((warnResult.content.find((c) => c.type === 'text') as { text: string } | undefined)?.text ?? '')
        : ((warnResult.content as { text?: string }).text ?? '');
      aiWarnings = text.trim();
    } catch {
      // Non-blocking: sampling failure should not block the response
    }
  }

  await handler._sendProgress(
    3,
    3,
    `Preview complete: ${result.summary.cellsChanged} cell(s) would be standardized`
  );

  const response = {
    success: true as const,
    mode: 'preview' as const,
    action: 'standardize_formats',
    operations: [],
    summary: { total: result.changes.length },
    message: `Preview: ${result.summary.cellsChanged} cell(s) would be standardized across ${result.summary.columnsProcessed} column(s). Use mode="apply" to execute.`,
    formatChanges: result.changes,
    formatSummary: result.summary,
    ...(aiWarnings !== undefined ? { aiWarnings } : {}),
  };
  recordCleaningOp('standardize_formats', 'preview', 'success');
  return { response: handler._applyVerbosityFilter(response, verbosity) };
}

export async function handleFillMissingAction(
  handler: FixHandlerAccess,
  req: FillMissingInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  if (!req.spreadsheetId || !req.range || !req.strategy) {
    recordCleaningOp('fill_missing', 'unknown', 'error');
    return {
      response: handler._mapError(
        new Error('Missing required fields: spreadsheetId, range, and strategy')
      ),
    };
  }

  const mode = req.mode ?? 'preview';
  const engine = _cleaningEngine; // ISSUE-047: reuse module-level singleton

  await handler._sendProgress(0, 3, `Fetching data for fill_missing (strategy: ${req.strategy})...`);

  const data = await handler._fetchRangeData(req.spreadsheetId, extractRangeA1(req.range));
  const rangeOffset = parseRangeOffset(extractRangeA1(req.range));

  await handler._sendProgress(1, 3, `Computing fill values using "${req.strategy}" strategy...`);

  const result = await engine.fillMissing(
    data,
    req.strategy,
    { constantValue: req.constantValue, columns: req.columns },
    rangeOffset
  );

  if (mode === 'apply' && result.changes.length > 0) {
    const snapshot =
      req.safety?.createSnapshot !== false ? await handler._createSnapshot(req.spreadsheetId) : undefined;

    await handler._writeChanges(req.spreadsheetId, extractRangeA1(req.range), data, result.changes, rangeOffset);

    handler._trackContextFromRequest({ spreadsheetId: req.spreadsheetId });

    try {
      if (handler.context.sessionContext) {
        handler.context.sessionContext.recordOperation({
          tool: 'sheets_fix',
          action: 'fill_missing',
          spreadsheetId: req.spreadsheetId,
          range: extractRangeA1(req.range),
          description: `Filled ${result.summary.filled} missing cell(s) using ${req.strategy} strategy`,
          undoable: !!snapshot?.revisionId,
          snapshotId: snapshot?.revisionId,
          cellsAffected: result.summary.filled,
        });
      }
    } catch {
      /* non-blocking */
    }

    await handler._sendProgress(
      3,
      3,
      `Fill complete: ${result.summary.filled} of ${result.summary.totalEmpty} cell(s) filled`
    );

    const response = {
      success: true as const,
      mode: 'apply' as const,
      action: 'fill_missing',
      operations: [],
      summary: { total: result.changes.length, applied: result.changes.length },
      message: `Filled ${result.summary.filled} of ${result.summary.totalEmpty} empty cell(s) using "${req.strategy}" strategy.`,
      snapshotId: snapshot?.revisionId,
      fillChanges: result.changes,
      fillSummary: result.summary,
    };
    recordCleaningOp('fill_missing', 'apply', 'success');
    return { response: handler._applyVerbosityFilter(response, verbosity) };
  }

  // Wire AI-powered fill strategy evaluation after completion
  let aiEvaluation: string | undefined;
  if (handler.context.samplingServer && result.changes.length > 0) {
    try {
      await assertSamplingConsent(); // ISSUE-226: GDPR consent gate
      const evalResult = await withSamplingTimeout(() =>
        handler.context.samplingServer!.createMessage({
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Evaluate the fill strategy used for missing data:\n- Strategy: ${req.strategy}\n- Cells filled: ${result.summary.filled} of ${result.summary.totalEmpty}\n- Columns affected: ${Object.keys(result.summary.byColumn).length}\n\nWas this the best approach? Suggest better strategies if applicable (e.g., use median instead of mean for skewed data, use forward-fill for time series).`,
              },
            },
          ],
          maxTokens: 256,
        })
      );
      const text = Array.isArray(evalResult.content)
        ? ((evalResult.content.find((c) => c.type === 'text') as { text: string } | undefined)?.text ?? '')
        : ((evalResult.content as { text?: string }).text ?? '');
      aiEvaluation = text.trim();
    } catch {
      // Non-blocking: sampling failure should not block the response
    }
  }

  await handler._sendProgress(
    3,
    3,
    `Preview complete: ${result.summary.filled} of ${result.summary.totalEmpty} cell(s) would be filled`
  );

  const response = {
    success: true as const,
    mode: 'preview' as const,
    action: 'fill_missing',
    operations: [],
    summary: { total: result.changes.length },
    message: `Preview: ${result.summary.filled} of ${result.summary.totalEmpty} empty cell(s) would be filled using "${req.strategy}" strategy. Use mode="apply" to execute.`,
    fillChanges: result.changes,
    fillSummary: result.summary,
    ...(aiEvaluation !== undefined ? { aiEvaluation } : {}),
  };
  recordCleaningOp('fill_missing', 'preview', 'success');
  return { response: handler._applyVerbosityFilter(response, verbosity) };
}
