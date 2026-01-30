# ServalSheets Analysis Optimization Plan

## Vision: The Ultimate MCP Server for Google Sheets

**Goal:** Transform ServalSheets into the most LLM-ergonomic, intelligent, and efficient MCP server for Google Sheets operations.

---

## Part 1: Current State Analysis

### Strengths (Keep & Enhance)

| Feature | Location | Assessment |
|---------|----------|------------|
| **Tiered Retrieval** | `src/analysis/tiered-retrieval.ts` | Excellent - 4-tier progressive fetching with caching |
| **Smart Routing** | `src/analysis/router.ts` | Good - Fast/AI/Streaming path selection |
| **MCP Sampling** | `src/mcp/sampling.ts` | Excellent - AI-powered analysis via client LLM |
| **MCP Elicitation** | `src/mcp/elicitation.ts` | Good - User input forms, wizard support |
| **Comprehensive Analysis** | `src/analysis/comprehensive.ts` | Good foundation - needs progressive enhancement |
| **Tool Coverage** | 21 tools, 272 actions | Comprehensive Google Sheets API coverage |
| **Task Support** | Background task execution | Good for long-running operations |

### Problems Identified

#### 1. Analysis Flow Issues
```
CURRENT:                           IDEAL:
┌─────────────────────┐            ┌─────────────────────┐
│ comprehensive()     │            │ scout() ~200ms      │
│ - Fetches everything│            │ - Metadata only     │
│ - Returns huge blob │            │ - Detect intent     │
│ - No guidance       │            └──────────┬──────────┘
└─────────────────────┘                       │
                                              ▼
                                   ┌─────────────────────┐
                                   │ plan() ~100ms       │
                                   │ - LLM decides focus │
                                   │ - Prioritize steps  │
                                   └──────────┬──────────┘
                                              │
                                              ▼
                                   ┌─────────────────────┐
                                   │ execute() streaming │
                                   │ - Progressive results│
                                   │ - nextActions always│
                                   └─────────────────────┘
```

#### 2. Response Structure Issues
- **No universal `nextActions`** - LLM doesn't know what to do next
- **Buried critical info** - Important findings lost in verbosity
- **No impact estimation** - Can't prioritize fixes
- **Inconsistent shapes** - Different actions return different structures

#### 3. Tool Organization Issues
- **21 tools is overwhelming** - LLM struggles with tool selection
- **No clear entry point** - Where should analysis start?
- **Missing workflow guidance** - Multi-step operations unclear

#### 4. Session/State Issues
- **Mostly stateless** - Re-analyzes unchanged data
- **No analysis memory** - Previous findings not retained
- **No incremental updates** - Full re-analysis every time

---

## Part 2: Design Principles

### 1. Scout First, Act Later
> Never fetch data you don't need. Always start with metadata. Let LLM decide what to explore.

### 2. Progressive Depth
```
Level 0: Existence   → "Does this spreadsheet exist?" (~50ms)
Level 1: Metadata    → "What sheets/columns exist?" (~200ms)
Level 2: Structure   → "What's the schema/types?" (~500ms)
Level 3: Sample      → "What does the data look like?" (~1-2s)
Level 4: Full        → "Give me everything" (~5-30s)
```

### 3. Action-Oriented Responses
> Every response MUST include `nextActions` with executable parameters.

### 4. Intelligent Defaults
> Auto-detect intent, smart sampling, skip irrelevant analyses, remember preferences.

### 5. Consistent Mental Model
> One primary entry point, clear escalation path, predictable behavior.

---

## Part 3: New Analysis Architecture

### 3.1 New Actions for `sheets_analyze`

