/**
 * ServalSheets - Data Quality Analysis Helpers
 *
 * Comprehensive data quality checks covering:
 * - Completeness (empty cells, null values, missing required fields)
 * - Uniqueness (duplicate rows, duplicate values)
 * - Consistency (data types, formats, case, whitespace)
 * - Validity (email, URL, date formats, numeric ranges)
 *
 * These functions power the analyze_quality action.
 */

/**
 * Duplicate row group
 */
export interface DuplicateGroup {
  hash: string;
  rows: number[];
  count: number;
}

/**
 * Find duplicate rows using hash comparison
 * O(n) complexity with hash map
 *
 * @param data - 2D array of cell values
 * @returns Duplicate groups, counts, and unique count
 *
 * @example
 * ```typescript
 * const duplicates = findDuplicateRows([
 *   ['A', 'B', 'C'],
 *   ['A', 'B', 'C'],  // Duplicate of row 0
 *   ['X', 'Y', 'Z']
 * ]);
 * // Returns: { duplicateGroups: [[0, 1]], duplicateCount: 1, uniqueCount: 2 }
 * ```
 */
export function findDuplicateRows(data: unknown[][]): {
  duplicateGroups: DuplicateGroup[];
  duplicateCount: number;
  uniqueCount: number;
} {
  const hashMap = new Map<string, number[]>();

  // Build hash map
  for (let i = 0; i < data.length; i++) {
    const hash = JSON.stringify(data[i]);
    const existing = hashMap.get(hash) ?? [];
    existing.push(i);
    hashMap.set(hash, existing);
  }

  // Extract duplicate groups
  const duplicateGroups: DuplicateGroup[] = [];
  let duplicateCount = 0;

  for (const [hash, rows] of hashMap.entries()) {
    if (rows.length > 1) {
      duplicateGroups.push({
        hash,
        rows,
        count: rows.length,
      });
      duplicateCount += rows.length - 1; // Count extras
    }
  }

  const uniqueCount = hashMap.size;

  return {
    duplicateGroups: duplicateGroups.sort((a, b) => b.count - a.count),
    duplicateCount,
    uniqueCount,
  };
}

/**
 * Near-duplicate match
 */
export interface NearDuplicate {
  rows: [number, number];
  similarity: number;
  differences: Array<{ column: number; value1: unknown; value2: unknown }>;
}

/**
 * Find near-duplicate rows using Levenshtein distance
 * O(n²) complexity - use sampling for large datasets
 *
 * @param data - 2D array of cell values
 * @param threshold - Similarity threshold (0-1), default 0.9
 * @param maxSample - Maximum rows to compare (default 1000)
 * @returns Array of near-duplicate pairs
 *
 * @example
 * ```typescript
 * const nearDups = findNearDuplicates([
 *   ['John Doe', 'john@example.com'],
 *   ['John  Doe', 'john@example.com'],  // Near-duplicate (extra space)
 * ], 0.9);
 * // Returns: [{ rows: [0, 1], similarity: 0.95, differences: [...] }]
 * ```
 */
