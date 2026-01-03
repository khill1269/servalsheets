# Production Readiness Improvement Plan
**Status**: ❌ NOT PRODUCTION READY → 🎯 TARGET: PRODUCTION READY
**Overall Risk Level**: High → Low
**Execution Strategy**: Phased approach with validation gates

---

## Executive Summary

**Current State**:
- MCP SDK/protocol mismatch (CRITICAL blocker)
- OAuth security vulnerabilities (CRITICAL blocker)
- Type safety gaps and unbounded memory growth (HIGH risk)
- 15+ dependency upgrades needed
- Node/TS configuration misalignment

**Target State**:
- MCP 2025-11-25 compliant with SDK 1.25.1+
- OAuth 2.1 hardened with proper state management
- Type-safe throughout with strict TS config
- Modern dependency stack (Express 5, Zod 4, etc.)
- Node 22 LTS standardized across all environments
- Comprehensive test coverage with integration tests
- Production-ready CI/CD pipeline

**Estimated Effort**: 40-60 hours (1-2 weeks with focused effort)

---

## 🚨 Phase 1: CRITICAL Security & Protocol Fixes (MUST FIX FIRST)

### 1.1 MCP SDK Upgrade & Protocol Alignment ⚠️ BLOCKS EVERYTHING

**Issue**: SDK 1.0.4 only supports MCP 2024-11-05, but code declares 2025-11-25 and imports non-existent paths

**Files Affected**:
- `package.json` (line 56)
- `src/server.ts` (line 8)
- `src/http-server.ts` (line 16)
- `src/index.ts` (line 34)

**Actions**:
```bash
# 1. Upgrade SDK
npm install @modelcontextprotocol/sdk@^1.25.1

# 2. Update peerDependencies in package.json
"peerDependencies": {
  "@modelcontextprotocol/sdk": "^1.25.1"
}

# 3. Update imports
# OLD: import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
# NEW: Verify correct import paths from SDK 1.25.1 docs
```

**Verification**:
- `npm run build` succeeds
- `npm start` works for stdio mode
- HTTP server starts without import errors

**Risk**: HIGH - Breaking changes in SDK API
**Time**: 4-6 hours

---

### 1.2 OAuth Security Hardening ⚠️ CRITICAL VULNERABILITY

**Issue**: Open redirect vulnerability, unsigned state, JWT verification gaps

**Files Affected**:
- `src/oauth-provider.ts` (lines 142, 157, 206, 233, 460)

**Actions**:

#### 1.2.1 Redirect URI Allowlist
```typescript
// oauth-provider.ts - Add allowlist
const ALLOWED_REDIRECT_URIS = [
  'http://localhost:3000/callback',
  'http://localhost:8080/callback',
  // Add production URIs from env
  ...(process.env.ALLOWED_REDIRECT_URIS?.split(',') || [])
];

function validateRedirectUri(uri: string): boolean {
  return ALLOWED_REDIRECT_URIS.some(allowed =>
    uri === allowed || uri.startsWith(allowed + '?')
  );
}

// In authorize endpoint (line 142)
if (!validateRedirectUri(redirect_uri)) {
  throw new Error('Invalid redirect_uri');
}
```

#### 1.2.2 Signed State with Nonce Storage
```typescript
// Add crypto import
import { randomBytes, createHmac } from 'crypto';

// State storage with TTL
const stateStore = new Map<string, {
  created: number,
  clientId: string,
  redirectUri: string,
  used: boolean
}>();

// Generate signed state
function generateState(clientId: string, redirectUri: string): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const payload = `${nonce}:${timestamp}:${clientId}`;
  const signature = createHmac('sha256', process.env.STATE_SECRET!)
    .update(payload)
    .digest('hex');

  const state = `${payload}:${signature}`;
  stateStore.set(nonce, {
    created: timestamp,
    clientId,
    redirectUri,
    used: false
  });

  return state;
}

// Verify state (line 206, 233)
function verifyState(state: string): { clientId: string, redirectUri: string } {
  const [nonce, timestamp, clientId, signature] = state.split(':');

  // Verify signature
  const expectedSig = createHmac('sha256', process.env.STATE_SECRET!)
    .update(`${nonce}:${timestamp}:${clientId}`)
    .digest('hex');

  if (signature !== expectedSig) {
    throw new Error('Invalid state signature');
  }

  // Check nonce exists and not used
  const stored = stateStore.get(nonce);
  if (!stored || stored.used) {
    throw new Error('State already used or invalid');
  }

  // Check TTL (5 minutes)
  if (Date.now() - stored.created > 5 * 60 * 1000) {
    throw new Error('State expired');
  }

  // Mark as used
  stored.used = true;

  return { clientId: stored.clientId, redirectUri: stored.redirectUri };
}

// Cleanup task
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of stateStore.entries()) {
    if (now - data.created > 5 * 60 * 1000) {
      stateStore.delete(nonce);
    }
  }
}, 60 * 1000); // Every minute
```

