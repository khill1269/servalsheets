# ServalSheets Comprehensive Improvement Plan

> **Version**: 1.6.0 → 2.0.0 | **Created**: 2026-02-01

This document outlines a complete improvement plan to make ServalSheets the most advanced MCP server.

---

## Current State Summary

| Component | Count | Status |
|-----------|-------|--------|
| **Tools** | 21 | ✅ Complete |
| **Actions** | 291 | ✅ Complete |
| **Resources** | 50+ | ⚠️ Needs consolidation |
| **Prompts** | 20 | ⚠️ Needs enhancement |
| **Knowledge** | 38 files | ⚠️ Needs better indexing |
| **Documentation** | 241 files | ⚠️ Needs organization |

---

## Complete Tool & Action Registry (291 Actions)

### Tool Breakdown by Action Count

| Tool | Actions | Category |
|------|---------|----------|
| `sheets_collaborate` | 35 | Collaboration |
| `sheets_dimensions` | 28 | Structure |
| `sheets_advanced` | 26 | Advanced |
| `sheets_session` | 26 | Context |
| `sheets_format` | 21 | Formatting |
| `sheets_data` | 18 | Data |
| `sheets_visualize` | 18 | Visualization |
| `sheets_core` | 17 | Core |
| `sheets_analyze` | 16 | AI Analysis |
| `sheets_appsscript` | 14 | Enterprise |
| `sheets_bigquery` | 14 | Enterprise |
| `sheets_composite` | 10 | High-Level |
| `sheets_templates` | 8 | Templates |
| `sheets_dependencies` | 7 | Analysis |
| `sheets_history` | 7 | Audit |
| `sheets_webhook` | 6 | Events |
| `sheets_transaction` | 6 | Atomic |
| `sheets_confirm` | 5 | Elicitation |
| `sheets_auth` | 4 | Auth |
| `sheets_quality` | 4 | QA |
| `sheets_fix` | 1 | Auto-Fix |
| **TOTAL** | **291** | |

---

## Phase 1: Resource Architecture Overhaul

### 1.1 URI Scheme Consolidation

**Current Problem**: 8+ different URI schemes cause confusion

| Current Scheme | Files Using | Problem |
|----------------|-------------|---------|
| `sheets:///` | 5 | Conflicts with scheme concept |
| `schema://` | 1 | Non-standard |
| `knowledge:///` | 1 | OK but inconsistent |
| `servalsheets://` | 4 | Best pattern |
| `history://` | 1 | Non-standard |
| `cache://` | 1 | Non-standard |
| `metrics://` | 1 | Non-standard |
| `discovery://` | 1 | Non-standard |
| `analyze://` | 1 | Non-standard |
| `confirm://` | 1 | Non-standard |
| `transaction://` | 1 | Non-standard |
| `conflict://` | 1 | Non-standard |
| `impact://` | 1 | Non-standard |
| `validation://` | 1 | Non-standard |

**Solution**: Consolidate to hierarchical `servalsheets://` scheme:

```
servalsheets://
├── data/                          # Live spreadsheet data
│   ├── {spreadsheetId}            # Metadata
│   ├── {spreadsheetId}/{range}    # Cell values
│   ├── {spreadsheetId}/charts     # Charts
│   ├── {spreadsheetId}/pivots     # Pivot tables
│   └── {spreadsheetId}/quality    # Quality metrics
├── schema/                        # Tool schemas
│   ├── index                      # All tools
│   └── {toolName}                 # Individual tool
├── knowledge/                     # AI knowledge base
│   ├── index                      # Knowledge index
│   ├── api/{file}                 # API knowledge
│   ├── formulas/{file}            # Formula knowledge
│   ├── templates/{file}           # Template knowledge
│   ├── schemas/{file}             # Schema knowledge
│   └── masterclass/{file}         # Advanced knowledge
├── guide/                         # Performance guides
│   ├── quota-optimization
│   ├── batching-strategies
│   ├── caching-patterns
│   └── error-recovery
├── example/                       # Code examples
│   ├── basic-operations
│   ├── batch-operations
│   ├── transactions
│   ├── composite-workflows
│   ├── analysis-visualization
│   └── comparative-tradeoffs
├── pattern/                       # UASEV+R workflows
│   ├── simple_read
│   ├── batch_read
│   ├── transactional_write
│   └── comprehensive_audit
├── decision/                      # Decision trees
│   ├── when-to-use-transaction
│   ├── when-to-confirm
│   ├── tool-selection
│   └── read-vs-batch-read
└── monitor/                       # Observability
    ├── history                    # Operation history
    ├── cache                      # Cache stats
    ├── metrics                    # Performance
    ├── discovery                  # API health
    ├── analyze                    # Analysis results
    ├── confirm                    # Confirmation stats
    ├── transaction                # Transaction state
    ├── conflict                   # Conflicts
    ├── impact                     # Impact analysis
    └── validation                 # Validation rules
```

