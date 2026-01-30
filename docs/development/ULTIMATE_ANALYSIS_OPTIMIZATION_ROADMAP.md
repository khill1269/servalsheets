# Ultimate Analysis Tool Optimization Roadmap

> **Created:** January 12, 2026
> **Purpose:** Comprehensive optimization plan for sheets_analyze to become the most advanced spreadsheet analysis tool
> **Status:** Phase 1 in progress, Phase 2 planned

---

## Executive Summary

The goal is to build an analysis tool that doesn't just detect issues—it **understands spreadsheets like a senior consultant** and provides actionable insights across ALL categories. This document outlines:

1. **Current State Assessment** - What we have today
2. **Gap Analysis** - Missing categories and capabilities  
3. **43-Category Framework** - Comprehensive extraction taxonomy
4. **Implementation Roadmap** - Phased execution plan
5. **Success Metrics** - How we measure "ultimate"

---

## 1. Current State Assessment

### Handler Implementation Status

| Action | Status | Path | Notes |
|--------|--------|------|-------|
| `analyze_data` | ✅ Complete | Fast/AI/Streaming | 3 execution paths |
| `suggest_visualization` | ✅ Complete | AI | Chart/pivot recommendations |
| `generate_formula` | ✅ Complete | AI | Natural language → formula |
| `detect_patterns` | ✅ Complete | Fast/AI | Implemented 113 lines |
| `analyze_structure` | ✅ Complete | Fast | Implemented 70 lines |
| `analyze_quality` | ✅ Complete | Fast | Implemented 113 lines |
| `analyze_performance` | ✅ Complete | Fast | Implemented 149 lines |
| `create_recommended_chart` | ✅ Complete | Fast + Elicitation | Implemented 184 lines |
| `create_recommended_pivot` | ✅ Complete | Fast + Elicitation | Implemented 184 lines |
| `explain_analysis` | ✅ Complete | AI | Implemented 67 lines |

**UPDATE (2026-01-12):** ALL 10 ACTIONS ARE NOW FULLY IMPLEMENTED!

### Existing Helper Functions

```typescript
// src/analysis/helpers.ts (515 lines)
pearson()                  // Correlation coefficient
valueType()                // Type detection  
analyzeTrends()            // Linear regression trends
detectAnomalies()          // Z-score outliers (>3σ)
analyzeSeasonality()       // Basic pattern detection
analyzeCorrelationsData()  // Pairwise correlations
```

### Infrastructure Status

| Component | File | Lines | Status |
|-----------|------|-------|--------|
| Smart Router | router.ts | 460 | ✅ Complete |
| Tiered Retrieval | tiered-retrieval.ts | 441 | ✅ Complete |
| Streaming Analyzer | streaming.ts | 450 | ✅ Complete |
| Helper Functions | helpers.ts | 515 | 🔶 Partial |

---

## 2. Gap Analysis: What's Missing

### Missing Analysis Categories

| Category | Current | Needed | Gap |
|----------|---------|--------|-----|
| Data Quality | 4 checks | 15 checks | 11 missing |
| Structural | 0 checks | 10 checks | 10 missing |
| Performance | 0 checks | 12 checks | 12 missing |
| Patterns | 4 checks | 8 checks | 4 missing |
| Business Intelligence | 0 checks | 10 checks | 10 missing |
| Formula Intelligence | 0 checks | 8 checks | 8 missing |
| **TOTAL** | **8** | **63** | **55 missing** |

### Handler Implementations (UPDATED 2026-01-12)

**ALL 10 ACTIONS NOW COMPLETE:**
- ✅ `detect_patterns` - Implemented (113 lines)
- ✅ `analyze_structure` - Implemented (70 lines)
- ✅ `analyze_quality` - Implemented (113 lines)
- ✅ `analyze_performance` - Implemented (149 lines)
- ✅ `create_recommended_chart` - Implemented (184 lines with Elicitation)
- ✅ `create_recommended_pivot` - Implemented (184 lines with Elicitation)
- ✅ `explain_analysis` - Implemented (67 lines)

**Total Implementation:** 1,670 lines in src/handlers/analyze.ts

---

## 3. The 43-Category Framework

### Category Taxonomy