#### 1.2.3 JWT Verification with aud/iss
```typescript
// oauth-provider.ts (line 460)
function verifyAccessToken(token: string): DecodedToken {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'servalsheets-oauth', // Add this
    audience: 'servalsheets-api', // Add this
    clockTolerance: 30 // 30 second clock skew tolerance
  }) as DecodedToken;
}

// Update token generation to include aud/iss
function generateAccessToken(clientId: string, userId: string, scope: string): string {
  return jwt.sign(
    {
      sub: userId,
      client_id: clientId,
      scope
    },
    JWT_SECRET,
    {
      expiresIn: '1h',
      issuer: 'servalsheets-oauth',
      audience: 'servalsheets-api'
    }
  );
}
```

**Verification**:
- Redirect URI validation blocks unauthorized URIs
- State cannot be reused or forged
- JWT verification enforces aud/iss

**Risk**: CRITICAL - Security vulnerability
**Time**: 6-8 hours

---

### 1.3 Secrets Management ⚠️ PRODUCTION BLOCKER

**Issue**: Secrets default to random UUIDs, breaking across restarts

**Files Affected**:
- `src/remote-server.ts` (lines 60, 66)

**Actions**:
```typescript
// remote-server.ts - Require explicit secrets
const JWT_SECRET = process.env.JWT_SECRET;
const STATE_SECRET = process.env.STATE_SECRET;

if (!JWT_SECRET || !STATE_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET and STATE_SECRET are required in production');
  }
  console.warn('⚠️  Using random secrets (development only)');
  // Only use fallback in dev
}

// Add to .env.example
JWT_SECRET=your-jwt-secret-here-use-openssl-rand-hex-32
STATE_SECRET=your-state-secret-here-use-openssl-rand-hex-32

// Add to README.md
## Environment Variables

### Required for Production
- `JWT_SECRET` - HMAC secret for JWT signing (generate: `openssl rand -hex 32`)
- `STATE_SECRET` - HMAC secret for OAuth state (generate: `openssl rand -hex 32`)
```

**Verification**:
- Production mode fails without explicit secrets
- Dev mode shows warning but continues

**Risk**: HIGH - Production stability
**Time**: 1-2 hours

---

## 🔥 Phase 2: HIGH Priority Infrastructure & Type Safety

### 2.1 Persistent Session/Token Storage with TTL

**Issue**: Unbounded in-memory Maps with no TTL eviction

**Files Affected**:
- `src/oauth-provider.ts` (line 65)
- `src/http-server.ts` (line 176)
- `src/remote-server.ts` (line 135)

**Actions**:

#### 2.1.1 Add Redis Support
```bash
npm install redis ioredis
npm install -D @types/ioredis
```

#### 2.1.2 Create Session Store Abstraction
```typescript
// src/storage/session-store.ts
export interface SessionStore {
  set(key: string, value: any, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<any | null>;
  delete(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

// In-memory implementation with TTL
export class InMemorySessionStore implements SessionStore {
  private store = new Map<string, { value: any, expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expires: Date.now() + (ttlSeconds * 1000)
    });
  }

  async get(key: string): Promise<any | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expires) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Redis implementation
export class RedisSessionStore implements SessionStore {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl);
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    await this.client.setex(key, ttlSeconds, JSON.stringify(value));
  }

  async get(key: string): Promise<any | null> {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async cleanup(): Promise<void> {
    // Redis handles TTL automatically
  }
}

// Factory
export function createSessionStore(): SessionStore {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return new RedisSessionStore(redisUrl);
  }
  return new InMemorySessionStore();
}
```

