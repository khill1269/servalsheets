---
title: Documentation Map & Governance
category: general
last_updated: 2026-01-31
description: Documentation structure overview and governance guidelines
version: 1.6.0
tags: [documentation, governance]
---

# Documentation Map & Governance

## Canonical Authority

**Metadata Source:** `server.json`

- Version: 1.6.0
- Tools: 21
- Actions: 291
- Protocol: MCP 2025-11-25

**Must sync with:**

- `package.json` (version, description)
- `manifest.json` (version, tools, actions)
- `bundle/manifest.json` (version, tools, actions)
- `README.md` (badges, counts)
- `docs/.vitepress/config.mjs` (OpenGraph metadata)

**Source Code Authority:** `src/schemas/index.ts`

```typescript
export const TOOL_COUNT = 21; // Line 523
export const ACTION_COUNT = 291; // Line 526
```

## Documentation Taxonomy

### Canonical Sources (Edit Here)

- `docs/guides/` - User guides and tutorials (24 files)
- `docs/operations/` - Operational runbooks (8 files)
- `docs/development/` - Developer documentation (23 files)
- `docs/deployment/` - Deployment guides (6 files)
- `docs/reference/` - API and tool reference (2 files + tools/)
- `docs/analysis/` - Analysis and optimization (5 files)

### Generated (Do Not Edit)

- `docs/generated/` - TypeDoc HTML output (925 files)
- `docs/.vitepress/dist/` - VitePress build artifacts

### Archived (Reference Only)

- `docs/archive/2026-01-cleanup/` - Historical cleanup artifacts (48 files)
- `docs/archive/abandoned-v2/` - Abandoned v2 architecture
- `docs/archive/gworkspace-exploration/` - Workspace exploration docs

## Validation Commands

### Check VitePress Navigation

```bash
npm run docs:build  # Must pass with ignoreDeadLinks: false
```

### Check Internal Links

```bash
# Scan for broken markdown links
find docs -type f -name "*.md" \
  ! -path "docs/archive/*" \
  ! -path "docs/generated/*" \
  ! -path "docs/.vitepress/dist/*" \
  -exec grep -l '\[.*\](\.\.*/.*\.md)' {} \; | \
  while read file; do
    grep -o '\[.*\](\(\.\.*/.*\.md\))' "$file" | \
    sed 's/.*(\(.*\))/\1/' | \
    while read link; do
      target="$(dirname "$file")/$link"
      [ -f "$target" ] || echo "Broken: $file → $link"
    done
  done
```

### Check Metadata Sync

```bash
npm run check:drift  # Verify schema metadata sync
```

### Check for Stale Versions

```bash
rg "\b1\.[0-4]\.\d+\b" docs --glob '!docs/archive/**' --glob '!CHANGELOG.md'
```

### Run Full Validation

```bash
npm run docs:validate  # Comprehensive validation suite
```

## Link Conventions

### Relative Path Rules

- **Same directory**: Use `./sibling.md` or just `sibling.md`
- **Parent directory**: Use `../parent-dir/file.md`
- **Sibling directory**: Use `../sibling-dir/file.md`
- **Root files**: Use `../../FILENAME.md` from docs subdirectories

### Examples

```markdown
<!-- From docs/development/DOCUMENTATION.md -->

[Usage Guide](../guides/USAGE_GUIDE.md) ✅ Correct
[Usage Guide](./USAGE_GUIDE.md) ❌ Wrong (USAGE_GUIDE.md is in guides/)

<!-- From docs/guides/TROUBLESHOOTING.md -->

[README](../../README.md) ✅ Correct (root README)
[README](./README.md) ❌ Wrong (would look in guides/)

<!-- From docs/README.md -->

[Guides](./guides/USAGE_GUIDE.md) ✅ Correct
[Guides](guides/USAGE_GUIDE.md) ✅ Also correct
```

## Duplicate Policy

One canonical location per topic. Non-canonical copies must:

1. Include a "moved" notice at the top
2. Link to the canonical location
3. Be minimal (< 10 lines)

### Canonical Locations

- **TROUBLESHOOTING**: `docs/guides/TROUBLESHOOTING.md` (canonical)
  - Duplicate at `docs/TROUBLESHOOTING.md` → redirect stub
- **CLAUDE_DESKTOP_SETUP**: `docs/guides/CLAUDE_DESKTOP_SETUP.md` (canonical)
  - Duplicate at root `CLAUDE_DESKTOP_SETUP.md` → redirect stub
- **SKILL**: `skill/SKILL.md` (skill package), `docs/guides/SKILL.md` (documentation)
  - Both valid (different purposes)
