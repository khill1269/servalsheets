# BigQuery & Apps Script Integration Analysis for ServalSheets

## Executive Summary

| Feature | Priority | Implementation Time | Value Score |
|---------|----------|-------------------|-------------|
| **BigQuery Connected Sheets** | 🟡 Medium-High | 3-5 days | ⭐⭐⭐⭐ (8/10 standalone, 9/10 integrated) |
| **Apps Script API** | 🟢 Medium | 2-3 days | ⭐⭐⭐ (6/10 standalone, 8/10 integrated) |

**Decision**: Implement BOTH features for "most advanced Google Sheets MCP server" positioning.

**Total Timeline**: 7-11 days for both features

---

## Part 1: BigQuery Connected Sheets

### What It Does

BigQuery Connected Sheets allows users to:
- Connect Google Sheets directly to BigQuery data warehouses
- Analyze **billions of rows** without loading data into Sheets
- Use familiar Sheets tools (pivot tables, charts, formulas) on massive datasets
- Create real-time dashboards that auto-refresh from BigQuery

### Use Cases

#### Enterprise Data Analysis
| Use Case | Description | Value |
|----------|-------------|-------|
| **Sales Analytics** | Connect sales database to Sheets for territory analysis | High |
| **Financial Reporting** | Pull accounting data for month-end reconciliation | High |
| **Customer Segmentation** | Analyze millions of customer records with pivot tables | High |
| **Marketing Attribution** | Connect ad spend data with conversion tracking | High |

#### Business Intelligence
| Use Case | Description | Value |
|----------|-------------|-------|
| **Executive Dashboards** | Auto-updating KPI dashboards from data warehouse | Very High |
| **Ad-hoc Analysis** | Let non-technical users query big data | Very High |
| **Data Exploration** | Investigate anomalies without SQL knowledge | High |

### Pros ✅

| Advantage | Impact |
|-----------|--------|
| **No SQL Required** | Business users can analyze petabytes with familiar Sheets interface |
| **Real-time Data** | Scheduled refreshes keep dashboards current |
| **Billions of Rows** | Process datasets impossible in regular Sheets (59M+ rows tested) |
| **Familiar Tools** | Pivot tables, charts, formulas work on BigQuery data |
| **API Available** | Full programmatic control via Sheets API |

### Cons ❌

| Limitation | Impact |
|------------|--------|
| **Enterprise Only** | Requires G Suite Business/Enterprise/Education |
| **Read-Only** | Cannot write back to BigQuery from Sheets |
| **Row Limits** | Pivot tables limited to 50,000 rows results |
| **GCP Required** | Must have Google Cloud project with billing |

### Implementation: 3-5 Days

**Day 1: Foundation (4-5h)**
- Create `src/services/bigquery-client.ts`
- Add OAuth scopes (`bigquery.readonly`, `bigquery`)
- Implement BigQueryClient class

**Day 2: Core Tool (5-6h)**
- Create `src/schemas/bigquery.ts` with discriminated union
- Create `src/handlers/bigquery.handler.ts`
- Actions: connect, query, refresh, list_connections

**Day 3: Connected Sheets API (4-5h)**
- DataSource management
- Query-to-sheet workflow
- Preview mode

**Day 4: Testing (3-4h)**
- Real BigQuery testing
- Large result handling
- Error handling

---

## Part 2: Apps Script API

### What It Does

Apps Script API allows you to:
- Execute Google Apps Script functions remotely
- Manage script projects, deployments, and versions
- Run custom automation code bound to spreadsheets
- Create and manage triggers programmatically

### Use Cases

#### Automation & Workflows
| Use Case | Description | Value |
|----------|-------------|-------|
| **Custom Menus** | Add menu items that trigger complex operations | High |
| **Email Automation** | Send templated emails from Sheets data | High |
| **Cross-App Workflows** | Sync Sheets ↔ Docs ↔ Gmail ↔ Calendar | Very High |
| **Scheduled Reports** | Generate and email reports on schedule | High |

#### Triggers & Events
| Use Case | Description | Value |
|----------|-------------|-------|
| **onEdit Triggers** | React to cell changes in real-time | High |
| **Time-based Triggers** | Run scripts on schedule (hourly/daily) | High |
| **Form Submit Triggers** | Process form responses automatically | High |

#### Advanced Integrations
| Use Case | Description | Value |
|----------|-------------|-------|
| **Webhook Endpoints** | Create web apps that receive webhooks | Very High |
| **Custom Functions** | Add custom spreadsheet functions | High |
| **External API Calls** | Fetch data from third-party APIs | Very High |

### Pros ✅

