/**
 * ServalSheets — Deterministic Scenario Catalog
 *
 * CLI usage:
 *   npx tsx tests/stress/scenario-catalog.ts --print
 *   Prints a summary of all generated scenarios to stdout.
 *
 * Generates varied test scenarios programmatically, enabling simulation
 * of 1000+ different flows without manual test authorship.
 *
 * All data generation is fully deterministic — no Math.random() calls.
 * Row index is used as the sole entropy source.
 */

export interface ScenarioTemplate {
  id: string;
  name: string;
  category:
    | 'sequential-io'
    | 'concurrent-read'
    | 'batch-write'
    | 'analysis'
    | 'agent-workflow'
    | 'error-recovery'
    | 'dashboard-build'
    | 'data-cleaning';
  concurrentUsers: 1 | 5 | 10 | 25 | 50;
  dataScale: 'tiny' | 'small' | 'medium' | 'large';
  faults?: Array<'quota-429' | 'network-latency' | 'partial-batch-fail' | 'circuit-open'>;
  steps: Array<{
    tool: string;
    action: string;
    params: (spreadsheetId: string, sheetName: string, rowCount: number) => Record<string, unknown>;
  }>;
  successCriteria: {
    minSuccessRate: number; // 0-1
    maxP95LatencyMs: number;
    maxMemoryGrowthMB: number;
  };
}

/**
 * Row count map for each data scale.
 */
const ROW_COUNTS: Record<ScenarioTemplate['dataScale'], number> = {
  tiny: 10,
  small: 100,
  medium: 1000,
  large: 5000,
};

/**
 * Generate the full catalog of 50+ scenario templates.
 * Covers all 8 category types across varying scale and concurrency combinations.
 */