- **README.md**: Multiple valid copies (root, docs/, subdirectories)
  - Root: Main project README
  - docs/: VitePress docs site index
  - Subdirectories: Per-module documentation

## Agent Context Rules

### Always Load (Critical Files)

- `CLAUDE.md` - Project-specific Claude Code rules
- `docs/DOCS_MAP.md` - This file (documentation governance)
- `docs/development/SOURCE_OF_TRUTH.md` - Canonical reference
- `docs/guides/USAGE_GUIDE.md` - User-facing guide

### Always Ignore (Generated/Archived)

- `docs/archive/**` - Historical artifacts
- `docs/generated/**` - TypeDoc output
- `docs/.vitepress/dist/**` - Build artifacts
- `node_modules/**` - Dependencies

### Runtime-Critical Files (DO NOT BREAK)

- `docs/guides/quota-optimization.md` - Quota management patterns
- `docs/guides/batching-strategies.md` - Batch operation guidelines
- `docs/guides/caching-patterns.md` - Cache usage patterns
- `docs/guides/error-recovery.md` - Error handling strategies

## File Creation Guidelines

### When to Create New Files

1. **New feature documentation** - User-facing guides for new tools/actions
2. **Missing navigation targets** - VitePress config references non-existent files
3. **Broken link targets** - Internal links point to missing files

### When NOT to Create Files

- **Session logs, reports, analysis docs** - Explicitly forbidden (see CLAUDE.md)
- **Status updates, progress reports** - Report in chat, not files
- **Temporary debugging artifacts** - Use chat or delete after use

### File Naming Conventions

- **Guides**: `UPPERCASE_WITH_UNDERSCORES.md` (existing pattern)
- **Reference**: `lowercase-with-hyphens.md` (technical docs)
- **Operations**: `lowercase-with-hyphens.md` (runbooks)

## Metadata Sync Procedure

When updating version/counts in ANY file:

1. **Check canonical source:**

   ```bash
   cat server.json | jq '{version, protocol, tools: .tools | length, actions}'
   ```

2. **Verify source code authority:**

   ```bash
   grep -n "TOOL_COUNT\|ACTION_COUNT" src/schemas/index.ts
   ```

3. **Update dependent files:**
   - `package.json` (version, description)
   - `manifest.json` (version, description with counts)
   - `bundle/manifest.json` (version, description, long_description)
   - `docs/.vitepress/config.mjs` (OpenGraph metadata)

4. **Run validation:**

   ```bash
   npm run check:drift
   ```

## CI/CD Integration

### Pre-commit Validation

Documentation changes trigger validation before commit:

- Internal link checking
- Metadata sync verification
- Stale version detection

### GitHub Actions

Pull requests affecting docs/ trigger:

- Full VitePress build
- Validation script execution
- Broken link detection
- Metadata drift check

### Package Scripts

```bash
npm run docs:validate        # Run all validation checks
npm run docs:check-links     # Check internal links only
npm run docs:check-nav       # Check VitePress nav targets
npm run docs:check-metadata  # Check metadata sync
npm run docs:build           # Build VitePress site
```

## Troubleshooting

### Common Issues

**VitePress build fails with "File not found"**

- Check `docs/.vitepress/config.mjs` for nav/sidebar links
- Verify target files exist at specified paths
- Run `npm run docs:check-nav` for detailed report

**Broken internal links**

- Use relative paths correctly (see "Link Conventions" above)
- Verify target file exists
- Run `npm run docs:check-links` for full report

**Metadata drift detected**

- Check `server.json` for canonical values
- Run `npm run gen:metadata` to regenerate
- Verify `src/schemas/index.ts` constants match

**Stale version references**

- Search with: `rg "\b1\.[0-4]\.\d+\b" docs --glob '!docs/archive/**'`
- Update to current version (1.6.0)
- Verify with `npm run docs:validate`

## Maintenance Schedule

### Weekly

- Run `npm run docs:validate` to catch drift
- Review new documentation PRs for link correctness

### Monthly

- Audit `docs/archive/` for outdated content
- Update documentation statistics in `docs/README.md`
- Verify all external links still valid

### Per Release

- Update version references across all docs
- Regenerate metadata with `npm run gen:metadata`
- Update CHANGELOG.md with documentation changes
- Rebuild and deploy VitePress site

## Version History

- **2026-01-30**: Initial DOCS_MAP.md created as part of documentation cleanup
  - Established canonical authority (server.json → src/schemas/index.ts)
  - Defined documentation taxonomy (73 active files)
  - Created validation procedures and CI/CD integration
  - Documented link conventions and duplicate policy
