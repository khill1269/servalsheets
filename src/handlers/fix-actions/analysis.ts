/**
 * Analysis Operations (F3)
 *
 * Handles: detect_anomalies, suggest_cleaning actions (read-only)
 */

import { CleaningEngine, parseRangeOffset } from '../../services/cleaning-engine.js';
import { generateAIInsight } from '../../mcp/sampling.js';
import { recordCleaningOp } from '../../observability/metrics.js';
import { extractRangeA1 } from '../../utils/range-helpers.js';
import type { DetectAnomaliesInput, SuggestCleaningInput, SheetsFixOutput } from '../../schemas/fix.js';
import type { FixHandlerAccess } from './internal.js';

// ISSUE-047: CleaningEngine is stateless — use module-level singleton to avoid
// recreating the instance (and its pre-compiled rule arrays) on every action call.
const _cleaningEngine = new CleaningEngine();

export async function handleDetectAnomaliesAction(
  handler: FixHandlerAccess,
  req: DetectAnomaliesInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  if (!req.spreadsheetId || !req.range) {
    recordCleaningOp('detect_anomalies', 'unknown', 'error');
    return {
      response: handler._mapError(new Error('Missing required fields: spreadsheetId and range')),
    };
  }

  const engine = _cleaningEngine; // ISSUE-047: reuse module-level singleton

  const data = await handler._fetchRangeData(req.spreadsheetId, extractRangeA1(req.range));
  const rangeOffset = parseRangeOffset(extractRangeA1(req.range));

  const result = await engine.detectAnomalies(
    data,
    req.method ?? 'iqr',
    req.threshold,
    req.columns,
    rangeOffset
  );

  // Wire AI insight: explain anomaly causes
  let aiInsight: string | undefined;
  if (result.anomalies.length > 0) {
    const sampleAnomalies = result.anomalies
      .slice(0, 10)
      .map((a) => `${a.cell}: ${a.value} (${a.score?.toFixed(2) ?? '?'})`)
      .join('; ');
    aiInsight = await generateAIInsight(
      handler.context.samplingServer,
      'anomalyExplanation',
      'Explain why these values are anomalies and what might have caused them',
      sampleAnomalies
    );
  }

  // detect_anomalies is always read-only (no apply mode)
  const response = {
    success: true as const,
    mode: 'preview' as const,
    action: 'detect_anomalies',
    operations: [],
    summary: { total: result.anomalies.length },
    message: `Found ${result.summary.anomaliesFound} anomaly(ies) across ${Object.keys(result.summary.byColumn).length} column(s) using ${result.summary.method} method (threshold: ${result.summary.threshold}).`,
    anomalies: result.anomalies,
    anomalySummary: result.summary,
    ...(aiInsight !== undefined ? { aiInsight } : {}),
  };
  recordCleaningOp('detect_anomalies', 'preview', 'success');
  return { response: handler._applyVerbosityFilter(response, verbosity) };
}

export async function handleSuggestCleaningAction(
  handler: FixHandlerAccess,
  req: SuggestCleaningInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  if (!req.spreadsheetId || !req.range) {
    recordCleaningOp('suggest_cleaning', 'preview', 'error');
    return {
      response: handler._mapError(new Error('Missing required fields: spreadsheetId and range')),
    };
  }

  const engine = _cleaningEngine; // ISSUE-047: reuse module-level singleton

  const data = await handler._fetchRangeData(req.spreadsheetId, extractRangeA1(req.range));
  const rangeOffset = parseRangeOffset(extractRangeA1(req.range));

  const result = await engine.suggestCleaning(data, req.maxRecommendations ?? 10, rangeOffset);

  // Wire AI insight: recommend cleaning strategy
  let aiInsight: string | undefined;
  if (result.recommendations.length > 0) {
    const columnsWithNulls = result.dataProfile.columnProfiles.filter((c) => c.nullCount > 0).length;
    const profileSummary = `${result.dataProfile.totalRows} rows, ${result.dataProfile.totalColumns} columns, null rate ${result.dataProfile.nullRate}. Columns with missing values: ${columnsWithNulls}.`;
    aiInsight = await generateAIInsight(
      handler.context.samplingServer,
      'cleaningStrategy',
      'Based on the data profile, recommend the optimal cleaning strategy and rule priority order',
      profileSummary
    );
  }

  // suggest_cleaning is always read-only
  const response = {
    success: true as const,
    mode: 'preview' as const,
    action: 'suggest_cleaning',
    operations: [],
    summary: { total: result.recommendations.length },
    message: `Found ${result.recommendations.length} cleaning recommendation(s) after profiling ${result.dataProfile.totalRows} row(s) across ${result.dataProfile.totalColumns} column(s).`,
    recommendations: result.recommendations,
    dataProfile: result.dataProfile,
    ...(aiInsight !== undefined ? { aiInsight } : {}),
  };

  // Wire session context: cache recommendations as pending operation for quick follow-up
  try {
    if (handler.context.sessionContext && result.recommendations.length > 0) {
      const ruleIds = result.recommendations.map((r) => r.suggestedRule ?? r.id ?? 'unknown');
      handler.context.sessionContext.setPendingOperation({
        type: 'suggest_cleaning',
        step: 1,
        totalSteps: 2,
        context: {
          spreadsheetId: req.spreadsheetId,
          range: extractRangeA1(req.range),
          suggestedRuleIds: ruleIds,
        },
      });
    }
  } catch {
    /* non-blocking */
  }

  recordCleaningOp('suggest_cleaning', 'preview', 'success');
  return { response: handler._applyVerbosityFilter(response, verbosity) };
}
