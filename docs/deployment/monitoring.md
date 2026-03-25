---
title: Monitoring Setup
date: 2026-03-24
status: active
---

# Monitoring Setup

> For comprehensive monitoring configuration, see the [Monitoring Guide](../guides/MONITORING.md).

## Quick Reference

### Health Check Endpoint

```bash
curl http://localhost:3100/health
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `serval_request_duration_seconds` | Histogram | Request latency |
| `serval_google_api_calls_total` | Counter | Google API call count |
| `serval_errors_total` | Counter | Error count by type |
| `serval_cache_hit_ratio` | Gauge | Cache effectiveness |

### Grafana Dashboard

Import the pre-built dashboard from `deployment/grafana/dashboards/`.

### Alerting

See [Operations: High Error Rate](../operations/high-error-rate.md) and the [Runbooks](../runbooks/README.md) for alert response procedures.

## Detailed Guides

- **[Full Monitoring Guide](../guides/MONITORING.md)** — Prometheus, Grafana, alerting rules
- **[Metrics Reference](../operations/METRICS_REFERENCE.md)** — Complete metric catalog
- **[Tracing Dashboard](../operations/TRACING_DASHBOARD.md)** — Distributed tracing setup
- **[Cost Attribution](../operations/COST_ATTRIBUTION.md)** — Usage tracking per tenant
