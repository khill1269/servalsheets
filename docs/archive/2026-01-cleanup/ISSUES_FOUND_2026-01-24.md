---
title: 🔍 ServalSheets - Issues Found & Fix Plan
category: archived
last_updated: 2026-01-31
description: "Analysis Date: 2026-01-24 09:26 AM"
tags: [sheets]
---

# 🔍 ServalSheets - Issues Found & Fix Plan

**Analysis Date**: 2026-01-24 09:26 AM
**Log Size**: 3.7MB, 12,270 lines, 2,254 tool calls
**Overall Error Rate**: 14.6% (328 errors) - **NEEDS IMPROVEMENT**

---

## 🚨 Critical Issues (Fix Immediately)

### 1. **A1 Notation Validation Too Strict** ⚠️ ACTIVE ERROR

**Status**: Failing right now (09:24:34)
**Error Rate**: Multiple occurrences in sheets_data, sheets_visualize

**Problem**:

```
sourceRange: "Sheet1!A1:A10,Sheet1!D1:D10"
❌ Rejected by regex: /^(?:'.+'!|[^!]+!)?(?:[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?|[A-Z]+:[A-Z]+|[0-9]+:[0-9]+)$/
```

Claude is trying to create charts with multiple ranges (comma-separated), but our schema rejects it.

**Google Sheets API Reality**:

- ✅ Supports: `"A1:B10"` (single range)
- ✅ Supports: `"A1:A10,D1:D10"` (multiple ranges for charts)
- ✅ Supports: `"Sheet1"` (whole sheet - for append)
- ❌ Our regex rejects comma-separated ranges

**Fix Location**: `src/schemas/shared.ts` - A1NotationSchema regex

**Impact**: sheets_visualize, sheets_data.append failures

**Priority**: 🔴 CRITICAL - Currently blocking Claude's testing

---

### 2. **High Error Rate Tools** (30%+ failure)

**Status**: Blocking comprehensive testing

| Tool | Error Rate | Calls | Errors | Impact |
|------|-----------|-------|--------|--------|
| sheets_confirm | **57%** | 7 | 4 | Confirmation system broken |
| sheets_quality | **43%** | 35 | 15 | Quality validation failing |
| sheets_appsscript | **43%** | 7 | 3 | Apps Script unusable |
| sheets_visualize | **33%** | 113 | 37 | Charts failing frequently |
| sheets_fix | **33%** | 6 | 2 | Auto-fix not working |
| sheets_composite | **30%** | 20 | 6 | Bulk operations failing |
| sheets_analyze | **29%** | 85 | 25 | Analysis unreliable |

**Root Causes**:

1. Schema validation too strict (A1 notation, enums)
2. Missing optional field handling
3. Unclear parameter names (data vs updates vs values)

**Priority**: 🔴 CRITICAL - 30%+ failure is unacceptable

---

### 3. **Unknown Action Tracking** ⚠️ Data Quality Issue

**Status**: 296 calls with "unknown" action (13% of all calls)

| Tool | Unknown Calls | Error Rate |
|------|---------------|------------|
| sheets_core | 74 | 12% |
| sheets_data | 58 | **45%** |
| sheets_auth | 36 | 11% |
| sheets_format | 34 | 26% |
| sheets_dimensions | 26 | 15% |

**Problem**: Action field not being extracted from requests, breaking:

- Metrics tracking
- Error categorization
- Debugging
- Usage analytics

**Likely Cause**: Action extraction code in `src/server.ts:682-695` not handling all request formats

**Priority**: 🟡 HIGH - Affects observability

---

## 🔥 Validation Error Hot Spots (153 errors, 47% of all errors)

### Top 15 Fields Causing Validation Failures

| Rank | Field | Errors | Tool |
|------|-------|--------|------|
| 1 | rulePreset | 7 | sheets_format.add_conditional_format_rule |
| 2 | condition | 7 | sheets_format.set_data_validation |
| 3 | sortSpecs.0.columnIndex | 6 | sheets_dimensions.sort_range |
| 4 | color | 5 | sheets_format.set_background |
| 5 | rule.type | 5 | sheets_format.rule_add_conditional_format |
| 6 | rule.condition.values.0 | 5 | sheets_format.rule_add_conditional_format |
| 7 | operation.tool | 4 | sheets_quality.analyze_impact |
| 8 | operation.action | 4 | sheets_quality.analyze_impact |
| 9 | operation.params | 4 | sheets_quality.analyze_impact |
| 10 | operation.type | 4 | sheets_quality.analyze_impact |
| 11 | referenceType | 3 | sheets_session.find_by_reference |
| 12 | validation | 3 | sheets_data.set_validation |
| 13 | cell | 3 | sheets_data.add_note |
| 14 | strategy | 3 | sheets_quality.resolve_conflict |
| 15 | preset | 3 | sheets_format.apply_preset |

