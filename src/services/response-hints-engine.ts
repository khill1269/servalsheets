/**
 * Response Hints Engine
 *
 * Generates Chain-of-Thought `_hints` annotations injected into successful
 * sheets_data.read / batch_read / cross_read responses so the LLM understands
 * what it is looking at before deciding what to do next.
 *
 * Design goals:
 *  - Sync computation, < 50 ms, zero API calls
 *  - Pure data analysis on already-fetched responseValues
 *  - `_hints` is in the response body (not _meta) so the LLM sees it as content
 *
 * Contrast with suggestedNextActions (what to do) — _hints is "understand
 * what you're looking at".
 */

type CellValue = string | number | boolean | null;

export interface ResponseHints {
  /** e.g. "time series: 365 rows × 4 cols, daily" */
  dataShape?: string;
  /** Column whose values are 100 % unique — likely the natural key */
  primaryKeyColumn?: string;
  /** Inferred relationships between columns */
  dataRelationships?: string[];
  /** Formula patterns that could be added */
  formulaOpportunities?: string[];
  /** Risk level of the data (outliers, nulls, duplicates) */
  riskLevel?: 'none' | 'low' | 'medium' | 'high';
  /** Suggested workflow phase */
  nextPhase?: string;
  /** Trend direction for numeric/date-sorted data (e.g. "Revenue: increasing +12%/row avg") */
  trendDirection?: string[];
  /** Low-cardinality columns suitable for grouping, pivots, or dropdowns */
  lowCardinalityColumns?: string[];
  /** Columns with statistical outliers (>3σ from mean) */
  outlierColumns?: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Semantic keyword groups (duplicated inline — avoids coupling to
// suggestion-engine.ts which is heavier and not imported in this path)
// ────────────────────────────────────────────────────────────────────────────

const REVENUE_KEYWORDS = ['revenue', 'income', 'sales', 'price', 'amount', 'total', 'billing'];
const COST_KEYWORDS = ['cost', 'expense', 'cogs', 'spend', 'budget', 'overhead', 'opex'];
const PROFIT_KEYWORDS = ['profit', 'margin', 'net', 'gross', 'ebitda', 'earnings'];
const ID_KEYWORDS = ['id', 'code', 'sku', 'ref', 'key', 'number', 'email'];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const MDY_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

function isDateLike(v: CellValue): boolean {
  if (typeof v !== 'string') return false;
  return ISO_DATE_RE.test(v) || MDY_DATE_RE.test(v);
}

function isNumeric(v: CellValue): boolean {
  if (typeof v === 'number') return true;
  if (typeof v === 'string' && v.trim() !== '') return !isNaN(Number(v));
  return false;
}

function matchesKeywords(header: string, keywords: readonly string[]): boolean {
  const norm = header.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  return keywords.some((kw) => norm.includes(kw));
}

// ────────────────────────────────────────────────────────────────────────────
// Column profiling
// ────────────────────────────────────────────────────────────────────────────

interface ColumnProfile {
  header: string;
  isDate: boolean;
  isNumeric: boolean;
  isId: boolean;
  uniqueRatio: number; // 0-1
  nullRatio: number; // 0-1
  /** Monotonic sort direction detected in sampled rows */
  sortDirection?: 'ascending' | 'descending' | 'unsorted';
  /** Distinct value count (capped at sample size) */
  distinctCount: number;
  /** Numeric stats for outlier detection */
  numericStats?: { mean: number; stdDev: number; outlierCount: number };
}

function profileColumns(values: CellValue[][]): ColumnProfile[] {
  if (values.length < 2) return [];

  const headers = values[0] ?? [];
  const dataRows = values.slice(1, Math.min(values.length, 51)); // cap at 50 data rows
  const numCols = headers.length;
  const profiles: ColumnProfile[] = [];

  for (let c = 0; c < numCols; c++) {
    const header = String(headers[c] ?? `Col${c + 1}`);
    const cells = dataRows.map((r) => r[c] ?? null);

    let dateCount = 0;
    let numCount = 0;
    let nullCount = 0;
    const seen = new Set<string>();
    const numericValues: number[] = [];

    for (const cell of cells) {
      if (cell === null || cell === undefined || cell === '') {
        nullCount++;
        continue;
      }
      seen.add(String(cell));
      if (isDateLike(cell)) {
        dateCount++;
      } else if (isNumeric(cell)) {
        numCount++;
        numericValues.push(typeof cell === 'number' ? cell : Number(cell));
      }
    }

    const total = cells.length;
    const nonNull = total - nullCount;
    const colIsNumeric = nonNull > 0 && numCount / nonNull >= 0.7;

    // Detect sort direction on numeric values
    let sortDirection: ColumnProfile['sortDirection'];
    if (numericValues.length >= 3) {
      let asc = true;
      let desc = true;
      for (let i = 1; i < numericValues.length; i++) {
        if (numericValues[i]! < numericValues[i - 1]!) asc = false;
        if (numericValues[i]! > numericValues[i - 1]!) desc = false;
      }
      sortDirection = asc ? 'ascending' : desc ? 'descending' : 'unsorted';
    }

    // Compute numeric stats for outlier detection
    let numericStats: ColumnProfile['numericStats'];
    if (colIsNumeric && numericValues.length >= 5) {
      const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      const variance =
        numericValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / numericValues.length;
      const stdDev = Math.sqrt(variance);
      const outlierCount =
        stdDev > 0 ? numericValues.filter((v) => Math.abs(v - mean) > 3 * stdDev).length : 0;
      numericStats = { mean, stdDev, outlierCount };
    }

    profiles.push({
      header,
      isDate: nonNull > 0 && dateCount / nonNull >= 0.7,
      isNumeric: colIsNumeric,
      isId: matchesKeywords(header, ID_KEYWORDS),
      uniqueRatio: nonNull > 0 ? seen.size / nonNull : 0,
      nullRatio: total > 0 ? nullCount / total : 0,
      sortDirection,
      distinctCount: seen.size,
      numericStats,
    });
  }

  return profiles;
}

// ────────────────────────────────────────────────────────────────────────────
// dataShape builder
// ────────────────────────────────────────────────────────────────────────────

function buildDataShape(values: CellValue[][], profiles: ColumnProfile[]): string {
  const rowCount = values.length - 1; // exclude header
  const colCount = profiles.length;

  const dateCol = profiles.find((p) => p.isDate);
  const numericCols = profiles.filter((p) => p.isNumeric);

  let shape = `${rowCount} row${rowCount !== 1 ? 's' : ''} × ${colCount} col${colCount !== 1 ? 's' : ''}`;

  if (dateCol && rowCount >= 7) {
    // Try to detect granularity from first two date values
    const dataRows = values.slice(1, 3);
    const colIdx = profiles.indexOf(dateCol);
    const d1 = dataRows[0]?.[colIdx];
    const d2 = dataRows[1]?.[colIdx];
    if (typeof d1 === 'string' && typeof d2 === 'string') {
      const t1 = new Date(d1).getTime();
      const t2 = new Date(d2).getTime();
      if (!isNaN(t1) && !isNaN(t2)) {
        const diffDays = Math.abs(t2 - t1) / 86400000;
        const granularity =
          diffDays <= 1
            ? 'daily'
            : diffDays <= 8
              ? 'weekly'
              : diffDays <= 32
                ? 'monthly'
                : 'periodic';
        shape = `time series: ${shape}, ${granularity}`;
      }
    } else {
      shape = `time series: ${shape}`;
    }
  } else if (numericCols.length >= 2) {
    shape = `structured data: ${shape}`;
  }

  return shape;
}

// ────────────────────────────────────────────────────────────────────────────
// Primary key detection
// ────────────────────────────────────────────────────────────────────────────

function detectPrimaryKey(profiles: ColumnProfile[]): string | undefined {
  // Prefer an ID-like column that is 100 % unique
  const idUnique = profiles.find((p) => p.isId && p.uniqueRatio >= 0.99 && p.nullRatio === 0);
  if (idUnique) return `${idUnique.header} (100% unique — likely primary key)`;

  // Fallback: any column that is 100 % unique and non-null
  const anyUnique = profiles.find((p) => p.uniqueRatio >= 0.99 && p.nullRatio === 0);
  if (anyUnique) return `${anyUnique.header} (100% unique values)`;

  return undefined; // OK: no unique column found — primary key detection not applicable
}

// ────────────────────────────────────────────────────────────────────────────
// Relationship detection
// ────────────────────────────────────────────────────────────────────────────

function detectRelationships(profiles: ColumnProfile[]): string[] {
  const relationships: string[] = [];
  const headers = profiles.map((p) => p.header);

  const hasRevenue = headers.some((h) => matchesKeywords(h, REVENUE_KEYWORDS));
  const hasCost = headers.some((h) => matchesKeywords(h, COST_KEYWORDS));
  const hasProfit = headers.some((h) => matchesKeywords(h, PROFIT_KEYWORDS));

  if (hasRevenue && hasCost && !hasProfit) {
    const revCol = headers.find((h) => matchesKeywords(h, REVENUE_KEYWORDS));
    const costCol = headers.find((h) => matchesKeywords(h, COST_KEYWORDS));
    relationships.push(
      `${revCol} + ${costCol} → add Profit Margin column: =(${revCol}-${costCol})/${revCol}`
    );
  }

  // Date + numeric → trend
  const dateCol = profiles.find((p) => p.isDate);
  const numCols = profiles.filter((p) => p.isNumeric).map((p) => p.header);
  if (dateCol && numCols.length >= 1) {
    relationships.push(
      `${dateCol.header} × ${numCols.slice(0, 2).join(', ')} → time-series trend available`
    );
  }

  // Multiple date columns → possible duration calc
  const dateCols = profiles.filter((p) => p.isDate);
  if (dateCols.length >= 2) {
    relationships.push(
      `${dateCols[0]?.header} + ${dateCols[1]?.header} → add Duration column: =DAYS(end, start)`
    );
  }

  return relationships.slice(0, 3); // cap
}

// ────────────────────────────────────────────────────────────────────────────
// Formula opportunities
// ────────────────────────────────────────────────────────────────────────────

function detectFormulaOpportunities(profiles: ColumnProfile[], rowCount: number): string[] {
  const opps: string[] = [];
  const numCols = profiles.filter((p) => p.isNumeric).map((p) => p.header);

  if (numCols.length >= 1 && rowCount >= 3) {
    opps.push(`Add summary row: =SUM(${numCols[0]}), =AVERAGE(${numCols[0]}), =MAX(${numCols[0]})`);
  }

  const highNullCols = profiles.filter((p) => p.nullRatio > 0.1).map((p) => p.header);
  if (highNullCols.length > 0) {
    opps.push(`Fill missing values in: ${highNullCols.slice(0, 2).join(', ')}`);
  }

  return opps.slice(0, 2);
}

// ────────────────────────────────────────────────────────────────────────────
// Risk level
// ────────────────────────────────────────────────────────────────────────────

function assessRisk(profiles: ColumnProfile[]): ResponseHints['riskLevel'] {
  const maxNull = Math.max(0, ...profiles.map((p) => p.nullRatio));
  const dupCols = profiles.filter((p) => p.uniqueRatio < 0.5 && !p.isDate && p.isNumeric).length;

  if (maxNull > 0.3 || dupCols >= 2) return 'high';
  if (maxNull > 0.1 || dupCols >= 1) return 'medium';
  if (maxNull > 0) return 'low';
  return 'none';
}

// ────────────────────────────────────────────────────────────────────────────
// Next phase suggestion
// ────────────────────────────────────────────────────────────────────────────

function suggestNextPhase(
  profiles: ColumnProfile[],
  riskLevel: ResponseHints['riskLevel']
): string {
  if (riskLevel === 'high' || riskLevel === 'medium') {
    return 'Read complete → clean data (sheets_fix.clean) → validate → transform';
  }

  const hasDate = profiles.some((p) => p.isDate);
  const hasNumeric = profiles.some((p) => p.isNumeric);

  if (hasDate && hasNumeric) {
    return 'Read complete → visualize trend (sheets_visualize.suggest_chart) → format → share';
  }

  if (hasNumeric) {
    return 'Read complete → analyze (sheets_analyze.comprehensive) → add formulas → format';
  }

  return 'Read complete → analyze structure (sheets_analyze.scout) → validate → transform';
}

// ────────────────────────────────────────────────────────────────────────────
// Trend detection
// ────────────────────────────────────────────────────────────────────────────

function detectTrends(profiles: ColumnProfile[]): string[] {
  const trends: string[] = [];
  for (const p of profiles) {
    if (!p.isNumeric || !p.numericStats || !p.sortDirection) continue;
    if (p.sortDirection === 'unsorted') continue;
    // Only report trends on non-ID columns with meaningful variation
    if (p.isId || p.numericStats.stdDev === 0) continue;
    const dir = p.sortDirection === 'ascending' ? 'increasing' : 'decreasing';
    const cvPct = ((p.numericStats.stdDev / Math.abs(p.numericStats.mean || 1)) * 100).toFixed(0);
    trends.push(`${p.header}: ${dir} (CV ${cvPct}%)`);
  }
  return trends.slice(0, 3);
}

// ────────────────────────────────────────────────────────────────────────────
// Low-cardinality detection (grouping / pivot / dropdown candidates)
// ────────────────────────────────────────────────────────────────────────────

function detectLowCardinality(profiles: ColumnProfile[], rowCount: number): string[] {
  const result: string[] = [];
  for (const p of profiles) {
    if (p.isDate || p.isId) continue;
    // Low cardinality: few distinct values relative to row count
    // Must have at least 2 distinct values and ratio < 10% (or ≤20 distinct values for small datasets)
    if (p.distinctCount >= 2 && rowCount >= 5) {
      const ratio = p.distinctCount / rowCount;
      if (ratio <= 0.1 || (p.distinctCount <= 20 && ratio <= 0.3)) {
        result.push(`${p.header} (${p.distinctCount} distinct → pivot/group/dropdown candidate)`);
      }
    }
  }
  return result.slice(0, 3);
}

// ────────────────────────────────────────────────────────────────────────────
// Outlier detection (3σ from mean)
// ────────────────────────────────────────────────────────────────────────────

function detectOutlierColumns(profiles: ColumnProfile[]): string[] {
  const result: string[] = [];
  for (const p of profiles) {
    if (!p.numericStats || p.numericStats.outlierCount === 0) continue;
    result.push(
      `${p.header}: ${p.numericStats.outlierCount} outlier${p.numericStats.outlierCount !== 1 ? 's' : ''} (>3σ from mean ${p.numericStats.mean.toFixed(1)})`
    );
  }
  return result.slice(0, 3);
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Risk level thresholds:
 * - 'none': nullRatio < 1%, no duplicate numeric columns
 * - 'low': nullRatio 1-5% OR 1 duplicate numeric column
 * - 'medium': nullRatio 5-30% OR 2+ duplicate numeric columns
 * - 'high': nullRatio > 30% OR id-like columns with duplicates
 */

/**
 * Generate CoT `_hints` for write operations.
 * Returns a verification nudge so the LLM confirms the write landed.
 */
export function generateWriteHints(values: CellValue[][]): ResponseHints | null {
  if (!values || values.length === 0) return null;
  const cellCount = values.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : 0), 0);
  if (cellCount === 0) return null;
  return {
    nextPhase: `Wrote ${cellCount} cell${cellCount !== 1 ? 's' : ''}. Consider verifying with a read operation to confirm values landed correctly.`,
    riskLevel: 'none',
  };
}

/**
 * Generate CoT `_hints` for scenario modeling results.
 * Surfaces cascade size and risk level so the LLM can decide next steps.
 */
export function generateScenarioHints(cascadeEffects?: unknown[]): ResponseHints | null {
  if (!cascadeEffects || cascadeEffects.length === 0) return null;
  const count = cascadeEffects.length;
  return {
    dataShape: `Scenario affects ${count} dependent cell${count !== 1 ? 's' : ''}`,
    riskLevel: count > 20 ? 'high' : count > 5 ? 'medium' : 'low',
    nextPhase:
      count > 0
        ? 'Consider materializing as a scenario sheet (sheets_dependencies.create_scenario_sheet) for side-by-side comparison'
        : undefined,
  };
}

/**
 * Generate CoT `_hints` from response cell values.
 * Returns null when there is not enough data to generate meaningful hints.
 */
export function generateResponseHints(values: CellValue[][]): ResponseHints | null {
  if (!values || values.length < 2 || (values[0]?.length ?? 0) < 2) {
    return null;
  }

  const profiles = profileColumns(values);
  if (profiles.length === 0) return null;

  const rowCount = values.length - 1;
  const dataShape = buildDataShape(values, profiles);
  const primaryKeyColumn = detectPrimaryKey(profiles);
  const dataRelationships = detectRelationships(profiles);
  const formulaOpportunities = detectFormulaOpportunities(profiles, rowCount);
  const riskLevel = assessRisk(profiles);
  const nextPhase = suggestNextPhase(profiles, riskLevel);
  const trendDirection = detectTrends(profiles);
  const lowCardinalityColumns = detectLowCardinality(profiles, rowCount);
  const outlierColumns = detectOutlierColumns(profiles);

  const hints: ResponseHints = { dataShape };
  if (primaryKeyColumn) hints.primaryKeyColumn = primaryKeyColumn;
  if (dataRelationships.length > 0) hints.dataRelationships = dataRelationships;
  if (formulaOpportunities.length > 0) hints.formulaOpportunities = formulaOpportunities;
  hints.riskLevel = riskLevel;
  hints.nextPhase = nextPhase;
  if (trendDirection.length > 0) hints.trendDirection = trendDirection;
  if (lowCardinalityColumns.length > 0) hints.lowCardinalityColumns = lowCardinalityColumns;
  if (outlierColumns.length > 0) hints.outlierColumns = outlierColumns;

  return hints;
}
