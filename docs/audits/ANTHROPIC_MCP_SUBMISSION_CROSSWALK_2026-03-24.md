---
title: Anthropic MCP Submission Crosswalk
date: 2026-03-24
status: active
audience: development
---

# Anthropic MCP Submission Crosswalk

## Purpose

This document compares Anthropic's current official expectations for remote MCP
directory submission against the current ServalSheets docs set.

It is intended to answer two questions:

- what Anthropic currently requires for remote MCP directory approval
- where the current ServalSheets docs are stale, incomplete, or misleading

## Official Anthropic Sources Reviewed

- [Remote MCP Server Submission Guide](https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide)
- [Anthropic MCP Directory Policy](https://support.claude.com/en/articles/11697096-anthropic-mcp-directory-policy)
- [Building custom connectors via remote MCP servers](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [Get started with custom connectors using remote MCP](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)

## Anthropic's Current Remote MCP Expectations

## 1. Core submission requirements

Anthropic currently expects remote MCP submissions to provide:

- a working production-ready remote server over HTTPS
- Streamable HTTP transport
- complete documentation
- a privacy policy
- a support contact or support URL
- a test account with representative sample data if auth is required
- a minimum of 3 working usage examples
- end-to-end testing from Claude.ai, Claude Desktop, and ideally Claude Code

## 2. Tool requirements

Anthropic's current policy requires:

- accurate `readOnlyHint`
- accurate `destructiveHint`
- applicable `title`
- descriptions that narrowly and accurately match actual behavior
- tool names no longer than 64 characters
- token-efficient tool results

## 3. OAuth and remote connector requirements

For authenticated remote servers, Anthropic currently expects:

- OAuth 2.0 authorization code flow
- support for recognized TLS certificates
- allowlisted callback URLs for Claude and local MCP tools
- support for real Claude remote-connector UX, not legacy local config hacks

Important current behavior:

- Claude Desktop remote connectors are added through `Settings > Connectors`
- Claude Desktop will not connect to remote servers configured directly in `claude_desktop_config.json`
- Claude callback URLs currently include both `https://claude.ai/api/mcp/auth_callback`
  and `https://claude.com/api/mcp/auth_callback`
- localhost callback URLs remain relevant for Claude Code / MCP Inspector testing

## 4. Firewall, privacy, and operational expectations

Anthropic currently expects:

- Claude IP allowlisting if the server sits behind a firewall
- CORS configured for required Claude browser origins
- collection of only the minimum necessary user data
- no collection of extraneous conversation data
- reliable performance, high availability, and helpful error handling
- a GA-quality server, not a beta or unstable offering

## 5. Directory policy constraints

Anthropic's current policy also disallows or sharply limits some server types,
including:

- money movement / financial transaction servers
- image, video, or audio generation servers
- cross-service automation servers that orchestrate actions across unrelated
  third-party applications

This matters because policy fit is not only a docs problem.

## Crosswalk: Current ServalSheets Docs vs Official Expectations

## A. Submission checklist is incomplete

File:

- `docs/guides/SUBMISSION_CHECKLIST.md`

What it gets right:

- Streamable HTTP
- OAuth callback allowlisting in general
- privacy/support presence
- production deployment basics

What is missing or stale:

- still marked `version: 1.6.0`
- does not explicitly require a minimum of 3 working examples
- does not mention Anthropic's current GA-only expectation
- does not mention token-efficiency expectations
- does not mention testing from Claude.ai, Claude Desktop, and Claude Code
- only checks `readOnlyHint` and `destructiveHint`, but not `title`

## B. Test-account guidance conflicts with current review expectations

File:

- `docs/guides/TEST_ACCOUNT_SETUP.md`

Main problems:

- still marked `version: 1.6.0`
- frames the process around "Anthropic Directory" but not the current remote
  connector review flow
- recommends revoking credentials after verification is complete

Why this is a problem:

Anthropic's submission guide says test accounts should remain active during and
after review for periodic post-admission review. Local guidance should not tell
maintainers to tear access down immediately after initial verification.

Secondary issue:

- it recommends sharing a service-account JSON key file

That may still be usable in some controlled review workflows, but it is not the
best default guidance for a modern remote MCP submission doc. The default should
be secure credential sharing with active test access and explicit lifetime
management.

## C. OAuth user setup doc is actively wrong for current Claude remote connectors

File:

- `docs/guides/OAUTH_USER_SETUP.md`

Main problem:

The guide tells users to edit `claude_desktop_config.json` and switch Claude
Desktop from stdio to HTTP transport.

That conflicts with Anthropic's current connector guidance, which says remote
connectors are added in Claude via `Settings > Connectors`, and that Claude
Desktop will not use remote servers configured directly in
`claude_desktop_config.json`.

This is not just stale wording. It is the wrong setup path.

Additional OAuth drift:

- the guide only documents localhost redirect URIs
- it does not document both current Claude callback URLs
- it still presents the repo as if the local HTTP server is the main Claude
  Desktop integration path

## D. Firewall guide mixes good principle with risky stale specifics

File:

- `docs/guides/FIREWALL_CONFIGURATION.md`

What it gets right:

- points readers to Anthropic's IP address page as the authority

What is risky or stale:

- still marked `version: 1.6.0`
- includes hardcoded example IP ranges
- claims the examples are current as of January 2026
- includes stale versioned health-response examples

This doc should not embed example IP ranges unless they are generated or clearly
isolated as non-authoritative operational examples.

## E. Reference and meta-docs still drift on mutable counts

Files:

- `docs/reference/tools.md`
- `docs/development/SOURCE_OF_TRUTH.md`
- `docs/development/PROJECT_STATUS.md`

Current issue:

- these docs still describe `403` or `404` actions in places
- generated metadata currently says `25 tools, 407 actions`

This confirms that the docs system is still partially hand-maintained and does
not yet guarantee synchronization for current-state facts.

## F. Docs validation is not reliable enough yet

Current state from repo checks:

- `npm run check:doc-counts` works as a stale-reference scanner
- `npm run validate:doc-tables` catches real generated-section drift
- `npm run check:doc-action-counts` is currently broken because it parses the
  compatibility re-export instead of generated metadata

That means the repo does not yet have a coherent submission-doc quality gate.

## Policy Risks Beyond Documentation

These are not confirmed rejections, but they are real review risks based on the
current product surface.

## 1. Cross-service automation risk

Anthropic's current directory policy disallows cross-service automation across
unrelated third-party applications.

ServalSheets currently exposes capabilities that may raise questions here:

- `sheets_connectors`
- `sheets_federation`
- parts of `sheets_bigquery`

The exact review outcome depends on how these tools are scoped in practice, but
this should be treated as a policy review item, not only a docs edit.

## 2. Remote vs local architecture messaging risk

The repo has spent significant effort separating:

- local stdio adapter behavior
- hosted HTTP behavior
- remote hosted failover behavior

Some docs still blur those surfaces together, especially older OAuth/setup
guides. For submission, Anthropic will expect a clean explanation of the remote
server entrypoint and the user-facing connection flow.

## What Should Change Next

## 1. Replace the current submission docs set with a generated/current pack

Best candidates:

- one current remote-submission guide
- one current reviewer test-account guide
- one current remote-connector OAuth guide

These should be driven by generated facts for:

- tool count
- action count
- protocol version
- transport support
- required callback URLs

## 2. Split docs by class

Use explicit doc classes:

- `active`
- `generated`
- `historical`
- `ephemeral`

Then enforce current facts only for active docs.

## 3. Retire or rewrite broken validation scripts

In particular:

- rewrite `scripts/check-doc-action-counts.sh`
- quarantine `scripts/fix-doc-action-counts.sh` until it is rebuilt against the
  generated metadata path

## 4. Treat submission readiness as both docs work and policy work

Before any actual directory submission:

- confirm which tool families are in-scope for directory policy
- decide whether connector/federation surfaces should be hidden, excluded, or
  separately justified
- verify the remote entrypoint and OAuth flow using the real current Claude
  connector flow

## Bottom Line

ServalSheets does not mainly have a "fix a few stale docs" problem.

It has:

- a partially modernized docs system
- a partially stale submission-doc set
- at least one actively wrong remote-setup guide
- at least one likely policy-review area beyond docs itself

The right next step is a comprehensive submission-pack rebuild based on current
Anthropic requirements and generated repo facts, not another regex cleanup pass.
