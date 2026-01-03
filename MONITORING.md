# Monitoring and Observability Guide

This guide covers monitoring, logging, and observability strategies for ServalSheets in production.

## Table of Contents

- [Overview](#overview)
- [Structured Logging](#structured-logging)
- [Metrics Collection](#metrics-collection)
- [Health Checks](#health-checks)
- [APM Integration](#apm-integration)
- [Alerting](#alerting)
- [Dashboards](#dashboards)
- [Troubleshooting](#troubleshooting)

---

## Overview

ServalSheets provides comprehensive observability through:

- **Structured JSON logging** - Machine-parseable logs
- **Performance metrics** - Operation timing and quota usage
- **Health checks** - Service readiness and liveness
- **Error tracking** - Detailed error context
- **Quota monitoring** - Google API quota usage

### Observability Goals

| Goal | Target | Method |
|------|--------|--------|
| Log all operations | 100% | Structured logging |
| Track quota usage | Real-time | Metrics |
| Detect errors | < 1 min | Alerting |
| Performance visibility | Per-operation | Tracing |
| Service health | 99.9% uptime | Health checks |

---

## Structured Logging

ServalSheets uses **structured JSON logging** for machine-parseable logs.

### Log Levels

```typescript
// From src/logging/logger.ts
export enum LogLevel {
  DEBUG = 'debug',    // Detailed debugging info
  INFO = 'info',      // General information
  WARN = 'warn',      // Warning messages
  ERROR = 'error',    // Error messages
}
```

### Configuration

```bash
# Set log level
export LOG_LEVEL=info           # debug, info, warn, error

# Set log format
export LOG_FORMAT=json          # json or text

# Set log destination (optional)
export LOG_FILE=/var/log/servalsheets/app.log
```

### Log Format

#### JSON Format (Production)

```json
{
  "timestamp": "2025-01-03T10:15:30.123Z",
  "level": "info",
  "message": "Operation completed",
  "operation": "sheets_spreadsheet:read",
  "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "Sheet1!A1:D10",
  "duration": 156,
  "quotaType": "read",
  "cellCount": 40,
  "success": true
}
```

#### Text Format (Development)

```
2025-01-03T10:15:30.123Z [INFO] Operation completed
  operation: sheets_spreadsheet:read
  spreadsheetId: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
  range: Sheet1!A1:D10
  duration: 156ms
  quotaType: read
  cellCount: 40
```

### Log Schema

```typescript
// From src/logging/schemas.ts
export interface OperationLog {
  timestamp: string;          // ISO 8601
  level: LogLevel;           // debug, info, warn, error
  message: string;           // Human-readable message
  operation: string;         // Tool:action (e.g., sheets_spreadsheet:read)
  spreadsheetId?: string;    // Spreadsheet ID
  range?: string;            // Cell range
  duration: number;          // Milliseconds
  quotaType: 'read' | 'write';  // Quota bucket
  cellCount?: number;        // Cells affected
  success: boolean;          // Operation succeeded
  error?: ErrorDetails;      // Error details if failed
}

export interface ErrorDetails {
  code: string;              // Error code
  message: string;           // Error message
  stack?: string;            // Stack trace (debug only)
  retries?: number;          // Retry attempts
}
```

### Logging Examples

#### Successful Operation

```json
{
  "timestamp": "2025-01-03T10:15:30.123Z",
  "level": "info",
  "message": "Read operation completed",
  "operation": "sheets_spreadsheet:read",
  "spreadsheetId": "xxx",
  "range": "Sheet1!A1:D10",
  "duration": 156,
  "quotaType": "read",
  "cellCount": 40,
  "success": true
}
```

#### Failed Operation

```json
{
  "timestamp": "2025-01-03T10:15:35.456Z",
  "level": "error",
  "message": "Write operation failed",
  "operation": "sheets_spreadsheet:write",
  "spreadsheetId": "xxx",
  "range": "Sheet1!A1:A10",
  "duration": 245,
  "quotaType": "write",
  "cellCount": 10,
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "The caller does not have permission",
    "retries": 3
  }
}
```

#### Quota Exhaustion

```json
{
  "timestamp": "2025-01-03T10:16:00.789Z",
  "level": "warn",
  "message": "Rate limit approaching",
  "quotaType": "write",
  "quotaUsed": 58,
  "quotaLimit": 60,
  "quotaRemaining": 2,
  "utilizationPct": 96.7
}
```

### Log Aggregation

#### CloudWatch Logs

```bash
# Install CloudWatch agent
sudo yum install amazon-cloudwatch-agent

# Configure log stream
cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json <<EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/servalsheets/*.log",
            "log_group_name": "/servalsheets/production",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%dT%H:%M:%S.%fZ"
          }
        ]
      }
    }
  }
}
EOF

# Start agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json \
  -s
```

#### ELK Stack

```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/servalsheets/*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "servalsheets-%{+yyyy.MM.dd}"
```

#### Splunk

```bash
# inputs.conf
[monitor:///var/log/servalsheets/*.log]
disabled = false
sourcetype = _json
index = servalsheets
```

---

## Metrics Collection

ServalSheets exposes metrics for monitoring performance and quota usage.

### Metric Types

```typescript
// From src/metrics/types.ts
export interface Metrics {
  counters: {
    operations_total: number;           // Total operations
    operations_success: number;         // Successful operations
    operations_error: number;           // Failed operations
    quota_reads_used: number;          // Read quota used
    quota_writes_used: number;         // Write quota used
  };
  gauges: {
    quota_reads_available: number;     // Read tokens available
    quota_writes_available: number;    // Write tokens available
    cache_size: number;                // Cache entries
    memory_usage_mb: number;           // Memory usage
  };
  histograms: {
    operation_duration_ms: number[];   // Operation durations
    cell_count_per_operation: number[]; // Cells affected
  };
}
```

### Prometheus Integration

```typescript
// From src/metrics/prometheus.ts
import { Counter, Gauge, Histogram, register } from 'prom-client';

// Counters
export const operationsTotal = new Counter({
  name: 'servalsheets_operations_total',
  help: 'Total number of operations',
  labelNames: ['operation', 'status'],
});

export const quotaUsed = new Counter({
  name: 'servalsheets_quota_used_total',
  help: 'Total quota used',
  labelNames: ['quota_type'],
});

// Gauges
export const quotaAvailable = new Gauge({
  name: 'servalsheets_quota_available',
  help: 'Available quota tokens',
  labelNames: ['quota_type'],
});

export const cacheSize = new Gauge({
  name: 'servalsheets_cache_size',
  help: 'Number of cache entries',
  labelNames: ['cache_type'],
});

// Histograms
export const operationDuration = new Histogram({
  name: 'servalsheets_operation_duration_ms',
  help: 'Operation duration in milliseconds',
  labelNames: ['operation'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

export const cellCount = new Histogram({
  name: 'servalsheets_cell_count',
  help: 'Number of cells affected by operation',
  labelNames: ['operation'],
  buckets: [1, 10, 100, 1000, 10000, 100000],
});
```

### Metrics Endpoint

```typescript
// Expose /metrics endpoint
import express from 'express';
import { register } from 'prom-client';

const app = express();

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(9090);
```

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'servalsheets'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:9090']
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'servalsheets_.*'
        action: keep
```

### CloudWatch Metrics

```typescript
// From src/metrics/cloudwatch.ts
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: 'us-east-1' });

export async function publishMetrics(metrics: Metrics): Promise<void> {
  await cloudwatch.putMetricData({
    Namespace: 'ServalSheets',
    MetricData: [
      {
        MetricName: 'OperationsTotal',
        Value: metrics.counters.operations_total,
        Unit: 'Count',
        Timestamp: new Date(),
      },
      {
        MetricName: 'QuotaReadsAvailable',
        Value: metrics.gauges.quota_reads_available,
        Unit: 'Count',
        Timestamp: new Date(),
      },
      {
        MetricName: 'OperationDuration',
        Value: metrics.histograms.operation_duration_ms[metrics.histograms.operation_duration_ms.length - 1],
        Unit: 'Milliseconds',
        Timestamp: new Date(),
      },
    ],
  });
}
```

### Key Metrics to Monitor

| Metric | Type | Alert Threshold |
|--------|------|----------------|
| `operations_total` | Counter | - |
| `operations_error` | Counter | > 5% of total |
| `quota_reads_available` | Gauge | < 10% |
| `quota_writes_available` | Gauge | < 10% |
| `operation_duration_ms` | Histogram | p95 > 5000ms |
| `cache_size` | Gauge | > 80% of max |
| `memory_usage_mb` | Gauge | > 80% of limit |

---

## Health Checks

ServalSheets provides health check endpoints for service monitoring.

### Health Check Types

#### 1. Liveness Probe

Checks if service is running.

```typescript
// From src/health/liveness.ts
export async function checkLiveness(): Promise<boolean> {
  // Simple check: is process alive?
  return true;
}

// Endpoint
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

#### 2. Readiness Probe

Checks if service can handle requests.

```typescript
// From src/health/readiness.ts
export async function checkReadiness(): Promise<HealthStatus> {
  const checks = {
    auth: await checkAuthentication(),
    api: await checkGoogleAPI(),
    cache: await checkCache(),
    rateLimit: await checkRateLimits(),
  };

  const healthy = Object.values(checks).every(check => check.healthy);

  return {
    healthy,
    checks,
  };
}

// Endpoint
app.get('/health/ready', async (req, res) => {
  const status = await checkReadiness();
  res.status(status.healthy ? 200 : 503).json(status);
});
```

#### 3. Startup Probe

Checks if service has started successfully.

```typescript
// From src/health/startup.ts
export async function checkStartup(): Promise<HealthStatus> {
  const checks = {
    config: await checkConfiguration(),
    credentials: await checkCredentials(),
    initialization: await checkInitialization(),
  };

  const ready = Object.values(checks).every(check => check.healthy);

  return {
    ready,
    checks,
  };
}

// Endpoint
app.get('/health/startup', async (req, res) => {
  const status = await checkStartup();
  res.status(status.ready ? 200 : 503).json(status);
});
```

### Health Check Responses

#### Healthy

```json
{
  "status": "healthy",
  "timestamp": "2025-01-03T10:15:30.123Z",
  "checks": {
    "auth": {
      "healthy": true,
      "message": "Authentication configured"
    },
    "api": {
      "healthy": true,
      "message": "Google API reachable",
      "latency": 45
    },
    "cache": {
      "healthy": true,
      "message": "Cache operational",
      "size": 42,
      "maxSize": 100
    },
    "rateLimit": {
      "healthy": true,
      "message": "Rate limits healthy",
      "reads": { "available": 280, "capacity": 300 },
      "writes": { "available": 55, "capacity": 60 }
    }
  }
}
```

#### Unhealthy

```json
{
  "status": "unhealthy",
  "timestamp": "2025-01-03T10:16:00.456Z",
  "checks": {
    "auth": {
      "healthy": true,
      "message": "Authentication configured"
    },
    "api": {
      "healthy": false,
      "message": "Google API unreachable",
      "error": "Connection timeout after 5000ms"
    },
    "cache": {
      "healthy": true,
      "message": "Cache operational"
    },
    "rateLimit": {
      "healthy": false,
      "message": "Write quota exhausted",
      "reads": { "available": 280, "capacity": 300 },
      "writes": { "available": 0, "capacity": 60 }
    }
  }
}
```

### Kubernetes Integration

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: servalsheets
spec:
  template:
    spec:
      containers:
      - name: servalsheets
        image: servalsheets:latest
        ports:
        - containerPort: 3000
        - containerPort: 9090  # Metrics
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        startupProbe:
          httpGet:
            path: /health/startup
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 5
          failureThreshold: 30
```

---

## APM Integration

ServalSheets integrates with Application Performance Monitoring tools.

### OpenTelemetry

```typescript
// From src/telemetry/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

### Custom Spans

```typescript
// From src/telemetry/tracing.ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('servalsheets');

export async function traceOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Usage
const result = await traceOperation('sheets_spreadsheet:read', async () => {
  return await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:D10' });
});
```

### Datadog APM

```typescript
// From src/telemetry/datadog.ts
import tracer from 'dd-trace';

tracer.init({
  service: 'servalsheets',
  env: process.env.NODE_ENV || 'production',
  version: '1.0.0',
  logInjection: true,
});

// Automatic instrumentation of HTTP, Google APIs, etc.
```

### New Relic

```typescript
// From src/telemetry/newrelic.ts
import newrelic from 'newrelic';

// Custom transaction
newrelic.startWebTransaction('sheets_spreadsheet:read', async () => {
  const result = await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:D10' });

  // Record custom attributes
  newrelic.addCustomAttributes({
    spreadsheetId: 'xxx',
    range: 'A1:D10',
    cellCount: 40,
  });

  return result;
});
```

---

## Alerting

Set up alerts for critical issues.

### Alert Rules

#### 1. Quota Exhaustion

**Condition**: Write quota < 10% of capacity

```yaml
# Prometheus alert
groups:
- name: servalsheets
  rules:
  - alert: WriteQuotaLow
    expr: servalsheets_quota_available{quota_type="write"} < 6
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Write quota low"
      description: "Write quota at {{ $value }} tokens (< 10% of 60)"
```

#### 2. High Error Rate

**Condition**: Error rate > 5% of operations

```yaml
- alert: HighErrorRate
  expr: |
    rate(servalsheets_operations_total{status="error"}[5m]) /
    rate(servalsheets_operations_total[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate"
    description: "Error rate is {{ $value | humanizePercentage }}"
```

#### 3. Slow Operations

**Condition**: P95 latency > 5 seconds

```yaml
- alert: SlowOperations
  expr: histogram_quantile(0.95, servalsheets_operation_duration_ms) > 5000
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Operations running slow"
    description: "P95 latency is {{ $value }}ms"
```

#### 4. Service Down

**Condition**: Health check failing

```yaml
- alert: ServiceDown
  expr: up{job="servalsheets"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "ServalSheets service down"
    description: "Service has been down for 1 minute"
```

### PagerDuty Integration

```typescript
// From src/alerts/pagerduty.ts
import { Event } from '@pagerduty/pdjs';

export async function triggerAlert(
  severity: 'critical' | 'error' | 'warning',
  message: string,
  details: Record<string, any>
): Promise<void> {
  const event = new Event({
    routing_key: process.env.PAGERDUTY_ROUTING_KEY,
    event_action: 'trigger',
    payload: {
      summary: message,
      severity,
      source: 'servalsheets',
      custom_details: details,
    },
  });

  await event.send();
}
```

### Slack Integration

```typescript
// From src/alerts/slack.ts
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendAlert(
  channel: string,
  message: string,
  severity: 'info' | 'warning' | 'error'
): Promise<void> {
  const color = {
    info: '#36a64f',
    warning: '#ff9900',
    error: '#ff0000',
  }[severity];

  await slack.chat.postMessage({
    channel,
    attachments: [{
      color,
      title: 'ServalSheets Alert',
      text: message,
      ts: Math.floor(Date.now() / 1000).toString(),
    }],
  });
}
```

---

## Dashboards

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "ServalSheets Monitoring",
    "panels": [
      {
        "title": "Operations Rate",
        "targets": [
          {
            "expr": "rate(servalsheets_operations_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(servalsheets_operations_total{status=\"error\"}[5m])"
          }
        ]
      },
      {
        "title": "Quota Usage",
        "targets": [
          {
            "expr": "servalsheets_quota_available{quota_type=\"read\"}"
          },
          {
            "expr": "servalsheets_quota_available{quota_type=\"write\"}"
          }
        ]
      },
      {
        "title": "Operation Duration (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, servalsheets_operation_duration_ms)"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "rate(servalsheets_cache_hits[5m]) / rate(servalsheets_cache_requests[5m])"
          }
        ]
      }
    ]
  }
}
```

### CloudWatch Dashboard

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["ServalSheets", "OperationsTotal", { "stat": "Sum" }],
          [".", "OperationsError", { "stat": "Sum" }]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Operations"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["ServalSheets", "QuotaReadsAvailable"],
          [".", "QuotaWritesAvailable"]
        ],
        "period": 60,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Quota Availability"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["ServalSheets", "OperationDuration", { "stat": "p95" }]
        ],
        "period": 300,
        "stat": "p95",
        "region": "us-east-1",
        "title": "Operation Duration (P95)"
      }
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

#### High Latency

**Symptoms**: Operations taking > 5 seconds

**Debugging**:
```bash
# Check slow operations
cat logs.json | jq 'select(.duration > 5000)'

# Check for quota exhaustion
cat logs.json | jq 'select(.error.code == "RATE_LIMIT_EXCEEDED")'

# Check cache hit rate
cat logs.json | jq 'select(.cache_hit == false)' | wc -l
```

**Solutions**:
- Enable caching with longer TTLs
- Use METADATA diff instead of FULL
- Batch operations
- Reduce effect scope

#### Quota Errors

**Symptoms**: 429 Rate Limit Exceeded errors

**Debugging**:
```bash
# Check quota usage
cat logs.json | jq 'select(.quotaType == "write") | .operation'

# Check quota available
curl http://localhost:3000/health/ready | jq '.checks.rateLimit'
```

**Solutions**:
- Reduce rate limits: `SERVALSHEETS_WRITES_PER_MINUTE=40`
- Enable caching to reduce API calls
- Batch operations
- Request quota increase from Google

#### Memory Issues

**Symptoms**: High memory usage, OOM errors

**Debugging**:
```bash
# Check memory usage
ps aux | grep servalsheets

# Check for large operations
cat logs.json | jq 'select(.cellCount > 100000)'
```

**Solutions**:
- Use streaming for large datasets
- Use METADATA diff
- Clear cache: `curl -X POST http://localhost:3000/cache/clear`
- Reduce cache size: `SERVALSHEETS_CACHE_DATA_SIZE=500`

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Enable debug logs
export LOG_LEVEL=debug
export LOG_FORMAT=json

# Restart service
systemctl restart servalsheets

# Watch logs
tail -f /var/log/servalsheets/app.log | jq .
```

---

## Summary

ServalSheets provides comprehensive observability:

| Feature | Method | Use Case |
|---------|--------|----------|
| Structured logging | JSON logs | Debugging, auditing |
| Metrics | Prometheus/CloudWatch | Performance, quota |
| Health checks | HTTP endpoints | Kubernetes, load balancers |
| APM | OpenTelemetry/Datadog | Distributed tracing |
| Alerting | Prometheus/PagerDuty | Incident response |
| Dashboards | Grafana/CloudWatch | Visualization |

**Key Takeaway**: Enable structured logging, expose metrics, and set up alerts for critical issues like quota exhaustion and high error rates.

For deployment examples, see `DEPLOYMENT.md`.
For common issues, see `TROUBLESHOOTING.md`.