**Implementation Files**:
- `src/resources/index.ts` - Update exports
- `src/mcp/registration/resource-registration.ts` - Core data resources
- `src/resources/*.ts` - All 23 resource files

**Effort**: 8 hours | **Priority**: HIGH

---

### 1.2 Master Index Resource

**New Resource**: `servalsheets://index`

```typescript
// src/resources/index-resource.ts
export function registerIndexResource(server: McpServer): void {
  server.registerResource(
    'ServalSheets Index',
    'servalsheets://index',
    {
      description: 'Master index of all ServalSheets resources with categories, counts, and quick start guides',
      mimeType: 'application/json',
    },
    async () => {
      return {
        contents: [{
          uri: 'servalsheets://index',
          mimeType: 'application/json',
          text: JSON.stringify({
            version: '1.6.0',
            protocol: 'MCP 2025-11-25',
            stats: {
              tools: 21,
              actions: 291,
              resources: 50,
              prompts: 20,
              knowledgeFiles: 38,
            },
            categories: {
              data: {
                count: 5,
                description: 'Live spreadsheet data access',
                uriPattern: 'servalsheets://data/{spreadsheetId}/...',
                examples: ['servalsheets://data/1abc.../Sheet1!A1:D10'],
              },
              schema: {
                count: 21,
                description: 'Tool schemas for deferred loading',
                uriPattern: 'servalsheets://schema/{toolName}',
                examples: ['servalsheets://schema/sheets_data'],
              },
              knowledge: {
                count: 38,
                description: 'AI knowledge base for formulas, templates, patterns',
                uriPattern: 'servalsheets://knowledge/{category}/{file}',
                examples: ['servalsheets://knowledge/formulas/financial.json'],
              },
              guide: {
                count: 4,
                description: 'Performance and optimization guides',
                examples: ['servalsheets://guide/batching-strategies'],
              },
              example: {
                count: 6,
                description: 'Code examples by category',
                examples: ['servalsheets://example/transactions'],
              },
              pattern: {
                count: 5,
                description: 'UASEV+R workflow patterns',
                examples: ['servalsheets://pattern/simple_read'],
              },
              decision: {
                count: 4,
                description: 'Decision trees for tool selection',
                examples: ['servalsheets://decision/tool-selection'],
              },
              monitor: {
                count: 10,
                description: 'Observability and diagnostics',
                examples: ['servalsheets://monitor/history'],
              },
            },
            quickStart: {
              firstTimeUser: [
                'servalsheets://schema/sheets_auth',
                'servalsheets://pattern/simple_read',
                'servalsheets://guide/batching-strategies',
              ],
              developer: [
                'servalsheets://schema/index',
                'servalsheets://decision/tool-selection',
                'servalsheets://example/transactions',
              ],
            },
          }, null, 2),
        }],
      };
    }
  );
}
```

**Effort**: 2 hours | **Priority**: HIGH

---

### 1.3 Resource List Changed Notifications

**Implementation**: Add `notifications/resources/list_changed` for dynamic resources

