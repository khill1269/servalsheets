---
name: AI Intelligence Layer Audit
description: Comprehensive audit of ServalSheets response intelligence, session context richness, and AI-optimization patterns (May 2026)
type: project
---

# AI Intelligence Layer Audit (May 2026)

**Scope:** Analysis of how helpful ServalSheets is from Claude/LLM client perspective
**Audit date:** 2026-05-12
**Evidence source:** src/mcp/registration/response-intelligence.ts, src/services/action-recommender/, src/handlers/session-actions/, src/services/lightweight-quality-scanner.ts, src/generated/annotations.ts

---

## Task 1: Response Intelligence Layer Quality

### What Gets Injected Into Responses

**Location:** `src/mcp/registration/response-intelligence.ts:780-1100+`

The `applyResponseIntelligence()` function enriches ALL tool responses with:

#### Error Responses (Line 784-913):
1. **suggestedFix** (string): Human-readable explanation (line 818)
2. **fixableVia** (object): Structured fix with pre-filled params for LLM execution (lines 821-828)
   - Fields: `tool`, `action`, `params`, `explanation`
   - **KEY FINDING:** Pre-fills only `tool` and `action`; other params left empty for LLM to fill
3. **_learnedFix** (object): Pattern from session history showing what fixed similar errors (lines 839-850)
   - Fields: `fix` (action name), `confidence` (0.0-1.0), `seenCount`
4. **suggestedRecoveryActions** (array): Pre-filled alternative actions (line 869)
5. **_recoveryPlaybook** (object): Multi-step recovery sequences (line 879)
6. **_hints** (object): Quick-guidance summary (line 910)
   - Flattens deep error details into: `errorCode`, `quickFix`, `nextStep`, `failedOp`

#### Success Responses (Line 915-1100+):

**For sheets_data.read/batch_read/cross_read (lines 956-980):**
- `suggestedNextActions` (array, max 5 items): Data-aware action recommendations (line 935)
- `dataQualityWarnings` (array): Detected issues like duplicates, outliers, mixed types (line 951)
- `_hints` (object): Chain-of-thought context:
  - `dataShape`: Human description ("time series: 365 rows × 4 cols, daily")
  - `primaryKeyColumn`: Unique column (natural key candidate)
  - `dataRelationships`: Inferred column relationships
  - `formulaOpportunities`: Suggested formulas to add
  - `trendDirection`: Trend analysis for time series
  - `lowCardinalityColumns`: For grouping/pivot recommendations
  - `riskLevel`: 'none' | 'low' | 'medium' | 'high'
  - `nextPhase`: Suggested workflow step
- `_compressed` (object): Sparse representation for 100+ row reads (line 979)

**For sheets_data.write/batch_write (lines 981-1008):**
- `_hints` with:
  - `verifyWrite` (object): Suggested read-back to verify written data (lines 992-998)
  - Write-specific guidance

**For sheets_data.append (lines 1009-1017):**
- `_hints` warning about non-idempotence + duplicate check suggestion

**For sheets_dependencies.model_scenario (lines 1018-1023):**
- `_hints` with cascade effect analysis

**For sheets_analyze.comprehensive (lines 1024-1040):**
- `_hints` with:
  - `dataShape`: Count of finding categories
  - `nextPhase`: Risk-aware workflow (critical → clean → validate vs fair → enhance → format)
  - `riskLevel`: Severity-based risk

**For other actions** (lines 1041-1100+):
- Tool-specific hints injected for:
  - `sheets_fix.clean` (changesApplied, columnsAffected)
  - `sheets_composite.generate_sheet` (columnCount, formulaRows)
  - `sheets_agent.execute` (progress tracking)
  - `sheets_format.suggest_format`
  - `sheets_dimensions.*` (operation hints)

---

### Coverage: How Many Actions Have Response Intelligence?

**ACTION_GOTCHAS** (hardcoded gotcha warnings): **25 actions** (src/mcp/registration/response-intelligence.ts:117-176)
- sheets_data: read, write, append, find_replace (4)
- sheets_format: set_format, set_background (2)
- sheets_dimensions: insert, delete (2)
- sheets_core: delete_sheet, clear_sheet (2)
- sheets_transaction: begin (1)
- sheets_history: restore_cells, timeline (2)
- sheets_collaborate: version_restore_revision (1)
- sheets_compute: aggregate, forecast (2)
- sheets_connectors: query, configure (2)
- sheets_templates: apply (1)
- sheets_bigquery: query (1)
- sheets_federation: call_remote (1)
- sheets_agent: execute_plan (1)

