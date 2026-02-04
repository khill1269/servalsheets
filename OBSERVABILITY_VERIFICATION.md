# ServalSheets Observability Verification Checklist

Comprehensive checklist to verify the observability implementation is working correctly.

## Pre-Flight Checks

### ✅ 1. Code Compilation

```bash
npm run typecheck
```

**Expected:** No TypeScript errors
**Status:** ✅ Passing

### ✅ 2. Docker Compose Validation

```bash
cd deployment/observability
docker-compose config > /dev/null
```

**Expected:** Configuration parses successfully
**Status:** ✅ Valid (warnings about env vars expected)

### ✅ 3. File Structure

**Infrastructure files:**

- [x] `deployment/observability/docker-compose.yml` - Updated with ServalSheets service
- [x] `deployment/observability/.env.example` - Created
- [x] `deployment/observability/tempo-config.yml` - Fixed
- [x] `deployment/prometheus/alertmanager.yml` - Fixed placeholders
- [x] `deployment/prometheus/prometheus.yml` - Fixed port

**Instrumentation files:**

- [x] `src/mcp/registration/tool-handlers.ts` - Added tracing
- [x] `src/handlers/base.ts` - Added instrumentedApiCall helper
- [x] `src/observability/metrics.ts` - Metrics definitions (existing)
- [x] `src/utils/tracing.ts` - Tracing utilities (existing)

**Documentation files:**

- [x] `docs/runbooks/memory-exhaustion.md` - Created
- [x] `docs/runbooks/high-latency.md` - Created
- [x] `docs/runbooks/quota-near-limit.md` - Created
- [x] `docs/runbooks/google-api-errors.md` - Created
- [x] `docs/runbooks/slow-google-api.md` - Created
- [x] `docs/runbooks/low-cache-hit-rate.md` - Created
- [x] `deployment/prometheus/alerts.yml` - Updated runbook URLs
- [x] `deployment/observability/README.md` - Updated with prerequisites
- [x] `docs/operations/METRICS_REFERENCE.md` - Exists (comprehensive)

---

## Deployment Verification

### 1. Configure Environment

```bash
cd deployment/observability
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_CREDENTIALS_PATH=../../credentials.json
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
PAGERDUTY_SERVICE_KEY=your_key_here
```

### 2. Start Observability Stack

```bash
cd deployment/observability
docker-compose up -d
```

**Expected:** 9 services start:

- prometheus
- alertmanager
- grafana
- loki
- promtail
- tempo
- node-exporter
- cadvisor
- servalsheets

### 3. Check Service Health

```bash
docker-compose ps
```

**Expected:** All services show "Up (healthy)"

Wait 2-3 minutes for all health checks to pass.

### 4. Verify Individual Services

**Prometheus:**

```bash
curl -f http://localhost:9090/-/healthy && echo "✓ Prometheus healthy"
```

**Grafana:**

```bash
curl -f http://localhost:3001/api/health && echo "✓ Grafana healthy"
```

**Alertmanager:**

```bash
curl -f http://localhost:9093/-/healthy && echo "✓ Alertmanager healthy"
```

**Loki:**

```bash
curl -f http://localhost:3100/ready && echo "✓ Loki ready"
```

**Tempo:**

```bash
curl -f http://localhost:3200/ready && echo "✓ Tempo ready"
```

**ServalSheets:**

```bash
curl -f http://localhost:3000/metrics && echo "✓ ServalSheets metrics available"
```

### 5. Run Comprehensive Verification

```bash
cd ../../
./scripts/verify-monitoring.sh
```

**Expected:** All tests pass with high success rate

---

## Instrumentation Verification

### 1. Check Metrics Endpoint

```bash
curl http://localhost:3000/metrics
```

**Expected metrics present:**

- `servalsheets_tool_calls_total`
- `servalsheets_tool_call_duration_seconds`
- `servalsheets_google_api_calls_total`
- `servalsheets_google_api_duration_seconds`
- `servalsheets_circuit_breaker_state`
- `servalsheets_cache_hits_total`
- `servalsheets_cache_misses_total`
- `servalsheets_errors_by_type_total`
- `servalsheets_tool_call_latency_summary`
- `process_resident_memory_bytes`
- `nodejs_heap_size_total_bytes`

### 2. Verify Prometheus Scraping

```bash
# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "servalsheets")'
```

**Expected:** ServalSheets target with `health: "up"`

### 3. Test Distributed Tracing

**Make a test request:**

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

**Check Tempo for traces:**

1. Open Grafana: http://localhost:3001
2. Navigate to Explore
3. Select "Tempo" datasource
4. Search for `service.name="servalsheets"`

**Expected:** Traces appear showing tool execution spans

### 4. Verify Metrics Recording

**Check tool call metrics:**

```bash
curl -s 'http://localhost:9090/api/v1/query?query=servalsheets_tool_calls_total' | jq '.data.result[] | {metric: .metric, value: .value[1]}'
```

**Expected:** Counter values > 0 after making requests

---

## Dashboard Verification

### 1. Access Grafana

Open http://localhost:3001

**Credentials:** admin / admin

### 2. Check Datasources

Navigate to: Configuration → Data Sources

**Expected datasources:**

