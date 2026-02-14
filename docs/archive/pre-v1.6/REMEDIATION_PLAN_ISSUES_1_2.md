# ServalSheets MCP Server - Remediation Plan

## Issues Identified During Testing (2026-02-04)

---

## Issue #1: Action Count Discrepancy

### Problem Summary
Multiple sources of truth for action counts are out of sync:
- Tool descriptions claim 293 actions
- action-metadata.ts header claims 293 actions but only defines 212
- 5 tools completely missing from metadata
- Handler implementations have 348 case statements (includes internal logic)

### Impact
- **Severity:** Medium
- **User Impact:** Confusing documentation, AI models may not know all available actions
- **Developer Impact:** Metadata used for cost-aware decisions is incomplete

### Root Cause Analysis

| Tool | MCP Description | Metadata Defined | Handler Cases | Actual Actions |
|------|-----------------|------------------|---------------|----------------|
| sheets_auth | 4 | 4 | 4 | 4 |
| sheets_core | 17 | 15 | 30 | ~22 |
| sheets_data | 18 | 20 | 21 | ~21 |
| sheets_format | 21 | 18 | 39 | ~21 |
| sheets_dimensions | 28 | 39 | 28 | ~28 |
| sheets_visualize | 18 | 16 | 22 | ~18 |
| sheets_collaborate | 28 | 28 | 35 | ~28 |
| sheets_advanced | 23 | 19 | 26 | ~23 |
| sheets_transaction | 6 | 6 | 6 | 6 |
| sheets_quality | 4 | 4 | 4 | 4 |
| sheets_history | 7 | 7 | 7 | 7 |
| sheets_confirm | 5 | 2 | 5 | 5 |
| sheets_analyze | 16 | 16 | 26 | ~16 |
| sheets_fix | 1 | 1 | 10 | 1 |
| sheets_composite | 10 | 4 | 10 | 10 |
| sheets_session | 17 | 13 | 26 | ~17 |
| sheets_templates | 8 | **MISSING** | 8 | 8 |
| sheets_bigquery | 14 | **MISSING** | 14 | 14 |
| sheets_appsscript | 14 | **MISSING** | 14 | 14 |
| sheets_webhook | 6 | **MISSING** | 6 | 6 |
| sheets_dependencies | 7 | **MISSING** | 7 | 7 |

**Missing from metadata:** 49 actions across 5 tools

### Fix Plan

#### Step 1: Audit All Handler Actions
**File:** Create `/scripts/audit-actions.ts`

```typescript
/**
 * Audit script to extract all actual actions from handlers
 * Run: npx tsx scripts/audit-actions.ts
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const HANDLERS_DIR = './src/handlers';

interface ActionInfo {
  tool: string;
  action: string;
  line: number;
}

function extractActions(filename: string, content: string): ActionInfo[] {
  const actions: ActionInfo[] = [];
  const toolName = `sheets_${filename.replace('.ts', '')}`;
  
  // Match case 'action_name': patterns
  const caseRegex = /case\s+['"]([a-z_]+)['"]\s*:/g;
  let match;
  let lineNum = 0;
  
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/case\s+['"][a-z_]+['"]\s*:/)) {
      const actionMatch = line.match(/case\s+['"]([a-z_]+)['"]/);
      if (actionMatch) {
        actions.push({
          tool: toolName,
          action: actionMatch[1],
          line: i + 1
        });
      }
    }
  }
  
  return actions;
}

// Main execution
const files = readdirSync(HANDLERS_DIR).filter(f => 
  f.endsWith('.ts') && 
  !['index.ts', 'base.ts', 'logging.ts', 'optimization.ts'].includes(f)
);

const allActions: Record<string, string[]> = {};

for (const file of files) {
  const content = readFileSync(join(HANDLERS_DIR, file), 'utf-8');
  const actions = extractActions(file, content);
  const toolName = `sheets_${file.replace('.ts', '')}`;
  allActions[toolName] = actions.map(a => a.action);
}

// Output results
console.log('='.repeat(60));
console.log('ACTION AUDIT RESULTS');
console.log('='.repeat(60));

let total = 0;
for (const [tool, actions] of Object.entries(allActions).sort()) {
  console.log(`\n${tool}: ${actions.length} actions`);
  actions.forEach(a => console.log(`  - ${a}`));
  total += actions.length;
}

console.log('\n' + '='.repeat(60));
console.log(`TOTAL: ${total} actions across ${Object.keys(allActions).length} tools`);
```

#### Step 2: Update action-metadata.ts
**File:** `/src/schemas/action-metadata.ts`

