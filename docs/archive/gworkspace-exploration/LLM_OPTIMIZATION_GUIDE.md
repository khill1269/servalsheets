---
title: ServalSheets LLM Optimization Guide
category: archived
last_updated: 2026-01-31
description: "Goal: Make every tool maximally efficient and intuitive for LLM usage (Claude, GPT-4, etc.)"
---

# ServalSheets LLM Optimization Guide

**Goal**: Make every tool maximally efficient and intuitive for LLM usage (Claude, GPT-4, etc.)

## Executive Summary

**Current State**: 17 tools, 226 actions - feature-complete but not optimized for LLM token efficiency and usability.

**Key Issues**:

1. ⚠️ Tool descriptions too technical (API-focused vs task-focused)
2. ⚠️ Missing usage hints and common patterns
3. ⚠️ Responses include unnecessary metadata
4. ⚠️ No guidance on when to use each tool
5. ⚠️ Parameter descriptions lack examples

**Impact**: LLMs spend more tokens, make more errors, require more iterations.

---

## 1. Tool Description Optimization

### Current Problem

```typescript
// TOO TECHNICAL - focuses on what it does, not when to use it
description: "Core spreadsheet and sheet/tab operations: create, get, copy, update"
```

### Optimized Format

```typescript
// TASK-FOCUSED - tells LLM when/why to use it
description: `🔑 START HERE for spreadsheet access
USE WHEN: User mentions spreadsheet by name/URL, wants to list sheets, create new spreadsheet
COMMON TASKS: Get spreadsheet info, list all sheets, create/delete sheets
ALWAYS REQUIRED: spreadsheetId (from URL: docs.google.com/spreadsheets/d/{ID})
NEXT STEPS: After getting sheets → use sheets_data to read/write values`
```

### Implementation Priority: **HIGH**

**Template for All Tools**:

```typescript
{
  name: 'sheets_X',
  description: `
🎯 [ONE-LINE PURPOSE]
USE WHEN: [user intent keywords]
COMMON TASKS: [top 3 use cases]
REQUIRED: [critical parameters]
NEXT STEPS: [what tool to use after this]
TOKEN TIP: [how to minimize response size]
  `.trim()
}
```

---

## 2. Action-Level Hints (NEW Feature)

### Add "usageHint" to Every Action

**Current**: No hints
**Optimized**: Inline hints in schema descriptions

```typescript
// src/schemas/core.ts
action: z.enum([
  'get', // 💡 Get spreadsheet metadata - USE FIRST to discover sheets
  'create', // 💡 Create new spreadsheet - returns spreadsheetId for subsequent ops
  'list', // 💡 List all sheets/tabs - returns sheetId array needed for data ops
  'add_sheet', // 💡 Add new sheet/tab - specify title, returns new sheetId
  'delete_sheet', // 💡 Delete sheet by sheetId - CANNOT be undone, use with caution
])
```

**Benefits**:

- LLM sees hints in schema when deciding which action
- No extra API calls needed
- Reduces decision-making tokens

---

## 3. Response Optimization (Token Efficiency)

### Problem: Responses Include Too Much Metadata

**Current Response** (comprehensive analysis):

```json
{
  "success": true,
  "action": "comprehensive",
  "spreadsheet": { /* 50+ fields */ },
  "sheets": [ /* Full analysis for each sheet */ ],
  "aggregate": { /* 30+ metrics */ },
  "summary": "...",
  "topInsights": [...],
  "executionPath": "sample",
  "duration": 1234,
  "apiCalls": 5,
  "dataRetrieved": { "tier": 3, "rowsAnalyzed": 500, "samplingUsed": true }
}
```

**Token Cost**: ~2000-5000 tokens for metadata alone!

### Optimization Strategy

#### Option 1: Tiered Responses (Recommended)