```
ANALYSIS
├── DATA_QUALITY (15 categories)
│   ├── Completeness
│   │   ├── DQ001: Empty cells detection
│   │   ├── DQ002: Null/NA/blank values
│   │   └── DQ003: Missing required fields
│   ├── Uniqueness
│   │   ├── DQ004: Duplicate rows
│   │   ├── DQ005: Duplicate values in key columns
│   │   └── DQ006: Near-duplicate detection
│   ├── Consistency
│   │   ├── DQ007: Data type consistency per column
│   │   ├── DQ008: Format consistency (dates, currency)
│   │   ├── DQ009: Case consistency
│   │   └── DQ010: Whitespace issues
│   ├── Validity
│   │   ├── DQ011: Email format validation
│   │   ├── DQ012: URL format validation
│   │   ├── DQ013: Date format validation
│   │   ├── DQ014: Numeric range validation
│   │   └── DQ015: Custom pattern validation
│
├── STRUCTURAL (10 categories)
│   ├── Schema
│   │   ├── ST001: Header row detection
│   │   ├── ST002: Data region boundaries
│   │   ├── ST003: Column type inference
│   │   └── ST004: Table structure detection
│   ├── Relationships
│   │   ├── ST005: Foreign key detection
│   │   ├── ST006: Cross-sheet references
│   │   └── ST007: Named range analysis
│   └── Layout
│       ├── ST008: Merge cell analysis
│       ├── ST009: Protected range detection
│       └── ST010: Filter/sort state
│
├── PERFORMANCE (12 categories)
│   ├── Formulas
│   │   ├── PF001: Volatile formula count (NOW, TODAY, RAND)
│   │   ├── PF002: INDIRECT/OFFSET usage
│   │   ├── PF003: Full column references (A:A)
│   │   ├── PF004: Array formula efficiency
│   │   └── PF005: Formula complexity scoring
│   ├── Structure
│   │   ├── PF006: Conditional formatting complexity
│   │   ├── PF007: Data validation rule count
│   │   ├── PF008: Chart/embedded object count
│   │   └── PF009: Cell count vs limits
│   └── Errors
│       ├── PF010: Formula errors (#REF!, #DIV/0!)
│       ├── PF011: Circular reference detection
│       └── PF012: Orphaned reference detection
│
├── PATTERNS (8 categories)
│   ├── Statistical
│   │   ├── PT001: Distribution analysis (normal, skewed, bimodal)
│   │   ├── PT002: Correlation matrix (Pearson, Spearman)
│   │   ├── PT003: Outlier detection (z-score, IQR, MAD)
│   │   └── PT004: Clustering potential
│   └── Temporal
│       ├── PT005: Time series patterns
│       ├── PT006: Seasonality detection
│       ├── PT007: Trend analysis (linear, exponential)
│       └── PT008: Change point detection
│
├── BUSINESS_INTELLIGENCE (10 categories)
│   ├── Financial
│   │   ├── BI001: P&L structure detection
│   │   ├── BI002: Balance sheet patterns
│   │   └── BI003: KPI/metric identification
│   ├── Sales/CRM
│   │   ├── BI004: Pipeline stage detection
│   │   ├── BI005: Funnel analysis potential
│   │   └── BI006: Cohort analysis potential
│   └── Time Intelligence
│       ├── BI007: Fiscal year detection
│       ├── BI008: Quarter boundary detection
│       ├── BI009: YoY/MoM calculation readiness
│       └── BI010: Date hierarchy detection
│
└── VISUALIZATION_READINESS (8 categories)
    ├── Charts
    │   ├── VR001: Time series → Line chart
    │   ├── VR002: Categories → Bar/Column chart
    │   ├── VR003: Parts of whole → Pie/Donut chart
    │   └── VR004: Relationships → Scatter plot
    ├── Pivots
    │   ├── VR005: Pivot table potential
    │   └── VR006: Cross-tab structure detection
    └── Formatting
        ├── VR007: Color scale candidates
        └── VR008: Sparkline candidates
```

### Category Priority Matrix

| Priority | Count | Categories | Rationale |
|----------|-------|------------|-----------|
| P0 | 15 | Data Quality | Most requested, highest impact |
| P1 | 10 | Structural | Needed for intelligent routing |
| P1 | 8 | Patterns | Core analysis capability |
| P2 | 12 | Performance | Differentiation opportunity |
| P2 | 8 | Visualization | Auto-creation enabler |
| P3 | 10 | Business Intel | Advanced differentiation |

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Current - Week 1-2)

**Goal:** Complete the 10 action handlers + core categories