**Changes Required:**

1. Update header comment:
```typescript
/**
 * Action-Level Metadata for AI Cost-Aware Decision Making
 *
 * Provides detailed metadata for all 293 actions across 21 tools.
 * ...
 */
```

2. Add missing tool sections (after existing tools):

```typescript
  // ============================================
  // TIER 7: ENTERPRISE HANDLERS
  // ============================================
  
  sheets_templates: {
    list: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '200-500ms',
    },
    create: {
      readOnly: false,
      apiCalls: 2,
      quotaCost: 2,
      requiresConfirmation: false,
      destructive: false,
      idempotent: false,
      typicalLatency: '500-1500ms',
    },
    apply: {
      readOnly: false,
      apiCalls: 'dynamic',
      quotaCost: '2-10 depending on template complexity',
      requiresConfirmation: true,
      destructive: true,
      idempotent: false,
      typicalLatency: '1000-5000ms',
    },
    get: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '200-500ms',
    },
    update: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '300-800ms',
    },
    delete: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: true,
      destructive: true,
      idempotent: true,
      typicalLatency: '300-800ms',
    },
    import_builtin: {
      readOnly: false,
      apiCalls: 2,
      quotaCost: 2,
      requiresConfirmation: false,
      destructive: false,
      idempotent: false,
      typicalLatency: '500-1500ms',
    },
    list_builtin: {
      readOnly: true,
      apiCalls: 0,
      quotaCost: 0,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '50-100ms',
    },
  },

  sheets_bigquery: {
    query: {
      readOnly: true,
      apiCalls: 2,
      quotaCost: 'BigQuery pricing applies',
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '2000-30000ms',
    },
    connect_looker: {
      readOnly: false,
      apiCalls: 2,
      quotaCost: 2,
      requiresConfirmation: false,
      destructive: false,
      idempotent: false,
      typicalLatency: '1000-3000ms',
    },
    list_connections: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '200-500ms',
    },
    refresh: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 'BigQuery pricing applies',
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '2000-60000ms',
    },
    cancel_refresh: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '200-500ms',
    },
    get_status: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '200-500ms',
    },
    import_from_bigquery: {
      readOnly: false,
      apiCalls: 3,
      quotaCost: 'BigQuery pricing applies',
      requiresConfirmation: true,
      destructive: false,
      idempotent: false,
      typicalLatency: '5000-120000ms',
    },
    export_to_bigquery: {
      readOnly: true,
      apiCalls: 2,
      quotaCost: 'BigQuery pricing applies',
      requiresConfirmation: true,
      destructive: false,
      idempotent: false,
      typicalLatency: '5000-120000ms',
    },
    list_datasets: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    list_tables: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    get_table_schema: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    preview_query: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 'BigQuery dry-run (free)',
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    get_query_history: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '200-500ms',
    },
    schedule_refresh: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '300-800ms',
    },
  },

  sheets_appsscript: {
    run: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 'Apps Script quota applies',
      requiresConfirmation: true,
      destructive: true,
      idempotent: false,
      typicalLatency: '1000-30000ms',
    },
    deploy: {
      readOnly: false,
      apiCalls: 2,
      quotaCost: 2,
      requiresConfirmation: true,
      destructive: false,
      idempotent: false,
      typicalLatency: '2000-10000ms',
    },
    get_content: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    update_content: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: true,
      destructive: true,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    list_projects: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    create_project: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: false,
      typicalLatency: '1000-3000ms',
    },
    get_project: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    list_deployments: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    get_deployment: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    delete_deployment: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: true,
      destructive: true,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    list_versions: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    create_version: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: false,
      typicalLatency: '1000-3000ms',
    },
    get_metrics: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
    list_processes: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-2000ms',
    },
  },

  sheets_webhook: {
    register: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: false,
      typicalLatency: '300-800ms',
    },
    unregister: {
      readOnly: false,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '300-800ms',
    },
    list: {
      readOnly: true,
      apiCalls: 0,
      quotaCost: 0,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '50-100ms',
    },
    test: {
      readOnly: true,
      apiCalls: 0,
      quotaCost: 0,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '100-500ms',
    },
    get_stats: {
      readOnly: true,
      apiCalls: 0,
      quotaCost: 0,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '50-100ms',
    },
    clear_stats: {
      readOnly: false,
      apiCalls: 0,
      quotaCost: 0,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '50-100ms',
    },
  },

  sheets_dependencies: {
    build: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-5000ms',
    },
    analyze_impact: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-3000ms',
    },
    detect_cycles: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-3000ms',
    },
    get_dependents: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '200-1000ms',
    },
    get_dependencies: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '200-1000ms',
    },
    export_dot: {
      readOnly: true,
      apiCalls: 1,
      quotaCost: 1,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '500-3000ms',
    },
    get_stats: {
      readOnly: true,
      apiCalls: 0,
      quotaCost: 0,
      requiresConfirmation: false,
      destructive: false,
      idempotent: true,
      typicalLatency: '50-100ms',
    },
  },
```

