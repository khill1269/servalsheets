---
title: 'Ultimate Analysis Tool: Implementation Checklist'
category: development
last_updated: 2026-01-31
description: 'Goal: Build the prime example of MCP tool implementation following all best practices'
version: 1.6.0
tags: [sheets]
---

# Ultimate Analysis Tool: Implementation Checklist

**Goal:** Build the prime example of MCP tool implementation following all best practices

**Version:** Phase 1 - Core Consolidation
**Created:** 2026-01-12
**MCP Protocol:** 2025-11-25
**Dependencies:** @modelcontextprotocol/sdk@^1.25.2, zod@4.3.5, googleapis@^170.0.0

---

## References

### Official Documentation

- [MCP 2025-11-25 Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/)
- [Google Sheets API v4](https://developers.google.com/sheets/api/reference/rest)
- [Zod v4 Documentation](https://zod.dev/)

### Key Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.25.2", // MCP protocol implementation
  "zod": "4.3.5", // Schema validation (v4 strict mode)
  "googleapis": "^170.0.0", // Google Sheets API client
  "winston": "^3.17.0", // Structured logging
  "lru-cache": "^11.0.0", // In-memory caching
  "p-queue": "^9.0.1" // Request queuing
}
```

---

## Phase 1: Core Implementation (CURRENT)

### 1. TypeScript Compilation Fixes (P0 - Critical)

#### 1.1 Fix `src/analysis/tiered-retrieval.ts` Type Errors

- [ ] **Line 44, 66, 81**: Fix tier property type conflicts

  ```typescript
  // Current: tier: 1 | 2 | 3 | 4 (literal types incompatible)
  // Fix: Use discriminated union or make tier a branded type
  export type TierLevel = 1 | 2 | 3 | 4;
  interface SheetMetadata { tier: 1; ... }
  interface SheetStructure extends Omit<SheetMetadata, 'tier'> { tier: 2; ... }
  ```

- [ ] **Lines 171, 274, 352, 416**: Fix cache.set() signature

  ```typescript
  // Current: cache.set(key, value, { ttl: number })
  // Check: src/utils/hot-cache.ts interface
  // Fix: Match HotCache.set() method signature exactly
  ```

- [ ] **Line 251**: Fix pivotTable property access

  ```typescript
  // Current: rm.pivotTable (doesn't exist on Schema$DimensionProperties)
  // Fix: Check Google API types for correct pivot detection
  // Alternative: Use sheet.data?.pivotTable or check different property
  ```

#### 1.2 Fix `src/handlers/analyze.ts` Type Errors

- [ ] **Line 99**: Update action switch case

  ```typescript
  // Remove: case "analyze"
  // Add: case "analyze_data"
  ```

- [ ] **Lines 141, 273**: Fix range type incompatibility

  ```typescript
  // Current: RangeInput union type not compatible with RangeRefSchema
  // Fix: Add type guard or conversion function
  // Option: Update RangeRefSchema in analyze.ts to accept full RangeInput
  ```

- [ ] **Lines 162, 291**: Fix 'unknown' to 'string' type assertions

  ```typescript
  // Add type guard before assignment
  if (typeof value === 'string') {
    rangeStr = value;
  }
  ```

- [ ] **Line 347**: Update action switch case

  ```typescript
  // Remove: case "suggest_chart"
  // Add: case "suggest_visualization"
  ```

- [ ] **Lines 463, 468, 482**: Remove get_stats action entirely

  ```typescript
  // Remove get_stats case - not part of consolidated tool
  // Remove stats property from response type
  ```

#### 1.3 Fix `src/schemas/analyze.ts` Type Errors

- [ ] **Line 264**: Fix RangeInputSchema.optional() call

  ```typescript
  // Check: Does RangeInputSchema have .optional() method?
  // Fix: Use z.union([RangeInputSchema, z.undefined()]) if needed
  ```

#### 1.4 Fix `src/schemas/index.ts` Duplicate Export

- [ ] **Line 47**: Resolve DetectPatternsInput export conflict

  ```typescript
  // analysis.ts exports: DetectPatternsInput
  // analyze.ts exports: DetectPatternsInput (NEW)
  // Fix: Rename one or use explicit re-export with alias
  export { DetectPatternsInput as AnalysisDetectPatternsInput } from './analysis.js';
  export { DetectPatternsInput as AnalyzeDetectPatternsInput } from './analyze.js';
  ```

#### 1.5 Fix Other TypeScript Errors

- [ ] **src/constants/extraction-fields.ts:550**: Fix index signature access
- [ ] **src/services/sheet-extractor.ts**: Multiple null/undefined handling issues
  - Lines 359, 481-487, 710, 727, 741, 746, 751, 756, 761, 766
  - Lines 805, 819-820, 827-831, 837-838
  - Lines 1260, 1263, 1265, 1277, 1280, 1283, 1286, 1290, 1292

**Verification Command:** `npm run typecheck`

---

### 2. Handler Implementation (P0 - Critical)

#### 2.1 Update `src/handlers/analyze.ts`

- [ ] **Import new infrastructure**

  ```typescript
  import { AnalysisRouter, createRouter, type RouterCapabilities } from '../analysis/router.js';
  import { TieredRetrieval, createTieredRetrieval } from '../analysis/tiered-retrieval.js';
  import * as helpers from '../analysis/helpers.js';
  ```

- [ ] **Initialize router and tiered retrieval in constructor**

  ```typescript
  private router: AnalysisRouter;
  private tieredRetrieval: TieredRetrieval;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super("sheets_analyze", context);
    this.sheetsApi = sheetsApi;

    const capabilities: RouterCapabilities = {
      hasSampling: !!context.samplingServer,
      hasTasks: false, // TODO: Enable in Phase 3
    };
    this.router = createRouter(capabilities);
    this.tieredRetrieval = createTieredRetrieval({
      cache: context.cache, // Assumes HotCache available
      sheetsApi: sheetsApi,
    });
  }
  ```

- [ ] **Implement 10 action handlers**
  - [ ] `handleAnalyzeData()` - Smart routing (fast/AI/streaming)
  - [ ] `handleSuggestVisualization()` - Chart + pivot recommendations
  - [ ] `handleGenerateFormula()` - Keep existing, enhance with context
  - [ ] `handleDetectPatterns()` - Use helpers.analyzeTrends, detectAnomalies
  - [ ] `handleAnalyzeStructure()` - Use tieredRetrieval.getStructure()
  - [ ] `handleAnalyzeQuality()` - Use helpers.checkColumnQuality
  - [ ] `handleAnalyzePerformance()` - NEW implementation
  - [ ] `handleCreateRecommendedChart()` - Call charts handler
  - [ ] `handleCreateRecommendedPivot()` - Call pivot handler
  - [ ] `handleExplainAnalysis()` - AI-powered explanation via Sampling

- [ ] **Implement routing logic in handle() method**

  ```typescript
  async handle(input: SheetsAnalyzeInput): Promise<SheetsAnalyzeOutput> {
    // 1. Get metadata for routing decision
    const metadata = await this.tieredRetrieval.getMetadata(input.spreadsheetId);

    // 2. Route to optimal path
    const decision = this.router.route(input, metadata);

    // 3. Execute based on path
    let response: AnalyzeResponse;
    switch (decision.path) {
      case 'fast':
        response = await this.executeFastPath(input, metadata);
        break;
      case 'ai':
        response = await this.executeAIPath(input, metadata);
        break;
      case 'streaming':
        response = await this.executeStreamingPath(input, metadata);
        break;
    }

    // 4. Track execution metrics
    this.trackMetrics(decision.path, decision.estimatedDuration);

    return { response };
  }
  ```

#### 2.2 Update `src/handlers/analysis.ts` (DEPRECATED)

- [ ] **Add deprecation warnings to all responses**

  ```typescript
  private addDeprecationWarning(response: AnalysisResponse): AnalysisResponse {
    if (response.success) {
      response._meta = {
        ...response._meta,
        deprecated: true,
        deprecationDate: '2026-01-12',
        removalDate: '2026-04-12',
        replacement: 'sheets_analyze',
        migrationPath: SHEETS_ANALYSIS_DEPRECATION.migrationGuide[response.action],
        message: 'This tool is deprecated. Please migrate to sheets_analyze.'
      };
    }
    return response;
  }
  ```

- [ ] **Update executeAction() to inject warnings**

  ```typescript
  private async executeAction(request: SheetsAnalysisInput): Promise<AnalysisResponse> {
    const response = await this.executeActionInternal(request);
    return this.addDeprecationWarning(response);
  }
  ```

#### 2.3 Create Missing Handlers (P1 - High Priority)

- [ ] **`src/analysis/category-extractor.ts`** (800 lines, Phase 2)
  - 43-category systematic extraction
  - Sample-based (95% accuracy) + full-data mode

- [ ] **`src/analysis/recommender.ts`** (600 lines, Phase 2)
  - ChartRecommender class
  - PivotRecommender class
  - FormulaGenerator class

- [ ] **`src/analysis/auto-creator.ts`** (400 lines, Phase 2)
  - Auto-create charts from recommendations
  - Auto-create pivots from recommendations
  - Confirmation flow integration

- [ ] **`src/analysis/streaming.ts`** (450 lines, Phase 3)
  - Task-enabled chunked analysis
  - Progress reporting
  - Cancellation support

**Verification Command:** `npm run test:handlers`

---

### 3. MCP Protocol Compliance (P0 - Critical)

#### 3.1 Tool Registration

- [ ] **Update `src/mcp/registration/tool-definitions.ts`**

  ```typescript
  // Remove sheets_analyze from toolDefinitions array (keep for 90 days)
  // Update sheets_analyze definition:
  {
    name: 'sheets_analyze',
    description: '...',  // Updated description from TOOL_REGISTRY
    inputSchema: toJSONSchema(SheetsAnalyzeInputSchema),
    outputSchema: toJSONSchema(SheetsAnalyzeOutputSchema),
    annotations: {
      title: 'Ultimate Data Analysis',
      readOnlyHint: false,        // Can create charts/pivots
      destructiveHint: false,     // Non-destructive creation
      idempotentHint: false,      // AI varies
      openWorldHint: true,        // External API + AI
    },
    taskSupport: 'optional',      // Enable for Phase 3 streaming
  }
  ```

#### 3.2 Annotations Compliance

- [x] **readOnlyHint**: false (creates charts/pivots)
- [x] **destructiveHint**: false (creation is non-destructive)
- [x] **idempotentHint**: false (AI responses vary)
- [x] **openWorldHint**: true (Google API + MCP Sampling)

#### 3.3 Input Schema Validation

- [ ] **Verify Zod v4 strict mode compatibility**

  ```bash
  # Check all schemas use strict validation
  grep -r "z.object" src/schemas/analyze.ts
  # Ensure no .passthrough() or .catchall()
  ```

- [ ] **Add comprehensive .refine() validations**

  ```typescript
  // Already implemented: action-specific required field checks
  // TODO: Add cross-field validation (e.g., chartType requires range)
  ```

#### 3.4 Output Schema Validation

- [ ] **Ensure discriminated unions for success/error**

  ```typescript
  // ✅ Already implemented:
  const AnalyzeResponseSchema = z.discriminatedUnion("success", [...]);
  ```

- [ ] **Add response shape validation in handler**

  ```typescript
  // Before returning, validate against output schema
  const validated = SheetsAnalyzeOutputSchema.parse({ response });
  return validated;
  ```

#### 3.5 Task Support (Phase 3)

- [ ] **Enable taskSupport: 'optional'** in tool definition
- [ ] **Implement task creation for streaming path**

  ```typescript
  // In executeStreamingPath():
  const taskId = await this.context.taskServer.createTask({
    type: 'analysis',
    name: `Analyzing ${metadata.title}`,
    progressCallback: (progress) => {
      /* ... */
    },
  });
  ```

- [ ] **Add progress reporting**
- [ ] **Add cancellation support**

#### 3.6 Sampling Integration

- [x] **Import sampling functions** (already done)
- [ ] **Verify sampling availability checks**

  ```typescript
  if (!this.context.samplingServer) {
    return this.error({
      code: 'FEATURE_UNAVAILABLE',
      message: 'AI features require sampling capability',
    });
  }
  ```

#### 3.7 Logging Integration

- [ ] **Use structured logging (winston)**

  ```typescript
  import { logger } from '../utils/logger.js';
  import { getRequestLogger } from '../utils/request-context.js';

  // In handler methods:
  const reqLogger = getRequestLogger();
  reqLogger.info('Analysis started', {
    action: input.action,
    path: decision.path,
    cellCount: metadata.sheets[0].rowCount * metadata.sheets[0].columnCount,
  });
  ```

**Verification Commands:**

```bash
npm run test:contracts          # Schema contract tests
npm run inspect                 # MCP Inspector validation
```

---

### 4. Google Sheets API Integration (P0 - Critical)

#### 4.1 Tiered Retrieval Field Optimization

- [ ] **Verify field masks for each tier**

  ```typescript
  // Tier 1 (Metadata): ~2KB response
  fields: 'spreadsheetId,properties.title,sheets.properties';

  // Tier 2 (Structure): ~20KB response
  fields: 'sheets(properties,merges,conditionalFormats,protectedRanges,basicFilter,charts)';

  // Tier 3 (Sample): ~100KB response
  // Use values.get() with range: A1:ZZ100

  // Tier 4 (Full): 1MB-50MB response
  // Use values.get() with full range
  ```

- [ ] **Test response sizes match expectations**

  ```bash
  # Add integration test
  npm run test:integration -- tiered-retrieval.test.ts
  ```

#### 4.2 API Error Handling

- [ ] **Implement retry logic for transient errors**

  ```typescript
  // Already exists in google-api.ts
  // Verify: 3 retries, exponential backoff, circuit breaker
  ```

- [ ] **Handle quota exhaustion gracefully**

  ```typescript
  catch (error) {
    if (error.code === 429 || error.message.includes('quota')) {
      return this.error({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Google Sheets API quota exceeded',
        retryable: true,
        retryAfter: 60
      });
    }
  }
  ```

#### 4.3 Chart Creation Integration

- [ ] **Verify all 9 chart types supported**

  ```typescript
  // Google Sheets API chart types:
  // LINE, AREA, COLUMN, BAR, SCATTER, PIE, COMBO, HISTOGRAM, CANDLESTICK,
  // ORG, TREEMAP, WATERFALL, SCORECARD
  ```

- [ ] **Test chart creation via batchUpdate**

  ```bash
  npm run test:integration -- chart-creation.test.ts
  ```

#### 4.4 Pivot Table Creation Integration

- [ ] **Implement pivot creation via updateCells**

  ```typescript
  // Use sheets.batchUpdate with updateCells request
  // Set pivotTable field in GridData
  ```

- [ ] **Test pivot table creation**

  ```bash
  npm run test:integration -- pivot-creation.test.ts
  ```

#### 4.5 Connection Pooling Verification

- [x] **Verify HTTP/2 enabled** (already configured)
- [x] **Verify 50 socket pool** (already configured)
- [x] **Verify LIFO scheduling** (already configured)

**Verification Commands:**

```bash
npm run test:integration:real  # Real API integration tests (requires credentials)
```

---

### 5. Testing (P1 - High Priority)

#### 5.1 Unit Tests

- [ ] **`tests/analysis/helpers.test.ts`** (NEW)

  ```typescript
  describe('Analysis Helpers', () => {
    describe('pearson()', () => {
      it('calculates correlation correctly', () => { ... });
      it('handles empty arrays', () => { ... });
      it('handles mismatched lengths', () => { ... });
    });

    describe('analyzeTrends()', () => { ... });
    describe('detectAnomalies()', () => { ... });
    // ... test all 8 helper functions
  });
  ```

- [ ] **`tests/analysis/router.test.ts`** (NEW)

  ```typescript
  describe('AnalysisRouter', () => {
    it('routes small datasets to fast path', () => { ... });
    it('routes medium datasets to AI path', () => { ... });
    it('routes large datasets to streaming path', () => { ... });
    it('respects useAI flag', () => { ... });
    // ... test all 10 actions
  });
  ```

- [ ] **`tests/analysis/tiered-retrieval.test.ts`** (NEW)

  ```typescript
  describe('TieredRetrieval', () => {
    describe('getMetadata()', () => {
      it('fetches minimal fields', () => { ... });
      it('caches result with 5min TTL', () => { ... });
    });
    // ... test all 4 tiers
  });
  ```

#### 5.2 Handler Tests

- [ ] **Update `tests/handlers/analyze.test.ts`**

  ```typescript
  describe('AnalyzeHandler', () => {
    describe('analyze_data action', () => {
      it('routes to fast path for small datasets', () => { ... });
      it('routes to AI path when useAI=true', () => { ... });
      it('returns structured analysis results', () => { ... });
    });

    describe('suggest_visualization action', () => {
      it('recommends appropriate chart types', () => { ... });
      it('recommends pivot tables when appropriate', () => { ... });
    });

    // ... test all 10 actions
  });
  ```

- [ ] **Add deprecation tests for analysis.ts**

  ```typescript
  describe('AnalysisHandler (DEPRECATED)', () => {
    it('includes deprecation warning in all responses', () => {
      const result = await handler.handle({ action: 'analyze_quality', ... });
      expect(result.response._meta?.deprecated).toBe(true);
      expect(result.response._meta?.replacement).toBe('sheets_analyze');
    });
  });
  ```

#### 5.3 Integration Tests

- [ ] **`tests/integration/analysis-routing.test.ts`** (NEW)
  - Test fast path execution
  - Test AI path execution (with mocked Sampling)
  - Test routing decisions

- [ ] **`tests/integration/tiered-retrieval-real.test.ts`** (NEW)
  - Test against real Google Sheets API
  - Verify response sizes match expectations
  - Verify cache hits on repeated calls

#### 5.4 Contract Tests

- [ ] **Update `tests/contracts/schema-contracts.test.ts`**

  ```typescript
  // Update to reference new consolidated schema
  const analyzeSchema = SheetsAnalyzeInputSchema;

  // Test all 10 actions validate correctly
  test('analyze_data validates required fields', () => { ... });
  test('suggest_visualization validates required fields', () => { ... });
  // ... test all 10 actions
  ```

#### 5.5 Snapshot Tests

- [ ] **Create `tests/snapshots/analyze-responses.snapshot.test.ts`**

  ```typescript
  // Snapshot test for each action's response format
  describe('Analyze Response Snapshots', () => {
    it('analyze_data response structure', () => {
      const response = await handler.handle({ ... });
      expect(response).toMatchSnapshot();
    });
    // ... snapshot for all 10 actions
  });
  ```

**Verification Commands:**

```bash
npm run test:unit              # Unit tests
npm run test:handlers          # Handler tests
npm run test:integration       # Integration tests
npm run test:contracts         # Schema contract tests
npm run test:snapshots         # Snapshot tests
npm run test:all               # All tests
npm run test:coverage          # Coverage report (aim for >80%)
```

---

### 6. Documentation (P1 - High Priority)

#### 6.1 Tool Documentation

- [ ] **Create `docs/tools/sheets_analyze.md`**

  ```markdown
  # sheets_analyze: Ultimate Data Analysis Tool

  ## Overview

  Consolidated analysis tool with intelligent routing...

  ## Actions (10)

  ### 1. analyze_data

  - **Purpose**: Smart analysis with automatic routing
  - **Input**: `{ action: "analyze_data", spreadsheetId, ... }`
  - **Output**: Analysis results with execution path
  - **Path Selection**:
    - Fast: <10K cells, traditional statistics
    - AI: >10K cells or useAI=true, LLM insights
    - Streaming: >50K cells, chunked processing

  ### 2. suggest_visualization

  ...
  ```

- [ ] **Update `docs/guides/ANALYSIS_GUIDE.md`**
  - Migration guide from sheets_analyze to sheets_analyze
  - When to use which action
  - Performance optimization tips

#### 6.2 API Reference

- [ ] **Generate TypeDoc documentation**

  ```bash
  npm run docs
  # Verify docs/api/ contains:
  # - AnalysisRouter
  # - TieredRetrieval
  # - All helper functions
  # - All type exports
  ```

#### 6.3 Code Comments

- [ ] **Add JSDoc to all public methods**

  ````typescript
  /**
   * Analyze data with intelligent routing
   *
   * Routes analysis to optimal execution path based on data size and complexity:
   * - Fast path: <10K cells, traditional statistics (0.5-2s)
   * - AI path: Complex analysis via MCP Sampling (3-15s)
   * - Streaming path: >50K cells, chunked processing (async)
   *
   * @param input - Analysis request with action and parameters
   * @returns Analysis results with execution metadata
   *
   * @example
   * ```typescript
   * const result = await analyze({
   *   action: 'analyze_data',
   *   spreadsheetId: '...',
   *   analysisTypes: ['summary', 'quality']
   * });
   * ```
   */
  ````

#### 6.4 Migration Guide

- [ ] **Create `docs/migration/ANALYSIS_TOOL_MIGRATION.md`**

  ````markdown
  # Migrating from sheets_analyze to sheets_analyze

  ## Action Mapping

  | Old (sheets_analyze) | New (sheets_analyze)  | Notes                      |
  | -------------------- | --------------------- | -------------------------- |
  | data_quality         | analyze_quality       | Same functionality         |
  | formula_audit        | analyze_quality       | Merged into quality checks |
  | statistics           | analyze_data          | Use with analysisTypes     |
  | suggest_chart        | suggest_visualization | Now includes pivots        |

  ...

  ## Code Examples

  ### Before (sheets_analyze)

  \```typescript
  const result = await client.callTool('sheets_analyze', {
  action: 'analyze_quality',
  spreadsheetId: '...'
  });
  \```

  ### After (sheets_analyze)

  \```typescript
  const result = await client.callTool('sheets_analyze', {
  action: 'analyze_quality',
  spreadsheetId: '...'
  });
  \```
  ````

#### 6.5 Architecture Documentation

- [ ] **Update `docs/architecture/ANALYSIS_ARCHITECTURE.md`**
  - Router decision tree diagram
  - Tiered retrieval flow diagram
  - Path execution flowcharts
  - Performance characteristics

**Verification:** All docs render correctly in GitHub/TypeDoc

---

### 7. Performance & Optimization (P2 - Medium Priority)

#### 7.1 Caching Strategy

- [ ] **Verify cache TTLs per tier**

  ```typescript
  // Tier 1: 5min (metadata rarely changes)
  // Tier 2: 3min (structure changes occasionally)
  // Tier 3: 1min (sample data changes frequently)
  // Tier 4: 30sec (full data is volatile)
  ```

- [ ] **Add cache metrics tracking**

  ```typescript
  // Track hit rate per tier
  metrics.cacheHitRate.labels({ tier: '1' }).inc();
  ```

#### 7.2 Request Batching

- [x] **Verify adaptive batch windows** (already implemented)
- [ ] **Add analysis-specific batching**

  ```typescript
  // Batch multiple small analysis requests
  // Combine into single API call when possible
  ```

#### 7.3 Memory Management

- [ ] **Implement streaming for large datasets**
  - Phase 3: src/analysis/streaming.ts
  - Chunked processing for >50K rows
  - Memory limit: <500MB per analysis

- [ ] **Add heap monitoring**

  ```typescript
  import { heapMonitor } from '../utils/heap-monitor.js';

  // Before large analysis:
  if (heapMonitor.isMemoryPressure()) {
    await heapMonitor.gc();
  }
  ```

#### 7.4 Benchmarking

- [ ] **Create benchmark suite**

  ```bash
  npm run test:benchmarks -- analysis

  # Expected results:
  # - Fast path: 0.5-2s for 10K cells
  # - AI path: 3-15s for any size
  # - Tier 1 fetch: <500ms
  # - Tier 2 fetch: <1s
  # - Tier 3 fetch: <3s
  ```

**Verification Commands:**

```bash
npm run test:benchmarks
npm run metrics                 # View cache hit rates
```

---

### 8. Security & Safety (P1 - High Priority)

#### 8.1 Input Validation

- [x] **Zod schema validation** (already implemented)
- [ ] **Add sanitization for user-provided strings**

  ```typescript
  // Sanitize formula descriptions before sending to AI
  const sanitized = input.description
    .replace(/<script>/gi, '')
    .trim()
    .slice(0, 1000); // Max length
  ```

#### 8.2 Rate Limiting

- [ ] **Add per-action rate limits**

  ```typescript
  // Expensive AI actions: 10 req/min
  // Fast path: 60 req/min
  // Streaming: 5 req/min
  ```

#### 8.3 Resource Limits

- [ ] **Enforce maximum analysis size**

  ```typescript
  const MAX_CELLS_FAST_PATH = 10_000;
  const MAX_CELLS_AI_PATH = 50_000;
  const MAX_CELLS_STREAMING = 1_000_000;

  if (cellCount > MAX_CELLS_STREAMING) {
    return this.error({
      code: 'TOO_LARGE',
      message: 'Dataset exceeds maximum size for analysis',
    });
  }
  ```

#### 8.4 Confirmation Requirements

- [ ] **Require confirmation for auto-create actions**

  ```typescript
  // create_recommended_chart and create_recommended_pivot
  // Should use MCP Elicitation (SEP-1036) for confirmation

  if (!input.confirmed) {
    return await this.elicitConfirmation({
      action: 'create_recommended_chart',
      preview: chartRecommendation,
      question: 'Create this chart in your spreadsheet?',
    });
  }
  ```

#### 8.5 Error Handling

- [ ] **Never expose internal errors**

  ```typescript
  catch (error) {
    logger.error('Analysis failed', { error, input });

    // Return sanitized error
    return this.error({
      code: 'INTERNAL_ERROR',
      message: 'Analysis failed due to an internal error',
      retryable: true
    });
  }
  ```

**Verification:** Security audit with `npm run security:audit`

---

### 9. Monitoring & Observability (P2 - Medium Priority)

#### 9.1 Metrics

- [ ] **Add analysis-specific metrics**

  ```typescript
  // Counter: Total analyses by action
  analysisCount.labels({ action: 'analyze_data' }).inc();

  // Histogram: Analysis duration by path
  analysisDuration.labels({ path: 'fast' }).observe(duration);

  // Gauge: Active streaming analyses
  activeStreamingAnalyses.set(count);
  ```

#### 9.2 Structured Logging

- [ ] **Log all analysis operations**

  ```typescript
  logger.info('Analysis completed', {
    action: input.action,
    path: decision.path,
    duration: Date.now() - startTime,
    cellCount: cellCount,
    success: true,
  });
  ```

#### 9.3 Tracing

- [ ] **Add request context tracking**

  ```typescript
  // Already implemented in request-context.ts
  // Verify all log statements include request ID
  ```

**Verification:** Check metrics at `http://localhost:3001/metrics`

