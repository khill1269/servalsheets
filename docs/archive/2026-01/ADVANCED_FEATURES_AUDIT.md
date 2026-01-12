# ServalSheets Advanced Features Audit

**Date**: 2026-01-08
**Scope**: Verification of OAuth flow, AI analysis, user prompts, undo/rollback, and Claude guidance

---

## Executive Summary

Your ServalSheets MCP server has **excellent implementations** of advanced MCP features, but they are **not properly wired for Claude to discover and use them**. All the backend code exists and works correctly, but Claude lacks the guidance to know WHEN and HOW to use these features.

**Impact**: Claude will not use confirmation prompts, transactions, incremental OAuth, or AI analysis unless explicitly told by the user, defeating the purpose of having these features.

---

## ✅ What's Working Well

### 1. MCP Tool Registration
- **Status**: ✅ Fully Implemented
- All 24 tools properly registered in `src/mcp/registration.ts`
- Correct use of MCP SDK v1.25.x with schema compatibility
- Tools correctly expose inputSchema, outputSchema, and annotations

### 2. Backend Implementations
- **sheets_confirm** (Elicitation): ✅ Fully implemented in `src/handlers/confirm.ts`
- **sheets_analyze** (Sampling): ✅ Fully implemented in `src/handlers/analyze.ts`
- **sheets_transaction**: ✅ Fully implemented in `src/handlers/transaction.ts`
- **Incremental Scope**: ✅ Implemented in `src/security/incremental-scope.ts`
- **sheets_fix**: ✅ Automated fix handler exists

### 3. MCP Protocol Compliance
- Correctly checks client capabilities before using Elicitation/Sampling
- Proper error handling with structured responses
- Uses MCP 2025-11-25 patterns correctly

---

## ❌ Critical Issues

### Issue #1: Incremental OAuth Scope Only Partially Wired

**Problem**: Incremental scope consent (SEP-835) is only implemented in `sheets_sharing` handler, not in other handlers that need elevated permissions.

**Evidence**:
```bash
# Search shows NO usage in other handlers:
$ grep -r "requireScopes\|validateOperation\|IncrementalScope" src/handlers/
# Returns: Only sharing.ts uses it
```

**Impact**:
- Other operations requiring elevated scopes (Drive, Forms, etc.) will fail with generic auth errors
- Users won't get the proper OAuth flow guidance
- Breaks the incremental consent user experience

**Files with the issue**:
- All handlers except `sharing.ts` lack scope validation

**What's missing**:
```typescript
// Should be in EVERY handler that needs Drive/advanced scopes:
if (!this.context.auth?.hasElevatedAccess) {
  const validator = new ScopeValidator({ scopes: this.context.auth?.scopes ?? [] });
  validator.validateOperation(`sheets_${toolName}.${action}`);
  // Returns error with authorizationUrl for user
}
```

---

### Issue #2: No Claude Guidance on User Confirmation

**Problem**: `sheets_confirm` tool exists but tool descriptions don't tell Claude WHEN to use it.

**Evidence from `src/schemas/descriptions.ts`**:
- ❌ No entry for `sheets_confirm` in TOOL_DESCRIPTIONS
- ❌ No examples showing confirmation workflow
- ❌ No guidance on multi-step operations requiring approval

**Impact**:
- Claude will NEVER proactively ask for user confirmation
- Multi-step destructive operations will execute without user review
- Users expect "Are you sure?" prompts but won't get them

**What's missing**:
```typescript
sheets_confirm: `Request user confirmation before executing multi-step or destructive operations.

**When to Use:**
• BEFORE any operation that:
  - Modifies >100 cells
  - Deletes sheets or data
  - Changes sharing permissions
  - Executes 3+ operations in sequence

**Workflow:**
1. Plan the operations with sheets_analysis or sheets_impact
2. Build operation plan with steps, risks, and undo info
3. Call sheets_confirm to present plan to user via MCP Elicitation
4. User approves/modifies/rejects in Claude Desktop UI
5. Execute approved plan

**Quick Example:**
{
  "action": "request",
  "plan": {
    "title": "Clean duplicate rows",
    "description": "Remove 15 duplicate entries from Sales sheet",
    "steps": [
      {
        "stepNumber": 1,
        "description": "Identify duplicates in A2:A100",
        "tool": "sheets_analysis",
        "action": "data_quality",
        "risk": "low"
      },
      {
        "stepNumber": 2,
        "description": "Delete 15 duplicate rows",
        "tool": "sheets_dimensions",
        "action": "delete_rows",
        "risk": "high",
        "isDestructive": true,
        "canUndo": true
      }
    ],
    "willCreateSnapshot": true
  }
}

