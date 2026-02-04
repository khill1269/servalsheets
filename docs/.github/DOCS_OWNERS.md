---
title: Documentation Ownership
description: Area ownership and responsibilities for documentation maintenance
category: development
last_updated: 2026-01-31
---

# Documentation Ownership

> **Purpose:** Define clear ownership and responsibility for each documentation area

## Overview

This document establishes ownership for documentation maintenance. Owners are responsible for keeping their area current, accurate, and high-quality.

## Ownership Model

### Documentation Owner (Overall)

**Role:** Tech Lead / Engineering Manager

**Responsibilities:**

- Overall documentation strategy and quality
- Quarterly reviews and strategic planning
- Template and standard maintenance
- Resolve cross-area documentation issues
- Monthly health reviews

**Time Commitment:** ~2 hours/month

### Area Owners

Each major documentation area has a designated owner and backup:

| Area                    | Path                        | Owner         | Backup        | Review Frequency |
| ----------------------- | --------------------------- | ------------- | ------------- | ---------------- |
| **User Guides**         | `docs/guides/`              | @product-team | @engineering  | Monthly          |
| **API Reference**       | `docs/reference/`           | @api-team     | @tech-lead    | Quarterly        |
| **Development Docs**    | `docs/development/`         | @engineering  | @tech-lead    | Quarterly        |
| **Operations/Runbooks** | `docs/operations/`          | @devops       | @sre          | Monthly          |
| **Architecture/ADRs**   | `docs/architecture/`        | @tech-lead    | @architects   | As-needed        |
| **Testing Docs**        | `docs/development/testing/` | @qa-team      | @engineering  | Quarterly        |
| **Business/Strategy**   | `docs/business/`            | @product-lead | @exec         | Quarterly        |
| **Deployment**          | `docs/deployment/`          | @devops       | @engineering  | Quarterly        |
| **Examples**            | `docs/examples/`            | @engineering  | @product-team | Quarterly        |

### Special Documentation

| Type                | Owner               | Notes                           |
| ------------------- | ------------------- | ------------------------------- |
| **README.md**       | Tech Lead           | Primary project landing page    |
| **CONTRIBUTING.md** | Engineering Manager | Contributor guidelines          |
| **CHANGELOG.md**    | Release Manager     | Auto-generated, manual curation |
| **SECURITY.md**     | Security Team       | Security policy and disclosure  |
| **Code of Conduct** | Community Manager   | Community standards             |

## Responsibilities by Role

### Primary Owner

**Core duties:**

- ✅ Keep documentation current with product changes
- ✅ Review and merge doc PRs in your area
- ✅ Address issues labeled with your area
- ✅ Monthly: Check freshness, update stale docs
- ✅ Quarterly: Strategic review, identify gaps

**Expected response times:**

- **Critical errors:** Same day
- **User-reported issues:** 2 business days
- **Enhancement requests:** Next planning cycle

### Backup Owner

**Core duties:**

- 📋 Familiar with area documentation
- 📋 Can step in when primary owner unavailable
- 📋 Reviews significant changes
- 📋 Provides second opinion on controversial updates

### All Contributors

**Core duties:**

- 🔧 Update docs when changing related code
- 🔧 Fix errors when discovered
- 🔧 Add examples for new features
- 🔧 Request reviews from area owners

## Ownership Change Process

### Transferring Ownership

1. **Announce** - Notify team in #docs channel
2. **Handoff** - 30-min knowledge transfer meeting
3. **Update** - Modify this document with new owner
4. **Notify** - Update CODEOWNERS if using GitHub

### Adding New Documentation Areas

1. **Propose** - Create RFC in GitHub Discussions
2. **Assign** - Identify owner and backup
3. **Document** - Update this file
4. **Setup** - Create directory, add to catalog

## Accountability

### Monthly Review

Documentation Owner reviews area metrics:

```bash
# Generate metrics for review
npm run docs:metrics
npm run docs:freshness

# Filter by area
npm run docs:freshness --area=guides
```

**Review checklist:**

- [ ] No docs >6 months old without review
- [ ] All PRs in area reviewed within SLA
- [ ] Issues addressed or scheduled
- [ ] Frontmatter and metadata complete

### Quarterly Assessment

Evaluate documentation health by area:

| Metric                | Target                  | Measurement    |
| --------------------- | ----------------------- | -------------- |
| **Freshness**         | >80% docs <3 months     | Automated      |
| **Quality**           | 100% with frontmatter   | Automated      |
| **Coverage**          | All features documented | Manual review  |
| **User satisfaction** | >4.0/5.0 rating         | User surveys   |
| **Response time**     | <2 days average         | Issue tracking |

## Contact & Escalation

### Getting Help with Docs

1. **Quick questions:** #docs Slack channel
2. **Area-specific:** @ mention area owner
3. **Strategic/template changes:** @ Documentation Owner
4. **Urgent production doc issues:** Page on-call

### Escalation Path

```
User/Contributor
  ↓
Area Owner (48h response)
  ↓
Documentation Owner (24h response)
  ↓
Engineering Manager (12h response)
```

## Recognition

Outstanding documentation contributions are recognized:

- **Monthly Spotlight** - Highlight great doc improvements in team meeting
- **Quarterly Awards** - "Documentation Hero" recognition
- **Metrics Tracking** - Contribution stats in [METRICS_DASHBOARD.md](../METRICS_DASHBOARD.md)

## Templates & Resources

- [Guide Template](../.templates/GUIDE_TEMPLATE.md)
- [Reference Template](../.templates/REFERENCE_TEMPLATE.md)
- [Runbook Template](../.templates/RUNBOOK_TEMPLATE.md)
- [ADR Template](../.templates/ADR_TEMPLATE.md)
- [Maintenance Guide](../DOCS_MAINTENANCE.md)
- [Style Guide](../.vale/README.md)

---

**Maintained by:** Documentation Owner
**Last Review:** 2026-01-31
**Next Review:** 2026-04-30 (Quarterly)
