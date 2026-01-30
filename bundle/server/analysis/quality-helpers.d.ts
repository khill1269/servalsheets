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
export declare function findDuplicateRows(data: unknown[][]): {
    duplicateGroups: DuplicateGroup[];
    duplicateCount: number;
    uniqueCount: number;
};
/**
 * Near-duplicate match
 */
export interface NearDuplicate {
    rows: [number, number];
    similarity: number;
    differences: Array<{
        column: number;
        value1: unknown;
        value2: unknown;
    }>;
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
export declare function findNearDuplicates(data: unknown[][], threshold?: number, maxSample?: number): NearDuplicate[];
/**
 * Column type analysis result
 */
export interface ColumnTypeAnalysis {
    column: number;
    types: Record<string, number>;
    dominantType: string;
    consistency: number;
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
export declare function analyzeColumnTypes(data: unknown[][]): ColumnTypeAnalysis[];
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
export declare function validateEmails(values: string[]): EmailValidation[];
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
export declare function validateDates(values: unknown[]): DateValidation[];
/**
 * Whitespace issue
 */
export interface WhitespaceIssue {
    row: number;
    column: number;
    value: string;
    type: 'leading' | 'trailing' | 'both' | 'multiple_spaces';
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
export declare function findWhitespaceIssues(data: unknown[][]): WhitespaceIssue[];
/**
 * Format inconsistency
 */
export interface FormatInconsistency {
    column: number;
    patterns: Array<{
        pattern: string;
        count: number;
        examples: Array<{
            row: number;
            value: string;
        }>;
    }>;
    dominantPattern: string;
    inconsistencyRate: number;
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
export declare function findFormatInconsistencies(data: unknown[][], minPatternCount?: number): FormatInconsistency[];
//# sourceMappingURL=quality-helpers.d.ts.map