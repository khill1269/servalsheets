/**
 * ServalSheets - Prompts Catalog Resource
 *
 * Organizes registered prompts into scenario buckets so LLMs
 * can quickly find the right prompt for a given task.
 *
 * URI: servalsheets://prompts/catalog
 *
 * @module resources/prompts-catalog
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface PromptEntry {
  name: string;
  description: string;
}

interface PromptBucket {
  description: string;
  whenToUse: string;
  prompts: PromptEntry[];
}

const PROMPT_CATALOG: Record<string, PromptBucket> = {
  first_time: {
    description: 'Onboarding and initial setup prompts',
    whenToUse: 'When a user is new to ServalSheets or needs an introduction',
    prompts: [
      { name: 'welcome', description: 'Guided introduction to ServalSheets capabilities' },
      { name: 'test_connection', description: 'Verify connectivity and authentication' },
      { name: 'first_operation', description: 'Walk through your very first read or write' },
      { name: 'full_setup', description: 'End-to-end workspace setup for a new project' },
    ],
  },
  analyze: {
    description: 'Spreadsheet analysis and insight extraction',
    whenToUse: 'When user wants to understand data, get summaries, or compare spreadsheets',
    prompts: [
      { name: 'analyze_spreadsheet', description: 'Comprehensive analysis of a spreadsheet' },
      { name: 'auto_analyze', description: 'Automated analysis with AI-generated insights' },
      {
        name: 'ultimate_analysis',
        description: 'Deep multi-pass analysis with scoring and recommendations',
      },
      { name: 'compare_spreadsheets', description: 'Side-by-side comparison of two spreadsheets' },
      {
        name: 'analyze_with_history',
        description: 'Analysis that includes version history and change tracking',
      },
      {
        name: 'performance_audit',
        description: 'Identify slow formulas, excess volatility, calculation bottlenecks',
      },
    ],
  },
  clean_data: {
    description: 'Data quality, cleaning, and normalization',
    whenToUse: 'When data has errors, inconsistencies, formatting issues, or duplicates',
    prompts: [
      { name: 'clean_data', description: 'Interactive guided data cleaning workflow' },
      {
        name: 'automated_data_cleaning',
        description: 'Fully automated cleaning with AI decisions',
      },
      {
        name: 'fix_data_quality',
        description: 'Target and fix specific quality issues (blanks, types, outliers)',
      },
      {
        name: 'masterclass_data_quality',
        description: 'Expert-level data quality standards and validation patterns',
      },
    ],
  },
  import_export: {
    description: 'Data import, export, and migration',
    whenToUse:
      'When moving data into or out of Google Sheets from CSV, Excel, databases, or other sheets',
    prompts: [
      { name: 'import_data', description: 'Import data from CSV, Excel, or external source' },
      { name: 'bulk_import', description: 'High-volume import with progress tracking' },
      {
        name: 'bulk_import_data',
        description: 'Bulk import with schema validation and error handling',
      },
      {
        name: 'advanced_data_migration',
        description: 'Complex migration with transformation rules and mapping',
      },
      { name: 'migrate_data', description: 'Migrate data between sheets or spreadsheets' },
      {
        name: 'migrate_spreadsheet',
        description: 'Full spreadsheet migration with structure and data',
      },
    ],
  },
  automate: {
    description: 'Automation, pipelines, and sheet generation',
    whenToUse:
      'When user wants to create automation, set up recurring workflows, or generate a sheet from a description',
    prompts: [
      {
        name: 'generate_sheet_from_description',
        description: 'Generate a complete sheet from a natural language description',
      },
      { name: 'full_setup', description: 'Complete project setup from scratch' },
      { name: 'batch_optimizer', description: 'Optimize batch operations for quota efficiency' },
      {
        name: 'data_pipeline',
        description: 'Set up an automated data ingestion and processing pipeline',
      },
    ],
  },
  troubleshoot: {
    description: 'Debugging, error recovery, and undo',
    whenToUse:
      'When something went wrong: formula errors, data loss, performance issues, unexpected results',
    prompts: [
      {
        name: 'diagnose_errors',
        description: 'Find and diagnose formula and data errors (#REF!, #VALUE!, etc.)',
      },
      {
        name: 'recover_from_error',
        description: 'Step-by-step recovery from a specific error code',
      },
      { name: 'troubleshoot_performance', description: 'Debug slow spreadsheet performance' },
      {
        name: 'undo_changes',
        description: 'Safely undo recent operations with history inspection',
      },
    ],
  },
  formulas: {
    description: 'Formula generation, optimization, and education',
    whenToUse: 'When working with formulas: creating, debugging, optimizing, or learning',
    prompts: [
      {
        name: 'optimize_formulas',
        description: 'Reduce formula complexity and improve calculation speed',
      },
      {
        name: 'masterclass_formulas',
        description: 'Advanced formula patterns: LAMBDA, MAP, SCAN, array formulas',
      },
      {
        name: 'masterclass_performance',
        description: 'Formula performance tuning and volatile function reduction',
      },
    ],
  },
  collaborate: {
    description: 'Sharing, permissions, and team workflows',
    whenToUse:
      'When managing who can access or edit a spreadsheet, reviewing audit trails, or setting up safe-operation guidelines',
    prompts: [
      { name: 'setup_collaboration', description: 'Configure sharing, comments, and team access' },
      { name: 'audit_security', description: 'Audit current permissions and sharing settings' },
      {
        name: 'safe_operation',
        description: 'Guidelines for making changes safely in shared spreadsheets',
      },
      {
        name: 'audit_sheet',
        description: 'Full audit: data quality, formulas, permissions, history',
      },
      { name: 'publish_report', description: 'Prepare and publish a sheet as a shareable report' },
    ],
  },
  visualize: {
    description: 'Charts, dashboards, and pivot tables',
    whenToUse: 'When user wants to create visual representations of data',
    prompts: [
      {
        name: 'create_visualization',
        description: 'Create charts or pivot tables from sheet data',
      },
      {
        name: 'create_report',
        description: 'Generate a structured report with charts and formatting',
      },
      { name: 'analyze_with_history', description: 'Analysis with historical trend visualization' },
    ],
  },
  advanced: {
    description: 'Advanced workflows: scenarios, federation, templates, and AI assistance',
    whenToUse:
      'For power users: what-if modeling, cross-spreadsheet workflows, template management, or AI suggestions',
    prompts: [
      { name: 'what_if_scenario_modeling', description: 'Build and compare what-if scenarios' },
      {
        name: 'cross_spreadsheet_federation',
        description: 'Query and combine data across multiple spreadsheets',
      },
      {
        name: 'smart_suggestions_copilot',
        description: 'AI-powered suggestions for next actions based on current data',
      },
      { name: 'instantiate_template', description: 'Create a new sheet from a saved template' },
      { name: 'transform_data', description: 'Transform data structure, pivot, or reshape' },
      {
        name: 'setup_budget',
        description: 'Set up a budget tracking spreadsheet with formulas and charts',
      },
      {
        name: 'when_to_confirm',
        description: 'Learn when to use confirmation before destructive operations',
      },
      {
        name: 'confirmation_examples',
        description: 'Examples of confirmation workflows for safe mutations',
      },
      {
        name: 'scenario_multi_user',
        description: 'Multi-user scenario with concurrent editing patterns',
      },
      {
        name: 'challenge_quality_detective',
        description: 'Gamified data quality challenge workflow',
      },
      {
        name: 'challenge_performance_profiler',
        description: 'Performance profiling challenge workflow',
      },
    ],
  },
};

export function getPromptsCatalogCount(): number {
  const promptNames = new Set<string>();
  for (const bucket of Object.values(PROMPT_CATALOG)) {
    for (const prompt of bucket.prompts) {
      promptNames.add(prompt.name);
    }
  }
  return promptNames.size;
}

/**
 * Register the prompts catalog resource.
 */
export function registerPromptsCatalogResource(server: McpServer): void {
  const totalPrompts = getPromptsCatalogCount();

  server.registerResource(
    'ServalSheets Prompts Catalog',
    'servalsheets://prompts/catalog',
    {
      description: `All ${totalPrompts} ServalSheets prompts organized by scenario. Use to find the right prompt for analyze, clean, import, automate, troubleshoot, formulas, collaborate, visualize, and advanced workflows.`,
      mimeType: 'application/json',
    },
    async (uri) => {
      const catalog = {
        $schema: 'servalsheets://prompts/catalog',
        total: totalPrompts,
        usage: 'Find your scenario in the buckets below. Use the prompt name with MCP prompts/get.',
        buckets: PROMPT_CATALOG,
      };

      return {
        contents: [
          {
            uri: typeof uri === 'string' ? uri : uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(catalog, null, 2),
          },
        ],
      };
    }
  );
}