#### 2.1.3 Session Limits
```typescript
// src/storage/session-manager.ts
export class SessionManager {
  private store: SessionStore;
  private readonly MAX_SESSIONS_PER_USER = 5;

  async createSession(userId: string, sessionData: any): Promise<string> {
    // Check existing sessions
    const sessionKey = `sessions:${userId}`;
    const existingSessions = await this.store.get(sessionKey) || [];

    // Enforce limit
    if (existingSessions.length >= this.MAX_SESSIONS_PER_USER) {
      // Remove oldest session
      const oldestSession = existingSessions[0];
      await this.store.delete(`session:${oldestSession.id}`);
      existingSessions.shift();
    }

    // Create new session
    const sessionId = randomBytes(32).toString('hex');
    await this.store.set(`session:${sessionId}`, sessionData, 3600); // 1 hour

    existingSessions.push({ id: sessionId, created: Date.now() });
    await this.store.set(sessionKey, existingSessions, 86400); // 24 hours

    return sessionId;
  }
}
```

**Verification**:
- Sessions expire after TTL
- Memory usage stays bounded
- Redis optional but recommended for production

**Risk**: MEDIUM - Performance impact if not implemented
**Time**: 8-10 hours

---

### 2.2 Type Safety at Tool Boundaries

**Issue**: `as any` in handler map, `z.unknown` in output schemas

**Files Affected**:
- `src/tools/registration.ts` (line 157)
- `src/tools/pivot.ts` (line 279)
- `src/schemas/analysis.ts` (line 43, 223)
- `src/schemas/filter-sort.ts` (line 160)
- `src/schemas/shared.ts` (line 414)

**Actions**:

#### 2.2.1 Remove `as any` from Handler Map
```typescript
// registration.ts (line 157)
// OLD
const handler = toolDefinitions[toolName].handler as any;

// NEW - Define proper handler type
type ToolHandler<TInput, TOutput> = (
  args: TInput,
  ctx: McpContext
) => Promise<TOutput>;

interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  handler: ToolHandler<TInput, TOutput>;
}

// Update registration
const toolDefinitions: Record<string, ToolDefinition> = {
  'sheets_analyze': {
    name: 'sheets_analyze',
    description: '...',
    inputSchema: AnalysisInputSchema,
    outputSchema: AnalysisOutputSchema,
    handler: handleAnalyze // Properly typed
  }
  // ...
};

// In tool execution
const definition = toolDefinitions[toolName];
if (!definition) {
  throw new Error(`Unknown tool: ${toolName}`);
}

const parsedInput = definition.inputSchema.parse(args);
const result = await definition.handler(parsedInput, ctx);
const validatedOutput = definition.outputSchema.parse(result);
```

#### 2.2.2 Replace `z.unknown` with Explicit Schemas
```typescript
// analysis.ts (line 43, 223)
// OLD
details: z.record(z.unknown())

// NEW - Define explicit schema
const AnalysisDetailsSchema = z.object({
  totalRows: z.number(),
  totalColumns: z.number(),
  emptyRows: z.number(),
  dataTypes: z.record(z.string(), z.number()),
  patterns: z.array(z.string()),
  recommendations: z.array(z.string())
});

// filter-sort.ts (line 160)
// OLD
criteria: z.unknown()

// NEW
const FilterCriteriaSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('value'),
    condition: z.enum(['EQUAL', 'NOT_EQUAL', 'GREATER_THAN', 'LESS_THAN']),
    value: z.union([z.string(), z.number(), z.boolean()])
  }),
  z.object({
    type: z.literal('range'),
    min: z.number(),
    max: z.number()
  }),
  z.object({
    type: z.literal('blank'),
    showBlanks: z.boolean()
  })
]);

// shared.ts (line 414)
// OLD
details: z.unknown()

// NEW
const ErrorDetailsSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusCode: z.number().optional(),
  retryable: z.boolean().optional(),
  context: z.record(z.string(), z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null()
  ])).optional()
});
```

