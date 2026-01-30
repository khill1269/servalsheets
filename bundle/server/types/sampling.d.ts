/**
 * ServalSheets - Enhanced MCP Sampling Types
 *
 * Type definitions for enhanced MCP sampling with tool calling:
 * - Multi-tool workflow orchestration
 * - Context-aware tool selection
 * - Intelligent parameter inference
 * - Tool calling chains
 *
 * Phase 3, Task 3.4
 */
/**
 * Tool call status
 */
export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
/**
 * Tool call priority
 */
export type ToolCallPriority = 'low' | 'medium' | 'high' | 'critical';
/**
 * Tool selection strategy
 */
export type ToolSelectionStrategy = 'automatic' | 'cost_optimized' | 'performance_optimized' | 'quality_optimized';
/**
 * Enhanced tool call request
 */
export interface EnhancedToolCall {
    /** Unique call ID */
    id: string;
    /** Tool name */
    tool: string;
    /** Tool parameters */
    params: Record<string, unknown>;
    /** Call context */
    context?: ToolCallContext;
    /** Dependencies on other tool calls */
    dependsOn?: string[];
    /** Priority */
    priority: ToolCallPriority;
    /** Status */
    status: ToolCallStatus;
    /** Result (when completed) */
    result?: unknown;
    /** Error (when failed) */
    error?: Error;
    /** Execution duration in ms */
    duration?: number;
    /** Timestamp */
    timestamp: number;
    /** Retry count */
    retryCount?: number;
    /** Maximum retries */
    maxRetries?: number;
}
/**
 * Tool call context for intelligent parameter inference
 */
export interface ToolCallContext {
    /** Spreadsheet ID */
    spreadsheetId?: string;
    /** Sheet name */
    sheetName?: string;
    /** Range */
    range?: string;
    /** User intent */
    userIntent?: string;
    /** Previous tool results */
    previousResults?: Record<string, unknown>;
    /** Inferred parameters */
    inferredParams?: Record<string, unknown>;
    /** Metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Multi-tool workflow definition
 */
export interface MultiToolWorkflow {
    /** Workflow ID */
    id: string;
    /** Workflow name */
    name: string;
    /** Description */
    description: string;
    /** Tool calls in the workflow */
    toolCalls: EnhancedToolCall[];
    /** Execution strategy */
    strategy: 'sequential' | 'parallel' | 'adaptive';
    /** Overall status */
    status: ToolCallStatus;
    /** Context */
    context: ToolCallContext;
    /** Start time */
    startTime?: number;
    /** End time */
    endTime?: number;
    /** Total duration */
    duration?: number;
    /** Success criteria */
    successCriteria?: string[];
    /** Rollback on failure */
    rollbackOnFailure?: boolean;
}
/**
 * Tool call execution result
 */
export interface ToolCallResult {
    /** Tool call ID */
    callId: string;
    /** Success */
    success: boolean;
    /** Result data */
    data?: unknown;
    /** Error */
    error?: Error;
    /** Duration in ms */
    duration: number;
    /** Metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
    /** Workflow ID */
    workflowId: string;
    /** Success */
    success: boolean;
    /** Tool call results */
    toolResults: ToolCallResult[];
    /** Total duration */
    duration: number;
    /** Completed calls */
    completedCalls: number;
    /** Failed calls */
    failedCalls: number;
    /** Skipped calls */
    skippedCalls: number;
    /** Final output */
    output?: unknown;
    /** Error (if workflow failed) */
    error?: Error;
}
/**
 * Tool capability definition
 */
export interface ToolCapability {
    /** Tool name */
    name: string;
    /** Description */
    description: string;
    /** Required parameters */
    requiredParams: string[];
    /** Optional parameters */
    optionalParams: string[];
    /** Output type */
    outputType: string;
    /** Cost estimate (API calls) */
    costEstimate: number;
    /** Average duration in ms */
    avgDuration: number;
    /** Success rate (0-1) */
    successRate: number;
    /** Tags */
    tags?: string[];
    /** Prerequisites */
    prerequisites?: string[];
}
/**
 * Tool selection criteria
 */
export interface ToolSelectionCriteria {
    /** User intent */
    intent: string;
    /** Available context */
    context: ToolCallContext;
    /** Selection strategy */
    strategy: ToolSelectionStrategy;
    /** Maximum tools to select */
    maxTools?: number;
    /** Cost budget (API calls) */
    costBudget?: number;
    /** Time budget (ms) */
    timeBudget?: number;
    /** Required capabilities */
    requiredCapabilities?: string[];
    /** Preferred tools */
    preferredTools?: string[];
    /** Excluded tools */
    excludedTools?: string[];
}
/**
 * Tool selection result
 */
export interface ToolSelectionResult {
    /** Selected tools in execution order */
    selectedTools: ToolCapability[];
    /** Inferred parameters for each tool */
    inferredParams: Record<string, Record<string, unknown>>;
    /** Estimated total cost */
    estimatedCost: number;
    /** Estimated total duration */
    estimatedDuration: number;
    /** Confidence score (0-1) */
    confidence: number;
    /** Reasoning */
    reasoning: string;
    /** Alternative options */
    alternatives?: ToolSelectionResult[];
}
/**
 * Parameter inference result
 */
export interface ParameterInference {
    /** Parameter name */
    paramName: string;
    /** Inferred value */
    value: unknown;
    /** Confidence (0-1) */
    confidence: number;
    /** Source of inference */
    source: 'context' | 'previous_result' | 'default' | 'user_intent' | 'pattern';
    /** Reasoning */
    reasoning?: string;
}
/**
 * Tool chain definition
 */
export interface ToolChain {
    /** Chain ID */
    id: string;
    /** Chain name */
    name: string;
    /** Description */
    description: string;
    /** Tools in the chain */
    tools: string[];
    /** Parameter mappings (output -> input) */
    parameterMappings: ParameterMapping[];
    /** Conditions for execution */
    conditions?: ChainCondition[];
    /** Tags */
    tags?: string[];
}
/**
 * Parameter mapping between tools
 */
export interface ParameterMapping {
    /** Source tool */
    sourceTool: string;
    /** Source output path (e.g., "result.spreadsheetId") */
    sourcePath: string;
    /** Target tool */
    targetTool: string;
    /** Target parameter name */
    targetParam: string;
    /** Transformation function (optional) */
    transform?: (value: unknown) => unknown;
}
/**
 * Chain execution condition
 */
export interface ChainCondition {
    /** Tool to check */
    tool: string;
    /** Condition type */
    type: 'success' | 'failure' | 'result_match' | 'custom';
    /** Expected value (for result_match) */
    expectedValue?: unknown;
    /** Custom condition function */
    condition?: (result: unknown) => boolean;
    /** Action if condition is met */
    action: 'continue' | 'skip_next' | 'abort' | 'retry';
}
/**
 * Sampling context for Claude
 */
export interface SamplingContext {
    /** Conversation history */
    conversationHistory?: Message[];
    /** Available tools */
    availableTools: ToolCapability[];
    /** Current context */
    context: ToolCallContext;
    /** User intent */
    userIntent?: string;
    /** Constraints */
    constraints?: {
        maxToolCalls?: number;
        costBudget?: number;
        timeBudget?: number;
    };
    /** Sampling parameters */
    samplingParams?: {
        temperature?: number;
        maxTokens?: number;
        stopSequences?: string[];
    };
}
/**
 * Message in conversation history
 */
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}
/**
 * Sampling response from Claude
 */
