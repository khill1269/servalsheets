# ServalSheets Improvement Plan - Research-Driven Approach

## Executive Summary

This document outlines a methodical, research-driven approach to improving ServalSheets while ensuring zero breaking changes. Every improvement is backed by official documentation references and includes verification guardrails.

---

## 🔬 Research Phase Complete

### Official Documentation References

#### MCP Protocol (modelcontextprotocol.io)
- **Tool Schema Requirements**: Tools must have `name`, optional `description`, and `inputSchema` (JSON Schema)
- **Error Handling**: Tool errors should be reported within the result object, not as MCP protocol-level errors
- **JSON Schema Version**: JSON Schema draft-2020-12 required for Claude Code compatibility
- **Best Practices**: 
  - Validate inputs with strong schemas, types, ranges, and patterns
  - Reject on first failure
  - Contract tests for backward compatibility

#### MCP TypeScript SDK (v1.25.2)
- **Zod Integration**: SDK uses `zodToJsonSchema` for schema conversion
- **Known Issue #745**: JSON Schema draft-07 vs draft-2020-12 compatibility
- **Known Issue #1143**: Zod 4 schema field descriptions not propagating
- **Pattern**: `server.tool(name, schema, handler)` with Zod validation

#### Google Sheets API v4
- **Rate Limits**: 
  - 300 read requests per minute per project
  - 300 write requests per minute per project
  - 60 requests per minute per user per project
- **Batch Operations**: All subrequests applied atomically; if any fails, entire update fails
- **Recommended Payload**: 2MB maximum for optimal performance

---

## 📋 Improvement Categories

### Category 1: Schema Validation Fixes (59 errors)
**Root Cause**: Missing `.optional()` or `.default()` on fields that LLMs may omit

**Files Affected**:
- `src/schemas/advanced.ts` (7 errors)
- `src/schemas/bigquery.ts` (10 errors)
- `src/schemas/composite.ts` (3 errors)
- `src/schemas/confirm.ts` (3 errors)
- `src/schemas/data.ts` (7 errors)
- `src/schemas/dimensions.ts` (12 errors)
- `src/schemas/format.ts` (8 errors)
- `src/schemas/visualize.ts` (8 errors)

### Category 2: Schema Description Enhancement
**Goal**: Ensure all schema fields have descriptive examples for LLM understanding

### Category 3: Error Message Enrichment
**Goal**: Provide actionable error messages with recovery steps

---

## 🛡️ Guardrail Framework

### Pre-Modification Checklist
```bash
# Run BEFORE any code changes
npm run verify              # Full verification suite
npm run test:contracts      # Schema contract tests
npm run typecheck           # TypeScript validation
```

### Post-Modification Verification
```bash
# Run AFTER every code change
npm run verify              # Must pass
npm run test:fast           # Quick tests
npm run smoke               # Smoke test
```

### Breaking Change Detection
```bash
# Detect breaking changes
npm run gen:metadata && npm run check:drift
```

---

## 🚀 Implementation Phases

### Phase 1: Schema Validation Fixes (Quick Wins - 2 hours)

#### 1.1 Fix Missing Optional/Default Fields

**Pattern to Apply**:
```typescript
// BEFORE (causes validation error when LLM omits field)
protectedRangeId: z.number().int()

// AFTER (accepts undefined, works with LLM tool calls)
protectedRangeId: z.number().int().optional()
```

**Specific Fixes Required**:

| File | Field | Current | Fix |
|------|-------|---------|-----|
| advanced.ts | `protectedRangeId` | required | `.optional()` |
| advanced.ts | `metadataId` | required | `.optional()` |
| advanced.ts | `bandedRangeId` | required | `.optional()` |
| bigquery.ts | `spec` object | required | `.optional()` |
| bigquery.ts | `destination` object | required | `.optional()` |
| composite.ts | `sheetId` union | confusing | simplify |
| confirm.ts | `plan` object | required | `.optional()` |
| data.ts | cell references | required | `.optional()` |
| dimensions.ts | `destinationIndex` | required | `.optional()` |
| dimensions.ts | `pixelSize` | required | `.optional()` |
| dimensions.ts | `frozenRowCount` | required | `.optional()` |
| format.ts | format objects | required | `.optional()` |
| visualize.ts | `anchorCell` | required | `.optional()` |
| visualize.ts | `data` object | required | `.optional()` |

#### 1.2 Verification Script

```bash
#!/bin/bash
# scripts/verify-schema-fixes.sh

echo "🔍 Verifying schema fixes..."

# Run schema contract tests
npm run test:integration -- --testPathPattern=schema-contracts

# Run validation error reproduction tests
npm run test:handlers -- --testPathPattern=validation

# Verify no breaking changes
npm run gen:metadata
npm run check:drift

echo "✅ Schema verification complete"
```

---

### Phase 2: Description Enhancement (3 hours)

#### 2.1 Pattern for Field Descriptions

**Official MCP Best Practice**: Descriptions should include examples and valid values

```typescript
// BEFORE (minimal description)
range: RangeInputSchema.describe('Range to read')

// AFTER (actionable description with examples)
range: RangeInputSchema.describe(
  'Range in A1 notation. Examples: "A1:D10", "Sheet1!A1:B5", "MyData" (named range). ' +
  'Supports: cell ("A1"), range ("A1:C10"), column ("A:C"), row ("1:5"), named range.'
)
```

