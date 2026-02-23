/**
 * ServalSheets - Cleaning Engine (F3: Automated Data Cleaning)
 *
 * Detects and fixes data quality issues: inconsistent formats, duplicates,
 * type mismatches, trailing whitespace, empty cells, invalid values, outliers.
 *
 * Used by FixHandler for: clean, standardize_formats, fill_missing,
 * detect_anomalies, suggest_cleaning actions.
 */

import type {
  CellChange,
  CleanRule,
  FormatSpec,
  FillStrategy,
  AnomalyMethod,
  AnomalyRecord,
  CleaningRecommendation,
} from '../schemas/fix.js';

// ─── Types ───

export type CellValue = string | number | boolean | null;

export interface CleanResult {
  changes: CellChange[];
  summary: {
    totalCells: number;
    cellsCleaned: number;
    rulesApplied: string[];
    byRule: Record<string, number>;
  };
}

export interface FormatResult {
  changes: CellChange[];
  summary: {
    columnsProcessed: number;
    cellsChanged: number;
    byFormat: Record<string, number>;
  };
}

export interface FillResult {
  changes: CellChange[];
  summary: {
    totalEmpty: number;
    filled: number;
    strategy: FillStrategy;
    byColumn: Record<string, number>;
  };
}

export interface AnomalyResult {
  anomalies: AnomalyRecord[];
  summary: {
    totalCellsAnalyzed: number;
    anomaliesFound: number;
    method: AnomalyMethod;
    threshold: number;
    byColumn: Record<string, number>;
  };
}

export interface ColumnProfile {
  column: string;
  header: string | null;
  type: string;
  nullCount: number;
  uniqueCount: number;
  sampleValues: CellValue[];
}

export interface DataProfile {
  totalRows: number;
  totalColumns: number;
  nullRate: number;
  columnProfiles: ColumnProfile[];
}

export interface SuggestResult {
  recommendations: CleaningRecommendation[];
  dataProfile: DataProfile;
}

// ─── Helpers ───

/** Convert column index to letter (0 = A, 25 = Z, 26 = AA) */
function colToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

