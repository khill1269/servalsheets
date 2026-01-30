/**
 * Protocol Tracer - Capture full MCP protocol messages and track feature usage
 * Provides deep observability into MCP protocol interactions
 */

export interface MCPMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export interface MCPFeatures {
  usedElicitation: boolean;
  usedTasks: boolean;
  usedLogging: boolean;
  usedResources: boolean;
  resourcesAccessed: string[];
  completionsRequested: number;
  tasksCreated: number;
  logsReceived: number;
  samplingRequests: number;
  promptsShown: number;
}

export interface ProtocolTrace {
  requestId: string;
  tool: string;
  action: string;

  // Full protocol messages
  request: MCPMessage;
  response: MCPMessage;

  // Feature detection
  features: MCPFeatures;

  // Performance
  performance: {
    clientLatency: number;
    serverProcessing: number;
    totalDuration: number;
  };

  // Metadata
  timestamp: string;
  protocolVersion: string;
}

export class ProtocolTracer {
  private traces = new Map<string, ProtocolTrace>();
  private startTimes = new Map<string, number>();

  /**
   * Start tracing a request
   */
  startTrace(requestId: string, tool: string, action: string, request: MCPMessage): void {
    this.startTimes.set(requestId, Date.now());

    this.traces.set(requestId, {
      requestId,
      tool,
      action,
      request,
      response: {} as MCPMessage,
      features: {
        usedElicitation: false,
        usedTasks: false,
        usedLogging: false,
        usedResources: false,
        resourcesAccessed: [],
        completionsRequested: 0,
        tasksCreated: 0,
        logsReceived: 0,
        samplingRequests: 0,
        promptsShown: 0,
      },
      performance: {
        clientLatency: 0,
        serverProcessing: 0,
        totalDuration: 0,
      },
      timestamp: new Date().toISOString(),
      protocolVersion: request.jsonrpc || '2.0',
    });
  }

  /**
   * Complete trace with response
   */
  completeTrace(requestId: string, response: MCPMessage): void {
    const trace = this.traces.get(requestId);
    if (!trace) return;

    const startTime = this.startTimes.get(requestId);
    if (startTime) {
      trace.performance.totalDuration = Date.now() - startTime;
    }

    trace.response = response;

    // Analyze response for feature usage
    this.detectFeatures(trace, response);
  }

  /**
   * Detect MCP features used in response
   */
  private detectFeatures(trace: ProtocolTrace, response: MCPMessage): void {
    const features = trace.features;

    // Check for sampling/elicitation
    if (response.result?.meta?.sampling || response.result?.sampling) {
      features.usedElicitation = true;
      features.samplingRequests++;
    }

    // Check for prompts (elicitation)
    if (response.result?.meta?.prompt || response.result?.prompt) {
      features.usedElicitation = true;
      features.promptsShown++;
    }

    // Check for task creation
    if (response.result?.task || response.result?.taskId) {
      features.usedTasks = true;
      features.tasksCreated++;
    }

    // Check for logging
    if (response.result?.logs || Array.isArray(response.result?.content)) {
      const content = response.result.content;
      if (content) {
        for (const item of content) {
          if (item.type === 'log' || item.type === 'logging') {
            features.usedLogging = true;
            features.logsReceived++;
          }
        }
      }
    }

    // Check for resource access
    if (response.result?.resources) {
      features.usedResources = true;
      const resources = response.result.resources;
      if (Array.isArray(resources)) {
        for (const resource of resources) {
          if (resource.uri) {
            features.resourcesAccessed.push(resource.uri);
          }
        }
      }
    }

    // Check response content for resource references
    if (response.result?.content) {
      const content = JSON.stringify(response.result.content);
      const resourcePattern =
        /(?:history|cache|metrics|transaction|conflict|impact|validation|confirm|analyze|knowledge|chart|pivot|quality):\/\/\S+/g;
      const matches = content.match(resourcePattern);
      if (matches) {
        features.usedResources = true;
        features.resourcesAccessed.push(...matches);
      }
    }
  }

  /**
   * Get trace by request ID
   */
  getTrace(requestId: string): ProtocolTrace | undefined {
    return this.traces.get(requestId);
  }

  /**
   * Get all traces
   */
  getAllTraces(): ProtocolTrace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get feature usage summary
   */
  getFeatureSummary(): {
    totalTraces: number;
    toolsUsingElicitation: Set<string>;
    toolsUsingTasks: Set<string>;
    toolsUsingLogging: Set<string>;
    toolsAccessingResources: Set<string>;
    totalSamplingRequests: number;
    totalTasksCreated: number;
    totalLogsReceived: number;
    uniqueResourcesAccessed: Set<string>;
  } {
    const toolsUsingElicitation = new Set<string>();
    const toolsUsingTasks = new Set<string>();
    const toolsUsingLogging = new Set<string>();
    const toolsAccessingResources = new Set<string>();
    const uniqueResourcesAccessed = new Set<string>();

    let totalSamplingRequests = 0;
    let totalTasksCreated = 0;
    let totalLogsReceived = 0;

    for (const trace of this.traces.values()) {
      const { tool, features } = trace;

      if (features.usedElicitation) {
        toolsUsingElicitation.add(tool);
        totalSamplingRequests += features.samplingRequests;
      }

      if (features.usedTasks) {
        toolsUsingTasks.add(tool);
        totalTasksCreated += features.tasksCreated;
      }

      if (features.usedLogging) {
        toolsUsingLogging.add(tool);
        totalLogsReceived += features.logsReceived;
      }

      if (features.usedResources) {
        toolsAccessingResources.add(tool);
        features.resourcesAccessed.forEach((r) => uniqueResourcesAccessed.add(r));
      }
    }

    return {
      totalTraces: this.traces.size,
      toolsUsingElicitation,
      toolsUsingTasks,
      toolsUsingLogging,
      toolsAccessingResources,
      totalSamplingRequests,
      totalTasksCreated,
      totalLogsReceived,
      uniqueResourcesAccessed,
    };
  }

  /**
   * Generate feature usage matrix
   */
  generateFeatureMatrix(): Array<{
    tool: string;
    action: string;
    elicitation: boolean;
    tasks: boolean;
    logging: boolean;
    resources: number;
    samplingRequests: number;
  }> {
    const matrix: Array<any> = [];

    for (const trace of this.traces.values()) {
      matrix.push({
        tool: trace.tool,
        action: trace.action,
        elicitation: trace.features.usedElicitation,
        tasks: trace.features.usedTasks,
        logging: trace.features.usedLogging,
        resources: trace.features.resourcesAccessed.length,
        samplingRequests: trace.features.samplingRequests,
      });
    }

    return matrix;
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces.clear();
    this.startTimes.clear();
  }
}
