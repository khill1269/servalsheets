---
title: Frontmatter Validation Specification
description: Required and optional frontmatter fields for ServalSheets documentation
category: general
version: 1.6.0
last_updated: 2026-02-04
tags: [documentation, frontmatter, validation, standards]
---

# Frontmatter Validation Specification

This document defines the required and optional frontmatter fields for ServalSheets documentation.

## Required Fields

All documentation files (except archived files) must include these fields:

### `title`

- **Type:** String
- **Description:** The document title, displayed in catalogs and navigation
- **Format:** Plain text, no markdown formatting
- **Example:** `"OAuth Setup Guide"`

### `category`

- **Type:** String (enum)
- **Description:** The documentation category for organization
- **Valid values:**
  - `guide` - User-facing tutorials and how-to guides
  - `reference` - API references, tool references
  - `runbook` - Operational procedures and troubleshooting
  - `development` - Developer guides and contributing docs
  - `architecture` - Design decisions, ADRs, system design
  - `example` - Code examples and samples
  - `business` - Strategy, market analysis, business docs
  - `archived` - Deprecated or historical documentation
  - `general` - Miscellaneous documentation
- **Example:** `category: guide`

### `last_updated`

- **Type:** String (date)
- **Description:** The date this document was last modified
- **Format:** `YYYY-MM-DD` (ISO 8601)
- **Example:** `last_updated: 2026-01-31`
- **Automation:** Run `npm run docs:fix-dates` to auto-update from git history

## Optional Fields

These fields are recommended but not required:

### `description`

- **Type:** String
- **Description:** A brief summary of the document content (1-3 sentences)
- **Guidelines:**
  - Keep under 200 characters for catalog display
  - Focus on what the reader will learn or accomplish
  - Avoid redundancy with title
- **Example:** `"Learn how to set up OAuth 2.0 authentication for ServalSheets. Covers credential creation, scope selection, and token management."`

### `version`

- **Type:** String
- **Description:** The ServalSheets version this document applies to
- **Format:** Semver (e.g., `1.6.0`)
- **Default:** Current release version
- **Example:** `version: 1.6.0`

### `tags`

- **Type:** Array of strings
- **Description:** Keywords for search and filtering
- **Guidelines:**
  - Use lowercase
  - Prefer specific over generic (e.g., `oauth` not `auth`)
  - Include related technology names
  - 2-5 tags optimal
- **Example:** `tags: [oauth, authentication, setup, google-sheets]`

## Category-Specific Fields

### For `category: guide`

#### `audience`

- **Type:** String (enum)
- **Valid values:** `user`, `developer`, `admin`, `all`
- **Example:** `audience: user`

#### `difficulty`

- **Type:** String (enum)
- **Valid values:** `beginner`, `intermediate`, `advanced`
- **Example:** `difficulty: intermediate`

### For `category: reference`

#### `stability`

- **Type:** String (enum)
- **Valid values:** `stable`, `beta`, `experimental`, `deprecated`
- **Example:** `stability: stable`

### For `category: runbook`

#### `estimated_time`

- **Type:** String
- **Description:** Estimated time to complete the procedure
- **Format:** Human-readable (e.g., `"15-30 minutes"`)
- **Example:** `estimated_time: "15-30 minutes"`

## Validation

Frontmatter is validated:

1. **Pre-commit hook** - Validates staged docs in `docs/` directory
   - Checks required fields present
   - Validates category enum
   - Validates date format
   - Validates tags is array

2. **Manual check** - Run validation script:

   ```bash
   npm run docs:frontmatter:check
   ```

3. **CI/CD** - GitHub Actions validates on pull requests

## Auto-generation

If a file is missing frontmatter or has incomplete frontmatter:

```bash
# Preview changes
npm run docs:frontmatter:dry

# Apply changes
npm run docs:frontmatter

# Force update existing frontmatter
npm run docs:frontmatter:force
```

The script infers metadata from:

- File path (determines category)
- First heading (becomes title)
- First paragraph (becomes description)
- File content (suggests tags)

## Example Complete Frontmatter

### Guide

```yaml
---
title: OAuth Setup Guide
category: guide
last_updated: 2026-01-31
description: "Learn how to set up OAuth 2.0 authentication for ServalSheets. Covers credential creation, scope selection, and token management."
version: 1.6.0
tags: [oauth, authentication, setup, google-sheets]
audience: user
difficulty: intermediate
---
```

### Reference

```yaml
---
title: sheets_data Tool Reference
category: reference
last_updated: 2026-01-31
description: "Complete API reference for the sheets_data tool. Includes all actions, parameters, return types, and examples."
version: 1.6.0
tags: [api, reference, sheets, data]
stability: stable
---
```

### Runbook

```yaml
---
title: High Error Rate Response
category: runbook
last_updated: 2026-01-31
description: "Incident response procedure for elevated error rates. Covers diagnosis, mitigation, and escalation steps."
version: 1.6.0
tags: [operations, troubleshooting, errors, incident-response]
estimated_time: "15-30 minutes"
---
```

## Notes

- **Archived files** don't require `version` field
- **Archive exclusion** - Files in `docs/archive/` are excluded from validation
- **Template files** - Files in `docs/.templates/` are excluded from validation
- **Generated files** - Files in `docs/.vitepress/` and `docs/generated/` are excluded

## Troubleshooting

### "Missing required field: title"

Add a title to the frontmatter or ensure the first heading starts with `#`.

### "Invalid category"

Check spelling and ensure category is one of the valid values listed above.

### "Invalid last_updated format"

Use ISO 8601 date format: `YYYY-MM-DD` (e.g., `2026-01-31`).

### "Field 'tags' must be an array"

Use bracket syntax: `tags: [tag1, tag2, tag3]` not `tags: tag1, tag2, tag3`.
