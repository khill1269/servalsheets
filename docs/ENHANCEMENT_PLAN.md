# ServalSheets Enhancement Plan

**Generated:** 2026-01-04
**Based on:** Comprehensive Documentation vs Implementation Audit
**Status:** Ready for Implementation

---

## Executive Summary

Audit of 100+ documentation files, 15 tools (156 actions), and extensive knowledge base revealed **10 high-impact enhancement opportunities**. The codebase is well-architected with comprehensive implementations, but several features are documented but not implemented, and existing AI capabilities are underutilized.

**Key Findings:**
- ✅ MCP Protocol features (sampling, elicitation) are implemented but underutilized
- ⚠️ Knowledge base (6 API refs + 100+ formulas + templates) exists but not integrated into tools
- ⚠️ Examples document features that don't exist (detect_patterns, column_analysis)
- ⚠️ Completions infrastructure exists but disabled (waiting for SDK support)
- ✅ Performance features (batch compiler, caching, deduplication) are active but inconsistently applied

---

## Priority Enhancements

### 🔴 CRITICAL - Fix Documentation/Implementation Mismatches

#### 1. Remove or Implement Missing Analysis Actions
**Problem:** Examples document `detect_patterns` and `column_analysis` actions that don't exist

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/docs/examples/analysis-examples.json` (lines 240-349)
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/schemas/analysis.ts` (lines 67-137)
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/analysis.ts` (lines 180-205)

**Options:**
1. **Remove from examples** (Quick fix - 10 minutes)
2. **Implement actions** (Proper fix - 4-6 hours)

**Recommendation:** Option 2 - Implement actions using existing sampling infrastructure

**Implementation:**

```typescript
// src/schemas/analysis.ts - Add to AnalysisActionSchema union
export const DetectPatternsActionSchema = z.object({
  action: z.literal('detect_patterns'),
  spreadsheetId: SpreadsheetIdSchema,
  range: z.string().describe('Range to analyze for patterns'),
  includeCorrelations: z.boolean().optional().describe('Include correlation analysis'),
  includeTrends: z.boolean().optional().describe('Include trend detection'),
  includeSeasonality: z.boolean().optional().describe('Include seasonality patterns'),
  includeAnomalies: z.boolean().optional().describe('Include anomaly detection'),
  useAI: z.boolean().optional().describe('Use AI for pattern explanation'),
}).strict();

export const ColumnAnalysisActionSchema = z.object({
  action: z.literal('column_analysis'),
  spreadsheetId: SpreadsheetIdSchema,
  range: z.string().describe('Single column range (e.g., Sheet1!D2:D100)'),
  analyzeDistribution: z.boolean().optional().describe('Analyze value distribution'),
  detectDataType: z.boolean().optional().describe('Auto-detect data type'),
  checkQuality: z.boolean().optional().describe('Check data quality'),
  useAI: z.boolean().optional().describe('Use AI for insights'),
}).strict();

// src/handlers/analysis.ts - Add handler methods
private async handleDetectPatterns(
  input: Extract<AnalysisAction, { action: 'detect_patterns' }>
): Promise<AnalysisResponse> {
  const values = await this.readRange(input.spreadsheetId, input.range);

  const patterns: any = {
    trends: input.includeTrends ? await this.analyzeTrends(values) : undefined,
    correlations: input.includeCorrelations ? await this.analyzeCorrelations(values) : undefined,
    seasonality: input.includeSeasonality ? await this.analyzeSeasonality(values) : undefined,
    anomalies: input.includeAnomalies ? await this.detectAnomalies(values) : undefined,
  };

  // Use AI for pattern explanation if requested
  if (input.useAI && this.context.sampling) {
    const explanation = await this.context.sampling.analyzeData({
      data: values,
      analysisType: 'pattern_detection',
      context: { patterns },
    });
    patterns.aiInsights = explanation;
  }

  return this.success({ range: input.range, patterns });
}

