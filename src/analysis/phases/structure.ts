/**
 * Phase 1-2: Column structure analysis and data quality detection
 */

import { detectDataType } from '../helpers.js';
import type { ColumnStats, QualityIssue } from '../comprehensive.js';

/**
 * Analyze columns for statistics (type, null rate, numeric/text stats)
 */
export function analyzeColumns(headers: string[], dataRows: unknown[][]): ColumnStats[] {
  return headers.map((header, index) => {
    const values = dataRows.map((row) => row[index]);
    const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
    const detectedType = detectDataType(values);

    // Map detectDataType results to ColumnStats enum
    const dataType: ColumnStats['dataType'] =
      detectedType === 'email' || detectedType === 'url' || detectedType === 'unknown'
        ? 'text'
        : (detectedType as ColumnStats['dataType']);

    const stats: ColumnStats = {
      name: header || `Column ${index + 1}`,
      index,
      dataType,
      count: values.length,
      nullCount: values.length - nonNullValues.length,
      uniqueCount: new Set(nonNullValues.map(String)).size,
      completeness: (nonNullValues.length / values.length) * 100,
    };

    // Add numeric stats if applicable
    if (dataType === 'number') {
      const numericValues = nonNullValues.reduce<number[]>((acc, val) => {
        const n = Number(val);
        if (!Number.isNaN(n)) {
          acc.push(n);
        }
        return acc;
      }, []);
      if (numericValues.length > 0) {
        const sorted = [...numericValues].sort((a, b) => a - b);
        stats.sum = numericValues.reduce((a, b) => a + b, 0);
        stats.mean = stats.sum / numericValues.length;
        stats.median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        stats.min = sorted[0];
        stats.max = sorted[sorted.length - 1];

        // Standard deviation
        const variance =
          numericValues.reduce((sum, val) => sum + Math.pow(val - stats.mean!, 2), 0) /
          numericValues.length;
        stats.stdDev = Math.sqrt(variance);
      }
    }

    // Add text stats if applicable
    if (dataType === 'text') {
      const lengths = nonNullValues.map((v) => String(v).length);
      if (lengths.length > 0) {
        stats.minLength = Math.min(...lengths);
        stats.maxLength = Math.max(...lengths);
        stats.avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      }
    }

    return stats;
  });
}

/**
 * Comprehensive data quality analysis covering all 15 declared issue types:
 * EMPTY_HEADER, DUPLICATE_HEADER, MIXED_DATA_TYPES, EMPTY_ROW, EMPTY_COLUMN,
 * TRAILING_WHITESPACE, LEADING_WHITESPACE, INCONSISTENT_FORMAT, STATISTICAL_OUTLIER,
 * MISSING_VALUE, DUPLICATE_ROW, INVALID_EMAIL, INVALID_URL, INVALID_DATE, FORMULA_ERROR
 */
