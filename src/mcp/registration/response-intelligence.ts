import { getDataAwareSuggestions } from '../../services/action-recommender.js';
import { suggestFix } from '../../services/error-fix-suggester.js';
import { getErrorPatternLearner } from '../../services/error-pattern-learner.js';
import { scanResponseQualitySync } from '../../services/lightweight-quality-scanner.js';
import {
  suggestRecovery,
  applyRecoveryToError,
  type RecoveryContext,
} from '../../services/recovery-engine.js';
import { getErrorRecoveryActions } from '../../services/action-recommender.js';
import {
  generateResponseHints,
  generateWriteHints,
  generateScenarioHints,
  type ResponseHints,
} from '../../services/response-hints-engine.js';
import { compressSheetForLLM } from '../../utils/response-compactor.js';
import { selfCorrectionsTotal } from '../../observability/metrics.js';

type ResponseCellValue = string | number | boolean | null;

type ConfidenceGapHint = {
  question: string;
  options?: string[];
};

type ResponseIntelligenceOptions = {
  toolName?: string;
  actionName?: string;
  hasFailure: boolean;
  spreadsheetId?: string;
  params?: Record<string, unknown>;
  aiMode?: 'sampling' | 'heuristic' | 'cached';
};

type ResponseIntelligenceResult = {
  batchingHint?: string;
  aiMode?: 'sampling' | 'heuristic' | 'cached';
};

// Actions that have a batch equivalent and benefit from consolidation
const BATCHING_HINTS: Partial<Record<string, string>> = {
  'sheets_data.read': 'For 3+ ranges, use batch_read — same API cost, processed in parallel.',
  'sheets_data.write': 'For 3+ ranges, use batch_write — 70% faster than individual writes.',
  'sheets_data.append': 'To append many rows, batch them in a single append call (values[][]).',
  'sheets_format.set_format': 'For 3+ format changes, use batch_format — 1 API call for all.',
  'sheets_format.set_background': 'For 3+ cells, use batch_format — single API call.',
  'sheets_format.set_text_format': 'For 3+ cells, use batch_format — single API call.',
  'sheets_core.get': 'For 2+ spreadsheets, use sheets_core.batch_get — single API call.',
};

/**
 * Action-specific gotcha warnings injected into successful responses.
 * These fire AFTER the action completes, catching common follow-up mistakes.
 * Research shows negative examples improve LLM accuracy by 8-15%.
 */
const ACTION_GOTCHAS: Partial<Record<string, string>> = {
  // Data operations
  'sheets_data.append':
    'CAUTION: append is NOT idempotent. If you need to retry, read the target range first to check for duplicates.',
  'sheets_data.find_replace':
    'find_replace scans the ENTIRE range. For targeted updates at known cells, use sheets_data.write instead.',
  'sheets_data.write':
    'Sheets API returns 200 even for #ERROR! formula cells. Verify with a read if writing formulas.',
  'sheets_data.read':
    'For numeric calculations, use valueRenderOption:"UNFORMATTED_VALUE" to avoid locale-formatted strings.',
  // Formatting
  'sheets_format.set_format':
    'For 3+ format changes in a session, switch to batch_format — saves 70%+ API calls.',
  'sheets_format.set_background':
    'Colors use 0-1 float scale, NOT 0-255. E.g., red = {"red":1,"green":0,"blue":0}.',
  // Dimensions
  'sheets_dimensions.insert':
    'Row/column indices are 0-based. Row 1 in the UI = index 0 in the API.',
  'sheets_dimensions.delete':
    'Row/column indices are 0-based. Deleting "row 5" means startIndex:4, endIndex:5.',
  // Structure
  'sheets_core.delete_sheet':
    'This is PERMANENT. Use sheets_history.create_snapshot first if the data may be needed later.',
  'sheets_core.clear_sheet':
    'Clears ALL data and formatting. Use sheets_data.clear for value-only clearing.',
  // Transactions
  'sheets_transaction.begin':
    'Transactions have a 5-minute timeout. Queue all operations before committing.',
  // History / Time-Travel
  'sheets_history.restore_cells':
    'restore_cells writes OLD values to CURRENT sheet. Always create a snapshot first (sheets_history.create_snapshot).',
  'sheets_history.timeline':
    'Timeline uses Drive Revision API — large spreadsheets may have merged revisions (multiple edits in one entry).',
  // Compute
  'sheets_compute.aggregate':
    'aggregate runs server-side. For client-visible formulas, use sheets_data.write with formula strings instead.',
  'sheets_compute.forecast':
    'Forecast uses linear/exponential regression on historical data. Accuracy degrades with <10 data points.',
  // Connectors
  'sheets_connectors.query':
    'Connector queries run against external APIs. Rate limits are PER-CONNECTOR, not shared with Sheets API quota.',
  'sheets_connectors.configure':
    'API keys are stored encrypted in session. They do NOT persist across server restarts.',
  // Templates
  'sheets_templates.apply':
    'Template application creates a NEW spreadsheet. It does NOT modify the template source.',
  // BigQuery
  'sheets_bigquery.query':
    'BigQuery queries consume project quota. Use LIMIT clauses and preview before running large queries.',
  // Federation
  'sheets_federation.call_remote':
    'Remote MCP calls have network latency. Batch operations on the remote server where possible.',
  // Agent
  'sheets_agent.execute_plan':
    'Plan execution is sequential. If a step fails, subsequent steps are skipped. Use checkpoints for recovery.',
};

