# Production Readiness Checklist

**Version**: 1.1.0
**Last Updated**: 2026-01-03
**Status**: ✅ PRODUCTION READY

This checklist covers all production readiness requirements based on the comprehensive audit and improvement plan executed in Phases 1-7.

---

## ✅ Critical Blockers (MUST HAVE)

### Security Controls

- [x] **OAuth Redirect URI Allowlist** - Prevents open redirect attacks
  - Implementation: `src/oauth-provider.ts`
  - Environment variable: `ALLOWED_REDIRECT_URIS`
  - Status: ✅ COMPLETE (Phase 1)

- [x] **OAuth State Nonce Storage** - Prevents CSRF and state replay
  - Implementation: HMAC-signed state with one-time use
  - Expiry: 5 minutes TTL
  - Status: ✅ COMPLETE (Phase 1)

- [x] **JWT aud/iss Verification** - Prevents cross-issuer token acceptance
  - Verification: Both `/oauth/introspect` and middleware
  - Clock tolerance: 30 seconds
  - Status: ✅ COMPLETE (Phase 1)

- [x] **Production Secrets Required** - Prevents secret invalidation on restart
  - Required: `JWT_SECRET`, `STATE_SECRET`, `OAUTH_CLIENT_SECRET`
  - Generation: `openssl rand -hex 32`
  - Status: ✅ COMPLETE (Phase 1)

### Protocol Compliance

- [x] **MCP SDK 1.25.1+** - Latest protocol support
  - Current version: 1.25.1
  - Protocol: 2025-11-25
  - Status: ✅ VERIFIED (Phase 1)

- [x] **Node 22 LTS** - Required runtime version
  - Minimum: 22.0.0
  - npm: 10.0.0+
  - Status: ✅ COMPLETE (Phase 3)

---

## ✅ High Priority (STRONGLY RECOMMENDED)

### Infrastructure

- [x] **Session Storage with TTL** - Prevents memory leaks
  - Implementation: SessionStore abstraction
  - In-Memory: Automatic cleanup every 60s
  - Redis: Optional for HA deployments
  - Status: ✅ COMPLETE (Phase 2)

- [x] **Session Limits** - Prevents resource exhaustion
  - Max sessions per user: 5 (configurable)
  - Automatic cleanup of oldest sessions
  - Status: ✅ COMPLETE (Phase 2)

- [x] **Type Safety** - Eliminates runtime type errors
  - Zero `as any` casts
  - Zod schema validation on all inputs
  - Explicit types for all outputs
  - Status: ✅ COMPLETE (Phase 2)

### Dependencies

- [x] **Express 5.x** - Latest stable version
  - Current: 5.2.1
  - Benefits: Async handler support, better performance
  - Status: ✅ COMPLETE (Phase 4)

- [x] **Zod 4.x** - Latest schema validation
  - Current: 4.3.4
  - Benefits: Better type inference, faster parsing
  - Status: ✅ COMPLETE (Phase 4)

- [x] **All Dependencies Current** - Security and features
  - googleapis: 169.0.0 ✅
  - express-rate-limit: 8.2.1 ✅
  - vitest: 4.0.16 ✅
  - p-queue: 9.0.1 ✅
  - uuid: 13.0.0 ✅
  - Status: ✅ COMPLETE (Phase 4)

---

## ✅ Medium Priority (RECOMMENDED)

### Configuration

- [x] **TypeScript Strict Mode** - Maximum type safety
  - All strict options enabled
  - `exactOptionalPropertyTypes`: Disabled (googleapis incompatibility)
  - Status: ✅ VERIFIED (Phase 3)

- [x] **Express Version Alignment** - Consistent types and runtime
  - Runtime: Express 5.2.1
  - Types: @types/express 5.0.6
  - Status: ✅ COMPLETE (Phase 3)

### Code Quality

- [x] **ESLint Configuration** - Consistent code style
  - ESLint 9 flat config
  - TypeScript-specific rules
  - No-explicit-any enforced
  - Status: ✅ COMPLETE (Phase 7)

