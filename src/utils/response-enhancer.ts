/**
 * Response Enhancer - Quick Win #1: Semantic Priority Suggestions
 *
 * Generates intelligent suggestions, cost estimates, and metadata
 * for tool responses to improve LLM decision-making.
 *
 * Quick Win #1 Improvements:
 * - Explicit priority ranking (HIGH, MEDIUM, LOW)
 * - Estimated impact for each suggestion
 * - Smart context-based suggestion generation
 * - Priority-based sorting
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
 * Priority order for sorting suggestions
 * Lower number = higher priority
 */
const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
} as const;

/**
 * Generate suggestions based on the tool and action
 * Quick Win #1: Enhanced with explicit priorities, impact estimates, and smart ranking
 */
export function generateSuggestions(context: EnhancementContext): ToolSuggestion[] {
  const suggestions: ToolSuggestion[] = [];
  const { tool, action, input, result, cellsAffected } = context;

  // HIGH PRIORITY: Quality issues detected
  if (result && hasQualityIssues(result)) {
    const issueCount = getQualityIssueCount(result);
    suggestions.push({
      type: 'warning',
      message: `${issueCount} quality issues detected - immediate fix recommended`,
      tool: 'sheets_quality',
      action: 'fix',
      reason: `Found ${issueCount} fixable issues (empty cells, inconsistent formats, validation errors)`,
      priority: 'high',
    });
  }

  // HIGH PRIORITY: Destructive operation without safety check
  if (['clear', 'delete', 'batch_clear', 'delete_dimension'].some((a) => action.includes(a))) {
    const safety = input['safety'] as { dryRun?: boolean } | undefined;
    if (!safety?.dryRun) {
      suggestions.push({
        type: 'warning',
        message: 'Destructive operation executed without preview - consider using dryRun next time',
        reason:
          'dryRun shows exactly what will be changed before applying, preventing accidental data loss',
        priority: 'high',
      });
    }
  }

  // HIGH PRIORITY: Large write without batching
  if (action === 'write' && cellsAffected && cellsAffected > 1000) {
    const estimatedSavings = Math.round((cellsAffected / 100) * 50); // ~50ms per 100 cells saved
    suggestions.push({
      type: 'optimization',
      message: `Large write operation (${cellsAffected} cells) - batch_write would be faster`,
      tool: tool,
      action: 'batch_write',
      reason: `Batch operations reduce API calls from ${Math.ceil(cellsAffected / 100)} to 1, saving ~${estimatedSavings}ms`,
      priority: 'high',
    });
  }

  // HIGH PRIORITY: Large change without snapshot
  if (cellsAffected && cellsAffected > 5000) {
    suggestions.push({
      type: 'warning',
      message: `Large change (${cellsAffected} cells) detected - create snapshot for easy rollback`,
      tool: 'sheets_collaborate',
      action: 'version_create_snapshot',
      reason: `Changes affecting ${cellsAffected} cells are difficult to undo manually. Snapshots enable one-click restoration.`,
      priority: 'high',
    });
  }

  // MEDIUM PRIORITY: Visualization opportunities
  if (action === 'read' && result) {
    const values = result['values'] as unknown[][] | undefined;
    if (values && values.length > 20 && hasVisualizableData(values)) {
      suggestions.push({
        type: 'follow_up',
        message: 'Data has clear patterns - visualization recommended',
        tool: 'sheets_visualize',
        action: 'suggest_chart',
        reason: `Dataset with ${values.length} rows shows numeric patterns suitable for charts`,
        priority: 'medium',
      });
    }
  }

  // MEDIUM PRIORITY: Analysis before modification
  if (['write', 'batch_write', 'clear', 'delete'].some((a) => action.includes(a))) {
    const hasAnalysis = result?.['analysis'] !== undefined;
    if (!hasAnalysis) {
      suggestions.push({
        type: 'follow_up',
        message: 'Consider analyzing data quality to understand impact',
        tool: 'sheets_analyze',
        action: 'analyze_quality',
        reason:
          'Quality analysis reveals data structure, patterns, and potential issues before modifications',
        priority: 'medium',
      });
    }
  }

  // MEDIUM PRIORITY: Batch optimization hint
  if (action === 'read' && !action.includes('batch')) {
    suggestions.push({
      type: 'optimization',
      message: 'For reading multiple ranges, use batch_read',
      tool: tool,
      action: 'batch_read',
      reason:
        'Batch operations reduce API calls by ~80% and latency by ~70% when reading multiple ranges',
      priority: 'medium',
    });
  }

  // LOW PRIORITY: Formatting after data write
  if ((action === 'write' || action === 'append' || action === 'batch_write') && cellsAffected) {
    suggestions.push({
      type: 'follow_up',
      message: 'Data written successfully - consider applying formatting',
      tool: 'sheets_format',
      action: 'apply_preset',
      reason:
        'Formatting presets (header, currency, percentage) improve readability and consistency',
      priority: 'low',
    });
  }

  // LOW PRIORITY: Analysis insights for large datasets
  if (action === 'read' && result) {
    const values = result['values'] as unknown[][] | undefined;
    if (values && values.length > 100) {
      suggestions.push({
        type: 'follow_up',
        message: `Large dataset (${values.length} rows) read - statistical analysis available`,
        tool: 'sheets_analyze',
        action: 'analyze_data',
        reason: 'Get descriptive statistics, detect outliers, and identify data quality issues',
        priority: 'low',
      });
    }
  }

  // Sort by priority (HIGH first, then MEDIUM, then LOW)
  return suggestions.sort(
    (a, b) => PRIORITY_ORDER[a.priority || 'medium'] - PRIORITY_ORDER[b.priority || 'medium']
  );
}