#### 1.1 Fix TypeScript Errors (Day 1)
```bash
# Current: 24 errors
# - src/services/sheet-extractor.ts: 20 errors (null handling)
# - src/handlers/analyze.ts: 2 errors (schema, error codes)
# - src/constants/extraction-fields.ts: 1 error (index signature)
```

#### 1.2 Implement Missing Handlers (Days 2-5)

```typescript
// detect_patterns handler
case "detect_patterns": {
  const { analyzeTrends, detectAnomalies, analyzeCorrelationsData, analyzeSeasonality } = 
    await import("../analysis/helpers.js");
  
  const data = await this.readData(input.spreadsheetId, rangeStr);
  
  return {
    success: true,
    action: "detect_patterns",
    patterns: {
      trends: input.includeTrends ? analyzeTrends(data) : [],
      anomalies: input.includeAnomalies ? detectAnomalies(data) : [],
      correlations: input.includeCorrelations ? analyzeCorrelationsData(data) : [],
      seasonality: input.includeSeasonality ? analyzeSeasonality(data) : null,
    }
  };
}
```

#### 1.3 Core Category Extractors (Days 5-10)

```typescript
// src/analysis/category-extractor.ts
export class CategoryExtractor {
  // Data Quality (P0)
  extractDQ001_EmptyCells(data: unknown[][]): CategoryResult { ... }
  extractDQ004_DuplicateRows(data: unknown[][]): CategoryResult { ... }
  extractDQ007_TypeConsistency(data: unknown[][]): CategoryResult { ... }
  
  // All 15 DQ categories...
}
```

### Phase 2: Enhanced Categories (Week 3-4)

**Goal:** Implement all 43 categories with intelligent routing

#### 2.1 Structural Analysis
```typescript
// Schema inference
interface SchemaInference {
  columns: Array<{
    index: number;
    inferredType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
    nullability: number;  // % null
    cardinality: number;  // unique values
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    foreignKeyTarget?: string;
  }>;
  relationships: Array<{
    sourceColumn: number;
    targetSheet: string;
    targetColumn: number;
    confidence: number;
  }>;
}
```

#### 2.2 Performance Analysis
```typescript
// Formula audit
interface FormulaAudit {
  volatileFormulas: Array<{ cell: string; formula: string; type: string }>;
  fullColumnRefs: Array<{ cell: string; formula: string; columns: string[] }>;
  circularRefs: Array<{ cells: string[]; path: string[] }>;
  complexFormulas: Array<{ cell: string; formula: string; depth: number }>;
  optimizationOpportunities: Array<{
    type: 'VLOOKUP_TO_INDEX_MATCH' | 'INDIRECT_REMOVAL' | 'ARRAY_CONSOLIDATION';
    cells: string[];
    suggestion: string;
    impact: 'low' | 'medium' | 'high';
  }>;
}
```

#### 2.3 Pattern Detection Enhancement
```typescript
// Advanced patterns
interface PatternAnalysis {
  distribution: {
    type: 'normal' | 'uniform' | 'exponential' | 'bimodal' | 'power_law';
    parameters: Record<string, number>;
    goodnessOfFit: number;
  };
  changePoints: Array<{
    index: number;
    timestamp?: string;
    direction: 'increase' | 'decrease';
    magnitude: number;
    confidence: number;
  }>;
  clusters: Array<{
    centroid: number[];
    size: number;
    density: number;
  }>;
}
```

### Phase 3: Business Intelligence (Week 5-6)

**Goal:** Add domain-specific intelligence that differentiates ServalSheets

#### 3.1 Financial Pattern Recognition
```typescript
interface FinancialPatterns {
  isPnL: boolean;
  isBalanceSheet: boolean;
  isCashFlow: boolean;
  structure: {
    revenueRows: number[];
    expenseRows: number[];
    subtotalRows: number[];
    totalRows: number[];
  };
  metrics: {
    grossMargin?: { row: number; value: number };
    operatingMargin?: { row: number; value: number };
    netMargin?: { row: number; value: number };
  };
}
```

#### 3.2 CRM/Sales Intelligence
```typescript
interface SalesPatterns {
  isPipeline: boolean;
  stages: Array<{ name: string; column: number; order: number }>;
  valueColumn?: number;
  dateColumn?: number;
  conversionRates: Array<{
    fromStage: string;
    toStage: string;
    rate: number;
  }>;
  funnelAnalysis: {
    topOfFunnel: number;
    conversionByStage: number[];
    bottleneck?: string;
  };
}
```

### Phase 4: Auto-Creation (Week 7)