private async handleColumnAnalysis(
  input: Extract<AnalysisAction, { action: 'column_analysis' }>
): Promise<AnalysisResponse> {
  const values = await this.readRange(input.spreadsheetId, input.range);
  const columnData = values.map(row => row[0]); // Extract first column

  const analysis: any = {
    dataType: input.detectDataType ? this.detectDataType(columnData) : undefined,
    distribution: input.analyzeDistribution ? this.analyzeDistribution(columnData) : undefined,
    quality: input.checkQuality ? this.checkDataQuality(columnData) : undefined,
  };

  // Use AI for insights if requested
  if (input.useAI && this.context.sampling) {
    const insights = await this.context.sampling.analyzeData({
      data: columnData,
      analysisType: 'column_analysis',
      context: { analysis },
    });
    analysis.aiInsights = insights;
  }

  return this.success({ range: input.range, analysis });
}
```

**Testing:**
- Add tests to `/tests/handlers/analysis.test.ts`
- Update examples in `/docs/examples/analysis-examples.json` to match implementation

**Estimated Time:** 4-6 hours
**Priority:** CRITICAL
**Impact:** Fixes misleading documentation, adds valuable features

---

### 🟠 HIGH PRIORITY - AI Integration Enhancements

#### 2. Implement Template Suggestion Tool
**Problem:** Knowledge base has 7 templates, but no tool action exposes them

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/knowledge/templates/common-templates.json`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/analysis.ts` (or spreadsheet.ts)

**Implementation:**

**Option A: Add to sheets_analysis tool**
```typescript
// src/schemas/analysis.ts
export const SuggestTemplatesActionSchema = z.object({
  action: z.literal('suggest_templates'),
  description: z.string().describe('User description of what they want to create'),
  category: z.enum(['finance', 'project-management', 'sales', 'operations', 'hr', 'marketing', 'all']).optional(),
  maxSuggestions: z.number().min(1).max(10).default(3),
}).strict();

// src/handlers/analysis.ts
private async handleSuggestTemplates(
  input: Extract<AnalysisAction, { action: 'suggest_templates' }>
): Promise<AnalysisResponse> {
  const templates = await this.loadTemplates();

  // Use AI to match user description to templates
  let suggestions: any[];

  if (this.context.sampling) {
    const prompt = `User wants to create: "${input.description}"
Available templates:
${templates.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Suggest the ${input.maxSuggestions} most relevant templates. Consider:
- User's stated needs
- Template features and use cases
- Complexity level

Return as JSON array with template names and match reasons.`;

    const aiResponse = await this.context.sampling.analyzeData({
      data: templates,
      analysisType: 'template_matching',
      customPrompt: prompt,
    });

    suggestions = aiResponse.suggestions;
  } else {
    // Fallback: simple keyword matching
    suggestions = this.matchTemplatesByKeywords(input.description, templates, input.maxSuggestions);
  }

  return this.success({
    query: input.description,
    suggestions: suggestions.map(s => ({
      templateId: s.templateId,
      name: s.name,
      description: s.description,
      matchReason: s.matchReason,
      features: s.features,
      sampleSheets: s.sheets,
    })),
  });
}

private async loadTemplates(): Promise<any[]> {
  // Load from knowledge/templates/common-templates.json
  const templatePath = path.join(__dirname, '../../knowledge/templates/common-templates.json');
  const templateData = await fs.promises.readFile(templatePath, 'utf-8');
  return JSON.parse(templateData).templates;
}
```

**Option B: Add to sheets_spreadsheet tool**
```typescript
// src/schemas/spreadsheet.ts
export const CreateFromTemplateActionSchema = z.object({
  action: z.literal('create_from_template'),
  templateId: z.string().describe('Template ID (e.g., "financial-model", "project-tracker")'),
  title: z.string().describe('Name for the new spreadsheet'),
  customizations: z.object({
    includeFormulas: z.boolean().default(true),
    includeSampleData: z.boolean().default(true),
    includeCharts: z.boolean().default(true),
  }).optional(),
}).strict();

