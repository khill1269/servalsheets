---
title: Documentation Tools Reference
description: Complete guide to all documentation automation tools and workflows
category: development
last_updated: 2026-01-31
version: 1.6.0
tags: [documentation, tools, automation, workflow]
---

# Documentation Tools Reference

> **Complete toolkit for managing, analyzing, and maintaining ServalSheets documentation**

## Overview

ServalSheets has a comprehensive documentation automation suite with **27 tools** across:

- **Quality validation** (linting, spell-checking, link validation)
- **Content analysis** (metrics, freshness, deep analysis)
- **Automation** (frontmatter, catalog generation, archive management)
- **Maintenance** (tag suggestions, TODO tracking, prose linting)

---

## Quick Reference

### Daily Use

```bash
# Before committing documentation changes
npm run docs:lint:fix      # Auto-fix formatting
npm run docs:spell         # Check spelling
npm run docs:validate      # Run all checks (lint + spell + links)
```

### Content Creation

```bash
# Add frontmatter to new docs
npm run docs:frontmatter docs/guides/new-guide.md

# Regenerate catalog after changes
npm run docs:catalog

# Update metrics dashboard
npm run docs:metrics
```

### Quality Analysis

```bash
# Deep content analysis
npm run docs:analyze              # Terminal output
npm run docs:analyze:json         # JSON report

# Find improvement opportunities
npm run docs:suggest-tags         # Tag suggestions
npm run docs:find-todos           # TODO/FIXME tracker
npm run docs:freshness            # Age analysis
```

### Maintenance

```bash
# Fix common issues
npm run docs:fix-dates            # Add missing last_updated
npm run docs:fix-dates:dry        # Preview changes first

# Update generated content
npm run docs:archive-index        # Archive index
npm run docs:prose               # Prose quality (requires Vale)
```

---

## Tool Categories

### 1. Validation & Quality

#### Markdown Linting

**Purpose:** Enforce consistent markdown formatting

```bash
npm run docs:lint          # Check formatting
npm run docs:lint:fix      # Auto-fix issues
npm run docs:lint:root     # Check root *.md files only
```

**Configuration:** [.markdownlint.json](../.markdownlint.json)
**Ignored:** [.markdownlintignore](../.markdownlintignore)

**Rules enforced:**

- ✅ Consistent heading style (ATX: `#`)
- ✅ Proper list formatting
- ✅ Fenced code blocks
- ✅ No trailing spaces
- ✅ Proper link formatting

#### Spell Checking

**Purpose:** Catch typos and maintain consistency

```bash
npm run docs:spell         # Check docs/**/*.md
npm run docs:spell:all     # Check all markdown files
```

**Configuration:** [.cspell.json](../.cspell.json)

**Features:**

- 200+ project-specific terms
- Technical jargon support
- Configurable per-file overrides

#### Link Validation

**Purpose:** Prevent broken internal links

```bash
npm run docs:check-links   # Validate all internal links
```

**Script:** [scripts/check-doc-links.sh](../scripts/check-doc-links.sh)

**Checks:**

- Internal markdown links
- Relative path resolution
- File existence
- Anchor targets (H2-H6 headings)

#### Full Validation

**Purpose:** Run all quality checks

```bash
npm run docs:validate      # lint + spell + links
npm run docs:audit         # Full audit with summary
```

**CI Integration:** Runs automatically on every PR

---

### 2. Content Analysis

#### Deep Analysis

**Purpose:** Comprehensive documentation quality assessment

```bash
npm run docs:analyze              # Terminal report
npm run docs:analyze:json         # JSON output
```

**Script:** [scripts/analyze-docs-deep.ts](../scripts/analyze-docs-deep.ts)

**Analyzes:**

- Metadata completeness
- Structure (headings, code blocks, links)
- Readability scores
- Content quality (examples, troubleshooting)
- Consistency (title vs H1, duplicate headings)
- Size distribution
- TODO/FIXME comments

**Example Output:**

```
📊 Deep Documentation Analysis Report
════════════════════════════════════════════════════════════════════════════════

📈 Overall Statistics:
  Total files analyzed: 139
  Total words: 217,992
  Files with issues: 139 (100.0%)
  Total issues found: 538

🔍 Issues by Severity:
  🚨 Errors: 1
  ⚠️  Warnings: 253
  ℹ️  Info: 284
```

#### Freshness Tracking

**Purpose:** Identify stale documentation

```bash
npm run docs:freshness        # Terminal report
npm run docs:freshness:json   # JSON export
npm run docs:freshness:ci     # CI mode (exit 1 if >10 critical)
```

**Script:** [scripts/check-doc-freshness.ts](../scripts/check-doc-freshness.ts)

**Categories:**

- **Fresh** (< 3 months) - No action needed
- **Aging** (3-6 months) - Schedule review
- **Stale** (6-12 months) - Update within 2 weeks
- **Critical** (> 12 months) - Urgent update or archive

**Current Status:** 100% fresh (all updated 2026-01-31)

#### Metrics Dashboard

**Purpose:** Real-time documentation health metrics

