import type { ResourceContents } from '@modelcontextprotocol/sdk/types';
import { randomUUID } from 'crypto';

// ============================================================================
// Analysis Result Storage
// ============================================================================
// Stores analysis results in memory so they can be retrieved as MCP resources
// via analyze://results/{id}. Results are evicted after MAX_RESULTS to bound
// memory usage.

const MAX_RESULTS = 100;
const analysisResults = new Map<string, { spreadsheetId: string; result: unknown; createdAt: Date }>();

/**
 * Store an analysis result and return an ID for resource retrieval.
 * Used when analysis responses exceed inline size limits — the response
 * includes a resource URI instead of the full payload.
 */
export function storeAnalysisResult(spreadsheetId: string, result: unknown): string {
  const id = randomUUID();
  // Evict oldest if at capacity
  if (analysisResults.size >= MAX_RESULTS) {
    const oldestKey = analysisResults.keys().next().value;
    if (oldestKey) analysisResults.delete(oldestKey);
  }
  analysisResults.set(id, { spreadsheetId, result, createdAt: new Date() });
  return id;
}

/**
 * Retrieve a stored analysis result by ID.
 */
export function getAnalysisResult(id: string): { spreadsheetId: string; result: unknown } | undefined {
  const entry = analysisResults.get(id);
  if (!entry) return undefined;
  return { spreadsheetId: entry.spreadsheetId, result: entry.result };
}

export function getAnalyzeResources(): { uri: string; contents: ResourceContents }[] {
  return [
    {
      uri: 'analyze://stats',
      contents: {
        mimeType: 'text/plain',
        text: `Analysis Statistics

The analyze tool provides comprehensive spreadsheet analysis including:

- Data profiling: type detection, null rates, cardinality
- Quality scoring: data quality percentages, anomaly detection
- Pattern recognition: trends, seasonality, outliers
- Structure analysis: headers, tables, named ranges
- Formula analysis: dependency tracking, error detection
- Performance analysis: slow formulas, unused calculations

Key metrics tracked:
- Total analysis calls
- Average analysis duration
- Cache hit rate for repeated analyses
- Error rates by analysis type
- Memory usage for large datasets

Note: Analyses are cached for 5 minutes per range.`,
      },
    },
    {
      uri: 'analyze://help',
      contents: {
        mimeType: 'text/plain',
        text: `Analysis Action Guide

quick_insights
- Fast preliminary scan (~200ms)
- Returns high-level patterns
- No AI processing

comprehensive
- Full 43-feature analysis
- Includes AI-powered insights
- Best for understanding complex sheets

scout
- Column type detection
- Empty rate analysis
- Pattern identification

analyze_quality
- Data quality scoring
- Issue detection (blanks, inconsistencies, outliers)
- Severity ranking

analyze_performance
- Formula efficiency analysis
- Slow formula detection
- Optimization suggestions`,
      },
    },
  ];
}
