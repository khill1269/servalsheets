# ServalSheets Comprehensive Improvement Plan

**Created:** January 23, 2026  
**Version:** 1.4.0 → 1.5.0 Target  
**Status:** Planning Phase  

---

## 🎯 Executive Summary

This document outlines a systematic improvement plan for ServalSheets with:
- **59 validation errors** to fix (58 schema-related)
- **Guardrails framework** to prevent breaking changes
- **Testing strategy** with continuous validation
- **Official documentation references** for MCP and Google Sheets API

---

## 📊 Current State Analysis

### Tool Inventory
| Metric | Current | Target |
|--------|---------|--------|
| Tools | 19 | 19 |
| Actions | 241 | 241+ |
| Validation Errors | 59 | 0 |
| Test Coverage | ~75% | 90%+ |
| Schema Description Coverage | ~60% | 100% |

### Validation Error Breakdown by Tool

```
sheets_advanced       7 errors  (protectedRangeId, metadataId, bandedRangeId)
sheets_bigquery      10 errors  (spec, destination, projectId, query)
sheets_composite      3 errors  (sheetId union confusion)
sheets_confirm        3 errors  (plan/wizard objects)
sheets_data           7 errors  (cell references)
sheets_dimensions    12 errors  (count, index, size params)
sheets_format         8 errors  (format objects)
sheets_visualize      8 errors  (position/data objects)
```

---

## 🛡️ Guardrails Framework

### 1. Pre-Change Validation Gates

Before ANY code change, these checks MUST pass:

```bash
# Gate 1: Type checking
npm run typecheck

# Gate 2: Schema validation
npm run test:schemas

# Gate 3: Unit tests
npm run test:unit

# Gate 4: Linting
npm run lint

# Gate 5: Metadata sync check
npm run check:drift
```

### 2. Change Validation Script

Create `/scripts/validate-change.sh`:

```bash
#!/bin/bash
set -e

echo "🔒 ServalSheets Change Validation"
echo "================================="

# Capture pre-change state
BEFORE_HASH=$(sha256sum dist/schemas/index.js 2>/dev/null || echo "new")

# Run all gates
echo "📋 Gate 1: Type checking..."
npm run typecheck || { echo "❌ Type check failed"; exit 1; }

echo "📋 Gate 2: Schema validation..."
npm run test:schemas || { echo "❌ Schema tests failed"; exit 1; }

echo "📋 Gate 3: Unit tests..."
npm run test:unit || { echo "❌ Unit tests failed"; exit 1; }

echo "📋 Gate 4: Linting..."
npm run lint || { echo "❌ Lint failed"; exit 1; }

echo "📋 Gate 5: Build verification..."
npm run build || { echo "❌ Build failed"; exit 1; }

echo "📋 Gate 6: Metadata sync..."
npm run check:drift || { echo "❌ Metadata drift detected"; exit 1; }

echo "📋 Gate 7: Smoke test..."
npm run smoke:quick || { echo "❌ Smoke test failed"; exit 1; }

echo "✅ All gates passed!"
```

### 3. Schema Change Rules

**CRITICAL: Schema changes require extra validation**

| Change Type | Risk Level | Required Validation |
|-------------|------------|---------------------|
| Add `.optional()` | LOW | Unit tests only |
| Add `.default()` | LOW | Unit tests + integration |
| Change `.describe()` | LOW | None (documentation only) |
| Add new field | MEDIUM | Full test suite |
| Remove field | HIGH | Requires deprecation period |
| Change field type | CRITICAL | Breaking change review |
| Change union types | CRITICAL | LLM compatibility tests |

### 4. Breaking Change Prevention

```typescript
// src/utils/schema-guard.ts
import { z } from 'zod';

/**
 * Schema change tracking for backward compatibility
 */
export interface SchemaChangeLog {
  version: string;
  tool: string;
  action: string;
  field: string;
  changeType: 'added' | 'deprecated' | 'removed' | 'modified';
  oldValue?: string;
  newValue?: string;
  migrationPath?: string;
}

/**
 * Validates schema changes don't break existing clients
 */
export function validateBackwardCompatibility(
  oldSchema: z.ZodTypeAny,
  newSchema: z.ZodTypeAny,
  testCases: unknown[]
): { compatible: boolean; failures: string[] } {
  const failures: string[] = [];
  
  for (const testCase of testCases) {
    const oldResult = oldSchema.safeParse(testCase);
    const newResult = newSchema.safeParse(testCase);
    
    // If old schema accepted it, new schema must also accept it
    if (oldResult.success && !newResult.success) {
      failures.push(`Breaking: Input accepted by old schema rejected by new: ${JSON.stringify(testCase)}`);
    }
  }
  
  return {
    compatible: failures.length === 0,
    failures
  };
}
```

