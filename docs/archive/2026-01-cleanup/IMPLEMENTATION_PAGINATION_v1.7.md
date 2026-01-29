# Implementation Guide: Large Dataset Pagination (v1.7.0)
**Priority:** P0 - Critical for enterprise use cases
**Effort:** 5 days
**Impact:** Unlock 100k+ row spreadsheet support

---

## Problem Statement

**Current Limitation:**
```typescript
// This FAILS for large datasets
await client.call('sheets_data', {
  action: 'read',
  spreadsheetId: 'abc123',
  range: 'A1:Z100000', // 100k rows × 26 columns = 2.6M cells
});
```

**Google Sheets API Constraints:**
- Max 10,000 cells per request
- 2MB payload recommended
- 180 second timeout

**Solution:** Cursor-based pagination with automatic chunking

---

## Implementation Steps

### Step 1: Create Pagination Helpers (Day 1-2)

**File:** `src/utils/pagination-helpers.ts`

```typescript
/**
 * Pagination utilities for Google Sheets large datasets
 * Based on Google API constraints (10k cell limit) and MCP best practices
 */

import { createHash } from 'crypto';

export interface PaginationConfig {
  /** Rows per page (default: 1000, max based on columns) */
  pageSize: number;
  /** Current page cursor (opaque string) */
  cursor?: string;
}

export interface PaginationMetadata {
  /** Total rows in the range */
  totalRows: number;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total pages */
  totalPages: number;
  /** Rows in current page */
  pageRows: number;
  /** Next page cursor (undefined if last page) */
  nextCursor?: string;
  /** Previous page cursor (undefined if first page) */
  prevCursor?: string;
  /** Has more pages */
  hasMore: boolean;
}

export interface RangeMetadata {
  /** Start column (e.g., "A") */
  startCol: string;
  /** End column (e.g., "Z") */
  endCol: string;
  /** Start row number */
  startRow: number;
  /** End row number */
  endRow: number;
  /** Total rows */
  totalRows: number;
  /** Total columns */
  totalColumns: number;
}

/**
 * Parse A1 notation range into components
 * @example parseA1Range("A1:Z100000") → { startCol: "A", endCol: "Z", startRow: 1, endRow: 100000, ... }
 */
export function parseA1Range(range: string): RangeMetadata {
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid A1 notation: ${range}`);
  }

  const startCol = match[1];
  const startRow = parseInt(match[2], 10);
  const endCol = match[3];
  const endRow = parseInt(match[4], 10);

  const totalRows = endRow - startRow + 1;
  const totalColumns = columnToIndex(endCol) - columnToIndex(startCol) + 1;

  return {
    startCol,
    endCol,
    startRow,
    endRow,
    totalRows,
    totalColumns,
  };
}

/**
 * Convert column letter to index (A=1, B=2, ..., Z=26, AA=27, ...)
 */
function columnToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index;
}

/**
 * Convert index to column letter (1=A, 2=B, ..., 26=Z, 27=AA, ...)
 */
function indexToColumn(index: number): string {
  let col = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    index = Math.floor((index - 1) / 26);
  }
  return col;
}

/**
 * Determine if range requires pagination based on cell count
 */
export function requiresPagination(range: string): boolean {
  try {
    const metadata = parseA1Range(range);
    const totalCells = metadata.totalRows * metadata.totalColumns;

    // Google Sheets API limit: 10,000 cells per request
    return totalCells > 10_000;
  } catch {
    // If range is invalid or not in A1:B2 format, assume no pagination
    return false;
  }
}

/**
 * Calculate safe page size based on column count
 * Ensures pageSize × columns ≤ 10,000 cells
 */
export function calculateSafePageSize(
  totalColumns: number,
  requestedPageSize?: number
): number {
  const maxPageSize = Math.floor(10_000 / totalColumns);
  const defaultPageSize = Math.min(1000, maxPageSize);

  if (!requestedPageSize) {
    return defaultPageSize;
  }

  // Ensure requested size doesn't exceed safe limit
  return Math.min(requestedPageSize, maxPageSize);
}

/**
 * Generate A1 range for specific page
 */
export function generatePageRange(
  metadata: RangeMetadata,
  page: number,
  pageSize: number
): string {
  const startRowForPage = metadata.startRow + (page - 1) * pageSize;
  const endRowForPage = Math.min(startRowForPage + pageSize - 1, metadata.endRow);

  return `${metadata.startCol}${startRowForPage}:${metadata.endCol}${endRowForPage}`;
}

/**
 * Encode pagination cursor (page number + checksum for security)
 */
