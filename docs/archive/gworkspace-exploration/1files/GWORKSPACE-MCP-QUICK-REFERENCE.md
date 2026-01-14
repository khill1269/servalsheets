# GWorkspace MCP Quick Reference Card

## 📊 Key Metrics
```
Tools:      16          Resources:   25+
Actions:    211         Prompts:     12
APIs:       4           Est. LOC:    15-20K
```

## 🔧 Tools At-A-Glance

| Tool | Actions | Primary Purpose |
|------|---------|-----------------|
| `gw_spreadsheet` | 16 | Spreadsheet/sheet management |
| `gw_cells` | 14 | Read/write cell data ⭐MOST USED |
| `gw_rows` | 10 | Row operations |
| `gw_columns` | 10 | Column operations |
| `gw_style` | 18 | Visual formatting |
| `gw_rules` | 16 | Validation + conditional formatting |
| `gw_charts` | 14 | Charts + pivot tables |
| `gw_formulas` | 12 | Formula generation ⭐KILLER FEATURE |
| `gw_filter` | 10 | Filter, sort, deduplicate |
| `gw_share` | 14 | Permissions + comments |
| `gw_files` | 12 | Export/import + versions |
| `gw_triggers` | 10 | Event automation |
| `gw_scripts` | 12 | Apps Script management |
| `gw_query` | 16 | BigQuery integration |
| `gw_workflow` | 12 | High-level workflows ⭐FLAGSHIP |
| `gw_help` | 6 | Self-documentation |

## 🧠 Intelligence Features

### Sampling (Server → LLM)
```
Champions: gw_formulas, gw_workflow, gw_scripts, gw_charts, gw_query
Use for:   Formula generation, chart recommendations, SQL generation
```

### Elicitation (Server → User)  
```
Champions: gw_share (security), gw_query (costs), gw_filter (data loss)
Use for:   Destructive confirmations, permission changes, cost warnings
```

### Streaming (Progress)
```
Champions: gw_workflow, gw_files, gw_query
Use for:   Multi-step workflows, large imports/exports, long queries
```

### Safety Features
```
Snapshot:  gw_rows/columns (delete), gw_filter (deduplicate)
Diff:      gw_cells (find_replace), gw_filter (deduplicate)
Dry Run:   gw_query, gw_formulas, gw_triggers
Undo:      All destructive operations (except transfer_ownership)
```

## 🏷️ Tool Annotations

| Type | readOnly | destructive | idempotent | openWorld |
|------|----------|-------------|------------|-----------|
| Read | ✅ | ❌ | ✅ | ✅ |
| Write | ❌ | ❌ | varies | ✅ |
| Delete | ❌ | ✅ | ✅ | ✅ |
| Create | ❌ | ❌ | ❌ | ✅ |

## 🔴 High-Risk Operations

| Operation | Risk | Required Safety |
|-----------|------|-----------------|
| `gw_share.transfer_ownership` | ⚠️ IRREVERSIBLE | Extreme confirmation |
| `gw_query.run_query` | 💰 COSTS MONEY | Cost estimate + confirm |
| `gw_query.schedule_refresh` | 💰 RECURRING COST | Monthly cost warning |
| `gw_filter.deduplicate` | 🔴 DATA LOSS | Snapshot + confirm |
| `gw_rows.delete` (bulk) | 🔴 DATA LOSS | Count + confirm |
| `gw_scripts.run` | ⚡ SIDE EFFECTS | Show what will happen |
| `gw_scripts.deploy` | 🔓 PUBLIC ACCESS | Security warning |

## 📦 NPM Setup
```bash
npm install @modelcontextprotocol/sdk@^1.22.0 \
            googleapis@^140.0.0 \
            google-auth-library@^9.0.0 \
            zod@^3.25.0 \
            express@^4.18.0
```

## 🔄 API Mapping

| API | Tools Using It |
|-----|---------------|
| Sheets v4 | All except gw_share, gw_files, gw_triggers, gw_scripts, gw_query |
| Drive v3 | gw_share, gw_files, gw_spreadsheet (copy/delete) |
| BigQuery | gw_query |
| Apps Script | gw_triggers, gw_scripts |

## 💡 Quick Code Patterns

### Tool Registration
```typescript
server.registerTool("gw_cells.read", {
  title: "Read Cells",
  inputSchema: { 
    spreadsheetId: z.string(), 
    range: z.string() 
  },
  annotations: { 
    readOnlyHint: true, 
    destructiveHint: false 
  }
}, handler);
```

### Sampling Call
```typescript
const formula = await samplingService.createMessage({
  messages: [{ role: "user", content: prompt }],
  systemPrompt: "You are a Google Sheets expert.",
  maxTokens: 500
});
```

### Elicitation
```typescript
const confirmed = await elicitationService.confirm({
  message: `Delete ${rowCount} rows?`,
  itemCount: rowCount
});
```

### Progress Streaming
```typescript
const progress = streaming.createProgress("operation-id");
await progress.step("Step 1 of 5...");
await progress.complete(result);
```

## 📁 Project Structure (Key Files)
```
src/
├── tools/           # 16 tool implementations
├── intelligence/    # sampling, elicitation, streaming
├── safety/          # snapshot, diff, undo
├── execution/       # batch, session, auth
├── google/          # sheets, drive, bigquery, scripts
└── resources/       # 25+ MCP resources
```

## 🚀 Implementation Priority

### Phase 1: Core
`gw_spreadsheet` → `gw_cells` → `gw_rows` → `gw_columns`

### Phase 2: Intelligence
`gw_formulas` → `gw_style` → `gw_rules` → Sampling/Elicitation

### Phase 3: Features
`gw_charts` → `gw_filter` → `gw_share` → `gw_files`

### Phase 4: Advanced
`gw_triggers` → `gw_scripts` → `gw_query` → `gw_workflow`

---
*Quick reference for GWorkspace MCP implementation*
