---
title: "P0.2: Gateway Pattern Implementation Guide"
category: archived
last_updated: 2026-01-31
description: "Priority: 🔴 CRITICAL (P0)"
---

# P0.2: Gateway Pattern Implementation Guide

**Priority:** 🔴 CRITICAL (P0)
**Estimated Time:** 3-4 weeks
**Impact:** Unlock multi-tenant SaaS deployment (1000+ organizations)

---

## Problem Statement

**Current State:**

- Zero tenant isolation (0 references in codebase)
- No MCP gateway headers (X-MCP-Session-ID, X-MCP-User-ID)
- Single-tenant architecture
- No per-tenant rate limiting or resource quotas
- Cannot deploy as SaaS/multi-tenant service

**Target State:**

- Full multi-tenant gateway with session isolation
- Per-tenant rate limiting and resource quotas
- MCP-compliant gateway headers
- Support 1000+ organizations on single instance
- Zero cross-tenant data leakage

---

## Architecture Design

### Gateway Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT REQUEST                              │
│  Headers:                                                        │
│    Authorization: Bearer <token>                                 │
│    X-MCP-Session-ID: sess_abc123                                │
│    X-MCP-User-ID: user_xyz789                                   │
│    X-MCP-Tenant-ID: org_acme                                    │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              GATEWAY MIDDLEWARE (NEW)                            │
│  1. Extract tenant from JWT or header                           │
│  2. Validate tenant exists and is active                        │
│  3. Check rate limits (per-tenant)                              │
│  4. Check resource quotas                                       │
│  5. Inject tenant context into request                          │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           SESSION ISOLATION LAYER (NEW)                          │
│  • Isolate tenant sessions in separate namespaces               │
│  • Prevent cross-tenant session access                          │
│  • Track per-tenant resource usage                              │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              TOOL HANDLER (EXISTING)                             │
│  • Access tenant context via request.tenant                     │
│  • Log tenant ID in all operations                              │
│  • Return tenant-scoped data only                               │
└─────────────────────────────────────────────────────────────────┘
```

### Tenant Isolation Model

```
Organization "acme"                  Organization "globex"
├── User 1                           ├── User A
│   ├── Session sess_acme_1          │   ├── Session sess_globex_1
│   │   ├── Spreadsheet access       │   │   ├── Spreadsheet access
│   │   └── Rate limit: 100 req/min  │   │   └── Rate limit: 100 req/min
│   └── Session sess_acme_2          │   └── Session sess_globex_2
└── User 2                           └── User B
    └── Session sess_acme_3              └── Session sess_globex_3

❌ BLOCKED: acme users CANNOT access globex sessions or data
❌ BLOCKED: Rate limits are per-tenant, not global
✅ ALLOWED: Each tenant has isolated namespace
```

---

## Implementation Steps

### Step 1: Create Tenant Types (NEW FILE)

**File:** `src/gateway/types.ts` (NEW - 150 lines)

```typescript
/**
 * Gateway and multi-tenancy type definitions
 * @file src/gateway/types.ts
 */

/**
 * Tenant organization metadata
 */
export interface Tenant {
  /** Unique tenant identifier (e.g., "org_acme") */
  id: string;

  /** Human-readable tenant name */
  name: string;

  /** Tenant status */
  status: 'active' | 'suspended' | 'trial' | 'churned';

  /** ISO timestamp of tenant creation */
  createdAt: string;

  /** Tenant tier for quota enforcement */
  tier: 'free' | 'starter' | 'professional' | 'enterprise';

  /** Custom rate limits (overrides tier defaults) */
  rateLimits?: {
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };

  /** Resource quotas */
  quotas?: {
    maxSpreadsheets?: number;
    maxRowsPerSpreadsheet?: number;
    maxApiCallsPerDay?: number;
    maxStorageBytes?: number;
  };

  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Tenant context injected into every request
 */
export interface TenantContext {
  /** Tenant ID */
  tenantId: string;

  /** Tenant object (cached) */
  tenant: Tenant;

  /** User ID making the request */
  userId?: string;

  /** Session ID for this request */
  sessionId: string;

  /** Original request headers */
  headers: Record<string, string>;

  /** Timestamp of request */
  requestTimestamp: string;
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  /** Enable multi-tenancy gateway */
  enabled: boolean;

  /** Tenant resolution strategy */
  tenantResolution: 'jwt' | 'header' | 'subdomain';

  /** Default rate limits per tier */
  defaultRateLimits: Record<Tenant['tier'], {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  }>;

  /** Default quotas per tier */
  defaultQuotas: Record<Tenant['tier'], {
    maxSpreadsheets: number;
    maxRowsPerSpreadsheet: number;
    maxApiCallsPerDay: number;
    maxStorageBytes: number;
  }>;