/** Convert column letter to index (A = 0, Z = 25, AA = 26) */
function letterToCol(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

/** Parse A1 range to extract start row/col offsets */
function parseRangeOffset(range: string): { startRow: number; startCol: number } {
  // Extract cell reference (e.g., "Sheet1!A1:Z100" → "A1")
  const cellPart = range.includes('!') ? range.split('!')[1] : range;
  const match = cellPart.match(/^([A-Z]+)(\d+)/);
  if (!match) return { startRow: 0, startCol: 0 };
  return { startRow: parseInt(match[2], 10) - 1, startCol: letterToCol(match[1]) };
}

/** Resolve column reference (letter or header name) to column index */
function resolveColumnIndex(ref: string, headers: CellValue[]): number {
  // Try as letter first (A, B, AA, etc.)
  if (/^[A-Z]+$/.test(ref)) {
    return letterToCol(ref);
  }
  // Try as header name
  const idx = headers.findIndex(
    (h) => typeof h === 'string' && h.toLowerCase() === ref.toLowerCase()
  );
  return idx >= 0 ? idx : -1;
}

// ─── Cleaning Engine ───

export class CleaningEngine {
  // ─── Built-in cleaning rules ───

  private static readonly BUILT_IN_RULES: Record<
    string,
    {
      detect: (value: CellValue) => boolean;
      fix: (value: CellValue) => CellValue;
      description: string;
    }
  > = {
    trim_whitespace: {
      detect: (v) => typeof v === 'string' && v !== v.trim(),
      fix: (v) => (typeof v === 'string' ? v.trim() : v),
      description: 'Remove leading/trailing whitespace',
    },
    normalize_case: {
      detect: (v) =>
        typeof v === 'string' &&
        v.length > 1 &&
        v !== v.toLowerCase() &&
        v !== v.toUpperCase() &&
        v !== toTitleCase(v),
      fix: (v) => (typeof v === 'string' ? toTitleCase(v) : v),
      description: 'Normalize to title case',
    },
    fix_dates: {
      detect: (v) => typeof v === 'string' && isAmbiguousDate(v),
      fix: (v) => (typeof v === 'string' ? normalizeDate(v) : v),
      description: 'Normalize date formats to YYYY-MM-DD',
    },
    fix_numbers: {
      detect: (v) =>
        typeof v === 'string' && v.trim() !== '' && !isNaN(parseFloat(v.replace(/[,$%]/g, ''))),
      fix: (v) => {
        if (typeof v !== 'string') return v;
        const cleaned = v.replace(/[$,\s]/g, '');
        if (cleaned.endsWith('%')) return parseFloat(cleaned) / 100;
        return parseFloat(cleaned);
      },
      description: 'Convert text numbers to numeric values',
    },
    fix_booleans: {
      detect: (v) => typeof v === 'string' && /^(yes|no|true|false|1|0|y|n)$/i.test(v.trim()),
      fix: (v) => {
        if (typeof v !== 'string') return v;
        return /^(yes|true|1|y)$/i.test(v.trim());
      },
      description: 'Normalize boolean-like values to TRUE/FALSE',
    },
    remove_duplicates: {
      // This is handled specially at the row level, not per-cell
      detect: () => false,
      fix: (v) => v,
      description: 'Remove exact duplicate rows',
    },
    fix_emails: {
      detect: (v) =>
        typeof v === 'string' && v.includes('@') && (v !== v.toLowerCase().trim() || /\s/.test(v)),
      fix: (v) => (typeof v === 'string' ? v.toLowerCase().trim() : v),
      description: 'Lowercase and trim email addresses',
    },
    fix_phones: {
      detect: (v) =>
        typeof v === 'string' && /[\d\s\-().+]{7,}/.test(v) && v.replace(/\D/g, '').length >= 7,
      fix: (v) => {
        if (typeof v !== 'string') return v;
        const digits = v.replace(/\D/g, '');
        if (digits.length === 10)
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        if (digits.length === 11 && digits[0] === '1')
          return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        return `+${digits}`;
      },
      description: 'Normalize phone numbers',
    },
    fix_urls: {
      detect: (v) =>
        typeof v === 'string' && /^(www\.|[a-z0-9-]+\.(com|org|net|io|dev|co))/i.test(v.trim()),
      fix: (v) => (typeof v === 'string' && !v.startsWith('http') ? `https://${v.trim()}` : v),
      description: 'Add https:// to URLs missing protocol',
    },
    fix_currency: {
      detect: (v) => typeof v === 'string' && /^\s*[$€£¥]\s*[\d,.]+\s*$/.test(v),
      fix: (v) => {
        if (typeof v !== 'string') return v;
        return parseFloat(v.replace(/[^0-9.-]/g, ''));
      },
      description: 'Strip currency symbols and convert to number',
    },
  };

  // ─── clean ───

  async clean(
    data: CellValue[][],
    rules?: CleanRule[],
    rangeOffset?: { startRow: number; startCol: number }
  ): Promise<CleanResult> {
    const offset = rangeOffset ?? { startRow: 0, startCol: 0 };
    const changes: CellChange[] = [];
    const rulesApplied = new Set<string>();
    const byRule: Record<string, number> = {};

    // Determine which rules to apply
    const activeRuleIds = rules
      ? rules.filter((r) => r.enabled !== false).map((r) => r.id)
      : Object.keys(CleaningEngine.BUILT_IN_RULES);

    // Skip header row (row 0)
    const startRow = data.length > 0 ? 1 : 0;
    let totalCells = 0;

    // Handle remove_duplicates specially (row-level)
    const dedupActive = activeRuleIds.includes('remove_duplicates');
    const seenRows = new Set<string>();
    const duplicateRows = new Set<number>();

    if (dedupActive && data.length > 1) {
      for (let r = startRow; r < data.length; r++) {
        const key = JSON.stringify(data[r]);
        if (seenRows.has(key)) {
          duplicateRows.add(r);
        } else {
          seenRows.add(key);
        }
      }
      if (duplicateRows.size > 0) {
        rulesApplied.add('remove_duplicates');
        byRule['remove_duplicates'] = duplicateRows.size;
      }
    }

    // Per-cell cleaning
    for (let r = startRow; r < data.length; r++) {
      if (duplicateRows.has(r)) continue; // Skip duplicate rows

      for (let c = 0; c < (data[r]?.length ?? 0); c++) {
        totalCells++;
        const value = data[r][c];

        for (const ruleId of activeRuleIds) {
          if (ruleId === 'remove_duplicates') continue;

          const rule = CleaningEngine.BUILT_IN_RULES[ruleId];
          if (!rule) continue;

          // Check column filter from user-provided rules
          if (rules) {
            const userRule = rules.find((ur) => ur.id === ruleId);
            if (userRule?.column) {
              const targetCol = resolveColumnIndex(userRule.column, data[0] ?? []);
              if (targetCol !== c) continue;
            }
          }

          if (rule.detect(value)) {
            const newValue = rule.fix(value);
            if (newValue !== value) {
              const cellRef = `${colToLetter(c + offset.startCol)}${r + 1 + offset.startRow}`;
              changes.push({
                row: r + offset.startRow,
                col: c + offset.startCol,
                cell: cellRef,
                oldValue: value,
                newValue: newValue,
                rule: ruleId,
              });
              rulesApplied.add(ruleId);
              byRule[ruleId] = (byRule[ruleId] ?? 0) + 1;
              break; // Apply first matching rule per cell
            }
          }
        }
      }
    }

    return {
      changes,
      summary: {
        totalCells,
        cellsCleaned: changes.length + duplicateRows.size,
        rulesApplied: Array.from(rulesApplied),
        byRule,
      },
    };
  }

  // ─── standardize_formats ───

  async standardizeFormats(
    data: CellValue[][],
    specs: FormatSpec[],
    rangeOffset?: { startRow: number; startCol: number }
  ): Promise<FormatResult> {
    const offset = rangeOffset ?? { startRow: 0, startCol: 0 };
    const changes: CellChange[] = [];
    const byFormat: Record<string, number> = {};
    const headers = data[0] ?? [];
    const columnsProcessed = new Set<number>();

    for (const spec of specs) {
      const colIdx = resolveColumnIndex(spec.column, headers);
      if (colIdx < 0) continue;
      columnsProcessed.add(colIdx);

      const formatter = FORMAT_CONVERTERS[spec.targetFormat];
      if (!formatter) continue;

      // Skip header row
      for (let r = 1; r < data.length; r++) {
        const value = data[r]?.[colIdx];
        if (value === null || value === undefined || value === '') continue;

        const newValue = formatter(value);
        if (newValue !== value && newValue !== null) {
          const cellRef = `${colToLetter(colIdx + offset.startCol)}${r + 1 + offset.startRow}`;
          changes.push({
            row: r + offset.startRow,
            col: colIdx + offset.startCol,
            cell: cellRef,
            oldValue: value,
            newValue,
            rule: spec.targetFormat,
          });
          byFormat[spec.targetFormat] = (byFormat[spec.targetFormat] ?? 0) + 1;
        }
      }
    }

    return {
      changes,
      summary: {
        columnsProcessed: columnsProcessed.size,
        cellsChanged: changes.length,
        byFormat,
      },
    };
  }

  // ─── fill_missing ───

  async fillMissing(
    data: CellValue[][],
    strategy: FillStrategy,
    options?: {
      constantValue?: CellValue;
      columns?: string[];
    },
    rangeOffset?: { startRow: number; startCol: number }
  ): Promise<FillResult> {
    const offset = rangeOffset ?? { startRow: 0, startCol: 0 };
    const changes: CellChange[] = [];
    const byColumn: Record<string, number> = {};
    const headers = data[0] ?? [];
    let totalEmpty = 0;

    // Determine which columns to fill
    const targetCols = options?.columns
      ? options.columns.map((c) => resolveColumnIndex(c, headers)).filter((c) => c >= 0)
      : Array.from({ length: headers.length }, (_, i) => i);

    for (const colIdx of targetCols) {
      const colRef = colToLetter(colIdx + offset.startCol);
      const colValues: { row: number; value: CellValue }[] = [];

      // Collect non-empty values and find empties
      for (let r = 1; r < data.length; r++) {
        const v = data[r]?.[colIdx];
        if (v === null || v === undefined || v === '') {
          totalEmpty++;
          colValues.push({ row: r, value: null });
        } else {
          colValues.push({ row: r, value: v });
        }
      }

      // Compute fill values based on strategy
      const numericValues = colValues
        .filter((cv) => cv.value !== null && typeof cv.value === 'number')
        .map((cv) => cv.value as number);

      for (let i = 0; i < colValues.length; i++) {
        if (colValues[i].value !== null) continue;

        let fillValue: CellValue = null;
        const r = colValues[i].row;

        switch (strategy) {
          case 'forward': {
            // Find last non-empty value before this index
            for (let j = i - 1; j >= 0; j--) {
              if (colValues[j].value !== null) {
                fillValue = colValues[j].value;
                break;
              }
            }
            break;
          }
          case 'backward': {
            // Find next non-empty value after this index
            for (let j = i + 1; j < colValues.length; j++) {
              if (colValues[j].value !== null) {
                fillValue = colValues[j].value;
                break;
              }
            }
            break;
          }
          case 'mean': {
            if (numericValues.length > 0) {
              fillValue =
                Math.round(
                  (numericValues.reduce((a, b) => a + b, 0) / numericValues.length) * 100
                ) / 100;
            }
            break;
          }
          case 'median': {
            if (numericValues.length > 0) {
              const sorted = [...numericValues].sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              fillValue =
                sorted.length % 2 !== 0
                  ? sorted[mid]
                  : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
            }
            break;
          }
          case 'mode': {
            const counts = new Map<string, { value: CellValue; count: number }>();
            for (const cv of colValues) {
              if (cv.value === null) continue;
              const key = String(cv.value);
              const entry = counts.get(key);
              if (entry) entry.count++;
              else counts.set(key, { value: cv.value, count: 1 });
            }
            let maxCount = 0;
            for (const entry of counts.values()) {
              if (entry.count > maxCount) {
                maxCount = entry.count;
                fillValue = entry.value;
              }
            }
            break;
          }
          case 'constant': {
            fillValue = options?.constantValue ?? null;
            break;
          }
        }

        if (fillValue !== null) {
          const cellRef = `${colRef}${r + 1 + offset.startRow}`;
          changes.push({
            row: r + offset.startRow,
            col: colIdx + offset.startCol,
            cell: cellRef,
            oldValue: null,
            newValue: fillValue,
            rule: `fill_${strategy}`,
          });
          byColumn[colRef] = (byColumn[colRef] ?? 0) + 1;
        }
      }
    }

    return {
      changes,
      summary: {
        totalEmpty,
        filled: changes.length,
        strategy,
        byColumn,
      },
    };
  }

  // ─── detect_anomalies ───

  async detectAnomalies(
    data: CellValue[][],
    method: AnomalyMethod = 'iqr',
    threshold?: number,
    columns?: string[],
    rangeOffset?: { startRow: number; startCol: number }
  ): Promise<AnomalyResult> {
    const offset = rangeOffset ?? { startRow: 0, startCol: 0 };
    const anomalies: AnomalyRecord[] = [];
    const byColumn: Record<string, number> = {};
    const headers = data[0] ?? [];
    let totalCellsAnalyzed = 0;

    // Default thresholds per method
    const effectiveThreshold =
      threshold ?? (method === 'iqr' ? 1.5 : method === 'zscore' ? 3.0 : 3.5);

    // Determine which columns to analyze
    const targetCols = columns
      ? columns.map((c) => resolveColumnIndex(c, headers)).filter((c) => c >= 0)
      : this.detectNumericColumns(data);

    for (const colIdx of targetCols) {
      const colRef = colToLetter(colIdx + offset.startCol);
      const headerName = typeof headers[colIdx] === 'string' ? (headers[colIdx] as string) : colRef;

      // Collect numeric values from this column
      const numericEntries: { row: number; value: number }[] = [];
      for (let r = 1; r < data.length; r++) {
        const v = data[r]?.[colIdx];
        if (typeof v === 'number' && !isNaN(v)) {
          numericEntries.push({ row: r, value: v });
          totalCellsAnalyzed++;
        }
      }

      if (numericEntries.length < 3) continue; // Need at least 3 values

      // Detect anomalies using the chosen method
      const values = numericEntries.map((e) => e.value);
      const detector = ANOMALY_DETECTORS[method];

      for (const entry of numericEntries) {
        const score = detector(entry.value, values, effectiveThreshold);
        const isAnomaly = score > effectiveThreshold;

        if (isAnomaly) {
          const cellRef = `${colRef}${entry.row + 1 + offset.startRow}`;
          anomalies.push({
            cell: cellRef,
            value: entry.value,
            score: Math.round(score * 1000) / 1000,
            column: headerName,
            method,
            threshold: effectiveThreshold,
            isAnomaly: true,
          });
          byColumn[headerName] = (byColumn[headerName] ?? 0) + 1;
        }
      }
    }

    return {
      anomalies,
      summary: {
        totalCellsAnalyzed,
        anomaliesFound: anomalies.length,
        method,
        threshold: effectiveThreshold,
        byColumn,
      },
    };
  }

  // ─── suggest_cleaning ───

  async suggestCleaning(
    data: CellValue[][],
    maxRecommendations: number = 10,
    rangeOffset?: { startRow: number; startCol: number }
  ): Promise<SuggestResult> {
    const offset = rangeOffset ?? { startRow: 0, startCol: 0 };
    const headers = data[0] ?? [];
    const recommendations: CleaningRecommendation[] = [];

    // Build data profile
    const dataProfile = this.profileData(data, offset);

    // Run each built-in rule as a detector and count hits
    for (const [ruleId, rule] of Object.entries(CleaningEngine.BUILT_IN_RULES)) {
      if (ruleId === 'remove_duplicates') continue; // Handle separately

      let hitCount = 0;
      const sampleBefore: CellValue[] = [];
      const sampleAfter: CellValue[] = [];
      let affectedColumn: string | undefined;

      for (let c = 0; c < (data[0]?.length ?? 0); c++) {
        let colHits = 0;
        for (let r = 1; r < data.length; r++) {
          const v = data[r]?.[c];
          if (rule.detect(v)) {
            colHits++;
            if (sampleBefore.length < 3) {
              sampleBefore.push(v);
              sampleAfter.push(rule.fix(v));
            }
          }
        }
        if (colHits > hitCount) {
          hitCount = colHits;
          affectedColumn = typeof headers[c] === 'string' ? (headers[c] as string) : colToLetter(c);
        }
      }

      if (hitCount > 0) {
        recommendations.push({
          id: `suggest_${ruleId}`,
          title: rule.description,
          description: `Found ${hitCount} cell(s) that can be cleaned using "${ruleId}" rule${affectedColumn ? ` (highest in column "${affectedColumn}")` : ''}`,
          column: affectedColumn,
          issueCount: hitCount,
          severity: hitCount > 50 ? 'high' : hitCount > 10 ? 'medium' : 'low',
          suggestedRule: ruleId,
          sampleBefore,
          sampleAfter,
        });
      }
    }

    // Check for duplicate rows
    if (data.length > 1) {
      const seen = new Set<string>();
      let dupeCount = 0;
      for (let r = 1; r < data.length; r++) {
        const key = JSON.stringify(data[r]);
        if (seen.has(key)) dupeCount++;
        else seen.add(key);
      }
      if (dupeCount > 0) {
        recommendations.push({
          id: 'suggest_remove_duplicates',
          title: 'Remove duplicate rows',
          description: `Found ${dupeCount} exact duplicate row(s)`,
          issueCount: dupeCount,
          severity: dupeCount > 20 ? 'high' : dupeCount > 5 ? 'medium' : 'low',
          suggestedRule: 'remove_duplicates',
          sampleBefore: [],
          sampleAfter: [],
        });
      }
    }

    // Check for anomalies in numeric columns
    const numericCols = this.detectNumericColumns(data);
    if (numericCols.length > 0) {
      const anomalyResult = await this.detectAnomalies(data, 'iqr', 1.5, undefined, offset);
      if (anomalyResult.anomalies.length > 0) {
        recommendations.push({
          id: 'suggest_detect_anomalies',
          title: 'Review statistical outliers',
          description: `Found ${anomalyResult.anomalies.length} potential outlier(s) across ${Object.keys(anomalyResult.summary.byColumn).length} column(s) using IQR method`,
          issueCount: anomalyResult.anomalies.length,
          severity:
            anomalyResult.anomalies.length > 10
              ? 'high'
              : anomalyResult.anomalies.length > 3
                ? 'medium'
                : 'low',
          suggestedRule: 'detect_anomalies',
          sampleBefore: anomalyResult.anomalies.slice(0, 3).map((a) => a.value),
          sampleAfter: anomalyResult.anomalies.slice(0, 3).map((a) => a.value), // Anomalies aren't "fixed", just flagged
        });
      }
    }

    // Check for missing values
    const emptyCount = dataProfile.columnProfiles.reduce((sum, cp) => sum + cp.nullCount, 0);
    if (emptyCount > 0) {
      recommendations.push({
        id: 'suggest_fill_missing',
        title: 'Fill empty cells',
        description: `Found ${emptyCount} empty cell(s) across ${dataProfile.columnProfiles.filter((cp) => cp.nullCount > 0).length} column(s). Consider using fill_missing with forward, mean, or constant strategy.`,
        issueCount: emptyCount,
        severity: emptyCount > 50 ? 'high' : emptyCount > 10 ? 'medium' : 'low',
        suggestedRule: 'fill_missing',
        sampleBefore: [],
        sampleAfter: [],
      });
    }

    // Sort by severity (high first) then by issue count
    const severityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.issueCount - a.issueCount
    );

    return {
      recommendations: recommendations.slice(0, maxRecommendations),
      dataProfile,
    };
  }

  // ─── Utility methods ───

  /** Detect columns that are predominantly numeric */
  private detectNumericColumns(data: CellValue[][]): number[] {
    const numericCols: number[] = [];
    const colCount = data[0]?.length ?? 0;

    for (let c = 0; c < colCount; c++) {
      let numericCount = 0;
      let totalCount = 0;

      for (let r = 1; r < data.length; r++) {
        const v = data[r]?.[c];
        if (v === null || v === undefined || v === '') continue;
        totalCount++;
        if (typeof v === 'number') numericCount++;
      }

      if (totalCount > 0 && numericCount / totalCount >= 0.8) {
        numericCols.push(c);
      }
    }

    return numericCols;
  }

  /** Build a profile of the data */
  profileData(
    data: CellValue[][],
    rangeOffset?: { startRow: number; startCol: number }
  ): DataProfile {
    const offset = rangeOffset ?? { startRow: 0, startCol: 0 };
    const headers = data[0] ?? [];
    const colCount = headers.length;
    const rowCount = data.length - 1; // Exclude header
    let totalNulls = 0;
    let totalCells = 0;

    const columnProfiles: ColumnProfile[] = [];

    for (let c = 0; c < colCount; c++) {
      const colRef = colToLetter(c + offset.startCol);
      const typeCounts: Record<string, number> = {};
      let nullCount = 0;
      const uniqueValues = new Set<string>();
      const sampleValues: CellValue[] = [];

      for (let r = 1; r < data.length; r++) {
        totalCells++;
        const v = data[r]?.[c];

        if (v === null || v === undefined || v === '') {
          nullCount++;
          totalNulls++;
          continue;
        }

        const type = typeof v;
        typeCounts[type] = (typeCounts[type] ?? 0) + 1;
        uniqueValues.add(String(v));
        if (sampleValues.length < 5) sampleValues.push(v);
      }

      // Find dominant type
      let dominantType = 'empty';
      let maxTypeCount = 0;
      for (const [type, count] of Object.entries(typeCounts)) {
        if (count > maxTypeCount) {
          maxTypeCount = count;
          dominantType = type;
        }
      }

      columnProfiles.push({
        column: colRef,
        header: typeof headers[c] === 'string' ? (headers[c] as string) : null,
        type: dominantType,
        nullCount,
        uniqueCount: uniqueValues.size,
        sampleValues,
      });
    }

    return {
      totalRows: rowCount,
      totalColumns: colCount,
      nullRate: totalCells > 0 ? Math.round((totalNulls / totalCells) * 10000) / 10000 : 0,
      columnProfiles,
    };
  }
}