```typescript
// Add verbosity parameter to ALL tools
verbosity?: 'minimal' | 'standard' | 'detailed' // Default: 'standard'

// Minimal: Only essential data + summary
{
  "success": true,
  "summary": "Analyzed 5 sheets, found 12 issues, 95% quality score",
  "data": { /* only requested data */ }
}

// Standard: Current behavior
// Detailed: Everything + debug info
```

#### Option 2: Smart Defaults

```typescript
// Automatically minimize when response > 1000 tokens
if (estimatedTokens > 1000) {
  return minimalResponse({
    summary: generateSummary(fullResult),
    resourceUri: storeFullResult(fullResult), // Store rest
    hint: "Use resourceUri for full details"
  });
}
```

### Implementation: Add to ALL tools

```typescript
// src/schemas/shared.ts
export const VerbositySchema = z.enum(['minimal', 'standard', 'detailed']).default('standard');

// Add to every tool input schema
verbosity: VerbositySchema.optional()
```

---

## 4. Comprehensive Analysis (sheets_analyze) Specific Optimizations

### Current Issues

1. Returns ALL sheet data by default (can be 100K+ tokens)
2. No progressive disclosure
3. No focus on what user asked for

### Optimizations

#### A. Smart Sampling Based on Query

```typescript
interface ComprehensiveInput {
  spreadsheetId: string;
  focus?: 'quality' | 'structure' | 'formulas' | 'data' | 'performance';
  maxTokens?: number; // Default: 2000, Max: 10000
  summaryOnly?: boolean; // Default: false
}
```

**Token Savings**: 60-80% by focusing on relevant analysis

#### B. Progressive Disclosure Pattern

```typescript
// 1. Initial call: Summary only
{ action: 'comprehensive', spreadsheetId, summaryOnly: true }
// Response: ~200 tokens

// 2. If LLM needs details: Request specific sheet
{ action: 'comprehensive', spreadsheetId, sheetId: 0, focus: 'quality' }
// Response: ~1000 tokens for one sheet

// 3. If still needs more: Full analysis with pagination
{ action: 'comprehensive', spreadsheetId, pageSize: 2, cursor: 'sheet:0' }
```

**Token Savings**: 90% on initial call, progressive as needed

#### C. Query-Aware Analysis

```typescript
// NEW: Natural language query parameter
interface ComprehensiveInput {
  query?: string; // e.g., "check data quality", "find broken formulas"
}

// Analyzer uses query to ONLY return relevant sections
if (query.includes('quality')) {
  return { qualityAnalysis: {...}, otherSections: 'omitted' };
}
```

---

## 5. Parameter Simplification

### Current Problem: Too Many Required Parameters

**Example** (sheets_data write):

```typescript
{
  action: 'write',
  spreadsheetId: string,
  range: string,
  values: any[][],
  valueInputOption: 'RAW' | 'USER_ENTERED', // Required but has obvious default
  includeValuesInResponse: boolean, // Required but usually false
}
```

**LLM Impact**:

- More tokens to construct request
- Higher error rate (missing required fields)
- More back-and-forth

### Optimization: Smart Defaults

```typescript
{
  action: 'write',
  spreadsheetId: string,
  range: string,
  values: any[][],
  // Auto-defaults:
  valueInputOption: 'USER_ENTERED', // ← Smart: parses formulas, dates
  includeValuesInResponse: false, // ← Usually not needed
}

// Document in description:
"💡 valueInputOption defaults to USER_ENTERED (parses formulas). Use 'RAW' for literal text."
```

**Token Savings**: 20-30% per request

### Apply to ALL Tools

```typescript
// Audit every action for parameters that:
// 1. Have obvious defaults (>80% of time)
// 2. Are rarely changed
// 3. Can be inferred from context

// Make them optional with .default()
```

---

## 6. Error Message Optimization