  /** Enable rate limiting */
  enableRateLimiting: boolean;

  /** Enable quota enforcement */
  enableQuotaEnforcement: boolean;

  /** Redis connection for distributed rate limiting */
  redisUrl?: string;
}

/**
 * Rate limit state
 */
export interface RateLimitState {
  tenantId: string;
  window: 'minute' | 'hour' | 'day';
  count: number;
  limit: number;
  resetAt: string;
  exceeded: boolean;
}

/**
 * Quota usage state
 */
export interface QuotaUsage {
  tenantId: string;
  resource: keyof Tenant['quotas'];
  current: number;
  limit: number;
  percentUsed: number;
  exceeded: boolean;
}
```

---

### Step 2: Create Tenant Resolver (NEW FILE)

**File:** `src/gateway/tenant-resolver.ts` (NEW - 200 lines)

```typescript
/**
 * Tenant resolution from requests
 * @file src/gateway/tenant-resolver.ts
 */

import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { Tenant, TenantContext, GatewayConfig } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Error thrown when tenant cannot be resolved
 */
export class TenantResolutionError extends Error {
  constructor(
    message: string,
    public code: 'MISSING_TENANT' | 'INVALID_TENANT' | 'SUSPENDED_TENANT',
  ) {
    super(message);
    this.name = 'TenantResolutionError';
  }
}

/**
 * Tenant resolver service
 */
export class TenantResolver {
  private tenantCache: Map<string, Tenant> = new Map();

  constructor(private config: GatewayConfig) {}

  /**
   * Resolve tenant from incoming request
   * @param req - Express request object
   * @returns Tenant context or throws error
   */
  async resolveTenant(req: Request): Promise<TenantContext> {
    let tenantId: string | undefined;

    // Strategy 1: Extract from JWT
    if (this.config.tenantResolution === 'jwt') {
      tenantId = this.extractTenantFromJWT(req);
    }

    // Strategy 2: Extract from header
    if (this.config.tenantResolution === 'header') {
      tenantId = req.headers['x-mcp-tenant-id'] as string;
    }

    // Strategy 3: Extract from subdomain
    if (this.config.tenantResolution === 'subdomain') {
      tenantId = this.extractTenantFromSubdomain(req);
    }

    if (!tenantId) {
      throw new TenantResolutionError(
        'Tenant ID not found in request',
        'MISSING_TENANT',
      );
    }

    // Fetch tenant (with caching)
    const tenant = await this.fetchTenant(tenantId);

    // Validate tenant status
    if (tenant.status === 'suspended') {
      throw new TenantResolutionError(
        `Tenant ${tenantId} is suspended`,
        'SUSPENDED_TENANT',
      );
    }

    // Build tenant context
    const context: TenantContext = {
      tenantId: tenant.id,
      tenant,
      userId: req.headers['x-mcp-user-id'] as string,
      sessionId: req.headers['x-mcp-session-id'] as string || this.generateSessionId(),
      headers: req.headers as Record<string, string>,
      requestTimestamp: new Date().toISOString(),
    };

    logger.debug('Tenant resolved', { tenantId, userId: context.userId });

    return context;
  }

  /**
   * Extract tenant ID from JWT
   */
  private extractTenantFromJWT(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.tenant_id || decoded?.organization_id;
    } catch (error) {
      logger.warn('Failed to decode JWT', { error });
      return undefined;
    }
  }

  /**
   * Extract tenant ID from subdomain
   * Example: acme.servalsheets.com → "org_acme"
   */
  private extractTenantFromSubdomain(req: Request): string | undefined {
    const host = req.headers.host;
    if (!host) return undefined;

    const subdomain = host.split('.')[0];
    if (subdomain === 'www' || subdomain === 'api') {
      return undefined;
    }

    return `org_${subdomain}`;
  }

  /**
   * Fetch tenant from database/cache
   */
  private async fetchTenant(tenantId: string): Promise<Tenant> {
    // Check cache first
    if (this.tenantCache.has(tenantId)) {
      return this.tenantCache.get(tenantId)!;
    }

    // TODO: Fetch from database
    // For now, return mock tenant
    const tenant: Tenant = {
      id: tenantId,
      name: tenantId.replace('org_', ''),
      status: 'active',
      tier: 'professional',
      createdAt: new Date().toISOString(),
    };

    // Cache for 5 minutes
    this.tenantCache.set(tenantId, tenant);
    setTimeout(() => this.tenantCache.delete(tenantId), 5 * 60 * 1000);

    return tenant;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
```

---

### Step 3: Create Rate Limiter (NEW FILE)

**File:** `src/gateway/rate-limiter.ts` (NEW - 250 lines)

```typescript
/**
 * Per-tenant rate limiting
 * @file src/gateway/rate-limiter.ts
 */

import Redis from 'ioredis';
import type { TenantContext, RateLimitState, GatewayConfig } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Rate limit exceeded error
 */
export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    public state: RateLimitState,
  ) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Per-tenant rate limiter
 */
export class TenantRateLimiter {
  private redis?: Redis;
  private localCounts: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(private config: GatewayConfig) {
    if (config.redisUrl) {
      this.redis = new Redis(config.redisUrl);
    }
  }

