# Production Deployment Quick Start Guide

**ServalSheets v1.1.0** - Ready for production deployment

This guide provides step-by-step instructions for deploying ServalSheets to production.

---

## Prerequisites

- Node.js 22 LTS installed
- Google Cloud Project with Sheets API enabled
- Service account JSON credentials
- Domain with SSL/TLS certificate (for HTTP mode)
- Environment secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)

---

## Deployment Methods

### Method 1: Docker (Recommended for Cloud)

**Step 1: Build Docker Image**
```bash
docker build -t servalsheets:1.1.0 .
```

**Step 2: Create Production Environment File**
```bash
# Create .env.production (DO NOT COMMIT)
cat > .env.production <<EOF
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json

# Google Credentials
GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/service-account.json

# HTTP Mode (if using)
HTTP_PORT=3000
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=https://your-domain.com/callback
SESSION_SECRET=your-session-secret-min-32-chars
ALLOWED_REDIRECT_URIS=https://your-domain.com/callback

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Security
CORS_ALLOWED_ORIGINS=https://your-domain.com
EOF
```

**Step 3: Run Container**
```bash
# For stdio mode (Claude Desktop)
docker run -d \
  --name servalsheets \
  -v /path/to/service-account.json:/app/credentials/service-account.json:ro \
  --env-file .env.production \
  servalsheets:1.1.0

# For HTTP mode
docker run -d \
  --name servalsheets \
  -p 3000:3000 \
  -v /path/to/service-account.json:/app/credentials/service-account.json:ro \
  --env-file .env.production \
  servalsheets:1.1.0 npm run start:http
```

**Step 4: Verify Deployment**
```bash
docker logs servalsheets
docker exec servalsheets npm test
```

---

### Method 2: Kubernetes

**Step 1: Create Kubernetes Secret**
```bash
# Create namespace
kubectl create namespace servalsheets

# Add service account credentials
kubectl create secret generic google-credentials \
  --from-file=service-account.json=/path/to/service-account.json \
  -n servalsheets

# Add OAuth secrets
kubectl create secret generic oauth-secrets \
  --from-literal=client-id=your-client-id \
  --from-literal=client-secret=your-client-secret \
  --from-literal=session-secret=your-session-secret \
  -n servalsheets
```

**Step 2: Apply Kubernetes Manifests**
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

**Step 3: Monitor Deployment**
```bash
kubectl get pods -n servalsheets -w
kubectl logs -f deployment/servalsheets -n servalsheets
```