export function encodeCursor(page: number, spreadsheetId: string): string {
  const payload = `${page}:${spreadsheetId}`;
  const checksum = createHash('sha256').update(payload).digest('hex').slice(0, 8);
  const cursor = `${page}.${checksum}`;
  return Buffer.from(cursor).toString('base64url');
}

/**
 * Decode pagination cursor and validate checksum
 */
export function decodeCursor(
  cursor: string,
  spreadsheetId: string
): { page: number } {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const [pageStr, checksum] = decoded.split('.');

    const page = parseInt(pageStr, 10);
    if (isNaN(page) || page < 1) {
      throw new Error('Invalid page number');
    }

    // Verify checksum
    const payload = `${page}:${spreadsheetId}`;
    const expectedChecksum = createHash('sha256')
      .update(payload)
      .digest('hex')
      .slice(0, 8);

    if (checksum !== expectedChecksum) {
      throw new Error('Cursor checksum mismatch');
    }

    return { page };
  } catch (error) {
    throw new Error(`Invalid pagination cursor: ${error.message}`);
  }
}

/**
 * Build pagination metadata for response
 */
export function buildPaginationMetadata(
  metadata: RangeMetadata,
  currentPage: number,
  pageSize: number,
  pageRows: number,
  spreadsheetId: string
): PaginationMetadata {
  const totalPages = Math.ceil(metadata.totalRows / pageSize);
  const hasMore = currentPage < totalPages;

  return {
    totalRows: metadata.totalRows,
    currentPage,
    totalPages,
    pageRows,
    nextCursor: hasMore ? encodeCursor(currentPage + 1, spreadsheetId) : undefined,
    prevCursor: currentPage > 1 ? encodeCursor(currentPage - 1, spreadsheetId) : undefined,
    hasMore,
  };
}
```

**Tests:** `tests/utils/pagination-helpers.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseA1Range,
  requiresPagination,
  calculateSafePageSize,
  generatePageRange,
  encodeCursor,
  decodeCursor,
  buildPaginationMetadata,
} from '../../src/utils/pagination-helpers.js';

describe('parseA1Range', () => {
  it('should parse simple range', () => {
    const result = parseA1Range('A1:Z1000');
    expect(result).toEqual({
      startCol: 'A',
      endCol: 'Z',
      startRow: 1,
      endRow: 1000,
      totalRows: 1000,
      totalColumns: 26,
    });
  });

  it('should parse range with offset start', () => {
    const result = parseA1Range('B5:D100');
    expect(result.totalRows).toBe(96); // 100 - 5 + 1
    expect(result.totalColumns).toBe(3); // D - B + 1
  });
});

describe('requiresPagination', () => {
  it('should return true for large ranges (>10k cells)', () => {
    expect(requiresPagination('A1:Z1000')).toBe(true); // 26k cells
    expect(requiresPagination('A1:C5000')).toBe(true); // 15k cells
  });

  it('should return false for small ranges (<10k cells)', () => {
    expect(requiresPagination('A1:Z100')).toBe(false); // 2.6k cells
    expect(requiresPagination('A1:A10000')).toBe(false); // 10k cells (exactly at limit)
  });
});

describe('calculateSafePageSize', () => {
  it('should enforce 10k cell limit', () => {
    expect(calculateSafePageSize(26)).toBe(384); // 384 × 26 = 9984 cells
    expect(calculateSafePageSize(100)).toBe(100); // 100 × 100 = 10k cells
  });

  it('should respect requested page size if safe', () => {
    expect(calculateSafePageSize(10, 500)).toBe(500); // 500 × 10 = 5k cells (safe)
    expect(calculateSafePageSize(10, 2000)).toBe(1000); // 2000 × 10 = 20k cells (unsafe, cap at 1000)
  });
});

describe('generatePageRange', () => {
  it('should generate correct page ranges', () => {
    const metadata = parseA1Range('A1:Z10000');
    expect(generatePageRange(metadata, 1, 1000)).toBe('A1:Z1000');
    expect(generatePageRange(metadata, 2, 1000)).toBe('A1001:Z2000');
    expect(generatePageRange(metadata, 10, 1000)).toBe('A9001:Z10000');
  });

  it('should not exceed end row', () => {
    const metadata = parseA1Range('A1:Z100');
    expect(generatePageRange(metadata, 1, 1000)).toBe('A1:Z100'); // Only 100 rows available
  });
});

