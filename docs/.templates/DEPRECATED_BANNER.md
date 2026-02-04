---
title: Deprecated Banner Template
description: Template for marking documents as deprecated
category: general
version: 1.6.0
last_updated: 2026-02-04
tags: [template, deprecation, documentation]
---

# Deprecated Banner Template

Use this template when marking a document as deprecated.

## Standard Deprecation Banner

Add this banner immediately after the frontmatter and title:

```markdown
> **⚠️ DEPRECATED:** This document is deprecated as of [DATE]. It is kept for historical reference only.
>
> **Replacement:** See [New Document Name](path/to/new-document.md) for current information.
>
> **Reason:** [Brief explanation of why deprecated]
```

## Examples

### Feature Replaced

```markdown
> **⚠️ DEPRECATED:** This document is deprecated as of 2026-01-15. It is kept for historical reference only.
>
> **Replacement:** See [sheets_advanced Tool Reference](../reference/tools/sheets_advanced.md) for current information.
>
> **Reason:** The `sheets_formulas` tool was merged into `sheets_advanced` in v1.6.0.
```

### Documentation Consolidated

```markdown
> **⚠️ DEPRECATED:** This document is deprecated as of 2026-01-31. It is kept for historical reference only.
>
> **Replacement:** See [Comprehensive Error Handling Guide](ERROR_HANDLING.md) for current information.
>
> **Reason:** Multiple error handling guides were consolidated into a single comprehensive guide.
```

### API Version Deprecated

```markdown
> **⚠️ DEPRECATED:** This document is deprecated as of 2025-12-01. It is kept for historical reference only.
>
> **Replacement:** See [MCP 2025-11-25 Protocol Compliance](../MCP_2025-11-25_COMPLIANCE_CHECKLIST.md) for current information.
>
> **Reason:** The MCP protocol was updated from 2024-11-05 to 2025-11-25. This guide covers the old protocol version.
```

### No Direct Replacement

```markdown
> **⚠️ DEPRECATED:** This document is deprecated as of 2026-01-20. It is kept for historical reference only.
>
> **No Direct Replacement:** This feature was removed in v1.5.0.
>
> **Reason:** The experimental batching API was removed in favor of automatic batching. See [Performance Guide](../guides/PERFORMANCE.md) for current optimization strategies.
```

### Temporary Deprecation (Migration Period)

```markdown
> **⚠️ DEPRECATION NOTICE:** This document will be deprecated on 2026-03-01.
>
> **Migration Path:** Please migrate to [New Approach](path/to/new-approach.md) before the deprecation date.
>
> **Support:** The old approach will continue to work until v2.0.0 (estimated Q2 2026).
>
> **Reason:** [Brief explanation]
```

## Frontmatter for Deprecated Docs

When deprecating a document, update the frontmatter:

```yaml
---
title: [Original Title] (Deprecated)
category: archived  # Change to 'archived'
last_updated: 2026-01-31
description: "[DEPRECATED] Original description. See [replacement] for current information."
version: 1.6.0
tags: [deprecated, historical, [original-tags]]
deprecated: true  # Add this field
deprecated_date: 2026-01-31  # Add this field
replacement: "path/to/replacement.md"  # Add this field (optional)
---
```

## Moving to Archive

For fully deprecated documents, move to the archive:

```bash
# Move file
mv docs/old-guide.md docs/archive/2026-01-cleanup/old-guide.md

# Update archive index
npm run docs:archive-index

# Update catalog
npm run docs:catalog
```

## Checklist for Deprecating Documentation

- [ ] Add deprecation banner with all required information
- [ ] Update frontmatter (category: archived, add deprecated fields)
- [ ] Update any documents that link to this one
- [ ] Add redirect or notice in related active documentation
- [ ] Move to archive directory (if fully deprecated)
- [ ] Update archive index (`npm run docs:archive-index`)
- [ ] Update doc catalog (`npm run docs:catalog`)
- [ ] Notify team/users (if breaking change)

## Anti-patterns (Don't Do This)

❌ **Vague replacement:**

```markdown
> This is deprecated. See other docs.
```

❌ **No reason given:**

```markdown
> This document is deprecated.
```

❌ **Broken replacement link:**

```markdown
> See [New Guide](broken-link.md)
```

❌ **Missing deprecation date:**

```markdown
> This document is deprecated.
```

## Quick Copy-Paste Template

```markdown
> **⚠️ DEPRECATED:** This document is deprecated as of YYYY-MM-DD. It is kept for historical reference only.
>
> **Replacement:** See [Document Name](path/to/document.md) for current information.
>
> **Reason:** Brief explanation here.
```
