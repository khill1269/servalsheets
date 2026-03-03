import type { sheets_v4 } from 'googleapis';
import type { AnalyzeResponse } from '../../schemas/analyze.js';
import { DataError } from '../../core/errors.js';
import { logger } from '../../utils/logger.js';
import { createNotFoundError } from '../../utils/error-factory.js';
import { TieredRetrieval } from '../../analysis/tiered-retrieval.js';
import { getCacheAdapter } from '../../utils/cache-adapter.js';
import {
  assertSamplingConsent,
  withSamplingTimeout,
  type SamplingServer,
} from '../../mcp/sampling.js';

type QueryNaturalLanguageRequest = {
  spreadsheetId: string;
  query: string;
  sheetId?: number;
  conversationId?: string;
};

const QUERY_RESULT_CHART_TYPES = [
  'BAR',
  'LINE',
  'AREA',
  'COLUMN',
  'SCATTER',
  'COMBO',
  'STEPPED_AREA',
  'PIE',
  'DOUGHNUT',
  'TREEMAP',
  'WATERFALL',
  'HISTOGRAM',
  'CANDLESTICK',
  'ORG',
  'RADAR',
  'SCORECARD',
  'BUBBLE',
] as const;

type QueryResultChartType = (typeof QUERY_RESULT_CHART_TYPES)[number];
type QueryCellScalar = string | number | boolean | null;
type QueryCellValue = QueryCellScalar | QueryCellScalar[] | Record<string, QueryCellScalar>;
type QueryResultData = {
  headers: string[];
  rows: QueryCellValue[][];
};

function parseQueryResultChartType(value: unknown): QueryResultChartType | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.toUpperCase();
  return (QUERY_RESULT_CHART_TYPES as readonly string[]).includes(normalized)
    ? (normalized as QueryResultChartType)
    : undefined;
}

export interface QueryNaturalLanguageDeps {
  checkSamplingCapability: () => Promise<AnalyzeResponse | null>;
  server: SamplingServer;
  sheetsApi: sheets_v4.Sheets;
}

/**
 * Decomposed action handler for `query_natural_language`.
 * Preserves original behavior while moving logic out of the main AnalyzeHandler class.
 */