---

### 10. CI/CD Integration (P1 - High Priority)

#### 10.1 Pre-commit Hooks

- [x] **Husky setup** (already configured)
- [ ] **Add analysis-specific checks**

  ```bash
  # .husky/pre-commit
  npm run typecheck
  npm run test:unit -- analysis/
  npm run lint
  ```

#### 10.2 GitHub Actions

- [ ] **Update CI workflow**

  ```yaml
  # .github/workflows/ci.yml
  - name: Test Analysis Tool
    run: |
      npm run test:unit -- analysis/
      npm run test:handlers -- analyze
      npm run test:contracts
  ```

#### 10.3 Release Checklist

- [ ] **Phase 1 Release Criteria**
  - [ ] All TypeScript errors resolved
  - [ ] All unit tests passing
  - [ ] All handler tests passing
  - [ ] All contract tests passing
  - [ ] Documentation complete
  - [ ] Migration guide published
  - [ ] Deprecation warnings active

**Verification Commands:**

```bash
npm run verify                  # Full verification pipeline
npm run ci                      # Complete CI check
```

---

## Phase 2: Advanced Features (NEXT)

### 11. Category Extraction (P1)

- [ ] Create `src/analysis/category-extractor.ts`
- [ ] Implement 43-category systematic extraction
- [ ] Add sample-based extraction (95% accuracy)
- [ ] Add full-data extraction mode
- [ ] Test against golden datasets