  /**
   * Check if request is within rate limits
   * @param context - Tenant context
   * @throws RateLimitExceededError if limit exceeded
   */
  async checkRateLimit(context: TenantContext): Promise<void> {
    if (!this.config.enableRateLimiting) {
      return;
    }

    const { tenant, tenantId } = context;

    // Get rate limits (custom or tier default)
    const limits = tenant.rateLimits || this.config.defaultRateLimits[tenant.tier];

    // Check minute limit
    await this.checkWindowLimit(tenantId, 'minute', limits.requestsPerMinute);

    // Check hour limit
    await this.checkWindowLimit(tenantId, 'hour', limits.requestsPerHour);

    // Check day limit
    await this.checkWindowLimit(tenantId, 'day', limits.requestsPerDay);
  }

  /**
   * Check rate limit for specific time window
   */
  private async checkWindowLimit(
    tenantId: string,
    window: 'minute' | 'hour' | 'day',
    limit: number,
  ): Promise<void> {
    const key = `ratelimit:${tenantId}:${window}`;

    // Use Redis if available, otherwise local memory
    const count = this.redis
      ? await this.checkRedisLimit(key, window, limit)
      : await this.checkLocalLimit(key, window, limit);

    if (count > limit) {
      const resetAt = this.getResetTime(window);
      const state: RateLimitState = {
        tenantId,
        window,
        count,
        limit,
        resetAt: resetAt.toISOString(),
        exceeded: true,
      };

      throw new RateLimitExceededError(
        `Rate limit exceeded for ${tenantId}: ${count}/${limit} requests per ${window}`,
        state,
      );
    }

    logger.debug('Rate limit check passed', { tenantId, window, count, limit });
  }

  /**
   * Check limit using Redis
   */
  private async checkRedisLimit(
    key: string,
    window: 'minute' | 'hour' | 'day',
    limit: number,
  ): Promise<number> {
    const ttl = this.getWindowSeconds(window);

    // Increment counter
    const count = await this.redis!.incr(key);

    // Set expiry on first increment
    if (count === 1) {
      await this.redis!.expire(key, ttl);
    }

    return count;
  }

  /**
   * Check limit using local memory (fallback)
   */
  private async checkLocalLimit(
    key: string,
    window: 'minute' | 'hour' | 'day',
    limit: number,
  ): Promise<number> {
    const now = Date.now();
    const entry = this.localCounts.get(key);

    if (!entry || now > entry.resetAt) {
      // New window
      const resetAt = now + this.getWindowSeconds(window) * 1000;
      this.localCounts.set(key, { count: 1, resetAt });
      return 1;
    }

    // Increment existing window
    entry.count++;
    return entry.count;
  }

  /**
   * Get window duration in seconds
   */
  private getWindowSeconds(window: 'minute' | 'hour' | 'day'): number {
    switch (window) {
      case 'minute':
        return 60;
      case 'hour':
        return 3600;
      case 'day':
        return 86400;
    }
  }