| Advantage | Impact |
|-----------|--------|
| **Full Google Workspace Access** | Gmail, Calendar, Drive, Docs - all accessible |
| **Serverless** | No infrastructure to manage |
| **Free Tier** | Generous quotas for most use cases |
| **Trigger System** | Powerful event-driven automation |
| **Web Apps** | Create custom UIs and APIs |

### Cons ❌

| Limitation | Impact |
|------------|--------|
| **Security Risk** | Remote code execution concerns |
| **OAuth Complexity** | Must request all scopes used by target script |
| **No Service Accounts** | OAuth-only, user must authorize |
| **Execution Limits** | 6 min timeout (consumer), 30 min (Workspace) |

### Implementation: 2-3 Days

**Day 1: Core Infrastructure (4-5h)**
- Add OAuth scopes (script.projects, script.deployments, etc.)
- Create `src/services/appscript-client.ts`
- Implement AppsScriptClient using `googleapis` client

**Day 2: Tool Handler (4-5h)**
- Create `src/schemas/appscript.ts`
- Actions: project_create, script_run, deploy_create, etc.
- Create `src/handlers/appscript.handler.ts`

**Day 3: Integration & Testing (3-4h)**
- Script templates (sheets_automation, scheduled_report)
- `create_bound_script` convenience action
- Error handling for common issues

---

## Part 3: Integration Value

### Why Both Together?

| Integration Benefit | Description |
|---------------------|-------------|
| **Unified OAuth** | Single token for Sheets + BigQuery + Apps Script |
| **Cross-Feature Workflows** | Pull BigQuery → Transform with Script → Format in Sheets |
| **Single MCP Context** | All operations in one tool set |
| **Atomic Operations** | Combine read + execute + format in transactions |

### Example Integrated Workflows

**ETL Pipeline**:
1. Query BigQuery data → write to staging sheet
2. Run Apps Script for custom transformation
3. Format results and create charts

**Automated Reporting**:
1. Pull BigQuery analytics daily
2. Generate charts and formatting
3. Run Apps Script to email report

**Data Sync**:
1. Apps Script trigger on sheet change
2. Push changes to BigQuery
3. Maintain sync status

---

## Part 4: Tool Schemas

### BigQuery Tool
```typescript
const BigQuerySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('connect'),
    spreadsheetId: z.string(),
    projectId: z.string(),
    datasetId: z.string(),
    tableId: z.string().optional()
  }),
  z.object({
    action: z.literal('query'),
    spreadsheetId: z.string(),
    sql: z.string(),
    destinationRange: z.string(),
    writeDisposition: z.enum(['OVERWRITE', 'APPEND']).default('OVERWRITE')
  }),
  z.object({
    action: z.literal('refresh'),
    spreadsheetId: z.string(),
    dataSourceId: z.string()
  }),
  z.object({
    action: z.literal('list_connections'),
    spreadsheetId: z.string()
  })
]);
```

### Apps Script Tool
```typescript
const AppsScriptSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('project_create'),
    title: z.string().min(1),
    parentId: z.string().optional().describe('Spreadsheet ID to bind script to')
  }),
  z.object({
    action: z.literal('script_run'),
    scriptId: z.string(),
    functionName: z.string(),
    parameters: z.array(z.any()).optional(),
    devMode: z.boolean().default(false)
  }),
  z.object({
    action: z.literal('create_bound_script'),
    spreadsheetId: z.string(),
    scriptName: z.string(),
    template: z.enum(['sheets_automation', 'data_validation', 'scheduled_report']).optional(),
    code: z.string().optional()
  }),
  // ... additional actions
]);
```

---

## Part 5: Critical Notes

### Apps Script API Limitations

1. **No Service Account Support**: Apps Script API does NOT work with service accounts
2. **Shared Cloud Project Required**: Calling app must share same Cloud Platform project with script
3. **Parameter Restrictions**: Only primitive types (string, number, array, object, boolean)
4. **Cannot Pass Script Objects**: No Document, SpreadsheetApp, etc. as parameters

### BigQuery Connected Sheets Limitations

1. **Enterprise Only**: Requires G Suite Business/Enterprise/Education
2. **Read-Only**: Cannot write back to BigQuery from Sheets
3. **Result Limits**: Pivot tables limited to 50,000 rows
4. **Async Operations**: Must poll for data execution completion

---

## Part 6: Implementation Order

### Recommended Sequence

1. **BigQuery First** (3-5 days)
   - Higher enterprise value
   - No existing MCP alternative
   - Lower security risk

2. **Apps Script Second** (2-3 days)
   - Build on BigQuery OAuth infrastructure
   - Reference mohalmah patterns
   - Focus on execution, not project management

3. **Unified Workflows** (2 days)
   - Cross-feature orchestration
   - Templates for common patterns

**Total: 7-11 days**

---

*Document generated: January 2026*
*ServalSheets Version: 1.1.1*
