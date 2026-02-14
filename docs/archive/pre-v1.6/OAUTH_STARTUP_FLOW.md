# OAuth Startup Flow Analysis

**Generated**: 2026-02-03
**Version**: 1.6.0

This document traces the complete OAuth configuration loading flow when the MCP server starts.

---

## 🔄 Complete Initialization Flow

### Entry Point: `src/cli.ts`

```typescript
// 1. Load .env file (line 25)
dotenv.config({ quiet: true, path: join(projectRoot, '.env') });

// Environment variables now available:
// - OAUTH_CLIENT_ID
// - OAUTH_CLIENT_SECRET
// - OAUTH_REDIRECT_URI
// - OAUTH_SCOPE_MODE (optional, defaults to 'full')
// - ENCRYPTION_KEY
```

### Transport Selection

**STDIO Mode** (Claude Desktop):

```bash
node dist/cli.js --stdio
# Or just: node dist/cli.js (default)
```

**HTTP Mode** (Web integrations):

```bash
node dist/cli.js --http --port 3000
```

---

## 📋 STDIO Transport Flow

### 1. Server Initialization (`src/server.ts:231`)

```typescript
async initialize(): Promise<void> {
  if (this.options.googleApiOptions) {
    // Create Google API client with OAuth config
    this.googleClient = await createGoogleApiClient(
      this.options.googleApiOptions
    );
    // ↓ Goes to services/google-api.ts
  }
}
```

### 2. Google API Client Creation (`src/services/google-api.ts:149`)

```typescript
export class GoogleApiClient {
  constructor(options: GoogleApiClientOptions = {}) {
    // ⭐ KEY: Scope selection happens here
    this._scopes = options.scopes ?? Array.from(getConfiguredScopes());
    //                                           ↓
    //                              config/oauth-scopes.ts
  }
}
```

### 3. Scope Configuration (`src/config/oauth-scopes.ts:88`)

```typescript
export function getConfiguredScopes(): readonly string[] {
  // Read from environment
  const scopeMode = process.env['OAUTH_SCOPE_MODE'] ?? 'full';

  switch (scopeMode) {
    case 'minimal':
      return MINIMAL_SCOPES;      // 2 scopes
    case 'readonly':
      return READONLY_SCOPES;     // 2 scopes
    case 'full':
    default:
      return FULL_ACCESS_SCOPES;  // 8 scopes ⭐
  }
}
```

### 4. Full Access Scopes (`src/config/oauth-scopes.ts:35`)

```typescript
export const FULL_ACCESS_SCOPES = [
  // Core (required for basic operations)
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.appdata',

  // BigQuery (for sheets_bigquery tool)
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/cloud-platform',

  // Apps Script (for sheets_appsscript tool)
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/script.processes',
] as const;
```

### 5. Token Loading (`src/services/google-api.ts:422`)

```typescript
private async loadStoredTokens(): Promise<void> {
  if (this.tokenStore) {
    // Load tokens from ~/.servalsheets/tokens.encrypted
    storedTokens = await this.tokenStore.load();

    // Restore scopes from stored tokens
    if (storedTokens.scope) {
      this._scopes = storedTokens.scope.split(' ');
    }
  }
}
```

### 6. Google API Initialization (`src/services/google-api.ts:280`)

```typescript
const sheetsApi = google.sheets({
  version: 'v4',
  auth: this.auth,
  http2: true,  // HTTP/2 enabled for 5-15% latency reduction
});

const driveApi = google.drive({
  version: 'v3',
  auth: this.auth,
  http2: true,
});

const bigqueryApi = google.bigquery({
  version: 'v2',
  auth: this.auth,
  http2: true,
});
```

---

## 🌐 HTTP Transport Flow

### 1. HTTP Server Creation (`src/http-server.ts:267`)

```typescript
export function createHttpServer(options: HttpServerOptions = {}) {
  // OAuth provider for MCP-level auth (optional)
  if (options.enableOAuth && options.oauthConfig) {
    oauthProvider = new OAuthProvider(options.oauthConfig);
    app.use(oauthProvider.createRouter());
  }
}
```

