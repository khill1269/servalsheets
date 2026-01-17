/**
 * Response Enhancer - Quick Win #1
 *
 * Generates intelligent suggestions, cost estimates, and metadata
 * for tool responses to improve LLM decision-making.
 */

import type { ToolSuggestion, CostEstimate, ResponseMeta } from '../schemas/shared.js';

/**
 * Context for generating response enhancements
 */
export interface EnhancementContext {
  tool: string;
  action: string;
  input: Record<string, unknown>;
  result?: Record<string, unknown>;
  cellsAffected?: number;
  apiCallsMade?: number;
  duration?: number;
}

/**
 * Generate suggestions based on the tool and action
 */
export function generateSuggestions(context: EnhancementContext): ToolSuggestion[] {
  const suggestions: ToolSuggestion[] = [];
  const { tool, action, input, result, cellsAffected } = context;

  // Suggest batch operations for repeated single operations
  if (action === 'read' && !action.includes('batch')) {
    suggestions.push({
      type: 'optimization',
      message: 'For multiple reads, use batch_read to reduce API calls',
      tool: tool,
      action: 'batch_read',
      reason: 'Batch operations are ~80% faster and use fewer API calls',
      priority: 'medium',
    });
  }

  if (action === 'write' && cellsAffected && cellsAffected > 1000) {
    suggestions.push({
      type: 'optimization',
      message: 'Large write detected. Consider using batch_write for better performance',
      tool: tool,
      action: 'batch_write',
      reason: `Writing ${cellsAffected} cells can be optimized with batch operations`,
      priority: 'high',
    });
  }

  // Suggest analysis before modification
  if (['write', 'batch_write', 'clear', 'delete'].some((a) => action.includes(a))) {
    const mutation = result?.['mutation'] as { diff?: unknown } | undefined;
    if (!mutation?.diff) {
      suggestions.push({
        type: 'warning',
        message: 'Consider using analysis tools before modifying data',
        tool: 'sheets_analysis',
        action: 'data_quality',
        reason: 'Prevents accidental data corruption by understanding structure first',
        priority: 'medium',
      });
    }
  }

  // Suggest related formatting after writing data
  if (action === 'write' || action === 'append' || action === 'batch_write') {
    suggestions.push({
      type: 'follow_up',
      message: 'Data written successfully. Consider formatting the range',
      tool: 'sheets_format',
      action: 'apply_preset',
      reason: 'Formatting improves readability and data consistency',
      priority: 'low',
    });
  }

  // Suggest using dryRun for destructive operations
  if (['clear', 'delete', 'batch_clear'].some((a) => action.includes(a))) {
    const safety = input['safety'] as { dryRun?: boolean } | undefined;
    if (!safety?.dryRun) {
      suggestions.push({
        type: 'warning',
        message: 'Destructive operation executed. Consider using dryRun first',
        reason: 'Preview changes before applying them to avoid accidental data loss',
        priority: 'high',
      });
    }
  }

  // Suggest snapshot for large changes
  if (cellsAffected && cellsAffected > 5000) {
    suggestions.push({
      type: 'follow_up',
      message: 'Large change detected. Create a snapshot for easy rollback',
      tool: 'sheets_versions',
      action: 'create_snapshot',
      reason: 'Snapshots allow reverting large changes if needed',
      priority: 'medium',
    });
  }

  // Suggest analysis after reading large datasets
  if (action === 'read' && result) {
    const values = result['values'] as unknown[][] | undefined;
    if (values && values.length > 100) {
      suggestions.push({
        type: 'follow_up',
        message: 'Large dataset read. Consider using analysis tools for insights',
        tool: 'sheets_analysis',
        action: 'statistics',
        reason: 'Get statistical insights, detect patterns, and validate data quality',
        priority: 'low',
      });
    }
  }

  return suggestions;
}

/**
 * Estimate cost of an operation
 */
