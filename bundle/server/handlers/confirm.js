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
import { randomUUID } from 'crypto';
import { unwrapRequest } from './base.js';
import { getConfirmationService, } from '../services/confirm-service.js';
import { getCapabilitiesWithCache } from '../services/capability-cache.js';
// In-memory wizard session store (could be upgraded to Redis for production)
const wizardSessions = new Map();
// Cleanup old sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    for (const [id, session] of wizardSessions) {
        if (now - session.createdAt > maxAge) {
            wizardSessions.delete(id);
        }
    }
}, 5 * 60 * 1000);
/**
 * Confirmation Handler
 *
 * Handles user confirmation via MCP Elicitation before multi-step operations.
 */
export class ConfirmHandler {
    context;
    constructor(options) {
        this.context = options.context;
    }
    /**
     * Convert schema plan step to service plan step
     */
    toServiceStep(step) {
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
    async handle(input) {
        const req = unwrapRequest(input);
        const confirmService = getConfirmationService();
        try {
            let response;
            switch (req.action) {
                case 'request': {
                    // Type assertion for flattened union pattern
                    const requestInput = req;
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
                    // Check if client supports elicitation (with caching)
                    const sessionId = this.context.requestId || 'default';
                    const clientCapabilities = await getCapabilitiesWithCache(sessionId, this.context.server);
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
                    const plan = confirmService.createPlan(requestInput.plan.title, requestInput.plan.description, requestInput.plan.steps.map(this.toServiceStep), {
                        willCreateSnapshot: requestInput.plan.willCreateSnapshot,
                        additionalWarnings: requestInput.plan.additionalWarnings,
                    });
                    // Build elicitation request
                    const elicitRequest = confirmService.buildElicitationRequest(plan);
                    // Request user confirmation via MCP Elicitation
                    const startTime = Date.now();
                    const elicitResult = await this.context.server.elicitInput({
                        mode: 'form',
                        message: elicitRequest.message,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        requestedSchema: elicitRequest.requestedSchema, // Type assertion needed due to strict SDK schema types
                    });
                    // Process result (convert ElicitResult to the format expected by service)
                    const confirmation = confirmService.processElicitationResult({
                        action: elicitResult.action,
                        content: elicitResult.content,
                    }, startTime);
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
                case 'wizard_start': {
                    const wizardInput = req;
                    const wizardId = wizardInput.wizardId || `wiz_${randomUUID()}`;
                    // Create wizard session
                    const session = {
                        wizardId,
                        title: wizardInput.title,
                        description: wizardInput.description,
                        steps: wizardInput.steps,
                        currentStepIndex: 0,
                        completedSteps: [],
                        collectedValues: {},
                        context: wizardInput.context,
                        createdAt: Date.now(),
                    };
                    wizardSessions.set(wizardId, session);
                    const firstStep = session.steps[0];
                    const wizardState = {
                        wizardId,
                        title: session.title,
                        currentStepIndex: 0,
                        totalSteps: session.steps.length,
                        currentStepId: firstStep.stepId,
                        completedSteps: [],
                        collectedValues: {},
                        isComplete: false,
                    };
                    response = {
                        success: true,
                        action: 'wizard_start',
                        wizard: wizardState,
                        nextStep: firstStep,
                        message: `Wizard "${session.title}" started. Step 1 of ${session.steps.length}: ${firstStep.title}`,
                    };
                    break;
                }
                case 'wizard_step': {
                    const stepInput = req;
                    const session = wizardSessions.get(stepInput.wizardId);
                    if (!session) {
                        response = {
                            success: false,
                            error: {
                                code: 'NOT_FOUND',
                                message: `Wizard "${stepInput.wizardId}" not found. It may have expired.`,
                                retryable: false,
                            },
                        };
                        break;
                    }
                    // Validate step ID
                    const stepIndex = session.steps.findIndex((s) => s.stepId === stepInput.stepId);
                    if (stepIndex === -1) {
                        response = {
                            success: false,
                            error: {
                                code: 'INVALID_PARAMS',
                                message: `Step "${stepInput.stepId}" not found in wizard.`,
                                retryable: false,
                            },
                        };
                        break;
                    }
                    // Handle navigation
                    let nextIndex;
                    if (stepInput.direction === 'back') {
                        nextIndex = Math.max(0, session.currentStepIndex - 1);
                    }
                    else if (stepInput.direction === 'skip') {
                        nextIndex = Math.min(session.steps.length - 1, session.currentStepIndex + 1);
                    }
                    else {
                        // 'next' - store values and advance
                        session.collectedValues = {
                            ...session.collectedValues,
                            [stepInput.stepId]: stepInput.values,
                        };
                        if (!session.completedSteps.includes(stepInput.stepId)) {
                            session.completedSteps.push(stepInput.stepId);
                        }
                        nextIndex = Math.min(session.steps.length - 1, session.currentStepIndex + 1);
                    }
                    session.currentStepIndex = nextIndex;
                    const isComplete = session.completedSteps.length === session.steps.length;
                    const currentStep = session.steps[nextIndex];
                    const wizardState = {
                        wizardId: session.wizardId,
                        title: session.title,
                        currentStepIndex: nextIndex,
                        totalSteps: session.steps.length,
                        currentStepId: currentStep.stepId,
                        completedSteps: session.completedSteps,
                        collectedValues: session.collectedValues,
                        isComplete,
                    };
                    response = {
                        success: true,
                        action: 'wizard_step',
                        wizard: wizardState,
                        nextStep: isComplete ? undefined : currentStep,
                        message: isComplete
                            ? `Wizard complete. All ${session.steps.length} steps collected.`
                            : `Step ${nextIndex + 1} of ${session.steps.length}: ${currentStep.title}`,
                    };
                    break;
                }
                case 'wizard_complete': {
                    const completeInput = req;
                    const session = wizardSessions.get(completeInput.wizardId);
                    if (!session) {
                        response = {
                            success: false,
                            error: {
                                code: 'NOT_FOUND',
                                message: `Wizard "${completeInput.wizardId}" not found. It may have expired.`,
                                retryable: false,
                            },
                        };
                        break;
                    }
                    // Return final state
                    const finalState = {
                        wizardId: session.wizardId,
                        title: session.title,
                        currentStepIndex: session.steps.length - 1,
                        totalSteps: session.steps.length,
                        currentStepId: session.steps[session.steps.length - 1].stepId,
                        completedSteps: session.completedSteps,
                        collectedValues: session.collectedValues,
                        isComplete: true,
                    };
                    // Clean up session
                    wizardSessions.delete(completeInput.wizardId);
                    response = {
                        success: true,
                        action: 'wizard_complete',
                        wizard: finalState,
                        message: `Wizard "${session.title}" completed with ${Object.keys(session.collectedValues).length} steps of data.`,
                    };
                    break;
                }
            }
            return { response };
        }
        catch (error) {
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
//# sourceMappingURL=confirm.js.map