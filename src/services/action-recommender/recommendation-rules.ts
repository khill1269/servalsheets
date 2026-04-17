import { logger } from '../../utils/logger.js';

export interface SuggestedAction {
  tool: string;
  action: string;
  params?: Record<string, unknown>;
  reason?: string;
  confidence?: number;
  priority?: number;
}

/**
 * Map from "tool.action" trigger key to suggested follow-up actions.
 */
export const RECOMMENDATION_RULES: Record<string, SuggestedAction[]> = {
  'sheets_data.read': [
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Detect patterns in data just read',
      confidence: 0.8,
      priority: 1,
    },
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Analyze data just read',
      confidence: 0.7,
      priority: 2,
    },
  ],
  'sheets_fix.suggest_cleaning': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Apply suggested cleaning',
      confidence: 0.9,
      priority: 1,
    },
  ],
  'sheets_analyze.scout': [
    {
      tool: 'sheets_analyze',
      action: 'comprehensive',
      reason: 'Deep analysis after quick scan',
      confidence: 0.6,
      priority: 3,
    },
  ],
  'sheets_data.write': [
    {
      tool: 'sheets_format',
      action: 'suggest_format',
      reason: 'Apply formatting after writing data',
      confidence: 0.7,
      priority: 2,
    },
    {
      tool: 'sheets_session',
      action: 'record_operation',
      reason: 'Track mutation for undo support',
      confidence: 0.95,
      priority: 1,
    },
  ],
  'sheets_composite.import_csv': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean imported CSV data',
      confidence: 0.85,
      priority: 1,
    },
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Analyze imported data structure',
      confidence: 0.7,
      priority: 2,
    },
  ],
  'sheets_visualize.chart_create': [
    {
      tool: 'sheets_visualize',
      action: 'chart_update',
      reason: 'Refine chart settings after creation',
      confidence: 0.75,
      priority: 1,
    },
  ],
  'sheets_data.append': [
    {
      tool: 'sheets_quality',
      action: 'validate',
      reason: 'Validate data quality after append',
      confidence: 0.8,
      priority: 1,
    },
  ],
  'sheets_data.cross_write': [
    {
      tool: 'sheets_data',
      action: 'cross_read',
      reason: 'Verify data before cross-spreadsheet write',
      confidence: 0.9,
      priority: 1,
    },
    {
      tool: 'sheets_data',
      action: 'cross_compare',
      reason: 'Compare source and destination after write',
      confidence: 0.8,
      priority: 2,
    },
  ],
  'sheets_data.cross_query': [
    {
      tool: 'sheets_data',
      action: 'cross_read',
      reason: 'Read raw data for cross-spreadsheet query',
      confidence: 0.85,
      priority: 1,
    },
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Understand structure before querying',
      confidence: 0.7,
      priority: 2,
    },
  ],
  'sheets_analyze.quick_insights': [
    {
      tool: 'sheets_analyze',
      action: 'comprehensive',
      reason: 'Get deeper analysis beyond quick insights',
      confidence: 0.75,
      priority: 1,
    },
    {
      tool: 'sheets_fix',
      action: 'suggest_cleaning',
      reason: 'Review cleaning suggestions from insights',
      confidence: 0.7,
      priority: 2,
    },
  ],
  'sheets_analyze.auto_enhance': [
    {
      tool: 'sheets_analyze',
      action: 'suggest_next_actions',
      reason: 'Get next action suggestions after enhancement',
      confidence: 0.8,
      priority: 1,
    },
    {
      tool: 'sheets_visualize',
      action: 'suggest_chart',
      reason: 'Suggest visualization after enhancement',
      confidence: 0.75,
      priority: 2,
    },
  ],
  'sheets_federation.call_remote': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Store results from remote call',
      confidence: 0.85,
      priority: 1,
    },
    {
      tool: 'sheets_session',
      action: 'get_context',
      reason: 'Get context for federation workflow',
      confidence: 0.7,
      priority: 2,
    },
  ],
};

export interface WorkflowChain {
  trigger: string;
  workflow: string;
  steps: SuggestedAction[];
}

/**
 * Array of workflow chains: each entry maps a trigger action to a sequence of steps.
 */
