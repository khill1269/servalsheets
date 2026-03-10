/**
 * Flow Catalog Resource
 *
 * Exposes static descriptions of all 7 pre-built multi-step workflows
 * as MCP resources, without requiring a spreadsheetId at registration time.
 *
 * @category Resources
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FlowType } from '../analysis/flow-orchestrator.js';

const FLOW_DESCRIPTIONS: Record<
  FlowType,
  {
    name: string;
    description: string;
    estimatedTotalMs: number;
    stepCount: number;
    useWhen: string;
  }
> = {
  deep_understanding: {
    name: 'Deep Understanding',
    description:
      'Scout → Confidence → Elicit → Comprehensive → Store. Builds complete knowledge of a spreadsheet before taking any actions.',
    estimatedTotalMs: 15000,
    stepCount: 5,
    useWhen:
      'Starting work on an unfamiliar spreadsheet or after receiving a complex user request.',
  },
  smart_cleanup: {
    name: 'Smart Cleanup',
    description:
      'Analyze quality → Generate actions → Confirm → Execute batch. Systematically finds and fixes data quality issues.',
    estimatedTotalMs: 30000,
    stepCount: 4,
    useWhen: 'User asks to clean data, fix errors, or improve data quality.',
  },
  sheet_setup: {
    name: 'Sheet Setup',
    description:
      'Analyze template → Create structure → Format → Validate. Sets up a new sheet with proper structure and formatting.',
    estimatedTotalMs: 20000,
    stepCount: 4,
    useWhen: 'Creating a new sheet or reorganizing an existing one from scratch.',
  },
  data_import: {
    name: 'Data Import',
    description:
      'Import → Analyze → Clean → Validate → Report. End-to-end data import with quality assurance.',
    estimatedTotalMs: 45000,
    stepCount: 5,
    useWhen: 'Importing data from CSV, JSON, or external sources into a spreadsheet.',
  },
  visualization_builder: {
    name: 'Visualization Builder',
    description:
      'Analyze data → Suggest viz → Create charts → Format. Builds optimal visualizations from data.',
    estimatedTotalMs: 25000,
    stepCount: 4,
    useWhen: 'Creating charts, graphs, or visualizations from existing data.',
  },
  audit_and_fix: {
    name: 'Audit and Fix',
    description:
      'Comprehensive → Quality → Performance → Generate fixes → Apply. Deep audit with automated remediation.',
    estimatedTotalMs: 60000,
    stepCount: 5,
    useWhen:
      'Full audit of a production spreadsheet; finding and fixing all issues systematically.',
  },
  relationship_mapping: {
    name: 'Relationship Mapping',
    description:
      'Scout → Analyze formulas → Dependencies → Visualize. Maps all formula dependencies and cell relationships.',
    estimatedTotalMs: 20000,
    stepCount: 4,
    useWhen:
      'Understanding complex formula chains, auditing formula dependencies, or debugging reference errors.',
  },
};

const FLOW_TYPES: FlowType[] = Object.keys(FLOW_DESCRIPTIONS) as FlowType[];

export function registerFlowResources(server: McpServer): void {
  // List all available flows
  server.registerResource(
    'Available Workflow Definitions',
    'flows://list',
    {
      description: 'All 7 pre-built multi-step workflows for common spreadsheet operations',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'flows://list',
          mimeType: 'application/json',
          text: JSON.stringify({
            flows: FLOW_TYPES.map((type) => ({ type, ...FLOW_DESCRIPTIONS[type] })),
            total: FLOW_TYPES.length,
            usage:
              'Use sheets_analyze.plan_execute with a flowType to execute a workflow. See flows://{type} for individual step details.',
          }),
        },
      ],
    })
  );

  // Individual flow definitions
  for (const flowType of FLOW_TYPES) {
    const capturedType = flowType;
    const capturedDef = FLOW_DESCRIPTIONS[flowType];
    server.registerResource(
      capturedDef.name,
      `flows://${capturedType}`,
      {
        description: capturedDef.description,
        mimeType: 'application/json',
      },
      async () => ({
        contents: [
          {
            uri: `flows://${capturedType}`,
            mimeType: 'application/json',
            text: JSON.stringify({ type: capturedType, ...capturedDef }),
          },
        ],
      })
    );
  }
}