- Prometheus (http://prometheus:9090)
- Loki (http://loki:3100)
- Tempo (http://tempo:3200)

All should show "Data source is working"

### 3. Check Dashboards

Navigate to: Dashboards → Browse

**Expected dashboards:**

1. ServalSheets Overview
2. ServalSheets Performance
3. ServalSheets Errors
4. ServalSheets SLI/SLO

### 4. View Dashboard Data

Open "ServalSheets Overview" dashboard.

**Expected panels:**

- Request Rate
- Error Rate
- P95/P99 Latency
- Cache Hit Rate
- Circuit Breaker Status
- Memory Usage
- Top Tools by Request Count
- Error Distribution

**Note:** Panels will be empty until requests are made to ServalSheets.

---

## Alert Verification

### 1. Check Alert Rules Loaded

```bash
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].name'
```

**Expected groups:**

- servalsheets_critical
- servalsheets_warning
- servalsheets_info
- servalsheets_rate_of_change
- servalsheets_slo

### 2. Verify Alert Evaluation

```bash
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.name == "HighErrorRate")'
```

**Expected:** Alert rule with state "inactive" (or "pending"/"firing" if triggered)

### 3. Check Alertmanager Status

```bash
curl -s http://localhost:9093/api/v2/status | jq '.cluster.status'
```

**Expected:** "ready"

### 4. Test Alert Notification (Optional)

Trigger a test alert:

```bash
curl -X POST http://localhost:9093/api/v1/alerts -d '[
  {
    "labels": {
      "alertname": "TestAlert",
      "severity": "info"
    },
    "annotations": {
      "summary": "Test alert for verification"
    }
  }
]'
```

**Expected:** Alert appears in Alertmanager UI and notification sent (if configured)

---

## Runbook Verification

### 1. Check Runbook Files Exist

```bash
ls -1 docs/runbooks/*.md
```

**Expected files (10 total):**

- auth-failures.md
- circuit-breaker.md
- google-api-errors.md
- high-error-rate.md
- high-latency.md
- low-cache-hit-rate.md
- memory-exhaustion.md
- quota-near-limit.md
- service-down.md
- slow-google-api.md

### 2. Verify Runbook Links in Alerts

```bash
grep "runbook:" deployment/prometheus/alerts.yml | head -5
```

**Expected:** URLs point to GitHub repository:

```
runbook: https://github.com/khill1269/servalsheets/blob/main/docs/runbooks/high-error-rate.md
```

---

## Performance Verification

### 1. Check Tracing Overhead

**Without tracing:**

```bash
# Baseline (if OTEL_ENABLED=false)
time curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**With tracing:**

```bash
# With instrumentation (OTEL_ENABLED=true)
time curl -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Expected:** < 5ms overhead from tracing

### 2. Check Metrics Cardinality

```bash
curl -s http://localhost:3000/metrics | grep -c "^servalsheets_"
```

**Expected:** 25-30 unique metric names (not instances)

### 3. Monitor Memory Usage

```bash
curl -s http://localhost:3000/metrics | grep "process_resident_memory_bytes"
```

**Expected:** < 500MB for idle server, < 2GB under load

---

## Integration Testing

### 1. Make Test Requests

```bash
# Test successful request
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | jq '.result.tools | length'
```

**Expected:** Returns number of tools (21)

### 2. Verify Metrics Updated

```bash
# Check tool call counter incremented
curl -s 'http://localhost:9090/api/v1/query?query=servalsheets_tool_calls_total{tool="sheets_core"}' \
  | jq '.data.result[0].value[1]'
```

**Expected:** Counter value > 0

### 3. Check Trace Generated

Wait 10 seconds, then in Grafana:

1. Navigate to Explore
2. Select Tempo datasource
3. Query: `service.name="servalsheets"`

**Expected:** Trace entries for recent requests

---

## Troubleshooting

### Services Won't Start

**Check logs:**

```bash
docker-compose logs -f [service-name]
```

**Common issues:**

- Port conflicts (9090, 3001, 9093, 3100, 3200, 3000)
- Missing .env file
- Invalid YAML syntax

### Metrics Not Appearing

**Check:**

1. ServalSheets is running: `curl http://localhost:3000/metrics`
2. Prometheus scraping: `curl http://localhost:9090/api/v1/targets`
3. Prometheus config: `grep -A10 "job_name: 'servalsheets'" deployment/prometheus/prometheus.yml`

### Traces Not Appearing

**Verify:**

1. OTEL_ENABLED=true in environment
2. OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318
3. Tempo is running: `curl http://localhost:3200/ready`

### Dashboards Empty

**Check:**

1. Datasources configured correctly
2. Prometheus has data: `curl http://localhost:9090/api/v1/query?query=up`
3. Make test requests to generate metrics

---

## Success Criteria

All checks passing:

- [x] TypeScript compilation clean
- [ ] All 9 services healthy
- [ ] Metrics endpoint accessible
- [ ] Prometheus scraping ServalSheets
- [ ] Grafana dashboards showing data
- [ ] Traces visible in Tempo
- [ ] Alert rules loaded
- [ ] Runbooks accessible
- [ ] < 5ms tracing overhead
- [ ] All verification script tests pass

---

## Next Steps After Verification

1. **Configure alerts** - Add Slack/PagerDuty credentials to .env
2. **Import dashboards** - If not auto-provisioned, import from deployment/grafana/dashboards/
3. **Set up SLOs** - Configure error budgets in Grafana
4. **Enable production mode** - Set NODE_ENV=production
5. **Monitor for 24h** - Verify stability and adjust thresholds

---

## Support

If verification fails:

- Check logs: `docker-compose logs -f`
- Review README: `deployment/observability/README.md`
- Check runbooks: `docs/runbooks/`
- Verify monitoring guide: `docs/guides/MONITORING.md`