**Goal:** Close the loop from analysis → recommendation → creation

#### 4.1 Recommendation Engine
```typescript
// Generate actionable recommendations
interface Recommendation {
  id: string;  // For create_recommended_* actions
  type: 'chart' | 'pivot' | 'formula' | 'formatting' | 'cleanup';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'trivial' | 'easy' | 'moderate' | 'complex';
  
  // Execution params (passed to create_recommended_*)
  createParams: {
    tool: string;
    action: string;
    params: Record<string, unknown>;
  };
}
```

#### 4.2 Auto-Creation Flow
```typescript
// User flow:
// 1. analyze_data → returns recommendations with IDs
// 2. User approves recommendation
// 3. create_recommended_chart(recommendationId) → executes

case "create_recommended_chart": {
  // Lookup stored recommendation
  const recommendation = await getStoredRecommendation(input.recommendationId);
  
  // Execute via sheets_visualize tool
  const result = await this.context.callTool('sheets_visualize', {
    action: 'create',
    ...recommendation.createParams.params
  });
  
  return {
    success: true,
    action: "create_recommended_chart",
    chartId: result.chartId,
    message: `Created ${recommendation.title}`
  };
}
```

---

## 5. New Helper Functions Needed

### Data Quality Helpers
```typescript
// src/analysis/quality-helpers.ts

/**
 * Detect duplicate rows using hash comparison
 * O(n) with hash map
 */
export function findDuplicateRows(data: unknown[][]): {
  duplicateGroups: number[][];
  duplicateCount: number;
  uniqueCount: number;
}

/**
 * Detect near-duplicates using Levenshtein distance
 * O(n²) - use sampling for large datasets
 */
export function findNearDuplicates(
  data: unknown[][],
  threshold: number = 0.9
): Array<{ rows: number[]; similarity: number }>

/**
 * Check data type consistency per column
 * Returns percentage of each type
 */
export function analyzeColumnTypes(data: unknown[][]): Array<{
  column: number;
  types: Record<string, number>;
  dominantType: string;
  consistency: number;
}>

/**
 * Validate email format
 */
export function validateEmails(values: string[]): Array<{
  index: number;
  value: string;
  isValid: boolean;
  issue?: string;
}>

/**
 * Validate date formats
 */
export function validateDates(values: unknown[]): Array<{
  index: number;
  value: unknown;
  isValid: boolean;
  inferredFormat?: string;
}>
```

### Structural Analysis Helpers
```typescript
// src/analysis/structure-helpers.ts

/**
 * Detect header row (heuristic: all strings, unique values)
 */
export function detectHeaderRow(data: unknown[][]): {
  headerRowIndex: number;
  confidence: number;
  headers: string[];
}

/**
 * Detect data region boundaries
 */
export function detectDataRegion(data: unknown[][]): {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  hasHeaders: boolean;
}

/**
 * Infer column schema
 */
export function inferSchema(data: unknown[][]): Array<{
  column: number;
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
  nullable: boolean;
  unique: boolean;
  cardinality: number;
}>

/**
 * Detect foreign key relationships
 */
export function detectForeignKeys(
  sourceData: unknown[][],
  targetSheets: Array<{ name: string; data: unknown[][] }>
): Array<{
  sourceColumn: number;
  targetSheet: string;
  targetColumn: number;
  matchRate: number;
}>
```

### Performance Analysis Helpers
```typescript
// src/analysis/performance-helpers.ts

/**
 * Detect volatile formulas
 */
export function findVolatileFormulas(formulas: string[][]): Array<{
  cell: string;
  formula: string;
  volatileFunction: string;
}>

/**
 * Detect full column references (A:A pattern)
 */
export function findFullColumnRefs(formulas: string[][]): Array<{
  cell: string;
  formula: string;
  columns: string[];
  suggestion: string;
}>

/**
 * Calculate formula complexity score
 */
export function scoreFormulaComplexity(formula: string): {
  score: number;  // 0-100
  depth: number;  // Nesting depth
  functionCount: number;
  factors: string[];  // What makes it complex
}

/**
 * Detect circular references
 */
export function detectCircularRefs(
  formulas: Map<string, string>
): Array<{
  cycle: string[];
  length: number;
}>
```

