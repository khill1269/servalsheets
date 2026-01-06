/**
 * Tool: sheets_plan
 * Natural language operation planning with cost estimation and risk analysis.
 */

import { z } from 'zod';
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

const PlanningActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    intent: z.string().min(1).describe('Natural language description of what you want to do'),
    spreadsheetId: z.string().optional().describe('Target spreadsheet ID'),
    context: z.record(z.unknown()).optional().describe('Additional context (history, constraints, etc.)'),
  }),
  z.object({
    action: z.literal('execute'),
    planId: z.string().min(1).describe('Plan ID to execute'),
    dryRun: z.boolean().optional().describe('Preview execution without making changes (default: false)'),
    autoRollback: z.boolean().optional().describe('Rollback on error (default: true)'),
  }),
  z.object({
    action: z.literal('validate'),
    planId: z.string().min(1).describe('Plan ID to validate'),
  }),
]);

export const SheetsPlanningInputSchema = z.object({
  request: PlanningActionSchema,
});

const PlanningResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // create response
    plan: z.object({
      id: z.string(),
      intent: z.string(),
      title: z.string(),
      description: z.string(),
      steps: z.array(z.object({
        stepNumber: z.number(),
        description: z.string(),
        action: z.string(),
        params: z.record(z.unknown()),
        rationale: z.string().optional(),
        expectedOutcome: z.string().optional(),
        risks: z.array(z.object({
          level: z.enum(['low', 'medium', 'high', 'critical']),
          description: z.string(),
          mitigation: z.string().optional(),
        })).optional(),
        estimatedDuration: z.number().optional(),
        optional: z.boolean().optional(),
      })),
      risks: z.array(z.object({
        level: z.enum(['low', 'medium', 'high', 'critical']),
        description: z.string(),
        mitigation: z.string().optional(),
        affectedResources: z.array(z.string()).optional(),
      })),
      cost: z.object({
        apiCalls: z.number(),
        quotaImpact: z.number(),
        cellsAffected: z.number().optional(),
      }),
      estimatedTime: z.number(),
      successCriteria: z.array(z.string()).optional(),
      rollbackStrategy: z.string().optional(),
    }).optional(),
    // execute response
    planId: z.string().optional(),
    planTitle: z.string().optional(),
    stepsCompleted: z.number().optional(),
    stepsFailed: z.number().optional(),
    duration: z.number().optional(),
    rolledBack: z.boolean().optional(),
    outcome: z.string().optional(),
    stepResults: z.array(z.object({
      stepNumber: z.number(),
      description: z.string(),
      success: z.boolean(),
      duration: z.number(),
      result: z.unknown().optional(),
      error: z.string().optional(),
    })).optional(),
    // validate response
    valid: z.boolean().optional(),
    validationMessage: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsPlanningOutputSchema = z.object({
  response: PlanningResponseSchema,
});

export const SHEETS_PLANNING_ANNOTATIONS: ToolAnnotations = {
  title: 'Operation Planning',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export type SheetsPlanningInput = z.infer<typeof SheetsPlanningInputSchema>;
export type SheetsPlanningOutput = z.infer<typeof SheetsPlanningOutputSchema>;
export type PlanningAction = z.infer<typeof PlanningActionSchema>;
export type PlanningResponse = z.infer<typeof PlanningResponseSchema>;