export function generateScenarioCatalog(): ScenarioTemplate[] {
  const templates: ScenarioTemplate[] = [];

  // ─────────────────────────────────────────────────────────────────────────────
  // Sequential I/O variants: scale × concurrency = 4 × 5 = 20 scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  for (const scale of ['tiny', 'small', 'medium', 'large'] as const) {
    for (const users of [1, 5, 10, 25, 50] as const) {
      templates.push({
        id: `seq-io-${scale}-${users}u`,
        name: `Sequential I/O (${scale} data, ${users} user${users > 1 ? 's' : ''})`,
        category: 'sequential-io',
        concurrentUsers: users,
        dataScale: scale,
        steps: [
          {
            tool: 'sheets_data',
            action: 'read',
            params: (id, sheet, rows) => ({
              spreadsheetId: id,
              range: `${sheet}!A1:D${Math.min(rows, 1000)}`,
            }),
          },
          {
            tool: 'sheets_analyze',
            action: 'scout',
            params: (id) => ({ spreadsheetId: id }),
          },
          {
            tool: 'sheets_data',
            action: 'write',
            params: (id, sheet) => ({
              spreadsheetId: id,
              range: `${sheet}!F1`,
              values: [['=NOW()']],
            }),
          },
        ],
        successCriteria: {
          minSuccessRate: 0.99,
          maxP95LatencyMs: 2000,
          maxMemoryGrowthMB: 50,
        },
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Concurrent-read variants: 5 scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  for (const users of [5, 10, 25, 50] as const) {
    templates.push({
      id: `concurrent-read-${users}u`,
      name: `Concurrent Read Storm (${users} users)`,
      category: 'concurrent-read',
      concurrentUsers: users,
      dataScale: 'medium',
      steps: [
        {
          tool: 'sheets_data',
          action: 'read',
          params: (id, sheet) => ({
            spreadsheetId: id,
            range: `${sheet}!A1:Z100`,
          }),
        },
        {
          tool: 'sheets_data',
          action: 'read',
          params: (id, sheet) => ({
            spreadsheetId: id,
            range: `${sheet}!A101:Z200`,
          }),
        },
      ],
      successCriteria: {
        minSuccessRate: 0.98,
        maxP95LatencyMs: 3000,
        maxMemoryGrowthMB: 80,
      },
    });
  }
  // Add one with tiny scale to complete 5
  templates.push({
    id: 'concurrent-read-1u-tiny',
    name: 'Concurrent Read Single User (tiny)',
    category: 'concurrent-read',
    concurrentUsers: 1,
    dataScale: 'tiny',
    steps: [
      {
        tool: 'sheets_data',
        action: 'read',
        params: (id, sheet) => ({ spreadsheetId: id, range: `${sheet}!A1:Z10` }),
      },
    ],
    successCriteria: {
      minSuccessRate: 1.0,
      maxP95LatencyMs: 500,
      maxMemoryGrowthMB: 20,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Analysis workflows: 5 scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  for (const scale of ['tiny', 'small', 'medium', 'large'] as const) {
    templates.push({
      id: `analysis-${scale}`,
      name: `Analysis Workflow (${scale})`,
      category: 'analysis',
      concurrentUsers: 1,
      dataScale: scale,
      steps: [
        {
          tool: 'sheets_analyze',
          action: 'scout',
          params: (id) => ({ spreadsheetId: id }),
        },
        {
          tool: 'sheets_analyze',
          action: 'compute_statistics',
          params: (id, sheet, rows) => ({
            spreadsheetId: id,
            range: `${sheet}!C2:C${Math.min(rows, 1000) + 1}`,
          }),
        },
        {
          tool: 'sheets_quality',
          action: 'validate',
          params: (id, sheet, rows) => ({
            spreadsheetId: id,
            range: `${sheet}!A1:G${Math.min(rows, 1000) + 1}`,
          }),
        },
      ],
      successCriteria: {
        minSuccessRate: 0.95,
        maxP95LatencyMs: 5000,
        maxMemoryGrowthMB: 100,
      },
    });
  }
  templates.push({
    id: 'analysis-pivot',
    name: 'Analysis Pivot Summary',
    category: 'analysis',
    concurrentUsers: 5,
    dataScale: 'small',
    steps: [
      {
        tool: 'sheets_analyze',
        action: 'summarize',
        params: (id, sheet) => ({
          spreadsheetId: id,
          range: `${sheet}!A1:G101`,
          groupBy: 'Region',
        }),
      },
    ],
    successCriteria: {
      minSuccessRate: 0.95,
      maxP95LatencyMs: 3000,
      maxMemoryGrowthMB: 60,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Dashboard builds: 5 scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  const dashboardChartTypes = ['bar', 'line', 'pie', 'column', 'scatter'] as const;
  for (let i = 0; i < dashboardChartTypes.length; i++) {
    const chartType = dashboardChartTypes[i];
    templates.push({
      id: `dashboard-${chartType}`,
      name: `Dashboard Build (${chartType} chart)`,
      category: 'dashboard-build',
      concurrentUsers: 1,
      dataScale: 'small',
      steps: [
        {
          tool: 'sheets_data',
          action: 'read',
          params: (id, sheet) => ({
            spreadsheetId: id,
            range: `${sheet}!A1:G101`,
          }),
        },
        {
          tool: 'sheets_format',
          action: 'apply_conditional_format',
          params: (id, sheet) => ({
            spreadsheetId: id,
            range: `${sheet}!C2:C101`,
            rule: { type: 'GRADIENT', minValue: 0, maxValue: 10000 },
          }),
        },
        {
          tool: 'sheets_visualize',
          action: 'chart_create',
          params: (id, sheet) => ({
            spreadsheetId: id,
            sheetName: sheet,
            chartType: chartType.toUpperCase(),
            dataRange: `${sheet}!A1:D11`,
            title: `${chartType} chart - Dashboard`,
          }),
        },
      ],
      successCriteria: {
        minSuccessRate: 0.9,
        maxP95LatencyMs: 4000,
        maxMemoryGrowthMB: 80,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Data cleaning: 5 scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  const cleaningOps = [
    { id: 'trim-whitespace', action: 'trim_whitespace', label: 'Trim Whitespace' },
    { id: 'remove-duplicates', action: 'deduplicate', label: 'Remove Duplicates' },
    { id: 'fix-dates', action: 'standardize_dates', label: 'Fix Date Formats' },
    { id: 'fill-blanks', action: 'fill_blanks', label: 'Fill Blank Cells' },
    { id: 'normalize-case', action: 'normalize_case', label: 'Normalize Text Case' },
  ] as const;

  for (const op of cleaningOps) {
    templates.push({
      id: `data-cleaning-${op.id}`,
      name: `Data Cleaning — ${op.label}`,
      category: 'data-cleaning',
      concurrentUsers: 1,
      dataScale: 'small',
      steps: [
        {
          tool: 'sheets_fix',
          action: 'clean',
          params: (id, sheet) => ({
            spreadsheetId: id,
            range: `${sheet}!A1:G101`,
            operations: [op.action],
          }),
        },
        {
          tool: 'sheets_quality',
          action: 'validate',
          params: (id, sheet) => ({
            spreadsheetId: id,
            range: `${sheet}!A1:G101`,
          }),
        },
      ],
      successCriteria: {
        minSuccessRate: 0.95,
        maxP95LatencyMs: 3000,
        maxMemoryGrowthMB: 50,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Agent workflows: 5 scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  const agentGoals = [
    { id: 'summarize-sales', goal: 'Summarize monthly sales by region' },
    { id: 'find-outliers', goal: 'Identify revenue outliers in dataset' },
    { id: 'build-kpi', goal: 'Build KPI dashboard for product metrics' },
    { id: 'clean-import', goal: 'Clean and standardize imported CSV data' },
    { id: 'forecast-trend', goal: 'Project Q4 revenue trend from Q1-Q3 data' },
  ] as const;

  for (const task of agentGoals) {
    templates.push({
      id: `agent-${task.id}`,
      name: `Agent Workflow — ${task.goal}`,
      category: 'agent-workflow',
      concurrentUsers: 1,
      dataScale: 'small',
      steps: [
        {
          tool: 'sheets_agent',
          action: 'plan',
          params: (id) => ({
            spreadsheetId: id,
            goal: task.goal,
          }),
        },
        {
          tool: 'sheets_agent',
          action: 'execute',
          params: (id) => ({
            spreadsheetId: id,
            planId: 'plan-0001',
            interactiveMode: false,
          }),
        },
      ],
      successCriteria: {
        minSuccessRate: 0.85,
        maxP95LatencyMs: 10000,
        maxMemoryGrowthMB: 150,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Error recovery: 5 scenarios (with fault injection)
  // ─────────────────────────────────────────────────────────────────────────────
  const faultScenarios: Array<{
    id: string;
    label: string;
    faults: ScenarioTemplate['faults'];
  }> = [
    {
      id: 'quota-429',
      label: 'Quota Exceeded (429)',
      faults: ['quota-429'],
    },
    {
      id: 'network-latency',
      label: 'Network Latency Spike',
      faults: ['network-latency'],
    },
    {
      id: 'partial-batch-fail',
      label: 'Partial Batch Failure',
      faults: ['partial-batch-fail'],
    },
    {
      id: 'circuit-open',
      label: 'Circuit Breaker Open',
      faults: ['circuit-open'],
    },
    {
      id: 'quota-plus-latency',
      label: 'Combined: Quota + Latency',
      faults: ['quota-429', 'network-latency'],
    },
  ];

  for (const fault of faultScenarios) {
    templates.push({
      id: `error-recovery-${fault.id}`,
      name: `Error Recovery — ${fault.label}`,
      category: 'error-recovery',
      concurrentUsers: 10,
      dataScale: 'small',
      faults: fault.faults,
      steps: [
        {
          tool: 'sheets_data',
          action: 'read',
          params: (id, sheet) => ({
            spreadsheetId: id,
            range: `${sheet}!A1:D101`,
          }),
        },
        {
          tool: 'sheets_data',
          action: 'write',
          params: (id, sheet) => ({
            spreadsheetId: id,
            range: `${sheet}!F1`,
            values: [['recovery-marker']],
          }),
        },
      ],
      successCriteria: {
        // Lower bar — faults expected; we just want graceful degradation
        minSuccessRate: 0.7,
        maxP95LatencyMs: 15000,
        maxMemoryGrowthMB: 80,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Batch write: 5 scenarios
  // ─────────────────────────────────────────────────────────────────────────────
  for (const scale of ['tiny', 'small', 'medium', 'large'] as const) {
    templates.push({
      id: `batch-write-${scale}`,
      name: `Batch Write (${scale})`,
      category: 'batch-write',
      concurrentUsers: 1,
      dataScale: scale,
      steps: [
        {
          tool: 'sheets_data',
          action: 'batch_update',
          params: (id, sheet, rows) => ({
            spreadsheetId: id,
            updates: Array.from({ length: Math.min(rows, 50) }, (_, i) => ({
              range: `${sheet}!G${i + 2}`,
              values: [[(i + 1) * 100]],
            })),
          }),
        },
      ],
      successCriteria: {
        minSuccessRate: 0.99,
        maxP95LatencyMs: 5000,
        maxMemoryGrowthMB: 100,
      },
    });
  }
  templates.push({
    id: 'batch-write-25u',
    name: 'Batch Write (concurrent, 25 users)',
    category: 'batch-write',
    concurrentUsers: 25,
    dataScale: 'tiny',
    steps: [
      {
        tool: 'sheets_data',
        action: 'write',
        params: (id, sheet) => ({
          spreadsheetId: id,
          range: `${sheet}!A1`,
          values: [['batch-marker']],
        }),
      },
    ],
    successCriteria: {
      minSuccessRate: 0.95,
      maxP95LatencyMs: 3000,
      maxMemoryGrowthMB: 60,
    },
  });

  return templates;
}

/**
 * Generate deterministic test data for a given scale.
 *
 * Uses the row index as the sole entropy source — no Math.random() calls.
 * Two calls with the same scale must always return byte-identical results.
 *
 * @param scale - Data scale tier
 * @returns 2D array: first row is headers, remaining rows are data
 */
export function generateTestData(scale: 'tiny' | 'small' | 'medium' | 'large'): unknown[][] {
  const rows = ROW_COUNTS[scale];
  const headers = ['Date', 'Product', 'Revenue', 'Cost', 'Units', 'Region', 'Status'];
  const products = ['Widget A', 'Widget B', 'Widget C', 'Gadget X', 'Service Y'];
  const regions = ['North', 'South', 'East', 'West'];
  const statuses = ['Active', 'Pending', 'Closed'];

  const data: unknown[][] = [headers];

  for (let i = 0; i < rows; i++) {
    const dayOffset = i % 365;
    const product = products[i % products.length];
    const revenue = 1000 + ((i * 137) % 9000); // deterministic variation
    const cost = Math.floor(revenue * 0.6);
    const units = 10 + (i % 90);
    const region = regions[i % regions.length];
    const status = statuses[i % statuses.length];
    const month = String(Math.floor(dayOffset / 30) + 1).padStart(2, '0');
    const day = String((dayOffset % 28) + 1).padStart(2, '0');
    const date = `2026-${month}-${day}`;
    data.push([date, product, revenue, cost, units, region, status]);
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI entry point (npx tsx tests/stress/scenario-catalog.ts --print)
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv.includes('--print')) {
  const catalog = generateScenarioCatalog();
  const byCategory = new Map<string, number>();
  for (const s of catalog) {
    byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + 1);
  }

  console.log('\nServalSheets Scenario Catalog');
  console.log('─'.repeat(50));
  console.log(`Total scenarios: ${catalog.length}`);
  console.log('\nBy category:');
  for (const [cat, count] of byCategory) {
    console.log(`  ${cat.padEnd(20)} ${count}`);
  }
  console.log('\nAll scenario IDs:');
  for (const s of catalog) {
    console.log(`  ${s.id}`);
  }
}