```typescript
// Add to src/schemas/analyze.ts

// ===== PHASE 1: SCOUT & PLAN =====

const ScoutActionSchema = CommonFieldsSchema.extend({
  action: z.literal('scout').describe('Quick metadata scan - NO data fetched (~200ms)'),
  spreadsheetId: SpreadsheetIdSchema,
});

const PlanActionSchema = CommonFieldsSchema.extend({
  action: z.literal('plan').describe('Create AI-assisted analysis plan'),
  spreadsheetId: SpreadsheetIdSchema,
  scoutResult: z.record(z.unknown()).optional().describe('Result from scout action'),
  intent: z.enum([
    'optimize',    // Performance, formulas, structure
    'clean',       // Quality, duplicates, missing values
    'visualize',   // Patterns, chart recommendations
    'understand',  // Structure, relationships, summary
    'audit',       // Everything, comprehensive
    'auto',        // Detect intent from context
  ]).default('auto'),
  constraints: z.object({
    maxDuration: z.number().optional().describe('Max analysis time in ms'),
    maxApiCalls: z.number().optional().describe('Max Google API calls'),
    focusSheets: z.array(z.number()).optional().describe('Only analyze these sheets'),
    focusColumns: z.array(z.string()).optional().describe('Only analyze these columns'),
    skipAnalyses: z.array(z.string()).optional().describe('Skip these analysis types'),
  }).optional(),
});

const ExecutePlanActionSchema = CommonFieldsSchema.extend({
  action: z.literal('execute_plan').describe('Execute planned analysis steps'),
  spreadsheetId: SpreadsheetIdSchema,
  plan: z.object({
    steps: z.array(z.object({
      type: z.enum(['quality', 'formulas', 'patterns', 'performance', 'structure', 'visualizations']),
      priority: z.number().min(1).max(10),
      sheets: z.array(z.number()).optional(),
      options: z.record(z.unknown()).optional(),
    })),
  }),
  executeAll: z.boolean().optional().default(true).describe('Execute all steps (false = step by step)'),
});

// ===== PHASE 2: DRILL DOWN =====

const DrillDownActionSchema = CommonFieldsSchema.extend({
  action: z.literal('drill_down').describe('Deep dive into specific finding'),
  spreadsheetId: SpreadsheetIdSchema,
  target: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('issue'),
      issueId: z.string(),
      includeContext: z.boolean().optional().default(true),
    }),
    z.object({
      type: z.literal('sheet'),
      sheetId: z.number(),
      analyses: z.array(z.string()).optional(),
    }),
    z.object({
      type: z.literal('column'),
      sheetId: z.number(),
      column: z.string(),
      depth: z.enum(['stats', 'quality', 'patterns', 'all']).optional().default('all'),
    }),
    z.object({
      type: z.literal('formula'),
      cell: z.string(),
      includeDepGraph: z.boolean().optional().default(false),
    }),
    z.object({
      type: z.literal('anomaly'),
      anomalyId: z.string(),
      includeNeighbors: z.boolean().optional().default(true),
    }),
  ]),
  limit: z.number().optional().default(50),
});

// ===== PHASE 3: ACTION GENERATION =====

const GenerateActionsActionSchema = CommonFieldsSchema.extend({
  action: z.literal('generate_actions').describe('Create executable action plan from findings'),
  spreadsheetId: SpreadsheetIdSchema,
  findings: z.record(z.unknown()).optional().describe('Previous analysis findings'),
  intent: z.enum([
    'fix_critical',   // Only critical issues
    'fix_all',        // All fixable issues
    'optimize',       // Performance improvements
    'visualize',      // Create recommended charts
    'format',         // Apply formatting suggestions
  ]),
  preview: z.boolean().optional().default(true).describe('Preview mode (dry run)'),
  maxActions: z.number().optional().default(10),
  groupRelated: z.boolean().optional().default(true).describe('Group related actions'),
});
```

### 3.2 Universal Response Shape

