---
title: Demo GIFs
category: general
last_updated: 2026-01-31
description: This directory contains demo GIF animations for ServalSheets.
version: 1.6.0
---

# Demo GIFs

This directory contains demo GIF animations for ServalSheets.

## Available Demos

| Demo              | Description           | Status     |
| ----------------- | --------------------- | ---------- |
| `hero.gif`        | Main README hero demo | 🔲 Pending |
| `basic.gif`       | Basic read/write      | 🔲 Pending |
| `safety.gif`      | Safety rails demo     | 🔲 Pending |
| `ai-features.gif` | AI-powered features   | 🔲 Pending |

## Recording Demos

See [Recording Guide](../../../scripts/demo/RECORDING_GUIDE.md) for instructions.

```bash
# Record a demo
./scripts/demo/record-demo.sh basic

# List available demos
./scripts/demo/record-demo.sh --list
```

## Requirements

- asciinema
- agg (asciinema gif generator)
- gifsicle (optimization)

Install on macOS:

```bash
brew install asciinema agg gifsicle
```
