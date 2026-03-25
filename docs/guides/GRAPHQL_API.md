---
title: GraphQL API Guide
date: 2026-03-24
status: planned
---

# GraphQL API Guide

> **Status:** This feature is planned but not yet implemented.

## Overview

ServalSheets currently exposes a tool-based MCP interface. A GraphQL API layer is under consideration for future releases to provide:

- **Typed queries** — strongly-typed schema for spreadsheet operations
- **Subscriptions** — real-time change notifications
- **Batch operations** — efficient multi-operation queries
- **Introspection** — self-documenting API

## Current Alternatives

For now, use the MCP tool interface directly:

- **Read data:** `sheets_data` → `read`, `batch_read`
- **Write data:** `sheets_data` → `write`, `batch_write`, `append`
- **Batch operations:** `sheets_transaction` → `begin`, `queue`, `commit`
- **Real-time updates:** `sheets_webhook` → `register`, `watch_changes`

## Related

- [API Reference](../reference/tools.md)
- [Federation Guide](../features/FEDERATION.md)