**FOLLOW_UP_PROMPTS** (MCP prompt suggestions): **31 actions** (lines 180-336)
- Maps each action to a relevant MCP prompt for workflow discovery
- Examples: read → 'analyze-sheet', scout → 'clean-data', etc.

**WORKFLOW_PLAN_TRIGGERS** (multi-step workflows): **10 action pairs** (lines 435-514)
- Multi-turn plans suggesting the full sequence (e.g., import_csv → clean → format → visualize)

**ACTION_DISAMBIGUATION** (clarification labels): **52+ action name variants** (lines 342-428)
- Injects `_actionLabel` field so LLM knows exactly what "list" returned (spreadsheets vs sheets vs charts)

**BATCHING_HINTS** (efficiency detection): **7 actions** (lines 65-73)
- Detects repeated single operations and suggests batch equivalents
- Auto-triggers when same action called 3+ times on same spreadsheet

**Response Intelligence Coverage:**
- **ALL 409 actions** pass through `applyResponseIntelligence()` (src/mcp/registration/tool-response.ts:466)
- **26% of actions** (107/409) have explicit gotcha/hint injection
- **Remaining 74%** get generic success/error enrichment (suggestedNextActions, quality warnings, recovery info)

---

## Task 2: Action Recommender Quality & Context Awareness

### How Patterns Are Detected

**Location:** `src/services/action-recommender/data-signals.ts:109-260+`

