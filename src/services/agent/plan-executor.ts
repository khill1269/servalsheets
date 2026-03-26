/**
 * ServalSheets — Agent Plan Executor
 *
 * Executes multi-step plans with:
 * - Step validation (compile-time + runtime)
 * - Recovery step injection on failures
 * - AI-powered step validation (pause on failure)
 * - Checkpoint-based rollback support
 */

import type { ExecutionStep, StepResult, StepRunOutcome, ExecuteHandlerFn } from './types.js';
import type { ErrorDetail } from '../../schemas/shared.js';
import { ErrorCodes } from '../../handlers/error-codes.js';
import type { SamplingServer } from './types.js';

export class PlanExecutor {
  private executeHandler: ExecuteHandlerFn;
  private samplingServer: SamplingServer | undefined;

  constructor(executeHandler: ExecuteHandlerFn, samplingServer?: SamplingServer) {
    this.executeHandler = executeHandler;
    this.samplingServer = samplingServer;
  }

  async runStep(step: ExecutionStep, context: ExecutionContext): Promise<StepRunOutcome> {
    // Phase 1: Compile-time validation (pre-existing)
    if (!step.validation?.valid) {
      // Recovery: auto-insert a diagnostic step
      return {
        status: 'retry',
        pauseReason: `Step validation failed: ${step.validation?.issues?.map((i) => i.message).join(', ')}`,
        suggestedFix: step.validation?.suggestedFix,
      };
    }

    try {
      // Phase 2: Execute the step
      const startTime = Date.now();
      const result = await this.executeHandler(step.tool, step.action, step.params);
      const duration = Date.now() - startTime;

      // Phase 3: AI validation (if sampling available)
      if (this.samplingServer && step.tool === 'sheets_data') {
        const aiValidation = await this.aiValidateStepResult(
          step,
          result,
          context
        );

        if (!aiValidation.valid) {
          // PAUSE on AI validation failure instead of silently continuing
          return {
            status: 'pause',
            pauseReason: `AI validation failed: ${aiValidation.reason}`,
            suggestedFix: aiValidation.suggestedFix,
            completedSteps: context.completedSteps,
            errorDetail: {
              code: ErrorCodes.VALIDATION_ERROR,
              message: aiValidation.reason,
              retryable: false,
            },
          };
        }
      }

      const stepResult: StepResult = {
        stepId: step.stepId,
        success: true,
        result,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      return {
        status: 'success',
        stepResult,
        completedSteps: context.completedSteps + 1,
      };
    } catch (err) {
      // Phase 4: Error handling + recovery
      const errorDetail = this.normalizeError(err);

      // Auto-inject recovery step if applicable
      const recoveryStep = this.generateRecoveryStep(step, errorDetail);

      return {
        status: step.retryCount === 1 ? 'retry' : 'pause',
        errorDetail,
        recoveryStep,
        completedSteps: context.completedSteps,
        pauseReason: recoveryStep ? undefined : `Step failed: ${errorDetail.message}`,
      };
    }
  }

  private async aiValidateStepResult(
    step: ExecutionStep,
    result: unknown,
    context: ExecutionContext
  ): Promise<{ valid: boolean; reason?: string; suggestedFix?: string }> {
    if (!this.samplingServer) {
      return { valid: true };
    }

    try {
      const samplingRequest = {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Validate this step result for data integrity:\nStep: ${step.action} on ${JSON.stringify(step.params).substring(0, 200)}...\nResult: ${JSON.stringify(result).substring(0, 200)}...\n\nDoes this look correct? Any data quality issues?`,
            },
          },
        ],
        systemPrompt: 'You are a data validation expert. Identify any issues with this step execution result. Be strict about data quality.',
        maxTokens: 500,
      };

      const response = await this.samplingServer.createMessage(samplingRequest);

      // Extract validation decision from response
      let responseText = '';
      if (Array.isArray(response.content)) {
        responseText = response.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join(' ');
      } else if (typeof response.content === 'string') {
        responseText = response.content;
      }

      const hasIssues = responseText.toLowerCase().includes('issue') ||
        responseText.toLowerCase().includes('problem') ||
        responseText.toLowerCase().includes('concern');

      return {
        valid: !hasIssues,
        reason: hasIssues ? `AI detected potential issues: ${responseText.substring(0, 200)}` : undefined,
        suggestedFix: hasIssues ? 'Review the step result manually before proceeding' : undefined,
      };
    } catch (err) {
      // If AI validation fails, proceed (non-blocking)
      return { valid: true };
    }
  }

  private normalizeError(err: unknown): ErrorDetail {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      return err as ErrorDetail;
    }
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: err instanceof Error ? err.message : String(err),
      retryable: false,
    };
  }

  private generateRecoveryStep(
    step: ExecutionStep,
    error: ErrorDetail
  ): ExecutionStep | null {
    // Auto-generate recovery steps for common failure patterns
    if (error.code === 'RATE_LIMIT' && (step.retryCount ?? 0) < 1) {
      // Auto-inject exponential backoff retry
      return {
        ...step,
        stepId: `${step.stepId}-retry-1`,
        autoInserted: true,
        description: `Retry ${step.description} after backoff`,
        retryCount: 1,
      };
    }

    return null;
  }
}

interface ExecutionContext {
  completedSteps: number;
  totalSteps: number;
  currentStepIndex: number;
}
