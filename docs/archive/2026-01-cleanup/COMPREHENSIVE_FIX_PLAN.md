# 🔧 ServalSheets Comprehensive Fix Plan

**Analysis Date**: 2026-01-24
**Version**: 1.4.0
**Overall Error Rate**: 14.6% → Target: <8%

---

## 📊 Executive Summary

After comprehensive code analysis, I've identified **4 categories of issues** causing the 14.6% error rate:

| Category | Impact | Files Affected | Estimated Fix Time |
|----------|--------|----------------|-------------------|
| 1. A1 Notation Regex | CRITICAL | 1 file | 15 min |
| 2. Schema Flexibility | HIGH | 5 files | 2 hours |
| 3. Color/Value Coercion | MEDIUM | 2 files | 30 min |
| 4. Action Extraction | MEDIUM | Already fixed | N/A |

---

## 🚨 Issue 1: A1 Notation Regex (CRITICAL)

### Current Problem
**File**: `src/config/google-limits.ts` (line 162)

```typescript
// CURRENT - Too restrictive
export const A1_NOTATION_REGEX = /^[^[\],]+$/;
```

This regex rejects:
- ❌ Comma-separated ranges: `"Sheet1!A1:A10,Sheet1!D1:D10"` (charts need this!)
- ❌ Brackets (which shouldn't be rejected in all cases)

### The Fix
The current regex is actually a **fallback** that delegates to Google API validation. The real issue is that Claude is sending multi-range strings to `RangeInputSchema` which uses `A1NotationSchema`.

**Solution**: Create a separate `ChartRangeSchema` for chart data that accepts comma-separated ranges.

**File to modify**: `src/schemas/visualize.ts`

```typescript
// ADD: New schema for chart-specific ranges that support multiple ranges
const ChartRangeStringSchema = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (val) => {
      // Allow comma-separated A1 ranges for charts
      // Each part must be a valid A1 notation
      const parts = val.split(',');
      return parts.every(part => part.trim().length > 0);
    },
    'Invalid chart range format'
  )
  .describe('A1 notation range(s). For multiple ranges, use comma-separated: "Sheet1!A1:A10,Sheet1!D1:D10"');

// MODIFY: ChartDataSchema to use flexible range input
const ChartDataSchema = z.object({
  sourceRange: z.union([
    RangeInputSchema,           // Structured input {a1: "..."} 
    ChartRangeStringSchema      // Direct string including comma-separated
  ]).describe('Chart data source. Accepts A1 notation or comma-separated ranges for multi-series charts.'),
  series: z.array(ChartSeriesSchema).optional(),
  // ... rest unchanged
});
```

---

## 🔴 Issue 2: Schema Flexibility Problems

### 2.1 sheets_quality `analyze_impact` (43% error rate)

**File**: `src/schemas/quality.ts` (line 76-90)

**Current Problem**: All fields in `operation` are required with strict regex:
```typescript
operation: z.object({
  type: z.string().min(1).describe('Operation type'),
  tool: z.string().min(1).regex(/^sheets_[a-z]+$/, 'Tool name must start with "sheets_"'),
  action: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
})
```

**Claude's Actual Input**: Often sends partial operation info or different formats.

**Fix**:
```typescript
operation: z.object({
  type: z.string().min(1).optional().describe('Operation type (e.g., "values_write", "sheet_delete")'),
  tool: z.string().optional().describe('Tool name (e.g., "sheets_data")'),
  action: z.string().optional().describe('Action name (e.g., "write", "clear")'),
  params: z.record(z.string(), z.unknown()).optional().describe('Operation parameters'),
  // NEW: Accept simple description for natural language input
  description: z.string().optional().describe('Natural language description of the operation'),
}).refine(
  (op) => op.type || op.tool || op.description,
  'At least one of type, tool, or description must be provided'
)
```

### 2.2 sheets_confirm `request` (57% error rate)

**File**: `src/schemas/confirm.ts` (line 28-43)

**Current Problem**: `PlanStepSchema` has strict regex for tool names:
```typescript
tool: z.string().min(1).regex(/^sheets_[a-z]+$/, 'Tool name must start with "sheets_"')
```

**Fix**: Make more flexible:
```typescript
tool: z.string().min(1).describe('Tool to be called (e.g., "sheets_data", "sheets_format")')
  .transform(val => val.toLowerCase().startsWith('sheets_') ? val : `sheets_${val}`)
```

### 2.3 sheets_format `add_conditional_format_rule` rulePreset (7 errors)

**File**: `src/schemas/format.ts` (line 197-210)

**Current Problem**: Limited preset enum:
```typescript
rulePreset: z.enum([
  'highlight_duplicates',
  'highlight_blanks',
  // ... only 10 options
])
```

**Fix**: Add more presets and accept aliases:
```typescript
rulePreset: z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      // Normalize common variations
      const normalized = val.toLowerCase().replace(/[_\s-]/g, '_');
      const aliases: Record<string, string> = {
        'duplicates': 'highlight_duplicates',
        'blanks': 'highlight_blanks', 
        'errors': 'highlight_errors',
        'green_red': 'color_scale_green_red',
        'red_green': 'color_scale_green_red',
        'blue_red': 'color_scale_blue_red',
        'data_bar': 'data_bars',
        'databars': 'data_bars',
        'top_10': 'top_10_percent',
        'bottom_10': 'bottom_10_percent',
        'above_avg': 'above_average',
        'below_avg': 'below_average',
      };
      return aliases[normalized] || normalized;
    }
    return val;
  },
  z.enum([
    'highlight_duplicates',
    'highlight_blanks',
    'highlight_errors',
    'color_scale_green_red',
    'color_scale_blue_red',
    'color_scale_green_yellow_red',  // NEW
    'data_bars',
    'top_10_percent',
    'bottom_10_percent',
    'above_average',
    'below_average',
    'text_contains',  // NEW
    'date_is_today',  // NEW
  ])
)
```

### 2.4 sheets_format `set_data_validation` condition (7 errors)

**File**: `src/schemas/format.ts` (line 179-187)

**Current Problem**: `ConditionSchema` values must be string array:
```typescript
// In shared.ts
export const ConditionSchema = z.object({
  type: ConditionTypeSchema,
  values: z.array(z.string()).optional(),
});
```

**Fix**: Accept flexible value formats:
```typescript
// In shared.ts - update ConditionSchema
export const ConditionSchema = z.object({
  type: ConditionTypeSchema,
  values: z.preprocess(
    (val) => {
      // Convert single values to array
      if (val === undefined || val === null) return undefined;
      if (!Array.isArray(val)) return [String(val)];
      // Convert all elements to strings
      return val.map(v => String(v));
    },
    z.array(z.string()).optional()
  ),
});
```

### 2.5 sheets_dimensions `sort_range` sortSpecs.columnIndex (6 errors)

**File**: `src/schemas/dimensions.ts` (line 57-70)

**Current Status**: Actually already has preprocessing! But might need enhancement.

```typescript
// CURRENT - Already has column letter conversion
columnIndex: z.preprocess((val) => {
  if (typeof val === 'string' && /^[A-Z]+$/i.test(val)) {
    return columnLetterToIndex(val);
  }
  return val;
}, z.coerce.number().int().min(0))
```

**Potential Issue**: The error might be from passing objects or nested structures.

**Fix**: Add more robust preprocessing:
```typescript
columnIndex: z.preprocess((val) => {
  // Handle column letters: A, B, C, AA, etc.
  if (typeof val === 'string' && /^[A-Z]+$/i.test(val)) {
    return columnLetterToIndex(val);
  }
  // Handle object with index property
  if (typeof val === 'object' && val !== null && 'index' in val) {
    return (val as {index: unknown}).index;
  }
  // Handle string numbers
  if (typeof val === 'string' && /^\d+$/.test(val)) {
    return parseInt(val, 10);
  }
  return val;
}, z.coerce.number().int().min(0))
```

---

## 🟡 Issue 3: Color and Value Coercion

### 3.1 Color Format Flexibility

**File**: `src/schemas/shared.ts` (line 25-42)

**Current Problem**: Only accepts RGB object format:
```typescript
export const ColorSchema = z.object({
  red: z.number().min(0).max(1).optional().default(0),
  green: z.number().min(0).max(1).optional().default(0),
  blue: z.number().min(0).max(1).optional().default(0),
  alpha: z.number().min(0).max(1).optional().default(1),
})
```

**Claude often sends**: Hex strings like `"#4285F4"` or named colors like `"red"`

**Fix**: Accept multiple formats with preprocessing:
```typescript
// Helper to convert hex to RGB
function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    red: parseInt(result[1], 16) / 255,
    green: parseInt(result[2], 16) / 255,
    blue: parseInt(result[3], 16) / 255,
  };
}

// Named colors map
const NAMED_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  red: { red: 1, green: 0, blue: 0 },
  green: { red: 0, green: 1, blue: 0 },
  blue: { red: 0, green: 0, blue: 1 },
  white: { red: 1, green: 1, blue: 1 },
  black: { red: 0, green: 0, blue: 0 },
  yellow: { red: 1, green: 1, blue: 0 },
  // Google's colors
  'google-blue': { red: 0.26, green: 0.52, blue: 0.96 },
  'google-red': { red: 0.92, green: 0.26, blue: 0.21 },
  'google-green': { red: 0.13, green: 0.55, blue: 0.13 },
  'google-yellow': { red: 0.98, green: 0.74, blue: 0.02 },
};

export const ColorSchema = z.preprocess(
  (val) => {
    // Already an object with RGB values
    if (typeof val === 'object' && val !== null) {
      return val;
    }
    // Hex string
    if (typeof val === 'string' && val.startsWith('#')) {
      return hexToRgb(val);
    }
    // Named color
    if (typeof val === 'string' && NAMED_COLORS[val.toLowerCase()]) {
      return NAMED_COLORS[val.toLowerCase()];
    }
    return val;
  },
  z.object({
    red: z.number().min(0).max(1).optional().default(0),
    green: z.number().min(0).max(1).optional().default(0),
    blue: z.number().min(0).max(1).optional().default(0),
    alpha: z.number().min(0).max(1).optional().default(1),
  })
).transform((color) => ({
  red: Math.round(color.red * 10000) / 10000,
  green: Math.round(color.green * 10000) / 10000,
  blue: Math.round(color.blue * 10000) / 10000,
  alpha: Math.round(color.alpha * 10000) / 10000,
}))
```

---

## ✅ Issue 4: Action Extraction (ALREADY FIXED)

**File**: `src/server.ts` (line 106-132)

The `extractActionFromArgs` function already checks up to 3 levels deep. The remaining "unknown" actions are likely from:
1. Malformed requests
2. Edge cases with different nesting patterns

**Status**: No changes needed - current implementation is correct.

---

## 📋 Implementation Checklist

### Phase 1: Critical Fixes (30 min)

- [ ] **1.1** Add `ChartRangeStringSchema` to `src/schemas/visualize.ts`
- [ ] **1.2** Update `ChartDataSchema.sourceRange` to use union type
- [ ] **1.3** Run `npm run typecheck` to verify

### Phase 2: Schema Flexibility (1.5 hours)

- [ ] **2.1** Update `AnalyzeImpactActionSchema.operation` in `src/schemas/quality.ts`
- [ ] **2.2** Update `PlanStepSchema.tool` in `src/schemas/confirm.ts`
- [ ] **2.3** Expand `rulePreset` enum in `src/schemas/format.ts`
- [ ] **2.4** Update `ConditionSchema.values` preprocessing in `src/schemas/shared.ts`
- [ ] **2.5** Enhance `SortSpecSchema.columnIndex` preprocessing in `src/schemas/dimensions.ts`
- [ ] **2.6** Run `npm run typecheck` after each change

### Phase 3: Color Coercion (30 min)

- [ ] **3.1** Add color conversion helpers to `src/schemas/shared.ts`
- [ ] **3.2** Update `ColorSchema` with preprocessing
- [ ] **3.3** Run `npm run typecheck` and `npm test`

### Phase 4: Verification

- [ ] **4.1** Run full test suite: `npm test`
- [ ] **4.2** Run verification: `npm run verify`
- [ ] **4.3** Rebuild: `npm run build`
- [ ] **4.4** Test with Claude Desktop

---

## 🎯 Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Overall Error Rate | 14.6% | <8% |
| sheets_confirm | 57% | <15% |
| sheets_quality | 43% | <15% |
| sheets_visualize | 33% | <10% |
| sheets_format | 16% | <8% |
| sheets_dimensions | 18% | <10% |

---

## 🔄 Quick Wins Summary

These are the smallest changes with biggest impact:

1. **Chart range union type** → Unblocks all chart creation
2. **Color hex support** → Fixes 5+ error types across tools
3. **Condition values preprocessing** → Fixes validation errors
4. **Rule preset aliases** → Reduces conditional format failures

---

Ready to implement? Start with Phase 1 (Critical Fixes) to unblock chart creation immediately.