#### 2.2.3 Fix Pivot Refresh Type
```typescript
// pivot.ts (line 279)
// OLD
const refreshRequest = { /* ... */ } as any;

// NEW
import { sheets_v4 } from 'googleapis';

const refreshRequest: sheets_v4.Schema$Request = {
  updateCells: {
    range: {
      sheetId: pivotSheetId,
      startRowIndex: 0,
      endRowIndex: 1
    },
    rows: [{
      values: [{
        userEnteredValue: { stringValue: '' }
      }]
    }],
    fields: 'userEnteredValue'
  }
};
```

**Verification**:
- All tool handlers type-check without `as any`
- All schemas validate at build time
- Runtime validation catches invalid data

**Risk**: MEDIUM - Requires careful schema definition
**Time**: 10-12 hours

---

## ⚙️ Phase 3: MEDIUM Priority Alignment & Dependencies

### 3.1 TypeScript Strict Configuration

**Issue**: `exactOptionalPropertyTypes` disabled

**Files Affected**:
- `tsconfig.json` (line 20)

**Actions**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true, // Enable this
    "skipLibCheck": true // Add this to skip googleapis types
  }
}
```

**Handle googleapis Type Issues**:
```typescript
// src/types/googleapis-overrides.ts
// Wrap googleapis types that have optional property issues
import { sheets_v4 } from 'googleapis';

// Create strict wrapper types
export type StrictCellData = Omit<sheets_v4.Schema$CellData, 'userEnteredValue'> & {
  userEnteredValue?: sheets_v4.Schema$ExtendedValue; // Explicitly optional
};

// Use these types in your code instead of direct googleapis types
```

**Verification**:
- `npm run build` succeeds with no TS errors
- No implicit `undefined` in optional properties

**Risk**: LOW - Type-only change
**Time**: 3-4 hours

---

### 3.2 Express Version Alignment

**Issue**: Express 4.x with @types/express 5.x

**Files Affected**:
- `package.json` (lines 60, 75)

**Actions**:

**Option A**: Upgrade to Express 5 (RECOMMENDED)
```bash
npm install express@^5.2.1
npm install -D @types/express@^5.0.6

# Test all HTTP endpoints
npm run test:http
```

**Option B**: Downgrade types to v4
```bash
npm install -D @types/express@^4.17.21
```

**Update Code for Express 5** (if Option A):
```typescript
// Main changes in Express 5:
// 1. app.del() removed, use app.delete()
// 2. req.param() removed, use req.params/req.query
// 3. Promises are properly handled (no need for explicit error catching)

// http-server.ts - Update error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Express 5 handles async errors automatically
  logger.error('HTTP error', { error: err.message });
  res.status(500).json({ error: err.message });
});
```

**Verification**:
- HTTP server starts without errors
- All routes respond correctly
- Error handling works

**Risk**: LOW - Minor API changes
**Time**: 2-3 hours

---

### 3.3 Node Version Standardization

**Issue**: Inconsistent Node targets (engines >=18, CI Node 20, Docker Node 22, runtime v24)

**Files Affected**:
- `package.json` (line 53)
- `.github/workflows/ci.yml` (line 21)
- `Dockerfile` (line 1)

**Actions**:
```json
// package.json - Standardize on Node 22 LTS
"engines": {
  "node": ">=22.0.0",
  "npm": ">=9.0.0"
}
```

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22.x, 24.x] # Test both LTS and current
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
```

```dockerfile
# Dockerfile - Use Node 22 LTS
FROM node:22-alpine
```

```bash
# Update @types/node to match
npm install -D @types/node@^22.10.0
```

**.nvmrc** (create if missing):
```
22
```

**Verification**:
- CI passes on Node 22 and 24
- Docker image builds with Node 22
- Local dev uses correct version

**Risk**: LOW - Runtime compatibility
**Time**: 1-2 hours

---

## 📦 Phase 4: Dependency Upgrades (Major Versions)

### 4.1 Major Dependency Upgrades

**Order of Execution** (to minimize conflicts):