```typescript
// Add to src/schemas/shared.ts

/**
 * Executable Action - Ready to call another tool
 */
export const ExecutableActionSchema = z.object({
  id: z.string().describe('Unique action ID'),
  priority: z.number().min(1).max(10).describe('1=highest'),

  // Execution details
  tool: z.string().describe('Tool name (e.g., sheets_fix)'),
  action: z.string().describe('Action name'),
  params: z.record(z.unknown()).describe('Complete params - ready to use'),

  // Human-readable
  title: z.string().max(50).describe('Short title'),
  description: z.string().max(200).describe('What this does'),

  // Impact assessment
  impact: z.object({
    metric: z.string().describe('What improves'),
    before: z.union([z.number(), z.string()]).optional(),
    after: z.union([z.number(), z.string()]).optional(),
    change: z.string().describe('e.g., "+15%", "fixes 23 issues"'),
  }).optional(),

  // Risk assessment
  risk: z.enum(['none', 'low', 'medium', 'high']),
  reversible: z.boolean(),
  requiresConfirmation: z.boolean(),

  // Grouping
  category: z.enum(['fix', 'optimize', 'visualize', 'format', 'structure', 'other']),
  relatedFindings: z.array(z.string()).optional(),
});

/**
 * Drill Down Option - Area that warrants deeper analysis
 */
export const DrillDownOptionSchema = z.object({
  target: z.string().describe('What to drill into'),
  type: z.enum(['issue', 'sheet', 'column', 'formula', 'anomaly', 'pattern']),
  reason: z.string().describe('Why this is interesting'),
  params: z.record(z.unknown()).describe('Params for drill_down action'),
});

/**
 * Next Actions - What should happen next
 * EVERY analysis response MUST include this
 */
export const NextActionsSchema = z.object({
  recommended: ExecutableActionSchema.nullable()
    .describe('Single best next action (null if nothing to do)'),
  alternatives: z.array(ExecutableActionSchema).max(5)
    .describe('Other good options'),
  drillDown: z.array(DrillDownOptionSchema).max(5).optional()
    .describe('Areas to explore deeper'),
  clarifications: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
    default: z.string().optional(),
  })).optional().describe('Questions for user'),
});

/**
 * Universal Response Wrapper
 * All analysis responses should use this shape
 */
export const AnalysisResponseWrapperSchema = z.object({
  success: z.literal(true),
  action: z.string(),

  // Quick summary (always present, <100 tokens)
  summary: z.object({
    headline: z.string().max(100).describe('One-line summary'),
    status: z.enum(['healthy', 'warning', 'critical']),
    keyMetrics: z.record(z.union([z.number(), z.string()])),
  }),

  // CRITICAL: What should happen next
  next: NextActionsSchema,

  // Session context for multi-step
  session: z.object({
    analysisId: z.string().describe('ID to reference this analysis'),
    canResume: z.boolean(),
    expiresAt: z.number().optional(),
  }).optional(),

  // Metadata
  _meta: z.object({
    duration: z.number(),
    apiCalls: z.number(),
    tier: z.number().min(1).max(4),
    cached: z.boolean(),
    truncated: z.boolean(),
  }).optional(),
});
```

### 3.3 Scout Response Structure

```typescript
interface ScoutResponse {
  success: true;
  action: 'scout';

  // Quick identification
  spreadsheet: {
    id: string;
    title: string;
    owner?: string;
    lastModified?: string;
  };

  // Sheet overview (NO data, just metadata)
  sheets: Array<{
    sheetId: number;
    title: string;
    rowCount: number;
    columnCount: number;
    estimatedCells: number;

    // Quick indicators (from first row only)
    columns: Array<{
      index: number;
      name: string;
      inferredType: 'number' | 'text' | 'date' | 'boolean' | 'mixed' | 'empty';
    }>;

    // Flags (cheap to detect)
    flags: {
      hasHeaders: boolean;
      hasFormulas: boolean;
      hasCharts: boolean;
      hasPivots: boolean;
      hasFilters: boolean;
      hasProtection: boolean;
      isEmpty: boolean;
      isLarge: boolean;  // >10K rows
    };
  }>;

  // Aggregate quick stats
  totals: {
    sheets: number;
    rows: number;
    columns: number;
    estimatedCells: number;
    namedRanges: number;
  };

  // Initial quality indicators (very rough, from metadata only)
  quickIndicators: {
    emptySheets: number;
    largeSheets: number;
    potentialIssues: string[];  // e.g., "Sheet2 has no data", "10+ sheets detected"
  };

  // CRITICAL: What analyses are suggested
  suggestedAnalyses: Array<{
    type: 'quality' | 'formulas' | 'patterns' | 'performance' | 'structure';
    priority: 'high' | 'medium' | 'low';
    reason: string;
    estimatedDuration: string;
  }>;

  // Auto-detected intent
  detectedIntent: {
    likely: 'optimize' | 'clean' | 'visualize' | 'understand' | 'audit';
    confidence: number;
    signals: string[];
  };

  // REQUIRED: Next actions
  next: NextActions;

  _meta: {
    duration: number;
    apiCalls: 1;  // Scout should be single API call
    tier: 1;
    cached: boolean;
  };
}
```

