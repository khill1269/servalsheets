/**
 * Action Recommender — Data Constants
 *
 * Pure data constants for recommendation rules, error recovery, and workflow chains.
 */

export interface SuggestedAction {
  tool: string;
  action: string;
  reason: string;
  params?: Record<string, unknown>;
}

export const RECOMMENDATION_RULES: Record<string, SuggestedAction[]> = {
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
    {
      tool: 'sheets_dimensions',
      action: 'set_basic_filter',
      reason: 'Add a filter for interactive sorting and filtering',
    },
    {
      tool: 'sheets_dimensions',
      action: 'create_filter_view',
      reason: 'Create a named filter view to save this sort configuration',
    },
  ],

  // After cross-sheet write
  'sheets_data.cross_write': [
    {
      tool: 'sheets_data',
      action: 'cross_read',
      reason: 'Verify data written to destination spreadsheet',
    },
    {
      tool: 'sheets_data',
      action: 'cross_compare',
      reason: 'Compare source and destination to confirm accuracy',
    },
  ],

  // After cross-sheet query
  'sheets_data.cross_query': [
    {
      tool: 'sheets_data',
      action: 'cross_read',
      reason: 'Fetch raw data from source spreadsheets for deeper analysis',
    },
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Explore the structure of queried spreadsheets',
    },
  ],

  // After quick insights
  'sheets_analyze.quick_insights': [
    {
      tool: 'sheets_analyze',
      action: 'comprehensive',
      reason: 'Run a full analysis to go beyond the quick structural snapshot',
    },
    {
      tool: 'sheets_fix',
      action: 'suggest_cleaning',
      reason: 'Get AI-powered cleaning recommendations for any issues found',
    },
  ],

  // After auto_enhance
  'sheets_analyze.auto_enhance': [
    {
      tool: 'sheets_analyze',
      action: 'suggest_next_actions',
      reason: 'Get further ranked suggestions after applying enhancements',
    },
    {
      tool: 'sheets_visualize',
      action: 'suggest_chart',
      reason: 'Visualize the enhanced data with a recommended chart',
    },
  ],

  // After federation remote call
  'sheets_federation.call_remote': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Store remote results in the active spreadsheet',
    },
    {
      tool: 'sheets_session',
      action: 'get_context',
      reason: 'Review session context updated by the remote operation',
    },
  ],

  // After freezing rows/columns
  'sheets_dimensions.freeze': [
    {
      tool: 'sheets_format',
      action: 'apply_preset',
      reason: 'Format the header row with a professional style',
    },
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-resize columns for readability',
    },
  ],

  // After adding a new sheet
  'sheets_core.add_sheet': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Write column headers to the new sheet',
    },
    {
      tool: 'sheets_dimensions',
      action: 'freeze',
      reason: 'Freeze the header row on the new sheet',
    },
    {
      tool: 'sheets_core',
      action: 'update_sheet',
      reason: 'Set a tab color to organize sheets visually',
    },
  ],

  // After adding a named range
  'sheets_advanced.add_named_range': [
    {
      tool: 'sheets_analyze',
      action: 'generate_formula',
      reason: 'Use the named range in a formula via generate_formula',
    },
    {
      tool: 'sheets_advanced',
      action: 'add_protected_range',
      reason: 'Protect the named range to prevent accidental edits',
    },
  ],

  // After comparing revisions (closest to restore_cells intent)
  'sheets_history.diff_revisions': [
    {
      tool: 'sheets_data',
      action: 'read',
      reason: 'Read the current values to verify against the diff',
    },
    {
      tool: 'sheets_collaborate',
      action: 'comment_add',
      reason: 'Document the revision finding with a comment',
    },
  ],

  // After modeling a scenario
  'sheets_dependencies.model_scenario': [
    {
      tool: 'sheets_dependencies',
      action: 'create_scenario_sheet',
      reason: 'Materialize the scenario as a separate sheet for comparison',
    },
    {
      tool: 'sheets_dependencies',
      action: 'compare_scenarios',
      reason: 'Compare this scenario against another set of changes',
    },
  ],

  // After importing from BigQuery
  'sheets_bigquery.import_from_bigquery': [
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Scout the imported data structure and column types',
    },
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean and standardize the imported data',
    },
  ],

  // After running an Apps Script
  'sheets_appsscript.run': [
    {
      tool: 'sheets_data',
      action: 'read',
      reason: 'Verify the script results by reading the affected range',
    },
    {
      tool: 'sheets_appsscript',
      action: 'update_content',
      reason:
        'If you need recurring automation, edit the script to manage ScriptApp triggers in code',
    },
  ],

  // After committing a transaction
  'sheets_transaction.commit': [
    {
      tool: 'sheets_data',
      action: 'read',
      reason: 'Verify the committed changes look correct',
    },
    {
      tool: 'sheets_history',
      action: 'undo',
      reason: 'Undo the transaction if the results are unexpected',
    },
  ],

  // After running a forecast
  'sheets_compute.forecast': [
    {
      tool: 'sheets_visualize',
      action: 'chart_create',
      reason: 'Visualize the forecast results with a chart',
    },
    {
      tool: 'sheets_composite',
      action: 'export_xlsx',
      reason: 'Export the forecast results as an Excel file',
    },
  ],

  // After detecting anomalies
  'sheets_fix.detect_anomalies': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean the anomalous data identified',
    },
    {
      tool: 'sheets_format',
      action: 'add_conditional_format_rule',
      reason: 'Highlight anomalies with conditional formatting',
    },
  ],

  // After applying a format preset
  'sheets_format.apply_preset': [
    {
      tool: 'sheets_dimensions',
      action: 'freeze',
      reason: 'Freeze the header row after applying the preset',
    },
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-resize columns to fit the formatted content',
    },
  ],

  // ── Newly covered actions ──────────────────────────────────────────────────

  // After history operations
  'sheets_history.timeline': [
    {
      tool: 'sheets_history',
      action: 'diff_revisions',
      reason: 'Diff two revisions from the timeline to see cell-level changes',
    },
  ],
  'sheets_history.restore_cells': [
    {
      tool: 'sheets_quality',
      action: 'validate',
      reason: 'Validate data after restoring cells from a past revision',
    },
  ],

  // After connector operations
  'sheets_connectors.query': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Write connector query results into a sheet for further analysis',
    },
    {
      tool: 'sheets_visualize',
      action: 'suggest_chart',
      reason: 'Visualize the external data with a chart',
    },
  ],

  // After agent operations
  'sheets_agent.execute': [
    {
      tool: 'sheets_agent',
      action: 'observe',
      reason: 'Observe execution results — verify the plan completed correctly',
    },
  ],
  'sheets_agent.plan': [
    {
      tool: 'sheets_agent',
      action: 'execute',
      reason: 'Execute the plan that was just compiled',
    },
  ],

  // After template operations
  'sheets_templates.create': [
    {
      tool: 'sheets_templates',
      action: 'list',
      reason: 'Verify the template was saved — list all templates',
    },
  ],

  // After auth
  'sheets_auth.login': [
    {
      tool: 'sheets_session',
      action: 'set_active',
      reason: 'Set the target spreadsheet to work with',
    },
    {
      tool: 'sheets_core',
      action: 'list',
      reason: 'List accessible spreadsheets after authentication',
    },
  ],

  // After webhook operations
  'sheets_webhook.watch_changes': [
    {
      tool: 'sheets_webhook',
      action: 'get_stats',
      reason: 'Check webhook delivery stats to confirm it is active',
    },
  ],

  // After compute operations
  'sheets_compute.aggregate': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Write aggregated results into a summary range',
    },
    {
      tool: 'sheets_visualize',
      action: 'chart_create',
      reason: 'Create a chart from the computed aggregations',
    },
  ],

  // After session context operations
  'sheets_session.set_active': [
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Scout the active spreadsheet to understand its structure',
    },
  ],

  // After share operations
  'sheets_collaborate.comment_add': [
    {
      tool: 'sheets_collaborate',
      action: 'comment_list',
      reason: 'Review all comments on the spreadsheet',
    },
  ],

  // After data clear/delete
  'sheets_data.clear': [
    {
      tool: 'sheets_data',
      action: 'read',
      reason: 'Verify the range was cleared successfully',
    },
  ],
};

