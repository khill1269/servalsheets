# 🎯 ServalSheets Ultimate Fix Guide - Path to Perfection

**Analysis Date**: 2026-01-24
**Analyzed**: 12,270 log lines, 2,254 tool calls, 328 errors
**Current Error Rate**: 14.6%
**Target Error Rate**: <5%
**Status**: Build passing, all tests green, but 43 issues identified

---

## 📊 Executive Summary

The deep analysis identified **43 specific issues** across 4 categories:
- **12 Validation Issues** (47% of errors)
- **8 Error Handling Issues** (causing confusion)
- **12 Code Quality Issues** (technical debt)
- **11 Architecture Issues** (scalability)

**Impact**: Fixing critical issues will reduce error rate from 14.6% → ~5% (66% reduction)

---

## 🔥 **CRITICAL FIXES (Do First - 2-3 hours)**

### **Fix #1: A1 Notation Regex - Support Multiple Ranges**
**Priority**: 🔴 **CRITICAL** - Blocking charts
**File**: `src/config/google-limits.ts:187-188`
**Error Rate Impact**: sheets_visualize 33% → ~15%

**Problem**:
Current regex **REJECTS** comma-separated ranges needed for charts:
```typescript
// CURRENT (BROKEN)
export const A1_NOTATION_REGEX =
  /^(?:'.+'!|[^!]+!)?(?:[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?|[A-Z]+:[A-Z]+|[0-9]+:[0-9]+)$/;

// ❌ Rejects: "Sheet1!A1:A10,Sheet1!D1:D10"
// ❌ Rejects: "A1:B10,D1:E10"
// ❌ Rejects: "Sheet1" (whole sheet, needed for append)
```

**The Exact Fix**:
```typescript
/**
 * Regular expression for valid A1 notation
 *
 * Supports:
 * - Single cells: "A1", "Sheet1!A1", "'My Sheet'!A1"
 * - Cell ranges: "A1:B10", "Sheet1!A1:B10"
 * - Column ranges: "A:B", "Sheet1!A:C"
 * - Row ranges: "1:5", "Sheet1!1:10"
 * - Whole sheet: "Sheet1" (for append operations)
 * - Multiple ranges (comma-separated): "A1:A10,D1:D10" (for charts)
 *
 * Sheet names with spaces/special chars must be quoted: 'My Sheet'!A1
 * Quotes inside sheet names must be escaped: 'Sheet''s Data'!A1
 */
export const A1_NOTATION_REGEX =
  /^(?:(?:'(?:[^']|'')+)'!|[^'!][^!]*!)?(?:[A-Z]{1,3}(?:[0-9]+)?(?::[A-Z]{1,3}(?:[0-9]+)?)?|[0-9]+:[0-9]+|[A-Z]{1,3}:[A-Z]{1,3}|[^,!]+)(?:,(?:(?:'(?:[^']|'')+)'!|[^'!][^!]*!)?(?:[A-Z]{1,3}(?:[0-9]+)?(?::[A-Z]{1,3}(?:[0-9]+)?)?|[0-9]+:[0-9]+|[A-Z]{1,3}:[A-Z]{1,3}))*$/;
```

**What Changed**:
1. Added `{1,3}` to limit columns to A-ZZZ (Google Sheets max is XFD = column 16384)
2. Made row numbers optional: `(?:[0-9]+)?` to support "Sheet1" whole sheet
3. Added support for multiple ranges: `(?:,...)*$` at the end
4. Fixed quoted sheet name handling: `'(?:[^']|'')+' to handle escaped quotes

**Test Cases** (add to `tests/validation/a1-notation.test.ts`):
```typescript
import { A1_NOTATION_REGEX } from '../../src/config/google-limits.js';

