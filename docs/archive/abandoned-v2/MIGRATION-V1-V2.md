---
title: ServalSheets v1 → v2 Migration Guide
category: archived
last_updated: 2026-01-31
description: ServalSheets v2 consolidates 26 tools into 11 intent-based tools while maintaining full backwards compatibility. This guide helps you migrate existing
---

# ServalSheets v1 → v2 Migration Guide

## Overview

ServalSheets v2 consolidates 26 tools into 11 intent-based tools while maintaining full backwards compatibility. This guide helps you migrate existing integrations.

## Quick Comparison

| Metric | v1 | v2 | Improvement |
|--------|-----|-----|-------------|
| Tool count | 26 | 11 | **58% reduction** |
| Action count | 215 | 167 | **22% reduction** |
| LLM tool choices | 26 | 11 | **Faster reasoning** |
| Analysis calls | 10+ | 1 | **90% reduction** |

## Running Modes

### v2-Only Mode (New Projects)

```bash
COMPAT_MODE=v2-only npm run start:v2
```

Only v2 tools are available. Best for new projects.

### Compatibility Mode (Migration)

```bash
COMPAT_MODE=v1-and-v2 npm run start:compat
```

Both v1 and v2 tools work. v1 calls are automatically converted.

### Deprecation Mode (Gradual Migration)

```bash
COMPAT_MODE=v1-deprecated npm run start:compat
```

v1 tools work but show deprecation warnings.

---

## Tool Mapping Reference

### Data Operations → `sheets_data`

| v1 Tool | v2 Action | Example |
|---------|-----------|---------|
| `sheets_read_values` | `read` | `{ action: 'read', range: 'A1:B10' }` |
| `sheets_update_values` | `write` | `{ action: 'write', range: 'A1', values: [[1]] }` |
| `sheets_append_values` | `append` | `{ action: 'append', range: 'A:A', values: [[1]] }` |
| `sheets_clear_values` | `clear` | `{ action: 'clear', range: 'A1:B10' }` |
| `sheets_batch_read` | `batch_read` | `{ action: 'batch_read', ranges: [...] }` |
| `sheets_batch_update` | `batch_write` | `{ action: 'batch_write', data: [...] }` |
| `sheets_find` | `search` | `{ action: 'search', searchValue: 'test' }` |
| `sheets_find_replace` | `replace` | `{ action: 'replace', find: 'a', replacement: 'b' }` |

### Formatting → `sheets_style`

| v1 Tool | v2 Action | Example |
|---------|-----------|---------|
| `sheets_format_cells` | `set_format` | `{ action: 'set_format', format: { bold: true } }` |
| `sheets_set_borders` | `set_borders` | `{ action: 'set_borders', borders: {...} }` |
| `sheets_set_number_format` | `set_number_format` | `{ action: 'set_number_format', type: 'CURRENCY' }` |
| `sheets_alternating_colors` | `add_alternating` | `{ action: 'add_alternating', ... }` |
| `sheets_data_validation` | `add_validation` | `{ action: 'add_validation', rule: {...} }` |

### Structure → `sheets_structure`

| v1 Tool | v2 Action | Example |
|---------|-----------|---------|
| `sheets_create_sheet` | `add_sheet` | `{ action: 'add_sheet', title: 'New' }` |
| `sheets_delete_sheet` | `delete_sheet` | `{ action: 'delete_sheet', sheetId: 0 }` |
| `sheets_rename_sheet` | `rename_sheet` | `{ action: 'rename_sheet', newTitle: 'Renamed' }` |
| `sheets_hide_sheet` | `hide_sheet` / `show_sheet` | `{ action: 'hide_sheet', sheetId: 0 }` |
| `sheets_copy_sheet` | `copy_to` | `{ action: 'copy_to', ... }` |
| `sheets_protect_range` | `add_protection` | `{ action: 'add_protection', ... }` |

### Charts & Pivots → `sheets_visualize`

| v1 Tool | v2 Action | Example |
|---------|-----------|---------|
| `sheets_create_chart` | `create_chart` | `{ action: 'create_chart', chartType: 'COLUMN' }` |
| `sheets_create_pivot` | `create_pivot` | `{ action: 'create_pivot', ... }` |
| `sheets_sort_range` | `sort_range` | `{ action: 'sort_range', sortSpecs: [...] }` |

### Analysis → `sheets_analyze`

| v1 Tool | v2 Action | Notes |
|---------|-----------|-------|
| `sheets_scout` | `comprehensive` | **Use this for most analysis!** |
| `sheets_profile` | `comprehensive` | Now one call instead of many |
| `sheets_audit` | `data_quality` | Or use `comprehensive` |
| `sheets_descriptive_stats` | `statistics` | For numeric analysis |
| `sheets_compare` | `compare_ranges` | Range comparison |

### Automation → `sheets_automate`

| v1 Tool | v2 Action | Example |
|---------|-----------|---------|
| `sheets_fix_issues` | `apply_fixes` | `{ action: 'apply_fixes', ... }` |
| `sheets_deduplicate` | `deduplicate` | `{ action: 'deduplicate', ... }` |

### Sharing → `sheets_share`

| v1 Tool | v2 Action | Example |
|---------|-----------|---------|
| (via Drive API) | `share` | `{ action: 'share', email: 'user@example.com' }` |
| (via Drive API) | `add_comment` | `{ action: 'add_comment', content: '...' }` |