### 3.4 Plan Response Structure

```typescript
interface PlanResponse {
  success: true;
  action: 'plan';

  // The generated plan
  plan: {
    id: string;
    intent: string;

    steps: Array<{
      order: number;
      type: 'quality' | 'formulas' | 'patterns' | 'performance' | 'structure' | 'visualizations';
      target: {
        sheets?: number[];
        columns?: string[];
        range?: string;
      };
      priority: 'critical' | 'high' | 'medium' | 'low';
      estimatedDuration: string;
      reason: string;

      // What this step will produce
      outputs: string[];
    }>;

    // Plan metadata
    estimatedTotalDuration: string;
    estimatedApiCalls: number;
    confidenceScore: number;
  };

  // Human-readable rationale
  rationale: string;

  // What was skipped and why
  skipped: Array<{
    type: string;
    reason: string;
  }>;

  // REQUIRED: Next action is to execute the plan
  next: {
    recommended: {
      id: 'execute-plan',
      priority: 1,
      tool: 'sheets_analyze',
      action: 'execute_plan',
      params: {
        spreadsheetId: string;
        plan: { steps: [...] };
      },
      title: 'Execute Analysis Plan',
      description: `Run ${steps.length} analysis steps`,
      risk: 'none',
      reversible: true,
      requiresConfirmation: false,
      category: 'other',
    },
    alternatives: [
      // Modify plan options
      // Skip to specific step
      // Change intent
    ],
  };
}
```

---

## Part 4: Implementation Phases

### Phase 1: Foundation (Scout & Response Shape)
**Priority: CRITICAL | Effort: Medium | Impact: HIGH**

#### 1.1 Add `scout` action
- [ ] Create `src/analysis/scout.ts`
- [ ] Single API call for metadata
- [ ] Detect column types from header row
- [ ] Calculate quick indicators
- [ ] Generate suggested analyses
- [ ] Auto-detect intent

#### 1.2 Add `NextActions` to all responses
- [ ] Add `NextActionsSchema` to `shared.ts`
- [ ] Add `ExecutableActionSchema` to `shared.ts`
- [ ] Modify `comprehensive` response to include `next`
- [ ] Modify all `analyze_*` actions to include `next`

#### 1.3 Add universal response wrapper
- [ ] Create `AnalysisResponseWrapperSchema`
- [ ] Update handler to use wrapper
- [ ] Ensure `summary.headline` is always <100 chars

### Phase 2: Planning (Intent & Plan)
**Priority: HIGH | Effort: Medium | Impact: HIGH**

#### 2.1 Add `plan` action
- [ ] Create `src/analysis/planner.ts`
- [ ] Use MCP Sampling for intelligent planning
- [ ] Generate ordered steps based on scout results
- [ ] Estimate duration per step
- [ ] Support constraints (max time, focused sheets)

#### 2.2 Add intent detection
- [ ] Analyze scout results for signals
- [ ] Detect intent: optimize/clean/visualize/understand/audit
- [ ] Confidence scoring

#### 2.3 Modify `comprehensive` for intent
- [ ] Add `intent` parameter
- [ ] Add `depth` parameter (metadata/sample/full)
- [ ] Add `focus` parameter (sheets/columns/analyses)
- [ ] Respect constraints

### Phase 3: Drill Down
**Priority: MEDIUM | Effort: Medium | Impact: MEDIUM**

#### 3.1 Add `drill_down` action
- [ ] Target types: issue, sheet, column, formula, anomaly
- [ ] Include context around findings
- [ ] Support depth control

#### 3.2 Issue tracking
- [ ] Assign IDs to issues
- [ ] Store issue context for drill down
- [ ] Link related issues

### Phase 4: Action Generation
**Priority: HIGH | Effort: High | Impact: HIGH**

#### 4.1 Add `generate_actions` action
- [ ] Create `src/analysis/action-generator.ts`
- [ ] Convert findings to executable actions
- [ ] Calculate impact estimates
- [ ] Group related actions
- [ ] Preview mode (dry run)

#### 4.2 Impact estimation
- [ ] Before/after score prediction
- [ ] Risk assessment
- [ ] Execution order optimization

### Phase 5: Session & State
**Priority: MEDIUM | Effort: High | Impact: MEDIUM**

