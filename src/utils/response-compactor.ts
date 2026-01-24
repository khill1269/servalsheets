/**
 * ServalSheets - Response Compactor
 *
 * Minimizes response size to reduce context window pressure.
 * After ~100 tool calls, Claude's context window fills up causing resets.
 * This compactor reduces response sizes by 50-80%.
 *
 * @module utils/response-compactor
 */

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
 */
const MAX_INLINE_ITEMS = parseInt(process.env['MAX_INLINE_CELLS'] || '500', 10);

/**
 * Maximum string length before truncation
 */
const MAX_STRING_LENGTH = 500;

/**
 * Whether compact mode is enabled
 */
export function isCompactModeEnabled(): boolean {
  return process.env['COMPACT_RESPONSES'] === 'true';
}

/**
 * Compact a response object to minimize context window usage
 *
 * @param response - The full response object
 * @returns Compacted response with minimal fields
 */
export function compactResponse<T extends Record<string, unknown>>(response: T): T {
  if (!isCompactModeEnabled()) {
    return response;
  }

  // If response has a 'response' wrapper, compact the inner object
  if ('response' in response && typeof response['response'] === 'object') {
    const innerCompact = compactInner(response['response'] as Record<string, unknown>);
    return { response: innerCompact } as unknown as T;
  }

  return compactInner(response) as unknown as T;
}

/**
 * Compact inner response object
 */
function compactInner(response: Record<string, unknown>): Record<string, unknown> {
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
      compact[field] = truncateValue(response[field], field);
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
function truncateValue(value: unknown, fieldName: string): unknown {
  if (Array.isArray(value)) {
    return truncateArray(value, fieldName);
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
 * Truncate an array, keeping only essential items
 */
function truncateArray(arr: unknown[], _fieldName: string): unknown {
  if (arr.length <= 5) {
    return arr;
  }

  // For 2D arrays (like cell values), show row count
  if (is2DArray(arr)) {
    const values = arr as unknown[][];
    const totalRows = values.length;
    const totalCells = values.reduce((sum, row) => sum + row.length, 0);

    if (totalCells > MAX_INLINE_ITEMS) {
      // Return summary with first few rows as preview
      const previewRows = Math.min(3, totalRows);
      return {
        _truncated: true,
        totalRows,
        totalCells,
        preview: values.slice(0, previewRows),
        message: `${totalRows} rows, ${totalCells} cells (showing first ${previewRows} rows)`,
      };
    }
    return arr;
  }

  // For 1D arrays, truncate and add count
  if (arr.length > MAX_INLINE_ITEMS) {
    return {
      _truncated: true,
      totalItems: arr.length,
      preview: arr.slice(0, 5),
      message: `${arr.length} items (showing first 5)`,
    };
  }

  return arr;
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
