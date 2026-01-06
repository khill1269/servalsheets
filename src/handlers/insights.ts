/**
 * ServalSheets - Insights Handler
 *
 * Handles AI-powered data insights generation.
 */

import { getInsightsService } from '../services/insights-service.js';
import type {
  SheetsInsightsInput,
  SheetsInsightsOutput,
  InsightResponse,
} from '../schemas/insights.js';

export interface InsightsHandlerOptions {
  // Options can be added as needed
}

export class InsightsHandler {
  constructor(_options: InsightsHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(input: SheetsInsightsInput): Promise<SheetsInsightsOutput> {
    const { request } = input;
    const insightsService = getInsightsService();

    try {
      let response: InsightResponse;

      switch (request.action) {
        case 'analyze': {
          const result = await insightsService.generateInsights({
            spreadsheetId: request.spreadsheetId,
            sheetName: request.sheetName,
            range: request.range,
            insightTypes: request.insightTypes,
            minConfidence: request.minConfidence,
            maxInsights: request.maxInsights,
            includeRecommendations: request.includeRecommendations,
          });

          response = {
            success: true,
            action: 'analyze',
            insights: result.insights.map((insight) => ({
              id: insight.id,
              type: insight.type,
              severity: insight.severity,
              confidence: insight.confidence,
              title: insight.title,
              description: insight.description,
              spreadsheetId: insight.spreadsheetId,
              sheetName: insight.sheetName,
              range: insight.range,
              affectedCells: insight.affectedCells,
              recommendations: insight.recommendations,
              evidence: insight.evidence,
              tags: insight.tags,
            })),
            insightCount: result.insights.length,
            insightsByType: result.insightsByType,
            insightsBySeverity: result.insightsBySeverity,
            avgConfidence: result.insights.length > 0
              ? result.insights.reduce((sum, i) => sum + i.confidence, 0) / result.insights.length
              : 0,
            duration: result.duration,
            message: `Generated ${result.insights.length} insight(s) from data analysis`,
          };
          break;
        }
      }

      return { response };
    } catch (error) {
      // Catch-all for unexpected errors
      return {
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }
}
