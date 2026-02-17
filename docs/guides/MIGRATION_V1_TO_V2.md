# Migration Guide: V1 → V2

**Last Updated:** 2026-02-17
**Estimated Migration Time:** 2-4 hours for most applications
**Difficulty:** Moderate

---

## Overview

This guide helps you migrate from ServalSheets schema v1 to v2. The migration is **backward compatible** - v1 clients continue working while you migrate.

## What's New in V2

### Breaking Changes

1. **Action Renames** - Consistent naming conventions
2. **Stricter Validation** - Better error prevention
3. **Enhanced Errors** - More actionable error messages
4. **Transaction Opt-in** - Explicit transaction control

### New Features

- Tab color customization
- Grid properties control
- Copy permissions and comments
- Request correlation IDs
- Output schema validation

## Migration Checklist

- [ ] Review breaking changes below
- [ ] Update action names in code
- [ ] Test with `?version=v2` parameter
- [ ] Update error handling for new format
- [ ] Deploy to staging environment
- [ ] Monitor for issues
- [ ] Deploy to production
- [ ] Remove v1 fallback code

## Step 1: Action Name Changes

### Core Actions

| V1 Action | V2 Action | Migration |
|-----------|-----------|-----------|
| `copy_to` | `copy_sheet_to` | Rename action |
| `hide_sheet` | `update_sheet` | Add `hidden: true` |
| `show_sheet` | `update_sheet` | Add `hidden: false` |
| `rename_sheet` | `update_sheet` | Rename `newName` to `title` |

#### Example: Hide Sheet

**Before (V1):**
```typescript
await sheets.callTool('sheets_core', {
  action: 'hide_sheet',
  spreadsheetId: '...',
  sheetId: 0
});
```

**After (V2):**
```typescript
await sheets.callTool('sheets_core', {
  action: 'update_sheet',
  spreadsheetId: '...',
  sheetId: 0,
  hidden: true
});
```

#### Example: Rename Sheet

**Before (V1):**
```typescript
await sheets.callTool('sheets_core', {
  action: 'rename_sheet',
  spreadsheetId: '...',
  sheetId: 0,
  newName: 'Q1 Report'
});
```

**After (V2):**
```typescript
await sheets.callTool('sheets_core', {
  action: 'update_sheet',
  spreadsheetId: '...',
  sheetId: 0,
  title: 'Q1 Report'
});
```

#### Example: Copy Sheet

**Before (V1):**
```typescript
await sheets.callTool('sheets_core', {
  action: 'copy_to',
  sourceSpreadsheetId: '...',
  sourceSheetId: 0,
  destinationSpreadsheetId: '...'
});
```

**After (V2):**
```typescript
await sheets.callTool('sheets_core', {
  action: 'copy_sheet_to',
  sourceSpreadsheetId: '...',
  sourceSheetId: 0,
  destinationSpreadsheetId: '...',
  // V2 enhancements (optional)
  copyPermissions: true,
  copyComments: true,
  newTitle: 'Copied Sheet'
});
```

### Deprecated Aliases Removed

V1 supported these aliases (removed in V2):

| Alias | Standard Action |
|-------|----------------|
| `get_cell` | `read_range` |
| `set_cell` | `write_range` |
| `get_range` | `read_range` |
| `set_range` | `write_range` |

**Migration:**
```typescript
// Before (V1 aliases)
action: 'get_cell'
action: 'set_cell'

// After (V2)
action: 'read_range'
action: 'write_range'
```

## Step 2: Stricter Validation

### spreadsheetId Format

**V2 Requirement:** Must contain only alphanumeric characters, hyphens, and underscores.

**Before (V1) - Lenient:**
```typescript
spreadsheetId: "my spreadsheet 123"  // ✅ Accepted
spreadsheetId: "sheet#1"             // ✅ Accepted
```

**After (V2) - Strict:**
```typescript
spreadsheetId: "my-spreadsheet-123"  // ✅ Valid
spreadsheetId: "sheet_1"             // ✅ Valid
spreadsheetId: "my spreadsheet 123"  // ❌ Invalid (spaces)
spreadsheetId: "sheet#1"             // ❌ Invalid (special chars)
```

**Fix:**
```typescript
// Sanitize spreadsheetId
function sanitizeSpreadsheetId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

const spreadsheetId = sanitizeSpreadsheetId(userInput);
```

### Required Fields

**V2 requires `action` field** in all requests (no defaults).

**Before (V1):**
```typescript
{
  spreadsheetId: '...'
  // action optional, defaults to 'read'
}
```

**After (V2):**
```typescript
{
  action: 'read_range',  // ✅ Required
  spreadsheetId: '...'
}
```

## Step 3: Error Response Format

### New Error Structure

**Before (V1):**
```json
{
  "error": "Sheet not found",
  "code": "NOT_FOUND"
}
```

**After (V2):**
```json
{
  "error": "Sheet not found",
  "errorCode": "NOT_FOUND",
  "suggestion": "Check sheet ID or name",
  "context": {
    "spreadsheetId": "...",
    "sheetId": 0
  },
  "requestId": "req_123"
}
```

### Update Error Handling

**Before (V1):**
```typescript
try {
  await sheets.callTool(...);
} catch (error) {
  console.error(error.code, error.error);
}
```

**After (V2):**
```typescript
try {
  await sheets.callTool(...);
} catch (error) {
  console.error(error.errorCode, error.error);
  if (error.suggestion) {
    console.log('Suggestion:', error.suggestion);
  }
  if (error.requestId) {
    console.log('Request ID:', error.requestId);
  }
}
```

