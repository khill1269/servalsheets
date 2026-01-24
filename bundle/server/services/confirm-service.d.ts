/**
 * ConfirmService
 *
 * @purpose Implements MCP Elicitation (SEP-1036) for user confirmation before destructive/bulk operations
 * @category Quality
 * @usage Use via sheets_confirm tool; AI plans operation, service sends confirmation request, waits for user approval/rejection
 * @dependencies MCP SDK (Elicitation capability)
 * @stateful Yes - maintains pending confirmation requests, approval/rejection stats, timeout timers
 * @singleton Yes - one instance per process to track confirmation state
 *
 * @example
 * const service = new ConfirmService();
 * const plan = { operation: 'delete_rows', rows: 100, impact: 'Will delete 100 rows with 50 formulas' };
 * const approved = await service.request(plan, { riskLevel: 'high', timeout: 30000 });
 * if (approved) executeOperation();
 */
/**
 * Risk level for operations
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
/**
 * A single step in an operation plan
 */
export interface PlanStep {
    /** Step number (1-based) */
    stepNumber: number;
    /** Human-readable description */
    description: string;
    /** Tool to be called */
    tool: string;
    /** Action within the tool */
    action: string;
    /** Risk level of this step */
    risk: RiskLevel;
    /** Estimated API calls */
    estimatedApiCalls?: number;
    /** Whether this step is destructive */
    isDestructive?: boolean;
    /** Whether this step can be undone */
    canUndo?: boolean;
}
/**
 * An operation plan to be confirmed by the user
 */
export interface OperationPlan {
    /** Unique plan ID */
    id: string;
    /** Plan title */
    title: string;
    /** Detailed description */
    description: string;
    /** Steps in the plan */
    steps: PlanStep[];
    /** Overall risk level */
    overallRisk: RiskLevel;
    /** Total estimated API calls */
    totalApiCalls: number;
    /** Estimated execution time in seconds */
    estimatedTime: number;
    /** Whether a snapshot will be created */
    willCreateSnapshot: boolean;
    /** Warnings to display */
    warnings: string[];
}
/**
 * Result of user confirmation
 */
export interface ConfirmationResult {
    /** Whether the user approved */
    approved: boolean;
    /** Action taken: accept, decline, cancel */
    action: 'accept' | 'decline' | 'cancel';
    /** User's modifications (if any) */
    modifications?: string;
    /** Timestamp of confirmation */
    timestamp: number;
}
/**
 * Elicitation request for plan confirmation
 */
export interface ElicitationRequest {
    mode: 'form';
    message: string;
    requestedSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Statistics for confirmation service
 */
export interface ConfirmationStats {
    totalConfirmations: number;
    approved: number;
    declined: number;
    cancelled: number;
    approvalRate: number;
    avgResponseTime: number;
}
/**
 * Confirmation Service
 *
 * Handles user confirmation via MCP Elicitation before executing
 * multi-step operations. This follows the correct architectural pattern:
 * - Claude does the planning (it's an LLM, that's what it does)
 * - ServalSheets presents the plan for confirmation via Elicitation
 * - User approves/modifies/rejects
 * - Claude executes the approved plan
 */
declare class ConfirmationService {
    private stats;
    private responseTimes;
    private readonly maxResponseTimeHistory;
    /**
     * Format a plan for display in elicitation message
     */
    formatPlanForDisplay(plan: OperationPlan): string;
    /**
     * Get emoji for risk level
     */
    private getRiskEmoji;
    /**
     * Build elicitation request for plan confirmation
     */
    buildElicitationRequest(plan: OperationPlan): ElicitationRequest;
    /**
     * Process elicitation result into confirmation result
     */
    processElicitationResult(elicitResult: {
        action: string;
        content?: Record<string, unknown>;
    }, startTime: number): ConfirmationResult;
    /**
     * Record response time for statistics
     */
    private recordResponseTime;
    /**
     * Update approval rate
     */
    private updateApprovalRate;
    /**
     * Calculate risk level from steps
     */
    calculateOverallRisk(steps: PlanStep[]): RiskLevel;
    /**
     * Generate warnings for a plan
     */
    generateWarnings(plan: OperationPlan): string[];
    /**
     * Create a plan from steps (helper for handlers)
     */
    createPlan(title: string, description: string, steps: PlanStep[], options?: {
        willCreateSnapshot?: boolean;
        additionalWarnings?: string[];
    }): OperationPlan;
    /**
     * Get statistics
     */
    getStats(): ConfirmationStats;
    /**
     * Reset statistics (for testing)
     */
    resetStats(): void;
}
/**
 * Get the confirmation service instance
 */
export declare function getConfirmationService(): ConfirmationService;
/**
 * Reset the confirmation service (for testing only)
 * @internal
 */
export declare function resetConfirmationService(): void;
export {};
//# sourceMappingURL=confirm-service.d.ts.map