export interface SamplingResponse {
    /** Response text */
    text: string;
    /** Tool calls requested */
    toolCalls?: EnhancedToolCall[];
    /** Stop reason */
    stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
    /** Usage statistics */
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    /** Metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Tool orchestrator configuration
 */
export interface OrchestratorConfig {
    /** Enable orchestration */
    enabled?: boolean;
    /** Default tool selection strategy */
    defaultStrategy?: ToolSelectionStrategy;
    /** Maximum concurrent tool calls */
    maxConcurrentCalls?: number;
    /** Enable automatic retries */
    enableRetries?: boolean;
    /** Default max retries */
    defaultMaxRetries?: number;
    /** Retry delay in ms */
    retryDelayMs?: number;
    /** Enable parameter inference */
    enableParameterInference?: boolean;
    /** Enable context propagation */
    enableContextPropagation?: boolean;
    /** Timeout per tool call (ms) */
    toolCallTimeoutMs?: number;
    /** Workflow timeout (ms) */
    workflowTimeoutMs?: number;
    /** Enable caching */
    enableCaching?: boolean;
    /** Cache TTL in ms */
    cacheTtl?: number;
    /** Verbose logging */
    verboseLogging?: boolean;
}
/**
 * Orchestrator statistics
 */
export interface OrchestratorStats {
    /** Total workflows executed */
    totalWorkflows: number;
    /** Successful workflows */
    successfulWorkflows: number;
    /** Failed workflows */
    failedWorkflows: number;
    /** Success rate */
    successRate: number;
    /** Total tool calls */
    totalToolCalls: number;
    /** Successful tool calls */
    successfulToolCalls: number;
    /** Failed tool calls */
    failedToolCalls: number;
    /** Tool call success rate */
    toolCallSuccessRate: number;
    /** Average workflow duration */
    avgWorkflowDuration: number;
    /** Average tool calls per workflow */
    avgToolCallsPerWorkflow: number;
    /** Total API calls saved (via caching) */
    apiCallsSaved: number;
    /** Cache hit rate */
    cacheHitRate: number;
    /** Parameter inference success rate */
    paramInferenceSuccessRate: number;
}
/**
 * Tool execution context
 */
export interface ToolExecutionContext {
    /** Current tool call */
    currentCall: EnhancedToolCall;
    /** Workflow context */
    workflowContext: ToolCallContext;
    /** Previous results */
    previousResults: Map<string, unknown>;
    /** Start time */
    startTime: number;
    /** Attempt number */
    attempt: number;
    /** Cancellation token */
    cancelled?: boolean;
}
//# sourceMappingURL=sampling.d.ts.map