// src/handlers/spreadsheet.ts
private async handleCreateFromTemplate(
  input: Extract<SpreadsheetAction, { action: 'create_from_template' }>
): Promise<SpreadsheetResponse> {
  const template = await this.loadTemplate(input.templateId);

  // Create spreadsheet from template
  const spreadsheet = await this.createSpreadsheetFromTemplate(
    input.title,
    template,
    input.customizations
  );

  return this.success({
    spreadsheetId: spreadsheet.spreadsheetId,
    spreadsheetUrl: spreadsheet.spreadsheetUrl,
    templateUsed: input.templateId,
    sheetsCreated: spreadsheet.sheets.length,
  });
}
```

**Estimated Time:** 6-8 hours
**Priority:** HIGH
**Impact:** Unlocks knowledge base, major UX improvement

---

#### 3. Integrate AI Formula Generation
**Problem:** Sampling has `generateFormula()` but it's not exposed via any tool

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/mcp/sampling.ts` (lines 305-387)
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/cells.ts` or `values.ts`

**Implementation:**

```typescript
// src/schemas/cells.ts (or values.ts)
export const GenerateFormulaActionSchema = z.object({
  action: z.literal('generate_formula'),
  spreadsheetId: SpreadsheetIdSchema,
  targetCell: z.string().describe('Where to place the formula (e.g., C10)'),
  description: z.string().describe('What the formula should calculate'),
  context: z.object({
    availableRanges: z.array(z.string()).optional().describe('Ranges that can be referenced'),
    sampleData: z.record(z.unknown()).optional().describe('Sample data for context'),
  }).optional(),
  dryRun: z.boolean().optional().describe('Preview formula without writing'),
}).strict();

// src/handlers/cells.ts
private async handleGenerateFormula(
  input: Extract<CellsAction, { action: 'generate_formula' }>
): Promise<CellsResponse> {
  if (!this.context.sampling) {
    return this.error({
      code: 'FEATURE_NOT_AVAILABLE',
      message: 'AI formula generation requires sampling support',
      retryable: false,
    });
  }

  const formula = await this.context.sampling.generateFormula({
    description: input.description,
    targetCell: input.targetCell,
    availableRanges: input.context?.availableRanges || [],
    sampleData: input.context?.sampleData,
  });

  if (input.dryRun) {
    return this.success({
      preview: true,
      targetCell: input.targetCell,
      generatedFormula: formula.formula,
      explanation: formula.explanation,
      warnings: formula.warnings,
    });
  }

  // Write formula to cell
  await this.writeFormulaToCell(
    input.spreadsheetId,
    input.targetCell,
    formula.formula
  );

  return this.success({
    targetCell: input.targetCell,
    formula: formula.formula,
    explanation: formula.explanation,
  });
}
```

**Estimated Time:** 4-5 hours
**Priority:** HIGH
**Impact:** Major AI-powered feature, high user value

---

#### 4. Integrate AI Chart Recommendations
**Problem:** Sampling has `recommendChart()` but charts handler doesn't use it

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/mcp/sampling.ts` (lines 390-444)
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/charts.ts`

**Implementation:**

```typescript
// src/schemas/charts.ts
export const SuggestChartActionSchema = z.object({
  action: z.literal('suggest_chart'),
  spreadsheetId: SpreadsheetIdSchema,
  dataRange: z.string().describe('Range of data to visualize'),
  purpose: z.string().optional().describe('What story should the chart tell?'),
  maxSuggestions: z.number().min(1).max(5).default(3),
}).strict();

// src/handlers/charts.ts
private async handleSuggestChart(
  input: Extract<ChartsAction, { action: 'suggest_chart' }>
): Promise<ChartsResponse> {
  const data = await this.readRange(input.spreadsheetId, input.dataRange);

  if (!this.context.sampling) {
    // Fallback: rule-based suggestions
    return this.success({
      suggestions: this.ruleBasedChartSuggestions(data),
    });
  }

  const recommendations = await this.context.sampling.recommendChart({
    data,
    purpose: input.purpose,
    maxSuggestions: input.maxSuggestions,
  });

  return this.success({
    dataRange: input.dataRange,
    suggestions: recommendations.map(rec => ({
      chartType: rec.type,
      reasoning: rec.reasoning,
      configuration: rec.suggestedConfig,
      suitabilityScore: rec.score,
    })),
  });
}
```

**Estimated Time:** 3-4 hours
**Priority:** HIGH
**Impact:** AI-powered visualization guidance

---

### 🟡 MEDIUM PRIORITY - Consistency & Coverage

#### 5. Uniform Logging Coverage
**Problem:** Only some handlers use logging (analysis, format, versions, sheet, base)

**Files:** All handler files missing logging
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/cells.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/dimensions.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/rules.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/pivot.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/filter-sort.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/comments.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/sharing.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/advanced.ts`

**Pattern to Apply:**