// ─── Format converters ───

const FORMAT_CONVERTERS: Record<string, (value: CellValue) => CellValue> = {
  iso_date: (v) => (typeof v === 'string' ? normalizeDate(v) : v),
  us_date: (v) => {
    if (typeof v !== 'string') return v;
    const d = parseAnyDate(v);
    return d
      ? `${String(d.month).padStart(2, '0')}/${String(d.day).padStart(2, '0')}/${d.year}`
      : v;
  },
  eu_date: (v) => {
    if (typeof v !== 'string') return v;
    const d = parseAnyDate(v);
    return d
      ? `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`
      : v;
  },
  currency_usd: (v) => {
    const n =
      typeof v === 'number'
        ? v
        : typeof v === 'string'
          ? parseFloat(v.replace(/[^0-9.-]/g, ''))
          : NaN;
    return isNaN(n) ? v : `$${n.toFixed(2)}`;
  },
  currency_eur: (v) => {
    const n =
      typeof v === 'number'
        ? v
        : typeof v === 'string'
          ? parseFloat(v.replace(/[^0-9.-]/g, ''))
          : NaN;
    return isNaN(n) ? v : `€${n.toFixed(2)}`;
  },
  currency_gbp: (v) => {
    const n =
      typeof v === 'number'
        ? v
        : typeof v === 'string'
          ? parseFloat(v.replace(/[^0-9.-]/g, ''))
          : NaN;
    return isNaN(n) ? v : `£${n.toFixed(2)}`;
  },
  number_plain: (v) => {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return v;
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? v : n;
  },
  percentage: (v) => {
    if (typeof v === 'number') return v <= 1 ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(1)}%`;
    if (typeof v !== 'string') return v;
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    if (isNaN(n)) return v;
    return n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`;
  },
  phone_e164: (v) => {
    if (typeof v !== 'string') return v;
    const digits = v.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
    return digits.length >= 7 ? `+${digits}` : v;
  },
  phone_national: (v) => {
    if (typeof v !== 'string') return v;
    const digits = v.replace(/\D/g, '');
    if (digits.length === 10)
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === '1')
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return v;
  },
  email_lowercase: (v) => (typeof v === 'string' ? v.toLowerCase().trim() : v),
  url_https: (v) => (typeof v === 'string' && !v.startsWith('http') ? `https://${v.trim()}` : v),
  title_case: (v) => (typeof v === 'string' ? toTitleCase(v) : v),
  upper_case: (v) => (typeof v === 'string' ? v.toUpperCase() : v),
  lower_case: (v) => (typeof v === 'string' ? v.toLowerCase() : v),
  boolean: (v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v !== 'string') return v;
    return /^(yes|true|1|y)$/i.test(v.trim());
  },
};

