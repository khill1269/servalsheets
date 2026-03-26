---
title: Docs System Audit
date: 2026-03-24
status: active
audience: development
---

# Docs System Audit

## Purpose

This audit focuses on the documentation system itself:

- how mutable facts such as tool counts and action counts are produced
- how those facts are propagated into docs
- which validation gates exist today
- why stale docs keep reappearing even after previous cleanup passes

This is not a content audit of every markdown file. It is a systems audit of the docs pipeline.

## Executive Summary

The repo already has the right raw ingredients for durable docs:

- generated metadata in `src/generated/action-counts.ts` and `src/generated/manifest.json`
- regeneration workflows in `npm run schema:commit`
- partial doc generation in `scripts/gen-doc-tables.mjs`
- partial drift checking in `scripts/sync-doc-counts.mjs`

But the system is still failing because it is only partially generated and partially validated.

The main problem is not "missing another count fix". The main problem is that current docs, historical docs, generated docs, and audit artifacts are still mixed together under one docs quality model while mutable facts are still hand-written in too many places.

## Current Mechanisms

### Source Data

- `src/generated/action-counts.ts`
- `src/generated/manifest.json`
- `server.json`
- `manifest.json`

These are the closest things to an authoritative machine-readable source.

### Current Sync / Generation Scripts

- `scripts/gen-doc-tables.mjs`
  - generates `docs/development/ACTION_REGISTRY.md`
  - rewrites fenced sections in `docs/development/CODEBASE_CONTEXT.md`
- `scripts/sync-doc-counts.mjs`
  - scans docs and source for stale hardcoded tool/action counts
  - can rewrite some stale references
- `scripts/check-doc-action-counts.sh`
  - intended count validator, currently broken against the modern file layout
- `scripts/fix-doc-action-counts.sh`
  - intended auto-fixer, currently based on old counts and old assumptions

### Current Validation Gates

- `docs:lint`
- `docs:check-links`
- `docs:spell`
- `docs:audit`
- `check:doc-counts`
- `check:doc-action-counts`
- `validate:doc-tables`

## Findings

## 1. Source Of Truth Is Split And Inconsistently Consumed

The repo has multiple "authoritative" paths for the same facts:

- generated metadata under `src/generated/`
- compatibility re-exports under `src/schemas/`
- root metadata files such as `server.json`
- prose docs that restate those counts manually

This breaks down when scripts consume the wrong layer.

Concrete example:

- `src/schemas/action-counts.ts` is now only a re-export shim
- `scripts/check-doc-action-counts.sh` still tries to parse it with `grep`
- the script misreads the source and reports `0 tools` / empty action counts

That means at least one existing docs gate is no longer reliable even before considering content drift.

## 2. Generation Is Real, But Too Narrow

`scripts/gen-doc-tables.mjs` is the strongest part of the current system, but it only owns a small part of the tree:

- one fully generated file
- a couple of fenced generated sections

Everything else still depends on human-written prose staying synchronized with moving schema metadata.

The result is predictable:

- some docs are always current because they are generated
- many other current-state docs silently drift

## 3. Validation Is Too Regex-Driven And Too Magic-Number-Driven

`scripts/sync-doc-counts.mjs` and `scripts/fix-doc-action-counts.sh` both rely on known stale literals and pattern replacement.

That creates several problems:

- the validator has to keep learning every old count value
- examples and historical discussions are hard to distinguish from current facts
- scripts become stale when file layouts change
- validation logic duplicates metadata logic instead of importing it

This is a brittle design. It is fine as a stopgap, but not as the long-term docs system.

## 4. Active Docs And Historical / Audit Docs Are Not Cleanly Separated

The docs tree contains multiple classes of content:

- active user docs
- active developer docs
- generated docs
- historical release notes
- audit artifacts
- review documents and planning artifacts

But the validation model still treats too much of that tree as one thing.

Observed consequences:

- `docs:audit` is blocked by a large markdownlint backlog in `docs/audits/` and `docs/review/`
- historical counts are intentionally correct for their time, but look "stale" to count scanners
- current docs and historical docs use the same prose conventions, so automated tooling has weak signals

## 5. Docs About The Docs System Are Also Drifting

Several meta-docs that are supposed to explain the authoritative process are themselves stale.

Examples found during this audit:

- `docs/development/SOURCE_OF_TRUTH.md` still states `404` actions in multiple places while the generated metadata is `407`
- `docs/development/PROJECT_STATUS.md` still reports `404` actions
- `docs/development/SCRIPTS_REFERENCE.md` still describes older script behavior and older versions
- `docs/README.md` contains static docs-tree counts that are likely to drift again

This is an important signal: the repo is not only missing content fixes, it is missing a self-healing docs architecture.

## 6. Current User-Facing Guides Mix Stable Guidance With Mutable Facts

The highest-traffic guides often combine:

- setup steps that are stable
- transport descriptions that change over time
- exact counts that change over time
- examples copied from older releases

That combination makes drift almost guaranteed.