```typescript
// At top of handler file
import { getRequestLogger } from '../utils/logger.js';

// In constructor
constructor(context: HandlerContext, requestId?: string) {
  super(context);
  this.logger = getRequestLogger(requestId);
}

// Throughout handler methods
this.logger.info('Operation started', {
  action: input.action,
  spreadsheetId: input.spreadsheetId
});

this.logger.debug('Processing data', {
  rowCount: values.length,
  columnCount: values[0]?.length
});

this.logger.error('Operation failed', {
  error: err.message,
  action: input.action
});
```

**Estimated Time:** 2-3 hours (mechanical, can be batched)
**Priority:** MEDIUM
**Impact:** Better observability, easier debugging

---

#### 6. Extend Request Deduplication
**Problem:** Only analysis.ts uses deduplication

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/values.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/cells.ts`
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/format.ts`

**Pattern to Apply:**

```typescript
// In read-heavy operations
const cacheKey = `${input.action}:${input.spreadsheetId}:${input.range}`;

return this.context.requestDeduplicator.deduplicate(
  cacheKey,
  async () => {
    // Original operation logic
    return await this.performOperation(input);
  },
  5000 // 5 second TTL
);
```

**Estimated Time:** 2 hours
**Priority:** MEDIUM
**Impact:** Reduced API calls, better performance

---

#### 7. Complete Elicitation Usage
**Problem:** Only sheet deletion uses elicitation; could be used for more confirmations

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/values.ts` - bulk delete confirmation
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/filter-sort.ts` - filter setup wizard
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/handlers/sharing.ts` - sharing settings

**Implementation Example (values.ts):**

```typescript
// For bulk delete operations
if (input.action === 'clear' && estimatedAffectedCells > 1000) {
  if (this.context.elicitation) {
    const confirmation = await this.context.elicitation.elicitDestructiveConfirmation({
      operation: 'clear cells',
      scope: `${estimatedAffectedCells} cells in ${input.range}`,
      warning: 'This operation cannot be undone',
    });

    if (!confirmation.confirmed) {
      return this.error({
        code: 'OPERATION_CANCELLED',
        message: 'User cancelled bulk clear operation',
        retryable: false,
      });
    }
  }
}
```

**Estimated Time:** 3-4 hours
**Priority:** MEDIUM
**Impact:** Better UX for destructive operations

---

### 🟢 LOW PRIORITY - When SDK Supports

#### 8. Enable Tool Argument Completions
**Problem:** Infrastructure exists, but SDK doesn't support it yet

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/server.ts` (lines 155-157)
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/src/mcp/completions.ts` (lines 1-292)

**Current Code:**
```typescript
// Register completions
// NOTE: MCP SDK v1.25.1 only supports completions for prompts/resources, not tool arguments
// Tool argument completions will be added when SDK supports them
```

**When SDK Supports, Enable:**
```typescript
// Register tool argument completions
this.server.setRequestHandler(CompletionRequestSchema, async (request) => {
  const { ref, argument } = request.params;

  if (ref.type === 'ref/tool') {
    return await this.completions.completeToolArgument(ref.name, argument);
  }

  return { completion: { values: [] } };
});
```

**Estimated Time:** 1 hour (when SDK ready)
**Priority:** LOW (blocked on SDK)
**Impact:** Excellent DX, autocomplete for spreadsheet IDs, ranges, chart types, etc.

---

### 🟢 LOW PRIORITY - Documentation

#### 9. Document MCP Features in Main README
**Problem:** Main README doesn't mention sampling, elicitation, or AI capabilities

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/README.md`

**Add Section:**
```markdown
## AI-Powered Features

ServalSheets leverages Claude's MCP protocol extensions for intelligent operations:

### 🤖 AI Sampling (SEP-1577)
Request AI assistance for complex operations:
- **Data Analysis**: Natural language insights into your data
- **Formula Generation**: Describe what you want, get the formula
- **Chart Recommendations**: AI suggests the best visualization
- **Pattern Detection**: Identify trends, correlations, anomalies

### 💬 User Elicitation (SEP-1036)
Guided wizards for complex operations:
- **Destructive Operation Confirmations**: Safeguard against accidental data loss
- **Multi-step Wizards**: Guided setup for filters, pivots, sharing
- **Smart Defaults**: AI suggests sensible values

### ⚡ Smart Completions (Coming Soon)
Autocomplete for:
- Spreadsheet IDs
- Range references (A1:Z100)
- Chart types and colors
- Formula functions
```

**Estimated Time:** 1 hour
**Priority:** LOW
**Impact:** Better discovery of AI features

---