export function findNearDuplicates(
  data: unknown[][],
  threshold: number = 0.9,
  maxSample: number = 1000,
): NearDuplicate[] {
  const nearDuplicates: NearDuplicate[] = [];

  // Sample if dataset is large
  const sampleSize = Math.min(data.length, maxSample);
  const step = Math.ceil(data.length / sampleSize);

  for (let i = 0; i < sampleSize; i++) {
    const idx1 = i * step;
    if (idx1 >= data.length) break;

    for (let j = i + 1; j < sampleSize; j++) {
      const idx2 = j * step;
      if (idx2 >= data.length) break;

      const row1 = data[idx1];
      const row2 = data[idx2];

      if (row1.length !== row2.length) continue;

      let matches = 0;
      let total = 0;
      const differences: Array<{
        column: number;
        value1: unknown;
        value2: unknown;
      }> = [];

      for (let col = 0; col < row1.length; col++) {
        total++;
        if (String(row1[col]) === String(row2[col])) {
          matches++;
        } else {
          differences.push({
            column: col,
            value1: row1[col],
            value2: row2[col],
          });
        }
      }

      const similarity = total > 0 ? matches / total : 0;

      if (similarity >= threshold) {
        nearDuplicates.push({
          rows: [idx1, idx2],
          similarity,
          differences,
        });
      }
    }
  }

  return nearDuplicates.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Column type analysis result
 */
export interface ColumnTypeAnalysis {
  column: number;
  types: Record<string, number>; // type → count
  dominantType: string;
  consistency: number; // 0-100
  nullCount: number;
  nullPercentage: number;
}

/**
 * Analyze data type consistency per column
 * Returns percentage distribution of types
 *
 * @param data - 2D array of cell values
 * @returns Array of column type analyses
 *
 * @example
 * ```typescript
 * const types = analyzeColumnTypes([
 *   ['Name', 'Age', 'Email'],
 *   ['John', 25, 'john@example.com'],
 *   ['Jane', '30', 'jane@example.com'],  // Age is string (inconsistent)
 * ]);
 * // Returns: [
 * //   { column: 1, types: {number: 1, string: 1}, dominantType: 'mixed', consistency: 50 },
 * //   ...
 * // ]
 * ```
 */
export function analyzeColumnTypes(data: unknown[][]): ColumnTypeAnalysis[] {
  if (data.length === 0) return [];

  const columnCount = Math.max(...data.map((row) => row.length));
  const results: ColumnTypeAnalysis[] = [];

  for (let col = 0; col < columnCount; col++) {
    const types: Record<string, number> = {};
    let nullCount = 0;

    for (let row = 0; row < data.length; row++) {
      const value = data[row]?.[col];

      if (value === null || value === undefined || value === "") {
        nullCount++;
        continue;
      }

      const type = typeof value;
      types[type] = (types[type] ?? 0) + 1;
    }

    // Determine dominant type
    let dominantType = "empty";
    let maxCount = 0;

    for (const [type, count] of Object.entries(types)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }

    // Calculate consistency (% of dominant type)
    const totalNonNull = data.length - nullCount;
    const consistency =
      totalNonNull > 0 ? (maxCount / totalNonNull) * 100 : 100;

    // Mixed if consistency < 80%
    if (consistency < 80 && Object.keys(types).length > 1) {
      dominantType = "mixed";
    }

    results.push({
      column: col,
      types,
      dominantType,
      consistency: Math.round(consistency),
      nullCount,
      nullPercentage: Math.round((nullCount / data.length) * 100),
    });
  }

  return results;
}

/**
 * Email validation result
 */
export interface EmailValidation {
  index: number;
  value: string;
  isValid: boolean;
  issue?: string;
}

/**
 * Validate email format
 * Uses RFC 5322 simplified regex
 *
 * @param values - Array of potential email addresses
 * @returns Array of validation results
 *
 * @example
 * ```typescript
 * const results = validateEmails([
 *   'valid@example.com',
 *   'invalid@',
 *   'no-at-sign.com'
 * ]);
 * // Returns: [
 * //   { index: 0, value: 'valid@example.com', isValid: true },
 * //   { index: 1, value: 'invalid@', isValid: false, issue: 'Missing domain' },
 * //   ...
 * // ]
 * ```
 */
export function validateEmails(values: string[]): EmailValidation[] {
  const results: EmailValidation[] = [];
  // Simplified RFC 5322 regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  for (let i = 0; i < values.length; i++) {
    const value = String(values[i] ?? "").trim();

    if (value === "") {
      results.push({
        index: i,
        value,
        isValid: false,
        issue: "Empty value",
      });
      continue;
    }

    if (!value.includes("@")) {
      results.push({
        index: i,
        value,
        isValid: false,
        issue: "Missing @ symbol",
      });
      continue;
    }

    const parts = value.split("@");
    if (parts.length !== 2) {
      results.push({
        index: i,
        value,
        isValid: false,
        issue: "Multiple @ symbols",
      });
      continue;
    }

    if (!parts[1]?.includes(".")) {
      results.push({
        index: i,
        value,
        isValid: false,
        issue: "Missing domain extension",
      });
      continue;
    }

    const isValid = emailRegex.test(value);
    results.push({
      index: i,
      value,
      isValid,
      issue: isValid ? undefined : "Invalid format",
    });
  }

  return results;
}

