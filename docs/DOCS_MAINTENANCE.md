---
title: Documentation Maintenance Guide
description: Processes, schedules, and responsibilities for keeping documentation current
category: development
last_updated: 2026-01-31
version: 1.6.0
tags: [documentation, maintenance, process]
---

# Documentation Maintenance Guide

> **Purpose:** Establish clear processes and schedules for maintaining high-quality, current documentation

## Maintenance Schedule

### Daily (Automated)

- **CI Validation** - Runs on every PR
  - Markdown linting
  - Spell checking
  - Internal link validation
  - Pre-commit hooks catch issues before push

### Weekly (Team)

- **Review New Documentation** - Every Monday
  - Check docs added in past week
  - Verify frontmatter is complete
  - Ensure proper categorization and tags
  - Run: `git diff --name-only HEAD~7 HEAD -- docs/`

### Monthly (Maintainers)

- **Documentation Health Check** - First Friday of each month
  - Run full audit: `npm run docs:audit`
  - Review freshness report: `npm run docs:freshness`
  - Update metrics dashboard: `npm run docs:metrics`
  - Address aging docs (3-6 months old)
  - Plan updates for stale docs (6+ months)

### Quarterly (Leadership)

- **Strategic Documentation Review** - End of each quarter
  - Review documentation metrics and trends
  - Identify documentation gaps
  - Plan major documentation initiatives
  - Update templates if needed
  - Archive obsolete documentation

### Continuous (Contributors)

- **Update as You Go**
  - Update docs when changing related code
  - Add examples for new features
  - Fix errors when discovered
  - Improve clarity when confused

## Roles & Responsibilities

### Documentation Owner (Tech Lead)

**Responsibilities:**

- Overall documentation strategy and quality
- Quarterly reviews and planning
- Resolve documentation disputes
- Maintain templates and standards

**Time commitment:** ~2 hours/month

### Area Owners

Each documentation category has an assigned owner:

| Category         | Owner        | Responsibilities                    |
| ---------------- | ------------ | ----------------------------------- |
| **Guides**       | Product Team | User-facing tutorials, setup guides |
| **Reference**    | Engineering  | API docs, tool references           |
| **Development**  | Engineering  | Developer guides, testing docs      |
| **Operations**   | DevOps       | Runbooks, deployment guides         |
| **Architecture** | Tech Lead    | ADRs, design decisions              |
| **Business**     | Product/Exec | Strategy, market analysis           |

**Time commitment:** ~1 hour/month per area

### All Contributors

**Responsibilities:**

- Update docs when changing related features
- Fix typos and errors when found
- Add examples and clarifications
- Request reviews for major doc changes

## Maintenance Workflows

### Adding New Documentation

1. **Choose appropriate template:**

   ```bash
   cp docs/.templates/GUIDE_TEMPLATE.md docs/guides/my-new-guide.md
   ```

2. **Fill in frontmatter completely:**
   - title, description, category
   - audience, difficulty (for guides)
   - tags for discoverability

3. **Write content following template structure**

4. **Validate before committing:**

   ```bash
   npm run docs:lint:fix    # Auto-fix formatting
   npm run docs:spell       # Check spelling
   npm run docs:validate    # Full validation
   ```

5. **Submit PR with documentation label**

### Updating Existing Documentation

1. **Update content as needed**

2. **Update frontmatter:**

   ```yaml
   last_updated: 2026-01-31 # Today's date
   ```

3. **Regenerate catalog if categories/tags changed:**

   ```bash
   npm run docs:catalog
   ```

4. **Validate changes:**

   ```bash
   npm run docs:validate
   ```

### Archiving Outdated Documentation

1. **Move to archive with reason:**

   ```bash
   mv docs/old-guide.md docs/archive/2026-01-cleanup/old-guide.md
   ```

2. **Update archive index:**

   ```bash
   npm run docs:archive-index
   ```

3. **Add redirect or deprecation notice in related active docs**

4. **Update catalog:**

   ```bash
   npm run docs:catalog
   ```

### Internal Link Conventions

Use relative paths for linking between documentation files:

**✅ Correct:**

```markdown
<!-- Same directory -->

See the [Error Recovery Guide](error-recovery.md)

<!-- Parent directory -->

See [Development Guide](../development/TESTING.md)

<!-- Child directory -->

See [API Reference](reference/tools.md)

<!-- With anchor -->

See [Installation](../INSTALLATION.md#prerequisites)
```

**❌ Incorrect:**

```markdown
<!-- Absolute paths (breaks when docs move) -->

[Guide](/docs/guides/error-recovery.md)

<!-- Full URLs (unnecessary for internal links) -->

[Guide](https://github.com/khill1269/servalsheets/blob/main/docs/guides/error-recovery.md)

<!-- Root-relative (works in browser, fails in editor) -->

[Guide](/guides/error-recovery.md)
```

**Best Practices:**

1. **Use relative paths** - Makes docs portable and works in all contexts
2. **Include file extension** - `.md` ensures link works in GitHub, VS Code, and VitePress
3. **Test locally** - Click links in VS Code preview before committing
4. **Use check script** - `npm run docs:check-links` validates all internal links

**External Links:**

For external URLs, use full HTTPS URLs:

