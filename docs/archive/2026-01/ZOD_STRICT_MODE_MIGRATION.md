# Zod .strict() Mode Migration Guide

## Overview

Add `.strict()` to all 296 Zod object schemas across 20+ schema files to prevent unknown properties from passing through validation.

## Priority Levels

### P0 - Critical (MCP Tool Input Schemas)
These schemas validate external input from Claude and must reject unknown properties:
- `src/schemas/auth.ts` - SheetsAuthInputSchema
- `src/schemas/spreadsheet.ts` - SheetSpreadsheetInputSchema
- `src/schemas/values.ts` - SheetsValuesInputSchema
- `src/schemas/cells.ts` - SheetsCellsInputSchema
- `src/schemas/format.ts` - SheetsFormatInputSchema
- All other *InputSchema definitions

**Estimated**: ~30 schemas
**Time**: 2-3 hours

### P1 - High (API Response Schemas)
Schemas that validate Google API responses:
- `src/schemas/shared.ts` - ColorSchema, GridPropertiesSchema, etc.
- Handler response types

**Estimated**: ~50 schemas
**Time**: 3-4 hours

### P2 - Medium (Internal Schemas)
Internal validation schemas:
- Configuration schemas
- Cache schemas
- Metrics schemas

**Estimated**: ~216 schemas
**Time**: 6-8 hours

## Migration Pattern

### Before:
```typescript
export const MySchema = z.object({
  field1: z.string(),
  field2: z.number().optional()
});
```

### After:
```typescript
export const MySchema = z.object({
  field1: z.string(),
  field2: z.number().optional()
}).strict(); // Reject unknown properties
```

## Automated Migration (Safe Approach)

```bash
# Run on each file individually, review changes before committing
find src/schemas -name "*.ts" -exec sh -c '
  file="$1"
  # Backup original
  cp "$file" "$file.bak"
  
  # Add .strict() to z.object() declarations (basic pattern)
  sed -i.tmp "s/z\.object({/z.object({/g" "$file"
  sed -i.tmp "s/})$/}).strict()/g" "$file"
  
  # Review changes
  git diff "$file"
  
  # If looks good, keep changes; otherwise restore backup
  # rm "$file.bak" or mv "$file.bak" "$file"
' sh {} \;
```

## Manual Migration Checklist

- [ ] P0: MCP Tool Input Schemas (30 schemas, 2-3 hours)
  - [ ] auth.ts - 4 schemas
  - [ ] spreadsheet.ts - 8 schemas
  - [ ] values.ts - 6 schemas
  - [ ] All other *InputSchema files

- [ ] P1: API Response Schemas (50 schemas, 3-4 hours)
  - [ ] shared.ts - 15 schemas
  - [ ] cells.ts - 10 schemas
  - [ ] format.ts - 12 schemas

- [ ] P2: Internal Schemas (216 schemas, 6-8 hours)
  - [ ] Remaining schema files

## Testing After Migration

```bash
# Run full test suite
npm test

# Check for Zod validation errors
npm run build

# Test with actual MCP requests
npm start
# Send test requests from Claude Desktop
```

## Expected Issues

1. **Tests may fail** - Tests passing unexpected properties will break
   - Fix: Update test data to match schemas
   
2. **API responses may fail** - Google API may return undocumented fields
   - Fix: Add those fields to schemas or use `.passthrough()` selectively

3. **Backward compatibility** - Existing integrations may break
   - Fix: Version bump and document breaking changes

## Rollback Plan

If issues occur:
```bash
# Revert changes
git checkout src/schemas/

# Or use backups
find src/schemas -name "*.bak" -exec sh -c 'mv "$1" "${1%.bak}"' sh {} \;
```

## Success Criteria

- ✅ All 296 schemas have `.strict()`
- ✅ All tests pass (2,151 tests)
- ✅ No Zod validation errors in production
- ✅ MCP tool calls work correctly
- ✅ Google API responses validate correctly

## Status

**Started**: 2026-01-10
**Current Progress**: 0/296 schemas (0%)
**Priority**: P0 (Critical for security)
**Estimated Completion**: 2-3 days with 1 engineer