### 12. Recommendation Engine (P1)

- [ ] Create `src/analysis/recommender.ts`
- [ ] Implement ChartRecommender
- [ ] Implement PivotRecommender
- [ ] Implement FormulaGenerator
- [ ] Add confidence scoring

### 13. Auto-Creation Flow (P1)

- [ ] Create `src/analysis/auto-creator.ts`
- [ ] Integrate with charts handler
- [ ] Integrate with pivot handler
- [ ] Add MCP Elicitation confirmation
- [ ] Test end-to-end workflow

---

## Phase 3: Streaming & Tasks (FUTURE)

### 14. Task Integration (P1)

- [ ] Enable taskSupport: 'optional'
- [ ] Create `src/analysis/streaming.ts`
- [ ] Implement chunked processing
- [ ] Add progress reporting
- [ ] Add cancellation support

### 15. Redis Integration (P2)

- [ ] Wire Redis for tier 3/4 caching
- [ ] Implement multi-layer fallback
- [ ] Add cache warming
- [ ] Test with Redis unavailable

---

## Best Practices Checklist

### TypeScript

- [x] Strict mode enabled
- [ ] No `any` types (use `unknown` + guards)
- [ ] Comprehensive type exports
- [ ] JSDoc on all public APIs

### Zod v4

- [x] Strict validation (no .passthrough())
- [x] Discriminated unions for variants
- [x] .refine() for cross-field validation
- [ ] Branded types where appropriate

