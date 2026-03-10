/**
 * Action Recommender Service
 *
 * Provides intelligent suggestions for next actions based on what the user just did.
 * After a successful tool call, this service recommends what to do next based on
 * pattern matching against the tool and action that just completed.
 *
 * Used to make ServalSheets more proactive and assist the Claude LLM in
 * discovering powerful chaining patterns.
 */

export interface SuggestedAction {
  tool: string;
  action: string;
  reason: string;
}

const RECOMMENDATION_RULES: Record<string, SuggestedAction[]> = {
  // After reading data
  'sheets_data.read': [
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Analyze patterns in the data you just read',
    },
    {
      tool: 'sheets_visualize',
      action: 'suggest_chart',
      reason: 'Visualize this data with a chart',
    },
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-fit column widths to content',
    },
  ],
  'sheets_data.batch_read': [
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Analyze patterns across multiple ranges',
    },
    {
      tool: 'sheets_data',
      action: 'cross_compare',
      reason: 'Compare the ranges you just read',
    },
  ],

  // After writing data
  'sheets_data.write': [
    {
      tool: 'sheets_format',
      action: 'set_format',
      reason: 'Format the cells you just wrote',
    },
    {
      tool: 'sheets_dimensions',
      action: 'freeze',
      reason: 'Freeze header row if you wrote headers',
    },
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-fit columns to new content',
    },
  ],
  'sheets_data.append': [
    {
      tool: 'sheets_format',
      action: 'set_format',
      reason: 'Format the appended rows',
    },
    {
      tool: 'sheets_quality',
      action: 'validate',
      reason: 'Validate the data you just appended',
    },
  ],

  // After importing
  'sheets_composite.import_csv': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean imported data (trim, normalize formats)',
    },
    {
      tool: 'sheets_fix',
      action: 'detect_anomalies',
      reason: 'Check for outliers in imported data',
    },
    {
      tool: 'sheets_format',
      action: 'apply_preset',
      reason: 'Apply professional formatting to imported data',
    },
  ],
  'sheets_composite.import_xlsx': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean imported data',
    },
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Understand the imported sheet structure',
    },
  ],

  // After creating a chart
  'sheets_visualize.chart_create': [
    {
      tool: 'sheets_visualize',
      action: 'chart_update',
      reason: 'Refine chart title, colors, or legend',
    },
    {
      tool: 'sheets_format',
      action: 'set_format',
      reason: 'Format the data range behind the chart',
    },
    {
      tool: 'sheets_composite',
      action: 'export_xlsx',
      reason: 'Export spreadsheet with chart',
    },
  ],

  // After generating a sheet
  'sheets_composite.generate_sheet': [
    {
      tool: 'sheets_format',
      action: 'batch_format',
      reason: 'Add professional formatting',
    },
    {
      tool: 'sheets_format',
      action: 'add_conditional_format_rule',
      reason: 'Add conditional formatting rules',
    },
    {
      tool: 'sheets_collaborate',
      action: 'share_add',
      reason: 'Share the generated spreadsheet',
    },
  ],

  // After cleaning data
  'sheets_fix.clean': [
    {
      tool: 'sheets_fix',
      action: 'suggest_cleaning',
      reason: 'Check for additional cleaning opportunities',
    },
    {
      tool: 'sheets_fix',
      action: 'detect_anomalies',
      reason: 'Detect statistical outliers',
    },
    {
      tool: 'sheets_format',
      action: 'set_number_format',
      reason: 'Standardize number formats',
    },
  ],

  // After sharing
  'sheets_collaborate.share_add': [
    {
      tool: 'sheets_collaborate',
      action: 'comment_add',
      reason: 'Add a comment explaining the share',
    },
    {
      tool: 'sheets_collaborate',
      action: 'share_set_link',
      reason: 'Configure link sharing settings',
    },
  ],

  // After analysis
  'sheets_analyze.scout': [
    {
      tool: 'sheets_analyze',
      action: 'suggest_next_actions',
      reason: 'Get AI-powered improvement suggestions',
    },
    {
      tool: 'sheets_analyze',
      action: 'comprehensive',
      reason: 'Run deep analysis on the sheet',
    },
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Detect data patterns',
    },
  ],
  'sheets_analyze.comprehensive': [
    {
      tool: 'sheets_analyze',
      action: 'suggest_next_actions',
      reason: 'Get actionable suggestions from analysis',
    },
    {
      tool: 'sheets_analyze',
      action: 'generate_actions',
      reason: 'Generate executable improvement actions',
    },
  ],

  // After formatting
  'sheets_format.batch_format': [
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-fit columns after formatting',
    },
    {
      tool: 'sheets_dimensions',
      action: 'freeze',
      reason: 'Freeze header row',
    },
  ],

  // After creating a spreadsheet
  'sheets_core.create': [
    {
      tool: 'sheets_core',
      action: 'add_sheet',
      reason: 'Add additional sheets/tabs',
    },
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Write data to the new spreadsheet',
    },
    {
      tool: 'sheets_session',
      action: 'set_active',
      reason: 'Set as active spreadsheet for subsequent calls',
    },
  ],

  // After cross-sheet operations
  'sheets_data.cross_read': [
    {
      tool: 'sheets_data',
      action: 'cross_compare',
      reason: 'Compare data across spreadsheets',
    },
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Analyze patterns in cross-sheet data',
    },
  ],

  // After template operations
  'sheets_templates.apply': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Fill template with your data',
    },
    {
      tool: 'sheets_format',
      action: 'batch_format',
      reason: 'Customize template formatting',
    },
  ],

  // After quality checks
  'sheets_quality.validate': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Fix data quality issues found',
    },
    {
      tool: 'sheets_quality',
      action: 'detect_conflicts',
      reason: 'Detect concurrent modification conflicts',
    },
  ],

  // After sorting
  'sheets_dimensions.sort_range': [
    {
      tool: 'sheets_format',
      action: 'apply_preset',
      reason: 'Apply formatting to sorted data',
    },
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Analyze patterns in sorted data',
    },
  ],
};

/**
 * Get recommended next actions based on a tool and action that just completed.
 *
 * @param toolName - The tool that just executed (e.g., 'sheets_data')
 * @param action - The action that just executed (e.g., 'read')
 * @returns Array of SuggestedAction objects (0-3 items), ordered by relevance
 */
export function getRecommendedActions(toolName: string, action: string): SuggestedAction[] {
  const key = `${toolName}.${action}`;
  return RECOMMENDATION_RULES[key] || [];
}