// ── Error → Recovery Rules ──────────────────────────────────────────────────
// These map error codes to recovery actions, enabling self-healing behavior.
// Called by tool-response.ts when an error occurs, so the LLM gets an
// actionable suggestion instead of just retrying blindly.

export const ERROR_RECOVERY_RULES: Record<string, SuggestedAction[]> = {
  SHEET_NOT_FOUND: [
    {
      tool: 'sheets_core',
      action: 'list_sheets',
      reason: 'Sheet name not found — list available sheets (names may contain emoji or trailing spaces)',
    },
  ],
  SPREADSHEET_NOT_FOUND: [
    {
      tool: 'sheets_core',
      action: 'list',
      reason: 'Spreadsheet ID not found — list accessible spreadsheets to find the correct ID',
    },
  ],
  INVALID_RANGE: [
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Range is invalid — scout the sheet to discover actual dimensions and sheet names',
    },
  ],
  QUOTA_EXCEEDED: [
    {
      tool: 'sheets_transaction',
      action: 'begin',
      reason: 'Quota exceeded — batch remaining operations into a transaction (80-95% fewer API calls)',
    },
  ],
  UNAUTHENTICATED: [
    {
      tool: 'sheets_auth',
      action: 'status',
      reason: 'Authentication expired — check auth status and re-login if needed',
    },
  ],
  AUTH_EXPIRED: [
    {
      tool: 'sheets_auth',
      action: 'login',
      reason: 'Credentials expired — initiate re-authentication flow',
    },
  ],
  PERMISSION_DENIED: [
    {
      tool: 'sheets_collaborate',
      action: 'share_list',
      reason: 'Permission denied — check current sharing permissions on the spreadsheet',
    },
  ],
  CONFLICT: [
    {
      tool: 'sheets_quality',
      action: 'detect_conflicts',
      reason: 'Concurrent modification detected — check for conflicting edits before retrying',
    },
  ],
  TIMEOUT: [
    {
      tool: 'sheets_data',
      action: 'batch_read',
      reason: 'Request timed out — break the range into smaller chunks using batch_read with pagination',
    },
  ],
};