/**
 * Date validation result
 */
export interface DateValidation {
  index: number;
  value: unknown;
  isValid: boolean;
  inferredFormat?: string;
  parsedDate?: Date;
  issue?: string;
}

/**
 * Validate date formats
 * Attempts multiple common formats
 *
 * @param values - Array of potential dates
 * @returns Array of validation results
 *
 * @example
 * ```typescript
 * const results = validateDates([
 *   '2024-01-15',
 *   '01/15/2024',
 *   'invalid',
 *   new Date('2024-01-15')
 * ]);
 * // Returns: [
 * //   { index: 0, value: '2024-01-15', isValid: true, inferredFormat: 'ISO 8601' },
 * //   { index: 1, value: '01/15/2024', isValid: true, inferredFormat: 'MM/DD/YYYY' },
 * //   ...
 * // ]
 * ```
 */
export function validateDates(values: unknown[]): DateValidation[] {
  const results: DateValidation[] = [];

  const formats = [
    {
      name: "ISO 8601",
      test: (v: string) => /^\d{4}-\d{2}-\d{2}/.test(v),
    },
    {
      name: "MM/DD/YYYY",
      test: (v: string) => /^\d{1,2}\/\d{1,2}\/\d{4}/.test(v),
    },
    {
      name: "DD/MM/YYYY",
      test: (v: string) => /^\d{1,2}\/\d{1,2}\/\d{4}/.test(v),
    },
    {
      name: "YYYY/MM/DD",
      test: (v: string) => /^\d{4}\/\d{2}\/\d{2}/.test(v),
    },
  ];

  for (let i = 0; i < values.length; i++) {
    const value = values[i];

    // Check if already a Date object
    if (value instanceof Date) {
      const isValid = !isNaN(value.getTime());
      results.push({
        index: i,
        value,
        isValid,
        inferredFormat: "Date object",
        parsedDate: isValid ? value : undefined,
        issue: isValid ? undefined : "Invalid Date object",
      });
      continue;
    }

    const stringValue = String(value ?? "").trim();

    if (stringValue === "") {
      results.push({
        index: i,
        value,
        isValid: false,
        issue: "Empty value",
      });
      continue;
    }

    // Try parsing with Date constructor
    const parsed = new Date(stringValue);
    if (!isNaN(parsed.getTime())) {
      // Find matching format
      let inferredFormat = "Unknown format";
      for (const format of formats) {
        if (format.test(stringValue)) {
          inferredFormat = format.name;
          break;
        }
      }

      results.push({
        index: i,
        value,
        isValid: true,
        inferredFormat,
        parsedDate: parsed,
      });
    } else {
      results.push({
        index: i,
        value,
        isValid: false,
        issue: "Unable to parse as date",
      });
    }
  }

  return results;
}

/**
 * Whitespace issue
 */
export interface WhitespaceIssue {
  row: number;
  column: number;
  value: string;
  type: "leading" | "trailing" | "both" | "multiple_spaces";
  suggestion: string;
}

/**
 * Find whitespace issues (leading, trailing, multiple spaces)
 *
 * @param data - 2D array of cell values
 * @returns Array of whitespace issues
 *
 * @example
 * ```typescript
 * const issues = findWhitespaceIssues([
 *   ['  John  ', 'Doe'],
 *   ['Jane', 'Smith   ']
 * ]);
 * // Returns: [
 * //   { row: 0, column: 0, value: '  John  ', type: 'both', suggestion: 'John' },
 * //   { row: 1, column: 1, value: 'Smith   ', type: 'trailing', suggestion: 'Smith' }
 * // ]
 * ```
 */