describe('cursor encoding/decoding', () => {
  it('should encode and decode cursor', () => {
    const cursor = encodeCursor(5, 'test-sheet-id');
    expect(cursor).toBeTruthy();

    const decoded = decodeCursor(cursor, 'test-sheet-id');
    expect(decoded.page).toBe(5);
  });

  it('should reject cursor with wrong spreadsheet ID', () => {
    const cursor = encodeCursor(5, 'sheet-1');
    expect(() => decodeCursor(cursor, 'sheet-2')).toThrow('checksum mismatch');
  });

  it('should reject invalid cursor', () => {
    expect(() => decodeCursor('invalid', 'sheet-1')).toThrow('Invalid pagination cursor');
  });
});
```

---

### Step 2: Update Data Handler (Day 3)

**File:** `src/handlers/data.ts` (modify lines 400-450)

```typescript
import {
  requiresPagination,
  parseA1Range,
  calculateSafePageSize,
  generatePageRange,
  decodeCursor,
  buildPaginationMetadata,
} from '../utils/pagination-helpers.js';

// Inside SheetsDataHandler class:

/**
 * Handle read operation with automatic pagination for large datasets
 */
private async handleReadWithPagination(
  input: SheetsDataInput['request'] & { action: 'read' }
): Promise<DataResponse> {
  const range = input.range || 'A:ZZ';
  const spreadsheetId = input.spreadsheetId;

  // Check if pagination is needed
  if (!requiresPagination(range)) {
    // Small dataset - standard fetch
    return this.handleReadDirect(input);
  }

  // Large dataset - paginated fetch
  const metadata = parseA1Range(range);

  // Determine current page
  const currentPage = input.cursor
    ? decodeCursor(input.cursor, spreadsheetId).page
    : 1;

  // Calculate safe page size (respects 10k cell limit)
  const pageSize = calculateSafePageSize(
    metadata.totalColumns,
    input.pageSize
  );

  // Generate range for this page
  const pageRange = generatePageRange(metadata, currentPage, pageSize);

  this.context.logger?.info?.('Fetching paginated data', {
    spreadsheetId,
    originalRange: range,
    pageRange,
    page: currentPage,
    pageSize,
  });

  // Fetch page
  const response = await this.sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: pageRange,
    valueRenderOption: input.valueRenderOption,
    dateTimeRenderOption: input.dateTimeRenderOption,
    majorDimension: input.majorDimension,
  });

  const values = response.data.values || [];

  // Build pagination metadata
  const paginationMeta = buildPaginationMetadata(
    metadata,
    currentPage,
    pageSize,
    values.length,
    spreadsheetId
  );

  return {
    success: true,
    data: {
      values,
      range: pageRange,
      majorDimension: response.data.majorDimension,
    },
    pagination: paginationMeta,
  };
}

/**
 * Handle read operation without pagination (small datasets)
 */
private async handleReadDirect(
  input: SheetsDataInput['request'] & { action: 'read' }
): Promise<DataResponse> {
  const range = input.range || 'A:ZZ';

  // Record access pattern (existing code)
  this.recordAccessAndTriggerPrefetch(
    input.spreadsheetId,
    range,
    'read'
  );

  // Try cache (existing code)
  const cacheKey = `${input.spreadsheetId}:${range}`;
  const etagCache = getETagCache();
  const cachedData = etagCache.get(cacheKey);

  if (cachedData && !input.bypassCache) {
    return {
      success: true,
      data: cachedData,
    };
  }

  // Fetch from API
  const response = await this.sheetsApi.spreadsheets.values.get({
    spreadsheetId: input.spreadsheetId,
    range,
    valueRenderOption: input.valueRenderOption,
    dateTimeRenderOption: input.dateTimeRenderOption,
    majorDimension: input.majorDimension,
  });

  const data = {
    values: response.data.values || [],
    range: response.data.range,
    majorDimension: response.data.majorDimension,
  };

  // Cache result
  etagCache.set(cacheKey, data);

  return {
    success: true,
    data,
  };
}
```

---

### Step 3: Update Schema (Day 4)

**File:** `src/schemas/data.ts`

```typescript
// Add pagination fields to input
export const ReadRequestSchema = z.object({
  action: z.literal('read'),
  spreadsheetId: z.string().describe('ID of the spreadsheet'),
  range: z.string().optional().describe('A1 notation range (e.g., "A1:Z100000")'),
  valueRenderOption: z
    .enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'])
    .optional(),
  dateTimeRenderOption: z
    .enum(['SERIAL_NUMBER', 'FORMATTED_STRING'])
    .optional(),
  majorDimension: z.enum(['ROWS', 'COLUMNS']).optional(),

  // Pagination support
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .describe('Rows per page (default: auto-calculated, max: 10000)'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from previous response (opaque string)'),
  bypassCache: z.boolean().optional().describe('Skip cache for this request'),
});

// Add pagination metadata to response
export const DataResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    values: z.array(z.array(z.any())),
    range: z.string().optional(),
    majorDimension: z.enum(['ROWS', 'COLUMNS']).optional(),
  }),

  // Pagination metadata (only present for large datasets)
  pagination: z
    .object({
      totalRows: z.number().describe('Total rows in the full range'),
      currentPage: z.number().describe('Current page number (1-indexed)'),
      totalPages: z.number().describe('Total number of pages'),
      pageRows: z.number().describe('Rows in current page'),
      nextCursor: z.string().optional().describe('Cursor for next page'),
      prevCursor: z.string().optional().describe('Cursor for previous page'),
      hasMore: z.boolean().describe('Whether more pages are available'),
    })
    .optional()
    .describe('Pagination metadata (present for large datasets)'),
});
```

---

### Step 4: Testing (Day 5)

**File:** `tests/handlers/data-pagination.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SheetsDataHandler } from '../../src/handlers/data.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import { encodeCursor } from '../../src/utils/pagination-helpers.js';