export function estimateCost(context: EnhancementContext): CostEstimate {
  const { action, input, cellsAffected = 0, apiCallsMade = 1, duration } = context;

  // Base estimates
  let apiCalls = apiCallsMade;
  let estimatedLatencyMs = duration || 500; // Default 500ms if not measured

  // Adjust estimates based on operation type
  if (action.includes('batch')) {
    // Batch operations scale with number of ranges
    const ranges = (input['ranges'] as unknown[] | undefined)?.length || 1;
    apiCalls = Math.ceil(ranges / 100); // Google batches 100 requests
    estimatedLatencyMs = ranges * 50; // ~50ms per range in batch
  } else if (action === 'read' || action === 'write') {
    // Single operations are straightforward
    apiCalls = 1;
    estimatedLatencyMs = cellsAffected > 1000 ? 1000 : 500;
  } else if (action.includes('analysis') || action.includes('profile')) {
    // Analysis requires multiple reads
    apiCalls = 2;
    estimatedLatencyMs = cellsAffected * 0.5; // ~0.5ms per cell
  }

  // Quota tracking (simplified - would be real in production)
  const quotaLimit = 60; // 60 requests per minute per user
  const currentQuota = 0; // Would track this in a real rate limiter

  return {
    apiCalls,
    estimatedLatencyMs: Math.round(estimatedLatencyMs),
    cellsAffected: cellsAffected > 0 ? cellsAffected : undefined,
    quotaImpact: {
      current: currentQuota,
      limit: quotaLimit,
      remaining: quotaLimit - currentQuota - apiCalls,
    },
  };
}

/**
 * Get related tools for a given tool and action
 */
export function getRelatedTools(tool: string, action: string): string[] {
  const relatedMap: Record<string, string[]> = {
    'sheets_data:read': [
      'sheets_data:batch_read',
      'sheets_analysis:data_quality',
      'sheets_analysis:statistics',
    ],
    'sheets_data:write': [
      'sheets_format:apply_preset',
      'sheets_data:batch_write',
      'sheets_versions:create_snapshot',
    ],
    'sheets_data:append': ['sheets_format:apply_preset', 'sheets_data:batch_write'],
    'sheets_data:clear': ['sheets_versions:create_snapshot', 'sheets_versions:restore_revision'],
    'sheets_data:batch_read': ['sheets_analysis:statistics', 'sheets_data:read'],
    'sheets_data:batch_write': ['sheets_format:set_format', 'sheets_versions:create_snapshot'],
    'sheets_analysis:data_quality': ['sheets_analysis:statistics', 'sheets_data:read'],
    'sheets_analysis:statistics': ['sheets_visualize:create', 'sheets_data:read'],
    'sheets_format:apply_preset': ['sheets_format:set_format', 'sheets_data:write'],
    'sheets_core:add': ['sheets_core:list', 'sheets_data:write'],
    'sheets_core:create': ['sheets_sharing:share', 'sheets_core:add'],
  };

  const key = `${tool}:${action}`;
  return relatedMap[key] || [];
}

/**
 * Generate complete response metadata
 */
export function enhanceResponse(context: EnhancementContext): ResponseMeta {
  const suggestions = generateSuggestions(context);
  const costEstimate = estimateCost(context);
  const relatedTools = getRelatedTools(context.tool, context.action);

  const meta: ResponseMeta = {
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    costEstimate,
    relatedTools: relatedTools.length > 0 ? relatedTools : undefined,
  };

  // Add next steps for common workflows
  const nextSteps = generateNextSteps(context);
  if (nextSteps.length > 0) {
    meta.nextSteps = nextSteps;
  }

  return meta;
}

/**
 * Generate contextual next steps
 */
function generateNextSteps(context: EnhancementContext): string[] {
  const { tool, action, result } = context;
  const steps: string[] = [];

  if (tool === 'sheets_data' && action === 'read') {
    const values = result?.['values'];
    if (values) {
      steps.push('Analyze data with sheets_analysis:statistics for statistical insights');
      steps.push('Format the range with sheets_format:apply_preset for better readability');
    }
  }

  if (tool === 'sheets_data' && (action === 'write' || action === 'append')) {
    steps.push('Verify the data was written correctly by reading the range back');
    steps.push('Apply formatting to improve visual presentation');
    steps.push('Create a snapshot to enable easy rollback if needed');
  }

  if (tool === 'sheets_core' && action === 'create') {
    steps.push('Add sheets with sheets_sheet:add');
    steps.push('Share the spreadsheet with sheets_sharing:share');
    steps.push('Start adding data with sheets_data:write');
  }

  if (tool === 'sheets_analysis' && action === 'statistics') {
    steps.push('Create charts to visualize the data patterns');
    steps.push('Use insights to clean or transform the data');
  }

  return steps;
}