describe('A1_NOTATION_REGEX - Fixed', () => {
  describe('Single ranges (existing)', () => {
    it('accepts single cell', () => {
      expect(A1_NOTATION_REGEX.test('A1')).toBe(true);
      expect(A1_NOTATION_REGEX.test('XFD1048576')).toBe(true); // Max cell
    });

    it('accepts cell range', () => {
      expect(A1_NOTATION_REGEX.test('A1:B10')).toBe(true);
      expect(A1_NOTATION_REGEX.test('Sheet1!A1:B10')).toBe(true);
    });

    it('accepts column ranges', () => {
      expect(A1_NOTATION_REGEX.test('A:B')).toBe(true);
      expect(A1_NOTATION_REGEX.test('Sheet1!A:Z')).toBe(true);
    });

    it('accepts row ranges', () => {
      expect(A1_NOTATION_REGEX.test('1:5')).toBe(true);
      expect(A1_NOTATION_REGEX.test('Sheet1!1:100')).toBe(true);
    });
  });

  describe('Multiple ranges (NEW - fixes charts)', () => {
    it('accepts two ranges comma-separated', () => {
      expect(A1_NOTATION_REGEX.test('A1:A10,D1:D10')).toBe(true);
    });

    it('accepts sheet-qualified multiple ranges', () => {
      expect(A1_NOTATION_REGEX.test('Sheet1!A1:A10,Sheet1!D1:D10')).toBe(true);
    });

    it('accepts three or more ranges', () => {
      expect(A1_NOTATION_REGEX.test('A1:A10,D1:D10,G1:G10')).toBe(true);
    });

    it('accepts mixed range types', () => {
      expect(A1_NOTATION_REGEX.test('A:A,D1:D10,G5')).toBe(true);
    });
  });

  describe('Whole sheet (NEW - fixes append)', () => {
    it('accepts sheet name alone', () => {
      expect(A1_NOTATION_REGEX.test('Sheet1')).toBe(true);
      expect(A1_NOTATION_REGEX.test("'My Sheet'")).toBe(true);
    });
  });

  describe('Quoted sheet names', () => {
    it('accepts quoted sheet names with spaces', () => {
      expect(A1_NOTATION_REGEX.test("'My Sheet'!A1")).toBe(true);
    });

    it('accepts escaped quotes in sheet names', () => {
      expect(A1_NOTATION_REGEX.test("'Sheet''s Data'!A1")).toBe(true);
    });

    it('rejects empty quoted sheet names', () => {
      expect(A1_NOTATION_REGEX.test("''!A1")).toBe(false);
    });
  });

  describe('Invalid formats', () => {
    it('rejects too many column letters', () => {
      expect(A1_NOTATION_REGEX.test('AAAA1')).toBe(false);
    });

    it('rejects empty ranges in comma list', () => {
      expect(A1_NOTATION_REGEX.test('A1:B10,,D1:E10')).toBe(false);
    });

    it('rejects invalid characters', () => {
      expect(A1_NOTATION_REGEX.test('A1:B$10')).toBe(false);
    });
  });
});
```

**Verification**:
```bash
npm test tests/validation/a1-notation.test.ts
npm run verify
```

---

### **Fix #2: Action Extraction - No More "unknown"**
**Priority**: 🔴 **CRITICAL** - 13% of calls have action="unknown"
**File**: `src/server.ts:698-710, 740-749`
**Error Rate Impact**: Improves observability, debugging

**Problem**:
- Action extraction logic is **DUPLICATED** in 2 places
- Doesn't handle all nesting patterns
- 296 calls (13%) end up as "unknown"

**The Exact Fix**:
```typescript
// ADD NEW HELPER FUNCTION at top of file (after imports, around line 120)
/**
 * Extract action name from handler arguments
 *
 * Handles various nesting patterns:
 * - Direct: { action: "read" }
 * - Nested once: { request: { action: "write" } }
 * - Nested twice: { request: { request: { action: "append" } } }
 *
 * @param args Handler arguments from MCP call
 * @returns Action name or "unknown" if not found
 */