### History → `sheets_history`

| v1 Tool | v2 Action | Example |
|---------|-----------|---------|
| `sheets_manage_backups` | `create_snapshot` | `{ action: 'create_snapshot', ... }` |
| `sheets_manage_backups` | `list_snapshots` | `{ action: 'list_snapshots' }` |

---

## Code Migration Examples

### Before (v1): Multiple tools for analysis

```typescript
// v1: 4 separate tool calls
const scout = await call('sheets_scout', { spreadsheetId });
const profile = await call('sheets_profile', { spreadsheetId });
const audit = await call('sheets_audit', { spreadsheetId });
const stats = await call('sheets_descriptive_stats', { spreadsheetId, range: 'A:Z' });
```

### After (v2): One comprehensive call

```typescript
// v2: Single call gets everything
const analysis = await call('sheets_analyze', {
  action: 'comprehensive',
  spreadsheetId,
  includeData: true,
  includeFormulas: true,
  includeQuality: true,
  includePatterns: true,
  includeRecommendations: true,
});
```

---

### Before (v1): Write without safety

```typescript
// v1: Direct write
await call('sheets_update_values', {
  spreadsheetId,
  range: 'A1:B10',
  values: data,
});
```

### After (v2): Write with safety options

```typescript
// v2: Write with automatic backup
await call('sheets_data', {
  action: 'write',
  spreadsheetId,
  range: 'A1:B10',
  values: data,
  safety: {
    createSnapshot: true,  // Auto backup before write
    dryRun: false,         // Set true to preview
  },
});
```

---

### Before (v1): Formatting

```typescript
// v1: Specific formatting tool
await call('sheets_format_cells', {
  spreadsheetId,
  range: 'A1:Z1',
  format: { bold: true, backgroundColor: '#4285F4' },
});
```

### After (v2): With presets

```typescript
// v2: Use preset for common patterns
await call('sheets_style', {
  action: 'apply_preset',
  spreadsheetId,
  range: 'A1:Z1',
  sheetId: 0,
  preset: 'header',  // Pre-defined header style
});

// Or custom formatting
await call('sheets_style', {
  action: 'set_format',
  spreadsheetId,
  range: 'A1:Z1',
  sheetId: 0,
  format: { bold: true, backgroundColor: '#4285F4' },
});
```

---

## Safety Features (New in v2)

All write operations now support safety options:

```typescript
interface SafetyOptions {
  dryRun?: boolean;           // Preview changes without executing
  createSnapshot?: boolean;   // Auto-backup before changes
  requireConfirmation?: boolean; // Pause for user confirmation
  transactionId?: string;     // Group operations atomically
}
```

### Transaction Example

```typescript
// Start transaction
const tx = await call('sheets_safety', {
  action: 'begin',
  spreadsheetId,
  createSnapshot: true,
});

// Queue operations (atomic)
await call('sheets_data', {
  action: 'write',
  spreadsheetId,
  range: 'A1',
  values: [['Updated']],
  safety: { transactionId: tx.transactionId },
});

// Commit or rollback
await call('sheets_safety', {
  action: 'commit',  // or 'rollback'
  transactionId: tx.transactionId,
});
```

---

## Intent-Based Tool Selection

Use this guide to pick the right v2 tool:

| Intent | Tool |
|--------|------|
| "Read/write cell data" | `sheets_data` |
| "Format cells, colors, fonts" | `sheets_style` |
| "Manage sheets, rows, columns" | `sheets_structure` |
| "Create charts, pivots, filters" | `sheets_visualize` |
| "Understand/analyze the data" | `sheets_analyze` |
| "Fix problems, import data" | `sheets_automate` |
| "Share or comment" | `sheets_share` |
| "Version control, undo" | `sheets_history` |
| "Transactions, validation" | `sheets_safety` |
| "Session preferences" | `sheets_context` |

---

## Deprecated v1 Tools

These v1 tools are deprecated and will be removed in v3:

| v1 Tool | Replacement |
|---------|-------------|
| `sheets_scout` | `sheets_analyze.comprehensive` |
| `sheets_profile` | `sheets_analyze.comprehensive` |
| `sheets_audit` | `sheets_analyze.comprehensive` or `data_quality` |
| `sheets_professionalize` | `sheets_style.apply_preset` |
| `sheets_manage_dimensions` | Specific `sheets_structure` actions |
| `sheets_named_ranges` | Specific `sheets_structure` actions |
| `sheets_manage_charts` | Specific `sheets_visualize` actions |
| `sheets_manage_pivots` | Specific `sheets_visualize` actions |
| `sheets_manage_backups` | `sheets_history` actions |
| `sheets_sample` | `sheets_data.read` with row limits |
| `sheets_transform_data` | `sheets_automate.migrate_data` |
| `sheets_auth_status` | Server-level auth handling |
| `sheets_authenticate` | Server-level auth handling |

---

## Need Help?

1. Check the [SKILL-V2.md](./SKILL-V2.md) for LLM orchestration guidance
2. Run with `COMPAT_MODE=v1-and-v2` for gradual migration
3. Enable deprecation warnings: `SHOW_DEPRECATION_WARNINGS=true`
4. Open an issue: https://github.com/khill1269/servalsheets/issues
