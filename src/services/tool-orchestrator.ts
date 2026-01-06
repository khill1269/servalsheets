/**
 * ServalSheets - Tool Orchestrator
 *
 * Intelligent multi-tool workflow orchestration with:
 * - Context-aware tool selection
 * - Automatic parameter inference
 * - Tool call chaining
 * - Retry and error handling
 *
 * Phase 3, Task 3.4
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EnhancedToolCall,
  ToolCallStatus as _ToolCallStatus,
  ToolCallPriority as _ToolCallPriority,
  ToolCallContext,
  MultiToolWorkflow,
  ToolCallResult,
  WorkflowExecutionResult,
  ToolCapability,
  ToolSelectionStrategy as _ToolSelectionStrategy,
  ToolSelectionCriteria,
  ToolSelectionResult,
  ParameterInference as _ParameterInference,
  ToolChain,
  ParameterMapping as _ParameterMapping,
  OrchestratorConfig,
  OrchestratorStats,
  ToolExecutionContext,
} from '../types/sampling.js';

/**
 * Tool Orchestrator - Manages multi-tool workflows and intelligent tool selection
 */
export class ToolOrchestrator {
  private config: Required<OrchestratorConfig>;
  private stats: OrchestratorStats;
  private toolRegistry: Map<string, ToolCapability>;
  private toolChains: Map<string, ToolChain>;
  private activeWorkflows: Map<string, MultiToolWorkflow>;
  private resultCache: Map<string, { result: unknown; timestamp: number }>;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      defaultStrategy: config.defaultStrategy ?? 'automatic',
      maxConcurrentCalls: config.maxConcurrentCalls ?? 5,
      enableRetries: config.enableRetries ?? true,
      defaultMaxRetries: config.defaultMaxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      enableParameterInference: config.enableParameterInference ?? true,
      enableContextPropagation: config.enableContextPropagation ?? true,
      toolCallTimeoutMs: config.toolCallTimeoutMs ?? 30000,
      workflowTimeoutMs: config.workflowTimeoutMs ?? 300000,
      enableCaching: config.enableCaching ?? true,
      cacheTtl: config.cacheTtl ?? 300000,
      verboseLogging: config.verboseLogging ?? false,
    };

    this.stats = {
      totalWorkflows: 0,
      successfulWorkflows: 0,
      failedWorkflows: 0,
      successRate: 0,
      totalToolCalls: 0,
      successfulToolCalls: 0,
      failedToolCalls: 0,
      toolCallSuccessRate: 0,
      avgWorkflowDuration: 0,
      avgToolCallsPerWorkflow: 0,
      apiCallsSaved: 0,
      cacheHitRate: 0,
      paramInferenceSuccessRate: 0,
    };

    this.toolRegistry = new Map();
    this.toolChains = new Map();
    this.activeWorkflows = new Map();
    this.resultCache = new Map();

    // Register builtin tool chains
    this.registerBuiltinToolChains();
  }

  /**
   * Register a tool capability
   */
  registerTool(tool: ToolCapability): void {
    this.toolRegistry.set(tool.name, tool);
    this.log(`Registered tool: ${tool.name}`);
  }

  /**
   * Register a tool chain
   */
  registerToolChain(chain: ToolChain): void {
    this.toolChains.set(chain.id, chain);
    this.log(`Registered tool chain: ${chain.name}`);
  }

  /**
   * Select tools based on user intent and context
   */
  async selectTools(
    criteria: ToolSelectionCriteria
  ): Promise<ToolSelectionResult> {
    this.log(`Selecting tools for intent: ${criteria.intent}`);

    const availableTools = Array.from(this.toolRegistry.values());

    // Filter by required capabilities
    let candidateTools = availableTools;
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      candidateTools = candidateTools.filter((tool) =>
        criteria.requiredCapabilities!.some((cap) =>
          tool.tags?.includes(cap) || tool.name.includes(cap)
        )
      );
    }

    // Filter by excluded tools
    if (criteria.excludedTools && criteria.excludedTools.length > 0) {
      candidateTools = candidateTools.filter(
        (tool) => !criteria.excludedTools!.includes(tool.name)
      );
    }

    // Score tools based on strategy
    const scoredTools = candidateTools.map((tool) => ({
      tool,
      score: this.scoreToolForIntent(tool, criteria),
    }));

    // Sort by score
    scoredTools.sort((a, b) => b.score - a.score);

    // Select top tools within budget
    const selectedTools: ToolCapability[] = [];
    let totalCost = 0;
    let totalDuration = 0;

    for (const { tool } of scoredTools) {
      if (criteria.maxTools && selectedTools.length >= criteria.maxTools) {
        break;
      }

      if (criteria.costBudget && totalCost + tool.costEstimate > criteria.costBudget) {
        continue;
      }

      if (criteria.timeBudget && totalDuration + tool.avgDuration > criteria.timeBudget) {
        continue;
      }

      selectedTools.push(tool);
      totalCost += tool.costEstimate;
      totalDuration += tool.avgDuration;
    }

    // Infer parameters for selected tools
    const inferredParams: Record<string, Record<string, unknown>> = {};
    for (const tool of selectedTools) {
      inferredParams[tool.name] = await this.inferParameters(tool, criteria.context);
    }

    const confidence = selectedTools.length > 0 ? scoredTools[0]!.score : 0;

    return {
      selectedTools,
      inferredParams,
      estimatedCost: totalCost,
      estimatedDuration: totalDuration,
      confidence,
      reasoning: this.generateSelectionReasoning(selectedTools, criteria),
    };
  }

  /**
   * Create a workflow from tool selection
   */
  async createWorkflow(
    selection: ToolSelectionResult,
    context: ToolCallContext,
    options: {
      strategy?: 'sequential' | 'parallel' | 'adaptive';
      rollbackOnFailure?: boolean;
    } = {}
  ): Promise<MultiToolWorkflow> {
    const workflowId = uuidv4();
    const toolCalls: EnhancedToolCall[] = [];

    // Create tool calls from selection
    for (let i = 0; i < selection.selectedTools.length; i++) {
      const tool = selection.selectedTools[i]!;
      const params = selection.inferredParams[tool.name] || {};

      const toolCall: EnhancedToolCall = {
        id: uuidv4(),
        tool: tool.name,
        params,
        context,
        dependsOn: i > 0 ? [toolCalls[i - 1]!.id] : undefined,
        priority: 'medium',
        status: 'pending',
        timestamp: Date.now(),
        maxRetries: this.config.defaultMaxRetries,
        retryCount: 0,
      };

      toolCalls.push(toolCall);
    }

    const workflow: MultiToolWorkflow = {
      id: workflowId,
      name: `Workflow ${workflowId.slice(0, 8)}`,
      description: `Auto-generated workflow for ${selection.selectedTools.length} tools`,
      toolCalls,
      strategy: options.strategy ?? 'sequential',
      status: 'pending',
      context,
      rollbackOnFailure: options.rollbackOnFailure ?? true,
    };

    this.activeWorkflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflow: MultiToolWorkflow
  ): Promise<WorkflowExecutionResult> {
    this.log(`Executing workflow: ${workflow.id}`);
    this.stats.totalWorkflows++;

    const startTime = Date.now();
    workflow.startTime = startTime;
    workflow.status = 'in_progress';

    const results: ToolCallResult[] = [];
    const previousResults = new Map<string, unknown>();

    try {
      // Execute based on strategy
      if (workflow.strategy === 'sequential') {
        await this.executeSequential(workflow, results, previousResults);
      } else if (workflow.strategy === 'parallel') {
        await this.executeParallel(workflow, results, previousResults);
      } else {
        await this.executeAdaptive(workflow, results, previousResults);
      }

      // Check success
      const failedResults = results.filter((r) => !r.success);
      const success = failedResults.length === 0;

      workflow.status = success ? 'completed' : 'failed';
      workflow.endTime = Date.now();
      workflow.duration = workflow.endTime - startTime;

      if (success) {
        this.stats.successfulWorkflows++;
      } else {
        this.stats.failedWorkflows++;

        // Rollback if configured
        if (workflow.rollbackOnFailure) {
          await this.rollbackWorkflow(workflow, results);
        }
      }

      // Update stats
      this.updateStats(workflow, results);

      const result: WorkflowExecutionResult = {
        workflowId: workflow.id,
        success,
        toolResults: results,
        duration: workflow.duration,
        completedCalls: results.filter((r) => r.success).length,
        failedCalls: results.filter((r) => !r.success).length,
        skippedCalls: workflow.toolCalls.filter((c) => c.status === 'skipped').length,
        output: this.extractFinalOutput(results),
        error: failedResults.length > 0 ? failedResults[0]!.error : undefined,
      };

      return result;
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = Date.now();
      workflow.duration = workflow.endTime - startTime;
      this.stats.failedWorkflows++;

      return {
        workflowId: workflow.id,
        success: false,
        toolResults: results,
        duration: workflow.duration ?? 0,
        completedCalls: results.filter((r) => r.success).length,
        failedCalls: results.filter((r) => !r.success).length + 1,
        skippedCalls: workflow.toolCalls.length - results.length,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }

  /**
   * Execute workflow sequentially
   */
  private async executeSequential(
    workflow: MultiToolWorkflow,
    results: ToolCallResult[],
    previousResults: Map<string, unknown>
  ): Promise<void> {
    for (const toolCall of workflow.toolCalls) {
      // Check dependencies
      if (toolCall.dependsOn && toolCall.dependsOn.length > 0) {
        const dependencyFailed = toolCall.dependsOn.some((depId) => {
          const depResult = results.find((r) => r.callId === depId);
          return depResult && !depResult.success;
        });

        if (dependencyFailed) {
          toolCall.status = 'skipped';
          continue;
        }
      }

      // Execute tool call
      const result = await this.executeToolCall(toolCall, workflow.context, previousResults);
      results.push(result);

      if (result.success) {
        previousResults.set(toolCall.id, result.data);
      } else if (!toolCall.dependsOn || toolCall.dependsOn.length === 0) {
        // Critical call failed
        throw result.error || new Error('Tool call failed');
      }
    }
  }

  /**
   * Execute workflow in parallel
   */
  private async executeParallel(
    workflow: MultiToolWorkflow,
    results: ToolCallResult[],
    previousResults: Map<string, unknown>
  ): Promise<void> {
    // Group by dependency level
    const levels = this.groupByDependencyLevel(workflow.toolCalls);

    for (const level of levels) {
      const promises = level.map((toolCall) =>
        this.executeToolCall(toolCall, workflow.context, previousResults)
      );

      const levelResults = await Promise.all(promises);
      results.push(...levelResults);

      // Store successful results
      for (let i = 0; i < level.length; i++) {
        if (levelResults[i]!.success) {
          previousResults.set(level[i]!.id, levelResults[i]!.data);
        }
      }

      // Check for critical failures
      const criticalFailure = levelResults.find(
        (r) => !r.success && level.find((c) => c.id === r.callId)?.priority === 'critical'
      );
      if (criticalFailure) {
        throw criticalFailure.error || new Error('Critical tool call failed');
      }
    }
  }

  /**
   * Execute workflow adaptively (sequential with parallel opportunities)
   */
  private async executeAdaptive(
    workflow: MultiToolWorkflow,
    results: ToolCallResult[],
    previousResults: Map<string, unknown>
  ): Promise<void> {
    // Start with sequential, parallelize independent calls
    const remaining = [...workflow.toolCalls];

    while (remaining.length > 0) {
      // Find calls ready to execute (dependencies met)
      const ready = remaining.filter((call) => {
        if (!call.dependsOn || call.dependsOn.length === 0) return true;
        return call.dependsOn.every((depId) => previousResults.has(depId));
      });

      if (ready.length === 0) break;

      // Execute ready calls in parallel (up to max concurrent)
      const batch = ready.slice(0, this.config.maxConcurrentCalls);
      const promises = batch.map((call) =>
        this.executeToolCall(call, workflow.context, previousResults)
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // Store results and remove from remaining
      for (let i = 0; i < batch.length; i++) {
        if (batchResults[i]!.success) {
          previousResults.set(batch[i]!.id, batchResults[i]!.data);
        }
        remaining.splice(remaining.indexOf(batch[i]!), 1);
      }
    }
  }

  /**
   * Execute a single tool call with retry logic
   */
  private async executeToolCall(
    toolCall: EnhancedToolCall,
    workflowContext: ToolCallContext,
    previousResults: Map<string, unknown>
  ): Promise<ToolCallResult> {
    this.stats.totalToolCalls++;
    toolCall.status = 'in_progress';

    const executionContext: ToolExecutionContext = {
      currentCall: toolCall,
      workflowContext,
      previousResults,
      startTime: Date.now(),
      attempt: toolCall.retryCount ?? 0,
    };

    let lastError: Error | undefined;

    // Retry loop
    for (let attempt = 0; attempt <= (toolCall.maxRetries ?? 0); attempt++) {
      executionContext.attempt = attempt;

      try {
        // Apply parameter inference
        if (this.config.enableParameterInference) {
          await this.applyParameterInference(toolCall, executionContext);
        }

        // Check cache
        if (this.config.enableCaching) {
          const cached = this.getCachedResult(toolCall);
          if (cached) {
            this.log(`Cache hit for tool ${toolCall.tool}`);
            this.stats.apiCallsSaved++;
            toolCall.status = 'completed';

            return {
              callId: toolCall.id,
              success: true,
              data: cached,
              duration: 0,
              metadata: { cached: true },
            };
          }
        }

        // Execute tool (simulated for now)
        const result = await this.simulateToolExecution(toolCall, executionContext);

        // Cache result
        if (this.config.enableCaching && result.success) {
          this.cacheResult(toolCall, result.data);
        }

        toolCall.status = result.success ? 'completed' : 'failed';
        toolCall.duration = result.duration;
        toolCall.result = result.data;

        if (result.success) {
          this.stats.successfulToolCalls++;
        } else {
          this.stats.failedToolCalls++;
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        toolCall.retryCount = attempt + 1;

        if (attempt < (toolCall.maxRetries ?? 0)) {
          this.log(`Retrying tool ${toolCall.tool} (attempt ${attempt + 1})`);
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    // All retries exhausted
    toolCall.status = 'failed';
    toolCall.error = lastError;
    this.stats.failedToolCalls++;

    return {
      callId: toolCall.id,
      success: false,
      error: lastError,
      duration: Date.now() - executionContext.startTime,
    };
  }

  /**
   * Infer parameters for a tool based on context
   */
  private async inferParameters(
    tool: ToolCapability,
    context: ToolCallContext
  ): Promise<Record<string, unknown>> {
    const params: Record<string, unknown> = {};

    // Infer spreadsheetId
    if (tool.requiredParams.includes('spreadsheetId') && context.spreadsheetId) {
      params['spreadsheetId'] = context.spreadsheetId;
    }

    // Infer sheetName
    if (tool.requiredParams.includes('sheetName') && context.sheetName) {
      params['sheetName'] = context.sheetName;
    }

    // Infer range
    if (tool.requiredParams.includes('range') && context.range) {
      params['range'] = context.range;
    }

    // Use previous results if available
    if (context.previousResults) {
      for (const [key, value] of Object.entries(context.previousResults)) {
        if (tool.requiredParams.includes(key)) {
          params[key] = value;
        }
      }
    }

    return params;
  }

  /**
   * Apply parameter inference to a tool call
   */
  private async applyParameterInference(
    toolCall: EnhancedToolCall,
    executionContext: ToolExecutionContext
  ): Promise<void> {
    const tool = this.toolRegistry.get(toolCall.tool);
    if (!tool) return;

    // Infer missing required parameters
    for (const param of tool.requiredParams) {
      if (toolCall.params[param] !== undefined) continue;

      // Try to infer from context
      if (executionContext.workflowContext[param as keyof ToolCallContext]) {
        toolCall.params[param] =
          executionContext.workflowContext[param as keyof ToolCallContext];
        continue;
      }

      // Try to infer from previous results
      for (const [, result] of executionContext.previousResults) {
        if (typeof result === 'object' && result !== null && param in result) {
          toolCall.params[param] = (result as Record<string, unknown>)[param];
          break;
        }
      }
    }
  }

  /**
   * Score a tool for the given intent
   */
  private scoreToolForIntent(
    tool: ToolCapability,
    criteria: ToolSelectionCriteria
  ): number {
    let score = 0.5; // Base score

    const intentLower = criteria.intent.toLowerCase();
    const toolNameLower = tool.name.toLowerCase();
    const descLower = tool.description.toLowerCase();

    // Name match
    if (toolNameLower.includes(intentLower) || intentLower.includes(toolNameLower)) {
      score += 0.3;
    }

    // Description match
    if (descLower.includes(intentLower)) {
      score += 0.2;
    }

    // Strategy-based scoring
    switch (criteria.strategy) {
      case 'cost_optimized':
        score += (1 - tool.costEstimate / 100) * 0.3;
        break;
      case 'performance_optimized':
        score += (1 - tool.avgDuration / 10000) * 0.3;
        break;
      case 'quality_optimized':
        score += tool.successRate * 0.3;
        break;
    }

    // Preferred tools bonus
    if (criteria.preferredTools?.includes(tool.name)) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * Generate selection reasoning
   */
  private generateSelectionReasoning(
    tools: ToolCapability[],
    criteria: ToolSelectionCriteria
  ): string {
    if (tools.length === 0) {
      return 'No suitable tools found for the given intent and constraints';
    }

    const reasons: string[] = [];
    reasons.push(`Selected ${tools.length} tool(s) for intent: "${criteria.intent}"`);
    reasons.push(`Strategy: ${criteria.strategy}`);
    reasons.push(`Tools: ${tools.map((t) => t.name).join(', ')}`);

    return reasons.join('. ');
  }

  /**
   * Group tool calls by dependency level
   */
  private groupByDependencyLevel(
    toolCalls: EnhancedToolCall[]
  ): EnhancedToolCall[][] {
    const levels: EnhancedToolCall[][] = [];
    const processed = new Set<string>();

    while (processed.size < toolCalls.length) {
      const level = toolCalls.filter((call) => {
        if (processed.has(call.id)) return false;
        if (!call.dependsOn || call.dependsOn.length === 0) return true;
        return call.dependsOn.every((depId) => processed.has(depId));
      });

      if (level.length === 0) break; // Circular dependency

      levels.push(level);
      level.forEach((call) => processed.add(call.id));
    }

    return levels;
  }

  /**
   * Extract final output from results
   */
  private extractFinalOutput(results: ToolCallResult[]): unknown {
    if (results.length === 0) return null;

    // Return last successful result
    const successfulResults = results.filter((r) => r.success);
    if (successfulResults.length === 0) return null;

    return successfulResults[successfulResults.length - 1]!.data;
  }

  /**
   * Rollback workflow (simulated)
   */
  private async rollbackWorkflow(
    workflow: MultiToolWorkflow,
    _results: ToolCallResult[]
  ): Promise<void> {
    this.log(`Rolling back workflow: ${workflow.id}`);
    // TODO: Implement actual rollback logic
  }

  /**
   * Simulate tool execution
   */
  private async simulateToolExecution(
    toolCall: EnhancedToolCall,
    _context: ToolExecutionContext
  ): Promise<ToolCallResult> {
    // Simulate execution time
    const tool = this.toolRegistry.get(toolCall.tool);
    const duration = tool?.avgDuration ?? 100;

    await this.delay(Math.min(duration, 100)); // Cap simulation time

    // Simulate success/failure based on tool success rate
    const successRate = tool?.successRate ?? 0.95;
    const success = Math.random() < successRate;

    return {
      callId: toolCall.id,
      success,
      data: success ? { result: 'Simulated result', timestamp: Date.now() } : undefined,
      duration,
      error: success ? undefined : new Error('Simulated failure'),
    };
  }

  /**
   * Cache result
   */
  private cacheResult(toolCall: EnhancedToolCall, result: unknown): void {
    const key = this.getCacheKey(toolCall);
    this.resultCache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Get cached result
   */
  private getCachedResult(toolCall: EnhancedToolCall): unknown | null {
    const key = this.getCacheKey(toolCall);
    const cached = this.resultCache.get(key);

    if (!cached) return null;

    // Check TTL
    if (Date.now() - cached.timestamp > this.config.cacheTtl) {
      this.resultCache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(toolCall: EnhancedToolCall): string {
    return `${toolCall.tool}:${JSON.stringify(toolCall.params)}`;
  }

  /**
   * Update statistics
   */
  private updateStats(workflow: MultiToolWorkflow, results: ToolCallResult[]): void {
    const totalWorkflows = this.stats.totalWorkflows;
    this.stats.successRate = this.stats.successfulWorkflows / totalWorkflows;
    this.stats.toolCallSuccessRate =
      this.stats.successfulToolCalls / this.stats.totalToolCalls;
    this.stats.avgToolCallsPerWorkflow = this.stats.totalToolCalls / totalWorkflows;

    if (workflow.duration) {
      this.stats.avgWorkflowDuration =
        (this.stats.avgWorkflowDuration * (totalWorkflows - 1) + workflow.duration) /
        totalWorkflows;
    }

    const _cacheHits = results.filter((r) => r.metadata?.['cached']).length;
    const totalCalls = this.stats.totalToolCalls;
    this.stats.cacheHitRate = this.stats.apiCallsSaved / totalCalls;
  }

  /**
   * Register builtin tool chains
   */
  private registerBuiltinToolChains(): void {
    // Example: Create and populate spreadsheet
    const createAndPopulate: ToolChain = {
      id: 'create-and-populate',
      name: 'Create and Populate Spreadsheet',
      description: 'Creates a new spreadsheet and populates it with data',
      tools: ['sheets_spreadsheet:create', 'sheets_values:update'],
      parameterMappings: [
        {
          sourceTool: 'sheets_spreadsheet:create',
          sourcePath: 'spreadsheetId',
          targetTool: 'sheets_values:update',
          targetParam: 'spreadsheetId',
        },
      ],
      tags: ['spreadsheet', 'data', 'create'],
    };

    this.registerToolChain(createAndPopulate);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.verboseLogging) {
      // eslint-disable-next-line no-console
      console.log(`[ToolOrchestrator] ${message}`); // Debugging output when verboseLogging enabled
    }
  }

  /**
   * Get statistics
   */
  getStats(): OrchestratorStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalWorkflows: 0,
      successfulWorkflows: 0,
      failedWorkflows: 0,
      successRate: 0,
      totalToolCalls: 0,
      successfulToolCalls: 0,
      failedToolCalls: 0,
      toolCallSuccessRate: 0,
      avgWorkflowDuration: 0,
      avgToolCallsPerWorkflow: 0,
      apiCallsSaved: 0,
      cacheHitRate: 0,
      paramInferenceSuccessRate: 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.resultCache.clear();
  }
}

// Singleton instance
let orchestratorInstance: ToolOrchestrator | null = null;

/**
 * Get orchestrator instance
 */
export function getToolOrchestrator(config?: OrchestratorConfig): ToolOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ToolOrchestrator(config);
  }
  return orchestratorInstance;
}
