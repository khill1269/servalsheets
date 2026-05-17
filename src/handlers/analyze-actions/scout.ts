import { ErrorCodes } from '../error-codes.js';
import type { sheets_v4 } from 'googleapis';
import { ConfidenceScorer } from '../../analysis/confidence-scorer.js';
import { ElicitationEngine } from '../../analysis/elicitation-engine.js';
import { Scout, type ScoutResult } from '../../analysis/scout.js';
import { generateAIInsight, type SamplingServer } from '../../mcp/sampling.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';
import type { AnalyzeResponse } from '../../schemas/analyze.js';
import { getSessionContext, type SessionContextManager } from '../../services/session-context.js';
import { getCacheAdapter } from '../../utils/cache-adapter.js';
import { logger } from '../../utils/logger.js';

type ScoutRequest = {
  spreadsheetId: string;
  includeColumnTypes?: boolean;
  includeQuickIndicators?: boolean;
  detectIntent?: boolean;
};

export interface ScoutDeps {
  sheetsApi: sheets_v4.Sheets;
  samplingServer?: SamplingServer;
  context?: {
    sessionContext?: Pick<SessionContextManager, 'recordOperation' | 'understandingStore'>;
    elicitationServer?: ElicitationServer;
  };
}

/**
 * Decomposed action handler for `scout`.
 * Preserves original behavior while moving logic out of the main AnalyzeHandler class.
 */
