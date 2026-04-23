/**
 * Verbosity Token Reduction Benchmark
 *
 * Measures actual byte and approximate token reduction when applying
 * `verbosity: 'minimal'` versus `verbosity: 'standard'` across five
 * representative response shapes. Replaces the aspirational "~40% less
 * tokens" claim with a measured floor assertion.
 *
 * Token approximation: GPT-style heuristic `Math.ceil(bytes / 4)`.
 *
 * Shapes are synthesised from fields that `applyVerbosityFilter` actually
 * filters (suggestions, nextSteps, documentation, warnings, relatedTools,
 * oversized non-preserved arrays) plus preserved arrays (values, headers,
 * sheets, rows, columns) so preservation-correctness is also exercised.
 */

import { describe, test, expect } from 'vitest';
import { applyVerbosityFilter } from '../../src/handlers/helpers/validation-helpers.js';

// deep-clone via JSON so the in-place minimal filter doesn't mutate the standard baseline
const clone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;

const approxTokens = (value: unknown): number =>
  Math.ceil(JSON.stringify(value).length / 4);

// --- Response shape fixtures (modelled on handler response patterns) ---

interface AnyRecord {
  success: boolean;
  [key: string]: unknown;
}

function coreGetShape(): AnyRecord {
  return {
    success: true,
    action: 'get',
    spreadsheetId: '1AbC'.repeat(10),
    metadata: {
      title: 'Quarterly Financials 2026',
      locale: 'en_US',
      timeZone: 'America/Los_Angeles',
    },
    sheets: Array.from({ length: 8 }, (_, i) => ({
      sheetId: 100 + i,
      title: `Sheet${i + 1}`,
      index: i,
      rowCount: 1000,
      columnCount: 26,
    })),
    suggestions: Array.from({ length: 10 }, (_, i) => ({
      id: `sug-${i}`,
      text: `Consider normalising column ${String.fromCharCode(65 + i)} to ISO date format`,
      category: 'data-quality',
      confidence: 0.85,
    })),
    nextSteps: Array.from({ length: 6 }, (_, i) => ({
      step: i + 1,
      tool: 'sheets_data',
      action: 'read',
      description: `Read rows ${i * 100 + 1}-${(i + 1) * 100} for validation`,
    })),
    documentation: {
      guide: 'https://docs.servalsheets.dev/guides/core-get',
      reference: 'https://docs.servalsheets.dev/reference/core',
      examples: [
        'sheets_core.get spreadsheetId=1ABC',
        'sheets_core.get spreadsheetId=1ABC verbosity=minimal',
        'sheets_core.get spreadsheetId=1ABC includeGridData=true',
      ],
    },
    warnings: [
      { code: 'PARTIAL_DATA', message: 'Some rows skipped due to permission' },
      { code: 'RATE_LIMIT_NEAR', message: 'Approaching Google API quota' },
    ],
    relatedTools: ['sheets_data', 'sheets_analyze', 'sheets_dimensions'],
    _meta: {
      durationMs: 42,
      cacheHit: false,
      retries: 0,
      correlationId: 'req-abc-123',
    },
  };
}