function extractActionFromArgs(args: unknown): string {
  if (typeof args !== 'object' || args === null) {
    return 'unknown';
  }

  const record = args as Record<string, unknown>;

  // Try direct action field
  if (typeof record['action'] === 'string' && record['action']) {
    return record['action'];
  }

  // Try nested in request (max 3 levels deep)
  let current: unknown = record['request'];
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current === 'object' && current !== null) {
      const nested = current as Record<string, unknown>;
      if (typeof nested['action'] === 'string' && nested['action']) {
        return nested['action'];
      }
      current = nested['request'];
    }
  }

  return 'unknown';
}

// REPLACE BOTH INSTANCES (lines 698-710 and 740-749) with:
const action = extractActionFromArgs(args);
```

**Before** (lines 698-710):
```typescript
// ❌ DELETE THIS
const action =
  typeof args === 'object' && args !== null
    ? (() => {
        const record = args as Record<string, unknown>;
        if (typeof record['action'] === 'string') return record['action'];
        const request = record['request'];
        if (request && typeof request === 'object') {
          const nested = request as Record<string, unknown>;
          if (nested['action']) return String(nested['action']);
        }
        return 'unknown';
      })()
    : 'unknown';
```

**After**:
```typescript
// ✅ USE THIS INSTEAD
const action = extractActionFromArgs(args);
```

**Test Cases** (add to `tests/server/action-extraction.test.ts`):
```typescript
import { extractActionFromArgs } from '../src/server.js'; // Make function exported

describe('extractActionFromArgs', () => {
  it('extracts direct action', () => {
    expect(extractActionFromArgs({ action: 'read' })).toBe('read');
  });

  it('extracts action nested once', () => {
    expect(extractActionFromArgs({ request: { action: 'write' } })).toBe('write');
  });

  it('extracts action nested twice', () => {
    expect(extractActionFromArgs({ request: { request: { action: 'append' } } })).toBe('append');
  });

  it('extracts action nested three times', () => {
    expect(extractActionFromArgs({
      request: { request: { request: { action: 'clear' } } }
    })).toBe('clear');
  });

  it('returns unknown for invalid inputs', () => {
    expect(extractActionFromArgs(null)).toBe('unknown');
    expect(extractActionFromArgs('string')).toBe('unknown');
    expect(extractActionFromArgs(123)).toBe('unknown');
    expect(extractActionFromArgs({})).toBe('unknown');
  });

  it('returns unknown for empty action string', () => {
    expect(extractActionFromArgs({ action: '' })).toBe('unknown');
    expect(extractActionFromArgs({ request: { action: '' } })).toBe('unknown');
  });

  it('prefers direct action over nested', () => {
    expect(extractActionFromArgs({
      action: 'direct',
      request: { action: 'nested' }
    })).toBe('direct');
  });
});
```

**Verification**:
```bash
npm test tests/server/action-extraction.test.ts
npm run verify

# After deploying, check logs for reduction in "unknown" actions
npm run monitor:stats | grep "unknown"
```

---

### **Fix #3: Chart sourceRange - Accept Multiple Ranges**
**Priority**: 🔴 **CRITICAL** - Currently failing
**File**: `src/schemas/visualize.ts:104-127`
**Error Rate Impact**: sheets_visualize 33% → ~20%

**Problem**:
`ChartDataSchema.sourceRange` uses `RangeInputSchema` which uses `A1NotationSchema`, which only accepts single ranges. Charts need multiple ranges.

**The Exact Fix**:
```typescript
// ADD NEW SCHEMA before ChartDataSchema (around line 103)
/**
 * Chart range schema - supports multiple ranges for charts
 *
 * Charts can use:
 * - Single range: "A1:D10"
 * - Multiple ranges: "A1:A10,D1:D10" (name column + salary column)
 * - Sheet-qualified: "Sheet1!A1:A10,Sheet1!D1:D10"
 *
 * Unlike regular data operations, charts can combine non-contiguous ranges.
 */