---

## 🧪 Testing Strategy

### 1. Test Categories

```
tests/
├── unit/           # Fast, isolated tests
├── schemas/        # Schema validation tests  
├── handlers/       # Handler logic tests
├── integration/    # Real API tests (optional)
├── contracts/      # MCP protocol compliance
├── safety/         # Security & safety tests
├── property/       # Property-based tests (fast-check)
└── snapshots/      # Response format stability
```

### 2. Schema Validation Test Template

Create `/tests/schemas/schema-validation.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import * as schemas from '../../src/schemas/index.js';
import { z } from 'zod';

/**
 * Comprehensive schema validation tests
 * Tests that all schemas accept valid inputs and reject invalid inputs
 */

// Test data generators for each tool
const testCases = {
  sheets_advanced: {
    valid: [
      {
        request: {
          action: 'list_protected_ranges',
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
        }
      },
      {
        request: {
          action: 'add_named_range',
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          name: 'MyRange',
          range: 'Sheet1!A1:B10'
        }
      }
    ],
    invalid: [
      // Missing required spreadsheetId
      { request: { action: 'list_protected_ranges' } },
      // Invalid action
      { request: { action: 'invalid_action', spreadsheetId: '123' } }
    ]
  },
  // Add more tool test cases...
};

describe('Schema Validation - All Tools', () => {
  Object.entries(testCases).forEach(([tool, cases]) => {
    describe(tool, () => {
      const schema = schemas[`${toPascalCase(tool)}InputSchema`];
      
      if (!schema) {
        it.skip(`Schema not found for ${tool}`);
        return;
      }
      
      cases.valid.forEach((validCase, i) => {
        it(`accepts valid input ${i + 1}`, () => {
          const result = schema.safeParse(validCase);
          expect(result.success).toBe(true);
        });
      });
      
      cases.invalid.forEach((invalidCase, i) => {
        it(`rejects invalid input ${i + 1}`, () => {
          const result = schema.safeParse(invalidCase);
          expect(result.success).toBe(false);
        });
      });
    });
  });
});

function toPascalCase(str: string): string {
  return str.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
```

### 3. LLM Compatibility Tests

Create `/tests/llm-compatibility/llm-input.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as schemas from '../../src/schemas/index.js';

/**
 * Tests that schemas handle typical LLM-generated inputs
 * LLMs often:
 * - Omit optional fields entirely
 * - Send string numbers instead of numbers
 * - Use NaN for missing numeric values
 * - Send empty objects instead of undefined
 */

describe('LLM Compatibility - Common Patterns', () => {
  describe('sheets_advanced', () => {
    const schema = schemas.SheetsAdvancedInputSchema;
    
    it('handles minimal valid input (LLM omits optional fields)', () => {
      const llmInput = {
        request: {
          action: 'list_named_ranges',
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
        }
      };
      
      const result = schema.safeParse(llmInput);
      expect(result.success).toBe(true);
    });
    
    it('handles string numbers via z.coerce', () => {
      const llmInput = {
        request: {
          action: 'update_protected_range',
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          protectedRangeId: '123' // String instead of number
        }
      };
      
      const result = schema.safeParse(llmInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.request.protectedRangeId).toBe('number');
      }
    });
    
    it('provides helpful error for NaN values', () => {
      const llmInput = {
        request: {
          action: 'update_protected_range',
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          protectedRangeId: NaN
        }
      };
      
      const result = schema.safeParse(llmInput);
      // Should fail with clear error message
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMsg = JSON.stringify(result.error.flatten());
        expect(errorMsg).toContain('protectedRangeId');
      }
    });
  });
});
```

### 4. Regression Test Suite