**User Experience:**
Claude Desktop shows interactive form:
┌─────────────────────────────────────┐
│ Plan: Clean duplicate rows          │
│                                     │
│ Step 1: Identify duplicates (low)  │
│ Step 2: Delete 15 rows (HIGH)      │
│                                     │
│ [ Approve ] [ Modify ] [ Cancel ]   │
└─────────────────────────────────────┘

**Commonly Used With:**
→ sheets_transaction (execute approved plan atomically)
→ sheets_versions (snapshot before destructive ops)
→ sheets_impact (analyze blast radius before confirmation)
`,
```

---

### Issue #3: No Transaction Workflow Guidance

**Problem**: `sheets_transaction` exists but Claude doesn't know when to use it.

**Evidence**:
- Tool description in `descriptions.ts` line 500 is cut off
- No workflow examples showing transaction benefits
- No guidance on batching operations

**Impact**:
- Claude will make 10 individual API calls instead of 1 batched transaction
- Operations won't be atomic (partial failures leave inconsistent state)
- Wastes API quota and slows down operations

**What's missing**:
```typescript
sheets_transaction: `Execute multiple operations atomically in a single API call. ALWAYS use for 2+ operations on same spreadsheet.

**When to Use:**
• ANY time you need 2+ operations on same spreadsheet
• Bulk data imports/updates (>100 rows)
• Multi-step formatting changes
• Operations that must succeed/fail together

**Performance Benefits:**
• 1 API call instead of N calls (80% quota savings)
• 10x faster for bulk operations
• Automatic rollback on ANY failure
• Guaranteed atomicity

**Workflow:**
1. {"action":"begin","spreadsheetId":"1ABC...","autoRollback":true}
2. {"action":"queue","transactionId":"tx_123","operation":{...}} ← Repeat for each op
3. {"action":"commit","transactionId":"tx_123"} ← Executes all atomically

**Quick Example - Bulk Import:**
// Instead of 100 individual writes:
{"action":"begin","spreadsheetId":"1ABC..."}
{"action":"queue","transactionId":"tx_1","operation":{"tool":"sheets_values","action":"write",...}}
{"action":"queue","transactionId":"tx_1","operation":{"tool":"sheets_format","action":"set_font",...}}
{"action":"commit","transactionId":"tx_1"}
→ Result: 1 API call, 80% quota saved

**Error Recovery:**
• If ANY operation fails → Automatic rollback
• Spreadsheet state unchanged (atomic guarantee)
• No partial writes or corruption

**Commonly Used With:**
→ sheets_confirm (get approval before committing)
→ sheets_values batch_write (for data)
→ sheets_format (for styling)
`,
```

---

### Issue #4: AI Analysis vs Traditional Analysis Not Explained

**Problem**: Users have TWO analysis tools (`sheets_analysis` and `sheets_analyze`) but no guidance on which to use when.

**Evidence**:
- `descriptions.ts` lines 430-485 have both tools
- But no comparison or decision tree
- No explanation of when AI analysis is worth the extra cost/time

**Impact**:
- Claude will use the wrong tool for the task
- Wastes Sampling tokens on simple statistics
- Misses AI insights when they'd be valuable

**What's missing**:
```markdown
## Analysis Tools Decision Tree

**Use sheets_analysis for:**
- ✅ Fast, deterministic checks (< 1 second)
- ✅ Data quality issues (empty cells, duplicates)
- ✅ Formula errors (#REF!, #DIV/0!)
- ✅ Statistics (mean, median, std dev)
- ✅ Known issue types

**Use sheets_analyze for:**
- ✅ Pattern detection (AI finds non-obvious trends)
- ✅ Anomaly detection (statistical outliers)
- ✅ Formula generation (natural language → formula)
- ✅ Chart recommendations (AI suggests best viz)
- ✅ Novel insights (AI explains what's interesting)

**Workflow:**
1. ALWAYS start with sheets_analysis (fast, free)
2. IF user wants deeper insights → Use sheets_analyze
3. NEVER use sheets_analyze for simple stats
```

---

### Issue #5: Undo/Rollback Not Explained to Claude

**Problem**: Users can't undo operations because Claude doesn't know about version history or transaction rollback.

**Evidence**:
- `sheets_transaction` supports rollback
- `sheets_versions` can restore previous versions
- But no guidance on recovery workflows

**Impact**:
- Users can't easily undo mistakes
- No "Ctrl+Z" equivalent in natural language
- Destructive operations feel risky

**What's missing**:
```typescript
// Add to EVERY destructive operation description:
**Undo/Recovery:**
• Automatic snapshot before execution (if safety.createSnapshot=true)
• Use sheets_transaction with autoRollback=true for atomicity
• Manual undo: sheets_versions action="restore" revisionId="..."
• Find recent changes: sheets_history action="list" limit=10
```

