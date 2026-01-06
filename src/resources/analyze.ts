/**
 * ServalSheets - Analyze Resources
 *
 * Exposes AI analysis capabilities as MCP resources for discovery and reference.
 * Uses MCP Sampling (SEP-1577) for AI-powered analysis.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSamplingAnalysisService } from '../services/sampling-analysis.js';

/**
 * Register analyze resources with the MCP server
 */
export function registerAnalyzeResources(server: McpServer): number {
  const analysisService = getSamplingAnalysisService();

  // Resource 1: analyze://stats - Analysis service statistics
  server.registerResource(
    'AI Analysis Statistics',
    'analyze://stats',
    {
      description: 'AI analysis service statistics: requests, success rate, response times',
      mimeType: 'application/json',
    },
    async (uri) => {
      try {
        const stats = analysisService.getStats();

        return {
          contents: [{
            uri: typeof uri === 'string' ? uri : uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({
              stats: {
                totalRequests: stats.totalRequests,
                successfulRequests: stats.successfulRequests,
                failedRequests: stats.failedRequests,
                successRate: `${stats.successRate.toFixed(1)}%`,
                avgResponseTime: `${(stats.avgResponseTime / 1000).toFixed(2)}s`,
                requestsByType: stats.requestsByType,
              },
              summary: `${stats.successfulRequests}/${stats.totalRequests} analysis requests successful (${stats.successRate.toFixed(1)}% success rate)`,
            }, null, 2),
          }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          contents: [{
            uri: typeof uri === 'string' ? uri : uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Failed to fetch analysis statistics',
              message: errorMessage,
            }, null, 2),
          }],
        };
      }
    }
  );

  // Resource 2: analyze://help - Analysis capabilities documentation
  server.registerResource(
    'AI Analysis Help',
    'analyze://help',
    {
      description: 'Documentation for AI-powered data analysis using MCP Sampling',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      try {
        const helpText = `# AI Data Analysis (MCP Sampling)

## Overview
ServalSheets uses MCP Sampling (SEP-1577) for AI-powered data analysis. Instead of 
implementing custom ML/statistics, we leverage Claude's intelligence for analysis.

## How It Works
1. Claude (the LLM) orchestrates the analysis
2. The \`sheets_analyze\` tool reads your data
3. Data is sent to the LLM via MCP Sampling
4. You get intelligent, contextual analysis

## Analysis Types

### summary
Overall data summary including key statistics, data types, and notable observations.

### patterns
Identify recurring patterns, sequences, and regularities in the data.

### anomalies
Find outliers, unexpected values, missing data, and inconsistencies.

### trends
Analyze trends over time or across categories, including growth/decline patterns.

### quality
Assess data quality: completeness, consistency, accuracy, and format issues.

### correlations
Discover relationships and correlations between different columns/fields.

### recommendations
Get actionable recommendations for improving, organizing, or utilizing your data.

## Usage Examples

### Basic Analysis
\`\`\`
sheets_analyze({
  action: 'analyze',
  spreadsheetId: 'your-id',
  range: { a1: 'Sheet1!A1:Z100' },
  analysisTypes: ['summary', 'quality']
})
\`\`\`

### Find Anomalies
\`\`\`
sheets_analyze({
  action: 'analyze',
  spreadsheetId: 'your-id',
  range: { sheetName: 'Sales', range: 'A:F' },
  analysisTypes: ['anomalies', 'patterns'],
  context: 'This is monthly sales data'
})
\`\`\`

### Generate Formula
\`\`\`
sheets_analyze({
  action: 'generate_formula',
  spreadsheetId: 'your-id',
  description: 'Sum all values in column B where column A equals "Active"',
  targetCell: 'D1'
})
\`\`\`

### Chart Recommendations
\`\`\`
sheets_analyze({
  action: 'suggest_chart',
  spreadsheetId: 'your-id',
  range: { a1: 'Data!A1:D50' },
  goal: 'Show monthly trends'
})
\`\`\`

## Response Format

Analysis responses include:
- **summary**: Brief overall summary
- **analyses**: Array of findings with type, confidence, and details
- **overallQualityScore**: 0-100 quality score
- **topInsights**: Most important findings
- **recommendations**: Actionable suggestions

## Requirements
- Client must support MCP Sampling (SEP-1577)
- Data is sampled (max 100 rows × 20 cols) to fit token limits

## Why Sampling Instead of Custom ML?

1. **Better Understanding**: Claude understands context, not just numbers
2. **Flexible**: No need to pre-define analysis rules
3. **Actionable**: Recommendations in plain language
4. **Maintained**: No ML models to train/update
5. **MCP-Native**: Uses standard protocol features

## Statistics
View analysis statistics at: analyze://stats
`;

        return {
          contents: [{
            uri: typeof uri === 'string' ? uri : uri.toString(),
            mimeType: 'text/markdown',
            text: helpText,
          }],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          contents: [{
            uri: typeof uri === 'string' ? uri : uri.toString(),
            mimeType: 'text/plain',
            text: `Error fetching analysis help: ${errorMessage}`,
          }],
        };
      }
    }
  );

  console.error('[ServalSheets] Registered 2 analyze resources:');
  console.error('  - analyze://stats (analysis service statistics)');
  console.error('  - analyze://help (AI analysis documentation)');

  return 2;
}