#### 10. Formalize Test Coverage Documentation
**Problem:** Tests exist (561 cases, 7,799 lines) but no coverage percentage documented

**Files:**
- `/Users/thomascahill/Documents/mcp-servers/servalsheets/docs/development/TESTING.md`
- Add coverage badge to README

**Implementation:**
```bash
# Add coverage script to package.json
"scripts": {
  "test:coverage": "vitest run --coverage",
  "test:coverage:html": "vitest run --coverage --reporter=html"
}

# Run coverage
npm run test:coverage

# Document results in TESTING.md
## Coverage Metrics
- Statements: 82%
- Branches: 76%
- Functions: 89%
- Lines: 84%

Target: Maintain >80% coverage for critical paths
```

**Estimated Time:** 2 hours
**Priority:** LOW
**Impact:** Professional polish, CI integration

---

## Implementation Roadmap

### Phase 1: Critical Fixes (1-2 weeks)
**Goal:** Fix documentation/implementation mismatches

1. ✅ Remove or implement missing analysis actions (detect_patterns, column_analysis)
   - **Time:** 4-6 hours
   - **Deliverable:** Updated analysis.ts, analysis-examples.json

### Phase 2: AI Integration (2-3 weeks)
**Goal:** Unlock AI-powered features

2. ✅ Implement template suggestion tool
   - **Time:** 6-8 hours
   - **Deliverable:** suggest_templates action

3. ✅ Integrate AI formula generation
   - **Time:** 4-5 hours
   - **Deliverable:** generate_formula action

4. ✅ Integrate AI chart recommendations
   - **Time:** 3-4 hours
   - **Deliverable:** suggest_chart action

### Phase 3: Consistency & Coverage (1 week)
**Goal:** Apply best practices uniformly

5. ✅ Uniform logging coverage
   - **Time:** 2-3 hours
   - **Deliverable:** All handlers with logging

6. ✅ Extend request deduplication
   - **Time:** 2 hours
   - **Deliverable:** Deduplication in values, cells, format handlers

7. ✅ Complete elicitation usage
   - **Time:** 3-4 hours
   - **Deliverable:** Confirmations for bulk operations

### Phase 4: Future Enhancements (When Ready)
**Goal:** Enable when dependencies are ready

8. ⏳ Enable tool argument completions (when SDK supports)
   - **Time:** 1 hour
   - **Blocked:** MCP SDK v1.26+

9. ✅ Document MCP features
   - **Time:** 1 hour
   - **Deliverable:** Updated README.md

10. ✅ Formalize test coverage
    - **Time:** 2 hours
    - **Deliverable:** Coverage metrics, CI integration

---

## Success Metrics

**Phase 1 Complete:**
- ✅ Zero documentation/implementation mismatches
- ✅ All example actions exist in schemas and handlers

**Phase 2 Complete:**
- ✅ 3 new AI-powered actions available
- ✅ Knowledge base integrated into tools
- ✅ Template creation from knowledge base

**Phase 3 Complete:**
- ✅ 100% of handlers have logging
- ✅ 80%+ of read operations use deduplication
- ✅ All destructive operations have elicitation

**Phase 4 Complete:**
- ✅ Completions enabled (when SDK ready)
- ✅ AI features documented in README
- ✅ Test coverage metrics published

---

## Risk Mitigation

**Risk: Breaking Changes**
- **Mitigation:** All enhancements are additive (new actions, extended functionality)
- **Strategy:** Maintain backward compatibility, add new actions alongside existing

**Risk: AI Feature Dependency**
- **Mitigation:** All AI features have fallbacks (rule-based suggestions)
- **Strategy:** Graceful degradation when sampling unavailable

**Risk: Performance Impact**
- **Mitigation:** Logging is async, deduplication reduces load
- **Strategy:** Benchmark before/after each phase

---

## Estimated Total Effort

- **Phase 1 (Critical):** 4-6 hours
- **Phase 2 (AI Integration):** 13-17 hours
- **Phase 3 (Consistency):** 7-9 hours
- **Phase 4 (Future):** 4 hours

**Total: 28-36 hours** (~1 week of focused development)

---

**Status:** Ready for implementation
**Next Step:** Review with team, prioritize phases, assign ownership
**Tracking:** Create GitHub issues for each enhancement with this plan as reference

**Document Version:** 1.0
**Last Updated:** 2026-01-04
