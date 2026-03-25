---
title: Performance Guide
date: 2026-03-24
status: active
---

# Performance Guide

## Overview

ServalSheets is designed for low-latency MCP operations with efficient Google API utilization.

## Key Performance Characteristics

### Request Latency

- **Cold start:** ~2-3s (first request, OAuth token acquisition)
- **Warm requests:** <200ms for cached operations
- **Google API calls:** 200-800ms depending on operation complexity

### Batching

- Use `sheets_transaction` for 5+ operations — saves 80-95% of API calls
- Batch reads via `batch_read` action instead of multiple `read` calls
- Batch writes via `batch_write` action

### Caching

- Discovery API responses cached for 24h
- Schema metadata cached in memory
- OAuth tokens cached with automatic refresh

## Optimization Tips

1. **Minimize API calls** — use batch operations and transactions
2. **Use `fields` parameter** — request only the data you need
3. **Leverage streaming** — for large datasets use pagination
4. **Monitor quotas** — see [Operations: Metrics Reference](../operations/METRICS_REFERENCE.md)

## Benchmarks

See `benchmarks/` directory for baseline performance data and `benchmarks/README.md` for methodology.

## Related

- [Scaling Guide](../deployment/scaling.md)
- [Monitoring Guide](../guides/MONITORING.md)
- [Metrics Reference](../operations/METRICS_REFERENCE.md)