// Map tool.action → relevant MCP prompt for guided follow-up workflows
// These surface prompted workflows the LLM can invoke for deeper operations
const FOLLOW_UP_PROMPTS: Partial<Record<string, { prompt: string; description: string }>> = {
  // After reading data, suggest analysis prompts
  'sheets_data.read': {
    prompt: 'analyze-sheet',
    description: 'Run a guided analysis of the data you just read',
  },
  'sheets_data.batch_read': {
    prompt: 'compare-ranges',
    description: 'Compare the ranges you just read with guided analysis',
  },
  // After analysis, suggest action-oriented prompts
  'sheets_analyze.scout': {
    prompt: 'clean-data',
    description: 'Start a guided data cleaning workflow based on scout findings',
  },
  'sheets_analyze.comprehensive': {
    prompt: 'improve-sheet',
    description: 'Apply improvements based on analysis findings',
  },
  // After creating a spreadsheet
  'sheets_core.create': {
    prompt: 'setup-sheet',
    description: 'Set up the new spreadsheet with headers, formatting, and validation',
  },
  // After importing data
  'sheets_composite.import_csv': {
    prompt: 'clean-data',
    description: 'Clean and standardize the imported CSV data',
  },
  'sheets_composite.import_xlsx': {
    prompt: 'clean-data',
    description: 'Clean and standardize the imported Excel data',
  },
  // After cleaning
  'sheets_fix.clean': {
    prompt: 'format-sheet',
    description: 'Apply professional formatting to the cleaned data',
  },
  // After formatting
  'sheets_format.batch_format': {
    prompt: 'share-sheet',
    description: 'Share the formatted spreadsheet with collaborators',
  },
  // After creating a chart
  'sheets_visualize.chart_create': {
    prompt: 'export-sheet',
    description: 'Export the spreadsheet with charts as PDF or Excel',
  },
  // After scenario modeling
  'sheets_dependencies.model_scenario': {
    prompt: 'compare-scenarios',
    description: 'Compare multiple scenarios side-by-side',
  },
  // After validation
  'sheets_quality.validate': {
    prompt: 'fix-issues',
    description: 'Fix the data quality issues found during validation',
  },
  // After history operations
  'sheets_history.timeline': {
    prompt: 'time-travel',
    description: 'Investigate and restore specific cells from past revisions',
  },
  // After agent plan compilation
  'sheets_agent.plan': {
    prompt: 'execute-plan',
    description: 'Execute the compiled agent plan step by step',
  },
  // After template application
  'sheets_templates.apply': {
    prompt: 'setup-sheet',
    description: 'Populate and customize the template with your data',
  },
  // After compute forecast
  'sheets_compute.forecast': {
    prompt: 'visualize-data',
    description: 'Create a chart showing actuals vs forecast projection',
  },
  // After connector operations
  'sheets_connectors.configure': {
    prompt: 'connector_data_pipeline',
    description: 'Fetch and write connector data to a spreadsheet',
  },
  'sheets_connectors.query': {
    prompt: 'clean-data',
    description: 'Clean and standardize the connector query results',
  },
  // After BigQuery operations
  'sheets_bigquery.import_from_bigquery': {
    prompt: 'auto_analyze',
    description: 'Analyze the imported BigQuery data',
  },
  'sheets_bigquery.export_to_bigquery': {
    prompt: 'performance_audit',
    description: 'Audit the export performance and optimize',
  },
  // After agent plan execution
  'sheets_agent.execute_plan': {
    prompt: 'audit_sheet',
    description: 'Audit the spreadsheet after plan execution',
  },
  // After regression analysis
  'sheets_compute.regression': {
    prompt: 'create_visualization',
    description: 'Visualize the regression results with a chart',
  },
  // ─── M-PR3: Follow-up prompts for remaining 10 tools ───
  // After advanced operations (named ranges, protected ranges, banding)
  'sheets_advanced.add_named_range': {
    prompt: 'setup-sheet',
    description: 'Use the named range in formulas or data validation',
  },
  // After Apps Script execution
  'sheets_appsscript.run': {
    prompt: 'audit_sheet',
    description: 'Verify the spreadsheet state after script execution',
  },
  // After authentication
  'sheets_auth.authorize': {
    prompt: 'analyze-sheet',
    description: 'Open and analyze a spreadsheet now that you are authorized',
  },
  // After sharing operations
  'sheets_collaborate.share_add': {
    prompt: 'share-sheet',
    description: 'Set up notifications or add more collaborators',
  },
  // After confirmation/wizard
  'sheets_confirm.approve': {
    prompt: 'audit_sheet',
    description: 'Review the results of the approved operation',
  },
  // After dimension changes (resize, freeze, hide)
  'sheets_dimensions.auto_resize': {
    prompt: 'format-sheet',
    description: 'Apply formatting now that columns are properly sized',
  },
  // After federation calls
  'sheets_federation.call_remote': {
    prompt: 'clean-data',
    description: 'Clean and standardize the remote server results',
  },
  // After session operations
  'sheets_session.set_active_spreadsheet': {
    prompt: 'analyze-sheet',
    description: 'Run a quick scout analysis of the active spreadsheet',
  },
  // After transaction completion
  'sheets_transaction.commit': {
    prompt: 'audit_sheet',
    description: 'Audit the spreadsheet state after committing changes',
  },
  // After webhook setup
  'sheets_webhook.register': {
    prompt: 'setup-sheet',
    description: 'Configure the spreadsheet to trigger webhook events',
  },
};

