/**
 * Tool: sheets_workflow
 * Smart workflow detection and execution for common multi-step operations.
 */

import { z } from 'zod';
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

const WorkflowActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('detect'),
    triggerAction: z.string().min(1).describe('Action that triggered workflow detection (e.g., "sheets_values:write")'),
    params: z.record(z.unknown()).describe('Parameters of the triggering action'),
    context: z.record(z.unknown()).optional().describe('Additional context for detection'),
  }),
  z.object({
    action: z.literal('execute'),
    workflowId: z.string().min(1).describe('Workflow ID to execute'),
    params: z.record(z.unknown()).describe('Initial parameters for workflow execution'),
    dryRun: z.boolean().optional().describe('Preview execution without making changes (default: false)'),
    stopOnError: z.boolean().optional().describe('Stop execution on first error (default: true)'),
  }),
  z.object({
    action: z.literal('list'),
    category: z.string().optional().describe('Filter by workflow category'),
  }),
  z.object({
    action: z.literal('get'),
    workflowId: z.string().min(1).describe('Workflow ID to retrieve'),
  }),
]);

export const SheetsWorkflowInputSchema = z.object({
  request: WorkflowActionSchema,
});

const WorkflowResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // detect response
    suggestions: z.array(z.object({
      workflowId: z.string(),
      workflowName: z.string(),
      description: z.string(),
      confidence: z.number(),
      reason: z.string(),
      preview: z.array(z.string()),
      estimatedDuration: z.number().optional(),
      toolCallsSaved: z.number().optional(),
    })).optional().describe('Workflow suggestions from detection'),
    // execute response
    workflowId: z.string().optional().describe('Executed workflow ID'),
    workflowName: z.string().optional().describe('Executed workflow name'),
    stepsCompleted: z.number().optional().describe('Number of steps completed'),
    stepsFailed: z.number().optional().describe('Number of steps failed'),
    stepsSkipped: z.number().optional().describe('Number of steps skipped'),
    duration: z.number().optional().describe('Execution duration in ms'),
    stepResults: z.array(z.object({
      stepIndex: z.number(),
      description: z.string(),
      action: z.string(),
      success: z.boolean(),
      duration: z.number(),
      skipped: z.boolean().optional(),
      result: z.unknown().optional(),
      error: z.string().optional(),
    })).optional().describe('Detailed step results'),
    // list response
    workflows: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      stepCount: z.number(),
      estimatedDuration: z.number().optional(),
      tags: z.array(z.string()).optional(),
    })).optional().describe('List of workflows'),
    // get response
    workflow: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      stepCount: z.number(),
      estimatedDuration: z.number().optional(),
      tags: z.array(z.string()).optional(),
      steps: z.array(z.object({
        description: z.string(),
        action: z.string(),
        optional: z.boolean().optional(),
      })),
    }).optional().describe('Workflow details'),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsWorkflowOutputSchema = z.object({
  response: WorkflowResponseSchema,
});

export const SHEETS_WORKFLOW_ANNOTATIONS: ToolAnnotations = {
  title: 'Smart Workflows',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export type SheetsWorkflowInput = z.infer<typeof SheetsWorkflowInputSchema>;
export type SheetsWorkflowOutput = z.infer<typeof SheetsWorkflowOutputSchema>;
export type WorkflowAction = z.infer<typeof WorkflowActionSchema>;
export type WorkflowResponse = z.infer<typeof WorkflowResponseSchema>;
