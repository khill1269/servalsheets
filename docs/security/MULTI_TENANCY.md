# ServalSheets Multi-Tenancy Guide

**Status:** Production Ready
**Version:** 1.7.0
**Last Updated:** 2026-02-17

## Overview

ServalSheets supports multi-tenant deployments, enabling SaaS providers to serve multiple customers on shared infrastructure while maintaining complete data isolation.

## Architecture

### Core Components

1. **Tenant Context Service** (`src/services/tenant-context.ts`)
   - Tenant metadata storage and retrieval
   - API key generation and validation
   - Quota tracking and enforcement
   - Row-level security validation

2. **Tenant Isolation Middleware** (`src/middleware/tenant-isolation.ts`)
   - API key extraction from Authorization header
   - Tenant context injection into requests
   - Spreadsheet access validation
   - Automatic quota enforcement

3. **Data Isolation Layer**
   - Tenant ID injection into all database queries
   - Spreadsheet-level access control
   - Zero cross-tenant data leakage (verified by tests)

## Quick Start

### 1. Enable Multi-Tenancy Mode

Set environment variable:

```bash
export SERVALSHEETS_MULTI_TENANT=true
```

### 2. Create Tenant

```typescript
import { tenantContextService } from './services/tenant-context.js';

const { metadata, apiKey } = await tenantContextService.createTenant('Acme Corp', {
  maxSpreadsheets: 100,
  maxApiCallsPerHour: 10000,
  maxConcurrentRequests: 50,
  enabledFeatures: ['advanced', 'bigquery', 'appsscript'],
});

console.log('Tenant ID:', metadata.tenantId);
console.log('API Key:', apiKey);
```

### 3. Use Tenant API Key

Clients authenticate with API key in Authorization header:

```bash
curl -H "Authorization: Bearer sk_..." \
  http://localhost:3000/api/tools/sheets_data \
  -d '{"action": "read", "spreadsheetId": "...", "range": "A1:B10"}'
```

### 4. Apply Middleware (HTTP Server Only)

```typescript
import express from 'express';
import { tenantIsolationMiddleware } from './middleware/tenant-isolation.js';

const app = express();

// Apply tenant isolation to all routes
app.use('/api', tenantIsolationMiddleware());

// Routes automatically have req.tenantContext available
app.post('/api/tools/:tool', async (req, res) => {
  const { tenantContext } = req;
  console.log('Request from tenant:', tenantContext.tenantId);
  // ...
});
```

## Security Model

### Data Isolation Guarantees

ServalSheets provides **100% data isolation** between tenants:

1. **API Key Isolation**
   - Each tenant has unique UUID-based tenant ID
   - API keys are cryptographically random (256 bits)
   - API key → tenant ID mapping is strictly enforced
   - Impossible to guess or enumerate API keys

2. **Spreadsheet Access Control**
   - All spreadsheet operations validate tenant ownership
   - Cross-tenant spreadsheet access is blocked
   - Validation happens before Google API calls

3. **Metadata Isolation**
   - Tenant metadata is stored separately per tenant
   - No shared state between tenants
   - Updates to one tenant don't affect others

4. **Quota Isolation**
   - Per-tenant rate limits enforced independently
   - One tenant cannot consume another's quota
   - Concurrent request limits prevent resource exhaustion

### Security Tests

The multi-tenancy implementation is verified by 20+ security tests:

```bash
npm run test:security -- tenant-isolation
```

Key test coverage:
- ✅ Zero data leakage between tenants
- ✅ API key validation and revocation
- ✅ Spreadsheet access control
- ✅ Quota isolation
- ✅ Tenant deletion and cleanup
- ✅ API key rotation security

## Tenant Management

### Create Tenant

```typescript
const { metadata, apiKey } = await tenantContextService.createTenant('Tenant Name', {
  maxSpreadsheets: 100,
  maxApiCallsPerHour: 10000,
  maxConcurrentRequests: 50,
  enabledFeatures: ['advanced', 'bigquery'],
  customDomain: 'tenant.example.com',
});
```

### Update Tenant