#### Step 3: Update Tool Descriptions
**File:** `/src/mcp/registration.ts` or wherever TOOL_DEFINITIONS is

Update each tool's description to match actual action count. Example fixes:
- `sheets_core`: Change "(17 actions)" to "(22 actions)" 
- `sheets_format`: Change "(21 actions)" to match actual
- etc.

#### Step 4: Add Validation Script
**File:** `/scripts/validate-action-counts.ts`

```typescript
/**
 * Validates that action counts are consistent across:
 * 1. Tool descriptions in MCP registration
 * 2. ACTION_METADATA in schemas
 * 3. Handler implementations
 * 
 * Run: npx tsx scripts/validate-action-counts.ts
 * Add to CI: npm run validate:actions
 */

import { ACTION_METADATA } from '../src/schemas/action-metadata.js';
import { TOOL_DEFINITIONS } from '../src/mcp/registration.js';

// ... validation logic
```

---

## Issue #2: HTTP/2 Connection Instability

### Problem Summary
After ~10-15 successful API calls, the HTTP/2 connection fails with `ERR_HTTP2_STREAM_CANCEL` or `ERR_HTTP2_GOAWAY_SESSION`. Despite retry logic existing, errors are marked `retryable: false` and connection pool doesn't recover.

### Impact
- **Severity:** Critical
- **User Impact:** Operations fail until manual server restart
- **Developer Impact:** Unreliable server for production use

### Root Cause Analysis

1. **Retry logic exists** in `/src/utils/retry.ts`:
   - `RETRYABLE_CODES` includes HTTP/2 errors ✓
   - 3 retries with exponential backoff ✓

2. **BUT** the retry wrapper is per-request, not per-connection:
   - After 3 failed retries, error propagates to handler
   - Handler's `mapGoogleApiError()` doesn't recognize HTTP/2 codes
   - Falls to default case: `retryable: false`

3. **Connection pool holds stale connections**:
   - HTTP/2 session gets GOAWAY from Google
   - Pool doesn't invalidate the dead session
   - Subsequent requests reuse dead connection

4. **No connection health monitoring**:
   - No periodic ping/health check
   - No proactive connection refresh

### Fix Plan

#### Step 1: Add HTTP/2 Error Recognition to Handler
**File:** `/src/handlers/base.ts`

Add before the default case in `mapGoogleApiError()` (~line 750):

```typescript
  /**
   * Map Google API error to ErrorDetail with agent-actionable information
   */
  private mapGoogleApiError(error: Error): ErrorDetail {
    const message = error.message.toLowerCase();
    const errorCode = (error as { code?: string }).code;

    // ... existing error checks ...

    // HTTP/2 Connection Errors (transient, auto-recoverable)
    if (
      errorCode?.startsWith('ERR_HTTP2') ||
      message.includes('http2') ||
      message.includes('goaway') ||
      message.includes('stream cancel') ||
      message.includes('stream error') ||
      message.includes('session error') ||
      message.includes('new streams cannot be created')
    ) {
      return {
        code: 'CONNECTION_ERROR',
        message: 'HTTP/2 connection was reset by Google servers. This is a temporary network issue.',
        category: 'transient',
        severity: 'medium',
        retryable: true,
        retryAfterMs: 2000,
        resolution: 'The connection will automatically recover. Please retry the operation.',
        resolutionSteps: [
          '1. Wait 2-5 seconds for connection recovery',
          '2. Retry the same operation',
          '3. If error persists after 3 retries, the server may need restart',
          '4. Check network connectivity if issue continues',
        ],
        details: {
          errorCode: errorCode || 'HTTP2_ERROR',
          originalMessage: error.message,
          recoveryAction: 'automatic',
        },
      };
    }

    // Default: internal error
    return {
      // ... existing default case ...
    };
  }
```

#### Step 2: Add Connection Recovery to Google API Client
**File:** `/src/services/google-api.ts`

Add connection health tracking and recovery:

```typescript
// Add to class properties (around line 130)
private consecutiveErrors = 0;
private static readonly ERROR_THRESHOLD = 3;
private lastSuccessfulCall = Date.now();
private connectionResetInProgress = false;

// Add new method after initialize()
/**
 * Reset HTTP/2 connections after consecutive failures
 * This forces new connection negotiation with Google servers
 */
private async resetConnections(): Promise<void> {
  if (this.connectionResetInProgress) {
    logger.debug('Connection reset already in progress, skipping');
    return;
  }
  
  this.connectionResetInProgress = true;
  logger.warn('Resetting HTTP/2 connections due to consecutive errors', {
    consecutiveErrors: this.consecutiveErrors,
    lastSuccess: new Date(this.lastSuccessfulCall).toISOString(),
  });

  try {
    // Destroy existing HTTP agents
    this.httpAgents.http.destroy();
    this.httpAgents.https.destroy();
    
    // Create fresh agents
    this.httpAgents = createHttpAgents();
    
    // Re-initialize API clients with fresh connections
    const enableHTTP2 = process.env['GOOGLE_API_HTTP2_ENABLED'] !== 'false';
    
    this._sheets = wrapGoogleApi(
      google.sheets({ version: 'v4', auth: this.auth, http2: enableHTTP2 }),
      { ...this.retryOptions, circuit: this.circuit }
    );
    
    this._drive = wrapGoogleApi(
      google.drive({ version: 'v3', auth: this.auth, http2: enableHTTP2 }),
      { ...this.retryOptions, circuit: this.circuit }
    );
    
    this._bigquery = wrapGoogleApi(
      google.bigquery({ version: 'v2', auth: this.auth, http2: enableHTTP2 }),
      { ...this.retryOptions, circuit: this.circuit }
    );

    this.consecutiveErrors = 0;
    logger.info('HTTP/2 connections reset successfully');
  } catch (error) {
    logger.error('Failed to reset connections', { error });
  } finally {
    this.connectionResetInProgress = false;
  }
}

/**
 * Track API call success/failure for connection health
 */
public recordCallResult(success: boolean): void {
  if (success) {
    this.consecutiveErrors = 0;
    this.lastSuccessfulCall = Date.now();
  } else {
    this.consecutiveErrors++;
    if (this.consecutiveErrors >= GoogleApiClient.ERROR_THRESHOLD) {
      // Trigger async connection reset
      this.resetConnections().catch(err => 
        logger.error('Connection reset failed', { error: err })
      );
    }
  }
}

/**
 * Check if connections need proactive refresh
 * Call this periodically or before important operations
 */
public async ensureHealthyConnection(): Promise<void> {
  const idleTime = Date.now() - this.lastSuccessfulCall;
  const maxIdleMs = parseInt(process.env['GOOGLE_API_MAX_IDLE_MS'] ?? '300000'); // 5 min default
  
  if (idleTime > maxIdleMs) {
    logger.info('Connection idle too long, proactively refreshing', { idleTimeMs: idleTime });
    await this.resetConnections();
  }
}
```

#### Step 3: Integrate Call Tracking in Wrapper
**File:** `/src/services/google-api.ts`

Modify `wrapGoogleApi()` to track results:

```typescript
function wrapGoogleApi<T extends object>(
  api: T,
  options?: RetryOptions & { circuit?: CircuitBreaker; client?: GoogleApiClient }
): T {
  const cache = new WeakMap<object, unknown>();
  const circuit = options?.circuit;
  const client = options?.client;

  const wrapObject = (obj: object): unknown => {
    // ... existing code ...
    
    const proxy = new Proxy(obj, {
      get(target, prop, receiver) {
        // ... existing property checks ...

        if (typeof value === 'function') {
          return async (...args: unknown[]) => {
            try {
              const operation = (): Promise<unknown> =>
                executeWithRetry((signal) => {
                  const callArgs = injectSignal(args, signal);
                  return (value as (...params: unknown[]) => Promise<unknown>).apply(
                    target,
                    callArgs
                  );
                }, options);

              const result = circuit ? await circuit.execute(operation) : await operation();
              
              // Track success
              client?.recordCallResult(true);
              
              return result;
            } catch (error) {
              // Track failure
              client?.recordCallResult(false);
              throw error;
            }
          };
        }
        // ... rest of existing code ...
      },
    });
    // ... rest of existing code ...
  };

  return wrapObject(api) as T;
}
```

Update the calls to `wrapGoogleApi` in `initialize()`:

```typescript
this._sheets = wrapGoogleApi(sheetsApi, {
  ...(this.retryOptions ?? {}),
  timeoutMs: this.timeoutMs,
  circuit: this.circuit,
  client: this,  // Add this
});
```