export function analyzeQuality(
  headers: string[],
  dataRows: unknown[][],
  columns: ColumnStats[]
): {
  qualityScore: number;
  completeness: number;
  consistency: number;
  issues: QualityIssue[];
} {
  const issues: QualityIssue[] = [];

  // ── 1. EMPTY_HEADER ──
  headers.forEach((header, index) => {
    if (!header || header.trim() === '') {
      issues.push({
        type: 'EMPTY_HEADER',
        severity: 'high',
        location: `Column ${index + 1}`,
        description: `Column ${index + 1} has no header`,
        autoFixable: true,
        fixSuggestion: `Add header "Column${index + 1}"`,
      });
    }
  });

  // ── 2. DUPLICATE_HEADER ──
  const headerCounts = headers.reduce(
    (acc, h) => {
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  Object.entries(headerCounts).forEach(([header, count]) => {
    if (count > 1 && header) {
      issues.push({
        type: 'DUPLICATE_HEADER',
        severity: 'medium',
        location: `Header: ${header}`,
        description: `Header "${header}" appears ${count} times`,
        autoFixable: true,
        fixSuggestion: `Rename duplicate headers to unique names`,
      });
    }
  });

  // ── 3. MIXED_DATA_TYPES ──
  columns.forEach((col) => {
    if (col.dataType === 'mixed') {
      issues.push({
        type: 'MIXED_DATA_TYPES',
        severity: 'medium',
        location: col.name,
        description: `Column contains mixed data types`,
        autoFixable: false,
        fixSuggestion: 'Standardize column to single data type',
      });
    }
  });

  // ── 4. EMPTY_ROW ──
  let emptyRowCount = 0;
  const emptyRowLocations: number[] = [];
  dataRows.forEach((row, rowIndex) => {
    const allEmpty = row.every((cell) => cell === null || cell === undefined || cell === '');
    if (allEmpty) {
      emptyRowCount++;
      if (emptyRowLocations.length < 5) {
        emptyRowLocations.push(rowIndex + 2); // +2 for header row + 0-indexing
      }
    }
  });
  if (emptyRowCount > 0) {
    issues.push({
      type: 'EMPTY_ROW',
      severity: emptyRowCount > 5 ? 'high' : 'medium',
      location:
        emptyRowLocations.length <= 5
          ? `Rows: ${emptyRowLocations.join(', ')}${emptyRowCount > 5 ? ` (+${emptyRowCount - 5} more)` : ''}`
          : `${emptyRowCount} empty rows`,
      description: `${emptyRowCount} completely empty row(s) found in data`,
      autoFixable: true,
      fixSuggestion: 'Remove empty rows to consolidate data',
    });
  }

  // ── 5. EMPTY_COLUMN ──
  columns.forEach((col) => {
    if (col.nullCount === col.count) {
      issues.push({
        type: 'EMPTY_COLUMN',
        severity: 'high',
        location: col.name,
        description: `Column "${col.name}" is completely empty (all ${col.count} values are blank)`,
        autoFixable: true,
        fixSuggestion: 'Remove empty column or populate with data',
      });
    }
  });

  // ── 6. TRAILING_WHITESPACE & 7. LEADING_WHITESPACE ──
  let trailingWhitespaceCount = 0;
  let leadingWhitespaceCount = 0;
  const trailingCols = new Set<string>();
  const leadingCols = new Set<string>();

  dataRows.forEach((row) => {
    row.forEach((cell, colIndex) => {
      if (typeof cell === 'string' && cell.length > 0) {
        if (cell !== cell.trimEnd()) {
          trailingWhitespaceCount++;
          if (colIndex < headers.length) {
            trailingCols.add(headers[colIndex] || `Column ${colIndex + 1}`);
          }
        }
        if (cell !== cell.trimStart()) {
          leadingWhitespaceCount++;
          if (colIndex < headers.length) {
            leadingCols.add(headers[colIndex] || `Column ${colIndex + 1}`);
          }
        }
      }
    });
  });

  if (trailingWhitespaceCount > 0) {
    issues.push({
      type: 'TRAILING_WHITESPACE',
      severity: trailingWhitespaceCount > 50 ? 'medium' : 'low',
      location: `Columns: ${[...trailingCols].slice(0, 5).join(', ')}${trailingCols.size > 5 ? ` (+${trailingCols.size - 5} more)` : ''}`,
      description: `${trailingWhitespaceCount} cells have trailing whitespace`,
      autoFixable: true,
      fixSuggestion: 'Use TRIM() or sheets_dimensions trim_whitespace action to clean',
    });
  }

  if (leadingWhitespaceCount > 0) {
    issues.push({
      type: 'LEADING_WHITESPACE',
      severity: leadingWhitespaceCount > 50 ? 'medium' : 'low',
      location: `Columns: ${[...leadingCols].slice(0, 5).join(', ')}${leadingCols.size > 5 ? ` (+${leadingCols.size - 5} more)` : ''}`,
      description: `${leadingWhitespaceCount} cells have leading whitespace`,
      autoFixable: true,
      fixSuggestion: 'Use TRIM() or sheets_dimensions trim_whitespace action to clean',
    });
  }

  // ── 8. INCONSISTENT_FORMAT ──
  // Detect columns where values have mixed formatting patterns (e.g. dates as "1/2/23" vs "01/02/2023")
  columns.forEach((col, colIndex) => {
    if (col.dataType !== 'text' || col.count < 5) return;

    const values = dataRows
      .map((row) => row[colIndex])
      .filter((v): v is string => typeof v === 'string' && v.length > 0);

    if (values.length < 5) return;

    // Check for inconsistent date-like patterns
    const datePatterns = {
      slashShort: /^\d{1,2}\/\d{1,2}\/\d{2}$/,
      slashLong: /^\d{1,2}\/\d{1,2}\/\d{4}$/,
      dashISO: /^\d{4}-\d{2}-\d{2}$/,
      dashShort: /^\d{1,2}-\d{1,2}-\d{2,4}$/,
    };

    const patternCounts: Record<string, number> = {};
    let dateValueCount = 0;

    for (const val of values) {
      for (const [name, pattern] of Object.entries(datePatterns)) {
        if (pattern.test(val)) {
          patternCounts[name] = (patternCounts[name] || 0) + 1;
          dateValueCount++;
          break;
        }
      }
    }

    const distinctPatterns = Object.keys(patternCounts).length;
    if (distinctPatterns > 1 && dateValueCount > values.length * 0.3) {
      const patternSummary = Object.entries(patternCounts)
        .map(([name, count]) => `${name}: ${count}`)
        .join(', ');
      issues.push({
        type: 'INCONSISTENT_FORMAT',
        severity: 'medium',
        location: col.name,
        description: `Column has ${distinctPatterns} different date formats (${patternSummary})`,
        autoFixable: true,
        fixSuggestion: 'Standardize date format using TEXT() or number format settings',
      });
    }

    // Check for inconsistent casing patterns in categorical data
    if (col.uniqueCount < 50 && col.uniqueCount > 1) {
      const lowerMap = new Map<string, Set<string>>();
      for (const val of values) {
        const lower = val.toLowerCase();
        if (!lowerMap.has(lower)) {
          lowerMap.set(lower, new Set());
        }
        lowerMap.get(lower)!.add(val);
      }
      const inconsistentCasing = [...lowerMap.entries()].filter(
        ([, variants]) => variants.size > 1
      );
      if (inconsistentCasing.length > 0) {
        const examples = inconsistentCasing
          .slice(0, 3)
          .map(([, variants]) => `"${[...variants].join('" vs "')}"`)
          .join('; ');
        issues.push({
          type: 'INCONSISTENT_FORMAT',
          severity: 'low',
          location: col.name,
          description: `${inconsistentCasing.length} values have inconsistent casing: ${examples}`,
          autoFixable: true,
          fixSuggestion: 'Standardize casing using PROPER(), UPPER(), or LOWER()',
        });
      }
    }
  });

  // ── 9. STATISTICAL_OUTLIER ──
  columns.forEach((col, colIndex) => {
    if (col.dataType !== 'number' || !col.mean || !col.stdDev || col.stdDev === 0) return;

    let outlierCount = 0;
    dataRows.forEach((row) => {
      const value = Number(row[colIndex]);
      if (!isNaN(value)) {
        const zScore = Math.abs((value - col.mean!) / col.stdDev!);
        if (zScore > 3) outlierCount++;
      }
    });

    if (outlierCount > 0) {
      issues.push({
        type: 'STATISTICAL_OUTLIER',
        severity: outlierCount > 5 ? 'high' : outlierCount > 2 ? 'medium' : 'low',
        location: col.name,
        description: `${outlierCount} statistical outlier(s) detected (>3 standard deviations from mean ${col.mean!.toFixed(2)})`,
        autoFixable: false,
        fixSuggestion:
          'Review outliers - they may be data entry errors or legitimate extreme values',
      });
    }
  });

  // ── 10. MISSING_VALUE ──
  columns.forEach((col) => {
    const nullRate = col.nullCount / col.count;
    if (col.nullCount > 0 && nullRate <= 0.5) {
      // Only flag as MISSING_VALUE if it's partial (not an empty column)
      issues.push({
        type: 'MISSING_VALUE',
        severity: nullRate > 0.2 ? 'medium' : 'low',
        location: col.name,
        description: `${col.nullCount} missing value(s) (${(nullRate * 100).toFixed(1)}% empty)`,
        autoFixable: false,
        fixSuggestion:
          nullRate > 0.2
            ? 'Consider filling with default values, interpolation, or removing incomplete rows'
            : 'Review and fill missing values where appropriate',
      });
    } else if (nullRate > 0.5 && col.nullCount < col.count) {
      // High null rate (>50% but not completely empty)
      issues.push({
        type: 'MISSING_VALUE',
        severity: 'high',
        location: col.name,
        description: `${(nullRate * 100).toFixed(1)}% of values are missing (${col.nullCount}/${col.count})`,
        autoFixable: false,
        fixSuggestion: 'Consider removing column or filling missing values',
      });
    }
  });

  // ── 11. DUPLICATE_ROW ──
  // Use delimiter-joined fingerprint instead of JSON.stringify for O(n) vs O(n*m) perf
  const rowFingerprints = dataRows.map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? '')).join('\x00') : String(row)
  );
  const uniqueRows = new Set(rowFingerprints);
  const duplicateCount = rowFingerprints.length - uniqueRows.size;
  if (duplicateCount > 0) {
    issues.push({
      type: 'DUPLICATE_ROW',
      severity: duplicateCount > 10 ? 'high' : 'medium',
      location: 'Multiple rows',
      description: `${duplicateCount} duplicate row(s) found`,
      autoFixable: true,
      fixSuggestion: 'Use sheets_composite deduplicate action to remove duplicates',
    });
  }

  // ── 12. INVALID_EMAIL ──
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  columns.forEach((col, colIndex) => {
    if (col.dataType !== 'text') return;

    const values = dataRows
      .map((row) => row[colIndex])
      .filter((v): v is string => typeof v === 'string' && v.length > 0);

    // Heuristic: if >30% of non-empty values look like emails, check all
    const emailLikeCount = values.filter((v) => v.includes('@')).length;
    if (emailLikeCount < values.length * 0.3 || emailLikeCount < 3) return;

    const invalidEmails = values.filter((v) => v.includes('@') && !emailPattern.test(v));
    if (invalidEmails.length > 0) {
      issues.push({
        type: 'INVALID_EMAIL',
        severity: invalidEmails.length > 10 ? 'high' : 'medium',
        location: col.name,
        description: `${invalidEmails.length} invalid email address(es) detected (e.g. "${invalidEmails[0]!.slice(0, 40)}")`,
        autoFixable: false,
        fixSuggestion: 'Review and correct email addresses',
      });
    }
  });

  // ── 13. INVALID_URL ──
  const urlPattern = /^https?:\/\/[^\s]+\.[^\s]+$/;
  columns.forEach((col, colIndex) => {
    if (col.dataType !== 'text') return;

    const values = dataRows
      .map((row) => row[colIndex])
      .filter((v): v is string => typeof v === 'string' && v.length > 0);

    // Heuristic: if >30% of non-empty values look like URLs, check all
    const urlLikeCount = values.filter(
      (v) => v.startsWith('http://') || v.startsWith('https://') || v.startsWith('www.')
    ).length;
    if (urlLikeCount < values.length * 0.3 || urlLikeCount < 3) return;

    const invalidUrls = values.filter(
      (v) =>
        (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('www.')) &&
        !urlPattern.test(v.startsWith('www.') ? `https://${v}` : v)
    );
    if (invalidUrls.length > 0) {
      issues.push({
        type: 'INVALID_URL',
        severity: invalidUrls.length > 10 ? 'high' : 'medium',
        location: col.name,
        description: `${invalidUrls.length} invalid URL(s) detected (e.g. "${invalidUrls[0]!.slice(0, 50)}")`,
        autoFixable: false,
        fixSuggestion: 'Review and correct URLs (ensure they start with http:// or https://)',
      });
    }
  });

  // ── 14. INVALID_DATE ──
  columns.forEach((col, colIndex) => {
    if (col.dataType !== 'text' && col.dataType !== 'date') return;

    const values = dataRows
      .map((row) => row[colIndex])
      .filter((v): v is string => typeof v === 'string' && v.length > 0);

    // Heuristic: check if column looks date-like
    const dateIndicators = /date|time|created|updated|modified|born|expires|due|start|end/i;
    const headerLooksDateLike = dateIndicators.test(col.name);
    const dateSeparatorCount = values.filter((v) =>
      /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(v)
    ).length;

    if (!headerLooksDateLike && dateSeparatorCount < values.length * 0.3) return;

    const invalidDates = values.filter((v) => {
      // Try parsing as date
      const parsed = new Date(v);
      if (isNaN(parsed.getTime())) return true;
      // Check for unreasonable dates (before 1900 or after 2100)
      const year = parsed.getFullYear();
      return year < 1900 || year > 2100;
    });

    if (invalidDates.length > 0 && invalidDates.length < values.length * 0.8) {
      issues.push({
        type: 'INVALID_DATE',
        severity: invalidDates.length > 10 ? 'high' : 'medium',
        location: col.name,
        description: `${invalidDates.length} invalid or unparseable date(s) detected (e.g. "${invalidDates[0]!.slice(0, 30)}")`,
        autoFixable: false,
        fixSuggestion: 'Review date values - ensure consistent format (YYYY-MM-DD recommended)',
      });
    }
  });

  // ── 15. FORMULA_ERROR ──
  // Formula errors are detected via the formula enrichment step.
  // Here we detect #ERROR!, #REF!, #N/A, #VALUE!, #DIV/0!, #NAME? in cell values
  let formulaErrorCount = 0;
  const formulaErrorTypes = new Set<string>();
  dataRows.forEach((row) => {
    row.forEach((cell) => {
      if (typeof cell === 'string') {
        const errorMatch = cell.match(/^#(ERROR!|REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NULL!)$/);
        if (errorMatch) {
          formulaErrorCount++;
          formulaErrorTypes.add(cell);
        }
      }
    });
  });

  if (formulaErrorCount > 0) {
    issues.push({
      type: 'FORMULA_ERROR',
      severity: formulaErrorCount > 10 ? 'high' : formulaErrorCount > 3 ? 'medium' : 'low',
      location: 'Multiple cells',
      description: `${formulaErrorCount} formula error(s) detected: ${[...formulaErrorTypes].join(', ')}`,
      autoFixable: false,
      fixSuggestion:
        'Review formulas producing errors - common causes: broken references, division by zero, invalid lookups',
    });
  }

  // ── Calculate scores ──
  const completeness =
    columns.length > 0
      ? columns.reduce((sum, col) => sum + col.completeness, 0) / columns.length
      : 0;

  const consistency =
    100 -
    (issues.filter((i) => i.severity === 'high').length * 15 +
      issues.filter((i) => i.severity === 'medium').length * 5 +
      issues.filter((i) => i.severity === 'low').length * 1);

  const qualityScore = Math.max(
    0,
    Math.min(100, completeness * 0.5 + Math.max(0, consistency) * 0.5)
  );

  return {
    qualityScore,
    completeness,
    consistency: Math.max(0, consistency),
    issues,
  };
}