describe('SheetsDataHandler - Pagination', () => {
  let handler: SheetsDataHandler;
  let mockContext: HandlerContext;
  let mockSheetsApi: any;

  beforeEach(() => {
    mockSheetsApi = {
      spreadsheets: {
        values: {
          get: vi.fn(),
        },
      },
    };

    mockContext = {
      logger: { info: vi.fn(), warn: vi.fn() },
      accessPatternTracker: null,
      prefetchPredictor: null,
      cachedSheetsApi: null,
    };

    handler = new SheetsDataHandler(mockContext, mockSheetsApi);
  });

  it('should paginate large dataset (100k rows)', async () => {
    // Mock API to return 1000 rows per page
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: Array.from({ length: 1000 }, (_, i) => [`Row ${i + 1}`]),
        range: 'A1:Z1000',
        majorDimension: 'ROWS',
      },
    });

    const result = await handler.handle({
      action: 'read',
      spreadsheetId: 'test-sheet',
      range: 'A1:Z100000', // 100k rows
    });

    // Should paginate automatically
    expect(result.response.success).toBe(true);
    expect(result.response.data.values).toHaveLength(1000);
    expect(result.response.pagination).toEqual({
      totalRows: 100000,
      currentPage: 1,
      totalPages: 100,
      pageRows: 1000,
      nextCursor: expect.any(String),
      prevCursor: undefined,
      hasMore: true,
    });

    // Verify API called with paginated range
    expect(mockSheetsApi.spreadsheets.values.get).toHaveBeenCalledWith(
      expect.objectContaining({
        range: 'A1:Z1000', // First page
      })
    );
  });

  it('should fetch page 2 using cursor', async () => {
    const cursor = encodeCursor(2, 'test-sheet');

    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: Array.from({ length: 1000 }, (_, i) => [`Row ${i + 1001}`]),
        range: 'A1001:Z2000',
      },
    });

    const result = await handler.handle({
      action: 'read',
      spreadsheetId: 'test-sheet',
      range: 'A1:Z100000',
      cursor,
    });

    expect(result.response.pagination.currentPage).toBe(2);
    expect(mockSheetsApi.spreadsheets.values.get).toHaveBeenCalledWith(
      expect.objectContaining({
        range: 'A1001:Z2000', // Second page
      })
    );
  });

  it('should not paginate small datasets', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: Array.from({ length: 100 }, (_, i) => [`Row ${i + 1}`]),
        range: 'A1:Z100',
      },
    });

    const result = await handler.handle({
      action: 'read',
      spreadsheetId: 'test-sheet',
      range: 'A1:Z100', // Only 100 rows
    });

    // Should NOT paginate
    expect(result.response.pagination).toBeUndefined();
    expect(result.response.data.values).toHaveLength(100);
  });

  it('should respect custom page size', async () => {
    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: {
        values: Array.from({ length: 500 }, (_, i) => [`Row ${i + 1}`]),
      },
    });

    await handler.handle({
      action: 'read',
      spreadsheetId: 'test-sheet',
      range: 'A1:Z100000',
      pageSize: 500, // Custom page size
    });

    expect(mockSheetsApi.spreadsheets.values.get).toHaveBeenCalledWith(
      expect.objectContaining({
        range: 'A1:Z500', // 500 rows per page
      })
    );
  });

  it('should enforce 10k cell limit', async () => {
    // 100 columns × 1000 rows = 100k cells → should fail
    // Handler should automatically reduce page size

    mockSheetsApi.spreadsheets.values.get.mockResolvedValue({
      data: { values: [] },
    });

    await handler.handle({
      action: 'read',
      spreadsheetId: 'test-sheet',
      range: 'A1:CV100000', // CV = 100 columns
      pageSize: 1000,
    });

    // Should have called with reduced page size (100 rows max)
    expect(mockSheetsApi.spreadsheets.values.get).toHaveBeenCalledWith(
      expect.objectContaining({
        range: 'A1:CV100', // Reduced to 100 rows (10k cells)
      })
    );
  });
});
```

---

## Usage Examples

### Example 1: Automatic Pagination (Claude Desktop)

```typescript
// User: "Analyze all sales data in Sheet1"