#### 5.1 Analysis session management
- [ ] Store scout results in session
- [ ] Store plan in session
- [ ] Store findings for drill down
- [ ] TTL management

#### 5.2 Incremental analysis
- [ ] Track what was analyzed
- [ ] Only re-analyze changed areas
- [ ] Delta reporting

### Phase 6: Tool Consolidation (Optional)
**Priority: LOW | Effort: High | Impact: MEDIUM**

#### 6.1 Smart router entry point
- [ ] Single `sheets` tool with intelligent routing
- [ ] Auto-detect intent from natural language
- [ ] Route to appropriate handler

---

## Part 5: File Changes Summary

### New Files to Create
```
src/analysis/scout.ts           # Scout implementation
src/analysis/planner.ts         # Plan generation with MCP Sampling
src/analysis/action-generator.ts # Convert findings to executable actions
src/analysis/intent-detector.ts  # Auto-detect user intent
```

### Files to Modify
```
src/schemas/analyze.ts          # Add new actions (scout, plan, execute_plan, drill_down, generate_actions)
src/schemas/shared.ts           # Add ExecutableAction, NextActions, DrillDownOption schemas
src/handlers/analyze.ts         # Implement new action handlers
src/analysis/comprehensive.ts   # Add intent/depth/focus support
src/analysis/router.ts          # Update routing for new actions
```

---

## Part 6: Success Metrics

### LLM Ergonomics
- [ ] Scout response <500 tokens
- [ ] Every response has clear `next.recommended`
- [ ] Action params are 100% ready to execute
- [ ] No ambiguity in tool selection

### Performance
- [ ] Scout: <300ms p95
- [ ] Plan: <500ms p95 (with caching)
- [ ] Comprehensive quick scan: <5s for <10 sheets
- [ ] Reduced redundant API calls by 50%

### Developer Experience
- [ ] Clear workflow documentation
- [ ] Example conversations in tests
- [ ] Consistent response shapes across all actions

---

## Part 7: Example Workflow

### Before (Current)
```
User: "Analyze my spreadsheet"
LLM: calls sheets_analyze:comprehensive
     → Gets 50KB response with everything
     → Struggles to prioritize
     → User asks "what should I fix?"
LLM: Re-reads response, manually extracts issues
     → Constructs fix call manually
```

### After (Optimized)
```
User: "Analyze my spreadsheet"
LLM: calls sheets_analyze:scout
     → Gets ~2KB response in 200ms
     → Sees: intent=clean, 3 suggested analyses
     → Sees: next.recommended = { plan with quality focus }
LLM: calls sheets_analyze:plan (intent=clean)
     → Gets analysis plan in 100ms
     → Sees: 2 steps, est. 3s total
     → Sees: next.recommended = { execute_plan }
LLM: calls sheets_analyze:execute_plan
     → Gets findings with issues
     → Sees: next.recommended = { fix 12 critical issues }
LLM: "Found 12 critical issues. Want me to fix them?"
User: "Yes"
LLM: calls sheets_fix (with exact params from next.recommended)
     → Done in single call
```

---

## Part 8: Quick Wins (Implement First)

### 1. Add `intent` to comprehensive (1 hour)
```typescript
// In ComprehensiveActionSchema
intent: z.enum(['quick', 'optimize', 'clean', 'visualize', 'understand', 'audit'])
  .optional().default('quick'),
```

### 2. Add `next` to comprehensive response (2 hours)
```typescript
// In comprehensive result
next: {
  recommended: issues.length > 0 ? {
    tool: 'sheets_fix',
    action: 'fix',
    params: { issues: issues.slice(0, 10) },
    // ...
  } : null,
  alternatives: [],
  drillDown: sheetsWithIssues.map(s => ({ ... })),
}
```

### 3. Add `scout` action (4 hours)
- Single API call
- Column type detection
- Quick indicators
- Suggested analyses

---

## Appendix: Response Token Optimization

### Current comprehensive response: ~5,000-50,000 tokens
### Target scout response: ~200-500 tokens
### Target plan response: ~300-800 tokens
### Target execute_plan step response: ~500-2,000 tokens

### Verbosity levels:
- `minimal`: Only summary + next (for chained operations)
- `standard`: Summary + key findings + next (default)
- `detailed`: Everything including raw data samples