```typescript
// src/resources/notifications.ts
export class ResourceNotificationManager {
  private server: McpServer;

  constructor(server: McpServer) {
    this.server = server;
  }

  // Notify when analysis results are added
  notifyAnalysisAdded(analysisId: string): void {
    this.server.sendNotification({
      method: 'notifications/resources/list_changed',
    });
  }

  // Notify when cache is invalidated
  notifyCacheInvalidated(): void {
    this.server.sendNotification({
      method: 'notifications/resources/list_changed',
    });
  }

  // Notify when transaction state changes
  notifyTransactionStateChanged(): void {
    this.server.sendNotification({
      method: 'notifications/resources/list_changed',
    });
  }
}
```

**Effort**: 4 hours | **Priority**: MEDIUM

---

## Phase 2: Knowledge Base Enhancement

### 2.1 Semantic Knowledge Index

**New Resource**: `servalsheets://knowledge/index`

```json
{
  "version": "1.6.0",
  "totalFiles": 38,
  "categories": {
    "api": {
      "description": "Google Sheets API patterns and limits",
      "files": 7,
      "topics": ["batch-operations", "charts", "validation", "quotas"]
    },
    "formulas": {
      "description": "Formula recipes and function references",
      "files": 6,
      "topics": ["financial", "datetime", "lookup", "arrays"]
    },
    "templates": {
      "description": "Pre-built spreadsheet templates",
      "files": 7,
      "topics": ["budget", "project", "crm", "inventory"]
    },
    "schemas": {
      "description": "Data structure definitions",
      "files": 3,
      "topics": ["project", "crm", "inventory"]
    },
    "patterns": {
      "description": "Workflow and UI/UX patterns",
      "files": 6,
      "topics": ["workflows", "intent", "confirmation"]
    },
    "masterclass": {
      "description": "Advanced optimization guides",
      "files": 7,
      "topics": ["formulas", "performance", "quality", "security"]
    }
  },
  "searchable": true,
  "relationships": {
    "api/batch-operations.md": [
      "formulas/advanced.json",
      "patterns/workflow-patterns.json"
    ],
    "templates/finance.json": [
      "formulas/financial.json",
      "schemas/project.json"
    ]
  }
}
```

**Effort**: 4 hours | **Priority**: MEDIUM

---

### 2.2 Action-Oriented Descriptions

**Before** (generic):
```typescript
description: "Google Sheets API reference and patterns: batch operations"
```

**After** (action-oriented):
```typescript
description: "Use when performing 3+ operations on same spreadsheet. Shows batch_read/batch_write patterns for 80% API quota reduction. Includes before/after code examples."
```

**Implementation**: Update `getResourceDescription()` in `knowledge.ts`:

```typescript
const KNOWLEDGE_DESCRIPTIONS: Record<string, string> = {
  // API Knowledge
  'api/batch-operations':
    'Use when performing 3+ reads/writes. Shows batch patterns for 80% quota savings with code examples.',
  'api/charts':
    'Use when creating visualizations. Covers 17 chart types with configuration options and best practices.',
  'api/conditional-formatting':
    'Use when highlighting data patterns. Shows conditional format rules with color scales, icons, and formulas.',
  'api/data-validation':
    'Use when constraining input. Covers dropdowns, dates, numbers, custom formulas, and error messages.',
  'api/named-ranges':
    'Use for readable formulas. Shows creating, updating, and using named ranges across sheets.',
  'api/pivot-tables':
    'Use for data summarization. Covers pivot creation, grouping, calculated fields, and refresh.',
  'api/limits/quotas':
    'CRITICAL: API limits reference. 100 requests/100 seconds per user. Plan operations accordingly.',

  // Formula Knowledge
  'formulas/functions-reference':
    '100+ formula functions with syntax, examples, and common mistakes.',
  'formulas/financial':
    'NPV, IRR, PMT, FV formulas for budgets, loans, and investments.',
  'formulas/datetime':
    'DATE, DATEDIF, NETWORKDAYS for scheduling and time calculations.',
  'formulas/lookup':
    'VLOOKUP, INDEX/MATCH, XLOOKUP for data retrieval across sheets.',
  'formulas/advanced':
    'ARRAYFORMULA, QUERY, FILTER for power-user data manipulation.',

  // Template Knowledge
  'templates/finance':
    'Budget tracking template with income, expenses, charts. Use with setup_budget prompt.',
  'templates/project':
    'Project management with tasks, milestones, Gantt chart. Includes dependencies.',
  'templates/crm':
    'Customer tracking with contacts, deals, pipeline. Integration-ready schema.',
  'templates/inventory':
    'Inventory management with stock levels, reorder points, valuation.',
  'templates/sales':
    'Sales pipeline with stages, forecasting, team performance.',
  'templates/marketing':
    'Campaign tracking with channels, spend, ROI analysis.',

  // Pattern Knowledge
  'workflow-patterns':
    'Multi-tool workflow examples: read→analyze→transform→verify sequences.',
  'natural-language-guide':
    'How to interpret user requests and map to tool sequences.',
  'user-intent-examples':
    '50+ user intent examples with correct tool mappings.',
  'confirmation-guide':
    'When to use sheets_confirm: thresholds, destructive ops, multi-step.',
  'formula-antipatterns':
    'Common formula mistakes: volatile functions, circular refs, performance.',

  // Masterclass Knowledge
  'masterclass/formula-optimization-master':
    'Advanced formula optimization: reduce calculations, leverage arrays, minimize volatility.',
  'masterclass/performance-tuning-master':
    'Performance tuning: caching, batching, lazy loading, parallel execution.',
  'masterclass/data-quality-master':
    'Data quality standards: validation rules, anomaly detection, consistency checks.',
  'masterclass/schema-governance-master':
    'Schema design: naming conventions, type safety, documentation.',
  'masterclass/security-compliance-master':
    'Security best practices: permissions, audit trails, PII handling.',
  'masterclass/apps-script-integration-master':
    'Apps Script integration: triggers, custom functions, web apps.',
  'masterclass/concurrency-patterns-master':
    'Concurrent editing: conflict detection, resolution strategies, locking.',
};
```

**Effort**: 4 hours | **Priority**: HIGH

---

### 2.3 Knowledge Search Resource

**New Resource**: `servalsheets://knowledge/search?q={query}`

```typescript
// src/resources/knowledge-search.ts
export function registerKnowledgeSearchResource(server: McpServer): void {
  server.registerResource(
    'Knowledge Search',
    'servalsheets://knowledge/search',
    {
      description: 'Fuzzy search across all knowledge files. Use ?q=query parameter.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const url = new URL(uri.toString(), 'servalsheets://localhost');
      const query = url.searchParams.get('q') || '';

      if (!query) {
        return {
          contents: [{
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({
              error: 'Missing query parameter',
              usage: 'servalsheets://knowledge/search?q=your+search+term',
              examples: [
                'servalsheets://knowledge/search?q=VLOOKUP',
                'servalsheets://knowledge/search?q=budget+template',
                'servalsheets://knowledge/search?q=batch+operations',
              ],
            }, null, 2),
          }],
        };
      }

      const results = searchKnowledge(query);

      return {
        contents: [{
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify({
            query,
            resultCount: results.length,
            results: results.map(r => ({
              uri: r.uri,
              name: r.name,
              description: r.description,
              score: r.score,
              excerpt: r.excerpt,
            })),
          }, null, 2),
        }],
      };
    }
  );
}

function searchKnowledge(query: string): SearchResult[] {
  // Fuzzy search implementation
  // Score based on: title match, description match, content match
  // Return sorted by relevance score
}
```

**Effort**: 6 hours | **Priority**: MEDIUM

---

## Phase 3: Prompt Enhancement

### 3.1 Context-Aware Prompts

**Enhancement**: Add prompts that auto-detect spreadsheet context

