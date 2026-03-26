---
title: Test Account Setup Guide
category: guide
last_updated: 2026-03-24
description: Prepare a reviewer-safe Google Sheets test account for Anthropic remote MCP submission.
version: 2.0.0
tags: [testing, setup, oauth, submission]
audience: developer
difficulty: intermediate
doc_class: active
---

# Test Account Setup Guide

This guide prepares a reviewer-safe account and dataset for Anthropic remote MCP
submission.

The goal is not just "a login that works." The goal is a stable reviewer
environment that remains available during and after review.

## Requirements

- separate test Google Cloud project
- separate reviewer Google account or reviewer-ready shared account
- representative sample spreadsheets
- written instructions for at least 3 successful example workflows

## 1. Create A Dedicated Test Project

1. Create a separate Google Cloud project for reviewer access.
2. Enable the Google Sheets API and Google Drive API.
3. Keep this project isolated from production credentials and production data.

## 2. Configure OAuth Consent And Credentials

1. Configure the OAuth consent screen for the reviewer flow.
2. Use only the scopes the submitted server actually needs.
3. Add the current Claude callback URLs and any localhost testing callbacks you support.
4. Record the reviewer-safe client ID, secret, and redirect URIs in your secure submission notes.

Do not document obsolete Claude Desktop config hacks here. Reviewer setup should
match the current remote connector flow documented in
[`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md).

## 3. Create Representative Sample Data

Create a small, realistic dataset that exercises the submitted feature surface.

Recommended sheets:

- `ServalSheets-Test-Basic`
  Purpose: read, write, filter, sort, formatting
- `ServalSheets-Test-Financial`
  Purpose: formulas, summaries, charts, analysis
- `ServalSheets-Test-MultiSheet`
  Purpose: cross-sheet references and structured workflows
- `ServalSheets-Test-Approval`
  Purpose: collaboration, comments, approvals, reviewer-safe mutation testing

Keep the content synthetic and safe to share. Do not use production or customer
data.

## 4. Record Stable Test IDs

Record spreadsheet IDs in a secure internal note or environment file used only
for testing and reviewer support.

Example:

```bash
export TEST_SPREADSHEET_BASIC="1ABC...xyz"
export TEST_SPREADSHEET_FINANCIAL="1DEF...xyz"
export TEST_SPREADSHEET_MULTISHEET="1GHI...xyz"
export TEST_SPREADSHEET_APPROVAL="1JKL...xyz"
```

## 5. Verify The Submitted Workflows

Before submission, make sure the reviewer account can successfully complete at
least 3 documented examples.

Recommended coverage:

1. Authentication and readiness
2. Safe read workflow
3. One representative mutation workflow
4. One analysis workflow
5. One collaboration or approval workflow if that surface is submitted

## 6. Sharing Access For Review

Preferred reviewer model:

- provide a dedicated reviewer account or shared OAuth-ready reviewer path
- provide clear login instructions
- provide sample spreadsheet access ahead of time
- keep the account active after initial review

Avoid making "send a raw service-account JSON key" the default guidance. If you
use a service account for a special review path, document why, scope it tightly,
and treat it as an exception rather than the standard reviewer experience.

## 7. Security Rules

- never commit reviewer credentials to the repo
- never reuse production credentials
- keep reviewer access scoped to synthetic test data
- rotate or revoke access only after the review window is clearly closed
- expect periodic re-review after admission and keep a support path available

## 8. Reviewer Hand-Off Checklist

- [ ] reviewer login path documented
- [ ] test spreadsheets shared
- [ ] at least 3 example prompts documented
- [ ] expected successful results described
- [ ] support contact listed
- [ ] account can remain active during and after review

## 9. Related Docs

- [`SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md)
- [`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md)