```typescript
const updated = await tenantContextService.updateTenant(tenantId, {
  name: 'New Name',
  settings: {
    maxApiCallsPerHour: 20000,
  },
});
```

### Suspend Tenant

```typescript
await tenantContextService.updateTenant(tenantId, {
  status: 'suspended',
});
```

### Delete Tenant (Soft Delete)

```typescript
await tenantContextService.deleteTenant(tenantId);
// Tenant marked as deleted, API keys revoked
```

### Rotate API Key

```typescript
const newApiKey = await tenantContextService.rotateApiKey(tenantId);
// Old API key is immediately revoked
```

### List Tenants

```typescript
const tenants = await tenantContextService.listTenants({
  offset: 0,
  limit: 50,
});
```

## Custom Storage Backend

The default in-memory storage is suitable for development. For production, implement custom storage:

```typescript
import { TenantStorage, TenantMetadata } from './services/tenant-context.js';

class PostgresTenantStorage implements TenantStorage {
  async get(tenantId: string): Promise<TenantMetadata | null> {
    const result = await db.query(
      'SELECT * FROM tenants WHERE tenant_id = $1',
      [tenantId]
    );
    return result.rows[0] || null;
  }

  async create(metadata: Omit<TenantMetadata, 'createdAt' | 'updatedAt'>): Promise<TenantMetadata> {
    const result = await db.query(
      'INSERT INTO tenants (tenant_id, name, status, settings) VALUES ($1, $2, $3, $4) RETURNING *',
      [metadata.tenantId, metadata.name, metadata.status, JSON.stringify(metadata.settings)]
    );
    return result.rows[0];
  }

  async update(tenantId: string, updates: Partial<TenantMetadata>): Promise<TenantMetadata> {
    // Implement update logic
  }

  async delete(tenantId: string): Promise<void> {
    // Implement soft delete
  }

  async list(options?: { offset?: number; limit?: number }): Promise<TenantMetadata[]> {
    // Implement pagination
  }
}

// Use custom storage
const storage = new PostgresTenantStorage();
const service = new TenantContextService(storage);
```

## Quota Management

### Configure Per-Tenant Quotas

```typescript
await tenantContextService.createTenant('Tenant Name', {
  maxApiCallsPerHour: 10000,     // Hourly API call limit
  maxConcurrentRequests: 50,     // Concurrent request limit
  maxSpreadsheets: 100,          // Max spreadsheets per tenant
});
```

### Enforce Quotas

Quotas are automatically enforced by the middleware:

1. **API Call Quota** - Tracked per hour, resets hourly
2. **Concurrent Requests** - Limited by in-flight request count
3. **Spreadsheet Limit** - Validated on create operations

### Monitor Quota Usage

```typescript
const context = await tenantContextService.extractTenantContext(apiKey);
console.log('Hourly quota remaining:', context.quotaRemaining.hourly);
console.log('Concurrent requests available:', context.quotaRemaining.concurrent);
```

## Billing Integration

Tenant metadata includes optional billing information:

```typescript
const { metadata, apiKey } = await tenantContextService.createTenant('Tenant Name', {
  // ... settings
});

await tenantContextService.updateTenant(metadata.tenantId, {
  billingInfo: {
    plan: 'professional',
    billingEmail: 'billing@customer.com',
    subscriptionEndsAt: new Date('2027-01-01'),
  },
});
```

## Migration from Single-Tenant

Existing single-tenant deployments can migrate to multi-tenant:

### Step 1: Create Default Tenant

```typescript
const { metadata, apiKey } = await tenantContextService.createTenant('Default Tenant');
```

### Step 2: Update Client Configuration

Replace existing authentication with tenant API key:

```bash
# Old (single-tenant)
export GOOGLE_OAUTH_TOKEN="..."

# New (multi-tenant)
export SERVALSHEETS_API_KEY="sk_..."
```

### Step 3: Enable Multi-Tenant Mode

```bash
export SERVALSHEETS_MULTI_TENANT=true
```

### Step 4: Restart Server

```bash
npm run start:http
```

## Performance Considerations

### API Key Lookup