## Step 4: Transaction Opt-in

### Explicit Transaction Control

**V2 requires explicit opt-in** for batch operations with transactions.

**Before (V1) - Automatic:**
```typescript
await sheets.callTool('sheets_transaction', {
  action: 'begin'
  // Transactions automatic
});
```

**After (V2) - Explicit:**
```typescript
await sheets.callTool('sheets_transaction', {
  action: 'begin',
  transaction: true  // ✅ Explicit opt-in
});
```

## Step 5: Testing Migration

### 1. Add Version Parameter

Test v2 without changing default:

```typescript
// Test individual endpoints
await sheets.callTool('sheets_core?version=v2', {
  action: 'update_sheet',
  sheetId: 0,
  hidden: true
});
```

### 2. Create Test Suite

```typescript
describe('V2 Migration', () => {
  it('should work with v2 action names', async () => {
    const result = await sheets.callTool('sheets_core?version=v2', {
      action: 'update_sheet',
      spreadsheetId: TEST_SPREADSHEET_ID,
      sheetId: 0,
      hidden: true
    });

    expect(result.success).toBe(true);
  });

  it('should handle v2 error format', async () => {
    try {
      await sheets.callTool('sheets_core?version=v2', {
        action: 'update_sheet',
        spreadsheetId: 'invalid',
        sheetId: 999
      });
    } catch (error) {
      expect(error.errorCode).toBe('NOT_FOUND');
      expect(error.suggestion).toBeDefined();
    }
  });
});
```

### 3. Monitor Deprecation Warnings

```typescript
// Log v1 deprecation warnings
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.getHeader('x-schema-version-deprecated')) {
      logger.warn('V1 usage detected', {
        path: req.path,
        warning: res.getHeader('x-schema-version-warning')
      });
    }
  });
  next();
});
```

## Step 6: Gradual Rollout

### Phase 1: Staging (Week 1)

```typescript
// Environment variable controls version
const version = process.env.SCHEMA_VERSION || 'v1';

await sheets.callTool(`sheets_core?version=${version}`, {
  ...
});
```

### Phase 2: Canary (Week 2)

```typescript
// Roll out to 10% of traffic
const useV2 = Math.random() < 0.1;
const version = useV2 ? 'v2' : 'v1';
```

### Phase 3: Full Rollout (Week 3)

```typescript
// Default to v2
const version = process.env.SCHEMA_VERSION || 'v2';
```

### Phase 4: Cleanup (Week 4)

```typescript
// Remove version parameter (uses latest)
await sheets.callTool('sheets_core', {
  action: 'update_sheet',
  ...
});
```

## Step 7: Use Automated Migration

### Bulk Migration Script

```typescript
import { schemaMigrator } from '@servalsheets/versioning';

// Load all v1 requests
const v1Requests = await loadRequests();

// Generate migration script
const script = schemaMigrator.generateMigrationScript(
  v1Requests,
  'v1',
  'v2'
);

console.log(script);

// Apply migrations
const results = v1Requests.map(req =>
  schemaMigrator.migrateRequestV1ToV2(req)
);

// Check for errors
const errors = results.filter(r => !r.success);
if (errors.length > 0) {
  console.error('Migration failed:', errors);
  process.exit(1);
}

console.log('✅ All requests migrated successfully');
```

## Common Issues

### Issue 1: "Unknown action" Error

**Problem:** Using v1 action name with v2

**Solution:**
```typescript
// Before
action: 'hide_sheet'

// After
action: 'update_sheet',
hidden: true
```

### Issue 2: "Invalid spreadsheetId format" Error

**Problem:** spreadsheetId contains invalid characters

**Solution:**
```typescript
function sanitizeSpreadsheetId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}
```

### Issue 3: Missing "errorCode" Field

**Problem:** Error handling expects v2 format

**Solution:**
```typescript
// Check schema version in error handling
const errorCode = error.errorCode || error.code;  // Fallback to v1
```

### Issue 4: Batch Operations Failing

**Problem:** Missing explicit transaction opt-in

**Solution:**
```typescript
{
  action: 'begin',
  transaction: true  // Add this
}
```

## Performance Considerations

**V1 → V2 Translation Overhead:**
- **Automatic translation:** < 1ms per request
- **Output validation:** ~0.5ms per response
- **Negligible impact** on total request time

## Rollback Plan

If migration causes issues:

### 1. Immediate Rollback

```bash
# Set environment variable
export SCHEMA_VERSION=v1

# Or in code
const version = 'v1';  // Hard-code v1
```

### 2. Fix Issue

```typescript
// Debug with both versions
const v1Result = await callTool('?version=v1', ...);
const v2Result = await callTool('?version=v2', ...);

console.log('V1:', v1Result);
console.log('V2:', v2Result);
```

### 3. Re-deploy

```bash
# Test fix
npm test

# Deploy
npm run deploy
```

## Support

**Need help?**
- Review [Schema Versioning Guide](./SCHEMA_VERSIONING.md)
- Check [V2 example schemas](../../src/schemas-v2/)
- Open an issue on GitHub
- Contact support

## Timeline

| Date | Milestone |
|------|-----------|
| 2026-02-17 | V2 released (preview) |
| 2026-03-01 | V2 stable, V1 deprecated |
| 2026-06-01 | V1 warnings start |
| 2026-09-01 | V1 sunset (removed) |

**Start migration now** to avoid last-minute issues!

---

**Questions?** See [FAQ in versioning guide](./SCHEMA_VERSIONING.md#faq)