// ─── Anomaly detection functions ───

const ANOMALY_DETECTORS: Record<
  AnomalyMethod,
  (value: number, allValues: number[], threshold: number) => number
> = {
  iqr: (value, allValues) => {
    const sorted = [...allValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    if (iqr === 0) return 0;
    return Math.max((q1 - value) / iqr, (value - q3) / iqr, 0);
  },
  zscore: (value, allValues) => {
    const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const std = Math.sqrt(
      allValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allValues.length
    );
    if (std === 0) return 0;
    return Math.abs((value - mean) / std);
  },
  modified_zscore: (value, allValues) => {
    const sorted = [...allValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mad = (() => {
      const deviations = allValues.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
      return deviations[Math.floor(deviations.length / 2)];
    })();
    if (mad === 0) return 0;
    return Math.abs((0.6745 * (value - median)) / mad);
  },
};

// ─── String helpers ───

function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

function isAmbiguousDate(str: string): boolean {
  return (
    /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(str.trim()) ||
    /^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}$/.test(str.trim()) ||
    /^[A-Za-z]+ \d{1,2},? \d{4}$/.test(str.trim())
  );
}

interface ParsedDate {
  year: number;
  month: number;
  day: number;
}

function parseAnyDate(str: string): ParsedDate | null {
  const trimmed = str.trim();

  // YYYY-MM-DD or YYYY/MM/DD
  let m = trimmed.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (m) return { year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(m[3]) };

  // MM/DD/YYYY or DD/MM/YYYY (assume MM/DD if month <= 12)
  m = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const a = parseInt(m[1]);
    const b = parseInt(m[2]);
    const year = parseInt(m[3]);
    if (a <= 12) return { year, month: a, day: b };
    return { year, month: b, day: a };
  }

  // MM/DD/YY
  m = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/);
  if (m) {
    const yy = parseInt(m[3]);
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    return { year, month: parseInt(m[1]), day: parseInt(m[2]) };
  }

  // "Month DD, YYYY" or "Month DD YYYY"
  m = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const monthNames: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    };
    const month = monthNames[m[1].toLowerCase()];
    if (month) return { year: parseInt(m[3]), month, day: parseInt(m[2]) };
  }

  return null;
}

function normalizeDate(str: string): string {
  const d = parseAnyDate(str);
  if (!d) return str;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

// Export parseRangeOffset for handler use
export { parseRangeOffset };