// Disambiguation labels for actions whose names appear in multiple tools.
// Injected as `_actionLabel` so the LLM knows exactly what the response represents
// (e.g. "list" returned spreadsheets vs sheets vs charts vs templates).
const ACTION_DISAMBIGUATION: Partial<Record<string, string>> = {
  // "list" appears in 9+ tools
  'sheets_core.list': 'Listed spreadsheets in Drive',
  'sheets_core.list_sheets': 'Listed sheet tabs in spreadsheet',
  'sheets_advanced.list_named_ranges': 'Listed named ranges',
  'sheets_advanced.list_protected_ranges': 'Listed protected ranges',
  'sheets_advanced.list_banding': 'Listed banding styles',
  'sheets_advanced.list_tables': 'Listed tables',
  'sheets_advanced.list_named_functions': 'Listed named functions',
  'sheets_advanced.list_chips': 'Listed smart chips',
  'sheets_visualize.chart_list': 'Listed charts',
  'sheets_visualize.pivot_list': 'Listed pivot tables',
  'sheets_collaborate.comment_list': 'Listed comments',
  'sheets_collaborate.share_list': 'Listed sharing permissions',
  'sheets_collaborate.version_list_revisions': 'Listed version history',
  'sheets_templates.list': 'Listed saved templates',
  'sheets_webhook.list': 'Listed registered webhooks',
  'sheets_format.list_data_validations': 'Listed data validation rules',
  'sheets_format.rule_list_conditional_formats': 'Listed conditional format rules',
  'sheets_dimensions.list_filter_views': 'Listed filter views',
  'sheets_dimensions.list_slicers': 'Listed slicers',
  'sheets_history.list': 'Listed operation history',
  'sheets_transaction.list': 'Listed active transactions',
  'sheets_appsscript.list_versions': 'Listed Apps Script versions',
  'sheets_appsscript.list_deployments': 'Listed Apps Script deployments',
  'sheets_appsscript.list_processes': 'Listed Apps Script processes',
  'sheets_bigquery.list_connections': 'Listed BigQuery connections',
  'sheets_agent.list_plans': 'Listed agent plans',
  'sheets_session.list_checkpoints': 'Listed session checkpoints',
  // "delete" appears in 8+ tools
  'sheets_core.delete_sheet': 'Deleted a sheet tab',
  'sheets_dimensions.delete': 'Deleted rows or columns',
  'sheets_advanced.delete_named_range': 'Deleted a named range',
  'sheets_advanced.delete_protected_range': 'Deleted a protected range',
  'sheets_advanced.delete_banding': 'Deleted a banding style',
  'sheets_advanced.delete_table': 'Deleted a table',
  'sheets_advanced.delete_named_function': 'Deleted a named function',
  'sheets_visualize.chart_delete': 'Deleted a chart',
  'sheets_visualize.pivot_delete': 'Deleted a pivot table',
  'sheets_collaborate.comment_delete': 'Deleted a comment',
  'sheets_templates.delete': 'Deleted a template',
  'sheets_webhook.unregister': 'Unregistered a webhook',
  'sheets_dimensions.delete_filter_view': 'Deleted a filter view',
  'sheets_dimensions.delete_slicer': 'Deleted a slicer',
  'sheets_session.delete_checkpoint': 'Deleted a session checkpoint',
  // "create" appears in 6+ tools
  'sheets_core.create': 'Created a new spreadsheet',
  'sheets_core.add_sheet': 'Created a new sheet tab',
  'sheets_visualize.chart_create': 'Created a chart',
  'sheets_visualize.pivot_create': 'Created a pivot table',
  'sheets_templates.create': 'Created a template',
  'sheets_advanced.add_named_range': 'Created a named range',
  'sheets_advanced.add_protected_range': 'Created a protected range',
  'sheets_advanced.create_table': 'Created a table',
  'sheets_advanced.create_named_function': 'Created a named function',
  'sheets_dimensions.create_filter_view': 'Created a filter view',
  'sheets_dimensions.create_slicer': 'Created a slicer',
  'sheets_appsscript.create': 'Created an Apps Script project',
  'sheets_appsscript.create_version': 'Created an Apps Script version',
  'sheets_bigquery.create_scheduled_query': 'Created a scheduled BigQuery query',
  // "get" appears in 7+ tools
  'sheets_core.get': 'Got spreadsheet metadata',
  'sheets_advanced.get_named_range': 'Got a named range',
  'sheets_advanced.get_named_function': 'Got a named function',
  'sheets_advanced.get_metadata': 'Got developer metadata',
  'sheets_visualize.chart_get': 'Got chart details',
  'sheets_visualize.pivot_get': 'Got pivot table details',
  'sheets_dimensions.get_basic_filter': 'Got basic filter state',
  'sheets_dimensions.get_filter_view': 'Got filter view details',
  'sheets_appsscript.get': 'Got Apps Script project',
  'sheets_appsscript.get_content': 'Got Apps Script source code',
  'sheets_appsscript.get_version': 'Got Apps Script version',
  'sheets_appsscript.get_deployment': 'Got Apps Script deployment',
  'sheets_appsscript.get_metrics': 'Got Apps Script usage metrics',
  'sheets_bigquery.get_connection': 'Got BigQuery connection details',
  'sheets_webhook.get': 'Got webhook details',
  'sheets_webhook.get_stats': 'Got webhook delivery stats',
  'sheets_history.get': 'Got operation history entry',
  'sheets_session.get_context': 'Got active session context',
  'sheets_session.get_active': 'Got active spreadsheet',
  'sheets_session.get_preferences': 'Got session preferences',
  'sheets_session.get_pending': 'Got pending operations',
  'sheets_transaction.status': 'Got transaction status',
  // "status" appears in 3+ tools
  'sheets_auth.status': 'Checked authentication status',
  'sheets_agent.get_status': 'Got agent plan execution status',
};