Stable setup guidance should remain prose.
Mutable facts should come from generated includes, fenced sections, or tokens.

## 7. Existing Checks Do Not Form A Coherent Layered Model

Current checks overlap, but they do not clearly divide responsibility:

- markdownlint checks formatting
- link checks validate target existence
- count checks validate some mutable facts
- generated-table checks validate a few generated sections

Missing today:

- a single machine-readable docs facts manifest
- a clear distinction between "active docs" and "historical docs"
- a strict rule for which docs may contain raw mutable numbers
- a validation step that asserts token expansion / generated section freshness comprehensively

## Root Causes

The repeated drift is coming from these underlying causes:

1. Mutable facts are still stored in prose instead of generated content.
2. The repo has multiple metadata layers, but scripts do not all consume the same one.
3. Validation scripts encode stale assumptions about file locations and old count values.
4. Historical and current docs are not strongly typed as different document classes.
5. The docs quality gate is too broad in some places and too weak in others.

## What A Better System Looks Like

The next version of the docs system should use four explicit document classes:

1. `active`
   - user guides, developer guides, deployment docs
   - must have current facts
2. `generated`
   - machine-owned docs or sections
   - never edited manually
3. `historical`
   - release notes, archived plans, dated audits
   - preserve historical counts and wording
4. `ephemeral`
   - local review artifacts, scratch audits, temporary exports
   - not part of the quality gate

## Recommended Architecture

### A. Promote One Canonical Facts Manifest

Generate a single docs-facing facts file, for example:

- `docs/generated/facts.json`

Populate it from:

- `src/generated/action-counts.ts`
- `src/generated/manifest.json`
- package metadata
- transport capabilities

This file should be the only place docs generators read mutable facts from.

### B. Replace Regex Count Fixes With Tokens Or Generated Sections

For active docs:

- use tokens such as `{{TOOL_COUNT}}` and `{{ACTION_COUNT}}`
- or fenced generated sections for richer blocks

Examples:

- transport summary block
- tool/action totals
- per-tool count tables
- current protocol/version facts

That removes the need for "find old numbers and replace them" logic.

### C. Add Frontmatter-Based Doc Classification

Each file should declare something like:

- `doc_class: active`
- `doc_class: historical`
- `doc_class: generated`

Validation should use that classification instead of guessing from folder names alone.

### D. Split Docs Validation Into Clear Gates

Recommended gates:

- `docs:active`
  - lint active docs
  - check active links
  - validate generated sections/tokens are fresh
  - forbid raw mutable counts in active docs
- `docs:generated`
  - validate generated files are up to date
- `docs:historical`
  - light lint only, no current-count enforcement
- `docs:inventory`
  - catalog size, missing frontmatter, orphaned files, duplication warnings

### E. Make Staleness Structural, Not Heuristic

Instead of scanning for old numbers, enforce rules like:

- active docs may not contain literal patterns like `NNN actions` unless inside a generated section
- current transport summaries must come from generated content
- docs metadata should be validated against the canonical facts manifest

This is stronger than trying to remember every old count ever used.

### F. Make "Docs About Docs" Generated Or Semi-Generated

At minimum, these should stop hardcoding mutable counts:

- `docs/development/SOURCE_OF_TRUTH.md`
- `docs/development/PROJECT_STATUS.md`
- `docs/development/SCRIPTS_REFERENCE.md`
- `docs/README.md`

These files are especially risky because other contributors trust them as operational truth.

## Immediate Priority Fixes

Before a full redesign, these should be corrected first:

1. Replace `scripts/check-doc-action-counts.sh`
   - it is not reliable against the current source layout
2. Remove or quarantine `scripts/fix-doc-action-counts.sh`
   - it still contains obsolete assumptions and example counts
3. Extend `scripts/gen-doc-tables.mjs`
   - widen the set of generated sections for active docs
4. Upgrade `scripts/sync-doc-counts.mjs`
   - move from stale-literal replacement to token expansion
5. Narrow `docs:audit`
   - active docs should not be blocked by legacy audit artifacts

## Better Docs, Beyond Counts

The docs can be better in broader ways too:

- reduce duplicated setup guidance across README, installation, usage, and Claude Desktop docs
- centralize transport explanations so STDIO vs hosted HTTP vs failover is described once
- convert static docs-tree counts and file inventories into generated catalogs
- reduce large monolithic audit docs into summaries plus generated attachments
- add owners or doc domains so high-signal guides have clear maintenance responsibility

## Recommended Implementation Order

1. Fix broken docs gates.
2. Introduce document classes.
3. Create canonical `docs/generated/facts.json`.
4. Add token or generated-section support for active docs.
5. Add CI enforcement that active docs cannot carry raw mutable counts.
6. Reduce duplicated narrative across setup and deployment guides.

## Practical Conclusion

The repo does not need another one-off count cleanup.

It needs a proper docs system with:

- one facts manifest
- typed document classes
- generated current-state facts
- validation that understands active vs historical content

Until that exists, the repo will keep oscillating between "we fixed the stale docs" and "the stale docs came back".
