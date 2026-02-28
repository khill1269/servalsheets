import type { SheetsAgentInput, SheetsAgentOutput } from '../schemas/agent.js';
import {
  compilePlan,
  executePlan,
  executeStep,
  createCheckpoint,
  rollbackToPlan,
  getPlanStatus,
  listPlans,
  resumePlan,
  type ExecuteHandlerFn,
} from '../services/agent-engine.js';
import type { Handlers } from './index.js';

export class AgentHandler {
  private handlers?: Handlers;
  private executeHandler: ExecuteHandlerFn;

  constructor(handlers?: Handlers) {
    this.handlers = handlers;
    // Create executeHandler that dispatches to actual tool handlers
    this.executeHandler = async (tool: string, action: string, params: Record<string, unknown>) => {
      if (!this.handlers) {
        throw new Error('No handlers available for agent execution');
      }
      // Map tool name to handler key
      const handlerKey = tool.replace('sheets_', '') as keyof Handlers;
      const handler = this.handlers[handlerKey];
      if (!handler) {
        throw new Error(`Unknown tool: ${tool}`);
      }

      // Dynamic dispatch across heterogeneous tool input schemas.
      // Agent steps are runtime-planned, so we pass through as an envelope.
      const dynamicHandler = handler as unknown as {
        handle: (input: { request: Record<string, unknown> }) => Promise<unknown>;
      };
      const result = await dynamicHandler.handle({
        request: { action, ...params },
      });
      return result;
    };
  }

  async handle(input: SheetsAgentInput): Promise<SheetsAgentOutput> {
    const req = input.request;
    const startTime = Date.now();

    try {
      switch (req.action) {
        case 'plan': {
          const plan = await compilePlan(
            req.description,
            req.maxSteps ?? 10,
            req.spreadsheetId,
            req.context
          );
          return {
            response: {
              success: true,
              action: 'plan',
              planId: plan.planId,
              steps: plan.steps,
              summary: `Plan created with ${plan.steps.length} steps`,
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
        case 'execute': {
          const result = await executePlan(req.planId, req.dryRun ?? false, this.executeHandler);
          return {
            response: {
              success: true,
              action: 'execute',
              planId: result.planId,
              status: result.status,
              results: result.results,
              completedSteps: result.results.filter((r) => r.success).length,
              totalSteps: result.steps.length,
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
        case 'execute_step': {
          const stepResult = await executeStep(req.planId, req.stepId, this.executeHandler);
          return {
            response: {
              success: true,
              action: 'execute_step',
              planId: req.planId,
              stepId: req.stepId,
              completed: stepResult.success,
              result: stepResult.result,
              error: stepResult.error,
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
        case 'observe': {
          const checkpoint = createCheckpoint(req.planId, req.context);
          return {
            response: {
              success: true,
              action: 'observe',
              planId: req.planId,
              checkpointId: checkpoint.checkpointId,
              snapshot: { stepIndex: checkpoint.stepIndex },
              timestamp: checkpoint.timestamp,
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
        case 'rollback': {
          const restored = rollbackToPlan(req.planId, req.checkpointId);
          return {
            response: {
              success: true,
              action: 'rollback',
              planId: req.planId,
              checkpointId: req.checkpointId,
              status: 'restored',
              restoredSteps: restored.currentStepIndex,
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
        case 'get_status': {
          const plan = getPlanStatus(req.planId);
          if (!plan) {
            return {
              response: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: `Plan ${req.planId} not found`,
                  retryable: false,
                },
              },
            };
          }
          const completedSteps = plan.results.filter((r) => r.success).length;
          return {
            response: {
              success: true,
              action: 'get_status',
              planId: plan.planId,
              status: plan.status,
              progress: {
                completedSteps,
                totalSteps: plan.steps.length,
                percentage:
                  plan.steps.length > 0
                    ? Math.round((completedSteps / plan.steps.length) * 100)
                    : 0,
              },
              currentStep: plan.steps[plan.currentStepIndex]?.stepId,
              error: plan.error,
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
        case 'list_plans': {
          const plans = listPlans(req.limit ?? 20, req.status);
          return {
            response: {
              success: true,
              action: 'list_plans',
              plans: plans.map((p) => ({
                planId: p.planId,
                description: p.description,
                status: p.status,
                createdAt: p.createdAt,
                stepsCount: p.steps.length,
              })),
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
        case 'resume': {
          const result = await resumePlan(req.planId, req.fromStepId, this.executeHandler);
          return {
            response: {
              success: true,
              action: 'resume',
              planId: result.planId,
              status: result.status,
              results: result.results,
              completedSteps: result.results.filter((r) => r.success).length,
              totalSteps: result.steps.length,
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
        default: {
          const _exhaustive: never = req;
          return {
            response: {
              success: false,
              error: {
                code: 'INVALID_PARAMS',
                message: `Unknown action: ${(req as Record<string, unknown>)['action'] as string}`,
                retryable: false,
              },
            },
          };
        }
      }
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