// First request (automatic pagination for large dataset)
const page1 = await sheets_data({
  action: 'read',
  spreadsheetId: 'abc123',
  range: 'Sheet1!A1:Z100000',
});

// Response:
{
  success: true,
  data: {
    values: [...1000 rows...],
  },
  pagination: {
    totalRows: 100000,
    currentPage: 1,
    totalPages: 100,
    pageRows: 1000,
    nextCursor: "eyJwYWdlIjoyLCJjaGVja3N1bSI6ImFiYzEyMzQ1In0=",
    hasMore: true
  }
}

// Fetch next page using cursor
const page2 = await sheets_data({
  action: 'read',
  spreadsheetId: 'abc123',
  range: 'Sheet1!A1:Z100000',
  cursor: page1.pagination.nextCursor,
});
```

### Example 2: Custom Page Size

```typescript
// Fetch 5000 rows at a time (if columns allow)
const result = await sheets_data({
  action: 'read',
  spreadsheetId: 'abc123',
  range: 'A1:C100000', // 3 columns → 5000 rows × 3 = 15k cells (too many)
  pageSize: 5000, // Will be reduced to 3333 rows automatically
});
```

---

## Performance Expectations

### Before (v1.6.0)
- ❌ Max rows: ~10k (API limit)
- ❌ Memory: Linear with dataset size (OOM on 100k rows)
- ❌ Latency: N/A (fails)

### After (v1.7.0)
- ✅ Max rows: 1M+ (paginated)
- ✅ Memory: Constant (~1000 rows buffered)
- ✅ Latency: ~500ms per page
- ✅ Overhead: <50ms pagination logic

---

## Migration Notes

### Breaking Changes
**NONE** - Fully backward compatible

### Opt-In Behavior
- Small datasets (<10k cells): No pagination (existing behavior)
- Large datasets (>10k cells): Automatic pagination (new behavior)
- Users can opt-in with `cursor` parameter

### Cache Interaction
- Cached data bypasses pagination (small datasets only)
- Large dataset pages are NOT cached (too much memory)
- Metadata can be cached separately

---

## Monitoring

### New Metrics to Add

```typescript
// src/observability/metrics.ts

export const paginatedRequestsTotal = new Counter({
  name: 'servalsheets_paginated_requests_total',
  help: 'Total paginated read requests',
  labelNames: ['page'],
});

export const paginationOverhead = new Histogram({
  name: 'servalsheets_pagination_overhead_seconds',
  help: 'Pagination logic overhead',
  buckets: [0.01, 0.025, 0.05, 0.1],
});
```

### Grafana Dashboard Panel

```json
{
  "title": "Paginated Requests",
  "targets": [{
    "expr": "rate(servalsheets_paginated_requests_total[5m])"
  }]
}
```

---

## Rollout Plan

### Week 1: Development + Testing
- Day 1-2: Implement pagination-helpers.ts + tests
- Day 3: Update data handler
- Day 4: Update schemas + integration tests
- Day 5: Manual testing with real 100k+ row sheet

### Week 2: Deployment + Monitoring
- Deploy to staging
- Load test with various dataset sizes
- Monitor pagination metrics
- Deploy to production with feature flag

---

## Success Criteria

- [ ] Unit tests pass (100% coverage)
- [ ] Integration tests pass
- [ ] Manual test: 100k row spreadsheet loads successfully
- [ ] Manual test: 1M row spreadsheet loads successfully (100 pages)
- [ ] Pagination overhead <50ms (measured)
- [ ] Memory usage constant (not linear)
- [ ] Backward compatibility maintained (small datasets work)

---

## References

- [Google Sheets API Limits](https://developers.google.com/workspace/sheets/api/limits)
- [MCP Pagination Best Practices](https://arxiv.org/html/2510.05968v1)
- [Cursor-Based Pagination Pattern](https://graphacademy.neo4j.com/courses/genai-mcp-build-custom-tools-python/2-database-features/9-pagination/)

---

**Next Step:** Begin implementation in feature branch `feature/large-dataset-pagination`