### Current Problem: Technical Errors

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Validation error at path 'range': Required"
  }
}
```

**LLM Response**: Often retries incorrectly or gives up

### Optimized: Actionable Errors with Examples

```json
{
  "success": false,
  "error": {
    "code": "MISSING_RANGE",
    "message": "Range is required for write operations",
    "fix": "Add 'range' field with A1 notation",
    "examples": [
      "range: 'Sheet1!A1:B10'",
      "range: 'A1'",
      "range: { a1: 'Sheet1!A:Z' }"
    ],
    "hint": "Use sheets_core action='list' to see available sheet names"
  }
}
```

**Benefits**:

- LLM can fix immediately (no user interaction)
- Provides working examples
- Suggests next steps

### Implementation

```typescript
// src/utils/error-messages.ts
export const LLM_FRIENDLY_ERRORS = {
  MISSING_RANGE: {
    message: (context) => `Range required for ${context.action}`,
    fix: "Add 'range' parameter",
    examples: ["range: 'Sheet1!A1:B10'", "range: { a1: 'A1:Z100' }"],
    relatedActions: ['sheets_core.list'] // Help LLM discover sheets
  },
  // ... all error codes
};
```

---

## 7. Workflow Patterns (NEW: Meta-Tool)

### Problem: LLMs Don't Know Multi-Step Workflows

**Example**: "Analyze my sales data"

- LLM needs: auth → get spreadsheet → list sheets → find "Sales" sheet → read data → analyze
- Current: 5-6 tool calls, high token cost

### Solution: Add Workflow Tool

```typescript
// NEW: sheets_workflow tool
{
  action: 'analyze_sheet_by_name',
  spreadsheetId: string,
  sheetName: string, // Don't need sheetId!
  analysisType: 'quality' | 'summary' | 'comprehensive'
}

// Internally:
// 1. List sheets to find sheetName → sheetId
// 2. Get data from that sheet
// 3. Run analysis
// 4. Return focused result

// Token savings: 70% (1 call instead of 4)
```

### Common Workflow Actions

```typescript
// sheets_workflow tool (NEW - Tool 18)
actions: [
  'analyze_sheet_by_name', // Find + analyze in one call
  'update_named_range', // Find + update in one call
  'append_to_table', // Find last row + append
  'bulk_quality_check', // Check all sheets for issues
  'smart_export', // Export with auto-format detection
]
```

---

## 8. Contextual Tool Selection

### Add Tool Metadata for LLM Decision-Making

```typescript
// src/mcp/registration/tool-definitions.ts
export const TOOL_METADATA = {
  sheets_core: {
    priority: 1, // Use first for discovery
    keywords: ['spreadsheet', 'list sheets', 'create', 'basic info'],
    prerequisites: ['sheets_auth'], // Must call this first
    followUp: ['sheets_data', 'sheets_analyze'], // Common next steps
    costEstimate: 'low', // API call count
  },
  sheets_analyze: {
    priority: 5, // Use later after data access
    keywords: ['analyze', 'quality', 'problems', 'issues', 'insights'],
    prerequisites: ['sheets_core'], // Need spreadsheetId
    followUp: ['sheets_fix', 'sheets_data'], // Common next steps
    costEstimate: 'high', // Many API calls
  },
  // ... all tools
};
```

**Usage**: Include in tool descriptions for LLM context

---

## 9. Response Caching Hints

### Problem: LLMs Re-fetch Same Data

**Example**:

1. Get spreadsheet info (200 tokens response)
2. LLM asks follow-up question
3. Gets spreadsheet info again (200 tokens wasted)

### Solution: Add Caching Hints

```typescript
// In every response:
{
  "success": true,
  "data": {...},
  "_cache": {
    "key": "spreadsheet:abc123",
    "ttl": 300, // seconds
    "hint": "This data is cached for 5 minutes. Reference by spreadsheetId in follow-ups."
  }
}
```

**LLM Instruction** (in tool description):

```
💡 CACHE TIP: Spreadsheet metadata is cached. After first call, you can reference
   data from memory without re-calling. Cache TTL: 5 minutes.