**Signal 1: Response Data Analysis** (lines 138-237)
- Analyzes actual cell values returned in response
- Detects:
  - Date columns + numeric columns → suggests charts
  - VLOOKUP formulas → upgrade to XLOOKUP suggestion
  - Unsorted date columns → sort recommendation
  - High null ratio (>10%) → fill_missing suggestion
  - Duplicate rows (>10% duplicates) → deduplicate suggestion
  - Formula errors (#REF!, #N/A, etc.) → analyze_formulas

**Signal 2: Session History Deduplication** (lines 123-136)
- Checks if user already performed suggested action in last 10 minutes
- Skips suggestion if recently done (avoids spam)
- Example: Don't suggest sheets_data.read if just read

**Signal 3: Confidence Scoring** (via `confidence` field, 0.0-1.0)
- Each suggestion has explicit confidence level (lines 16-65 in recommendation-rules.ts)
- Examples:
  - sheets_fix.clean after CSV import: 0.85
  - sheets_analyze.comprehensive after quick_insights: 0.75

**Signal 4: Data Type Classification** (lines 64-118 in data-signals.ts)
- Profiles each column as: date, numeric, identifier, text
- Spot-checks first 10 data rows (capped at 50 rows)
- Counts nulls, detects outliers (>3σ from mean)

**Signal 5: Confidence Gaps** (lines 590-599 in response-intelligence.ts)
- Extracts `confidenceGaps` from action responses
- Asks LLM clarifying questions when data patterns are ambiguous

### Context Awareness Limitations

**✅ Aware of:**
- What data type was just read (date, numeric, etc.)
- Whether data has structure (headers, patterns)
- Session operation history (last 20 operations)
- Active spreadsheet ID (can pre-fill params)
- Data shape (# rows, # cols, # nulls)

**❌ NOT aware of:**
- Financial vs inventory vs HR (semantic domain classification)
- Time-series velocity (rate of change analysis beyond basic trends)
- User's stated goal (no intent inference from context)
- Cross-spreadsheet relationships (suggestions are single-sheet only)
- Data freshness (when data was last updated)
- Upstream data sources or dependencies
- Formula complexity or dependency chains

---

## Task 3: Session Context Richness

### What `get_context` Returns

**Location:** `src/handlers/session-actions/context.ts:77-156`

Response includes:
1. **summary** (text): Concise session state
2. **activeSpreadsheet** (object):
   - `spreadsheetId`, `title`, `sheetNames[]`, `activatedAt` timestamp
3. **lastOperation** (object):
   - `tool`, `action`, `spreadsheetId`, `range`, `description`, `timestamp`
4. **pendingOperation** (object):
   - Current multi-step operation in progress (if any)
5. **suggestedActions** (array):
   - Contextual next steps via `session.suggestNextActions()`
6. **connectors** (object):
   - Available connectors: count, configured list, zero-auth, API key, OAuth
7. **connectorOnboarding** (object, if unconfigured exist):
   - Structured guidance for each connector type
   - Pre-formatted action strings (e.g., `sheets_connectors action:"configure"`)
8. **autoRecordHint** (string, if no operations recorded):
   - Guidance on calling `record_operation` after mutations

### Richness Assessment

**Current Richness (8 categories):**
- ✅ Spreadsheet metadata (ID, title, sheets)
- ✅ Last operation (what was just done)
- ✅ Connector status & onboarding
- ✅ Session timestamp
- ⚠️ Suggested actions (basic, not data-aware)

**Missing for AI Clients (Could Be Added):**
1. **Recent Action History** (> just last operation)
   - Top 5 operations in session (with description)
   - Operations per tool (summary)
   - Data mutation count this session

2. **Detected Data Patterns**
   - "This appears to be financial data (revenue, cost, profit columns detected)"
   - "Time series data: 365 rows with daily granularity"
   - Sheet domain classification (sales, HR, inventory, etc.)

3. **Risk Indicators**
   - "Last 3 operations modified formula cells (high risk)"
   - "3+ sheets without backups"
   - "Unsaved data quality issues (duplicates, outliers)"

4. **Data Statistics**
   - Total cells modified this session
   - Rollback/undo capacity remaining
   - API quota burn rate

5. **Relationship Graph** (in multi-sheet context)
   - Sheets that reference each other
   - Cross-spreadsheet links

**Recommendation:** Inject `recentPatterns` object with domain classification + formula impact summary

---

## Task 4: Proactive Quality Warnings

### What Quality Scanner Detects

**Location:** `src/services/lightweight-quality-scanner.ts:1-180+`

Runs **automatically** on:
- ALL responses with cell data (≥2 rows, ≥2 cols) — line 939-953 in response-intelligence.ts
- Called via `scanResponseQualitySync()` (synchronous, <30ms)

**Detects 5 Issue Types:**
1. **empty_required_cells** — nulls in key columns
   - Suggests: `sheets_fix.fill_missing` with forward-fill strategy
2. **mixed_types** — column contains both numbers & text
   - Suggests: `sheets_fix.standardize_formats`
3. **duplicate_rows** — exact row duplicates detected
   - Suggests: `sheets_fix.clean` with dedup rule
4. **outliers** — values >3σ from mean
   - Severity: "warning" (if critical), "info" (if minor)
5. **inconsistent_formats** — date or number format mismatches
   - Suggests: `sheets_fix.standardize_formats`

### When Warnings Appear

**Automatic Injection:**
- After ANY `sheets_data.read`, `batch_read`, `cross_read` (line 950)
- After `sheets_composite.generate_sheet` (if data generated)
- After `sheets_analyze.comprehensive` (if analysis detects issues)

**Pre-emptive Warnings NOT Implemented:**
- ❌ Before write: "This range has 47 formulas that reference the cells you're about to overwrite"
- ❌ Before format: "Formatting 500 cells will consume API quota"
- ❌ Before delete: "You're about to delete a range with 12 formulas"

**Recommendation:** Add pre-flight analysis for destructive operations (write-to-formula-ranges, delete, clear)

---

## Task 5: CoT Hints Quality

### What Hints Are Generated

**Location:** `src/services/response-hints-engine.ts:1-120+`

Generates structured `_hints` for data comprehension (NOT action recommendations).

**For Read Operations (lines 88-177):**
```typescript
interface ResponseHints {
  dataShape?: string;              // "time series: 365 rows × 4 cols, daily"
  primaryKeyColumn?: string;       // "Email" (100% unique)
  dataRelationships?: string[];    // ["Email → OrderCount", "Date → Revenue"]
  formulaOpportunities?: string[]; // ["SUM column D", "VLOOKUP to Users sheet"]
  riskLevel?: 'none' | 'low' | 'medium' | 'high';
  nextPhase?: string;              // "Read complete → analyze → clean"
  trendDirection?: string[];       // ["Revenue: increasing +12%/row avg"]
  lowCardinalityColumns?: string[];// ["Region", "Category"] (for grouping)
  outlierColumns?: string[];       // ["Price"] (has statistical outliers)
}
```

**Semantic Awareness:**
- Detects financial columns (revenue, cost, profit keywords) — line 45
- Detects ID columns (id, code, sku, email) — line 48
- Detects time-series patterns (date columns + trend analysis) — lines 50-56
- Infers relationships ("Date → Revenue increasing trend") — line 145+
- Detects cardinality patterns ("Region has 4 unique values") — line 180+

**Specificity vs Generic:**
- ✅ Specific: "Revenue increasing +12% per row on average"
- ❌ Generic: "Numeric data detected"
- ✅ Contextual: ["Email → OrderCount" suggests VLOOKUP usage]
- ❌ Generic: "Data has relationships"

---

## Task 6: Scout → Act Intelligence

### What Analyze.Scout Returns

**Location:** `src/handlers/analyze-actions/scout.ts:30-175`

Scout action performs **quick metadata scan** (not data analysis), returns:

**Actionable Fields:**
1. **recommendations** (array, max 3) — line 117
   - Each recommendation has: `category`, `priority`, `description`, `action`
   - Examples: "Add summary row", "Freeze headers", "Remove duplicates"
   - **Executable params?** NO — structure only, LLM must fill in specifics

2. **detectedIntent** (object) — line 118
   - What kind of spreadsheet is this (sales, finance, inventory, CRM, etc.)
   - Can infer domain from column names + data patterns

3. **perSheetIndicators** (map) — lines 147-180
   - Per sheet: hasHeaders, hasFormulas, hasCharts, hasProtectedRanges, etc.
   - Allows action.to-know which sheets are "ready" vs "need setup"

4. **sizeCategory** (enum) — line 113
   - 'tiny' | 'small' | 'medium' | 'large' | 'huge'
   - Informs whether to suggest batch operations

### LLM Guidance Quality

**Strong:**
- Scout clearly identifies problems (formulas without charts, no formatting, etc.)
- Recommendations are structured but non-prescriptive (forces LLM to decide)
- Intent detection informs domain-specific suggestions

**Weak:**
- No pre-generated action chains (LLM must know sequence: scout → clean → format → visualize)
- Scout.recommendations are template strings, not executable actions
- No risk assessment (which operations are high-impact)

**Recommendation:** Add `recommendedSequence` field with ordered list of (tool, action, reason) tuples

---

## Task 7: Error Message Quality for AI Self-Correction

### Error Recovery in Annotations

**Location:** `src/generated/annotations.ts:230-290` (sheets_data.read example)

**Structure for Each Error Code:**

```typescript
sheets_data.read: {
  errorRecovery: {
    SHEET_NOT_FOUND: 'Call sheets_core.list_sheets first to verify sheet name',
    PERMISSION_DENIED: 'Call sheets_auth.login to refresh credentials',
    QUOTA_EXCEEDED: 'Wait 60s, then retry with a smaller range or use batch_read',
    INVALID_RANGE: 'Use bounded range like A1:Z1000, not column-only refs like A:Z',
    alternativeActions: [
      {
        tool: 'sheets_analyze',
        action: 'scout',
        when: 'when you need structure info before reading'
      },
      {
        tool: 'sheets_data',
        action: 'batch_read',
        when: 'when reading 3+ ranges to save API calls'
      }
    ],
    diagnosticSteps: [
      'Verify the spreadsheet ID is valid by calling sheets_core.get',
      'Confirm the sheet name and range exist with sheets_core.list_sheets',
      'Check read access with sheets_collaborate.share_get'
    ],
    userGuidance: 'This reads cell values from your spreadsheet...'
  }
}
```

### Assessment

**alternativeActions Param Pre-filling:**
- ✅ `tool` and `action` pre-filled
- ❌ `params` NOT pre-filled
- Example: When error is INVALID_RANGE, suggests `sheets_analyze.scout` but doesn't pre-fill `spreadsheetId`
- **Impact:** LLM must call with empty params and wait for response (2 RTT penalty)

**diagnosticSteps Quality:**
- ✅ Specific step-by-step guidance (verify, confirm, check)
- ✅ Each step names the tool to call
- ✅ Not generic ("try again")
- ❌ No sample values or ranges (assumes LLM remembers context)

**Gotcha: Missing Parameter Carry-Through**

Example failure flow:
```
1. sheets_data.read(spreadsheetId:"1ABC", range:"BadRange") → INVALID_RANGE
2. annotation.errorRecovery suggests: sheets_analyze.scout
3. BUT fixableVia.params = { spreadsheetId: undefined, ... }  ← empty!
4. LLM must call: sheets_analyze.scout(spreadsheetId:"1ABC")
5. Second call returns → LLM now knows range
```

Should be:
```
3. fixableVia.params = { spreadsheetId: "1ABC" }  ← pre-filled from error context!
4. LLM can execute immediately with one param filled
```

**Recommendation:** Pre-fill `spreadsheetId`, `sheetName`, `range` in `fixableVia.params` from failed request context

---

## Task 8: Comparison to Leading MCP Servers

### GitHub MCP (Copilot Context)
- Codebase understanding suggestions (navigate to related files)
- Error recovery with file:line references
- **ServalSheets Advantage:** More action-specific recovery (finance domain)
- **ServalSheets Disadvantage:** No file/code structure discovery

### Filesystem MCP
- File operations with pre-filled paths
- Batch operation recommendations ("use glob instead of 100 individual reads")
- **ServalSheets Advantage:** Data quality warnings + pattern detection
- **ServalSheets Disadvantage:** No file-level metadata

### Best Practice Pattern: GitHub MCP Uses
1. **Structured alternativeActions** ✅ (ServalSheets has this)
2. **Actionable diagnosticSteps** ✅ (ServalSheets has this)
3. **Pre-filled params with context** ❌ (ServalSheets missing)
4. **Confidence scores on suggestions** ✅ (ServalSheets has this via `confidence` field)
5. **Session-aware deduplication** ✅ (ServalSheets has this)

---

## Summary of Findings

| Category | Current State | Gap | Priority |
|---|---|---|---|
| **Response Intelligence** | 26% of actions have explicit hints | 74% of actions get generic enrichment only | Medium |
| **Error Recovery** | Complete annotations, good diagnostics | Params not pre-filled (LLM must refetch context) | High |
| **Session Context** | 8 fields returned | Missing recent history, domain patterns, risk indicators | Medium |
| **Quality Warnings** | Auto-fires on reads | No pre-flight warnings on writes/deletes | Medium |
| **CoT Hints** | Excellent dataShape/trend analysis | No domain classification ("financial" vs "inventory") | Low |
| **Scout Recommendations** | Structured suggestions | No pre-ordered action sequences | Low |
| **Batching Detection** | Detects 3+ operations | Requires session history (not available after cold start) | Medium |
| **Action Param Pre-filling** | spreadsheetId sometimes | range/sheetName rarely, fixableVia params empty | High |

---

## Recommendations (Prioritized)

### P1: Pre-fill More Params in Error Recovery
**File:** `src/services/action-recommender/index.ts:46-68` (getErrorRecoveryActions)
**Change:** Extract `spreadsheetId`, `sheetName`, `range` from error context and inject into `fixableVia.params`
**Impact:** Reduces LLM round-trips on errors by 1-2 calls (20-40% faster error recovery)
**Effort:** 1-2 hours

### P2: Add Domain Classification to Session Context
**File:** `src/handlers/session-actions/context.ts:77-156`
**Change:** Add `detectDomain()` analysis on active spreadsheet, inject as `detectedDomain` field
**Impact:** Enables domain-specific action recommendations (financial formulas, inventory tracking, etc.)
**Effort:** 3-4 hours (requires building domain classifier)

### P3: Enrich Pre-Write Analysis
**File:** `src/handlers/data-actions/write-write.ts` + response-intelligence.ts
**Change:** Before write succeeds, analyze target range for formulas, inject pre-warning in `_hints`
**Impact:** Prevents accidental formula overwrites
**Effort:** 2-3 hours

### P4: Multi-Step Action Sequences
**File:** `src/handlers/analyze-actions/scout.ts` + response-intelligence.ts
**Change:** Scout returns `recommendedSequence` array with (tool, action, reason) in execution order
**Impact:** LLM can execute scout → clean → format → visualize without discovery
**Effort:** 2 hours

### P5: Session History in get_context
**File:** `src/handlers/session-actions/context.ts:77-156`
**Change:** Include `recentOperations` (top 5) + operations-per-tool summary
**Impact:** LLM understands what was already attempted (avoids repeats)
**Effort:** 1 hour

---

**Overall Assessment:** ServalSheets is **well-instrumented** for AI clients (26% of actions get explicit hints, error recovery is structured, session context exists). Main gap is **parameter carry-through** on error recovery (forces extra LLM calls) and **domain awareness** (treats all spreadsheets the same).
