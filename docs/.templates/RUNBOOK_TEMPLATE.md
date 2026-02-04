---
title: [Runbook Title - What Operation]
description: [Step-by-step operational procedure for X]
category: runbook
type: [incident|maintenance|deployment|recovery]
severity: [critical|high|medium|low]
estimated_time: [15-30 minutes]
version: 1.6.0
last_updated: 2026-01-31
owner: [Team/Role responsible]
on_call_required: [yes|no]
related_docs:
  - [/docs/operations/related-runbook.md]
tags: [operations, runbook, production]
---

# [Operation Name] Runbook

> **Type:** [Incident Response|Maintenance|Deployment|Recovery]
> **Severity:** [Critical|High|Medium|Low]
> **Time:** ~[15-30] minutes

## Quick Reference

**When to use this runbook:**

- [Symptom/trigger 1]
- [Symptom/trigger 2]
- [Symptom/trigger 3]

**Prerequisites:**

- [ ] [Access/permission 1]
- [ ] [Tool/credential 2]
- [ ] [Environment requirement]

## Symptoms & Detection

### Alert Triggers

```
Alert Name: [AlertName]
Severity: [Critical/High/Medium/Low]
Condition: [metric] > [threshold] for [duration]
```

### Manual Detection

Check for these indicators:

```bash
# Command to check system state
kubectl get pods -n servalsheets

# Expected healthy output
NAME                     READY   STATUS    RESTARTS
servalsheets-api-xxx     1/1     Running   0
```

**Unhealthy signs:**

- [Indicator 1]
- [Indicator 2]

## Impact Assessment

**User Impact:**

- [How users are affected]

**Business Impact:**

- [Revenue/SLA implications]

**Affected Components:**

- [Component 1]
- [Component 2]

## Initial Response (First 5 Minutes)

### 1. Acknowledge & Communicate

```bash
# Acknowledge alert
curl -X POST https://monitoring/api/acknowledge \
  -d '{"incident_id": "xxx"}'
```

**Notify:**

- [ ] Post in #incidents Slack channel
- [ ] Update status page if user-facing
- [ ] Page on-call if severity Critical/High

### 2. Quick Triage

```bash
# Check recent deployments
git log -5 --oneline

# Check error rates
curl https://prometheus/api/query \
  -d 'query=rate(http_errors_total[5m])'
```

### 3. Immediate Mitigation (If Needed)

**Rollback option:**

```bash
# Rollback to previous version
kubectl rollout undo deployment/servalsheets-api
```

**Circuit breaker option:**

```bash
# Disable problematic feature
kubectl set env deployment/servalsheets-api FEATURE_X_ENABLED=false
```

## Detailed Resolution Steps

### Step 1: [Diagnostic Action]

**Purpose:** [Why we're doing this]

```bash
# Command with explanation
command --with --flags
```

**Expected output:**

```
Normal output here
```

**If abnormal, proceed to Step 2. Otherwise skip to Step 3.**

### Step 2: [Corrective Action]

**Purpose:** [What this fixes]

```bash
# Fix command
fix-command --parameters
```

**Verification:**

```bash
# Verify fix worked
verify-command
```

### Step 3: [Validation]

Confirm the system is healthy:

```bash
# Health check
npm run health-check

# Expected output
✓ API responding
✓ Database connected
✓ Cache operational
```

## Rollback Procedure

If resolution fails or makes things worse:

```bash
# Step 1: Stop changes
kubectl rollout pause deployment/servalsheets-api

# Step 2: Revert to last known good
kubectl rollout undo deployment/servalsheets-api

# Step 3: Verify rollback
kubectl rollout status deployment/servalsheets-api
```

## Post-Incident

### Verification Checklist

- [ ] Primary symptoms resolved
- [ ] Error rates back to baseline (<1% 5xx)
- [ ] Response times normal (<200ms p95)
- [ ] No new errors in logs
- [ ] Users can complete workflows

### Communication

```markdown
# Incident Resolution Update

**Status:** Resolved
**Duration:** [start] - [end] ([duration])
**Root Cause:** [Brief description]
**Resolution:** [What we did]

Users should now see normal operation. If issues persist, contact support.
```

### Post-Mortem Action Items

Create post-mortem ticket with:

- [ ] Timeline of events
- [ ] Root cause analysis
- [ ] Action items to prevent recurrence
- [ ] Monitoring improvements needed
- [ ] Documentation updates

## Prevention

**How to avoid this in the future:**

1. [Preventive measure 1]
2. [Monitoring alert to add]
3. [Process improvement]

## Related Runbooks

- [Related Operation 1](/docs/operations/related-runbook.md)
- [Emergency Contacts](/docs/operations/contacts.md)
- [Escalation Procedures](/docs/operations/escalation.md)

## References

- [Monitoring Dashboard](https://grafana.example.com/dashboard)
- [Log Aggregation](https://logs.example.com)
- [Incident Template](https://github.com/repo/issues/new?template=incident)

---

**Runbook Version:** 1.0
**Last Tested:** 2026-01-31
**Next Review:** 2026-04-31
**Owner:** [Team/Role]