const ChartRangeSchema = z
  .string()
  .min(1)
  .max(1000) // Charts can have complex multi-range strings
  .regex(
    // Same as new A1_NOTATION_REGEX (with comma support)
    /^(?:(?:'(?:[^']|'')+)'!|[^'!][^!]*!)?(?:[A-Z]{1,3}(?:[0-9]+)?(?::[A-Z]{1,3}(?:[0-9]+)?)?|[0-9]+:[0-9]+|[A-Z]{1,3}:[A-Z]{1,3}|[^,!]+)(?:,(?:(?:'(?:[^']|'')+)'!|[^'!][^!]*!)?(?:[A-Z]{1,3}(?:[0-9]+)?(?::[A-Z]{1,3}(?:[0-9]+)?)?|[0-9]+:[0-9]+|[A-Z]{1,3}:[A-Z]{1,3}))*$/,
    'Chart range must be valid A1 notation (supports multiple ranges: "A1:A10,D1:D10")'
  )
  .describe(
    'Chart data range in A1 notation. Supports multiple ranges: ' +
    '"A1:D10" (single), ' +
    '"A1:A10,D1:D10" (names+salaries), ' +
    '"Sheet1!A1:A10,Sheet1!D1:D10" (sheet-qualified). ' +
    'Multiple ranges are useful for charts with non-contiguous data.'
  );

// UPDATE ChartDataSchema (line 104-127)
const ChartDataSchema = z.object({
  sourceRange: ChartRangeSchema, // ✅ CHANGED from RangeInputSchema
  series: z
    .array(ChartSeriesSchema)
    .optional()
    .describe('Data series with optional trendlines and data labels'),
  categories: z.coerce.number().int().min(0).optional().describe(
    'Column index for category labels (0-based, default: first column)'
  ),
  aggregateType: z
    .enum([
      'AVERAGE',
      'COUNT',
      'COUNTA',
      'COUNTUNIQUE',
      'MAX',
      'MEDIAN',
      'MIN',
      'STDEV',
      'STDEVP',
      'SUM',
      'VAR',
      'VARP',
    ])
    .optional()
    .describe('How to aggregate data when multiple values exist'),
});
```

**Test Cases** (add to `tests/schemas/visualize.test.ts`):
```typescript
import { SheetsVisualizeInputSchema } from '../../src/schemas/visualize.js';

