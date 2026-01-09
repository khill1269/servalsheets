# Critical Bugs Found in Testing - 2026-01-07

## Summary
Found 4 critical bugs during systematic testing that need immediate fixes.

---

## 🔴 BUG #1: Drive API Handlers Missing Parameter Inference

### Problem
sheets_comments, sheets_sharing, and sheets_versions handlers do NOT call `inferRequestParameters()`, unlike all other handlers.

### Evidence
```bash
# All other handlers call inferRequestParameters:
src/handlers/cells.ts:39:      const req = this.inferRequestParameters(input.request) as CellsAction;
src/handlers/values.ts:105:    const inferredRequest = this.inferRequestParameters(request) as ValuesAction;
src/handlers/format.ts:39:     const inferredRequest = this.inferRequestParameters(request) as FormatAction;

# Drive API handlers DON'T:
grep -l "inferRequestParameters" src/handlers/sharing.ts src/handlers/versions.ts src/handlers/comments.ts
# Returns: (empty - none of them use it!)
```

### Impact
**HIGH** - These tools cannot infer spreadsheetId from context, making them harder to use conversationally.

### Error Symptoms
- sheets_comments: "Spreadsheet not found: unknown"
- sheets_versions: "Spreadsheet not found: unknown"
- Both fail when spreadsheetId is not explicitly provided

### Root Cause
The three Drive API handlers were implemented without parameter inference support (Phase 1, Task 1.4).

### Fix Required
Add parameter inference to all three handlers:

**1. sheets_comments.ts** - Add to handle() method:
```typescript
async handle(input: SheetsCommentsInput): Promise<SheetsCommentsOutput> {
  if (!this.driveApi) { /* ... */ }

  // ADD THIS:
  // Phase 1, Task 1.4: Infer missing parameters from context
  const inferredRequest = this.inferRequestParameters(input.request) as CommentsAction;

  try {
    const req = inferredRequest; // Use inferred instead of input.request
    let response: CommentsResponse;
    switch (req.action) {
      // ...
    }
  }
}
```

**2. sheets_sharing.ts** - Same pattern:
```typescript
async handle(input: SheetsSharingInput): Promise<SheetsSharingOutput> {
  if (!this.driveApi) { /* ... */ }
  if (!this.context.auth?.hasElevatedAccess) { /* ... */ }

  // ADD THIS:
  // Phase 1, Task 1.4: Infer missing parameters from context
  const inferredRequest = this.inferRequestParameters(input.request) as SharingAction;

  // Audit log: Elevated scope operation
  const req = inferredRequest; // Use inferred
  logger.info('Elevated scope operation', {
    operation: `sharing:${req.action}`,
    // ...
  });

  try {
    let response: SharingResponse;
    switch (req.action) {
      // ...
    }
  }
}
```

**3. sheets_versions.ts** - Same pattern:
```typescript
async handle(input: SheetsVersionsInput): Promise<SheetsVersionsOutput> {
  if (!this.driveApi) { /* ... */ }

  // ADD THIS:
  // Phase 1, Task 1.4: Infer missing parameters from context
  const inferredRequest = this.inferRequestParameters(input.request) as VersionsAction;

  try {
    const req = inferredRequest; // Use inferred
    let response: VersionsResponse;
    switch (req.action) {
      // ...
    }
  }
}
```

### Files to Modify
1. `src/handlers/comments.ts` - Line 28 (after Drive API check)
2. `src/handlers/sharing.ts` - Line 93 (after auth checks)
3. `src/handlers/versions.ts` - Line 28 (after Drive API check)

---

## 🔴 BUG #2: sheets_sharing Output Validation Error

### Problem
MCP SDK rejects sheets_sharing responses with "Invalid discriminator value. Expected true | false"

### Evidence
```
MCP error -32602: Output validation error
Path: ["response", "success"]
Message: "Invalid discriminator value. Expected true | false"
```

### Impact
**CRITICAL** - sheets_sharing tool completely non-functional

### Status
Debug logging added in previous session. Need to:
1. Restart Claude Desktop
2. Test sheets_sharing
3. Check debug logs for root cause

### Debug Logs Added
- `src/handlers/base.ts:154-165` - Logs response structure
- `src/mcp/registration.ts:405-422` - Logs before MCP validation

