/**
 * Tool: sheets_confirm
 *
 * Uses MCP Elicitation (SEP-1036) for user confirmation before executing
 * multi-step operations. This is the correct MCP pattern:
 * - Claude plans the operations
 * - This tool presents the plan for user confirmation
 * - User approves/modifies/rejects via Elicitation
 *
 * @see MCP_PROTOCOL_COMPLETE_REFERENCE.md - Elicitation section
 */

import { z } from 'zod';
import {
  ErrorDetailSchema,
  ResponseMetaSchema,
  type ToolAnnotations,
} from './shared.js';

/**
 * Risk level schema
 */
const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Plan step schema
 */
const PlanStepSchema = z.object({
  stepNumber: z.number().int().positive().describe('Step number (1-based)'),
  description: z.string().describe('Human-readable description'),
  tool: z.string().describe('Tool to be called'),
  action: z.string().describe('Action within the tool'),
  risk: RiskLevelSchema.describe('Risk level of this step'),
  estimatedApiCalls: z.number().int().positive().optional().describe('Estimated API calls'),
  isDestructive: z.boolean().optional().describe('Whether this step modifies/deletes data'),
  canUndo: z.boolean().optional().describe('Whether this step can be undone'),
});

/**
 * Operation plan schema for confirmation
 */
const OperationPlanSchema = z.object({
  title: z.string().min(1).describe('Plan title'),
  description: z.string().describe('Detailed description of what the plan does'),
  steps: z.array(PlanStepSchema).min(1).describe('Steps in the plan'),
  willCreateSnapshot: z.boolean().default(true).describe('Whether to create a snapshot before execution'),
  additionalWarnings: z.array(z.string()).optional().describe('Additional warnings to display'),
});

/**
 * Input schema - discriminated union for actions
 */
const ConfirmActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('request'),
    plan: OperationPlanSchema.describe('The plan to confirm with the user'),
  }),
  z.object({
    action: z.literal('get_stats'),
  }),
]);

export const SheetsConfirmInputSchema = z.object({
  request: ConfirmActionSchema,
});

/**
 * Confirmation result schema
 */
const ConfirmationResultSchema = z.object({
  approved: z.boolean().describe('Whether the user approved the plan'),
  action: z.enum(['accept', 'decline', 'cancel']).describe('User action'),
  modifications: z.string().optional().describe('User modifications to the plan'),
  timestamp: z.number().describe('Timestamp of confirmation'),
});

/**
 * Stats schema
 */
const ConfirmStatsSchema = z.object({
  totalConfirmations: z.number(),
  approved: z.number(),
  declined: z.number(),
  cancelled: z.number(),
  approvalRate: z.number(),
  avgResponseTime: z.number(),
});

/**
 * Response schema
 */
const ConfirmResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // For request action
    planId: z.string().optional(),
    confirmation: ConfirmationResultSchema.optional(),
    // For get_stats action
    stats: ConfirmStatsSchema.optional(),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsConfirmOutputSchema = z.object({
  response: ConfirmResponseSchema,
});

/**
 * Tool annotations following MCP 2025-11-25
 */
export const SHEETS_CONFIRM_ANNOTATIONS: ToolAnnotations = {
  title: 'Plan Confirmation',
  readOnlyHint: true,           // Confirmation itself doesn't change data
  destructiveHint: false,       // The tool just confirms, doesn't execute
  idempotentHint: false,        // Each confirmation is unique
  openWorldHint: true,          // Interacts with user via Elicitation
};

// Type exports
export type SheetsConfirmInput = z.infer<typeof SheetsConfirmInputSchema>;
export type SheetsConfirmOutput = z.infer<typeof SheetsConfirmOutputSchema>;
export type ConfirmAction = z.infer<typeof ConfirmActionSchema>;
export type ConfirmResponse = z.infer<typeof ConfirmResponseSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type OperationPlan = z.infer<typeof OperationPlanSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
