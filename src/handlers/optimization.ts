/**
 * ServalSheets - Handler Optimization Utilities
 *
 * Fast, low-allocation helpers for handler hot paths.
 */

import { ServiceError } from '../core/errors.js';

// ---------------------------------------------------------------------------
// Cache Key Generation
// ---------------------------------------------------------------------------

export function fastCacheKey(prefix: string, ...parts: (string | number | undefined)[]): string {
  let key = prefix;
  for (const part of parts) {
    if (part !== undefined) {
      key += ':' + String(part);
    }
  }
  return key;
}

export function spreadsheetCacheKey(
  prefix: string,
  spreadsheetId: string,
  range?: string,
  extra?: string
): string {
  let key = `${prefix}:${spreadsheetId}`;
  if (range !== undefined) key += `:${range}`;
  if (extra !== undefined) key += `:${extra}`;
  return key;
}

// ---------------------------------------------------------------------------
// Parameter Utilities
// ---------------------------------------------------------------------------

export function hasRequiredParams(input: Record<string, unknown>, ...required: string[]): boolean {
  for (const key of required) {
    if (!(key in input) || input[key] === undefined || input[key] === null) return false;
  }
  return true;
}

export function getSpreadsheetId(input: Record<string, unknown>): string | undefined {
  const id = input['spreadsheetId'];
  return typeof id === 'string' ? id : undefined;
}

export function getAction(input: Record<string, unknown>): string | undefined {
  const action = input['action'];
  return typeof action === 'string' ? action : undefined;
}

// ---------------------------------------------------------------------------
// Response Builders
// ---------------------------------------------------------------------------

export interface FastSuccessResponse {
  success: true;
  action: string;
  [key: string]: unknown;
}

export interface FastErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export function fastSuccess(action: string, data: Record<string, unknown>): FastSuccessResponse {
  return { success: true, action, ...data };
}

export function fastError(code: string, message: string, retryable = false): FastErrorResponse {
  return { success: false, error: { code, message, retryable } };
}

// ---------------------------------------------------------------------------
// Values Array Utilities
// ---------------------------------------------------------------------------

export function countCells(values: unknown[][]): number {
  let total = 0;
  for (const row of values) total += row.length;
  return total;
}

export function countRows(values: unknown[][]): number {
  return values.length;
}

export function countColumns(values: unknown[][]): number {
  return values.length > 0 ? (values[0]?.length ?? 0) : 0;
}

export interface TruncateResult {
  values: unknown[][];
  truncated: boolean;
  originalRows?: number;
  originalCells?: number;
}

export function truncateValues(
  values: unknown[][],
  maxRows: number,
  maxCells: number
): TruncateResult {
  const originalRows = values.length;
  const originalCells = countCells(values);

  if (originalRows <= maxRows && originalCells <= maxCells) {
    return { values, truncated: false };
  }

  // Truncate by cell count first
  if (originalCells > maxCells) {
    let cellCount = 0;
    const truncated: unknown[][] = [];
    for (const row of values) {
      if (cellCount + row.length > maxCells) break;
      truncated.push(row);
      cellCount += row.length;
    }
    return { values: truncated, truncated: true, originalRows, originalCells };
  }

  // Truncate by row count
  return { values: values.slice(0, maxRows), truncated: true, originalRows, originalCells };
}

// ---------------------------------------------------------------------------
// Range Utilities
// ---------------------------------------------------------------------------

export interface ParsedA1Range {
  sheet: string | undefined;
  startCol: string;
  startRow: number;
  endCol: string | undefined;
  endRow: number | undefined;
}

const A1_RE = /^(?:([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/;

export function fastParseA1Range(range: string): ParsedA1Range | null {
  const m = A1_RE.exec(range.toUpperCase());
  if (!m) return null;
  return {
    sheet: m[1] !== undefined ? range.split('!')[0] : undefined,
    startCol: m[2]!,
    startRow: parseInt(m[3]!, 10),
    endCol: m[4],
    endRow: m[5] !== undefined ? parseInt(m[5], 10) : undefined,
  };
}

export function columnLetterToIndex(col: string): number {
  let index = 0;
  const upper = col.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function estimateRangeCells(range: string): number {
  const parsed = fastParseA1Range(range);
  if (!parsed) return 0;
  if (parsed.endCol === undefined || parsed.endRow === undefined) return 1;
  const cols = columnLetterToIndex(parsed.endCol) - columnLetterToIndex(parsed.startCol) + 1;
  const rows = parsed.endRow - parsed.startRow + 1;
  return cols * rows;
}

// ---------------------------------------------------------------------------
// Action Dispatcher
// ---------------------------------------------------------------------------

type Handler<T, R> = (input: T) => Promise<R>;

export function createActionDispatcher<T extends { action: string }, R>(
  handlers: Record<string, Handler<T, R>>
): Handler<T, R> {
  return async (input: T) => {
    const handler = handlers[input.action];
    if (!handler) {
      throw new ServiceError(
        `Unknown action: ${input.action}`,
        'INVALID_ACTION',
        'handler-router',
        false
      );
    }
    return handler(input);
  };
}

// ---------------------------------------------------------------------------
// LazyContextTracker
// ---------------------------------------------------------------------------

export class LazyContextTracker {
  private lastKey: string | undefined;

  constructor(private readonly onChange: (params: Record<string, unknown>) => void) {}

  track(params: Record<string, unknown>): void {
    const key = JSON.stringify(params);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.onChange(params);
    }
  }

  reset(): void {
    this.lastKey = undefined;
  }
}

// ---------------------------------------------------------------------------
// Async Utilities
// ---------------------------------------------------------------------------

export async function batchAsync<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}
