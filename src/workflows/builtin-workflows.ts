/**
 * ServalSheets - Builtin Workflows
 *
 * Pre-defined workflows for common multi-step operations.
 * Phase 3, Task 3.1
 */

import type { Workflow, WorkflowContext } from '../types/workflow.js';

/**
 * Workflow: Analyze and Fix Data Quality
 *
 * Triggered after data quality analysis, offers to automatically fix issues
 */
export const analyzeAndFixWorkflow: Workflow = {
  id: 'analyze_and_fix',
  name: 'Analyze and Fix Data Quality',
  description: 'Automatically fix data quality issues found in analysis',
  trigger: {
    action: 'sheets_analysis:data_quality',
    contextConditions: {
      hasDataQualityIssues: true,
    },
  },
  steps: [
    {
      description: 'Analyze data quality',
      action: 'sheets_analysis:data_quality',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        range: context['range'],
      }),
    },
    {
      description: 'Apply suggested fixes',
      action: 'sheets_values:batch_write',
      params: (context: WorkflowContext) => {
        const analysisResult = context.previousResults[0] as Record<string, unknown>;
        return {
          spreadsheetId: context['spreadsheetId'],
          updates: (analysisResult['suggestedFixes'] as unknown[]) || [],
        };
      },
      condition: (context: WorkflowContext) => {
        const result = context.previousResults[0] as Record<string, unknown>;
        return Boolean(result?.['suggestedFixes'] && Array.isArray(result['suggestedFixes']) && result['suggestedFixes'].length > 0);
      },
    },
    {
      description: 'Apply clean formatting',
      action: 'sheets_format:apply_theme',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        range: context['range'],
        theme: 'clean',
      }),
    },
  ],
  autoExecute: false,
  expectedImpact: 'Fix data quality issues, standardize formats, apply clean theme',
  estimatedDuration: 5,
  tags: ['data-quality', 'automation', 'cleanup'],
};

/**
 * Workflow: Import and Clean Data
 *
 * Triggered when appending data with headers, automatically cleans and formats
 */
export const importAndCleanWorkflow: Workflow = {
  id: 'import_and_clean',
  name: 'Import and Clean Data',
  description: 'Import data, detect types, apply formatting, and validate quality',
  trigger: {
    action: 'sheets_values:append',
    paramConditions: {
      hasHeaders: true,
    },
  },
  steps: [
    {
      description: 'Append data',
      action: 'sheets_values:append',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        range: context['range'],
        values: context['values'],
      }),
    },
    {
      description: 'Detect column types',
      action: 'sheets_analysis:detect_types',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        range: context['range'],
      }),
    },
    {
      description: 'Apply automatic formatting',
      action: 'sheets_format:auto_format',
      params: (context: WorkflowContext) => {
        const typeResult = context.previousResults[1] as Record<string, unknown>;
        return {
          spreadsheetId: context['spreadsheetId'],
          range: context['range'],
          columnTypes: (typeResult?.['columnTypes'] as Record<string, unknown>) || {},
        };
      },
    },
    {
      description: 'Validate data quality',
      action: 'sheets_analysis:data_quality',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        range: context['range'],
      }),
    },
  ],
  autoExecute: true,
  expectedImpact: 'Clean import with proper formatting and validation',
  estimatedDuration: 8,
  tags: ['import', 'data-cleaning', 'automation'],
};

/**
 * Workflow: Create Dashboard
 *
 * Triggered by user intent to create a dashboard
 */
export const createDashboardWorkflow: Workflow = {
  id: 'create_dashboard',
  name: 'Create Dashboard',
  description: 'Create a comprehensive dashboard with data, charts, and formatting',
  trigger: {
    userIntent: 'dashboard',
    contextConditions: {
      requiresDashboard: true,
    },
  },
  steps: [
    {
      description: 'Create new spreadsheet',
      action: 'sheets_spreadsheet:create',
      params: (context: WorkflowContext) => ({
        title: context['title'] || 'Dashboard',
      }),
    },
    {
      description: 'Add Data sheet',
      action: 'sheets_sheet:add',
      params: (context: WorkflowContext) => {
        const spreadsheetResult = context.previousResults[0] as Record<string, unknown>;
        return {
          spreadsheetId: spreadsheetResult?.['spreadsheetId'] as string,
          title: 'Data',
        };
      },
    },
    {
      description: 'Add Charts sheet',
      action: 'sheets_sheet:add',
      params: (context: WorkflowContext) => {
        const spreadsheetResult = context.previousResults[0] as Record<string, unknown>;
        return {
          spreadsheetId: spreadsheetResult?.['spreadsheetId'] as string,
          title: 'Charts',
        };
      },
    },
    {
      description: 'Calculate statistics',
      action: 'sheets_analysis:statistics',
      params: (context: WorkflowContext) => {
        const spreadsheetResult = context.previousResults[0] as Record<string, unknown>;
        return {
          spreadsheetId: spreadsheetResult?.['spreadsheetId'] as string,
          range: 'Data!A:Z',
        };
      },
    },
    {
      description: 'Create trend chart',
      action: 'sheets_charts:create',
      params: (context: WorkflowContext) => {
        const spreadsheetResult = context.previousResults[0] as Record<string, unknown>;
        const statsResult = context.previousResults[3] as Record<string, unknown>;
        return {
          spreadsheetId: spreadsheetResult?.['spreadsheetId'] as string,
          sheetId: 'Charts',
          type: 'LINE',
          data: (statsResult?.['timeSeries'] as Record<string, unknown>) || {},
          title: 'Trend Analysis',
        };
      },
      condition: (context: WorkflowContext) => {
        const stats = context.previousResults[3] as Record<string, unknown>;
        return stats?.['timeSeries'] !== undefined;
      },
    },
    {
      description: 'Apply dashboard theme',
      action: 'sheets_format:apply_theme',
      params: (context: WorkflowContext) => {
        const spreadsheetResult = context.previousResults[0] as Record<string, unknown>;
        return {
          spreadsheetId: spreadsheetResult?.['spreadsheetId'] as string,
          theme: 'dashboard',
        };
      },
    },
  ],
  autoExecute: false,
  expectedImpact: 'Professional dashboard with data, charts, and formatting',
  estimatedDuration: 15,
  tags: ['dashboard', 'visualization', 'automation'],
};