#### 2.2 Priority Fields to Enhance (Top 50)

| Schema | Field | Current Description | Enhanced Description |
|--------|-------|---------------------|----------------------|
| shared.ts | `spreadsheetId` | "Spreadsheet ID from URL" | "44-char ID from URL: docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit" |
| shared.ts | `sheetId` | "Numeric sheet ID" | "Numeric sheet ID (0 = first sheet). Find via sheets_core action='list_sheets'" |
| data.ts | `range` | "Range to read" | "Range in A1 notation. Examples: 'Sheet1!A1:D10', 'A:C', '1:5', 'MyNamedRange'" |
| data.ts | `values` | "2D array of values" | "2D array: [[row1col1, row1col2], [row2col1, row2col2]]. Use null for empty cells." |
| dimensions.ts | `startIndex` | "Start index" | "0-based row/column index. Example: startIndex=5 = row 6 (accounting for header)" |

---

### Phase 3: Error Message Enhancement (4 hours)

#### 3.1 Error Message Pattern

**Official MCP Best Practice**: Errors should include recovery steps

```typescript
// BEFORE (generic error)
throw createError('SHEET_NOT_FOUND', 'Sheet not found: 0');

// AFTER (actionable error with recovery)
throw createError('SHEET_NOT_FOUND', 
  `Sheet with ID '${sheetId}' not found. ` +
  `Use sheets_core action='list_sheets' to see available sheets. ` +
  `Common causes: (1) Sheet deleted, (2) Using sheetIndex not sheetId, (3) Wrong spreadsheetId`,
  {
    suggestedTool: 'sheets_core',
    suggestedAction: 'list_sheets',
    recoverySteps: [
      "Call sheets_core with action='list_sheets' to get valid sheet IDs",
      "Verify spreadsheetId is correct",
      "Check if sheet was recently deleted"
    ]
  }
);
```

#### 3.2 Top 15 Error Messages to Enhance

| Error Code | Current Message | Enhanced Message |
|------------|-----------------|------------------|
| SPREADSHEET_NOT_FOUND | "Spreadsheet not found" | "Spreadsheet '{id}' not found. Verify: (1) ID is correct (44 chars), (2) You have access, (3) It wasn't deleted" |
| SHEET_NOT_FOUND | "Sheet not found" | "Sheet ID '{id}' not found. Use sheets_core action='list_sheets' to see valid IDs" |
| INVALID_RANGE | "Invalid range" | "Invalid range '{range}'. Expected A1 notation. Examples: 'A1:D10', 'Sheet1!A:C', 'MyNamedRange'" |
| QUOTA_EXCEEDED | "Quota exceeded" | "Rate limit hit ({limit}/min). Retry in {retryAfter}s. Consider: batch operations, caching" |
| PERMISSION_DENIED | "Permission denied" | "No {action} access to '{resource}'. Request access from owner or use sheets_collaborate action='share_list'" |

---

## 📊 Testing Strategy

### Test Categories

1. **Contract Tests** (existing: `tests/contracts/`)
   - Schema validation contracts
   - Tool registration contracts
   - Response format contracts

2. **LLM Compatibility Tests** (NEW)
   - Test all 252 actions with minimal input
   - Test with missing optional fields
   - Test with string-coerced numbers

3. **Error Snapshot Tests** (NEW)
   - Capture error message formats
   - Verify recovery suggestions present

### Test Commands

```bash
# Run all tests with coverage
npm run test:coverage

# Run specific test categories
npm run test:contracts      # Schema contracts
npm run test:handlers       # Handler logic
npm run test:integration    # Full integration

# Run new LLM compatibility tests
npm run test -- tests/llm-compatibility/
```

---

## 🔒 Guardrail Checklist

Before each PR:
- [ ] `npm run verify` passes
- [ ] `npm run test:contracts` passes
- [ ] `npm run check:drift` shows no drift
- [ ] No TypeScript errors
- [ ] No new validation errors in error log
- [ ] Backward compatibility maintained

---

## 📈 Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Validation Errors | 59 | 0 | test-errors.log |
| Schema Fields with Examples | ~60% | 95% | Manual audit |
| Actionable Error Messages | ~40% | 95% | Error message audit |
| Test Coverage | ~70% | 90% | npm run test:coverage |
| LLM Compatibility Score | ~75% | 98% | New test suite |

---

## 🗓️ Implementation Timeline

| Day | Tasks | Verification |
|-----|-------|--------------|
| 1 | Phase 1.1: Fix 47 optional fields | `npm run verify` |
| 1 | Phase 1.2: Test validation fixes | `npm run test:contracts` |
| 2 | Phase 2: Enhance 50 field descriptions | Manual review |
| 2 | Phase 2: Create description audit script | Automated check |
| 3 | Phase 3: Enhance 15 error messages | `npm run test:snapshots` |
| 3 | Phase 3: Create error message tests | New test suite |
| 4 | Integration testing | Full `npm run ci` |
| 4 | Documentation updates | PR review |