- **In-memory storage:** O(1) lookup via Map
- **Database storage:** Add index on `tenant_id` and `api_key` columns
- **Redis storage:** Use HASH for tenant metadata, SET for API key → tenant ID mapping

### Quota Tracking

- Use Redis for distributed quota tracking
- Implement sliding window rate limiting
- Consider using token bucket algorithm

### Spreadsheet Access Validation

- Cache spreadsheet → tenant mappings
- Use TTL to balance freshness and performance
- Implement eventual consistency for non-critical checks

## Monitoring and Observability

### Metrics to Track

1. **Tenant Count** - Active tenants over time
2. **API Calls per Tenant** - Distribution and outliers
3. **Quota Exhaustion Events** - Rate limit hits
4. **Cross-Tenant Access Attempts** - Security violations
5. **Tenant Onboarding Time** - Time to first API call

### Prometheus Metrics

```typescript
import { register, Counter, Gauge } from 'prom-client';

const tenantCount = new Gauge({
  name: 'servalsheets_tenants_total',
  help: 'Total number of active tenants',
});

const tenantApiCalls = new Counter({
  name: 'servalsheets_tenant_api_calls_total',
  help: 'Total API calls per tenant',
  labelNames: ['tenant_id', 'tool'],
});

const quotaExhaustion = new Counter({
  name: 'servalsheets_quota_exhaustion_total',
  help: 'Quota exhaustion events',
  labelNames: ['tenant_id', 'quota_type'],
});
```

## Troubleshooting

### Issue: Invalid API Key

**Symptom:** 401 Unauthorized response

**Causes:**
1. API key not included in Authorization header
2. API key revoked or tenant deleted
3. Tenant suspended

**Solution:**
```bash
# Verify API key format
echo $SERVALSHEETS_API_KEY | grep -E '^sk_[A-Za-z0-9_-]{43}$'

# Check tenant status
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
  http://localhost:3000/api/tenants/$TENANT_ID
```

### Issue: Spreadsheet Access Denied

**Symptom:** 403 Forbidden response

**Causes:**
1. Spreadsheet belongs to different tenant
2. Spreadsheet access not granted to tenant

**Solution:**
```typescript
// Verify spreadsheet ownership
const hasAccess = await tenantContextService.validateSpreadsheetAccess(
  tenantId,
  spreadsheetId
);
```

### Issue: Quota Exceeded

**Symptom:** 429 Too Many Requests

**Causes:**
1. Hourly API call limit reached
2. Concurrent request limit reached

**Solution:**
```typescript
// Check quota status
const context = await tenantContextService.extractTenantContext(apiKey);
console.log('Quota remaining:', context.quotaRemaining);

// Increase quota
await tenantContextService.updateTenant(tenantId, {
  settings: {
    maxApiCallsPerHour: 20000,
  },
});
```

## Best Practices

### Security

1. **Rotate API Keys Regularly** - Automate key rotation every 90 days
2. **Use HTTPS Only** - Never transmit API keys over HTTP
3. **Implement IP Allowlists** - Restrict API access by IP range
4. **Audit Logs** - Log all tenant actions for compliance
5. **Rate Limiting** - Prevent abuse with aggressive rate limits

### Performance

1. **Database Indexing** - Index tenant_id, api_key, and status columns
2. **Connection Pooling** - Use connection pools for database access
3. **Caching** - Cache tenant metadata and quota status
4. **Async Processing** - Use background jobs for quota resets
5. **Monitoring** - Track tenant performance metrics

### Operations

1. **Backup Tenant Data** - Regular backups of tenant metadata
2. **Disaster Recovery** - Test tenant restoration procedures
3. **Capacity Planning** - Monitor tenant growth and resource usage
4. **Automated Onboarding** - Self-service tenant creation
5. **Support Tooling** - Admin dashboard for tenant management

## API Reference

### TenantContextService

#### `createTenant(name, settings?)`

Creates new tenant with unique ID and API key.

**Parameters:**
- `name` (string) - Tenant name
- `settings` (object, optional) - Tenant settings