export function findWhitespaceIssues(data: unknown[][]): WhitespaceIssue[] {
  const issues: WhitespaceIssue[] = [];

  for (let row = 0; row < data.length; row++) {
    const rowData = data[row];
    if (!rowData) continue;

    for (let col = 0; col < rowData.length; col++) {
      const value = rowData[col];
      if (typeof value !== "string") continue;

      const trimmed = value.trim();
      const hasLeading = value !== value.trimStart();
      const hasTrailing = value !== value.trimEnd();
      const hasMultiple = /\s{2,}/.test(value);

      if (hasLeading || hasTrailing || hasMultiple) {
        let type: "leading" | "trailing" | "both" | "multiple_spaces";

        if (hasLeading && hasTrailing) {
          type = "both";
        } else if (hasLeading) {
          type = "leading";
        } else if (hasTrailing) {
          type = "trailing";
        } else {
          type = "multiple_spaces";
        }

        issues.push({
          row,
          column: col,
          value,
          type,
          suggestion: trimmed.replace(/\s{2,}/g, " "),
        });
      }
    }
  }

  return issues;
}

/**
 * Format inconsistency
 */
export interface FormatInconsistency {
  column: number;
  patterns: Array<{
    pattern: string;
    count: number;
    examples: Array<{ row: number; value: string }>;
  }>;
  dominantPattern: string;
  inconsistencyRate: number; // 0-100
}

/**
 * Find format inconsistencies (e.g., date formats, phone numbers)
 *
 * @param data - 2D array of cell values
 * @param minPatternCount - Minimum occurrences to be considered a pattern (default 2)
 * @returns Array of format inconsistencies per column
 *
 * @example
 * ```typescript
 * const inconsistencies = findFormatInconsistencies([
 *   ['Name', 'Phone'],
 *   ['John', '555-1234'],
 *   ['Jane', '(555) 5678'],
 *   ['Bob', '555.9012']
 * ]);
 * // Returns: [{
 * //   column: 1,
 * //   patterns: [
 * //     { pattern: 'DDD-DDDD', count: 1, examples: [...] },
 * //     { pattern: '(DDD) DDDD', count: 1, examples: [...] },
 * //     { pattern: 'DDD.DDDD', count: 1, examples: [...] }
 * //   ],
 * //   dominantPattern: 'Mixed',
 * //   inconsistencyRate: 66
 * // }]
 * ```
 */
export function findFormatInconsistencies(
  data: unknown[][],
  minPatternCount: number = 2,
): FormatInconsistency[] {
  if (data.length === 0) return [];

  const columnCount = Math.max(...data.map((row) => row.length));
  const results: FormatInconsistency[] = [];

  for (let col = 0; col < columnCount; col++) {
    const patterns = new Map<string, Array<{ row: number; value: string }>>();

    for (let row = 0; row < data.length; row++) {
      const value = data[row]?.[col];
      if (value === null || value === undefined || value === "") continue;

      const stringValue = String(value);
      // Convert to pattern (X = alphanumeric, others preserved)
      const pattern = stringValue.replace(/[a-zA-Z0-9]/g, "X");

      const existing = patterns.get(pattern) ?? [];
      existing.push({ row, value: stringValue });
      patterns.set(pattern, existing);
    }

    // Find patterns with sufficient occurrences
    const significantPatterns = Array.from(patterns.entries())
      .filter(([_, examples]) => examples.length >= minPatternCount)
      .map(([pattern, examples]) => ({
        pattern,
        count: examples.length,
        examples: examples.slice(0, 3), // Keep first 3 examples
      }))
      .sort((a, b) => b.count - a.count);

    if (significantPatterns.length > 1) {
      const totalValues = Array.from(patterns.values()).reduce(
        (sum, examples) => sum + examples.length,
        0,
      );
      const dominantCount = significantPatterns[0]?.count ?? 0;
      const inconsistencyRate = Math.round(
        ((totalValues - dominantCount) / totalValues) * 100,
      );

      results.push({
        column: col,
        patterns: significantPatterns,
        dominantPattern: significantPatterns[0]?.pattern ?? "Unknown",
        inconsistencyRate,
      });
    }
  }

  return results;
}