#### 4.1.1 Test Framework (Vitest)
```bash
npm install -D vitest@^4.0.16 @vitest/coverage-v8@^4.0.16

# Update vitest.config.ts if needed
# Run tests to ensure compatibility
npm test
```

#### 4.1.2 Zod v4
```bash
npm install zod@^4.3.4 zod-to-json-schema@latest

# Update schemas - Zod v4 breaking changes:
# - .refine() syntax changed
# - .superRefine() renamed
# - Error message format changed

# Review all schema files and update
npm run build && npm test
```

#### 4.1.3 Express 5 (if not done in Phase 3)
```bash
npm install express@^5.2.1
```

#### 4.1.4 Express Rate Limit v8
```bash
npm install express-rate-limit@^8.2.1

# Update usage - v8 changes:
# - windowMs is now window
# - max is now limit
# - New standardFailureStatusCode option

// http-server.ts
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  window: 15 * 60 * 1000, // was windowMs
  limit: 100, // was max
  standardHeaders: true,
  legacyHeaders: false
});
```

#### 4.1.5 googleapis
```bash
npm install googleapis@^169.0.0

# Test all Google Sheets API calls
npm run test:integration
```

#### 4.1.6 p-queue v9
```bash
npm install p-queue@^9.0.1

# v9 is ESM-only - ensure your code handles this
# No major API changes
```

#### 4.1.7 uuid v13
```bash
npm install uuid@^13.0.0
npm remove @types/uuid # uuid v13 ships its own types

# Update imports
// OLD
import { v4 as uuidv4 } from 'uuid';

// NEW (v13 - same API, just remove types package)
import { v4 as uuidv4 } from 'uuid';
```

**Verification After Each Upgrade**:
```bash
npm run build
npm test
npm run lint
```

**Risk**: MEDIUM - Breaking changes possible
**Time**: 6-8 hours total

---

### 4.2 Minor Dependency Updates

These should be safe:
```bash
# Check all at once
npm outdated

# Update low-risk packages
npm update cors helmet jsonwebtoken lru-cache winston
```

---

## 🎯 Phase 5: Node/TypeScript Modernization

### 5.1 Module System Consistency Check

**Status**: ✅ Already PASS (ESM NodeNext)

**Verify**:
- package.json has `"type": "module"`
- tsconfig.json has `"module": "NodeNext"`
- All imports use `.js` extensions

**No action needed unless issues found**

---

### 5.2 Build Correctness

**Issue**: Build may have issues after upgrades

**Actions**:
```bash
# Clean build
npm run build:clean

# Full rebuild
npm run build

# Verify dist/ contents
ls -la dist/

# Test entry points
node dist/cli.js --help
node dist/server.js # Should start
node dist/http-server.js # Should start
```

**Add Build Verification Script**:
```json
// package.json
"scripts": {
  "verify:build": "npm run build && node dist/cli.js --version && echo 'Build OK'"
}
```

---

## 🔒 Phase 6: MCP Compliance & Schema Improvements

### 6.1 Output Schema Cleanup

**Issue**: `z.unknown()` and loose action fields

**Files**:
- `src/schemas/analysis.ts` (lines 43, 223)
- `src/schemas/filter-sort.ts` (line 160)
- `src/schemas/shared.ts` (line 414)

**Actions**: (Covered in Phase 2.2.2)

---

### 6.2 Fix Stubbed Pivot Action

**Issue**: sheets_pivot has stubbed action that issues invalid request

**Files**:
- `src/tools/pivot.ts` (line 311)

**Actions**:
```typescript
// pivot.ts (line 311)
// Replace stub with actual implementation or remove the action

// If removing:
export const PivotActionsSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), /* ... */ }),
  z.object({ action: z.literal('update'), /* ... */ }),
  z.object({ action: z.literal('delete'), /* ... */ }),
  // Remove stubbed action
]);

// If implementing:
export const PivotActionsSchema = z.discriminatedUnion('action', [
  // ... existing actions ...
  z.object({
    action: z.literal('refresh'),
    pivotTableId: z.number(),
    /* Add proper fields */
  })
]);

async function handlePivotRefresh(args: RefreshPivotArgs) {
  // Proper implementation
  const request: sheets_v4.Schema$Request = {
    updateCells: {
      range: {
        sheetId: args.sheetId,
        startRowIndex: 0,
        endRowIndex: 1
      },
      rows: [{
        values: [{
          userEnteredValue: { stringValue: ' ' } // Trigger refresh
        }]
      }],
      fields: 'userEnteredValue'
    }
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: args.spreadsheetId,
    requestBody: { requests: [request] }
  });
}
```