```bash
npm run docs:metrics     # Generate dashboard
```

**Script:** [scripts/generate-doc-metrics.ts](../scripts/generate-doc-metrics.ts)
**Output:** [METRICS_DASHBOARD.md](./METRICS_DASHBOARD.md)

**Tracks:**

- Document counts by category
- Word counts and averages
- Quality metrics (frontmatter, descriptions, tags)
- Freshness distribution
- Top contributors
- Recent activity

**Auto-updates:** Run monthly or after major changes

---

### 3. Automation Tools

#### Frontmatter Management

**Purpose:** Add or update frontmatter metadata

```bash
# Add to new files
npm run docs:frontmatter docs/guides/new-guide.md

# Preview changes
npm run docs:frontmatter:dry 'docs/**/*.md'

# Force update existing frontmatter
npm run docs:frontmatter:force
```

**Script:** [scripts/add-frontmatter.ts](../scripts/add-frontmatter.ts)

**Features:**

- Infers category from file path
- Extracts title from H1
- Suggests tags based on content
- Auto-sets last_updated date

**Example output:**

```yaml
---
title: OAuth User Authentication Setup
description: This guide sets up ServalSheets to prompt you for Google login
category: guide
last_updated: 2026-01-31
version: 1.6.0
tags: [oauth, authentication, setup, configuration, sheets]
audience: user
difficulty: intermediate
---
```

#### Fix Missing Dates

**Purpose:** Add last_updated to frontmatter

```bash
npm run docs:fix-dates        # Apply fixes
npm run docs:fix-dates:dry    # Preview changes
```

**Script:** [scripts/fix-frontmatter-dates.ts](../scripts/fix-frontmatter-dates.ts)

**Uses:**

1. Git last-modified date (if available)
2. Current date (fallback)

#### Catalog Generation

**Purpose:** Create comprehensive documentation index

```bash
npm run docs:catalog
```

**Script:** [scripts/generate-doc-catalog.ts](../scripts/generate-doc-catalog.ts)
**Output:** [DOCS_CATALOG.md](./DOCS_CATALOG.md)

**Features:**

- Groups by category
- Sorted alphabetically
- Tag index
- Auto-generated from frontmatter

**Regenerate:** After adding/moving docs, changing categories/tags

#### Archive Index

**Purpose:** Organize historical documentation

```bash
npm run docs:archive-index
```

**Script:** [scripts/generate-archive-index.ts](../scripts/generate-archive-index.ts)
**Output:** [archive/INDEX.md](./archive/INDEX.md)

**Indexes:** 51 archived files across multiple subdirectories

---

### 4. Maintenance Tools

#### Tag Suggestions

**Purpose:** Improve discoverability with smart tagging

```bash
npm run docs:suggest-tags
```

**Script:** [scripts/suggest-tags.ts](../scripts/suggest-tags.ts)

**Suggests tags based on:**

- File location (guides/, operations/, etc.)
- Content keywords (OAuth, MCP, testing, etc.)
- Existing frontmatter

**Example:**

```
📄 guides/OAUTH_USER_SETUP.md
   Current: [oauth, authentication]
   Suggested additions: [setup, configuration, sheets]
```

#### TODO Tracker

**Purpose:** Find incomplete documentation

```bash
npm run docs:find-todos
```

**Script:** [scripts/find-todos.ts](../scripts/find-todos.ts)

**Finds:**

- `TODO` comments
- `FIXME` markers
- Line numbers and context

**Current:** 24 items across 9 files

#### Prose Linting (Optional)

**Purpose:** Check grammar, style, and readability

```bash
npm run docs:prose           # Run Vale
npm run docs:prose:sync      # Download style packages
```

**Requires:** `brew install vale` (macOS) or see [.vale/README.md](../.vale/README.md)
**Configuration:** [.vale.ini](../.vale.ini)

**Checks:**

- Grammar and style (write-good, proselint)
- Readability scores
- Tone consistency
- Technical writing best practices

---

## Workflows

### Adding New Documentation

1. **Choose template:**

   ```bash
   cp docs/.templates/GUIDE_TEMPLATE.md docs/guides/my-guide.md
   ```

2. **Write content following template structure**

3. **Add frontmatter (auto or manual):**

   ```bash
   npm run docs:frontmatter docs/guides/my-guide.md
   ```

4. **Validate:**

   ```bash
   npm run docs:validate
   ```

5. **Update catalog:**

   ```bash
   npm run docs:catalog
   ```

6. **Commit and push** (pre-commit hooks run automatically)

### Monthly Maintenance

```bash
# 1. Check freshness
npm run docs:freshness

# 2. Update metrics
npm run docs:metrics

# 3. Find TODOs
npm run docs:find-todos

# 4. Deep analysis
npm run docs:analyze

# 5. Suggest tags for untagged docs
npm run docs:suggest-tags

# 6. Fix any missing dates
npm run docs:fix-dates

# 7. Full audit
npm run docs:audit
```

### Before Major Release