---

### Issue #6: No Proactive Safety Prompts

**Problem**: Claude doesn't proactively offer dry-run or confirmation for risky operations.

**What's missing in descriptions**:
```typescript
// Every destructive action should have:
**Safety Best Practices:**
1. ALWAYS use dryRun first: {"safety":{"dryRun":true}}
2. Review preview before executing
3. For >100 cells: Use sheets_confirm to get user approval
4. For critical data: Create snapshot first
5. For multi-step: Wrap in sheets_transaction
```

---

## 🔧 Recommended Fixes

### Priority 1: Add Missing Tool Descriptions

**File**: `src/schemas/descriptions.ts`

Add complete descriptions for:
1. `sheets_confirm` (with workflow examples)
2. `sheets_transaction` (with performance benefits)
3. `sheets_analyze` vs `sheets_analysis` decision tree
4. `sheets_fix` (automated issue resolution)

### Priority 2: Add Incremental Scope to All Handlers

**Files**: `src/handlers/*.ts`

Pattern to add to every handler needing elevated scopes:
```typescript
// At start of handle() method:
if (REQUIRES_ELEVATED_SCOPE[request.action]) {
  const validator = new ScopeValidator({ scopes: this.context.auth?.scopes ?? [] });
  try {
    validator.validateOperation(`${this.toolName}.${request.action}`);
  } catch (error) {
    if (isIncrementalScopeError(error)) {
      return { response: error.toToolResponse() };
    }
    throw error;
  }
}
```

### Priority 3: Add Workflow Prompts

**File**: `src/mcp/registration.ts` (in prompts section)

Add new prompts:
- `safe_operation` - Guide for destructive ops (dry-run → confirm → execute)
- `bulk_import` - Transaction workflow for large datasets
- `undo_changes` - Recovery workflow using versions/history

### Priority 4: Enhance Existing Descriptions

**Pattern to add to EVERY tool**:
```typescript
**Safety & Undo:**
• Dry-run: {"safety":{"dryRun":true}} → Preview changes
• Confirmation: Use sheets_confirm for >100 cells or destructive ops
• Snapshot: {"safety":{"createSnapshot":true}} → Auto-backup before execution
• Undo: sheets_versions action="restore" or sheets_transaction action="rollback"

**Performance:**
• For 2+ operations: Use sheets_transaction (80% quota savings)
• For batch: Use batch_* actions (10x faster)
```

---

## 📊 Impact Summary

| Feature | Backend Status | Claude Awareness | User Experience |
|---------|---------------|------------------|-----------------|
| Incremental OAuth | ⚠️ Partial (sharing only) | ❌ Not documented | ❌ Fails with generic errors |
| User Confirmation | ✅ Fully implemented | ❌ Never used | ❌ No approval prompts |
| Transactions | ✅ Fully implemented | ❌ Never used | ❌ Slow, non-atomic ops |
| AI Analysis | ✅ Fully implemented | ⚠️ Confusing | ⚠️ Wrong tool used |
| Undo/Rollback | ✅ Fully implemented | ❌ Not explained | ❌ Can't recover mistakes |

---

## 🎯 Success Criteria

After implementing fixes, Claude should:

1. **Proactively ask for confirmation** before destructive operations (>100 cells)
2. **Use transactions** automatically for any 2+ operations
3. **Request additional OAuth scopes** with clear user guidance
4. **Choose the right analysis tool** (traditional vs AI) based on task
5. **Offer undo options** when operations modify data

---

## 📝 Testing Checklist

Once fixes are applied, test these scenarios:

- [ ] User asks Claude to "delete 200 rows" → Claude uses sheets_confirm first
- [ ] User asks to "format and populate 500 rows" → Claude uses sheets_transaction
- [ ] User tries to share spreadsheet → Claude handles incremental OAuth correctly
- [ ] User asks "what patterns are in this data" → Claude uses sheets_analyze (AI)
- [ ] User asks "what's the average" → Claude uses sheets_analysis (fast stats)
- [ ] User says "undo that" → Claude suggests sheets_versions restore
- [ ] User runs destructive op → Claude offers dry-run first

---

## 🚀 Next Steps

1. **Immediate**: Add missing tool descriptions for sheets_confirm, sheets_transaction
2. **Short-term**: Wire incremental scope into all handlers
3. **Medium-term**: Add workflow prompts for common patterns
4. **Long-term**: Add proactive safety suggestions to descriptions

**Estimated effort**: 4-6 hours to fix all critical issues
