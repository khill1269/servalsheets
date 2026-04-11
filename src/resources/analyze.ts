import { TextResourceContents } from '@modelcontextprotocol/sdk/types.js';

export function getAnalyzeResources(): { uri: string; contents: TextResourceContents }[] {
  return [
    {
      uri: 'analyze://stats',
      contents: {
        uri: 'analyze://stats',
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
        uri: 'analyze://help',
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

/** Register analyze resources on an MCP server */
export function registerAnalyzeResources(_server: unknown): number {
  return getAnalyzeResources().length;
}

/** Store analysis result (stub for compatibility) */
export function storeAnalysisResult(_spreadsheetId: string, _result: unknown): void {
  // No-op: results are stored in memory by the analysis service
}