```markdown
<!-- Correct -->

See the [Google Sheets API](https://developers.google.com/sheets/api)

<!-- Also acceptable for readability -->

See the [Google Sheets API][sheets-api]

[sheets-api]: https://developers.google.com/sheets/api
```

**Automated Validation:**

- Internal links checked on every commit (pre-commit hook)
- External links checked weekly (GitHub Actions)
- Both can be run manually: `npm run docs:check-links` and `npm run docs:check-external-links`

## Quality Standards

### Required for All Documentation

- ✅ **Frontmatter** - Complete metadata (title, description, category, etc.)
- ✅ **Zero lint errors** - `npm run docs:lint` passes
- ✅ **Valid links** - No broken internal links
- ✅ **Spell checked** - No typos in prose
- ✅ **Proper formatting** - Consistent markdown style

### Best Practices

- **Clear structure** - Use headings, lists, tables effectively
- **Code examples** - Include runnable examples with expected output
- **Visual aids** - Add diagrams, screenshots when helpful
- **Cross-references** - Link to related documentation
- **Context** - Explain _why_, not just _what_
- **Troubleshooting** - Include common issues and solutions
- **Keep it current** - Update with product changes

## Metrics & Monitoring

### Key Metrics (Auto-generated)

View current metrics: [METRICS_DASHBOARD.md](./METRICS_DASHBOARD.md)

- **Documentation Health Score** - Target: >80%
  - Percentage of docs <6 months old
  - Currently: 100%

- **Frontmatter Coverage** - Target: >95%
  - Docs with complete metadata
  - Currently: 100%

- **Quality Indicators**
  - Zero lint errors ✅
  - Zero broken links ✅
  - > 95% spell-checked ✅

### Freshness Tracking

Run freshness check monthly:

```bash
npm run docs:freshness
```

**Action thresholds:**

- **Fresh (< 3 months)** - No action needed
- **Aging (3-6 months)** - Schedule for review
- **Stale (6-12 months)** - Update within 2 weeks
- **Critical (> 12 months)** - Urgent: Update or archive

### CI Enforcement

Documentation validation runs on every PR:

```yaml
# .github/workflows/docs-validation.yml
- Markdown linting (blocking)
- Spell checking (warning)
- Link validation (blocking)
```

## Tools Reference

### npm Scripts

```bash
# Daily use
npm run docs:lint           # Check markdown formatting
npm run docs:lint:fix       # Auto-fix formatting issues
npm run docs:spell          # Check spelling
npm run docs:validate       # Run all checks

# Maintenance
npm run docs:catalog        # Regenerate catalog
npm run docs:frontmatter    # Add frontmatter to new files
npm run docs:metrics        # Update metrics dashboard
npm run docs:freshness      # Check doc age

# Advanced
npm run docs:prose          # Check prose quality (requires Vale)
npm run docs:archive-index  # Update archive index
npm run docs:audit          # Full audit (lint + spell + links)
```

### Editor Integration

**VS Code Extensions:**

- [markdownlint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) - Real-time linting
- [Code Spell Checker](https://marketplace.visualstudio.com/items?itemName=streetsidesoftware.code-spell-checker) - Spell checking
- [Vale](https://marketplace.visualstudio.com/items?itemName=errata-ai.vale-server) - Prose quality (optional)

**Settings:**

```json
{
  "markdownlint.config": {
    "extends": ".markdownlint.json"
  },
  "cSpell.words": ["ServalSheets", "MCP", "OAuth"]
}
```

## Escalation & Support

### Documentation Issues

1. **Typos, small fixes** - Just fix and commit
2. **Content questions** - Ask in #docs Slack channel
3. **Structural changes** - Discuss with Documentation Owner
4. **Template changes** - Requires approval from Tech Lead

### Getting Help

- **Quick questions:** #docs Slack channel
- **Bug reports:** [GitHub Issues](https://github.com/servalsheets/servalsheets/issues) with `documentation` label
- **Feature requests:** RFC in GitHub Discussions

## Monthly Checklist

Copy this checklist to your monthly maintenance issue:

```markdown
## Documentation Maintenance - [Month YYYY]

### Automated Checks

- [ ] Run `npm run docs:audit` - all checks passing
- [ ] Run `npm run docs:freshness` - review aging docs
- [ ] Run `npm run docs:metrics` - update dashboard

### Manual Review

- [ ] Check docs added this month (completeness, quality)
- [ ] Review aging docs (3-6 months) - schedule updates
- [ ] Update stale docs (6-12 months) or archive
- [ ] Fix any broken links or validation errors

### Improvements

- [ ] Address top 3 issues from metrics dashboard
- [ ] Update examples if product changed significantly
- [ ] Add missing cross-references
- [ ] Improve docs with most user feedback

### Planning

- [ ] Identify documentation gaps for next sprint
- [ ] Review and update maintenance process if needed
- [ ] Share metrics with team
```

## Resources

- [Templates](/.templates/) - Standard doc templates
- [Catalog](./DOCS_CATALOG.md) - Full documentation index
- [Metrics](./METRICS_DASHBOARD.md) - Current doc health metrics
- [Style Guide](./.vale/README.md) - Prose linting setup

---

**Last Updated:** 2026-01-31 | **Owner:** Documentation Team | **Review:** Quarterly
