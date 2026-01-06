/**
 * Tool: sheets_insights
 * AI-powered data insights including anomaly detection, relationship discovery, and predictions.
 */

import { z } from 'zod';
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

const InsightActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('analyze'),
    spreadsheetId: z.string().min(1).describe('Spreadsheet ID to analyze'),
    sheetName: z.string().optional().describe('Sheet name to analyze (analyzes all sheets if omitted)'),
    range: z.string().optional().describe('Range to analyze (A1 notation, analyzes whole sheet if omitted)'),
    insightTypes: z.array(z.enum(['anomaly', 'relationship', 'prediction', 'pattern', 'quality', 'optimization']))
      .optional().describe('Types of insights to generate (all types if omitted)'),
    minConfidence: z.number().min(0).max(1).optional().describe('Minimum confidence threshold (0.0-1.0, default: 0.6)'),
    maxInsights: z.number().int().positive().optional().describe('Maximum insights to return (default: 50)'),
    includeRecommendations: z.boolean().optional().describe('Include actionable recommendations (default: true)'),
  }),
]);

export const SheetsInsightsInputSchema = z.object({
  request: InsightActionSchema,
});

const InsightResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    insights: z.array(z.object({
      id: z.string(),
      type: z.enum(['anomaly', 'relationship', 'prediction', 'pattern', 'quality', 'optimization']),
      severity: z.enum(['info', 'low', 'medium', 'high', 'critical']),
      confidence: z.number(),
      title: z.string(),
      description: z.string(),
      spreadsheetId: z.string().optional(),
      sheetName: z.string().optional(),
      range: z.string().optional(),
      affectedCells: z.array(z.string()).optional(),
      recommendations: z.array(z.object({
        action: z.string(),
        impact: z.string(),
        effort: z.enum(['low', 'medium', 'high']),
        priority: z.enum(['low', 'medium', 'high']),
        operation: z.string().optional(),
        params: z.record(z.unknown()).optional(),
      })).optional(),
      evidence: z.array(z.object({
        type: z.enum(['statistical', 'visual', 'pattern', 'comparison', 'historical']),
        description: z.string(),
        data: z.unknown().optional(),
        metrics: z.record(z.number()).optional(),
      })).optional(),
      tags: z.array(z.string()).optional(),
    })),
    insightCount: z.number(),
    insightsByType: z.record(z.number()).optional(),
    insightsBySeverity: z.record(z.number()).optional(),
    avgConfidence: z.number().optional(),
    duration: z.number(),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsInsightsOutputSchema = z.object({
  response: InsightResponseSchema,
});

export const SHEETS_INSIGHTS_ANNOTATIONS: ToolAnnotations = {
  title: 'AI Insights',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export type SheetsInsightsInput = z.infer<typeof SheetsInsightsInputSchema>;
export type SheetsInsightsOutput = z.infer<typeof SheetsInsightsOutputSchema>;
export type InsightAction = z.infer<typeof InsightActionSchema>;
export type InsightResponse = z.infer<typeof InsightResponseSchema>;