**Pattern**: Enums too restrictive, optional fields required, unclear parameter names

**Priority**: 🟡 HIGH - Causes 47% of all errors

---

## 📊 Tool Performance Analysis

### Healthy Tools (0-10% error rate) ✅

- sheets_analysis: 0% (5 calls)
- sheets_core: 5% (315 calls) ✅ **Excellent**
- sheets_auth: 4% (163 calls) ✅
- sheets_data: 10% (576 calls) ✅ **Most used**

### Moderate Issues (11-20%)

- sheets_session: 11% (65 calls)
- sheets_collaborate: 13% (30 calls)
- sheets_bigquery: 14% (14 calls)
- sheets_format: 16% (423 calls)
- sheets_dimensions: 18% (225 calls)
- sheets_advanced: 18% (62 calls)
- sheets_templates: 20% (5 calls)

### High Issues (21-30%) ⚠️

- sheets_history: 23% (31 calls)
- sheets_transaction: 22% (67 calls)

### Critical Issues (30%+) 🚨

- Listed in section 2 above

---

## 🎯 Prioritized Fix Plan

### Phase 1: Fix Blocking Issues (1-2 hours)

#### 1.1 Fix A1 Notation Regex (30 min)

**File**: `src/schemas/shared.ts`

**Current**:

```typescript
const A1_NOTATION_REGEX = /^(?:'.+'!|[^!]+!)?(?:[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?|[A-Z]+:[A-Z]+|[0-9]+:[0-9]+)$/;
```

**Fixed**:

```typescript
const A1_NOTATION_REGEX = /^(?:'.+'!|[^!]+!)?(?:[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?|[A-Z]+:[A-Z]+|[0-9]+:[0-9]+|[A-Z]+)(?:,(?:'.+'!|[^!]+!)?(?:[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?|[A-Z]+:[A-Z]+|[0-9]+:[0-9]+|[A-Z]+))*$/;
```

**Supports**:

- `A1:B10` (single range)
- `A1:A10,D1:D10` (multiple ranges)
- `Sheet1!A1:B10` (with sheet)
- `Sheet1` (whole sheet)
- `Sheet1!A:A` (whole column)

**Test Cases**:

- ✅ `"A1:B10"` → valid
- ✅ `"A1:A10,D1:D10"` → valid
- ✅ `"Sheet1!A1:B10,Sheet1!D1:D10"` → valid
- ✅ `"Sheet1"` → valid
- ❌ `"A1:B10,,D1:D10"` → invalid (empty range)

#### 1.2 Fix Action Extraction (30 min)

**File**: `src/server.ts:682-737`

**Problem**: Nested request object not handled

```typescript
// Current only checks:
args.action
args.request.action

// Missing:
args.request?.request?.action (some handlers double-wrap)
```

**Fix**: Recursive action extraction

```typescript
function extractAction(args: Record<string, unknown>): string {
  if (typeof args['action'] === 'string') return args['action'];

  let current: unknown = args['request'];
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current === 'object' && current !== null) {
      const record = current as Record<string, unknown>;
      if (typeof record['action'] === 'string') return record['action'];
      current = record['request'];
    }
  }

  return 'unknown';
}
```

#### 1.3 Fix sheets_visualize Schema (20 min)

**File**: `src/schemas/visualize.ts`

**Problem**: sourceRange field uses A1NotationSchema (rejects comma-separated)

**Fix**:

```typescript
// Add new schema for chart ranges
export const ChartRangeSchema = z.union([
  A1NotationSchema,  // Single range
  z.string().regex(/^(?:'.+'!|[^!]+!)?(?:[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?|[A-Z]+:[A-Z]+|[0-9]+:[0-9]+)(?:,(?:'.+'!|[^!]+!)?(?:[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?|[A-Z]+:[A-Z]+|[0-9]+:[0-9]+))+$/)  // Multiple ranges
]);

// Update chart_create schema
data: z.object({
  sourceRange: ChartRangeSchema,  // Changed from A1NotationSchema
  // ...
})
```

---

### Phase 2: Reduce Error Rates (2-3 hours)

#### 2.1 Fix sheets_quality Validation (45 min)