export async function handleQueryNaturalLanguageAction(
  input: QueryNaturalLanguageRequest,
  deps: QueryNaturalLanguageDeps
): Promise<AnalyzeResponse> {
  const samplingError = await deps.checkSamplingCapability();
  if (samplingError) {
    return samplingError;
  }

  const startTime = Date.now();

  try {
    const tieredRetrieval = new TieredRetrieval({
      cache: getCacheAdapter('analysis'),
      sheetsApi: deps.sheetsApi,
    });

    const metadata = await tieredRetrieval.getMetadata(input.spreadsheetId);
    const sampleData = await tieredRetrieval.getSample(input.spreadsheetId);

    const targetSheet = input.sheetId
      ? metadata.sheets.find((s) => s.sheetId === input.sheetId)
      : metadata.sheets[0];

    if (!targetSheet) {
      return {
        success: false,
        error: createNotFoundError({
          resourceType: 'sheet',
          resourceId: input.sheetId ? String(input.sheetId) : 'first sheet',
          searchSuggestion: 'Use sheets_core action "list_sheets" to see available sheets',
          parentResourceId: input.spreadsheetId,
        }),
      };
    }

    const { detectQueryIntent, buildNLQuerySamplingRequest, validateQuery } =
      await import('../../analysis/conversational-helpers.js');
    const { inferSchema } = await import('../../analysis/structure-helpers.js');

    const sheetSample = sampleData.sampleData.rows || [];
    const schema = inferSchema(sheetSample, 0);

    const context = {
      spreadsheetId: input.spreadsheetId,
      sheetName: targetSheet.title,
      schema,
      previousQueries: [],
      dataSnapshot: {
        sampleRows: sheetSample,
        rowCount: targetSheet.rowCount,
        columnCount: targetSheet.columnCount,
      },
    };

    const intent = detectQueryIntent(input.query, schema);
    const validation = validateQuery(input.query, context);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.reason || 'Invalid query',
          retryable: false,
        },
      };
    }

    const samplingRequest = buildNLQuerySamplingRequest(input.query, context);

    let samplingResult;
    try {
      await assertSamplingConsent();
      samplingResult = await withSamplingTimeout(deps.server.createMessage(samplingRequest));
    } catch (samplingError) {
      logger.error('MCP Sampling call failed for query_natural_language', {
        component: 'analyze-handler',
        action: 'query_natural_language',
        error: samplingError instanceof Error ? samplingError.message : String(samplingError),
      });
      return {
        success: false,
        error: {
          code: 'FEATURE_UNAVAILABLE',
          message:
            'MCP Sampling capability failed. This feature requires a compatible MCP client with Sampling support (MCP 2025-11-25+).',
          retryable: false,
          suggestedFix:
            'Ensure your MCP client supports the Sampling capability or provide an LLM API key (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY).',
        },
      };
    }

    const contentBlocks = Array.isArray(samplingResult.content)
      ? samplingResult.content
      : [samplingResult.content];
    const textBlock = contentBlocks.find(
      (block): block is { type: 'text'; text: string } =>
        block.type === 'text' && 'text' in block && typeof block.text === 'string'
    );
    const contentText = textBlock?.text ?? '';

    const jsonMatch = contentText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new DataError(
        'No JSON in response - model returned invalid format',
        'DATA_ERROR',
        false
      );
    }
    const parsedUnknown: unknown = JSON.parse(jsonMatch[0]);
    const parsed =
      typeof parsedUnknown === 'object' && parsedUnknown !== null
        ? (parsedUnknown as Record<string, unknown>)
        : {};
    const duration = Date.now() - startTime;
    const answer = typeof parsed['answer'] === 'string' ? parsed['answer'] : 'No answer provided';

    const parsedData = (() => {
      const candidate = parsed['data'];
      if (typeof candidate !== 'object' || candidate === null) {
        return undefined;
      }
      const record = candidate as Record<string, unknown>;
      if (!Array.isArray(record['headers']) || !Array.isArray(record['rows'])) {
        return undefined;
      }
      if (!record['headers'].every((value) => typeof value === 'string')) {
        return undefined;
      }
      if (!record['rows'].every((row) => Array.isArray(row))) {
        return undefined;
      }

      return {
        headers: record['headers'] as QueryResultData['headers'],
        rows: record['rows'] as QueryResultData['rows'],
      };
    })();

    const parsedVisualization = (() => {
      const candidate = parsed['visualizationSuggestion'];
      if (typeof candidate !== 'object' || candidate === null) {
        return undefined;
      }
      const record = candidate as Record<string, unknown>;
      const chartType = parseQueryResultChartType(record['chartType']);
      if (!chartType || typeof record['reasoning'] !== 'string') {
        return undefined;
      }

      return {
        chartType,
        reasoning: record['reasoning'],
      };
    })();

    const followUpQuestions = Array.isArray(parsed['followUpQuestions'])
      ? parsed['followUpQuestions'].filter((q): q is string => typeof q === 'string')
      : [];

    return {
      success: true,
      action: 'query_natural_language',
      queryResult: {
        query: input.query,
        answer,
        intent: {
          type: intent.type,
          confidence: intent.confidence,
        },
        data: parsedData,
        visualizationSuggestion: parsedVisualization,
        followUpQuestions,
      },
      duration,
      message: `Query processed: ${intent.type} (${intent.confidence}% confidence)`,
    };
  } catch (error) {
    logger.error('Failed to process natural language query', {
      component: 'analyze-handler',
      action: 'query_natural_language',
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process natural language query',
        retryable: true,
      },
    };
  }
}