**Returns:**
- `metadata` (TenantMetadata) - Tenant metadata
- `apiKey` (string) - API key for authentication

#### `extractTenantContext(apiKey)`

Extracts tenant context from API key.

**Parameters:**
- `apiKey` (string) - API key from Authorization header

**Returns:**
- `TenantContext | null` - Tenant context or null if invalid

#### `updateTenant(tenantId, updates)`

Updates tenant metadata.

**Parameters:**
- `tenantId` (string) - Tenant UUID
- `updates` (object) - Partial tenant metadata updates

**Returns:**
- `TenantMetadata` - Updated tenant metadata

#### `deleteTenant(tenantId)`

Soft deletes tenant (marks as deleted, revokes API keys).

**Parameters:**
- `tenantId` (string) - Tenant UUID

**Returns:**
- `void`

#### `rotateApiKey(tenantId)`

Rotates API key for tenant (revokes old key).

**Parameters:**
- `tenantId` (string) - Tenant UUID

**Returns:**
- `string` - New API key

#### `validateSpreadsheetAccess(tenantId, spreadsheetId)`

Validates tenant has access to spreadsheet.

**Parameters:**
- `tenantId` (string) - Tenant UUID
- `spreadsheetId` (string) - Google Sheets spreadsheet ID

**Returns:**
- `boolean` - True if tenant has access

### Middleware

#### `tenantIsolationMiddleware()`

Express middleware for tenant authentication and isolation.

**Usage:**
```typescript
app.use('/api', tenantIsolationMiddleware());
```

**Behavior:**
- Extracts API key from Authorization header
- Validates API key and tenant status
- Attaches tenant context to request
- Returns 401 if authentication fails

#### `validateSpreadsheetAccess()`

Express middleware for spreadsheet access validation.

**Usage:**
```typescript
app.use('/api/tools', validateSpreadsheetAccess());
```

**Behavior:**
- Extracts spreadsheet ID from request
- Validates tenant has access to spreadsheet
- Returns 403 if access denied

## Examples

### Complete HTTP Server Setup

```typescript
import express from 'express';
import {
  tenantIsolationMiddleware,
  validateSpreadsheetAccess,
} from './middleware/tenant-isolation.js';

const app = express();
app.use(express.json());

// Public routes (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Authenticated routes (tenant isolation)
app.use('/api', tenantIsolationMiddleware());
app.use('/api/tools', validateSpreadsheetAccess());

app.post('/api/tools/:tool', async (req, res) => {
  const { tenantContext } = req;
  const { tool } = req.params;

  // Process request with tenant context
  const result = await processToolRequest(tool, req.body, tenantContext);
  res.json(result);
});

app.listen(3000);
```

### Multi-Tenant Client

```typescript
class ServalSheetsClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async readRange(spreadsheetId: string, range: string) {
    const response = await fetch(`${this.baseUrl}/api/tools/sheets_data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'read',
        spreadsheetId,
        range,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }
}

// Usage
const client = new ServalSheetsClient('sk_...');
const data = await client.readRange('spreadsheet-id', 'A1:B10');
```

## Roadmap

### Planned Features

- [ ] Tenant-specific feature flags
- [ ] Usage-based billing integration
- [ ] Multi-region tenant distribution
- [ ] Tenant data export (GDPR compliance)
- [ ] Automated quota adjustments based on usage
- [ ] Tenant analytics dashboard
- [ ] Webhook notifications for quota events

### Future Enhancements

- [ ] Hierarchical tenants (organizations → teams → users)
- [ ] Cross-tenant collaboration (with explicit consent)
- [ ] Tenant-specific branding and customization
- [ ] Advanced quota policies (burst limits, time-of-day)
- [ ] Tenant health scoring and alerts

## Support

For questions or issues with multi-tenancy:

1. Check [GitHub Issues](https://github.com/yourusername/servalsheets/issues)
2. Review [Security Tests](../../tests/security/tenant-isolation.test.ts)
3. Consult [Architecture Documentation](../development/ARCHITECTURE.md)

## License

ServalSheets is licensed under [MIT License](../../LICENSE).