```typescript
// New prompt: auto_analyze
server.registerPrompt(
  'auto_analyze',
  {
    description: '🔮 Auto-detect and analyze spreadsheet type, suggest best workflows',
    argsSchema: { spreadsheetId: { type: 'string', required: true } },
  },
  async (args) => {
    // This prompt instructs Claude to:
    // 1. Get spreadsheet metadata
    // 2. Detect type (budget, CRM, inventory, etc.)
    // 3. Suggest matching knowledge resources
    // 4. Recommend prompts and workflows
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `🔮 Auto-Analyzing spreadsheet: ${args['spreadsheetId']}

1. First, get metadata: sheets_core action "get"
2. Analyze structure: sheets_analyze action "analyze_structure"
3. Based on detected type, recommend:
   - Matching template from knowledge base
   - Relevant formulas and patterns
   - Best prompts for this type

Detection hints:
- Budget: Has "income", "expense", "balance" columns
- CRM: Has "name", "email", "phone", "company" columns
- Inventory: Has "SKU", "quantity", "price" columns
- Project: Has "task", "status", "due date", "assignee" columns

After analysis, suggest the 3 most relevant:
- knowledge:// resources
- servalsheets:// prompts
- Action sequences`,
        },
      }],
    };
  }
);
```

### 3.2 Chained Prompts

**Enhancement**: Add prompts that chain multiple workflows

```typescript
// New prompt: full_setup
server.registerPrompt(
  'full_setup',
  {
    description: '🚀 Complete spreadsheet setup: create, format, populate, share',
    argsSchema: {
      type: { type: 'string', enum: ['budget', 'crm', 'inventory', 'project'] },
      name: { type: 'string' },
      collaborators: { type: 'array', items: { type: 'string' } },
    },
  },
  async (args) => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `🚀 Full Setup: Creating ${args['type']} spreadsheet "${args['name']}"

This will execute a 5-step workflow:

## Step 1: Create Spreadsheet
- sheets_core action "create" with title "${args['name']}"
- Remember the spreadsheetId

## Step 2: Apply Template
- Read template from knowledge://templates/${args['type']}.json
- sheets_composite action "setup_sheet" with schema

## Step 3: Add Formulas
- Read formulas from knowledge://formulas/${args['type'] === 'budget' ? 'financial' : 'advanced'}.json
- Apply relevant formulas

## Step 4: Format
- sheets_format action "apply_preset" for headers
- Add conditional formatting for key metrics
- Auto-fit columns

## Step 5: Share
${args['collaborators']?.length ? `- Share with: ${args['collaborators'].join(', ')}
- sheets_collaborate action "share_add" for each` : '- Skip sharing (no collaborators specified)'}

## Safety
- Use sheets_confirm before any destructive operations
- Create snapshot after setup complete

Ready to begin?`,
        },
      }],
    };
  }
);
```

### 3.3 New Prompts to Add

| Prompt | Description | Arguments |
|--------|-------------|-----------|
| `auto_analyze` | Auto-detect spreadsheet type | `spreadsheetId` |
| `full_setup` | Complete setup workflow | `type`, `name`, `collaborators` |
| `optimize_performance` | Performance audit & fixes | `spreadsheetId` |
| `audit_security` | Security & permissions audit | `spreadsheetId` |
| `generate_documentation` | Auto-generate sheet docs | `spreadsheetId` |
| `compare_spreadsheets` | Diff two spreadsheets | `spreadsheetId1`, `spreadsheetId2` |
| `consolidate_data` | Merge multiple sheets | `spreadsheetIds[]`, `targetId` |
| `schedule_refresh` | Set up auto-refresh | `spreadsheetId`, `interval` |

**Effort**: 8 hours | **Priority**: MEDIUM

---

## Phase 4: Documentation Organization

### 4.1 Documentation Structure Cleanup

**Current Issues**:
- 100+ files in archive
- Duplicate content across guides
- Outdated references

**Action Plan**:

1. **Archive Cleanup** (2 hours)
   - Move all `docs/archive/` to separate branch
   - Keep only active documentation in main

2. **Consolidate Guides** (4 hours)
   - Merge overlapping guides
   - Create single source of truth per topic