---

### 6.3 HTTP Error Response Consistency

**Issue**: HTTP endpoints return raw error messages

**Files**:
- `src/http-server.ts` (line 282)

**Actions**:
```typescript
// http-server.ts (line 282)
// Use structured error format

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('HTTP error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  // Structured error response matching MCP error schema
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
      details: process.env.NODE_ENV === 'production'
        ? undefined
        : { stack: err.stack }
    }
  });
});

// Add error schema
const HttpErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  })
});
```

---

### 6.4 Request Cancellation Wiring

**Status**: ✅ **COMPLETED** - No implementation needed

**Resolution**: The MCP SDK (v1.25.1) automatically handles `notifications/cancelled` notifications. The SDK's Protocol class:
- Registers a handler for `CancelledNotificationSchema` in the constructor
- Processes cancellation notifications and aborts the corresponding request
- Stores request resolvers with AbortControllers in an internal map
- Automatically cleans up cancelled requests

**Evidence**:
- `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js:27` - Cancellation handler registration
- `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.js:656` - Cancellation notification sending
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js:201` - Server allows cancellation notifications

**Conclusion**: No additional wiring needed. The SDK handles request cancellation at the transport layer. Tool handlers will be aborted automatically when clients send cancellation notifications.

**Optional Enhancement** (not required for production readiness):
If long-running operations need graceful cancellation, individual handlers can optionally add AbortSignal support:
```typescript
// Optional: For long-running operations
async function handleLargeOperation(args: Args) {
  // Periodically check if client has disconnected
  // or implement cooperative cancellation
}
```

---

## 🧪 Phase 7: Testing & CI/CD Hardening

### 7.1 Add ESLint Configuration

**Issue**: ESLint config missing

**Actions**:
```bash
# Create eslint.config.js (ESLint 9 flat config)
```

```javascript
// eslint.config.js
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/']
  }
];
```

---

### 7.2 Make Security Audit Blocking

**Issue**: Security audit not blocking in CI

**Files**:
- `.github/workflows/ci.yml` (line 60)

**Actions**:
```yaml
# .github/workflows/ci.yml
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x

      - name: Install dependencies
        run: npm ci

      - name: Security audit (production only)
        run: npm audit --production --audit-level=high
        # Fails build if HIGH or CRITICAL vulnerabilities found

      - name: Dependency check
        run: |
          npm outdated || true
          echo "Review outdated dependencies"

  test:
    needs: [security] # Block tests if security fails
    # ... rest of test job
```

---

### 7.3 Integration Tests for HTTP/OAuth

**Issue**: Missing integration tests for HTTP/OAuth transports

**Actions**:
```typescript
// tests/integration/http-transport.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { startHttpServer } from '../../src/http-server';

describe('HTTP Transport Integration', () => {
  let server: any;
  let request: supertest.SuperTest<supertest.Test>;

  beforeAll(async () => {
    server = await startHttpServer({ port: 3001 });
    request = supertest(server);
  });

  afterAll(async () => {
    await server.close();
  });

  it('should handle MCP initialize', async () => {
    const response = await request
      .post('/mcp')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.result.protocolVersion).toBe('2025-11-25');
  });

  it('should handle tools/list', async () => {
    const response = await request
      .post('/mcp')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      });

    expect(response.status).toBe(200);
    expect(response.body.result.tools).toBeInstanceOf(Array);
  });
});