/**
 * Check if result contains quality issues
 */
function hasQualityIssues(result: Record<string, unknown>): boolean {
  const quality = result['quality'] as { issues?: unknown[] } | undefined;
  const issues = quality?.issues as unknown[] | undefined;
  return Array.isArray(issues) && issues.length > 0;
}

/**
 * Get count of quality issues
 */
function getQualityIssueCount(result: Record<string, unknown>): number {
  const quality = result['quality'] as { issues?: unknown[] } | undefined;
  const issues = quality?.issues as unknown[] | undefined;
  return Array.isArray(issues) ? issues.length : 0;
}

/**
 * Check if data is suitable for visualization
 */
function hasVisualizableData(values: unknown[][]): boolean {
  if (values.length < 2) return false;

  // Check if there are numeric columns
  const firstDataRow = values[1];
  if (!Array.isArray(firstDataRow)) return false;

  const hasNumbers = firstDataRow.some((cell) => typeof cell === 'number');
  return hasNumbers;
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
      'sheets_analyze:analyze_quality',
      'sheets_analyze:analyze_data',
    ],
    'sheets_data:write': [
      'sheets_format:apply_preset',
      'sheets_data:batch_write',
      'sheets_collaborate:version_create_snapshot',
    ],
    'sheets_data:append': ['sheets_format:apply_preset', 'sheets_data:batch_write'],
    'sheets_data:clear': [
      'sheets_collaborate:version_create_snapshot',
      'sheets_collaborate:version_restore_revision',
    ],
    'sheets_data:batch_read': ['sheets_analyze:analyze_data', 'sheets_data:read'],
    'sheets_data:batch_write': [
      'sheets_format:set_format',
      'sheets_collaborate:version_create_snapshot',
    ],
    'sheets_analyze:analyze_quality': ['sheets_analyze:analyze_data', 'sheets_data:read'],
    'sheets_analyze:analyze_data': ['sheets_visualize:chart_create', 'sheets_data:read'],
    'sheets_format:apply_preset': ['sheets_format:set_format', 'sheets_data:write'],
    'sheets_core:add_sheet': ['sheets_core:list_sheets', 'sheets_data:write'],
    'sheets_core:create': ['sheets_collaborate:share_add', 'sheets_core:add_sheet'],
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
      steps.push('Analyze data with sheets_analyze:analyze_data for statistical insights');
      steps.push('Format the range with sheets_format:apply_preset for better readability');
    }
  }

  if (tool === 'sheets_data' && (action === 'write' || action === 'append')) {
    steps.push('Verify the data was written correctly by reading the range back');
    steps.push('Apply formatting to improve visual presentation');
    steps.push('Create a snapshot to enable easy rollback if needed');
  }

  if (tool === 'sheets_core' && action === 'create') {
    steps.push('Add sheets with sheets_core:add_sheet');
    steps.push('Share the spreadsheet with sheets_collaborate:share_add');
    steps.push('Start adding data with sheets_data:write');
  }

  if (tool === 'sheets_analyze' && action === 'analyze_data') {
    steps.push('Create charts to visualize the data patterns');
    steps.push('Use insights to clean or transform the data');
  }

  return steps;
}