- [x] **Output Schema Validation** - Type-safe responses
  - No `z.unknown()` except for truly dynamic data
  - Explicit CellValueSchema for cell data
  - Status: ✅ COMPLETE (Phase 6)

---

## ✅ Testing & Quality Assurance

### Test Coverage

- [x] **Unit Tests** - 144 tests passing
  - Coverage: 85.2%
  - All tool handlers tested
  - Schema validation tested
  - Status: ✅ COMPLETE (Phase 7)

- [x] **Integration Tests** - End-to-end verification
  - HTTP transport tested
  - OAuth flow tested
  - Request cancellation tested
  - Status: ✅ COMPLETE (Phase 7)

### CI/CD

- [x] **Security Audit Blocking** - Fail on HIGH/CRITICAL vulnerabilities
  - npm audit --production --audit-level=high
  - Runs before tests in CI
  - Current status: 0 vulnerabilities
  - Status: ✅ COMPLETE (Phase 7)

- [x] **Build Verification** - All entry points tested
  - CLI: `dist/cli.js`
  - HTTP Server: `dist/http-server.js`
  - Remote Server: `dist/remote-server.js`
  - Status: ✅ COMPLETE (Phase 5)

---

## Environment Variables

### Required for Production

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `NODE_ENV` | ✅ Yes | Environment mode | `production` |
| `JWT_SECRET` | ✅ Yes | JWT signing secret | `openssl rand -hex 32` |
| `STATE_SECRET` | ✅ Yes | OAuth state HMAC | `openssl rand -hex 32` |
| `OAUTH_CLIENT_SECRET` | ✅ Yes | OAuth client secret | `openssl rand -hex 32` |
| `ALLOWED_REDIRECT_URIS` | ✅ Yes | OAuth redirect allowlist | `https://app.com/callback` |

### Google API Credentials

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `GOOGLE_CLIENT_ID` | ✅ Yes | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | Google OAuth client secret | From Google Console |

### Optional Configuration

| Variable | Required | Purpose | Default |
|----------|----------|---------|---------|
| `PORT` | No | Server port | `3000` |
| `HOST` | No | Server host | `0.0.0.0` |
| `REDIS_URL` | No | Session storage (HA) | In-memory |
| `MAX_SESSIONS_PER_USER` | No | Session limit | `5` |
| `LOG_LEVEL` | No | Logging level | `info` |
| `CORS_ORIGINS` | No | CORS allowed origins | `*` (dev only) |

---

## Pre-Deployment Verification

### 1. Generate Production Secrets

```bash
# Generate three different secrets
export JWT_SECRET=$(openssl rand -hex 32)
export STATE_SECRET=$(openssl rand -hex 32)
export OAUTH_CLIENT_SECRET=$(openssl rand -hex 32)

# Verify they're different
echo "JWT: $JWT_SECRET"
echo "State: $STATE_SECRET"
echo "OAuth: $OAUTH_CLIENT_SECRET"
```

### 2. Configure Environment Variables

Create `.env.production` file:

```bash
# Required
NODE_ENV=production
JWT_SECRET=<your-jwt-secret>
STATE_SECRET=<your-state-secret>
OAUTH_CLIENT_SECRET=<your-oauth-client-secret>
ALLOWED_REDIRECT_URIS=https://your-app.com/callback

# Google API
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Server
PORT=3000
HOST=0.0.0.0

# Optional: Redis for HA
# REDIS_URL=redis://localhost:6379
```

### 3. Install Dependencies

```bash
npm ci --production
# Installs exact versions from package-lock.json
```

### 4. Build Application

```bash
npm run build
# Should complete with 0 errors
```

### 5. Verify Build

```bash
npm run verify:build
# Should output: "Build OK"

# Test entry points
node dist/cli.js --version
node dist/http-server.js &  # Should start
node dist/remote-server.js &  # Should start
```

### 6. Run Tests (Optional but Recommended)

```bash
npm test
# All 144 tests should pass
```

### 7. Security Audit

```bash
npm audit --production
# Should report: 0 vulnerabilities
```

---

## Deployment Verification

After deployment, verify these critical functions:

### Health Checks

- [ ] **Server Startup**
  ```bash
  # Server should start without errors
  # Check logs for "Server listening on..."
  ```

- [ ] **Health Endpoint**
  ```bash
  curl http://localhost:3000/health
  # Should return: {"status":"ok"}
  ```

### OAuth Flow

- [ ] **Authorize Endpoint**
  ```bash
  curl "http://localhost:3000/oauth/authorize?client_id=xxx&redirect_uri=xxx&response_type=code&state=xxx"
  # Should redirect or show authorization page
  ```

- [ ] **Invalid Redirect URI (Should Fail)**
  ```bash
  curl "http://localhost:3000/oauth/authorize?client_id=xxx&redirect_uri=https://evil.com&response_type=code&state=xxx"
  # Should return 400 error
  ```

- [ ] **State Reuse (Should Fail)**
  ```bash
  # Use same state twice
  # Second use should fail with "state already used" error
  ```

### MCP Protocol

- [ ] **Initialize Request**
  ```bash
  curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25"}}'
  # Should return protocol info
  ```

- [ ] **Tools List**
  ```bash
  curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  # Should return 15 tools
  ```

### Google Sheets API

- [ ] **Spreadsheet Access**
  - Test reading a spreadsheet
  - Test writing to a spreadsheet
  - Verify permissions work correctly

---

## Monitoring & Observability

### Logging

- [ ] **Log Level** - Set to `info` or `warn` in production
- [ ] **Log Format** - JSON format recommended for aggregation
- [ ] **Log Destination** - Configure log file or logging service

### Metrics to Monitor

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Request Latency | <100ms avg | >500ms |
| Error Rate | <1% | >5% |
| Memory Usage | <512MB | >1GB |
| Active Sessions | <1000 | >5000 |
| CPU Usage | <50% | >80% |

### Key Log Events

Monitor these log events:

- `Server listening` - Server started successfully
- `OAuth flow started` - User authentication initiated
- `OAuth flow completed` - User authenticated successfully
- `Tool execution` - MCP tool called
- `Rate limit exceeded` - Too many requests
- `Authentication failed` - Auth error
- `Internal error` - Unexpected error

---

## Security Hardening

### Network Security

- [ ] **HTTPS Only** - Use TLS certificates in production
  ```nginx
  # Nginx example
  server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
  }
  ```

- [ ] **CORS Configuration** - Restrict to known origins
  ```bash
  CORS_ORIGINS=https://claude.ai,https://your-app.com
  ```

- [ ] **Rate Limiting** - Configured via express-rate-limit
  - Default: 100 requests per 15 minutes
  - Adjust based on usage patterns

### Secrets Management

- [ ] **Secrets Storage** - Use secure secrets manager
  - AWS Secrets Manager
  - HashiCorp Vault
  - Google Secret Manager
  - Azure Key Vault

- [ ] **Secret Rotation** - Rotate every 90 days
  - Plan: Document rotation procedure
  - Schedule: Set calendar reminders
  - Process: Test rotation in staging first

- [ ] **Access Control** - Limit who can access secrets
  - Principle of least privilege
  - Audit access logs
  - Use IAM roles

### Network Access

- [ ] **Firewall Rules** - Restrict incoming traffic
  - Allow: 443 (HTTPS), 80 (HTTP redirect)
  - Deny: Everything else

- [ ] **Internal Network** - Use private networking where possible
  - Redis: Internal network only
  - Database: Internal network only
  - Monitoring: Internal network only

---

## Disaster Recovery

### Backup Strategy

- [ ] **Secrets Backup** - Securely backup all secrets
  - Store in encrypted vault
  - Test recovery procedure
  - Document recovery steps

- [ ] **Configuration Backup** - Backup environment variables
  - Store in version control (encrypted)
  - Use configuration management tool
  - Test deployment from backup

### Rollback Plan

- [ ] **Previous Version** - Keep previous deployment available
  - Docker: Tag previous image
  - Binary: Keep previous build
  - Config: Version environment files

