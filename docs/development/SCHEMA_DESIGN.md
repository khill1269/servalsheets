---
title: Schema Design
date: 2026-03-24
status: active
---

# Schema Design

## Overview

ServalSheets uses a layered schema architecture that maps MCP tool definitions to Google Sheets API operations.

## Schema Layers

```
src/schemas/*.ts          → Action definitions, parameter shapes, validation rules
src/generated/manifest.json → Auto-generated metadata (tool counts, action counts)
src/handlers/*.ts         → Runtime implementation of each action
```

## Key Principles

1. **Schema is source of truth** — all tool descriptions, parameter names, and validation come from `src/schemas/`
2. **Generated metadata must stay in sync** — run `npm run schema:commit` after any schema change
3. **No hardcoded counts** — tool/action counts are derived from schemas at build time
4. **Passthrough parameters** — parameters map directly to Google Sheets API fields where possible

## Adding a New Action

1. Define the action in the appropriate `src/schemas/<tool>.ts` file
2. Add the handler in `src/handlers/<tool>.ts` or a sub-action file
3. Run `npm run schema:commit` to regenerate metadata
4. Add tests in `tests/handlers/`
5. Update documentation

## Schema Validation

- Parameter types are enforced at the schema level via TypeScript
- Runtime validation catches missing required parameters
- The `safety` parameter gates destructive operations

## Related

- [Source of Truth](./SOURCE_OF_TRUTH.md)
- [Handler Patterns](./HANDLER_PATTERNS.md)
- [Implementation Guardrails](./IMPLEMENTATION_GUARDRAILS.md)