### Pattern Analysis Helpers
```typescript
// src/analysis/pattern-helpers.ts

/**
 * Detect distribution type using statistical tests
 */
export function detectDistribution(values: number[]): {
  type: 'normal' | 'uniform' | 'exponential' | 'bimodal' | 'power_law' | 'unknown';
  parameters: Record<string, number>;
  confidence: number;
  testUsed: string;
}

/**
 * Detect change points in time series
 */
export function detectChangePoints(values: number[]): Array<{
  index: number;
  direction: 'increase' | 'decrease';
  magnitude: number;
  pValue: number;
}>

/**
 * Spearman rank correlation (for non-linear relationships)
 */
export function spearman(x: number[], y: number[]): number

/**
 * Modified Z-score using MAD (more robust to outliers)
 */
export function modifiedZScore(values: number[]): number[]
```

---

## 6. Integration Points

### With Existing Tools

| Analysis Category | Triggers Which Tool | Action |
|-------------------|---------------------|--------|
| DQ004: Duplicates | sheets_composite | deduplicate |
| DQ010: Whitespace | sheets_data | batch_write (trimmed) |
| PF001: Volatile | sheets_fix | fix |
| VR001: Time Series | sheets_visualize | create (line) |
| VR005: Pivot Potential | sheets_visualize | create |

### MCP Elicitation (SEP-1036)

```typescript
// Before auto-creation, confirm with user
const confirmation = await this.context.server.elicit({
  message: "I recommend creating a line chart for your sales trend. Proceed?",
  requestedSchema: {
    type: 'object',
    properties: {
      approved: { type: 'boolean' },
      modifications: { type: 'string' }
    }
  }
});

if (confirmation.data.approved) {
  // Execute create_recommended_chart
}
```

### MCP Sampling (SEP-1577)

```typescript
// AI-enhanced pattern detection for complex cases
const aiAnalysis = await this.context.server.createMessage({
  messages: [{
    role: 'user',
    content: {
      type: 'text',
      text: `Analyze this data for business patterns:\n${JSON.stringify(sampleData)}`
    }
  }],
  maxTokens: 2000
});
```

---

## 7. Success Metrics

### Coverage Metrics
| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Categories implemented | 8 | 43 | 35 |
| Handler actions complete | 3/10 | 10/10 | 7 |
| Test coverage | 0% | 80% | 80% |
| Documentation | 0% | 100% | 100% |

### Performance Metrics
| Metric | Target |
|--------|--------|
| Fast path latency | <2s for 10K cells |
| AI path latency | <15s for analysis |
| Cache hit rate | >70% |
| Memory usage | <100MB for 100K cells |

### Quality Metrics
| Metric | Target |
|--------|--------|
| False positive rate | <5% |
| False negative rate | <10% |
| Recommendation relevance | >80% user acceptance |
| Auto-fix success rate | >95% |

---

## 8. Appendix: File Structure

```
src/analysis/
├── helpers.ts              # Core statistical functions (exists)
├── router.ts               # Smart routing (exists)
├── tiered-retrieval.ts     # Caching (exists)
├── streaming.ts            # Chunked processing (exists)
├── category-extractor.ts   # NEW: 43-category extraction
├── quality-helpers.ts      # NEW: Data quality functions
├── structure-helpers.ts    # NEW: Schema inference
├── performance-helpers.ts  # NEW: Formula audit
├── pattern-helpers.ts      # NEW: Advanced patterns
├── bi-helpers.ts           # NEW: Business intelligence
├── recommender.ts          # NEW: Recommendation engine
└── auto-creator.ts         # NEW: Execution from recommendations

tests/analysis/
├── helpers.test.ts         # NEW
├── category-extractor.test.ts  # NEW
├── quality-helpers.test.ts # NEW
├── structure-helpers.test.ts   # NEW
├── performance-helpers.test.ts # NEW
├── pattern-helpers.test.ts # NEW
├── bi-helpers.test.ts      # NEW
└── recommender.test.ts     # NEW
```

---

## 9. Next Steps (Immediate)

### Week 1 Priority
1. ✅ Document this roadmap
2. 🔲 Fix 24 TypeScript errors
3. 🔲 Implement `detect_patterns` handler
4. 🔲 Implement `analyze_quality` handler
5. 🔲 Create `quality-helpers.ts` with core DQ functions

### Week 2 Priority
1. 🔲 Implement `analyze_structure` handler
2. 🔲 Implement `analyze_performance` handler
3. 🔲 Create `structure-helpers.ts`
4. 🔲 Create `performance-helpers.ts`
5. 🔲 Write tests for all new helpers

---

*This roadmap positions ServalSheets as the most comprehensive spreadsheet analysis tool available via MCP.*
