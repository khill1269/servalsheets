/**
 * ServalSheets - Planning Handler
 *
 * Handles natural language operation planning with cost estimation and risk analysis.
 */

import { getPlanningAgent } from '../services/planning-agent.js';
import type { OperationPlan } from '../types/operation-plan.js';
import type {
  SheetsPlanningInput,
  SheetsPlanningOutput,
  PlanningResponse,
} from '../schemas/planning.js';

// In-memory plan storage (in production, use Redis or database)
const planStore = new Map<string, OperationPlan>();

export interface PlanningHandlerOptions {
  // Options can be added as needed
}

export class PlanningHandler {
  constructor(_options: PlanningHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(input: SheetsPlanningInput): Promise<SheetsPlanningOutput> {
    const { request } = input;
    const planningAgent = getPlanningAgent();

    try {
      let response: PlanningResponse;

      switch (request.action) {
        case 'create': {
          const plan = await planningAgent.planFromIntent(request.intent, {
            spreadsheetId: request.spreadsheetId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            history: request.context?.['history'] as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            constraints: request.context?.['constraints'] as any,
          });

          // Store plan for later execution
          planStore.set(plan.id, plan);

          response = {
            success: true,
            action: 'create',
            plan: {
              id: plan.id,
              intent: plan.intent,
              title: plan.title,
              description: plan.description,
              steps: plan.steps.map((step) => ({
                stepNumber: step.stepNumber,
                description: step.description,
                action: step.action,
                params: step.params,
                rationale: step.rationale,
                expectedOutcome: step.expectedOutcome,
                risks: step.risks,
                estimatedDuration: step.estimatedDuration,
                optional: step.optional,
              })),
              risks: plan.risks,
              cost: plan.cost,
              estimatedTime: plan.estimatedTime,
              successCriteria: plan.successCriteria,
              rollbackStrategy: plan.rollbackStrategy,
            },
            message: `Created plan: ${plan.title}. ${plan.steps.length} step(s), estimated ${plan.estimatedTime}s, ${plan.cost.apiCalls} API call(s).`,
          };
          break;
        }

        case 'execute': {
          const plan = planStore.get(request.planId);

          if (!plan) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Plan ${request.planId} not found. Create a plan first using action:create.`,
                retryable: false,
              },
            };
            break;
          }

          const result = await planningAgent.execute(plan);

          response = {
            success: true,
            action: 'execute',
            planId: result.planId,
            planTitle: result.planTitle,
            stepsCompleted: result.stepResults.filter((s) => s.success).length,
            stepsFailed: result.stepResults.filter((s) => !s.success).length,
            duration: result.duration,
            rolledBack: result.rolledBack,
            outcome: result.outcome,
            stepResults: result.stepResults.map((step) => ({
              stepNumber: step.stepNumber,
              description: step.description,
              success: step.success,
              duration: step.duration,
              result: step.result,
              error: step.error?.message,
            })),
            message: result.success
              ? `Plan executed successfully. ${result.stepResults.filter((s) => s.success).length} step(s) completed.`
              : `Plan execution failed. ${result.stepResults.filter((s) => !s.success).length} step(s) failed.${result.rolledBack ? ' Changes rolled back.' : ''}`,
          };

          // Clean up executed plan
          if (result.success || result.rolledBack) {
            planStore.delete(request.planId);
          }
          break;
        }

        case 'validate': {
          const plan = planStore.get(request.planId);

          if (!plan) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Plan ${request.planId} not found`,
                retryable: false,
              },
            };
            break;
          }

          const validationMessage = await planningAgent.presentForConfirmation(plan);

          response = {
            success: true,
            action: 'validate',
            valid: true,
            validationMessage,
            warnings: plan.risks
              .filter((r) => r.level === 'high' || r.level === 'critical')
              .map((r) => `${r.level.toUpperCase()}: ${r.description}`),
            message: 'Plan validated successfully',
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
