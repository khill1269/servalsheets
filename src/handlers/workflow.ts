/**
 * ServalSheets - Workflow Handler
 *
 * Handles smart workflow detection and execution.
 */

import { getWorkflowEngine } from '../services/workflow-engine.js';
import type {
  SheetsWorkflowInput,
  SheetsWorkflowOutput,
  WorkflowResponse,
} from '../schemas/workflow.js';

export interface WorkflowHandlerOptions {
  // Options can be added as needed
}

export class WorkflowHandler {
  constructor(_options: WorkflowHandlerOptions = {}) {
    // Constructor logic if needed
  }

  async handle(input: SheetsWorkflowInput): Promise<SheetsWorkflowOutput> {
    const { request } = input;
    const workflowEngine = getWorkflowEngine();

    try {
      let response: WorkflowResponse;

      switch (request.action) {
        case 'detect': {
          const suggestions = await workflowEngine.detectAndSuggest(
            request.triggerAction,
            request.params,
            request.context
          );

          response = {
            success: true,
            action: 'detect',
            suggestions: suggestions.map((s) => ({
              workflowId: s.workflow.id,
              workflowName: s.workflow.name,
              description: s.workflow.description,
              confidence: s.confidence,
              reason: s.reason,
              preview: s.preview,
              estimatedDuration: s.workflow.estimatedDuration,
              toolCallsSaved: s.workflow.steps.length - 1,
            })),
            message: suggestions.length > 0
              ? `Found ${suggestions.length} workflow suggestion(s)`
              : 'No workflow suggestions found',
          };
          break;
        }

        case 'execute': {
          const workflow = workflowEngine.getWorkflowById(request.workflowId);

          if (!workflow) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Workflow ${request.workflowId} not found`,
                retryable: false,
              },
            };
            break;
          }

          const result = await workflowEngine.execute(workflow, request.params, {
            dryRun: request.dryRun ?? false,
            stopOnError: request.stopOnError ?? true,
          });

          if (result.success) {
            response = {
              success: true,
              action: 'execute',
              workflowId: result.workflowId,
              workflowName: result.workflowName,
              stepsCompleted: result.stepResults.filter((s) => s.success).length,
              stepsFailed: result.stepResults.filter((s) => !s.success && !s.skipped).length,
              stepsSkipped: result.stepResults.filter((s) => s.skipped).length,
              duration: result.duration,
              stepResults: result.stepResults.map((s) => ({
                stepIndex: s.stepIndex,
                description: s.description,
                action: s.action,
                success: s.success,
                duration: s.duration,
                skipped: s.skipped,
                result: s.result,
                error: s.error?.message,
              })),
              message: `Workflow executed successfully. ${result.stepResults.filter((s) => s.success).length} step(s) completed.`,
            };
          } else {
            response = {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: result.error?.message || 'Workflow execution failed',
                retryable: false,
              },
            };
          }
          break;
        }

        case 'list': {
          const workflows = workflowEngine.getWorkflows();
          const filtered = request.category
            ? workflows.filter((w) => w.tags?.includes(request.category!))
            : workflows;

          response = {
            success: true,
            action: 'list',
            workflows: filtered.map((w) => ({
              id: w.id,
              name: w.name,
              description: w.description,
              category: w.tags?.[0] || 'general',
              stepCount: w.steps.length,
              estimatedDuration: w.estimatedDuration,
              tags: w.tags,
            })),
            message: `Found ${filtered.length} workflow(s)`,
          };
          break;
        }

        case 'get': {
          const workflow = workflowEngine.getWorkflowById(request.workflowId);

          if (!workflow) {
            response = {
              success: false,
              error: {
                code: 'NOT_FOUND',
                message: `Workflow ${request.workflowId} not found`,
                retryable: false,
              },
            };
            break;
          }

          response = {
            success: true,
            action: 'get',
            workflow: {
              id: workflow.id,
              name: workflow.name,
              description: workflow.description,
              category: workflow.tags?.[0] || 'general',
              stepCount: workflow.steps.length,
              estimatedDuration: workflow.estimatedDuration,
              tags: workflow.tags,
              steps: workflow.steps.map((s) => ({
                description: s.description,
                action: s.action,
                optional: s.optional,
              })),
            },
            message: `Workflow ${workflow.name} retrieved`,
          };
          break;
        }

        default: {
          // TypeScript exhaustiveness check
          const exhaustiveCheck: never = request;
          response = {
            success: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Unsupported action: ${(exhaustiveCheck as { action: string }).action}`,
              retryable: false,
            },
          };
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
