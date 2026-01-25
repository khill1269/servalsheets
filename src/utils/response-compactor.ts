/**
 * ServalSheets - Response Compactor
 *
 * Minimizes response size to reduce context window pressure.
 * After ~100 tool calls, Claude's context window fills up causing resets.
 * This compactor reduces response sizes by 50-80%.
 *
 * Features:
 * - Smart array sampling (first-last, evenly-spaced)
 * - Verbosity-aware truncation (respects verbosity:"detailed")
 * - Token-efficient metadata hints
 *
 * @module utils/response-compactor
 */

export type SamplingStrategy = 'first-last' | 'evenly-spaced' | 'first-only';

export interface TruncationMetadata {
  totalCount: number;
  truncatedCount: number;
  samplingStrategy: SamplingStrategy;
  hint: string;
}

/**
 * Fields that are always included in compact responses
 */
const ESSENTIAL_FIELDS = ['success', 'action', 'message', 'error', 'authenticated'];

/**
 * Fields included only if they don't exceed size limits
 */
const CONDITIONAL_FIELDS = ['values', 'data', 'sheets', 'charts', 'items', 'results'];

/**
 * Fields always stripped in compact mode
 */
const STRIPPED_FIELDS = [
  '_meta',
  'costEstimate',
  'quotaImpact',
  'cacheHit',
  'fetchTime',
  'traceId',
  'spanId',
  'requestId',
  'debugInfo',
];

/**
 * Maximum size for inline arrays before truncation
 * OPTIMIZATION: Reduced from 500 to 100 for faster responses
 */
const MAX_INLINE_ITEMS = parseInt(process.env['MAX_INLINE_CELLS'] || '100', 10);

/**
 * Maximum string length before truncation
 * OPTIMIZATION: Reduced from 500 to 200 for smaller payloads
 */
const MAX_STRING_LENGTH = 200;

/**
 * Whether compact mode is enabled
 * CRITICAL: Enabled by default to prevent context window bloat in Claude Desktop
 * (disabled only if explicitly set to 'false')
 */
export function isCompactModeEnabled(): boolean {
  return process.env['COMPACT_RESPONSES'] !== 'false';
}

/**
 * Check if verbosity override is enabled
 * @param verbosity - Verbosity level from input ('minimal' | 'standard' | 'detailed')
 * @returns True if truncation should be skipped
 */
export function shouldSkipTruncation(verbosity?: string): boolean {
  return verbosity === 'detailed' || process.env['COMPACT_RESPONSES'] === 'false';
}

/**
 * Compact a response object to minimize context window usage
 *
 * @param response - The full response object
 * @param options - Compaction options
 * @returns Compacted response with minimal fields
 */
export function compactResponse<T extends Record<string, unknown>>(
  response: T,
  options?: { verbosity?: string }
): T {
  // Skip truncation if verbosity:"detailed" or compact mode disabled
  if (!isCompactModeEnabled() || shouldSkipTruncation(options?.verbosity)) {
    return response;
  }

  // If response has a 'response' wrapper, compact the inner object
  if ('response' in response && typeof response['response'] === 'object') {
    const innerCompact = compactInner(response['response'] as Record<string, unknown>, options);
    return { response: innerCompact } as unknown as T;
  }

  return compactInner(response, options) as unknown as T;
}

/**
 * Compact inner response object
 */
function compactInner(
  response: Record<string, unknown>,
  options?: { verbosity?: string }
): Record<string, unknown> {
  const compact: Record<string, unknown> = {};

  // Always include essential fields
  for (const field of ESSENTIAL_FIELDS) {
    if (field in response) {
      compact[field] = response[field];
    }
  }

  // Include conditional fields with size limits
  for (const field of CONDITIONAL_FIELDS) {
    if (field in response) {
      compact[field] = truncateValue(response[field], field, options);
    }
  }

  // Include simple scalar fields not in stripped list
  for (const [key, value] of Object.entries(response)) {
    if (STRIPPED_FIELDS.includes(key)) continue;
    if (ESSENTIAL_FIELDS.includes(key)) continue;
    if (CONDITIONAL_FIELDS.includes(key)) continue;

    // Include if it's a simple value
    if (isSimpleValue(value)) {
      compact[key] = truncateString(value);
    }
    // Include small objects
    else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const size = JSON.stringify(value).length;
      if (size < 500) {
        compact[key] = value;
      } else {
        compact[key] = '[object truncated]';
      }
    }
  }

  return compact;
}

/**
 * Truncate a value based on its type
 */