// ── Cross-Tool Chaining Rules ──────────────────────────────────────────────
// Multi-step workflow patterns that chain 3+ tools together.
// These are appended to data-aware suggestions when the completed action
// is the START of a known workflow pattern.

export interface WorkflowChain {
  /** When this tool.action completes */
  trigger: string;
  /** Description of the workflow */
  workflow: string;
  /** Ordered next steps (first = immediate next action) */
  steps: SuggestedAction[];
}

export const WORKFLOW_CHAINS: WorkflowChain[] = [
  {
    trigger: 'sheets_composite.import_csv',
    workflow: 'Import → Clean → Format → Share',
    steps: [
      { tool: 'sheets_fix', action: 'clean', reason: 'Step 1/3: Clean imported data (trim, normalize types)' },
      { tool: 'sheets_format', action: 'apply_preset', reason: 'Step 2/3: Apply professional formatting' },
      { tool: 'sheets_collaborate', action: 'share_add', reason: 'Step 3/3: Share the polished spreadsheet' },
    ],
  },
  {
    trigger: 'sheets_composite.import_xlsx',
    workflow: 'Import → Clean → Format → Share',
    steps: [
      { tool: 'sheets_fix', action: 'clean', reason: 'Step 1/3: Clean imported data' },
      { tool: 'sheets_format', action: 'apply_preset', reason: 'Step 2/3: Apply professional formatting' },
      { tool: 'sheets_collaborate', action: 'share_add', reason: 'Step 3/3: Share the polished spreadsheet' },
    ],
  },
  {
    trigger: 'sheets_core.create',
    workflow: 'Create → Structure → Populate → Format',
    steps: [
      { tool: 'sheets_data', action: 'write', reason: 'Step 1/3: Write headers and initial data' },
      { tool: 'sheets_dimensions', action: 'freeze', reason: 'Step 2/3: Freeze header row' },
      { tool: 'sheets_format', action: 'batch_format', reason: 'Step 3/3: Apply formatting in one batch call' },
    ],
  },
  {
    trigger: 'sheets_analyze.scout',
    workflow: 'Scout → Analyze → Fix → Visualize',
    steps: [
      { tool: 'sheets_analyze', action: 'comprehensive', reason: 'Step 1/3: Deep analysis of patterns and issues' },
      { tool: 'sheets_fix', action: 'clean', reason: 'Step 2/3: Fix any data quality issues found' },
      { tool: 'sheets_visualize', action: 'suggest_chart', reason: 'Step 3/3: Visualize key insights' },
    ],
  },
  {
    trigger: 'sheets_data.read',
    workflow: 'Read → Compute → Write Results',
    steps: [
      { tool: 'sheets_compute', action: 'aggregate', reason: 'Step 1/2: Compute aggregations (SUM, AVG, etc.) server-side' },
      { tool: 'sheets_data', action: 'write', reason: 'Step 2/2: Write computed results back to the sheet' },
    ],
  },
  {
    trigger: 'sheets_fix.clean',
    workflow: 'Clean → Validate → Format → Protect',
    steps: [
      { tool: 'sheets_quality', action: 'validate', reason: 'Step 1/3: Validate cleaned data passes all rules' },
      { tool: 'sheets_format', action: 'batch_format', reason: 'Step 2/3: Apply consistent formatting' },
      { tool: 'sheets_advanced', action: 'add_protected_range', reason: 'Step 3/3: Protect clean data from accidental edits' },
    ],
  },
  {
    trigger: 'sheets_bigquery.query',
    workflow: 'Query → Import → Visualize',
    steps: [
      { tool: 'sheets_bigquery', action: 'import_from_bigquery', reason: 'Step 1/2: Import query results into a sheet' },
      { tool: 'sheets_visualize', action: 'chart_create', reason: 'Step 2/2: Create a chart from the imported data' },
    ],
  },
  {
    trigger: 'sheets_dependencies.model_scenario',
    workflow: 'Model → Compare → Materialize',
    steps: [
      { tool: 'sheets_dependencies', action: 'compare_scenarios', reason: 'Step 1/2: Compare multiple what-if scenarios side by side' },
      { tool: 'sheets_dependencies', action: 'create_scenario_sheet', reason: 'Step 2/2: Materialize the best scenario as a new sheet' },
    ],
  },
  // ── Newly covered tool chains ──────────────────────────────────────────────
  {
    trigger: 'sheets_history.timeline',
    workflow: 'Timeline → Diff → Restore',
    steps: [
      { tool: 'sheets_history', action: 'diff_revisions', reason: 'Step 1/2: Compare two revisions to find what changed' },
      { tool: 'sheets_history', action: 'restore_cells', reason: 'Step 2/2: Surgically restore specific cells from a past revision' },
    ],
  },
  {
    trigger: 'sheets_templates.apply',
    workflow: 'Apply Template → Populate → Format',
    steps: [
      { tool: 'sheets_data', action: 'write', reason: 'Step 1/2: Populate the template with actual data' },
      { tool: 'sheets_format', action: 'batch_format', reason: 'Step 2/2: Customize formatting for the populated template' },
    ],
  },
  {
    trigger: 'sheets_connectors.discover',
    workflow: 'Discover → Configure → Query',
    steps: [
      { tool: 'sheets_connectors', action: 'configure', reason: 'Step 1/2: Configure the discovered connector with credentials' },
      { tool: 'sheets_connectors', action: 'query', reason: 'Step 2/2: Query external data via the configured connector' },
    ],
  },
  {
    trigger: 'sheets_agent.execute',
    workflow: 'Execute → Observe → Adjust',
    steps: [
      { tool: 'sheets_agent', action: 'observe', reason: 'Step 1/2: Observe execution results and verify correctness' },
      { tool: 'sheets_agent', action: 'rollback', reason: 'Step 2/2: Roll back if results are incorrect (checkpoint-based)' },
    ],
  },
  {
    trigger: 'sheets_quality.validate',
    workflow: 'Validate → Fix → Re-validate',
    steps: [
      { tool: 'sheets_fix', action: 'clean', reason: 'Step 1/2: Auto-fix validation issues found' },
      { tool: 'sheets_quality', action: 'validate', reason: 'Step 2/2: Re-validate to confirm all issues are resolved' },
    ],
  },
];

/** Actions that benefit from receiving the source range in params */
export const RANGE_CARRYING_ACTIONS = new Set([
  'sheets_analyze.detect_patterns',
  'sheets_analyze.analyze_data',
  'sheets_analyze.quick_insights',
  'sheets_analyze.analyze_formulas',
  'sheets_visualize.suggest_chart',
  'sheets_fix.suggest_cleaning',
  'sheets_fix.clean',
  'sheets_fix.fill_missing',
  'sheets_fix.standardize_formats',
  'sheets_fix.detect_anomalies',
  'sheets_dimensions.auto_resize',
  'sheets_dimensions.sort_range',
  'sheets_data.cross_read',
  'sheets_data.read',
  'sheets_data.write',
  'sheets_compute.evaluate',
  'sheets_compute.aggregate',
  'sheets_quality.validate',
]);