### 2. Session-Specific Google Client (`src/http-server.ts:122`)

```typescript
async function createMcpServerInstance(
  googleToken?: string,
  googleRefreshToken?: string
): Promise<{ mcpServer: McpServer }> {

  if (googleToken) {
    // Create Google API client with session tokens
    googleClient = await createGoogleApiClient({
      accessToken: googleToken,
      refreshToken: googleRefreshToken,
      // ⭐ Scopes come from stored tokens or getConfiguredScopes()
    });
  }
}
```

### 3. OAuth Authorization (`src/oauth-provider.ts:516`)

```typescript
// For Claude Connectors, redirect to Google OAuth
if (this.config.googleClientId) {
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  // ⭐ Uses centralized scope configuration
  const googleScopes = formatScopesForAuth(getRecommendedScopes());
  //                                        ↓
  //                           config/oauth-scopes.ts:FULL_ACCESS_SCOPES

  googleAuthUrl.searchParams.set('scope', googleScopes);
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'consent');
  googleAuthUrl.searchParams.set('include_granted_scopes', 'true');
}
```

---

## 🔍 Scope Resolution Priority

When the server starts, scopes are resolved in this order:

### 1. **Explicit Options** (highest priority)

```typescript
const client = await createGoogleApiClient({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],  // Explicit
});
// → Uses provided scopes exactly
```

### 2. **Stored Token Scopes**

```typescript
// If tokens exist in ~/.servalsheets/tokens.encrypted
const storedTokens = await tokenStore.load();
if (storedTokens.scope) {
  this._scopes = storedTokens.scope.split(' ');
}
// → Uses scopes from last authentication
```

### 3. **Environment Configuration**

```bash
# .env file
OAUTH_SCOPE_MODE=full  # or 'minimal' or 'readonly'
```

```typescript
// services/google-api.ts:182
this._scopes = options.scopes ?? Array.from(getConfiguredScopes());
//                                           ↓ reads OAUTH_SCOPE_MODE
```

### 4. **Default** (lowest priority)

```typescript
// If no configuration provided
return FULL_ACCESS_SCOPES;  // 8 comprehensive scopes
```

---

## 📊 Startup Scope Loading Matrix

| Scenario | Scope Source | Count | Scopes |
|----------|--------------|-------|--------|
| **Fresh Install** | `getConfiguredScopes()` | 8 | FULL_ACCESS_SCOPES |
| **After `npm run auth`** | Stored tokens | 8 | From authentication |
| **OAUTH_SCOPE_MODE=minimal** | Environment | 2 | spreadsheets, drive.file |
| **OAUTH_SCOPE_MODE=readonly** | Environment | 2 | *.readonly scopes |
| **OAUTH_SCOPE_MODE=full** | Environment | 8 | All features |
| **Explicit options** | Code | Varies | Custom |

---

## 🔐 Token Storage & Loading

### Token File Location

```bash
~/.servalsheets/tokens.encrypted
```

### Token Structure

```typescript
interface StoredTokens {
  access_token?: string;       // Short-lived (1 hour)
  refresh_token?: string;      // Long-lived (up to 6 months)
  expiry_date?: number;        // Timestamp
  token_type?: string;         // Usually "Bearer"
  scope?: string;              // Space-separated scope list ⭐
  id_token?: string;           // JWT with user info
}
```

### Encryption

```typescript
// services/token-store.ts
class EncryptedFileTokenStore {
  private algorithm = 'aes-256-gcm';  // AES-256-GCM
  private ivLength = 16;
  private authTagLength = 16;

  async save(tokens: StoredTokens): Promise<void> {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    // Encrypt tokens
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(tokens), 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Store: iv + authTag + encrypted data
    await fs.writeFile(this.path,
      Buffer.concat([iv, authTag, encrypted])
    );
  }
}
```

---

## 🎯 What Happens at Server Start

### STDIO Mode (Claude Desktop)