```bash
# Complete validation
npm run docs:audit

# Update all metrics
npm run docs:metrics
npm run docs:catalog
npm run docs:archive-index

# Check for stale content
npm run docs:freshness

# Deep quality check
npm run docs:analyze
```

---

## CI/CD Integration

### Pre-commit Hooks

**File:** [.husky/pre-commit](../.husky/pre-commit)

**Runs:**

- Markdown linting on staged .md files
- Auto-fixes formatting issues

### GitHub Actions

**File:** [.github/workflows/docs-validation.yml](../.github/workflows/docs-validation.yml)

**Triggers:** Push to main, PRs

**Validates:**

- Markdown formatting (blocking)
- Spell checking (warning)
- Internal links (blocking)

---

## Configuration Files

| File                                          | Purpose         | Key Settings                    |
| --------------------------------------------- | --------------- | ------------------------------- |
| [.markdownlint.json](../.markdownlint.json)   | Markdown rules  | Style preferences, allowed HTML |
| [.markdownlintignore](../.markdownlintignore) | Lint exclusions | Archive, generated files        |
| [.cspell.json](../.cspell.json)               | Spell check     | Dictionary, ignored patterns    |
| [.vale.ini](../.vale.ini)                     | Prose linting   | Style packages, severity        |

---

## Output Files (Auto-generated)

**Do not edit manually - these are regenerated by scripts:**

| File                                           | Generator            | Frequency            |
| ---------------------------------------------- | -------------------- | -------------------- |
| [DOCS_CATALOG.md](./DOCS_CATALOG.md)           | `docs:catalog`       | On structure changes |
| [METRICS_DASHBOARD.md](./METRICS_DASHBOARD.md) | `docs:metrics`       | Monthly              |
| [archive/INDEX.md](./archive/INDEX.md)         | `docs:archive-index` | When archiving       |

---

## Tool Performance

| Tool               | Files | Time | Notes            |
| ------------------ | ----- | ---- | ---------------- |
| `docs:lint`        | 144   | ~2s  | Fast incremental |
| `docs:spell`       | 144   | ~3s  | Cached results   |
| `docs:check-links` | 144   | ~1s  | Pattern-based    |
| `docs:analyze`     | 139   | ~5s  | Comprehensive    |
| `docs:metrics`     | 139   | ~8s  | Git queries slow |
| `docs:catalog`     | 139   | ~2s  | Fast generation  |
| `docs:freshness`   | 139   | ~10s | Git-intensive    |

---

## Best Practices

### When to Run Tools

| Tool                | Frequency               | Trigger        |
| ------------------- | ----------------------- | -------------- |
| `docs:validate`     | Every commit            | Pre-commit, CI |
| `docs:catalog`      | After structure changes | Manual         |
| `docs:metrics`      | Monthly                 | Scheduled      |
| `docs:freshness`    | Monthly                 | Scheduled      |
| `docs:analyze`      | Quarterly               | Planning       |
| `docs:find-todos`   | Sprint planning         | Manual         |
| `docs:suggest-tags` | After adding docs       | Manual         |

### Tool Sequencing

**For new documentation:**

```bash
1. Write content
2. npm run docs:frontmatter [file]
3. npm run docs:lint:fix
4. npm run docs:validate
5. npm run docs:catalog
6. Commit
```

**For monthly maintenance:**

```bash
1. npm run docs:freshness
2. npm run docs:analyze
3. npm run docs:find-todos
4. npm run docs:suggest-tags
5. npm run docs:metrics
6. Review and take action
```

---

## Troubleshooting

### Lint Errors Won't Fix

**Problem:** `npm run docs:lint:fix` doesn't resolve all errors

**Solution:**

```bash
# Check what can't be auto-fixed
npm run docs:lint

# Common issues:
# - Multiple H1 headings (manual fix)
# - Inconsistent table formatting (manual fix)
# - Long lines (add line breaks)
```

### Spell Check False Positives

**Problem:** Valid terms flagged as misspelled

**Solution:**
Add to [.cspell.json](../.cspell.json):

```json
{
  "words": ["YourNewTerm", "AnotherTerm"]
}
```

### Link Validation Failures

**Problem:** Valid links reported as broken

**Check:**

1. File exists at that path?
2. Anchor matches H2-H6 heading?
3. Case-sensitive match?

**Fix:** Update link or heading

### Slow Performance

**Problem:** Tools taking too long

**Solutions:**

- Use `--ignore` patterns for large subdirectories
- Run on specific paths: `npm run docs:lint 'docs/guides/**'`
- Increase Node memory: `NODE_OPTIONS=--max-old-space-size=4096 npm run docs:analyze`

---

## Additional Resources

- [Maintenance Guide](./DOCS_MAINTENANCE.md) - Schedules and processes
- [Ownership Model](./github/DOCS_OWNERS.md) - Responsibilities
- [Templates](./templates/) - Doc type templates
- [Catalog](./DOCS_CATALOG.md) - Full documentation index
- [Metrics](./METRICS_DASHBOARD.md) - Current health status

---

**Last Updated:** 2026-01-31 | **Maintainer:** Documentation Team