### MCP Protocol

- [x] All annotations specified
- [x] Input/output schemas validated
- [ ] Task support configured
- [x] Sampling integration
- [ ] Elicitation integration (Phase 2)

### Google API

- [x] Field masking for optimization
- [x] Connection pooling (50 sockets)
- [x] HTTP/2 enabled
- [x] Retry + circuit breaker
- [ ] Quota monitoring

### Error Handling

- [x] Structured error codes
- [x] Retryable flag set correctly
- [ ] Never expose internal errors
- [x] Comprehensive error types

### Testing

- [ ] > 80% code coverage
- [ ] Unit + integration tests
- [ ] Contract tests
- [ ] Snapshot tests
- [ ] Benchmarks

### Documentation

- [ ] Tool usage guide
- [ ] API reference (TypeDoc)
- [ ] Migration guide
- [ ] Architecture diagrams
- [ ] Code comments (JSDoc)

---

## Success Metrics

### Performance

- [ ] Fast path: <2s for 10K cells
- [ ] AI path: <15s for any size
- [ ] Streaming: Handle 1M+ cells
- [ ] Cache hit rate: >70%
- [ ] API call reduction: >50%

### Quality

- [ ] TypeScript compilation: 0 errors
- [ ] Test coverage: >80%
- [ ] All tests passing
- [ ] No deprecation warnings (except sheets_analyze)
- [ ] ESLint: 0 errors

