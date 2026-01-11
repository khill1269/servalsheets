/**
 * ServalSheets - Handler Optimization Utilities
 *
 * Performance utilities for handler hot paths.
 *
 * Optimizations:
 * 1. Pre-computed action dispatch tables (O(1) lookup vs switch)
 * 2. Inline cache key generation (no object allocation)
 * 3. Lazy context tracking (only when needed)
 * 4. Fast parameter presence checks
 * 5. Optimized response building
 *
 * @module handlers/optimization
 */

// ============================================================================
// ACTION DISPATCH OPTIMIZATION
// ============================================================================

/**
 * Create a fast action dispatcher using a Map
 * Avoids switch statement overhead for frequent actions
 */
export function createActionDispatcher<TInput extends { action: string }, TOutput>(
  handlers: Record<string, (input: TInput) => Promise<TOutput>>,
): (input: TInput) => Promise<TOutput> {
  const dispatchMap = new Map(Object.entries(handlers));

  return async (input: TInput): Promise<TOutput> => {
    const handler = dispatchMap.get(input.action);
    if (!handler) {
      throw new Error(`Unknown action: ${input.action}`);
    }
    return handler(input);
  };
}

// ============================================================================
// CACHE KEY OPTIMIZATION
// ============================================================================

// Pre-allocated string builder buffer (avoid allocations in hot path)
const keyBuffer: string[] = [];

/**
 * Fast cache key generation without object allocation
 * Uses a simple string join instead of JSON.stringify
 */
export function fastCacheKey(prefix: string, ...parts: (string | number | undefined)[]): string {
  keyBuffer.length = 0;
  keyBuffer.push(prefix);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part !== undefined) {
      keyBuffer.push(String(part));
    }
  }

  return keyBuffer.join(":");
}

/**
 * Fast cache key for spreadsheet operations
 */
export function spreadsheetCacheKey(
  operation: string,
  spreadsheetId: string,
  range?: string,
  extra?: string,
): string {
  if (extra) {
    return range
      ? `${operation}:${spreadsheetId}:${range}:${extra}`
      : `${operation}:${spreadsheetId}:${extra}`;
  }
  return range
    ? `${operation}:${spreadsheetId}:${range}`
    : `${operation}:${spreadsheetId}`;
}

// ============================================================================
// PARAMETER OPTIMIZATION
// ============================================================================

/**
 * Check if all required parameters are present (avoid inference overhead)
 */
export function hasRequiredParams(
  input: Record<string, unknown>,
  ...required: string[]
): boolean {
  for (let i = 0; i < required.length; i++) {
    if (input[required[i]!] === undefined) {
      return false;
    }
  }
  return true;
}

/**
 * Fast spreadsheet ID extraction (avoids type narrowing overhead)
 */
export function getSpreadsheetId(input: Record<string, unknown>): string | undefined {
  const id = input["spreadsheetId"];
  return typeof id === "string" ? id : undefined;
}

/**
 * Fast action extraction
 */
export function getAction(input: Record<string, unknown>): string | undefined {
  const action = input["action"];
  return typeof action === "string" ? action : undefined;
}

// ============================================================================
// RESPONSE OPTIMIZATION
// ============================================================================

// Pre-allocated response templates to reduce object creation
const SUCCESS_BASE = { success: true as const };
const ERROR_BASE = { success: false as const };

/**
 * Fast success response builder
 * Minimizes object allocation by reusing base and only adding needed fields
 */
export function fastSuccess<T extends Record<string, unknown>>(
  action: string,
  data: T,
): T & { success: true; action: string } {
  return {
    ...SUCCESS_BASE,
    action,
    ...data,
  };
}

/**
 * Fast error response builder
 */
export function fastError(
  code: string,
  message: string,
  retryable: boolean = false,
): { success: false; error: { code: string; message: string; retryable: boolean } } {
  return {
    ...ERROR_BASE,
    error: { code, message, retryable },
  };
}

// ============================================================================
// ASYNC OPTIMIZATION
// ============================================================================

/**
 * Execute multiple async operations in parallel with early bailout
 * Returns as soon as first operation fails
 */
export async function parallelWithBailout<T>(
  operations: (() => Promise<T>)[],
): Promise<T[]> {
  const results: T[] = [];
  const promises = operations.map(async (op, index) => {
    const result = await op();
    results[index] = result;
    return result;
  });

  await Promise.all(promises);
  return results;
}

/**
 * Batch async operations with concurrency limit
 */
export async function batchAsync<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  concurrency: number = 5,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(operation));
    results.push(...batchResults);
  }

  return results;
}

// ============================================================================
// CONTEXT OPTIMIZATION
// ============================================================================

/**
 * Lazy context tracker - only updates context when values change
 */
export class LazyContextTracker {
  private lastSpreadsheetId?: string;
  private lastSheetId?: number;
  private lastRange?: string;