---

## 🔴 BUG #3: sheets_analysis statistics Still Failing

### Problem
Even though we fixed line 609, the statistics action still returns validation error.

### Evidence
```typescript
// Line 609 in src/handlers/analysis.ts - CORRECT:
name: headers[colIdx] != null ? String(headers[colIdx]) : undefined,
```

Fix is applied, but test still fails.

### Root Cause
**Claude Desktop hasn't reloaded the rebuilt MCP server!**

### Fix Required
User needs to **restart Claude Desktop**:
```bash
killall "Claude"
open -a "Claude"
```

### Status
✅ Code fix applied, waiting for user to restart Claude Desktop

---

## 🔴 BUG #4: sheets_versions export_version Returns 404

### Problem
The `export_version` action returns 404 error

### Test Case
```json
{
  "action": "export_version",
  "spreadsheetId": "...",
  "revisionId": "..."
}
```

### Error
```
404: File not found
```

### Root Cause
**UNKNOWN** - Need to investigate:
1. Is revisionId format correct?
2. Does Drive API revisions.get() support export?
3. Is the endpoint URL correct?

### Investigation Required
Check Drive API documentation for revisions export functionality.

---

## 📊 Impact Summary

| Bug | Tool | Impact | Status | Fix Complexity |
|-----|------|--------|--------|----------------|
| #1 | sheets_comments | High | Ready to fix | Low (3 lines × 3 files) |
| #1 | sheets_sharing | High | Ready to fix | Low (3 lines) |
| #1 | sheets_versions | High | Ready to fix | Low (3 lines) |
| #2 | sheets_sharing | Critical | Investigating | Unknown |
| #3 | sheets_analysis | Medium | Fixed - restart needed | None |
| #4 | sheets_versions | Medium | Needs investigation | Unknown |

---

## 🔧 Fix Priority

### Immediate (Can fix now)
1. ✅ **Bug #1**: Add parameter inference to 3 Drive API handlers
2. ⏳ **Bug #3**: User restart Claude Desktop

### Requires Investigation
3. 🔍 **Bug #2**: Analyze debug logs after restart
4. 🔍 **Bug #4**: Research Drive API revisions export

---

## 📝 Fix Plan

### Step 1: Fix Parameter Inference (Bug #1)
```bash
# 1. Modify handlers/comments.ts
# 2. Modify handlers/sharing.ts
# 3. Modify handlers/versions.ts
# 4. npm run build
# 5. Restart Claude Desktop
# 6. Test all three tools
```

### Step 2: Verify statistics Fix (Bug #3)
```bash
# 1. Restart Claude Desktop (picks up rebuilt version)
# 2. Test sheets_analysis statistics action
# 3. Confirm fix works
```

### Step 3: Debug sheets_sharing (Bug #2)
```bash
# 1. Test sheets_sharing after restart
# 2. Check logs: grep '\[DEBUG\]' ~/Library/Logs/Claude/mcp-server-servalsheets.log
# 3. Analyze debug output
# 4. Apply targeted fix
```

### Step 4: Investigate export_version (Bug #4)
```bash
# 1. Check Drive API docs for revisions export
# 2. Test with correct parameters
# 3. Fix if needed
```

---

## 🎯 Expected Outcome

After fixes:
- **21/24 tools working** → **24/24 tools working** (100%)
- **All parameter inference working**
- **All Drive API tools functional**
- **Production ready**

---

## 📚 Related Files

### Code Files to Modify
1. `src/handlers/comments.ts:28` - Add parameter inference
2. `src/handlers/sharing.ts:93` - Add parameter inference
3. `src/handlers/versions.ts:28` - Add parameter inference

### Debug Logs
- `~/Library/Logs/Claude/mcp-server-servalsheets.log`

### Documentation
- `FIXES_APPLIED_2026-01-07.md` - Previous fixes
- `LOG_ANALYSIS_2026-01-07.md` - Log analysis
- `SYSTEMATIC_TEST_ISSUES_2026-01-07.md` - Original issues

---

**Created**: 2026-01-07 20:45 PST
**Priority**: CRITICAL
**Action Required**: Apply Bug #1 fix immediately