  /**
   * Get reset time for window
   */
  private getResetTime(window: 'minute' | 'hour' | 'day'): Date {
    const now = new Date();
    switch (window) {
      case 'minute':
        return new Date(now.getTime() + 60 * 1000);
      case 'hour':
        return new Date(now.getTime() + 3600 * 1000);
      case 'day':
        return new Date(now.getTime() + 86400 * 1000);
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(tenantId: string): Promise<RateLimitState[]> {
    const statuses: RateLimitState[] = [];

    for (const window of ['minute', 'hour', 'day'] as const) {
      const key = `ratelimit:${tenantId}:${window}`;
      const count = this.redis ? await this.redis.get(key) : 0;

      statuses.push({
        tenantId,
        window,
        count: parseInt(count as string) || 0,
        limit: 100, // TODO: Get actual limit
        resetAt: this.getResetTime(window).toISOString(),
        exceeded: false,
      });
    }

    return statuses;
  }
}
```

---

### Step 4: Create Gateway Middleware (NEW FILE)

**File:** `src/middleware/gateway.ts` (NEW - 150 lines)

```typescript
/**
 * Gateway middleware for multi-tenancy
 * @file src/middleware/gateway.ts
 */

import type { Request, Response, NextFunction } from 'express';
import { TenantResolver, TenantResolutionError } from '../gateway/tenant-resolver.js';
import { TenantRateLimiter, RateLimitExceededError } from '../gateway/rate-limiter.js';
import type { GatewayConfig, TenantContext } from '../gateway/types.js';
import { logger } from '../utils/logger.js';

/**
 * Extend Express Request to include tenant context
 */
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * Create gateway middleware
 */
export function createGatewayMiddleware(config: GatewayConfig) {
  const resolver = new TenantResolver(config);
  const rateLimiter = new TenantRateLimiter(config);

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if gateway disabled
    if (!config.enabled) {
      return next();
    }

    try {
      // 1. Resolve tenant
      const context = await resolver.resolveTenant(req);

      // 2. Check rate limits
      await rateLimiter.checkRateLimit(context);

      // 3. Inject context into request
      req.tenant = context;

      // 4. Add tenant headers to response
      res.setHeader('X-MCP-Tenant-ID', context.tenantId);
      res.setHeader('X-MCP-Session-ID', context.sessionId);

      // 5. Continue to handler
      next();
    } catch (error) {
      // Handle tenant resolution errors
      if (error instanceof TenantResolutionError) {
        logger.warn('Tenant resolution failed', { error: error.message, code: error.code });

        return res.status(401).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }

      // Handle rate limit errors
      if (error instanceof RateLimitExceededError) {
        logger.warn('Rate limit exceeded', { state: error.state });

        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: error.message,
            state: error.state,
          },
        });
      }

      // Handle unexpected errors
      logger.error('Gateway middleware error', { error });
      return res.status(500).json({
        error: {
          code: 'GATEWAY_ERROR',
          message: 'Internal gateway error',
        },
      });
    }
  };
}
```

---

### Step 5: Integrate Gateway into HTTP Server (EXISTING FILE)

**File:** `src/http-server.ts` - **Lines 100-150** (MODIFY)

**Add gateway middleware to HTTP server:**

```typescript
// src/http-server.ts:100-150 (AFTER)
import { createGatewayMiddleware } from './middleware/gateway.js';
import type { GatewayConfig } from './gateway/types.js';

export interface HttpServerOptions {
  port: number;
  enableOAuth?: boolean;
  oauthConfig?: OAuthConfig;
  // ✅ NEW: Gateway configuration
  gatewayConfig?: GatewayConfig;
}

export function createHttpServer(options: HttpServerOptions) {
  const app = express();

  // ... existing middleware ...

  // ✅ NEW: Add gateway middleware (before MCP handlers)
  if (options.gatewayConfig?.enabled) {
    app.use(createGatewayMiddleware(options.gatewayConfig));
  }

  // ... rest of server setup ...
}
```

---

### Step 6: Update Handlers to Use Tenant Context (EXAMPLE)

**File:** `src/handlers/base.ts` - **Lines 50-80** (MODIFY)

Modify base handler to access tenant context:

```typescript
// src/handlers/base.ts:50-80
export abstract class BaseHandler<TInput = any> implements Handler {
  constructor(
    protected api: sheets_v4.Sheets,
    protected toolName: string,
  ) {}

  async handle(input: TInput, request?: any): Promise<ToolResponse> {
    // ✅ NEW: Extract tenant context if available
    const tenantId = request?.tenant?.tenantId;

    if (tenantId) {
      logger.info(`Handling request for tenant ${tenantId}`, {
        tool: this.toolName,
        action: (input as any).action,
      });
    }

    // ... existing handler logic ...
  }
}
```

---

## Default Gateway Configuration

**File:** `src/config/gateway.ts` (NEW - 100 lines)

```typescript
/**
 * Default gateway configuration
 * @file src/config/gateway.ts
 */

