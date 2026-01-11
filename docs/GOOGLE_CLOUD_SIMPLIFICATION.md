# ServalSheets - Google Cloud Simplification Analysis

## Overview

When deploying to Google Cloud with managed authentication (Cloud Run + Application Default Credentials or Service Account), significant portions of the codebase become unnecessary. This analysis identifies **5,638 lines of code** that can be removed.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT SERVALSHEETS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   server.ts  │  │ http-server  │  │   remote-server.ts   │  │
│  │  (stdio MCP) │  │   (HTTP)     │  │  (HTTP + OAuth 2.1)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│         │                 │                     │               │
│         ▼                 ▼                     ▼               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 OAuth Infrastructure                      │   │
│  │  • oauth-provider.ts (894 lines)                         │   │
│  │  • token-store.ts (125 lines)                            │   │
│  │  • token-manager.ts (449 lines)                          │   │
│  │  • handlers/auth.ts (530 lines)                          │   │
│  │  • security/* (993 lines)                                │   │
│  │  • storage/* (734 lines)                                 │   │
│  │  • well-known.ts (288 lines)                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 google-api.ts                            │   │
│  │  (supports: oauth | service_account | application_default)│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Google Cloud Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 SIMPLIFIED FOR GOOGLE CLOUD                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    server.ts (stdio MCP)                  │  │
│  │              OR http-server.ts (simplified)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   google-api.ts                           │  │
│  │            (application_default credentials)              │  │
│  │                                                           │  │
│  │   Google Cloud automatically provides credentials via:    │  │
│  │   • Cloud Run service account                            │  │
│  │   • GOOGLE_APPLICATION_CREDENTIALS env var               │  │
│  │   • Workload Identity Federation                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to REMOVE (5,638 lines)

### 1. OAuth Provider & Remote Server (1,440 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/oauth-provider.ts` | 894 | Full OAuth 2.1 server implementation |
| `src/remote-server.ts` | 546 | HTTP server with OAuth integration |

### 2. Token Storage (574 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/services/token-store.ts` | 125 | Encrypted file-based token storage |
| `src/services/token-manager.ts` | 449 | Token refresh & lifecycle management |

### 3. OAuth Utilities (226 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/oauth-callback-server.ts` | 190 | Local callback server for OAuth flow |
| `src/utils/oauth-config.ts` | 26 | OAuth environment configuration |
| `src/utils/auth-paths.ts` | 10 | Token store path helpers |

### 4. Auth Handler & Schema (602 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/handlers/auth.ts` | 530 | sheets_auth tool implementation |
| `src/schemas/auth.ts` | 72 | Auth tool Zod schemas |

### 5. Security Infrastructure (993 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/security/resource-indicators.ts` | 504 | RFC 9728 resource indicators |
| `src/security/incremental-scope.ts` | 462 | Incremental consent management |
| `src/security/index.ts` | 27 | Security exports |

### 6. Session Storage (728 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/storage/session-store.ts` | 434 | OAuth session storage |
| `src/storage/session-manager.ts` | 294 | Session limits & TTL |
| `src/storage/index.ts` | 6 | Storage exports |

### 7. Discovery Endpoints (288 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/server/well-known.ts` | 288 | OAuth discovery (RFC 8414) |

### 8. Auth Guard (294 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/utils/auth-guard.ts` | 294 | Auth middleware |

### 9. CLI Auth Setup (560 lines)
| File | Lines | Purpose |
|------|-------|---------|
| `src/cli/auth-setup.ts` | 560 | OAuth setup wizard |
| `src/cli/index.ts` | 5 | CLI exports |

---

## Tests to REMOVE (1,922 lines)

| Test File | Lines |
|-----------|-------|
| `tests/handlers/auth.test.ts` | 370 |
| `tests/integration/oauth-flow.test.ts` | 491 |
| `tests/security/resource-indicators.test.ts` | 257 |
| `tests/server/well-known.test.ts` | 232 |
| `tests/services/token-store.test.ts` | 53 |
| `tests/storage/session-store.test.ts` | 304 |
| `tests/unit/token-manager.test.ts` | 215 |

---

## Summary

| Category | Lines Removed |
|----------|---------------|
| Source Code | 5,638 |
| Tests | 1,922 |
| **TOTAL** | **7,560** |

### Percentage Reduction
- Current total: ~81,299 lines
- After removal: ~73,739 lines  
- **Reduction: ~9.3%**

---

## Files to MODIFY

### 1. `src/index.ts`
Remove exports:
```typescript
// REMOVE these exports
export { OAuthProvider, type OAuthConfig } from './oauth-provider.js';
```

### 2. `src/google-api.ts`
Remove token store integration (keep service account & ADC support):
- Remove `EncryptedFileTokenStore` import
- Remove `TokenManager` integration
- Keep `application_default` auth path

### 3. `src/http-server.ts`
Simplify by removing:
- `registerWellKnownHandlers` import
- `optionalResourceIndicatorMiddleware` import
- OAuth-related middleware

### 4. `src/mcp/registration/tool-definitions.ts`
Remove sheets_auth tool definition (tool count: 26 → 25)

### 5. `src/mcp/registration/tool-handlers.ts`
Remove auth handler mapping

### 6. `package.json`
Remove dependencies:
```json
{
  "jsonwebtoken": "remove",
  "express-rate-limit": "keep if using http-server",
  "open": "remove"
}
```

---

## How Google Cloud Auth Works

### Option 1: Cloud Run with Default Service Account
```bash
# Deploy to Cloud Run - auth is automatic
gcloud run deploy servalsheets \
  --image gcr.io/PROJECT/servalsheets \
  --service-account sheets-sa@PROJECT.iam.gserviceaccount.com
```

The service account needs:
- `roles/sheets.editor` (Google Sheets API)
- `roles/drive.file` (Drive API - created files only)

### Option 2: Workload Identity Federation
For multi-cloud or external CI/CD:
```bash
# Configure workload identity pool
gcloud iam workload-identity-pools create-cred-config \
  projects/PROJECT/locations/global/workloadIdentityPools/POOL/providers/PROVIDER \
  --output-file=/path/to/credentials.json
```

### Option 3: Service Account Key (Development)
```bash
# Set credentials path
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Run server
npm start
```

---

## Migration Steps

1. **Create simplified branch**
   ```bash
   git checkout -b google-cloud-simplified
   ```

2. **Remove files**
   ```bash
   rm src/oauth-provider.ts
   rm src/remote-server.ts
   rm src/services/token-store.ts
   rm src/services/token-manager.ts
   rm src/utils/oauth-*.ts
   rm src/utils/auth-*.ts
   rm src/handlers/auth.ts
   rm src/schemas/auth.ts
   rm -rf src/security/
   rm -rf src/storage/
   rm src/server/well-known.ts
   rm -rf src/cli/
   rm tests/handlers/auth.test.ts
   rm tests/integration/oauth-flow.test.ts
   # ... etc
   ```

3. **Update imports** in remaining files

4. **Simplify google-api.ts** to only use ADC

5. **Update tool count** from 26 to 25

6. **Run tests** to verify

---

## What REMAINS (Core MCP Server)

| Component | Lines | Purpose |
|-----------|-------|---------|
| `server.ts` | 923 | Core MCP server (stdio) |
| `http-server.ts` | ~600 | HTTP transport (simplified) |
| 25 tool handlers | ~12,000 | Tool implementations |
| 25 schemas | ~4,000 | Zod schemas |
| Core services | ~8,000 | Google API, batch, cache, etc. |
| Resources | ~3,000 | Knowledge, prompts, resources |
| Utils | ~2,000 | Logging, retry, errors |

**Estimated final size: ~73,000 lines** (focused on MCP functionality)