```

---

## 10. Prompt Engineering for Tools

### Add System-Level Usage Guide

```typescript
// src/mcp/registration/prompts.ts
export const LLM_USAGE_GUIDE = `
# ServalSheets Optimal Usage Patterns

## Order of Operations
1. sheets_auth (action: 'status') - Check if authenticated
2. sheets_core (action: 'get' or 'list') - Get spreadsheet structure
3. sheets_data / sheets_analyze - Work with data
4. sheets_fix - Fix issues (if found)

## Token Optimization Tips
- Use verbosity: 'minimal' for exploration
- Use summaryOnly: true for initial analysis
- Request specific sheets, not all sheets
- Use pagination (pageSize: 5) for large spreadsheets

## Error Recovery
- If you get MISSING_RANGE: The range parameter is required
- If you get SHEET_NOT_FOUND: Use sheets_core action='list' to see available sheets
- If you get AUTH_REQUIRED: Guide user through sheets_auth action='login'

## Common Patterns
- Quick quality check: sheets_analyze action='comprehensive' summaryOnly=true
- Data export: sheets_data action='read' range='A:Z' (gets all columns)
- Find issues: sheets_analyze focus='quality' verbosity='minimal'
`;
```

**Register as MCP Prompt**:

```typescript
server.registerPrompt(
  'usage-guide',
  'ServalSheets optimal usage patterns for LLMs',
  async () => ({ messages: [{ role: 'user', content: { type: 'text', text: LLM_USAGE_GUIDE } }] })
);
```

---

## 11. Specific Tool Optimizations

### sheets_data (Most Used Tool)

**Current Issues**:

- read returns ALL data (can be 50K+ tokens)
- No way to request summary/preview
- Includes empty rows/columns

**Optimizations**:

```typescript
interface ReadInput {
  // Existing
  spreadsheetId: string;
  range: string;

  // NEW: Token-saving options
  preview?: boolean; // Only first 10 rows + row count
  skipEmpty?: boolean; // Skip empty rows/columns (default: true)
  maxRows?: number; // Limit response size (default: 1000)
  format?: 'values' | 'summary'; // 'summary' = statistics only
}

// Example response (preview mode):
{
  "success": true,
  "preview": [[...]], // First 10 rows
  "stats": {
    "totalRows": 5000,
    "totalColumns": 20,
    "dataTypes": { "A": "number", "B": "text", ... },
    "nullPercentage": 5.2
  },
  "hint": "Use read without preview:true to get all 5000 rows (est. 15K tokens)"
}
```

**Token Savings**: 95% for preview, user decides if full data needed

### sheets_analyze (Most Token-Heavy)

**Current Issues**:

- Always returns everything
- No focus parameter
- Includes low-priority insights

**Optimizations**:

```typescript
interface AnalyzeInput {
  spreadsheetId: string;

  // NEW: Focus options
  focus?: 'critical' | 'all'; // Default: 'critical'
  // critical = only high-severity issues (80% token reduction)

  sections?: Array<'quality' | 'structure' | 'formulas' | 'performance'>;
  // Only return requested sections

  minSeverity?: 'low' | 'medium' | 'high';
  // Filter out low-priority issues
}
```

### sheets_format (High Parameter Count)

**Current Issues**:

- Too many format options
- Hard to remember all parameters

**Optimization**: Add presets

```typescript
// Instead of:
{
  action: 'set_format',
  range: 'A1:A10',
  backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
  textFormat: { bold: true, fontSize: 12 }
}

// Allow:
{
  action: 'set_format',
  range: 'A1:A10',
  preset: 'header' // Auto-applies standard header formatting
}