import type { GatewayConfig } from '../gateway/types.js';

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  enabled: process.env.ENABLE_GATEWAY === 'true',
  tenantResolution: (process.env.TENANT_RESOLUTION_STRATEGY as any) || 'jwt',

  defaultRateLimits: {
    free: {
      requestsPerMinute: 10,
      requestsPerHour: 100,
      requestsPerDay: 500,
    },
    starter: {
      requestsPerMinute: 50,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    },
    professional: {
      requestsPerMinute: 100,
      requestsPerHour: 5000,
      requestsPerDay: 50000,
    },
    enterprise: {
      requestsPerMinute: 500,
      requestsPerHour: 50000,
      requestsPerDay: 1000000,
    },
  },

  defaultQuotas: {
    free: {
      maxSpreadsheets: 10,
      maxRowsPerSpreadsheet: 10000,
      maxApiCallsPerDay: 500,
      maxStorageBytes: 100 * 1024 * 1024, // 100 MB
    },
    starter: {
      maxSpreadsheets: 100,
      maxRowsPerSpreadsheet: 100000,
      maxApiCallsPerDay: 10000,
      maxStorageBytes: 1 * 1024 * 1024 * 1024, // 1 GB
    },
    professional: {
      maxSpreadsheets: 1000,
      maxRowsPerSpreadsheet: 1000000,
      maxApiCallsPerDay: 50000,
      maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    },
    enterprise: {
      maxSpreadsheets: -1, // unlimited
      maxRowsPerSpreadsheet: -1, // unlimited
      maxApiCallsPerDay: 1000000,
      maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    },
  },

  enableRateLimiting: true,
  enableQuotaEnforcement: true,
  redisUrl: process.env.REDIS_URL,
};
```

---

## Testing Strategy

### Unit Tests

**File:** `tests/gateway/tenant-resolver.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import { TenantResolver } from '../../src/gateway/tenant-resolver.js';

describe('TenantResolver', () => {
  it('should resolve tenant from JWT', async () => {
    // Test JWT extraction
  });

  it('should resolve tenant from header', async () => {
    // Test header extraction
  });

  it('should throw error for missing tenant', async () => {
    // Test error handling
  });
});
```

**File:** `tests/gateway/rate-limiter.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import { TenantRateLimiter } from '../../src/gateway/rate-limiter.js';

describe('TenantRateLimiter', () => {
  it('should allow requests within limit', async () => {
    // Test successful rate limiting
  });

  it('should block requests exceeding limit', async () => {
    // Test rate limit exceeded
  });

  it('should reset after time window', async () => {
    // Test window reset
  });
});
```

### Integration Tests

**File:** `tests/integration/gateway-integration.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createHttpServer } from '../../src/http-server.js';

describe('Gateway Integration', () => {
  it('should accept request with valid tenant', async () => {
    const app = createHttpServer({ /* config */ });

    await request(app)
      .post('/mcp/tools/call')
      .set('X-MCP-Tenant-ID', 'org_test')
      .set('Authorization', 'Bearer <token>')
      .send({ /* payload */ })
      .expect(200);
  });

  it('should reject request without tenant', async () => {
    const app = createHttpServer({ /* config */ });

    await request(app)
      .post('/mcp/tools/call')
      .send({ /* payload */ })
      .expect(401);
  });

  it('should enforce rate limits', async () => {
    // Test rate limiting
  });
});
```

---

## Rollout Plan

### Phase 1: Foundation (Week 1)

- ✅ Create gateway types
- ✅ Create tenant resolver
- ✅ Create rate limiter
- ✅ Create gateway middleware

### Phase 2: Integration (Week 2)

- ✅ Integrate middleware into HTTP server
- ✅ Update handlers to use tenant context
- ✅ Add configuration files

### Phase 3: Testing (Week 3)

- ✅ Write unit tests
- ✅ Write integration tests
- ✅ Performance testing

### Phase 4: Rollout (Week 4)

- ✅ Beta testing with select tenants
- ✅ Monitor metrics and errors
- ✅ Gradual rollout to all tenants
- ✅ Document for users

---

## Success Metrics

### Before Implementation

- ❌ Zero tenant isolation
- ❌ No rate limiting
- ❌ Single-tenant only
- ❌ Cannot deploy as SaaS

### After Implementation

- ✅ Full tenant isolation
- ✅ Per-tenant rate limiting
- ✅ Support 1000+ organizations
- ✅ Multi-tenant SaaS ready
- ✅ Zero cross-tenant data leakage
- ✅ 99.9% uptime

---

## Security Considerations

1. **Tenant Isolation:** Verify tenants cannot access each other's data
2. **Rate Limiting:** Prevent one tenant from DOS-ing the service
3. **Quota Enforcement:** Prevent resource exhaustion
4. **JWT Validation:** Ensure tokens are properly validated
5. **Audit Logging:** Log all tenant operations for compliance

---

## Next Steps

1. ✅ Review implementation guide
2. ⏳ Create feature branch: `feature/gateway-pattern`
3. ⏳ Implement Step 1-6 (estimated 3-4 weeks)
4. ⏳ Run full test suite
5. ⏳ Beta test with 10 tenants
6. ⏳ Gradual rollout over 4 weeks
7. ⏳ Monitor metrics and errors