export async function handleScoutAction(
  input: ScoutRequest,
  deps: ScoutDeps
): Promise<AnalyzeResponse> {
  logger.info('Scout action - quick metadata scan', { spreadsheetId: input.spreadsheetId });

  try {
    const cache = getCacheAdapter('analysis');
    const scoutInstance = new Scout({
      cache,
      sheetsApi: deps.sheetsApi,
      includeColumnTypes: input.includeColumnTypes ?? true,
      includeQuickIndicators: input.includeQuickIndicators ?? true,
      detectIntent: input.detectIntent ?? true,
    });
    const scoutResult: ScoutResult = await scoutInstance.scout(input.spreadsheetId);

    // AUDIT-2026-04-23 (artifact bug #15): fetch per-sheet flag data
    // in one additional spreadsheets.get with a tight field mask. Prior
    // code copied workbook-wide indicators (hasFormulas/hasCharts/hasProtection)
    // onto every sheet, producing false positives like "hasCharts: true"
    // on empty sheets and "hasFormulas: false" on sheets full of formulas.
    // We read only the fields we need so this stays a single cheap call.
    type PerSheetFlags = {
      hasFormulas: boolean;
      hasCharts: boolean;
      hasProtectedRanges: boolean;
      hasBasicFilter: boolean;
      hasFilterViews: boolean;
    };
    const perSheetFlagsById = new Map<number, PerSheetFlags>();
    try {
      const probe = await deps.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields:
          'sheets(properties(sheetId),charts(chartId),protectedRanges(protectedRangeId),basicFilter,filterViews,data(rowData(values(userEnteredValue(formulaValue)))))',
        includeGridData: true,
        // Limit grid data to first 5 rows per sheet — enough to detect formula presence
        // without fetching entire sheets. Combined with the narrow fields mask above,
        // this keeps the payload small even on large workbooks.
        ranges: ['1:5'],
      });
      for (const s of probe.data.sheets ?? []) {
        const sheetId = s.properties?.sheetId;
        if (sheetId === undefined || sheetId === null) continue;
        const hasCharts = Array.isArray(s.charts) && s.charts.length > 0;
        const hasProtectedRanges =
          Array.isArray(s.protectedRanges) && s.protectedRanges.length > 0;
        const hasBasicFilter = Boolean(s.basicFilter);
        const hasFilterViews = Array.isArray(s.filterViews) && s.filterViews.length > 0;
        // Formula probe: scan the narrow grid data we fetched for any formulaValue.
        let hasFormulas = false;
        for (const d of s.data ?? []) {
          for (const row of d.rowData ?? []) {
            for (const cell of row.values ?? []) {
              if (cell?.userEnteredValue?.formulaValue) {
                hasFormulas = true;
                break;
              }
            }
            if (hasFormulas) break;
          }
          if (hasFormulas) break;
        }
        perSheetFlagsById.set(sheetId, {
          hasFormulas,
          hasCharts,
          hasProtectedRanges,
          hasBasicFilter,
          hasFilterViews,
        });
      }
    } catch (err) {
      // Best effort — if the per-sheet probe fails, fall back to the
      // workbook-wide signal so we don't regress below prior behavior.
      logger.warn('Scout per-sheet flag probe failed; falling back to workbook-wide indicators', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const scoutSummary = {
      sizeCategory: scoutResult.indicators.sizeCategory,
      sheetCount: scoutResult.sheets.length,
      hasFormulas: scoutResult.indicators.hasFormulas,
      hasVisualizations: scoutResult.indicators.hasVisualizations,
      recommendations: scoutResult.recommendations.slice(0, 3),
      detectedIntent: scoutResult.detectedIntent,
    };
    const aiInsightScout = await generateAIInsight(
      deps.samplingServer,
      'dataAnalysis',
      'Summarize the key findings from this quick scan and highlight anything that needs attention',
      scoutSummary
    );

    const response: AnalyzeResponse = {
      success: true,
      action: 'scout',
      scout: {
        spreadsheet: {
          id: scoutResult.spreadsheetId,
          title: scoutResult.title,
        },
        sheets: scoutResult.sheets.map((sheet) => {
          // AUDIT-2026-04-23 (artifact bug #15): prefer per-sheet probe
          // result; fall back to workbook-wide indicators only when the
          // probe failed for this specific sheetId.
          const probed = perSheetFlagsById.get(sheet.sheetId);
          return {
            sheetId: sheet.sheetId,
            title: sheet.title,
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount,
            estimatedCells: sheet.estimatedCells,
            columns: [],
            flags: {
              hasHeaders: sheet.rowCount > 0,
              hasFormulas: probed ? probed.hasFormulas : scoutResult.indicators.hasFormulas,
              hasCharts: probed ? probed.hasCharts : scoutResult.indicators.hasVisualizations,
              hasPivots: false,
              hasFilters: probed ? probed.hasBasicFilter || probed.hasFilterViews : false,
              hasProtection: probed
                ? probed.hasProtectedRanges
                : scoutResult.indicators.hasProtection,
              isEmpty: sheet.rowCount <= 1,
              isLarge: sheet.estimatedCells > 100000,
            },
          };
        }),
        totals: {
          sheets: scoutResult.sheets.length,
          rows: scoutResult.sheets.reduce((sum, s) => sum + s.rowCount, 0),
          columns: scoutResult.sheets.reduce((sum, s) => sum + s.columnCount, 0),
          estimatedCells: scoutResult.indicators.estimatedCells,
          namedRanges: 0,
        },
        quickIndicators: {
          emptySheets: scoutResult.sheets.filter((s) => s.rowCount <= 1).length,
          largeSheets: scoutResult.sheets.filter((s) => s.estimatedCells > 100000).length,
          potentialIssues: scoutResult.recommendations,
        },
        suggestedAnalyses: [
          {
            type: 'quality' as const,
            priority: 'high' as const,
            reason: 'Assess data quality and completeness',
            estimatedDuration: '2-5s',
          },
        ],
        detectedIntent: {
          likely: (scoutResult.detectedIntent === 'quick' || scoutResult.detectedIntent === 'auto'
            ? 'understand'
            : scoutResult.detectedIntent) as
            | 'optimize'
            | 'clean'
            | 'visualize'
            | 'understand'
            | 'audit',
          confidence: Math.round(scoutResult.intentConfidence * 100),
          signals: [scoutResult.intentReason],
        },
      },
      duration: scoutResult.latencyMs,
      aiInsight: aiInsightScout,
      message: `Scout complete: ${scoutResult.indicators.sizeCategory} spreadsheet with ${scoutResult.sheets.length} sheet(s). Detected intent: ${scoutResult.detectedIntent}`,
    };

    // Intelligence cluster: confidence scoring + elicitation (non-critical)
    try {
      const scorer = new ConfidenceScorer();
      const store =
        deps.context?.sessionContext?.understandingStore ?? getSessionContext().understandingStore;
      const engine = new ElicitationEngine();

      const assessment = scorer.scoreFromScout(scoutResult);
      store.initFromScout(
        scoutResult.spreadsheetId,
        scoutResult.title,
        scoutResult.sheets.map((s) => ({ sheetId: s.sheetId, title: s.title })),
        assessment
      );

      (response as Record<string, unknown>)['confidence'] = {
        overallScore: assessment.overallScore,
        level: assessment.overallLevel,
        dimensions: assessment.dimensions.map((d) => ({
          dimension: d.dimension,
          score: d.score,
          level: d.level,
          gaps: d.gaps,
        })),
        gaps: assessment.topGaps.map((g) => g.gap),
      };

      const elicitation = engine.generate(assessment);
      if (elicitation.shouldElicit) {
        (response as Record<string, unknown>)['elicitation'] = {
          shouldElicit: true,
          questions: elicitation.questions.slice(0, elicitation.recommendedBatchSize).map((q) => ({
            id: q.id,
            question: q.question,
            reason: q.reason,
            type: q.type,
            options: q.options,
            priority: q.priority,
          })),
          projectedBoost: elicitation.projectedConfidenceAfterElicitation - assessment.overallScore,
        };

        // Wire elicitation questions through MCP protocol if client supports it
        const elicitSrv = deps.context?.elicitationServer;
        if (elicitSrv) {
          const caps = elicitSrv.getClientCapabilities();
          if (caps?.elicitation) {
            try {
              const topQ = elicitation.questions[0];
              if (topQ) {
                const elicitResult = await elicitSrv.elicitInput({
                  message: topQ.question,
                  requestedSchema: {
                    type: 'object',
                    properties: {
                      answer: {
                        type: 'string',
                        title: topQ.reason,
                        ...(topQ.options && topQ.options.length > 0 ? { enum: topQ.options } : {}),
                      },
                    },
                    required: ['answer'],
                  },
                });
                if (elicitResult.action === 'accept' && elicitResult.content?.['answer']) {
                  store.integrateUserAnswers(scoutResult.spreadsheetId, assessment, {
                    freeformContext: String(elicitResult.content['answer']),
                  });
                }
              }
            } catch (elicitErr) {
              logger.warn('Scout MCP elicitation failed (non-critical)', {
                spreadsheetId: input.spreadsheetId,
                error: elicitErr instanceof Error ? elicitErr.message : String(elicitErr),
              });
            }
          }
        }
      }
    } catch (intelligenceErr) {
      logger.warn('Intelligence cluster scoring failed (non-critical)', {
        spreadsheetId: input.spreadsheetId,
        error: intelligenceErr instanceof Error ? intelligenceErr.message : String(intelligenceErr),
      });
    }

    // Record operation in session context for LLM follow-up references
    try {
      if (deps.context?.sessionContext) {
        deps.context.sessionContext.recordOperation({
          tool: 'sheets_analyze',
          action: 'scout',
          spreadsheetId: input.spreadsheetId,
          description: `Scout scan completed for spreadsheet`,
          undoable: false,
        });
      }
    } catch {
      // Non-blocking: session context recording is best-effort
    }

    return response;
  } catch (error) {
    logger.error('Scout failed', {
      spreadsheetId: input.spreadsheetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message:
          'Scout analysis failed. The AI analysis service may be temporarily unavailable. Please try again.',
        retryable: true,
      },
    };
  }
}