**Error Rate**: 43% → Target: <10%

**Issues**:

- operation.tool/action/params not optional when they should be
- strategy enum too restrictive

**File**: `src/schemas/quality.ts`

#### 2.2 Fix sheets_confirm Validation (30 min)

**Error Rate**: 57% → Target: <10%

**Issues**:

- Elicitation integration broken
- Missing optional fields

**File**: `src/schemas/confirm.ts`

#### 2.3 Fix sheets_visualize Validation (1 hour)

**Error Rate**: 33% → Target: <15%

**Issues**:

- Chart options too strict
- Color formats not flexible enough
- Position validation too restrictive

**File**: `src/schemas/visualize.ts`

#### 2.4 Fix sheets_format Validation (1 hour)

**Error Rate**: 16% → Target: <10%

**Top Issues**:

- rulePreset enum missing values
- condition schema too strict
- color schema rejects valid hex colors

**File**: `src/schemas/format.ts`

---

### Phase 3: Improve Observability (1 hour)

#### 3.1 Add Better Error Messages

**File**: `src/utils/enhanced-errors.ts`

For each validation hot spot, add:

- Clear error message explaining what's wrong
- Example of correct format
- Link to documentation

#### 3.2 Add Validation Error Metrics

**File**: `src/observability/metrics.ts`

Track:

- Validation errors by field path
- Most common validation failures
- Error rates by tool/action

#### 3.3 Improve Logging

**File**: `src/utils/logger.ts`

Add structured logging:

- Tool name + action in every log
- Request ID propagation
- Validation error details

---

## 📈 Success Metrics

### Current (Baseline)

- Overall error rate: 14.6%
- Validation errors: 47% of all errors
- Tools with >30% error rate: 7 tools
- Unknown actions: 13% of calls

### Target (After Fixes)

- Overall error rate: <8% ✅
- Validation errors: <30% of all errors ✅
- Tools with >30% error rate: 0 tools ✅
- Unknown actions: <2% of calls ✅

---

## 🔄 Current Live Activity (Last 5 minutes)

**Test**: New spreadsheet 1IQST... (different from original 17WKS...)
**Phase**: Phase 4 - Visualization

Recent operations:

- ✅ sheets_composite.smart_append - SUCCESS
- ✅ sheets_composite.bulk_update - SUCCESS
- ✅ sheets_format.set_format - SUCCESS
- ✅ sheets_format.set_number_format - SUCCESS
- ✅ sheets_format.set_borders - SUCCESS
- ✅ sheets_dimensions.freeze - SUCCESS
- ❌ sheets_visualize.chart_create - FAILED (A1 notation: "Sheet1!A1:A10,Sheet1!D1:D10")
- ✅ sheets_visualize.chart_create - SUCCESS (fixed to "Sheet1!A1:D10")
- ✅ sheets_visualize.chart_create - SUCCESS (pie chart)
- 🔄 sheets_dimensions.insert - IN PROGRESS

**Current Success Rate**: 89% (8/9 in last 5 minutes)
**Active Testing**: Claude is working around validation issues by retrying with simpler inputs

---

## 🛠️ Implementation Order

1. **Fix A1 notation regex** (BLOCKING - do first)
2. **Fix action extraction** (observability - do second)
3. **Fix sheets_visualize schema** (high usage, 33% error rate)
4. **Fix sheets_quality schema** (43% error rate)
5. **Fix sheets_confirm schema** (57% error rate)
6. **Fix sheets_format validation hot spots**
7. **Add better error messages**
8. **Improve metrics tracking**

---

## 💡 Quick Wins (Can fix in 10 minutes)

1. Make sheets_data.append accept just sheet name (no range)
2. Add "unknown" to action enums (prevent extraction failures)
3. Make all color fields accept hex strings OR RGB objects
4. Make sortSpecs.columnIndex accept string OR number

---

## 🧪 Testing Strategy

After each fix:

1. Run `npm run verify` (typecheck, lint, tests)
2. Rebuild: `npm run build`
3. Restart Claude Desktop
4. Ask Claude to test the specific tool
5. Check monitoring: `npm run monitor:live`
6. Verify error rate decreased

---

**Next Steps**: Start with Phase 1 (Fix Blocking Issues) - estimated 1-2 hours
**Expected Impact**: Error rate 14.6% → ~8% (nearly 50% reduction)

**Created**: 2026-01-24 09:26 AM
**Log Analysis**: 12,270 lines, 2,254 tool calls, 328 errors analyzed