### User Experience

- [ ] Clear error messages
- [ ] Helpful descriptions
- [ ] Intuitive action names
- [ ] Fast response times
- [ ] Reliable results

---

## Priority Legend

- **P0 - Critical**: Must complete for Phase 1 release
- **P1 - High**: Important for production readiness
- **P2 - Medium**: Nice to have, can defer to Phase 2/3
- **P3 - Low**: Future enhancement

---

## Completion Status

**Phase 1 Progress: 40%**

### Completed ✅

- Schema consolidation (analyze.ts)
- Schema deprecation (analysis.ts)
- Helper functions extraction (helpers.ts)
- Router implementation (router.ts)
- Tiered retrieval (tiered-retrieval.ts)
- Annotations update
- Metadata generation

### In Progress 🚧

- TypeScript compilation fixes (60% complete)
- Handler implementation (10% complete)

### Not Started ❌

- Testing suite
- Documentation
- MCP protocol full compliance
- Performance optimization
- Security hardening

**Next Steps:**

1. Fix all TypeScript compilation errors
2. Implement all 10 action handlers
3. Write comprehensive test suite
4. Update documentation
5. Run full verification pipeline

---

**Last Updated:** 2026-01-12
**Maintainer:** ServalSheets Development Team
**MCP Protocol Version:** 2025-11-25