3. **Update References** (2 hours)
   - Fix all outdated action counts (272 → 291)
   - Update protocol version references
   - Fix broken links

### 4.2 Auto-Generated Documentation

**Enhancement**: Generate documentation from schemas

```typescript
// scripts/generate-docs.ts
// Auto-generate:
// - docs/reference/tools/*.md from schemas
// - docs/reference/actions.md from TOOL_ACTIONS
// - docs/reference/resources.md from resource registrations
```

**Effort**: 6 hours | **Priority**: LOW

---

## Phase 5: Advanced Features

### 5.1 Resource Subscriptions

```typescript
// Enable clients to subscribe to resource changes
server.registerResourceSubscription(
  'servalsheets://monitor/*',
  async (uri, callback) => {
    // Notify on changes to monitoring resources
  }
);
```

### 5.2 Resource Versioning

```typescript
// Access specific schema versions
'servalsheets://schema/sheets_data@1.6.0'
'servalsheets://schema/sheets_data@1.5.0'
```

### 5.3 Streaming for Large Resources

```typescript
// Stream large data resources
server.registerStreamingResource(
  'servalsheets://data/{spreadsheetId}/{range}',
  async function* (uri, variables) {
    for await (const chunk of streamData(spreadsheetId, range)) {
      yield chunk;
    }
  }
);
```

**Effort**: 16 hours | **Priority**: LOW

---

## Implementation Timeline

### Week 1: Foundation (Phase 1)
| Day | Task | Hours |
|-----|------|-------|
| 1-2 | URI Scheme Consolidation | 8 |
| 3 | Master Index Resource | 2 |
| 4 | Resource Notifications | 4 |
| 5 | Testing & Fixes | 4 |

### Week 2: Knowledge (Phase 2)
| Day | Task | Hours |
|-----|------|-------|
| 1 | Semantic Knowledge Index | 4 |
| 2 | Action-Oriented Descriptions | 4 |
| 3-4 | Knowledge Search | 6 |
| 5 | Testing & Integration | 4 |

### Week 3: Prompts & Docs (Phase 3-4)
| Day | Task | Hours |
|-----|------|-------|
| 1-2 | Context-Aware Prompts | 4 |
| 2-3 | Chained Prompts | 4 |
| 3-4 | Documentation Cleanup | 8 |
| 5 | Testing & Polish | 4 |

### Week 4: Advanced (Phase 5)
| Day | Task | Hours |
|-----|------|-------|
| 1-3 | Resource Subscriptions | 8 |
| 4-5 | Versioning & Streaming | 8 |

---

## Success Metrics

### Phase 1 Complete When:
- [ ] Single URI scheme (`servalsheets://`)
- [ ] Master index resource working
- [ ] Resource notifications implemented
- [ ] All tests passing

### Phase 2 Complete When:
- [ ] Knowledge index with relationships
- [ ] All 38 files have action-oriented descriptions
- [ ] Knowledge search functional
- [ ] Fuzzy matching returns relevant results

### Phase 3 Complete When:
- [ ] 8 new prompts added
- [ ] Auto-detection working
- [ ] Chained workflows functional
- [ ] Prompt coverage for all common tasks

### Phase 4 Complete When:
- [ ] Archive cleaned
- [ ] Guides consolidated
- [ ] All references updated to 293 actions
- [ ] Auto-generation working

### Phase 5 Complete When:
- [ ] Resource subscriptions functional
- [ ] Versioning implemented
- [ ] Streaming for large data
- [ ] Full MCP 2025-11-25 compliance

---

## Quick Wins (Implement Now)

1. **Update action count** (15 min)
   - Fix SERVALSHEETS_COMPLETE_MAP.md: 272 → 291

2. **Add index resource** (2 hours)
   - Create `servalsheets://index`

3. **Improve 5 key knowledge descriptions** (1 hour)
   - batch-operations, quotas, formulas, templates, patterns

4. **Add auto_analyze prompt** (1 hour)
   - Most requested workflow

---

*Plan created: 2026-02-01 | Target completion: 2026-02-28*