/**
 * Workflow: Prepare Report
 *
 * Triggered when user wants to create a report from data
 */
export const prepareReportWorkflow: Workflow = {
  id: 'prepare_report',
  name: 'Prepare Report',
  description: 'Generate a formatted report with summary statistics and insights',
  trigger: {
    userIntent: 'report',
  },
  steps: [
    {
      description: 'Calculate summary statistics',
      action: 'sheets_analysis:statistics',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        range: context['range'],
      }),
    },
    {
      description: 'Generate insights',
      action: 'sheets_analysis:insights',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        range: context['range'],
      }),
    },
    {
      description: 'Create summary sheet',
      action: 'sheets_sheet:add',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        title: 'Report Summary',
      }),
    },
    {
      description: 'Write summary to sheet',
      action: 'sheets_values:write',
      params: (context: WorkflowContext) => {
        const statsResult = context.previousResults[0] as Record<string, unknown>;
        const insightsResult = context.previousResults[1] as Record<string, unknown>;
        const sheetResult = context.previousResults[2] as Record<string, unknown>;

        return {
          spreadsheetId: context['spreadsheetId'] as string,
          range: `${sheetResult?.['title'] as string}!A1`,
          values: [
            ['Report Summary'],
            [''],
            ['Statistics'],
            ...Object.entries(statsResult || {}).map(([key, value]) => [key, value]),
            [''],
            ['Insights'],
            ...((insightsResult?.['insights'] as string[]) || []).map((insight: string) => [insight]),
          ],
        };
      },
    },
    {
      description: 'Apply report formatting',
      action: 'sheets_format:apply_theme',
      params: (context: WorkflowContext) => {
        const sheetResult = context.previousResults[2] as Record<string, unknown>;
        return {
          spreadsheetId: context['spreadsheetId'] as string,
          range: `${sheetResult?.['title'] as string}!A:Z`,
          theme: 'report',
        };
      },
    },
  ],
  autoExecute: false,
  expectedImpact: 'Professional report with statistics, insights, and formatting',
  estimatedDuration: 10,
  tags: ['report', 'analysis', 'automation'],
};

/**
 * Workflow: Cleanup Duplicates
 *
 * Triggered when duplicate detection finds duplicates
 */
export const cleanupDuplicatesWorkflow: Workflow = {
  id: 'cleanup_duplicates',
  name: 'Cleanup Duplicates',
  description: 'Find and remove duplicate rows from data',
  trigger: {
    action: 'sheets_analysis:find_duplicates',
  },
  steps: [
    {
      description: 'Find duplicate rows',
      action: 'sheets_analysis:find_duplicates',
      params: (context: WorkflowContext) => ({
        spreadsheetId: context['spreadsheetId'],
        range: context['range'],
        keyColumns: context['keyColumns'],
      }),
    },
    {
      description: 'Remove duplicate rows',
      action: 'sheets_sheet:delete_rows',
      params: (context: WorkflowContext) => {
        const duplicatesResult = context.previousResults[0] as Record<string, unknown>;
        return {
          spreadsheetId: context['spreadsheetId'] as string,
          sheetId: context['sheetId'] as string,
          rowIndices: (duplicatesResult?.['duplicateRows'] as number[]) || [],
        };
      },
      condition: (context: WorkflowContext) => {
        const result = context.previousResults[0] as Record<string, unknown>;
        return Boolean(result?.['duplicateRows'] && Array.isArray(result['duplicateRows']) && result['duplicateRows'].length > 0);
      },
    },
    {
      description: 'Log cleanup summary',
      action: 'sheets_analysis:log_operation',
      params: (context: WorkflowContext) => {
        const duplicatesResult = context.previousResults[0] as Record<string, unknown>;
        const duplicateRows = duplicatesResult?.['duplicateRows'];
        return {
          operation: 'cleanup_duplicates',
          rowsRemoved: Array.isArray(duplicateRows) ? duplicateRows.length : 0,
        };
      },
    },
  ],
  autoExecute: false,
  expectedImpact: 'Remove duplicate rows, clean data',
  estimatedDuration: 5,
  tags: ['cleanup', 'duplicates', 'data-quality'],
};

/**
 * All builtin workflows
 */
export const BUILTIN_WORKFLOWS: Workflow[] = [
  analyzeAndFixWorkflow,
  importAndCleanWorkflow,
  createDashboardWorkflow,
  prepareReportWorkflow,
  cleanupDuplicatesWorkflow,
];

/**
 * Get workflow by ID
 */
export function getWorkflowById(id: string): Workflow | undefined {
  return BUILTIN_WORKFLOWS.find((w) => w.id === id);
}

/**
 * Get workflows by tag
 */
export function getWorkflowsByTag(tag: string): Workflow[] {
  return BUILTIN_WORKFLOWS.filter((w) => w.tags?.includes(tag));
}
