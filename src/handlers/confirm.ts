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

import type { HandlerContext } from './base.js';
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

export interface ConfirmHandlerOptions {
  context: HandlerContext;
}

/**
 * Confirmation Handler
 *
 * Handles user confirmation via MCP Elicitation before multi-step operations.
 */
export class ConfirmHandler {
  private context: HandlerContext;

  constructor(options: ConfirmHandlerOptions) {
    this.context = options.context;
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
  async handle(input: SheetsConfirmInput): Promise<SheetsConfirmOutput> {
    const { request } = input;
    const confirmService = getConfirmationService();

    try {
      let response: ConfirmResponse;

      switch (request.action) {
        case 'request': {
          // Check if server is available
          if (!this.context.server) {
            response = {
              success: false,
              error: {
                code: 'ELICITATION_UNAVAILABLE',
                message: 'MCP Server instance not available. Cannot perform elicitation.',
                retryable: false,
              },
            };
            break;
          }

          // Check if client supports elicitation
          const clientCapabilities = this.context.server.getClientCapabilities();
          if (!clientCapabilities?.elicitation) {
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
          const elicitResult = await this.context.server.elicitInput({
            mode: 'form',
            message: elicitRequest.message,
            requestedSchema: elicitRequest.requestedSchema as any, // Type assertion needed due to strict SDK schema types
          });

          // Process result (convert ElicitResult to the format expected by service)
          const confirmation = confirmService.processElicitationResult(
            {
              action: elicitResult.action,
              content: elicitResult.content,
            },
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