/**
 * Multi-turn workflow plans triggered by specific action completions.
 * When an action is a natural entry point for a multi-step workflow,
 * we suggest the full plan so the LLM can execute it without discovery.
 */
const WORKFLOW_PLAN_TRIGGERS: Partial<Record<string, { plan: string[]; description: string }>> = {
  'sheets_composite.import_csv': {
    plan: [
      'sheets_fix.suggest_cleaning → review data quality issues',
      'sheets_fix.clean → auto-fix detected issues',
      'sheets_format.suggest_format → get formatting recommendations',
      'sheets_visualize.suggest_chart → visualize key data patterns',
    ],
    description: 'Post-import cleanup and visualization workflow',
  },
  'sheets_core.create': {
    plan: [
      'sheets_session.set_active → set as active spreadsheet',
      'sheets_composite.generate_sheet or sheets_data.write → populate with structure',
      'sheets_format.apply_preset → apply professional formatting',
    ],
    description: 'New spreadsheet setup workflow',
  },
  'sheets_analyze.scout': {
    plan: [
      'sheets_analyze.suggest_next_actions → get contextual recommendations',
      'sheets_fix.suggest_cleaning → check for data quality issues',
      'sheets_format.suggest_format → check formatting opportunities',
    ],
    description: 'Post-scout analysis workflow',
  },
  'sheets_data.cross_read': {
    plan: [
      'sheets_fix.detect_anomalies → check for cross-source inconsistencies',
      'sheets_data.write → write merged results to target sheet',
      'sheets_visualize.chart_create → visualize combined data',
    ],
    description: 'Cross-spreadsheet merge and analysis workflow',
  },
  'sheets_analyze.comprehensive': {
    plan: [
      'sheets_fix.clean → fix identified quality issues',
      'sheets_format.batch_format → apply recommended formatting',
      'sheets_visualize.chart_create → create recommended visualizations',
    ],
    description: 'Post-analysis remediation workflow',
  },
  'sheets_auth.login': {
    plan: [
      'sheets_auth.status → verify authentication and available features',
      'sheets_session.set_active → set target spreadsheet',
      'sheets_analyze.scout → understand spreadsheet structure',
    ],
    description: 'Post-authentication startup workflow',
  },
  'sheets_quality.validate': {
    plan: [
      'sheets_fix.clean → auto-fix detected validation issues',
      'sheets_quality.validate → re-validate to confirm all issues resolved',
    ],
    description: 'Validate-fix-revalidate cycle',
  },
  'sheets_history.timeline': {
    plan: [
      'sheets_history.diff_revisions → compare two revisions for cell-level changes',
      'sheets_history.restore_cells → surgically restore specific cells if needed',
    ],
    description: 'Time-travel investigation workflow',
  },
  'sheets_templates.apply': {
    plan: [
      'sheets_data.write → populate the new spreadsheet with real data',
      'sheets_format.batch_format → customize formatting for the populated template',
      'sheets_collaborate.share_add → share the finished document',
    ],
    description: 'Template instantiation workflow',
  },
  'sheets_connectors.discover': {
    plan: [
      'sheets_connectors.configure → set up the connector with credentials',
      'sheets_connectors.query → pull external data into the spreadsheet',
    ],
    description: 'External data connector setup workflow',
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCellValue(value: unknown): value is ResponseCellValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isCellRow(value: unknown): value is ResponseCellValue[] {
  return Array.isArray(value) && value.every((cell) => isCellValue(cell));
}

function isCellGrid(value: unknown): value is ResponseCellValue[][] {
  return Array.isArray(value) && value.every((row) => isCellRow(row));
}

function getOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((option): option is string => typeof option === 'string');
}

function extractResponseValues(
  responseRecord: Record<string, unknown>
): ResponseCellValue[][] | null {
  const directValues = responseRecord['values'];
  if (isCellGrid(directValues)) {
    return directValues;
  }

  const nestedData = responseRecord['data'];
  if (!isRecord(nestedData)) {
    return null;
  }

  const nestedValues = nestedData['values'];
  return isCellGrid(nestedValues) ? nestedValues : null;
}

function normalizeConfidenceGapHint(value: unknown): ConfidenceGapHint | null {
  if (typeof value === 'string') {
    const question = value.trim();
    return question ? { question } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const question =
    getOptionalString(value, 'question') ??
    getOptionalString(value, 'gap') ??
    getOptionalString(value, 'detail');

  if (!question) {
    return null;
  }

  const options = getStringArray(value['options']);
  return options.length > 0 ? { question, options } : { question };
}

function extractConfidenceGapHints(responseRecord: Record<string, unknown>): ConfidenceGapHint[] {
  const hints: ConfidenceGapHint[] = [];
  const confidenceGaps = responseRecord['confidenceGaps'];
  if (Array.isArray(confidenceGaps)) {
    for (const entry of confidenceGaps) {
      const normalized = normalizeConfidenceGapHint(entry);
      if (normalized) {
        hints.push(normalized);
      }
    }
  }

  const confidence = responseRecord['confidence'];
  if (!isRecord(confidence)) {
    return hints;
  }

  for (const key of ['gaps', 'topGaps']) {
    const entries = confidence[key];
    if (!Array.isArray(entries)) {
      continue;
    }
    for (const entry of entries) {
      const normalized = normalizeConfidenceGapHint(entry);
      if (normalized) {
        hints.push(normalized);
      }
    }
  }

  return hints;
}

// ============================================================================
// ERROR RECOVERY PLAYBOOKS
// ============================================================================

interface RecoveryStep {
  tool: string;
  action: string;
  params?: Record<string, string>;
  description: string;
}

interface RecoveryPlaybook {
  steps: RecoveryStep[];
  maxRetries: number;
  description: string;
}

/**
 * Error-code → recovery playbook lookup.
 * Provides structured multi-step recovery sequences with pre-filled params.
 */
function getRecoveryPlaybook(
  errorCode: string,
  toolName: string | undefined,
  actionName: string | undefined,
  context: { spreadsheetId?: string; range?: string }
): RecoveryPlaybook | undefined {
  const sid = context.spreadsheetId ?? '';

  switch (errorCode) {
    case 'SHEET_NOT_FOUND':
      return {
        description:
          'Sheet name mismatch — list sheets to find the correct name (often emoji/unicode issue)',
        maxRetries: 1,
        steps: [
          {
            tool: 'sheets_core',
            action: 'list_sheets',
            ...(sid ? { params: { spreadsheetId: sid } } : {}),
            description:
              'List all sheet names to find the correct one (copy name exactly — may contain emoji)',
          },
          {
            tool: toolName ?? 'sheets_data',
            action: actionName ?? 'read',
            description: 'Retry the original operation with the corrected sheet name',
          },
        ],
      };

    case 'INVALID_RANGE':
      return {
        description: 'Range specification is invalid — scout to discover actual dimensions',
        maxRetries: 1,
        steps: [
          {
            tool: 'sheets_analyze',
            action: 'scout',
            ...(sid ? { params: { spreadsheetId: sid } } : {}),
            description: 'Scout the spreadsheet to discover actual row/column dimensions',
          },
          {
            tool: toolName ?? 'sheets_data',
            action: actionName ?? 'read',
            description: 'Retry with corrected range based on actual dimensions',
          },
        ],
      };

    case 'QUOTA_EXCEEDED':
    case 'RATE_LIMIT':
      return {
        description: 'API quota exceeded — wait and switch to batched operations',
        maxRetries: 2,
        steps: [
          {
            tool: 'sheets_transaction',
            action: 'begin',
            description:
              'Start a transaction to batch remaining operations (80-95% fewer API calls)',
          },
          {
            tool: toolName ?? 'sheets_data',
            action: actionName ?? 'write',
            description: 'Queue the original operation within the transaction',
          },
          {
            tool: 'sheets_transaction',
            action: 'commit',
            description: 'Commit the transaction to execute all queued operations in one batch',
          },
        ],
      };

    case 'PERMISSION_DENIED':
    case 'INSUFFICIENT_PERMISSIONS':
      return {
        description: 'Authentication may have expired or insufficient scopes',
        maxRetries: 1,
        steps: [
          {
            tool: 'sheets_auth',
            action: 'status',
            description: 'Check current authentication status and available scopes',
          },
          {
            tool: 'sheets_auth',
            action: 'login',
            description: 'Re-authenticate if status shows expired or missing scopes',
          },
          {
            tool: toolName ?? 'sheets_data',
            action: actionName ?? 'read',
            description: 'Retry the original operation after re-authentication',
          },
        ],
      };

    case 'SPREADSHEET_NOT_FOUND':
      return {
        description: 'Spreadsheet ID is invalid or not accessible — list available spreadsheets',
        maxRetries: 1,
        steps: [
          {
            tool: 'sheets_core',
            action: 'list',
            description: 'List accessible spreadsheets to find the correct ID',
          },
          {
            tool: toolName ?? 'sheets_data',
            action: actionName ?? 'read',
            description: 'Retry with the correct spreadsheet ID',
          },
        ],
      };

    case 'TIMEOUT':
    case 'DEADLINE_EXCEEDED':
      return {
        description: 'Operation timed out — use background task execution',
        maxRetries: 1,
        steps: [
          {
            tool: toolName ?? 'sheets_data',
            action: actionName ?? 'read',
            description:
              'Retry the same operation using tasks/call for background execution (no timeout)',
          },
        ],
      };

    default:
      return undefined; // OK: no playbook for this error code
  }
}

export function applyResponseIntelligence(
  responseRecord: Record<string, unknown>,
  options: ResponseIntelligenceOptions
): ResponseIntelligenceResult {
  if (options.hasFailure) {
    const error = responseRecord['error'];
    if (!isRecord(error)) {
      return {}; // OK: no error record to enrich
    }

    const errorCode = getOptionalString(error, 'code') ?? '';
    const errorMessage = getOptionalString(error, 'message') ?? '';
    const fix = suggestFix(
      errorCode,
      errorMessage,
      options.toolName,
      options.actionName,
      options.params
    );
    if (fix) {
      // Inject the full SuggestedFix object
      error['suggestedFix'] = {
        tool: fix.tool,
        action: fix.action,
        params: fix.params,
        explanation: fix.explanation,
      };
      // Wire structured fixableVia so LLMs can execute the fix directly
      if (!error['fixableVia']) {
        error['fixableVia'] = {
          tool: fix.tool,
          action: fix.action,
          params: fix.params,
        };
      }
    }

    // Surface learned error patterns if the learner has sufficient data
    const learner = getErrorPatternLearner();
    const pattern = learner.getPatterns(errorCode, { tool: options.toolName });
    if (
      pattern?.topResolution &&
      pattern.topResolution.successRate > 0.5 &&
      pattern.topResolution.occurrenceCount >= 3
    ) {
      error['_learnedFix'] = {
        fix: pattern.topResolution.fix,
        confidence: pattern.topResolution.successRate,
        seenCount: pattern.topResolution.occurrenceCount,
      };

      // Increment self-correction metric when a learned fix is available
      selfCorrectionsTotal.inc({
        tool: options.toolName || 'unknown',
        from_action: options.actionName || 'unknown',
        to_action: pattern.topResolution.fix || 'unknown',
      });
    }

    // ── Recovery Engine: enrich error with alternatives + resolution steps ──
    const recoveryCtx: RecoveryContext = {
      toolName: options.toolName,
      actionName: options.actionName,
      spreadsheetId: options.spreadsheetId,
      params: options.params,
    };
    const recovery = suggestRecovery(errorCode, errorMessage, recoveryCtx);
    applyRecoveryToError(error, recovery);

    // Inject actionable recovery suggestions so the LLM can self-heal
    const recoveryActions = getErrorRecoveryActions(errorCode, {
      spreadsheetId: options.spreadsheetId,
      range: options.params?.['range'] as string | undefined,
    });
    if (recoveryActions.length > 0) {
      error['suggestedRecoveryActions'] = recoveryActions;
    }

    // Action-specific recovery playbook: structured multi-step sequences
    // for the most common error patterns, with pre-filled params
    const playbook = getRecoveryPlaybook(errorCode, options.toolName, options.actionName, {
      spreadsheetId: options.spreadsheetId,
      range: options.params?.['range'] as string | undefined,
    });
    if (playbook) {
      error['_recoveryPlaybook'] = playbook;
    }

    return {}; // OK: no batching hint for failure responses
  }

  if (!options.toolName) {
    return {}; // OK: no tool context, cannot generate hints
  }

  const actionName = getOptionalString(responseRecord, 'action');
  if (!actionName) {
    return {}; // OK: no action in response, cannot generate hints
  }

  const responseValues = extractResponseValues(responseRecord);
  const confidenceGaps = extractConfidenceGapHints(responseRecord);
  const recommendations = getDataAwareSuggestions(options.toolName, actionName, responseRecord, {
    ...(responseValues ? { responseValues } : {}),
    ...(confidenceGaps.length > 0 ? { confidenceGaps } : {}),
    spreadsheetId: options.spreadsheetId,
    range: getOptionalString(responseRecord, 'range') ?? undefined,
  });

  if (recommendations.length > 0) {
    responseRecord['suggestedNextActions'] = recommendations.slice(0, 5);
  }

  // Trigger quality scan on any response that returns cell data (not just sheets_data)
  if (
    responseValues &&
    responseValues.length >= 2 &&
    responseValues.some((row) => row.length >= 2)
  ) {
    const warnings = scanResponseQualitySync(responseValues, {
      tool: options.toolName,
      action: actionName,
      range: getOptionalString(responseRecord, 'range') ?? '',
    });

    if (warnings.length > 0) {
      responseRecord['dataQualityWarnings'] = warnings;
    }
  }

  // Inject CoT _hints on successful responses (sync, zero API calls)
  if (
    options.toolName === 'sheets_data' &&
    (actionName === 'read' || actionName === 'batch_read' || actionName === 'cross_read') &&
    responseValues
  ) {
    const hints = generateResponseHints(responseValues);
    if (hints) {
      responseRecord['_hints'] = hints;
    }

    // Compress large sheets for LLM context (SpreadsheetLLM compression)
    // Only compress if > 100 rows AND verbosity is not "detailed" (preserve raw data if requested)
    // Skip if data is already in a compressed/preview format (_truncated present)
    if (
      responseValues.length > 100 &&
      !responseRecord['_truncated'] &&
      !(options.params?.['verbosity'] === 'detailed')
    ) {
      const compressed = compressSheetForLLM(responseValues, {
        maxAnchors: 20,
        maxExamples: 5,
      });
      // Inject compressed representation alongside raw (LLMs can choose which to use)
      responseRecord['_compressed'] = compressed;
    }
  } else if (
    options.toolName === 'sheets_data' &&
    (actionName === 'write' || actionName === 'batch_write')
  ) {
    const writtenValues = responseValues ?? ([] as ResponseCellValue[][]);
    const hints = generateWriteHints(writtenValues);
    const writeRange =
      getOptionalString(responseRecord, 'updatedRange') ??
      getOptionalString(responseRecord, 'range') ??
      '';
    const verifyWrite =
      writeRange && options.spreadsheetId
        ? {
            tool: 'sheets_data',
            action: 'read',
            params: { spreadsheetId: options.spreadsheetId, range: writeRange },
            reason: 'Read back written range to verify data quality',
          }
        : undefined;

    // Only inject _hints if there's actual content (hints or verifyWrite)
    if (hints || verifyWrite) {
      const verifyHints: Record<string, unknown> = {
        ...(hints ?? {}),
        ...(verifyWrite ? { verifyWrite } : {}),
      };
      responseRecord['_hints'] = verifyHints;
    }
  } else if (options.toolName === 'sheets_data' && actionName === 'append') {
    const appendedValues = responseValues ?? ([] as ResponseCellValue[][]);
    const rowCount = appendedValues.length;
    if (rowCount > 0) {
      responseRecord['_hints'] = {
        nextPhase: `Appended ${rowCount} row${rowCount !== 1 ? 's' : ''}. If retrying, check for duplicates first (sheets_data.read).`,
        riskLevel: 'low' as const,
      };
    }
  } else if (options.toolName === 'sheets_dependencies' && actionName === 'model_scenario') {
    const cascadeEffects = responseRecord['cascadeEffects'];
    const hints = generateScenarioHints(Array.isArray(cascadeEffects) ? cascadeEffects : undefined);
    if (hints) {
      responseRecord['_hints'] = hints;
    }
  } else if (options.toolName === 'sheets_analyze' && actionName === 'comprehensive') {
    const severity = getOptionalString(responseRecord, 'overallHealth') ?? '';
    const findingCount = isRecord(responseRecord['findings'])
      ? Object.keys(responseRecord['findings']).length
      : 0;
    responseRecord['_hints'] = {
      dataShape: findingCount > 0 ? `${findingCount} finding categories detected` : undefined,
      nextPhase:
        severity === 'critical' || severity === 'poor'
          ? 'Analysis complete → clean data (sheets_fix.clean) → validate → re-analyze'
          : 'Analysis complete → apply suggestions (sheets_analyze.auto_enhance) → format → share',
      riskLevel: (severity === 'critical' || severity === 'poor'
        ? 'high'
        : severity === 'fair'
          ? 'medium'
          : 'low') as ResponseHints['riskLevel'],
    };
  } else if (options.toolName === 'sheets_fix' && actionName === 'clean') {
    const changesCount =
      typeof responseRecord['changesApplied'] === 'number' ? responseRecord['changesApplied'] : 0;
    const columnsCount =
      typeof responseRecord['columnsAffected'] === 'number' ? responseRecord['columnsAffected'] : 0;
    if (changesCount > 0 || columnsCount > 0) {
      responseRecord['_hints'] = {
        dataShape:
          changesCount > 0 || columnsCount > 0
            ? `Cleaned ${changesCount} cell${changesCount !== 1 ? 's' : ''} across ${columnsCount} column${columnsCount !== 1 ? 's' : ''}`
            : undefined,
        nextPhase: 'Clean complete → validate (sheets_quality.validate) → re-read to confirm',
        riskLevel: 'none' as const,
      };
    }
  } else if (options.toolName === 'sheets_composite' && actionName === 'generate_sheet') {
    const colCount =
      typeof responseRecord['columnCount'] === 'number' ? responseRecord['columnCount'] : 0;
    const formulaRowCount =
      typeof responseRecord['formulaRows'] === 'number' ? responseRecord['formulaRows'] : 0;
    if (colCount > 0) {
      responseRecord['_hints'] = {
        dataShape: `Generated ${colCount} column${colCount !== 1 ? 's' : ''}${formulaRowCount > 0 ? `, ${formulaRowCount} formula row${formulaRowCount !== 1 ? 's' : ''}` : ''}`,
        nextPhase:
          'Sheet generated → review structure → save as template (sheets_templates.create)',
        riskLevel: 'none' as const,
      };
    }
  } else if (options.toolName === 'sheets_agent' && actionName === 'execute') {
    const totalSteps =
      typeof responseRecord['totalSteps'] === 'number' ? responseRecord['totalSteps'] : 0;
    const completedSteps =
      typeof responseRecord['completedSteps'] === 'number' ? responseRecord['completedSteps'] : 0;
    const lastAction = getOptionalString(responseRecord, 'lastAction') ?? '';
    if (totalSteps > 0) {
      responseRecord['_hints'] = {
        dataShape: `Plan executed ${completedSteps}/${totalSteps} step${totalSteps !== 1 ? 's' : ''}${lastAction ? `, final action: ${lastAction}` : ''}`,
        nextPhase:
          completedSteps < totalSteps
            ? 'Plan partially completed → check error details → retry or adjust plan'
            : 'Plan complete → verify results → share or export',
        riskLevel: (completedSteps < totalSteps ? 'medium' : 'none') as ResponseHints['riskLevel'],
      };
    }
  } else if (options.toolName === 'sheets_format' && actionName === 'suggest_format') {
    const suggestionCount = Array.isArray(responseRecord['suggestions'])
      ? responseRecord['suggestions'].length
      : 0;
    if (suggestionCount > 0) {
      responseRecord['_hints'] = {
        dataShape: `${suggestionCount} format suggestion${suggestionCount !== 1 ? 's' : ''} generated`,
        nextPhase:
          'Review suggestions → apply selected (sheets_format.set_format or batch_format) → verify visually',
        riskLevel: 'none' as const,
      };
    }
  } else if (options.toolName === 'sheets_history' && actionName === 'diff_revisions') {
    const changedCells = Array.isArray(responseRecord['changed'])
      ? responseRecord['changed'].length
      : 0;
    const addedCells = Array.isArray(responseRecord['added']) ? responseRecord['added'].length : 0;
    const removedCells = Array.isArray(responseRecord['removed'])
      ? responseRecord['removed'].length
      : 0;
    const total = changedCells + addedCells + removedCells;
    if (total > 0) {
      responseRecord['_hints'] = {
        dataShape: `Diff: ${changedCells} changed, ${addedCells} added, ${removedCells} removed`,
        nextPhase:
          total > 10
            ? 'Large diff detected → consider restoring specific cells (sheets_history.restore_cells)'
            : 'Review diff → restore cells if needed (sheets_history.restore_cells)',
        riskLevel: (total > 50
          ? 'high'
          : total > 10
            ? 'medium'
            : 'low') as ResponseHints['riskLevel'],
      };
    }
  } else if (options.toolName === 'sheets_history' && actionName === 'timeline') {
    const entryCount = Array.isArray(responseRecord['entries'])
      ? responseRecord['entries'].length
      : 0;
    if (entryCount > 0) {
      responseRecord['_hints'] = {
        dataShape: `${entryCount} revision event${entryCount !== 1 ? 's' : ''} in timeline`,
        nextPhase:
          'Timeline loaded → compare two revisions (sheets_history.diff_revisions) or restore a snapshot',
        riskLevel: 'none' as const,
      };
    }
  } else if (options.toolName === 'sheets_visualize' && actionName === 'chart_create') {
    const chartType = getOptionalString(responseRecord, 'chartType') ?? 'chart';
    const chartId = getOptionalString(responseRecord, 'chartId') ?? '';
    responseRecord['_hints'] = {
      dataShape: `${chartType} created${chartId ? ` (ID: ${chartId})` : ''}`,
      nextPhase: 'Chart created → update data range or style (sheets_visualize.chart_update)',
      riskLevel: 'none' as const,
    };
  } else if (options.toolName === 'sheets_quality' && actionName === 'validate') {
    const violationCount = Array.isArray(responseRecord['violations'])
      ? responseRecord['violations'].length
      : 0;
    const warningCount = Array.isArray(responseRecord['warnings'])
      ? responseRecord['warnings'].length
      : 0;
    responseRecord['_hints'] = {
      dataShape:
        violationCount > 0
          ? `${violationCount} violation${violationCount !== 1 ? 's' : ''}${warningCount > 0 ? `, ${warningCount} warning${warningCount !== 1 ? 's' : ''}` : ''}`
          : 'No violations found',
      nextPhase:
        violationCount > 0
          ? 'Violations found → auto-fix (sheets_fix.fix) or manual review → re-validate'
          : 'Validation passed → proceed with data operations',
      riskLevel: (violationCount > 10
        ? 'high'
        : violationCount > 0
          ? 'medium'
          : 'none') as ResponseHints['riskLevel'],
    };
  } else if (options.toolName === 'sheets_collaborate' && actionName === 'share_add') {
    const email = getOptionalString(responseRecord, 'email') ?? '';
    const role = getOptionalString(responseRecord, 'role') ?? 'viewer';
    responseRecord['_hints'] = {
      dataShape: `Shared with ${email || 'user'} as ${role}`,
      nextPhase:
        'Share complete → notify collaborator → set data validations or protected ranges if needed',
      riskLevel: 'none' as const,
    };
  } else if (options.toolName === 'sheets_fix' && actionName === 'suggest_cleaning') {
    const suggestionCount = Array.isArray(responseRecord['suggestions'])
      ? responseRecord['suggestions'].length
      : 0;
    if (suggestionCount > 0) {
      responseRecord['_hints'] = {
        dataShape: `${suggestionCount} cleaning suggestion${suggestionCount !== 1 ? 's' : ''} identified`,
        nextPhase:
          'Review suggestions → apply cleaning (sheets_fix.clean with recommended rules) → validate',
        riskLevel: 'low' as const,
      };
    }
  }

  // Inject action-specific gotcha warnings to prevent common LLM mistakes
  const gotchaKey = `${options.toolName}.${actionName}`;
  const gotcha = ACTION_GOTCHAS[gotchaKey];
  if (gotcha) {
    responseRecord['_gotcha'] = gotcha;
  }

  // Suggest relevant MCP prompts as follow-up guided workflows
  const promptKey = `${options.toolName}.${actionName}`;
  const promptSuggestion = FOLLOW_UP_PROMPTS[promptKey];
  if (promptSuggestion) {
    responseRecord['suggestedPrompt'] = promptSuggestion;
  }

  // Add disambiguation label for actions with shared names across tools
  const disambigLabel = ACTION_DISAMBIGUATION[promptKey];
  if (disambigLabel) {
    responseRecord['_actionLabel'] = disambigLabel;
  }

  // Multi-turn planning hints: suggest a full workflow when the current action
  // is a natural entry point for a multi-step pattern
  if (!options.hasFailure) {
    const planKey = `${options.toolName}.${actionName}`;
    const suggestedPlan = WORKFLOW_PLAN_TRIGGERS[planKey];
    if (suggestedPlan) {
      responseRecord['_suggestedPlan'] = suggestedPlan;
    }
  }

  // Inject aiMode into _meta if provided
  if (options.aiMode) {
    const existing = responseRecord['_meta'];
    const meta: Record<string, unknown> = isRecord(existing) ? existing : {};
    meta['aiMode'] = options.aiMode;
    responseRecord['_meta'] = meta;
  }

  // Return batching hint for the caller to inject into _meta
  const batchingHint = BATCHING_HINTS[`${options.toolName}.${actionName}`];
  return {
    ...(batchingHint ? { batchingHint } : {}),
    ...(options.aiMode ? { aiMode: options.aiMode } : {}),
  };
}