```
1. Load .env file
   └─> OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_SCOPE_MODE

2. Create GoogleApiClient
   └─> Read OAUTH_SCOPE_MODE (defaults to 'full')
   └─> Call getConfiguredScopes()
       └─> Returns FULL_ACCESS_SCOPES (8 scopes)

3. Check for stored tokens
   └─> Load ~/.servalsheets/tokens.encrypted
   └─> If exists:
       ├─> Decrypt tokens
       ├─> Extract scope string
       └─> Override _scopes with stored scopes

4. Initialize Google API clients
   └─> sheets_v4.Sheets (with auth + scopes)
   └─> drive_v3.Drive (with auth + scopes)
   └─> bigquery_v2.Bigquery (with auth + scopes)

5. Register MCP tools
   └─> All 21 tools available
   └─> Tools validate scopes before operations
```

### HTTP Mode (Web Integration)

```
1. Load .env file
   └─> OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, etc.

2. Create HTTP server
   └─> Initialize OAuth provider
       ├─> Configure Google OAuth endpoints
       └─> Set redirect URI

3. Wait for OAuth flow
   └─> User visits /oauth/authorize
   └─> Redirect to Google OAuth
       └─> Include ALL 8 scopes in authorization URL
   └─> User grants permissions
   └─> Google redirects back with auth code
   └─> Exchange code for tokens
       └─> Tokens include scope string with granted scopes

4. Create session-specific GoogleApiClient
   └─> Use tokens from OAuth flow
   └─> Scopes come from tokens.scope

5. Register MCP tools for this session
   └─> Tools have access to full scopes
```

---

## 🧪 Verification at Runtime

### Check Active Scopes

**STDIO Mode**:

```typescript
// In any handler
const scopes = this.googleClient.scopes;
console.log('Active scopes:', scopes);
// → ['https://www.googleapis.com/auth/spreadsheets', ...]
```

**HTTP Mode**:

```bash
curl http://localhost:3000/health | jq .scopes
```

**Expected Output**:

```json
{
  "status": "healthy",
  "authenticated": true,
  "scopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/bigquery",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/script.deployments",
    "https://www.googleapis.com/auth/script.processes"
  ]
}
```

---

## 🔄 Scope Update Flow

### Re-authenticate to Update Scopes

```bash
# 1. Delete old tokens
rm ~/.servalsheets/tokens.encrypted

# 2. Re-run authentication
npm run auth

# 3. During auth, scopes come from:
#    cli/auth-setup.ts:396
#    ↓ getRecommendedScopes()
#    ↓ FULL_ACCESS_SCOPES (8 scopes)

# 4. Google shows consent screen with ALL 8 permissions

# 5. User grants permissions

# 6. Tokens saved with scope field:
#    scope: "https://...spreadsheets https://...drive ..."
```

---

## 📝 Configuration Summary

### Environment Variables (.env)

```bash
# OAuth Credentials (required)
OAUTH_CLIENT_ID=<client-id>.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=<secret>
OAUTH_REDIRECT_URI=http://localhost:3000/callback

# Scope Mode (optional, defaults to 'full')
OAUTH_SCOPE_MODE=full  # 'full' | 'minimal' | 'readonly'

# Token Storage (auto-generated by npm run auth)
ENCRYPTION_KEY=<32-byte-hex>
```

### Scope Modes

| Mode | Scopes | Use Case |
|------|--------|----------|
| **full** (default) | 8 scopes | Normal use - all features |
| **minimal** | 2 scopes | Testing - basic ops only |
| **readonly** | 2 scopes | Analysis - read-only |

---

## 🎯 Key Takeaways

1. **Single Source of Truth**: All scopes come from `src/config/oauth-scopes.ts`

2. **Default is Comprehensive**: Unless explicitly configured, uses full 8 scopes

3. **Stored Tokens Win**: If tokens exist, their scopes override configuration

4. **Consistent Everywhere**: STDIO, HTTP, OAuth provider all use same scope config

5. **Transparent**: Users see all requested permissions during authentication

6. **MCP Compliant**: Follows MCP 2025-11-25 protocol requirements

7. **Google Best Practices**: Offline access, consent prompt, full scopes upfront

---

**Last Updated**: 2026-02-03
**Version**: 1.6.0
**Status**: ✅ Verified