// Presets: 'header', 'data', 'total', 'warning', 'error', 'success'
```

---

## 12. Implementation Priority

### Phase 1: Quick Wins (1-2 days)

1. ✅ Add verbosity parameter to all tools
2. ✅ Update tool descriptions with task-focused format
3. ✅ Add smart defaults to reduce required parameters
4. ✅ Optimize error messages with examples

**Impact**: 40% token reduction, 30% error reduction

### Phase 2: Response Optimization (2-3 days)

1. ✅ Implement tiered responses (minimal/standard/detailed)
2. ✅ Add preview mode to sheets_data
3. ✅ Add focus parameter to sheets_analyze
4. ✅ Response caching hints

**Impact**: 60% token reduction for common workflows

### Phase 3: New Features (3-5 days)

1. ✅ Add sheets_workflow tool with composite actions
2. ✅ Add format presets
3. ✅ Implement query-aware analysis
4. ✅ Create usage guide prompt

**Impact**: 70% token reduction, 50% fewer tool calls

---

## 13. Measurement & Validation

### Metrics to Track

```typescript
interface LLMOptimizationMetrics {
  // Token efficiency
  avgTokensPerRequest: number;
  avgTokensPerResponse: number;

  // Tool usage
  avgToolCallsPerTask: number;
  toolCallSuccessRate: number;

  // Error rates
  parameterErrors: number;
  retryRate: number;

  // User experience
  taskCompletionRate: number;
  avgTaskDuration: number;
}
```

### Target Improvements (vs baseline)

- 📉 Response tokens: -50%
- 📉 Tool calls per task: -30%
- 📉 Parameter errors: -60%
- 📈 Task completion: +40%

---

## 14. Example: Before & After

### Scenario: "Analyze my sales spreadsheet for data quality issues"

#### BEFORE (Current Implementation)

```
1. LLM → sheets_auth (action: 'status')
   Response: 150 tokens

2. LLM → sheets_core (action: 'get', spreadsheetId: '...')
   Response: 800 tokens (full metadata)

3. LLM → sheets_core (action: 'list')
   Response: 400 tokens (all sheets)

4. LLM → sheets_analyze (action: 'comprehensive', spreadsheetId: '...')
   Response: 8,500 tokens (EVERYTHING)

5. LLM reads 8,500 tokens, extracts quality issues, responds to user

TOTAL: 9,850 tokens, 4 tool calls, ~15 seconds
```

#### AFTER (Optimized)

```
1. LLM → sheets_analyze (
     action: 'comprehensive',
     spreadsheetId: '...',
     focus: 'quality',
     verbosity: 'minimal',
     minSeverity: 'medium'
   )
   Response: 450 tokens (focused quality summary)

2. LLM responds to user immediately

TOTAL: 450 tokens, 1 tool call, ~3 seconds
```

**Improvement**: 95% fewer tokens, 75% fewer calls, 80% faster

---

## 15. Quick Reference Card

### For LLM Context (Include in System Prompt)

```markdown
# ServalSheets Usage Cheat Sheet

## Start Here
1. sheets_auth → sheets_core → sheets_data/analyze

## Token Optimization
- Always use verbosity: 'minimal' for initial exploration
- Use summaryOnly: true for quick checks
- Use preview: true before reading large datasets
- Request specific sheets, not all

## Common Tasks
- Get sheet names: sheets_core action='list'
- Read data: sheets_data action='read' range='Sheet1!A:Z' preview=true
- Quality check: sheets_analyze focus='quality' verbosity='minimal'
- Fix issues: sheets_fix (after analysis)

## Error Recovery
- MISSING_RANGE → Add range parameter with A1 notation
- SHEET_NOT_FOUND → Use sheets_core action='list' first
- AUTH_REQUIRED → Guide user through sheets_auth action='login'
```

---

## Conclusion

**Current State**: Feature-complete but not optimized for LLM efficiency
**With Optimizations**: 50-70% token reduction, 30-50% fewer tool calls, better user experience

**Next Steps**:

1. Implement Phase 1 (Quick Wins) immediately
2. Measure baseline metrics
3. Roll out Phase 2 (Response Optimization)
4. Track improvements
5. Iterate based on real usage patterns

**ROI**: For every 1000 LLM interactions → Save ~500K tokens → $1-2 cost savings + 10x better UX