function dataReadShape(): AnyRecord {
  return {
    success: true,
    action: 'read',
    values: Array.from({ length: 50 }, (_, i) => [
      `Row ${i + 1}`,
      (i + 1) * 100,
      `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    ]),
    headers: ['Label', 'Amount', 'Date'],
    range: 'Sheet1!A1:C50',
    majorDimension: 'ROWS',
    suggestions: Array.from({ length: 8 }, (_, i) => `Hint ${i}: adjust column widths`),
    documentation: {
      guide: 'https://docs.servalsheets.dev/guides/data-read',
      examples: ['range=Sheet1!A1:C50', 'range=A:C'],
    },
    warnings: ['Header row detected but not isolated — consider skipHeader=true'],
    _meta: { durationMs: 15, cacheHit: true },
  };
}

function analyzeComprehensiveShape(): AnyRecord {
  return {
    success: true,
    action: 'comprehensive',
    summary: {
      totalRows: 5000,
      totalColumns: 12,
      qualityScore: 0.82,
      formulaCount: 47,
    },
    findings: Array.from({ length: 20 }, (_, i) => ({
      id: `finding-${i}`,
      severity: i % 3 === 0 ? 'high' : 'medium',
      title: `Inconsistent formatting in column ${String.fromCharCode(65 + (i % 12))}`,
      description:
        'Cells mix text and numeric formats which can break aggregation formulas downstream.',
      affectedRange: `Sheet1!${String.fromCharCode(65 + (i % 12))}1:${String.fromCharCode(65 + (i % 12))}5000`,
    })),
    suggestions: Array.from({ length: 15 }, (_, i) => ({
      id: `sug-${i}`,
      action: 'sheets_fix',
      description: `Normalise column ${i} via sheets_fix.normalize_column`,
    })),
    nextSteps: Array.from({ length: 10 }, (_, i) => `Next step ${i + 1}: review finding ${i}`),
    documentation: {
      analysis: 'https://docs.servalsheets.dev/guides/analyze-comprehensive',
      bestPractices: 'https://docs.servalsheets.dev/patterns/data-quality',
    },
    warnings: Array.from({ length: 5 }, (_, i) => `Warning ${i}: partial scan applied`),
    relatedTools: ['sheets_fix', 'sheets_quality', 'sheets_data'],
    _meta: {
      durationMs: 1800,
      sheetsAnalyzed: 3,
      samplingApplied: true,
    },
  };
}

function sessionContextShape(): AnyRecord {
  return {
    success: true,
    action: 'get_context',
    connectors: {
      zeroAuth: ['csv', 'excel-online'],
      oauthReady: ['google-sheets', 'airtable', 'notion'],
    },
    activeSpreadsheet: {
      id: '1xyz',
      title: 'Budget 2026',
      lastOperation: 'write',
      lastOperationAt: '2026-04-22T12:00:00Z',
    },
    preferences: {
      verbosity: 'standard',
      autoRecord: true,
      confirmMutations: true,
    },
    suggestions: Array.from({ length: 12 }, (_, i) => `Tip ${i}: set autoRecord=true`),
    nextSteps: Array.from({ length: 8 }, (_, i) => ({ step: i + 1, action: 'read' })),
    documentation: {
      patterns: 'https://docs.servalsheets.dev/patterns/session',
    },
    warnings: [],
    relatedTools: ['sheets_core', 'sheets_data', 'sheets_agent'],
    _meta: { durationMs: 3 },
  };
}

function agentPlanShape(): AnyRecord {
  return {
    success: true,
    action: 'plan',
    plan: {
      goal: 'Clean and normalise 2026 budget spreadsheet',
      steps: Array.from({ length: 8 }, (_, i) => ({
        stepNumber: i + 1,
        tool: 'sheets_data',
        action: 'write',
        description: `Write batch ${i + 1}`,
        risk: 'low',
      })),
      estimatedApiCalls: 12,
      estimatedDurationMs: 4500,
    },
    suggestions: Array.from({ length: 10 }, (_, i) => ({
      id: `alt-${i}`,
      description: `Alternative path ${i}: use transaction wrapper`,
    })),
    nextSteps: Array.from({ length: 6 }, (_, i) => `Invoke step ${i + 1}`),
    documentation: {
      planning: 'https://docs.servalsheets.dev/guides/agent-plan',
      execution: 'https://docs.servalsheets.dev/guides/agent-execute',
    },
    warnings: ['Dry-run recommended before execute'],
    relatedTools: ['sheets_transaction', 'sheets_confirm'],
    _meta: { durationMs: 220, model: 'internal-planner-v2' },
  };
}

interface Measurement {
  name: string;
  standardBytes: number;
  minimalBytes: number;
  standardTokens: number;
  minimalTokens: number;
  byteReductionPct: number;
  tokenReductionPct: number;
}

function measure(name: string, build: () => AnyRecord): Measurement {
  const standard = build();
  const minimalInput = clone(standard);
  const minimal = applyVerbosityFilter(minimalInput, 'minimal');

  const standardJson = JSON.stringify(standard);
  const minimalJson = JSON.stringify(minimal);

  const standardBytes = standardJson.length;
  const minimalBytes = minimalJson.length;
  const standardTokens = approxTokens(standard);
  const minimalTokens = approxTokens(minimal);

  return {
    name,
    standardBytes,
    minimalBytes,
    standardTokens,
    minimalTokens,
    byteReductionPct: ((standardBytes - minimalBytes) / standardBytes) * 100,
    tokenReductionPct: ((standardTokens - minimalTokens) / standardTokens) * 100,
  };
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  const m = mean(values);
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

describe('verbosity minimal vs standard token reduction', () => {
  const shapes: Array<[string, () => AnyRecord]> = [
    ['sheets_core.get', coreGetShape],
    ['sheets_data.read', dataReadShape],
    ['sheets_analyze.comprehensive', analyzeComprehensiveShape],
    ['sheets_session.get_context', sessionContextShape],
    ['sheets_agent.plan', agentPlanShape],
  ];

  const measurements = shapes.map(([name, build]) => measure(name, build));

  test('minimal reduces token count below standard for every shape', () => {
    for (const m of measurements) {
      expect(m.minimalTokens).toBeLessThan(m.standardTokens);
      expect(m.tokenReductionPct).toBeGreaterThan(0);
    }
  });

  test('mean token reduction across 5 shapes is at least 20%', () => {
    const reductions = measurements.map((m) => m.tokenReductionPct);
    const avg = mean(reductions);
    const sd = stddev(reductions);

    // Log computed range so CI captures the real number alongside test output
    // eslint-disable-next-line no-console
    console.log(
      `verbosity minimal reduction: mean=${avg.toFixed(1)}% stddev=${sd.toFixed(1)}% per-shape=${reductions
        .map((r, i) => `${measurements[i]!.name}:${r.toFixed(1)}%`)
        .join(', ')}`
    );

    expect(avg).toBeGreaterThanOrEqual(20);
  });

  test('minimal preserves values/headers/sheets arrays even when large', () => {
    const data = dataReadShape();
    const minimal = applyVerbosityFilter(clone(data), 'minimal') as AnyRecord;
    // preserved arrays retain their full length
    expect((minimal['values'] as unknown[]).length).toBe(
      (data['values'] as unknown[]).length
    );
    expect((minimal['headers'] as unknown[]).length).toBe(3);
  });

  test('per-shape measurements match pinned snapshot shape (drift detector)', () => {
    // Snapshot stores the measured range so a regression in filter behaviour
    // produces a reviewable diff. Values are bucketed via Math.round to tolerate
    // immaterial fluctuations across Node versions but catch real drift.
    const bucketed = measurements.map((m) => ({
      name: m.name,
      standardTokens: m.standardTokens,
      minimalTokens: m.minimalTokens,
      tokenReductionPctRounded: Math.round(m.tokenReductionPct),
    }));
    expect(bucketed).toMatchSnapshot();
  });
});