export const WORKFLOW_CHAINS: WorkflowChain[] = [
  {
    trigger: 'sheets_analyze.comprehensive',
    workflow: 'Analyze & Clean',
    steps: [
      {
        tool: 'sheets_fix',
        action: 'suggest_cleaning',
        reason: 'Review cleaning suggestions after comprehensive analysis',
        confidence: 0.8,
        priority: 1,
      },
      {
        tool: 'sheets_analyze',
        action: 'quick_insights',
        reason: 'Get quick insights summary',
        confidence: 0.7,
        priority: 2,
      },
    ],
  },
  {
    trigger: 'sheets_data.write',
    workflow: 'Write & Track',
    steps: [
      {
        tool: 'sheets_session',
        action: 'record_operation',
        reason: 'Track mutation for undo support',
        confidence: 0.95,
        priority: 1,
      },
    ],
  },
  {
    trigger: 'sheets_fix.clean',
    workflow: 'Clean & Validate',
    steps: [
      {
        tool: 'sheets_quality',
        action: 'validate',
        reason: 'Validate data quality after cleaning',
        confidence: 0.85,
        priority: 1,
      },
    ],
  },
];

/**
 * Set of tool.action keys where the recommendation carries a range parameter
 * that should be propagated from the triggering context.
 */
export const RANGE_CARRYING_ACTIONS = new Set<string>([
  'sheets_data.read',
  'sheets_data.write',
  'sheets_data.append',
  'sheets_format.set_format',
  'sheets_format.set_borders',
  'sheets_format.set_background',
  'sheets_dimensions.insert_rows',
  'sheets_dimensions.insert_columns',
  'sheets_dimensions.delete_rows',
  'sheets_dimensions.delete_columns',
  'sheets_fix.clean',
  'sheets_fix.suggest_cleaning',
  'sheets_analyze.scout',
  'sheets_analyze.comprehensive',
  'sheets_quality.validate',
]);

/**
 * Error recovery suggestions by error code.
 */
export const ERROR_RECOVERY_RULES: Record<string, SuggestedAction[]> = {
  SHEET_NOT_FOUND: [
    {
      tool: 'sheets_core',
      action: 'list_sheets',
      reason: 'Sheet not found — list available sheets to find the correct name',
    },
  ],
  SPREADSHEET_NOT_FOUND: [
    {
      tool: 'sheets_core',
      action: 'list',
      reason: 'Spreadsheet not found — list accessible spreadsheets to find the correct ID',
    },
  ],
  INVALID_RANGE: [
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Invalid range — scout the sheet to discover actual dimensions',
    },
  ],
  QUOTA_EXCEEDED: [
    {
      tool: 'sheets_transaction',
      action: 'begin',
      reason: 'Quota exceeded — batch remaining operations into a transaction',
    },
  ],
  UNAUTHENTICATED: [
    { tool: 'sheets_auth', action: 'status', reason: 'Authentication expired — check auth status' },
  ],
  AUTH_EXPIRED: [
    { tool: 'sheets_auth', action: 'login', reason: 'Credentials expired — re-authenticate' },
  ],
  PERMISSION_DENIED: [
    {
      tool: 'sheets_collaborate',
      action: 'share_list',
      reason: 'Permission denied — check sharing permissions',
    },
  ],
};

export interface RecommendationRule {
  id: string;
  name: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trigger: (context: any) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommendation: (context: any) => string;
  action?: {
    tool: string;
    action: string;
  };
}

/**
 * Action Recommendation Rules
 *
 * Rules for suggesting next actions based on sheet context and user patterns.
 */

export class ActionRecommender {
  private rules: RecommendationRule[] = [
    {
      id: 'add_summary_row',
      name: 'Add Summary Row',
      description: 'Data rows detected without totals',
      trigger: (ctx) => ctx.hasNumericData && !ctx.hasSummaryRow,
      recommendation: (ctx) => `Add SUM formulas to row ${ctx.lastDataRow + 2}`,
      action: {
        tool: 'sheets_data',
        action: 'write',
      },
    },
    {
      id: 'freeze_header',
      name: 'Freeze Header Row',
      description: 'Improve readability by freezing column headers',
      trigger: (ctx) => !ctx.headersFrozen && ctx.hasHeaders,
      recommendation: () => 'Freeze the header row for easier scrolling',
      action: {
        tool: 'sheets_dimensions',
        action: 'freeze',
      },
    },
    {
      id: 'add_formatting',
      name: 'Add Professional Formatting',
      description: 'Apply formatting to improve readability',
      trigger: (ctx) => ctx.dataRows > 10 && !ctx.hasFormatting,
      recommendation: () => 'Apply header formatting and alternating row colors',
      action: {
        tool: 'sheets_format',
        action: 'apply_preset',
      },
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommendActions(context: any): RecommendationRule[] {
    return this.rules.filter((rule) => {
      try {
        return rule.trigger(context);
      } catch (error) {
        logger.error(`Rule ${rule.id} trigger failed`, { error });
        return false;
      }
    });
  }
}