  constructor(
    private updateFn: (params: {
      spreadsheetId?: string;
      sheetId?: number;
      range?: string;
    }) => void,
  ) {}

  /**
   * Track context only if values have changed
   */
  track(params: {
    spreadsheetId?: string;
    sheetId?: number;
    range?: string;
  }): void {
    const { spreadsheetId, sheetId, range } = params;

    // Only update if values have changed
    if (
      spreadsheetId !== this.lastSpreadsheetId ||
      sheetId !== this.lastSheetId ||
      range !== this.lastRange
    ) {
      this.updateFn(params);
      this.lastSpreadsheetId = spreadsheetId;
      this.lastSheetId = sheetId;
      this.lastRange = range;
    }
  }

  /**
   * Reset tracking state
   */
  reset(): void {
    this.lastSpreadsheetId = undefined;
    this.lastSheetId = undefined;
    this.lastRange = undefined;
  }
}

// ============================================================================
// VALUES ARRAY OPTIMIZATION
// ============================================================================

/**
 * Fast cell count for values array (avoids reduce overhead)
 */
export function countCells(values: unknown[][]): number {
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    count += values[i]!.length;
  }
  return count;
}

/**
 * Fast row count
 */
export function countRows(values: unknown[][]): number {
  return values.length;
}

/**
 * Fast column count (from first row)
 */
export function countColumns(values: unknown[][]): number {
  return values.length > 0 ? values[0]!.length : 0;
}

/**
 * Truncate values array efficiently
 */
export function truncateValues(
  values: unknown[][],
  maxRows: number,
  maxCells: number,
): { values: unknown[][]; truncated: boolean; originalRows: number; originalCells: number } {
  const originalRows = values.length;
  let originalCells = 0;
  let cellCount = 0;
  let rowIndex = 0;

  // Count total cells and find truncation point
  for (let i = 0; i < values.length; i++) {
    const rowCells = values[i]!.length;
    originalCells += rowCells;

    if (rowIndex < maxRows && cellCount + rowCells <= maxCells) {
      cellCount += rowCells;
      rowIndex = i + 1;
    }
  }

  const truncated = originalRows > maxRows || originalCells > maxCells;

  return {
    values: truncated ? values.slice(0, rowIndex) : values,
    truncated,
    originalRows,
    originalCells,
  };
}

// ============================================================================
// RANGE OPTIMIZATION
// ============================================================================

// Pre-compiled regex for range parsing
const A1_RANGE_REGEX = /^(?:([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i;

/**
 * Fast A1 range parsing (avoids regex when possible)
 * Named fastParseA1Range to avoid conflict with services/parseA1Range
 */
export function fastParseA1Range(range: string): {
  sheet?: string;
  startCol: string;
  startRow: number;
  endCol?: string;
  endRow?: number;
} | null {
  const match = A1_RANGE_REGEX.exec(range);
  if (!match) return null;

  return {
    sheet: match[1],
    startCol: match[2]!.toUpperCase(),
    startRow: parseInt(match[3]!, 10),
    endCol: match[4]?.toUpperCase(),
    endRow: match[5] ? parseInt(match[5], 10) : undefined,
  };
}

/**
 * Fast range cell count estimation
 */
export function estimateRangeCells(range: string): number {
  const parsed = fastParseA1Range(range);
  if (!parsed) return 0;

  if (!parsed.endCol || !parsed.endRow) {
    return 1; // Single cell
  }

  const startColIndex = columnLetterToIndex(parsed.startCol);
  const endColIndex = columnLetterToIndex(parsed.endCol);
  const rows = parsed.endRow - parsed.startRow + 1;
  const cols = endColIndex - startColIndex + 1;

  return rows * cols;
}

// Pre-computed column index cache (A-ZZ = 702 columns)
const COLUMN_INDEX_CACHE = new Map<string, number>();

/**
 * Fast column letter to index conversion with caching
 */
export function columnLetterToIndex(letter: string): number {
  const cached = COLUMN_INDEX_CACHE.get(letter);
  if (cached !== undefined) return cached;

  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  index -= 1; // Convert to 0-based

  COLUMN_INDEX_CACHE.set(letter, index);
  return index;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const HandlerOptimization = {
  // Action dispatch
  createActionDispatcher,

  // Cache keys
  fastCacheKey,
  spreadsheetCacheKey,

  // Parameters
  hasRequiredParams,
  getSpreadsheetId,
  getAction,

  // Responses
  fastSuccess,
  fastError,

  // Async
  parallelWithBailout,
  batchAsync,

  // Context
  LazyContextTracker,

  // Values
  countCells,
  countRows,
  countColumns,
  truncateValues,

  // Range
  fastParseA1Range,
  estimateRangeCells,
  columnLetterToIndex,
};
