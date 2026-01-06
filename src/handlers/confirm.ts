/**
 * ServalSheets - Confirmation Handler
 *
 * Uses MCP Elicitation (SEP-1036) for user confirmation before executing
 * multi-step operations. This follows the correct MCP pattern:
 * - Claude does the planning (it's an LLM)
 * - This handler presents plans for user confirmation via Elicitation
 * - User approves/modifies/rejects
 * - Claude then executes the approved plan
 *
 * @see MCP_PROTOCOL_COMPLETE_REFERENCE.md - Elicitation section
 */

import {
  getConfirmationService,
  type OperationPlan as ServicePlan,
  type PlanStep as ServiceStep,
} from '../services/confirm-service.js';
import type {
  SheetsConfirmInput,
  SheetsConfirmOutput,
  ConfirmResponse,
  PlanStep,
  OperationPlan,
} from '../schemas/confirm.js';

/**
 * MCP Extra context with elicitation capability
 */
interface McpExtra {
  elicit?: (request: {
    mode: 'form';
    message: string;
    requestedSchema: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  }) => Promise<{
    action: 'accept' | 'decline' | 'cancel';
    content?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

export interface ConfirmHandlerOptions {
  // Options can be added as needed
}

/**
 * Confirmation Handler
 *
 * Handles user confirmation via MCP Elicitation before multi-step operations.
 */
export class ConfirmHandler {
  constructor(_options: ConfirmHandlerOptions = {}) {
    // Constructor logic if needed
  }

  /**
   * Convert schema plan step to service plan step
   */
  private toServiceStep(step: PlanStep): ServiceStep {
    return {
      stepNumber: step.stepNumber,
      description: step.description,
      tool: step.tool,
      action: step.action,
      risk: step.risk,
      estimatedApiCalls: step.estimatedApiCalls,
      isDestructive: step.isDestructive,
      canUndo: step.canUndo,
    };
  }

  /**
   * Handle confirmation requests
   */
  async handle(input: SheetsConfirmInput, extra?: McpExtra): Promise<SheetsConfirmOutput> {
    const { request } = input;
    const confirmService = getConfirmationService();

    try {
      let response: ConfirmResponse;

      switch (request.action) {
        case 'request': {
          // Check if elicitation is available
          if (!extra?.elicit) {
            response = {
              success: false,
              error: {
                code: 'ELICITATION_UNAVAILABLE',
                message: 'MCP Elicitation capability not available. The client must support elicitation (SEP-1036).',
                retryable: false,
              },
            };
            break;
          }

          // Convert input plan to service plan
          const plan: ServicePlan = confirmService.createPlan(
            request.plan.title,
            request.plan.description,
            request.plan.steps.map(this.toServiceStep),
            {
              willCreateSnapshot: request.plan.willCreateSnapshot,
              additionalWarnings: request.plan.additionalWarnings,
            }
          );

          // Build elicitation request
          const elicitRequest = confirmService.buildElicitationRequest(plan);

          // Request user confirmation via MCP Elicitation
          const startTime = Date.now();
          const elicitResult = await extra.elicit(elicitRequest);

          // Process result
          const confirmation = confirmService.processElicitationResult(
            elicitResult,
            startTime
          );

          response = {
            success: true,
            action: 'request',
            planId: plan.id,
            confirmation: {
              approved: confirmation.approved,
              action: confirmation.action,
              modifications: confirmation.modifications,
              timestamp: confirmation.timestamp,
            },
            message: confirmation.approved
              ? `Plan "${plan.title}" approved by user. Ready for execution.`
              : `Plan "${plan.title}" ${confirmation.action === 'decline' ? 'declined' : 'cancelled'} by user.`,
          };
          break;
        }

        case 'get_stats': {
          const stats = confirmService.getStats();
          response = {
            success: true,
            action: 'get_stats',
            stats: {
              totalConfirmations: stats.totalConfirmations,
              approved: stats.approved,
              declined: stats.declined,
              cancelled: stats.cancelled,
              approvalRate: stats.approvalRate,
              avgResponseTime: stats.avgResponseTime,
            },
            message: `${stats.totalConfirmations} confirmations, ${stats.approvalRate.toFixed(1)}% approval rate`,
          };
          break;
        }
      }

      return { response };
    } catch (error) {
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