Create `/tests/regression/validation-errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as schemas from '../../src/schemas/index.js';

/**
 * Regression tests for the 59 validation errors identified
 * Each test case comes from the actual error log
 */

describe('Regression: Validation Error Fixes', () => {
  describe('sheets_advanced - 7 errors', () => {
    const schema = schemas.SheetsAdvancedInputSchema;
    
    // Error 1: protectedRangeId NaN
    it('handles update_protected_range without protectedRangeId (optional or required)', () => {
      const input = {
        request: {
          action: 'update_protected_range',
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          description: 'Updated description'
          // Note: protectedRangeId intentionally omitted to test optionality
        }
      };
      
      // After fix: should either succeed (if optional) or provide clear error
      const result = schema.safeParse(input);
      // Document expected behavior
    });
    
    // Error 2: metadataId NaN
    it('handles delete_metadata without metadataId', () => {
      const input = {
        request: {
          action: 'delete_metadata',
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
          // metadataId omitted
        }
      };
      
      const result = schema.safeParse(input);
      // After fix: should provide clear error that metadataId is required
    });
  });
  
  // Add tests for remaining 52 errors...
});
```

### 5. Continuous Integration Workflow

Create `/scripts/ci-validation.sh`:

```bash
#!/bin/bash
set -e

echo "🔄 ServalSheets CI Validation Pipeline"
echo "======================================="

# Phase 1: Static Analysis
echo ""
echo "Phase 1: Static Analysis"
echo "------------------------"
npm run typecheck
npm run lint
npm run format:check

# Phase 2: Unit Tests (fast)
echo ""
echo "Phase 2: Unit Tests"
echo "-------------------"
npm run test:unit -- --reporter=verbose

# Phase 3: Schema Tests
echo ""
echo "Phase 3: Schema Validation"
echo "-------------------------"
npm run test -- tests/schemas --reporter=verbose

# Phase 4: Handler Tests
echo ""
echo "Phase 4: Handler Tests"
echo "---------------------"
npm run test:handlers -- --reporter=verbose

# Phase 5: Integration Tests (if API available)
if [ "$TEST_REAL_API" = "true" ]; then
  echo ""
  echo "Phase 5: Integration Tests"
  echo "-------------------------"
  npm run test:integration:real
fi

# Phase 6: Build & Metadata
echo ""
echo "Phase 6: Build & Metadata Sync"
echo "-----------------------------"
npm run build
npm run check:drift
npm run validate:server-json

# Phase 7: Smoke Test
echo ""
echo "Phase 7: Smoke Test"
echo "------------------"
npm run smoke

echo ""
echo "✅ All CI validation passed!"
```

---

## 📚 Official Documentation References

### MCP Protocol (2025-11-25)

**Source:** https://modelcontextprotocol.io/specification/2025-11-25

Key requirements for schema compliance:
1. **JSON-RPC 2.0** message format
2. **JSON Schema Draft 2020-12** for input/output schemas
3. Tool schemas MUST declare required fields, types, allowed values
4. Error codes conform to JSON-RPC standard (-32600 to -32603, -32700)

```typescript
// MCP-compliant error response
{
  jsonrpc: "2.0",
  id: 1,
  error: {
    code: -32602,  // Invalid params
    message: "Input validation error",
    data: {
      // Detailed error info
    }
  }
}
```

### Google Sheets API v4

**Source:** https://developers.google.com/workspace/sheets/api/reference/rest

Key API patterns to follow:

```typescript
// Spreadsheet ID format
const SPREADSHEET_ID_PATTERN = /^[a-zA-Z0-9-_]{20,}$/;

// A1 notation patterns
const A1_PATTERNS = {
  cell: 'A1',
  range: 'A1:B10',
  column: 'A:A',
  row: '1:1',
  withSheet: 'Sheet1!A1:B10',
  wholeSheet: 'Sheet1'
};

// API limits (from official docs)
const GOOGLE_LIMITS = {
  MAX_CELLS_PER_SPREADSHEET: 10_000_000,
  MAX_COLUMNS: 18_278, // ZZZ
  MAX_ROWS: 10_000_000,
  MAX_CHARACTERS_PER_CELL: 50_000,
  MAX_HYPERLINK_LENGTH: 32_767,
  API_QUOTA_READ_PER_MINUTE: 300,
  API_QUOTA_WRITE_PER_MINUTE: 300
};
```

---

## 🔧 Implementation Phases

### Phase 1: Schema Fixes (Week 1) - CRITICAL

**Goal:** Fix all 59 validation errors

#### 1.1 Add `.optional()` to Action-Specific Required Fields

```typescript
// src/schemas/advanced.ts - Line ~143
// BEFORE
const UpdateProtectedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('update_protected_range'),
  protectedRangeId: z.coerce.number().int().describe('Protected range ID'),
  // ...
});

// AFTER - Make protectedRangeId required but with better description
const UpdateProtectedRangeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('update_protected_range'),
  protectedRangeId: z.coerce.number().int()
    .describe('Protected range ID (REQUIRED - get from list_protected_ranges action)'),
  description: z.string().optional()
    .describe('New description for the protected range'),
  // ...
});
```