function truncateValue(
  value: unknown,
  fieldName: string,
  options?: { verbosity?: string }
): unknown {
  if (Array.isArray(value)) {
    return truncateArray(value, fieldName, options);
  }
  if (typeof value === 'string') {
    return truncateString(value);
  }
  if (typeof value === 'object' && value !== null) {
    return truncateObject(value as Record<string, unknown>);
  }
  return value;
}

/**
 * Truncate an array with smart sampling strategies
 */
function truncateArray(
  arr: unknown[],
  fieldName: string,
  options?: { verbosity?: string }
): unknown {
  // Skip truncation if verbosity:"detailed"
  if (shouldSkipTruncation(options?.verbosity)) {
    return arr;
  }

  // Small arrays pass through unchanged
  if (arr.length <= 10) {
    return arr;
  }

  // For 2D arrays (like cell values), use row-based truncation
  if (is2DArray(arr)) {
    return truncate2DArray(arr as unknown[][], fieldName);
  }

  // For 1D arrays, use smart sampling
  return truncate1DArray(arr, fieldName);
}

/**
 * Truncate 2D arrays (spreadsheet data) with row sampling
 */
function truncate2DArray(values: unknown[][], fieldName: string): unknown {
  const totalRows = values.length;
  const totalCells = values.reduce((sum, row) => sum + row.length, 0);

  if (totalCells <= MAX_INLINE_ITEMS) {
    return values;
  }

  // Sample strategy: first 3 rows + last 2 rows for pattern detection
  const previewRows = Math.min(5, totalRows);
  const firstRows = Math.ceil(previewRows * 0.6); // 60% from start
  const lastRows = previewRows - firstRows; // 40% from end

  const sampled: unknown[][] = [...values.slice(0, firstRows), ...values.slice(-lastRows)];

  const samplingStrategy: SamplingStrategy = 'first-last';

  return {
    _truncated: true,
    totalRows,
    totalCells,
    preview: sampled,
    _meta: {
      samplingStrategy,
      totalCount: totalRows,
      truncatedCount: totalRows - sampled.length,
      hint: `Set verbosity:"detailed" in ${fieldName} request to see all ${totalRows} rows`,
    },
  };
}

/**
 * Truncate 1D arrays with intelligent sampling
 */
function truncate1DArray(arr: unknown[], fieldName: string): unknown {
  if (arr.length <= MAX_INLINE_ITEMS) {
    return arr;
  }

  // Determine optimal sample size (max 20 items)
  const maxSampleSize = Math.min(20, MAX_INLINE_ITEMS);

  // Use first-last strategy: 60% from start, 40% from end
  const firstCount = Math.ceil(maxSampleSize * 0.6);
  const lastCount = maxSampleSize - firstCount;

  const sampled = [...arr.slice(0, firstCount), ...arr.slice(-lastCount)];

  const samplingStrategy: SamplingStrategy = 'first-last';

  return {
    _truncated: true,
    items: sampled,
    _meta: {
      samplingStrategy,
      totalCount: arr.length,
      truncatedCount: arr.length - sampled.length,
      hint: `Set verbosity:"detailed" in ${fieldName} request to see all ${arr.length} items`,
    },
  };
}

/**
 * Truncate a string if too long
 */
function truncateString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length <= MAX_STRING_LENGTH) return value;

  return (
    value.substring(0, MAX_STRING_LENGTH) + `... [${value.length - MAX_STRING_LENGTH} more chars]`
  );
}

/**
 * Truncate an object, removing nested complexity
 */
function truncateObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let fieldCount = 0;

  for (const [key, value] of Object.entries(obj)) {
    if (STRIPPED_FIELDS.includes(key)) continue;
    if (fieldCount >= 10) {
      result['_moreFields'] = Object.keys(obj).length - fieldCount;
      break;
    }

    if (isSimpleValue(value)) {
      result[key] = truncateString(value);
    } else if (Array.isArray(value)) {
      result[key] = `[${value.length} items]`;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = `{${Object.keys(value).length} fields}`;
    }
    fieldCount++;
  }

  return result;
}

/**
 * Check if value is a 2D array
 */
function is2DArray(arr: unknown[]): arr is unknown[][] {
  return arr.length > 0 && Array.isArray(arr[0]);
}

/**
 * Check if value is a simple primitive
 */
function isSimpleValue(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  );
}

/**
 * Get compaction statistics
 */
export function getCompactionStats(
  original: unknown,
  compacted: unknown
): {
  originalSize: number;
  compactedSize: number;
  reduction: number;
  reductionPercent: number;
} {
  const originalSize = JSON.stringify(original).length;
  const compactedSize = JSON.stringify(compacted).length;
  const reduction = originalSize - compactedSize;
  const reductionPercent = Math.round((reduction / originalSize) * 100);

  return {
    originalSize,
    compactedSize,
    reduction,
    reductionPercent,
  };
}