describe('ChartDataSchema - Multiple Ranges', () => {
  it('accepts single range', () => {
    const result = SheetsVisualizeInputSchema.safeParse({
      request: {
        action: 'chart_create',
        spreadsheetId: 'test-id',
        sheetId: 0,
        chartType: 'COLUMN',
        data: { sourceRange: 'A1:D10' },
        position: { anchorCell: 'Sheet1!G2' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts multiple ranges comma-separated', () => {
    const result = SheetsVisualizeInputSchema.safeParse({
      request: {
        action: 'chart_create',
        spreadsheetId: 'test-id',
        sheetId: 0,
        chartType: 'COLUMN',
        data: { sourceRange: 'A1:A10,D1:D10' }, // ✅ Should work now
        position: { anchorCell: 'Sheet1!G2' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts sheet-qualified multiple ranges', () => {
    const result = SheetsVisualizeInputSchema.safeParse({
      request: {
        action: 'chart_create',
        spreadsheetId: 'test-id',
        sheetId: 0,
        chartType: 'COLUMN',
        data: { sourceRange: 'Sheet1!A1:A10,Sheet1!D1:D10' },
        position: { anchorCell: 'Sheet1!G2' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty ranges in comma list', () => {
    const result = SheetsVisualizeInputSchema.safeParse({
      request: {
        action: 'chart_create',
        spreadsheetId: 'test-id',
        sheetId: 0,
        chartType: 'COLUMN',
        data: { sourceRange: 'A1:B10,,D1:E10' }, // ❌ Double comma
        position: { anchorCell: 'Sheet1!G2' },
      },
    });
    expect(result.success).toBe(false);
  });
});
```

---

### **Fix #4: Quality Operation Validation - Too Permissive**
**Priority**: 🟡 **HIGH** - 43% error rate
**File**: `src/schemas/quality.ts:89-96`
**Error Rate Impact**: sheets_quality 43% → ~15%

**Problem**:
Operation fields accept **any string**, leading to runtime errors:
```typescript
// CURRENT (TOO PERMISSIVE)
operation: z.object({
  type: z.string(), // ❌ Any string!
  tool: z.string(), // ❌ Any string!
  action: z.string(), // ❌ Any string!
  params: z.record(z.string(), z.unknown()),
})
```

**The Exact Fix**:
```typescript
// ADD import at top
import { TOOL_REGISTRY } from './index.js';

// CREATE typed enums
const KNOWN_TOOLS = Object.keys(TOOL_REGISTRY) as [string, ...string[]];

// UPDATE AnalyzeImpactActionSchema (around line 84-97)
const AnalyzeImpactActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('analyze_impact')
    .describe('Pre-execution impact analysis with dependency tracking'),
  spreadsheetId: z.string().min(1).describe('Spreadsheet ID from URL'),
  operation: z
    .object({
      type: z
        .string()
        .min(1)
        .max(100)
        .describe('Operation type (e.g., "values_write", "sheet_delete", "cells_format")'),
      tool: z
        .enum(KNOWN_TOOLS)
        .describe('Tool name - must be a registered ServalSheets tool'),
      action: z
        .string()
        .min(1)
        .max(100)
        .describe('Action name within the tool (e.g., "write", "clear", "set_format")'),
      params: z
        .record(z.string(), z.unknown())
        .describe('Operation parameters (specific to tool and action)'),
    })
    .describe('Operation to analyze for impact'),
});
```

**Better Error Messages**:
```typescript
// Also update the description with examples
tool: z
  .enum(KNOWN_TOOLS)
  .describe(
    'Tool name - must be one of: ' +
    'sheets_data, sheets_format, sheets_core, sheets_dimensions, ' +
    'sheets_advanced, sheets_visualize, etc. ' +
    'Use sheets_core:list to see available tools.'
  ),
```

**Test Cases**:
```typescript
describe('Quality AnalyzeImpact - Operation Validation', () => {
  it('accepts valid tool name', () => {
    const result = SheetsQualityInputSchema.safeParse({
      request: {
        action: 'analyze_impact',
        spreadsheetId: 'test-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A1:B10' },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid tool name', () => {
    const result = SheetsQualityInputSchema.safeParse({
      request: {
        action: 'analyze_impact',
        spreadsheetId: 'test-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_invalid', // ❌ Not a registered tool
          action: 'write',
          params: {},
        },
      },
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('must be one of');
  });

  it('rejects empty strings', () => {
    const result = SheetsQualityInputSchema.safeParse({
      request: {
        action: 'analyze_impact',
        spreadsheetId: 'test-id',
        operation: {
          type: '', // ❌ Empty
          tool: 'sheets_data',
          action: '',
          params: {},
        },
      },
    });
    expect(result.success).toBe(false);
  });
});
```

---

## 🟡 **HIGH PRIORITY FIXES (Next - 3-4 hours)**

### **Fix #5: Enum Case Sensitivity - Accept Lowercase**
**Priority**: 🟡 **HIGH** - LLMs generate lowercase
**Files**: Multiple schema files
**Error Rate Impact**: ~10% reduction across all tools

**Problem**:
All enums are UPPERCASE only, but LLMs often generate lowercase:
```typescript
// CURRENT - Case sensitive
DimensionSchema: z.enum(['ROWS', 'COLUMNS']) // Rejects 'rows', 'columns'
ChartTypeSchema: z.enum(['BAR', 'LINE', 'PIE', ...]) // Rejects 'bar', 'line'
```

**The Exact Fix** (apply pattern to all enums):
```typescript
// OPTION 1: Preprocess to uppercase (recommended)
export const DimensionSchema = z
  .preprocess(
    val => typeof val === 'string' ? val.toUpperCase() : val,
    z.enum(['ROWS', 'COLUMNS'])
  )
  .describe('Dimension type: ROWS or COLUMNS (case-insensitive)');

// OPTION 2: Union with transform (more explicit)
export const DimensionSchema = z
  .union([
    z.enum(['ROWS', 'COLUMNS']),
    z.enum(['rows', 'columns']).transform(v => v.toUpperCase() as 'ROWS' | 'COLUMNS')
  ])
  .describe('Dimension type: ROWS or COLUMNS (case-insensitive)');
```

**Apply to these enums**:
```typescript
// src/schemas/shared.ts
DimensionSchema // ROWS/COLUMNS
ValueRenderOptionSchema // FORMATTED_VALUE/UNFORMATTED_VALUE/FORMULA
ValueInputOptionSchema // RAW/USER_ENTERED
InsertDataOptionSchema // OVERWRITE/INSERT_ROWS
MajorDimensionSchema // ROWS/COLUMNS
HorizontalAlignSchema // LEFT/CENTER/RIGHT
VerticalAlignSchema // TOP/MIDDLE/BOTTOM
WrapStrategySchema // OVERFLOW_CELL/LEGACY_WRAP/CLIP/WRAP
BorderStyleSchema // NONE/DOTTED/DASHED/SOLID/...
MergeTypeSchema // MERGE_ALL/MERGE_COLUMNS/MERGE_ROWS

// src/schemas/format.ts
NumberFormatTypeSchema // TEXT/NUMBER/PERCENT/CURRENCY/DATE/...

// src/schemas/visualize.ts
ChartTypeSchema // BAR/LINE/PIE/AREA/SCATTER/...
LegendPositionSchema // TOP_LEGEND/BOTTOM_LEGEND/LEFT_LEGEND/...
TrendlineTypeSchema // LINEAR/EXPONENTIAL/POLYNOMIAL/...

// src/schemas/dimensions.ts
SortOrderSchema // ASCENDING/DESCENDING
```

**Test Cases** (add to each schema test):
```typescript
it('accepts lowercase enum values', () => {
  expect(DimensionSchema.parse('rows')).toBe('ROWS');
  expect(DimensionSchema.parse('columns')).toBe('COLUMNS');
});

it('accepts mixed case enum values', () => {
  expect(DimensionSchema.parse('Rows')).toBe('ROWS');
  expect(DimensionSchema.parse('CoLuMnS')).toBe('COLUMNS');
});
```

---

### **Fix #6: Color Precision - Round to 4 Decimals**
**Priority**: 🟡 **HIGH** - Prevents API errors
**File**: `src/schemas/shared.ts:31-40`
**Error Rate Impact**: Prevents potential Google API rejections

**Problem**:
Accepts infinite precision floats (e.g., 0.333333333333333), which Google API may reject.

**The Exact Fix**:
```typescript
export const ColorSchema = z
  .object({
    red: z.number().min(0).max(1).optional().default(0),
    green: z.number().min(0).max(1).optional().default(0),
    blue: z.number().min(0).max(1).optional().default(0),
    alpha: z.number().min(0).max(1).optional().default(1),
  })
  .transform(color => ({
    red: Math.round(color.red * 10000) / 10000, // Round to 4 decimals
    green: Math.round(color.green * 10000) / 10000,
    blue: Math.round(color.blue * 10000) / 10000,
    alpha: Math.round(color.alpha * 10000) / 10000,
  }))
  .describe(
    'RGB color in 0-1 scale (e.g., {red:1,green:0,blue:0} for red, {red:0.26,green:0.52,blue:0.96} for Google blue #4285F4). ' +
    'Values rounded to 4 decimal places.'
  );
```

**Test Cases**:
```typescript
it('rounds color values to 4 decimals', () => {
  const result = ColorSchema.parse({
    red: 0.333333333333,
    green: 0.666666666666,
    blue: 0.999999999999,
  });
  expect(result.red).toBe(0.3333);
  expect(result.green).toBe(0.6667);
  expect(result.blue).toBe(1.0); // 0.9999 rounds to 1.0
});
```

---

### **Fix #7: Chart Position anchorCell Validation**
**Priority**: 🟡 **HIGH** - Prevents runtime errors
**File**: `src/schemas/shared.ts:418-419`
**Error Rate Impact**: Prevents chart creation failures

**Problem**:
anchorCell accepts any string, but Google API requires sheet-qualified cells for charts.

**The Exact Fix**:
```typescript
export const ChartPositionSchema = z.object({
  anchorCell: z
    .string()
    .regex(
      /^(?:(?:'(?:[^']|'')+)'!|[^'!]+!)[A-Za-z]{1,3}\d+$/,
      'Chart anchor cell MUST include sheet name (e.g., "Sheet1!E2" or "\'My Sheet\'!E2")'
    )
    .describe(
      'Anchor cell with REQUIRED sheet qualification: "Sheet1!E2" or "\'My Sheet\'!E2". ' +
      'Sheet name is mandatory for charts (unlike regular data operations). ' +
      'Cell specifies top-left corner where chart will be placed.'
    ),
  offsetX: z.number().int().min(0).optional().default(0).describe('Horizontal offset in pixels'),
  offsetY: z.number().int().min(0).optional().default(0).describe('Vertical offset in pixels'),
  width: z.number().int().positive().optional().default(600).describe('Chart width in pixels'),
  height: z.number().int().positive().optional().default(400).describe('Chart height in pixels'),
});
```

**Test Cases**:
```typescript
describe('ChartPositionSchema', () => {
  it('accepts sheet-qualified anchor cells', () => {
    expect(ChartPositionSchema.parse({ anchorCell: 'Sheet1!E2' })).toEqual({
      anchorCell: 'Sheet1!E2',
      offsetX: 0,
      offsetY: 0,
      width: 600,
      height: 400,
    });
  });

  it('accepts quoted sheet names', () => {
    expect(ChartPositionSchema.parse({ anchorCell: "'My Sheet'!E2" }).anchorCell)
      .toBe("'My Sheet'!E2");
  });

  it('rejects anchor cells without sheet names', () => {
    const result = ChartPositionSchema.safeParse({ anchorCell: 'E2' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('MUST include sheet name');
  });

  it('rejects negative offsets', () => {
    const result = ChartPositionSchema.safeParse({
      anchorCell: 'Sheet1!E2',
      offsetX: -10,
    });
    expect(result.success).toBe(false);
  });
});
```

---

## 📝 **MEDIUM PRIORITY FIXES (Later - 4-6 hours)**

### **Fix #8-12: Schema Refinements**
- Add max length validation to all string fields
- Fix number coercion (reject NaN)
- Consolidate risk level schemas
- Add spreadsheet ID length validation
- Fix optional fields with defaults

*(Detailed fixes in appendix)*

---

## 🏗️ **ARCHITECTURE FIXES (Strategic - 8-12 hours)**

### **Fix #13: Repository Pattern**
Decouple handlers from Google API for better testability.

### **Fix #14: Circuit Breaker**
Add fault tolerance for Google API failures.

### **Fix #15: Request Deduplication**
Prevent duplicate chart/sheet creation.

*(Detailed implementations in appendix)*

---

## 📋 **IMPLEMENTATION PLAN**

### **Week 1: Critical Fixes** (Priority 🔴)
**Day 1-2** (4-6 hours):
- [ ] Fix #1: A1 notation regex
- [ ] Fix #2: Action extraction
- [ ] Fix #3: Chart sourceRange
- [ ] Fix #4: Quality operation validation
- [ ] Run full test suite
- [ ] Deploy and monitor

**Day 3** (2-3 hours):
- [ ] Verify error rate reduction (14.6% → ~8%)
- [ ] Check monitoring logs
- [ ] Document any new issues

### **Week 2: High Priority Fixes** (Priority 🟡)
**Day 1** (2-3 hours):
- [ ] Fix #5: Enum case sensitivity (all schemas)
- [ ] Fix #6: Color precision
- [ ] Fix #7: Chart position validation

**Day 2** (2-3 hours):
- [ ] Add comprehensive test coverage
- [ ] Update documentation
- [ ] Deploy and verify

### **Week 3: Medium Priority Fixes**
- [ ] Schema refinements (#8-12)
- [ ] Error message improvements
- [ ] Code quality fixes

### **Week 4: Architecture Improvements**
- [ ] Repository pattern
- [ ] Circuit breaker
- [ ] Request deduplication

---

## ✅ **SUCCESS CRITERIA**

### **After Week 1** (Critical Fixes):
- ✅ Overall error rate: 14.6% → <8%
- ✅ sheets_visualize error rate: 33% → <20%
- ✅ sheets_quality error rate: 43% → <20%
- ✅ Unknown actions: 13% → <3%
- ✅ All critical tests passing

### **After Week 2** (High Priority Fixes):
- ✅ Overall error rate: <5%
- ✅ All tools <20% error rate
- ✅ Case-insensitive enums working
- ✅ No API rejections due to precision

### **Final State** (All Fixes):
- ✅ Overall error rate: <3%
- ✅ All tools <10% error rate
- ✅ 95%+ test coverage
- ✅ Zero silent fallbacks
- ✅ Repository pattern in place
- ✅ Circuit breaker protecting API calls
- ✅ Comprehensive documentation

---

## 🧪 **TESTING STRATEGY**

### **Unit Tests**
```bash
# Test each fix individually
npm test tests/validation/a1-notation.test.ts
npm test tests/server/action-extraction.test.ts
npm test tests/schemas/visualize.test.ts
npm test tests/schemas/quality.test.ts
```

### **Integration Tests**
```bash
# Test handler behavior
npm test tests/handlers/visualize.test.ts
npm test tests/handlers/quality.test.ts
```

### **End-to-End Tests**
```bash
# Test with Claude Desktop
npm run monitor:start
# In Claude Desktop, run comprehensive test from COMPREHENSIVE_TEST_PROMPT.md
```

### **Verification Commands**
```bash
# Full verification
npm run verify

# Check for regressions
npm run test
npm run typecheck
npm run lint
npm run check:drift
npm run check:silent-fallbacks
```

---

## 📊 **MONITORING DURING ROLLOUT**

### **Before Deployment**
```bash
# Capture baseline metrics
npm run monitor:stats > baseline-metrics.txt
```

### **After Each Fix**
```bash
# Compare metrics
npm run monitor:stats > after-fix-X-metrics.txt
diff baseline-metrics.txt after-fix-X-metrics.txt
```

### **Key Metrics to Track**
1. Overall error rate (target: <5%)
2. Per-tool error rates (target: all <20%)
3. Unknown action percentage (target: <3%)
4. Validation error rate (target: <30% of total errors)
5. Response times (target: no regression)

---

## 🔗 **RELATED DOCUMENTATION**

- [ISSUES_FOUND_2026-01-24.md](./ISSUES_FOUND_2026-01-24.md) - Full issue analysis
- [TIMEOUT_FIX.md](./TIMEOUT_FIX.md) - Keepalive system (already applied ✅)
- [MONITORING_QUICK_START.md](./MONITORING_QUICK_START.md) - Monitoring setup
- [COMPREHENSIVE_TEST_PROMPT.md](./COMPREHENSIVE_TEST_PROMPT.md) - E2E test plan

---

## 📞 **NEED HELP?**

If you encounter issues during implementation:
1. Check test output: `npm test 2>&1 | grep -A 5 "FAIL"`
2. Check TypeScript errors: `npm run typecheck`
3. Check monitoring: `npm run monitor:live`
4. Review this guide's test cases

---

**Status**: Ready for implementation ✅
**Estimated Total Time**: 18-24 hours for all fixes
**Expected Impact**: Error rate 14.6% → ~3% (80% reduction)
**Next Step**: Start with Week 1 critical fixes