// tests/integration/oauth-flow.test.ts
describe('OAuth Flow Integration', () => {
  it('should reject invalid redirect URI', async () => {
    const response = await request
      .get('/oauth/authorize')
      .query({
        client_id: 'test-client',
        redirect_uri: 'https://evil.com/callback',
        response_type: 'code',
        state: 'test-state'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_request');
  });

  it('should reject reused state', async () => {
    // First use
    const state = await generateTestState();
    await useAuthCode(state);

    // Second use should fail
    const response = await request
      .get('/oauth/callback')
      .query({ code: 'test-code', state });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('state');
  });

  it('should verify JWT aud/iss', async () => {
    const fakeToken = jwt.sign(
      { sub: 'user123' },
      'wrong-secret',
      { issuer: 'wrong-issuer' }
    );

    const response = await request
      .get('/api/user')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(response.status).toBe(401);
  });
});
```

---

### 7.4 Cancellation Integration Tests

**Actions**:
```typescript
// tests/integration/cancellation.test.ts
describe('Request Cancellation', () => {
  it('should cancel long-running operation', async () => {
    const requestId = 'test-request-123';

    // Start long operation
    const toolPromise = server.handleToolCall({
      id: requestId,
      method: 'tools/call',
      params: {
        name: 'sheets_analyze',
        arguments: { spreadsheetId: 'large-sheet' }
      }
    });

    // Send cancellation after 100ms
    setTimeout(() => {
      server.handleNotification({
        method: 'notifications/cancelled',
        params: { requestId, reason: 'User cancelled' }
      });
    }, 100);

    // Should reject with cancellation error
    await expect(toolPromise).rejects.toThrow('cancelled');
  });
});
```

---

## 📊 Phase 8: Final Validation & Documentation

### 8.1 Comprehensive Testing

**Actions**:
```bash
# Run all test suites
npm run test:unit
npm run test:integration
npm run test:security

# Run with coverage
npm run test:coverage

# Verify coverage thresholds
# Target: 80%+ coverage
```

---

### 8.2 Production Readiness Checklist

**Create Checklist**:
```markdown
# Production Readiness Checklist

## ✅ Critical Blockers Resolved
- [ ] MCP SDK upgraded to 1.25.1+
- [ ] OAuth redirect URI allowlist implemented
- [ ] OAuth state nonce storage with one-time use
- [ ] JWT aud/iss verification enabled
- [ ] Explicit secrets required in production

## ✅ High Priority Fixed
- [ ] Persistent session storage with TTL
- [ ] Session limits enforced
- [ ] All `as any` removed from code
- [ ] All `z.unknown()` replaced with explicit schemas
- [ ] Memory stores have cleanup tasks

## ✅ Medium Priority Completed
- [ ] exactOptionalPropertyTypes enabled
- [ ] Express version aligned (5.x)
- [ ] Node version standardized (22 LTS)
- [ ] @types/node updated to match runtime

## ✅ Dependencies Updated
- [ ] MCP SDK 1.25.1+
- [ ] Express 5.x
- [ ] express-rate-limit 8.x
- [ ] googleapis 169.x
- [ ] zod 4.x
- [ ] vitest 4.x
- [ ] p-queue 9.x
- [ ] uuid 13.x

## ✅ MCP Compliance
- [ ] Output schemas have no z.unknown()
- [x] Stubbed pivot action fixed/removed (add_calculated_field and remove_calculated_field removed from schema)
- [x] HTTP errors use structured format (uses { error: { code, message, details } })
- [x] Cancellation wired to tool execution (SDK handles automatically, no custom implementation needed)
- [ ] Integration tests for HTTP/OAuth/cancellation

## ✅ Testing & CI
- [ ] ESLint config added
- [ ] Security audit blocking in CI
- [ ] Integration tests pass
- [ ] Coverage >80%
- [ ] All transports tested

## ✅ Documentation
- [ ] Environment variables documented
- [ ] OAuth setup guide updated
- [ ] Deployment guide reviewed
- [ ] CHANGELOG updated
```

---

### 8.3 Update Documentation

**Files to Update**:

#### README.md
```markdown
## Environment Variables

### Required for Production
- `JWT_SECRET` - JWT signing secret (generate: `openssl rand -hex 32`)
- `STATE_SECRET` - OAuth state HMAC secret (generate: `openssl rand -hex 32`)
- `ALLOWED_REDIRECT_URIS` - Comma-separated OAuth redirect URI allowlist
- `NODE_ENV` - Set to `production` for production mode

### Optional
- `REDIS_URL` - Redis connection URL for session storage (recommended for HA)
- `MAX_SESSIONS_PER_USER` - Maximum concurrent sessions per user (default: 5)

## Deployment

### Docker
\`\`\`bash
docker build -t servalsheets .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=\$(openssl rand -hex 32) \
  -e STATE_SECRET=\$(openssl rand -hex 32) \
  -e ALLOWED_REDIRECT_URIS="https://app.example.com/callback" \
  -e REDIS_URL=redis://redis:6379 \
  servalsheets
\`\`\`

### Production Checklist
See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
```

#### CHANGELOG.md
```markdown
## [2.0.0] - 2025-XX-XX

### Breaking Changes
- Upgraded MCP SDK to 1.25.1 (protocol 2025-11-25)
- Upgraded Express to 5.x
- Upgraded Zod to 4.x
- Node 22 LTS now required (minimum)

### Security
- **CRITICAL**: OAuth redirect URI allowlist enforcement
- **CRITICAL**: OAuth state nonce storage with one-time use
- **CRITICAL**: JWT aud/iss verification
- Explicit secrets required in production mode

### Added
- Persistent session storage with Redis support
- Session limits per user
- Request cancellation support
- Integration tests for HTTP/OAuth/cancellation

### Fixed
- Unbounded memory growth in session stores
- Type safety gaps (removed all `as any`)
- Output schema validation (no more `z.unknown()`)
- Stubbed pivot action implementation
- HTTP error response consistency

### Changed
- Standardized on Node 22 LTS
- Updated all major dependencies
- Enabled `exactOptionalPropertyTypes` in tsconfig
```

---

## 🎯 Execution Strategy

### Recommended Order

**Week 1** (Critical Path):
1. **Day 1-2**: Phase 1 (CRITICAL fixes) - SDK, OAuth, secrets
2. **Day 3-4**: Phase 2.1 (Session storage with TTL)
3. **Day 5**: Phase 2.2 (Type safety)

**Week 2** (Completion):
4. **Day 6**: Phase 3 (TS strict, Express, Node alignment)
5. **Day 7-8**: Phase 4 (Dependency upgrades)
6. **Day 9**: Phase 5-6 (Modernization, MCP compliance)
7. **Day 10**: Phase 7-8 (Testing, validation, docs)

### Validation Gates

After each phase:
```bash
npm run build
npm test
npm run lint
npm audit --production
```

### Rollback Plan

- Commit after each phase
- Tag releases: `v2.0.0-phase1`, `v2.0.0-phase2`, etc.
- Keep branches for each phase
- Document breaking changes

---

## 📈 Success Metrics

**Before** (Current State):
- ❌ NOT production ready
- 🔴 High risk level
- 🔴 CRITICAL blockers: 3
- 🟡 HIGH issues: 5
- 🟡 MEDIUM issues: 2
- 📦 Dependencies: 15+ outdated

**After** (Target State):
- ✅ Production ready
- 🟢 Low risk level
- ✅ CRITICAL blockers: 0
- ✅ HIGH issues: 0
- ✅ MEDIUM issues: 0
- 📦 Dependencies: All current
- 🧪 Test coverage: >80%
- 🔒 Security: OAuth 2.1 hardened
- 📋 MCP: 2025-11-25 compliant
- 🎯 Type safety: 100% (no `any`, no `unknown`)

---

## 🚀 Next Steps

1. **Review this plan** with team
2. **Create GitHub issues** for each phase
3. **Set up project board** for tracking
4. **Allocate time** (1-2 weeks)
5. **Start with Phase 1** (CRITICAL path)
6. **Validate at each gate**
7. **Update this document** as you progress

---

## 📝 Notes

- This plan assumes **focused, dedicated effort**
- Some phases can be parallelized (e.g., Phase 3 and 4)
- Testing time included in estimates
- Documentation time included
- Buffer time for unexpected issues: ~20%

**Total Estimated Time**: 40-60 hours (1-2 weeks)
**Confidence Level**: High (well-defined issues, clear fixes)
**Risk Level**: Medium (major upgrades, but incremental)

---

**Last Updated**: 2025-01-03
**Status**: 📋 PLANNING
**Next Action**: Review and approve plan