#### Step 4: Add Keepalive Ping (Optional but Recommended)
**File:** `/src/services/google-api.ts`

Add periodic health check:

```typescript
// In constructor, add:
private keepaliveInterval?: NodeJS.Timeout;

// In initialize(), add at the end:
this.startKeepalive();

// Add new method:
private startKeepalive(): void {
  const intervalMs = parseInt(process.env['GOOGLE_API_KEEPALIVE_INTERVAL_MS'] ?? '60000'); // 1 min
  
  if (intervalMs <= 0) {
    logger.debug('Keepalive disabled');
    return;
  }
  
  this.keepaliveInterval = setInterval(async () => {
    try {
      await this.ensureHealthyConnection();
    } catch (error) {
      logger.warn('Keepalive check failed', { error });
    }
  }, intervalMs);
  
  // Don't prevent process exit
  this.keepaliveInterval.unref();
  
  logger.debug('Keepalive started', { intervalMs });
}

// In destroy(), add:
if (this.keepaliveInterval) {
  clearInterval(this.keepaliveInterval);
}
```

#### Step 5: Update Environment Configuration
**File:** `/src/config/env.ts`

Add new configuration options:

```typescript
// Add to schema:
GOOGLE_API_MAX_IDLE_MS: z.coerce.number().positive().default(300000), // 5 minutes
GOOGLE_API_KEEPALIVE_INTERVAL_MS: z.coerce.number().nonnegative().default(60000), // 1 minute, 0 = disabled
GOOGLE_API_CONNECTION_RESET_THRESHOLD: z.coerce.number().int().positive().default(3),
```

**File:** `.env.example`

```bash
# HTTP/2 Connection Management
GOOGLE_API_HTTP2_ENABLED=true
GOOGLE_API_MAX_IDLE_MS=300000
GOOGLE_API_KEEPALIVE_INTERVAL_MS=60000
GOOGLE_API_CONNECTION_RESET_THRESHOLD=3
```

#### Step 6: Add Connection Health Metrics
**File:** `/src/observability/metrics.ts`

Add metrics for monitoring:

```typescript
// Add counters
let connectionResets = 0;
let http2Errors = 0;

export function recordConnectionReset(): void {
  connectionResets++;
}

export function recordHttp2Error(errorCode: string): void {
  http2Errors++;
  // Could also track by error type
}

export function getConnectionMetrics(): { resets: number; http2Errors: number } {
  return { resets: connectionResets, http2Errors };
}
```

---

## Implementation Order

### Phase 1: Critical Fixes (Issue #2 - HTTP/2)
1. ✅ Add HTTP/2 error recognition in `base.ts` (15 min)
2. ✅ Add connection tracking in `google-api.ts` (30 min)  
3. ✅ Add connection reset logic (30 min)
4. ✅ Test with rapid API calls to verify recovery
5. ✅ Add environment config options (15 min)

### Phase 2: Documentation Fixes (Issue #1)
1. ✅ Run audit script to get exact action counts (10 min)
2. ✅ Add missing tools to `action-metadata.ts` (45 min)
3. ✅ Update tool description counts in `registration.ts` (20 min)
4. ✅ Add validation script to CI (15 min)
5. ✅ Update header comment (5 min)

### Phase 3: Testing & Verification
1. Run full test suite
2. Manual stress test with rapid API calls
3. Verify action counts match across all sources
4. Update CHANGELOG.md

---

## Testing Checklist

### Issue #1 Tests
- [ ] `npm run validate:actions` passes
- [ ] All 21 tools appear in action-metadata.ts
- [ ] Tool descriptions match metadata counts
- [ ] Header comment shows correct total

### Issue #2 Tests
- [ ] 20+ rapid API calls don't cause permanent failure
- [ ] After GOAWAY error, next call succeeds
- [ ] Connection reset triggers after 3 consecutive errors
- [ ] Metrics show connection resets
- [ ] Idle connection refresh works after 5 min inactivity

---

## Rollback Plan

If fixes cause issues:

1. **Issue #1:** Revert changes to `action-metadata.ts` - no runtime impact
2. **Issue #2:** Set `GOOGLE_API_HTTP2_ENABLED=false` to fall back to HTTP/1.1

---

## Estimated Effort

| Task | Time |
|------|------|
| Issue #1 total | 1.5 hours |
| Issue #2 total | 2 hours |
| Testing | 1 hour |
| **Total** | **4.5 hours** |