See [Kubernetes documentation](./DEPLOYMENT.md#kubernetes-deployment) for full manifests.

---

### Method 3: systemd Service (Linux VPS)

**Step 1: Install Dependencies**
```bash
# On production server
cd /opt
git clone <your-repo> servalsheets
cd servalsheets
npm ci --production
npm run build
```

**Step 2: Create systemd Service**
```bash
sudo tee /etc/systemd/system/servalsheets.service > /dev/null <<EOF
[Unit]
Description=ServalSheets MCP Server
After=network.target

[Service]
Type=simple
User=servalsheets
WorkingDirectory=/opt/servalsheets
Environment="NODE_ENV=production"
Environment="GOOGLE_APPLICATION_CREDENTIALS=/etc/servalsheets/service-account.json"
ExecStart=/usr/bin/node /opt/servalsheets/dist/http-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=servalsheets

[Install]
WantedBy=multi-user.target
EOF
```

**Step 3: Start Service**
```bash
sudo systemctl daemon-reload
sudo systemctl enable servalsheets
sudo systemctl start servalsheets
sudo systemctl status servalsheets
```

---

### Method 4: PM2 Process Manager

**Step 1: Install PM2**
```bash
npm install -g pm2
```

**Step 2: Create PM2 Ecosystem File**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'servalsheets',
    script: './dist/http-server.js',
    instances: 2,
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      HTTP_PORT: 3000,
      LOG_LEVEL: 'info',
      LOG_FORMAT: 'json'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**Step 3: Start with PM2**
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## Cloud Platform Deployments

### AWS (ECS/Fargate)

1. Push Docker image to ECR
2. Create ECS task definition
3. Create ECS service with ALB
4. Configure auto-scaling
5. Set up CloudWatch logs

See [AWS deployment guide](./DEPLOYMENT.md#aws-deployment) for details.

### Google Cloud Platform (Cloud Run)

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/servalsheets

# Deploy
gcloud run deploy servalsheets \
  --image gcr.io/PROJECT_ID/servalsheets \
  --platform managed \
  --region us-central1 \
  --set-env-vars NODE_ENV=production \
  --set-secrets GOOGLE_APPLICATION_CREDENTIALS=service-account:latest \
  --min-instances 1 \
  --max-instances 10
```

### Azure (Container Instances)

```bash
az container create \
  --resource-group servalsheets-rg \
  --name servalsheets \
  --image servalsheets:1.1.0 \
  --cpu 2 \
  --memory 4 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables OAUTH_CLIENT_SECRET=your-secret \
  --ports 3000
```

---

## Security Checklist

Before deploying to production, ensure:

- [ ] **TLS/SSL Certificates** configured for HTTPS
- [ ] **Firewall Rules** restrict access to necessary ports only
- [ ] **Service Account** has minimum required Google Sheets permissions
- [ ] **OAuth Secrets** stored in secure secrets manager (not in env files)
- [ ] **Allowed Redirect URIs** configured to production domains only
- [ ] **Session Secrets** are cryptographically random (min 32 characters)
- [ ] **Rate Limiting** configured appropriately for your traffic
- [ ] **CORS** restricted to known origins only
- [ ] **Monitoring** and alerting configured
- [ ] **Log Aggregation** set up (CloudWatch, Datadog, etc.)
- [ ] **Backup Strategy** for OAuth tokens and session data
- [ ] **Incident Response Plan** documented

---

## Post-Deployment Validation

### 1. Health Check
```bash
curl https://your-domain.com/health
# Expected: {"status":"ok","version":"1.1.0"}
```

### 2. OAuth Flow Test
```bash
# Visit authorization URL
open "https://your-domain.com/authorize?redirect_uri=https://your-domain.com/callback"

# Should redirect to Google OAuth consent screen
# After consent, should redirect back with tokens
```

### 3. MCP Connection Test

For stdio mode (Claude Desktop):
1. Quit Claude Desktop completely (⌘+Q)
2. Reopen Claude Desktop
3. Look for 🔨 icon (bottom-right)
4. Test with: "List sheets in my spreadsheet: [spreadsheet-id]"

For HTTP mode:
```bash
# Initialize MCP session
curl -X POST https://your-domain.com/mcp/initialize \
  -H "Content-Type: application/json" \
  -d '{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}'

# List available tools
curl -X POST https://your-domain.com/mcp/tools/list \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"your-session-id"}'
```

### 4. Run Integration Tests

```bash
# On production server (with test credentials)
npm run test:integration
```

---

## Monitoring & Observability

### Key Metrics to Monitor

1. **HTTP Metrics** (if using HTTP mode):
   - Request rate (requests/sec)
   - Response time (p50, p95, p99)
   - Error rate (5xx responses)
   - Active connections

2. **Google API Metrics**:
   - API call rate
   - API error rate
   - Quota usage
   - Retry attempts

3. **Application Metrics**:
   - Memory usage
   - CPU usage
   - Event loop lag
   - Active sessions

4. **Business Metrics**:
   - Sheets read/write operations
   - Safety rail violations
   - Dry-run usage
   - Average operation size

### Logging

Logs are output in JSON format (when `LOG_FORMAT=json`) for easy aggregation:

```json
{
  "level": "info",
  "timestamp": "2026-01-03T17:54:18.123Z",
  "message": "Sheets read operation",
  "spreadsheetId": "abc123",
  "range": "Sheet1!A1:B10",
  "cellsRead": 20,
  "duration": 342
}
```

**Log Locations**:
- Docker: `docker logs servalsheets`
- systemd: `journalctl -u servalsheets -f`
- PM2: `~/.pm2/logs/`
- Claude Desktop: `~/Library/Logs/Claude/mcp-server-servalsheets.log`

### Alerting Rules

Set up alerts for:
- Error rate > 5% for 5 minutes
- Response time p95 > 2s for 5 minutes
- Memory usage > 80% for 10 minutes
- Google API quota at 80%
- Certificate expiring within 30 days

---

## Rollback Procedure

If deployment fails or issues are detected:

### Docker Rollback
```bash
# Stop current version
docker stop servalsheets

# Start previous version
docker run -d \
  --name servalsheets \
  -p 3000:3000 \
  -v /path/to/service-account.json:/app/credentials/service-account.json:ro \
  --env-file .env.production \
  servalsheets:1.0.0 npm run start:http
```

### Kubernetes Rollback
```bash
# Rollback to previous revision
kubectl rollout undo deployment/servalsheets -n servalsheets

# Check status
kubectl rollout status deployment/servalsheets -n servalsheets
```

### systemd Rollback
```bash
# Stop service
sudo systemctl stop servalsheets

# Switch to previous version
cd /opt/servalsheets
git checkout v1.0.0
npm ci --production
npm run build

# Restart service
sudo systemctl start servalsheets
```

---

## Performance Tuning

### Node.js Optimization

Set optimal Node.js flags in production:

```bash
# In systemd service or PM2 config
NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
```

### Clustering

For high-traffic deployments, run multiple instances:

```javascript
// PM2 cluster mode (recommended)
{
  instances: 'max', // Or specific number
  exec_mode: 'cluster'
}
```

### Caching

Consider adding Redis for:
- Session storage (shared across instances)
- Token caching
- Rate limit counters

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed tuning guide.

---

## Disaster Recovery

### Backup Strategy

**What to Backup**:
1. OAuth session data (if using Redis/database)
2. Environment configuration
3. SSL/TLS certificates
4. Application logs (last 30 days)

**Backup Schedule**:
- Sessions: Continuous replication (if using managed Redis)
- Configuration: On every change
- Certificates: Before renewal
- Logs: Daily

### Recovery Procedures

**Complete System Failure**:
1. Deploy to standby infrastructure
2. Restore configuration from backup
3. Restore SSL certificates
4. Update DNS to point to new infrastructure
5. Verify health checks pass
6. Notify users of new OAuth authorization requirements

**Data Loss**:
- OAuth sessions: Users will need to re-authorize
- Configuration: Restore from backup
- Logs: Accept data loss, focus on recovery

---

## Support & Troubleshooting

### Common Issues

**Issue**: "Invalid credentials"
- **Solution**: Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct and file is readable

**Issue**: "OAuth redirect mismatch"
- **Solution**: Ensure redirect URI in Google Cloud Console matches `OAUTH_REDIRECT_URI` exactly

**Issue**: High memory usage
- **Solution**: Check for memory leaks, enable `--max-old-space-size`, restart service

**Issue**: Rate limiting triggered
- **Solution**: Adjust `RATE_LIMIT_MAX_REQUESTS` or implement request queuing

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for comprehensive guide.

---

## Compliance & Governance

### Data Privacy

ServalSheets:
- Does NOT store spreadsheet data
- Only stores OAuth tokens in memory (or Redis if configured)
- Logs may contain spreadsheet IDs (configure retention policy)
- Service account has access to shared sheets only

### Security Updates

**Subscribe to Security Advisories**:
- GitHub Security Advisories for this repo
- Node.js security releases
- npm audit reports

**Update Schedule**:
- Critical security patches: Within 24 hours
- High priority patches: Within 7 days
- Dependency updates: Monthly
- Node.js LTS updates: Quarterly

---

## Additional Resources

- [Full Deployment Guide](./DEPLOYMENT.md) - Detailed deployment options
- [Production Checklist](./PRODUCTION_CHECKLIST.md) - Pre-launch checklist
- [Monitoring Guide](./MONITORING.md) - Observability setup
- [Performance Guide](./PERFORMANCE.md) - Optimization techniques
- [Security Guide](./SECURITY.md) - Security best practices
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

---

## Getting Help

- **Issues**: https://github.com/your-org/servalsheets/issues
- **Discussions**: https://github.com/your-org/servalsheets/discussions
- **Security**: See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities

---

**Last Updated**: 2026-01-03
**Version**: 1.1.0