#### 1.2 Add Defaults for Common Optional Fields

```typescript
// Pattern for all schemas
const CommonFieldsSchema = z.object({
  spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe('Response detail: minimal (~40% less tokens), standard, detailed'),
  safety: SafetyOptionsSchema
    .optional()
    .default({ dryRun: false, createSnapshot: false })
    .describe('Safety options for destructive operations'),
});
```

#### 1.3 Add Examples to Descriptions

```typescript
// BEFORE
range: RangeInputSchema.describe('Range to read')

// AFTER
range: RangeInputSchema.describe(
  'Range in A1 notation. Examples: "A1:D10", "Sheet1!A1:B5", "A:A" (whole column), "1:1" (whole row)'
)
```

### Phase 2: Error Enhancement (Week 2)

**Goal:** Make errors actionable for LLMs

```typescript
// src/utils/enhanced-errors.ts
export function enhanceValidationError(
  zodError: z.ZodError,
  toolName: string,
  actionName: string
): ErrorDetail {
  const firstError = zodError.errors[0];
  const path = firstError.path.join('.');
  
  // Map common errors to actionable messages
  const errorMappings: Record<string, string> = {
    'request.protectedRangeId': 
      'Missing protectedRangeId. Use sheets_advanced with action "list_protected_ranges" first to get available IDs.',
    'request.sheetId':
      'Missing sheetId. Use sheets_core with action "list_sheets" to find the numeric ID for your sheet.',
    'request.range':
      'Missing range. Specify in A1 notation like "Sheet1!A1:D10" or use semantic ranges like "headers" or "data".',
  };
  
  return {
    code: 'VALIDATION_ERROR',
    message: errorMappings[path] || `Validation failed at ${path}: ${firstError.message}`,
    category: 'validation',
    severity: 'high',
    retryable: true,
    retryStrategy: 'correct_input',
    resolution: getResolutionForPath(path, toolName, actionName),
    suggestedTools: getSuggestedToolsForError(path),
    details: {
      tool: toolName,
      action: actionName,
      field: path,
      received: firstError.received,
      expected: firstError.expected,
      zodError: zodError.flatten()
    }
  };
}
```

### Phase 3: Testing Infrastructure (Week 2-3)

**Goal:** Achieve 90%+ test coverage with comprehensive validation

1. Create test fixtures for all 267 actions
2. Add property-based tests using fast-check
3. Add LLM compatibility tests
4. Add regression tests for all 59 errors

### Phase 4: Documentation (Week 3)

**Goal:** Complete API reference and troubleshooting guides

1. Generate API reference from schemas
2. Create troubleshooting guide
3. Add migration guide for breaking changes
4. Update README with examples

---

## 📋 Action Items Checklist

### Immediate (This Week)

- [ ] Create `/scripts/validate-change.sh` guardrail script
- [ ] Create regression tests for all 59 validation errors
- [ ] Fix `sheets_advanced` schema (7 errors)
- [ ] Fix `sheets_dimensions` schema (12 errors)
- [ ] Fix `sheets_bigquery` schema (10 errors)

### Short-term (Next 2 Weeks)

- [ ] Fix remaining schema errors (30 errors)
- [ ] Add examples to 50 most-used schema fields
- [ ] Create LLM compatibility test suite
- [ ] Enhance top 15 error messages
- [ ] Remove debug console statements

### Medium-term (Month 1)

- [ ] Achieve 90% test coverage
- [ ] Create API reference documentation
- [ ] Create troubleshooting guide
- [ ] Add property-based tests

---

## 🔍 Monitoring & Validation

### Pre-Commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run guardrails
npm run typecheck || exit 1
npm run lint || exit 1
npm run test:fast || exit 1
```

### Daily CI Health Check

```yaml
# .github/workflows/daily-health.yml
name: Daily Health Check
on:
  schedule:
    - cron: '0 6 * * *'  # 6 AM daily

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run ci
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4
```

---

## 📈 Success Metrics

| Metric | Current | Week 1 | Week 2 | Week 4 |
|--------|---------|--------|--------|--------|
| Validation Errors | 59 | 30 | 10 | 0 |
| Test Coverage | 75% | 80% | 85% | 90% |
| Schema Description Coverage | 60% | 80% | 90% | 100% |
| CI Pass Rate | - | 95% | 98% | 99% |

---

*Plan created: January 23, 2026*  
*Last updated: January 23, 2026*