- [ ] **Rollback Procedure** - Document rollback steps
  1. Stop current version
  2. Deploy previous version
  3. Verify health checks
  4. Monitor logs for errors

### Incident Response

- [ ] **On-Call Rotation** - Designate responsible personnel
- [ ] **Escalation Path** - Define escalation procedure
- [ ] **Runbook** - Document common issues and fixes
- [ ] **Post-Mortem** - Process for learning from incidents

---

## Performance Optimization

### Redis for High Availability

For production deployments with multiple instances:

```bash
# Install Redis
npm install redis

# Configure Redis URL
export REDIS_URL=redis://localhost:6379

# Verify Redis connection
redis-cli ping
# Should return: PONG
```

### Load Balancing

For high-traffic deployments:

- [ ] **Load Balancer** - Distribute traffic across instances
  - AWS: Application Load Balancer
  - GCP: Cloud Load Balancing
  - Azure: Load Balancer
  - On-prem: nginx, HAProxy

- [ ] **Session Affinity** - Sticky sessions or shared Redis
  - Redis recommended for stateful sessions
  - Health checks on all instances

### Horizontal Scaling

- [ ] **Multiple Instances** - Run multiple server instances
  - Requires Redis for session sharing
  - Shared secret configuration
  - Load balancer required

---

## Compliance & Governance

### Data Privacy

- [ ] **GDPR Compliance** - If serving EU users
  - Data retention policy
  - Right to deletion
  - Data processing agreement

- [ ] **CCPA Compliance** - If serving California users
  - Privacy policy
  - Opt-out mechanism
  - Data disclosure

### Audit Logging

- [ ] **Access Logs** - Log all access attempts
- [ ] **Change Logs** - Log all configuration changes
- [ ] **Security Logs** - Log authentication events
- [ ] **Retention Policy** - Define log retention period

---

## Final Checklist Before Go-Live

### Critical Items

- [ ] All environment variables configured
- [ ] Production secrets generated and stored securely
- [ ] HTTPS/TLS certificates installed
- [ ] OAuth redirect URIs allowlist configured correctly
- [ ] Google API credentials configured
- [ ] Build succeeds with 0 errors
- [ ] All tests pass
- [ ] Security audit shows 0 vulnerabilities

### Recommended Items

- [ ] Redis configured for session storage
- [ ] Monitoring and alerting configured
- [ ] Log aggregation configured
- [ ] Backup and recovery tested
- [ ] Load testing completed
- [ ] Security penetration testing completed
- [ ] Documentation reviewed and updated

### Nice-to-Have Items

- [ ] CDN configured for static assets
- [ ] Auto-scaling configured
- [ ] Blue-green deployment pipeline
- [ ] Canary deployment process
- [ ] Chaos engineering tests

---

## Post-Deployment

### Week 1

- [ ] Monitor error logs daily
- [ ] Check performance metrics
- [ ] Verify OAuth flow works correctly
- [ ] Test with real users
- [ ] Address any issues immediately

### Week 2-4

- [ ] Review monitoring data
- [ ] Optimize based on usage patterns
- [ ] Update documentation with lessons learned
- [ ] Plan capacity scaling if needed

### Ongoing

- [ ] Monthly security audits
- [ ] Quarterly dependency updates
- [ ] Rotate secrets every 90 days
- [ ] Review and update disaster recovery plan

---

## Support & Resources

### Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment examples
- [SECURITY.md](./SECURITY.md) - Security best practices
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [MONITORING.md](./MONITORING.md) - Observability setup
- [PERFORMANCE.md](./PERFORMANCE.md) - Performance tuning

### Getting Help

- GitHub Issues: https://github.com/khill1269/servalsheets/issues
- Security Issues: See SECURITY.md for reporting
- General Questions: Discussion forum

---

**Production Readiness Status**: ✅ **READY FOR DEPLOYMENT**

**Last Reviewed**: 2026-01-03
**Next Review**: 2026-04-03 (Quarterly)

**Sign-off**:
- [ ] Engineering Lead: ___________________ Date: ___________
- [ ] Security Team: ___________________ Date: ___________
- [ ] Operations Team: ___________________ Date: ___________
