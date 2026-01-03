# Quick Fixes Checklist - Production Readiness

> **Use this checklist to track progress through each phase**

---

## 🚨 Phase 1: CRITICAL (DO FIRST)

### 1.1 MCP SDK Upgrade
- [ ] `npm install @modelcontextprotocol/sdk@^1.25.1`
- [ ] Update peerDependencies in package.json
- [ ] Fix import paths in server.ts, http-server.ts
- [ ] Update protocol constant in index.ts
- [ ] Test: `npm run build && npm start`

### 1.2 OAuth Security
- [ ] Add `ALLOWED_REDIRECT_URIS` env var
- [ ] Implement `validateRedirectUri()` function
- [ ] Add state nonce storage with Map
- [ ] Implement `generateState()` with HMAC
- [ ] Implement `verifyState()` with one-time use check
- [ ] Add state cleanup task (setInterval)
- [ ] Update JWT generation to include aud/iss
- [ ] Update JWT verification to check aud/iss
- [ ] Test: OAuth flow end-to-end

### 1.3 Secrets Management
- [ ] Add `JWT_SECRET` check in remote-server.ts
- [ ] Add `STATE_SECRET` check in remote-server.ts
- [ ] Throw error in production if missing
- [ ] Add secrets to .env.example
- [ ] Update README with secret generation instructions
- [ ] Test: Start server in production mode

**Gate**: All CRITICAL tests pass, OAuth secure

---

## 🔥 Phase 2: HIGH Priority

### 2.1 Session Storage
- [ ] `npm install ioredis @types/ioredis`
- [ ] Create `src/storage/session-store.ts`
- [ ] Implement `InMemorySessionStore` with TTL
- [ ] Implement `RedisSessionStore`
- [ ] Create `SessionManager` with limits
- [ ] Replace Maps in oauth-provider.ts
- [ ] Replace Maps in http-server.ts
- [ ] Replace Maps in remote-server.ts
- [ ] Add cleanup tasks
- [ ] Test: Memory stays bounded under load

### 2.2 Type Safety
- [ ] Define `ToolHandler` and `ToolDefinition` types
- [ ] Remove `as any` from registration.ts (line 157)
- [ ] Create explicit schema for analysis details
- [ ] Create explicit schema for filter criteria
- [ ] Create explicit schema for error details
- [ ] Fix pivot refresh type (line 279)
- [ ] Test: `npm run build` with no type errors

**Gate**: All type-safety tests pass, no `any` or `unknown`

---

## ⚙️ Phase 3: MEDIUM Priority

### 3.1 TypeScript Strict
- [ ] Enable `exactOptionalPropertyTypes` in tsconfig.json
- [ ] Add `skipLibCheck: true`
- [ ] Create `googleapis-overrides.ts` if needed
- [ ] Test: `npm run build`

### 3.2 Express Alignment
- [ ] Choose: Upgrade to Express 5 or downgrade types
- [ ] If Express 5: `npm install express@^5.2.1`
- [ ] Update error handling for Express 5
- [ ] Test: HTTP server starts and responds

### 3.3 Node Standardization
- [ ] Update engines in package.json to `>=22.0.0`
- [ ] Update ci.yml to test Node 22 and 24
- [ ] Update Dockerfile to Node 22
- [ ] `npm install -D @types/node@^22.10.0`
- [ ] Create .nvmrc with `22`
- [ ] Test: CI passes

**Gate**: All configs aligned, builds pass

---

## 📦 Phase 4: Dependencies

### One-by-one upgrades (with testing):
- [ ] `npm install -D vitest@^4.0.16 @vitest/coverage-v8@^4.0.16` → test
- [ ] `npm install zod@^4.3.4` → update schemas → test
- [ ] `npm install express@^5.2.1` → test HTTP server
- [ ] `npm install express-rate-limit@^8.2.1` → update config → test
- [ ] `npm install googleapis@^169.0.0` → test Sheets API
- [ ] `npm install p-queue@^9.0.1` → test
- [ ] `npm install uuid@^13.0.0` → remove @types/uuid → test

**Gate**: All tests pass after each upgrade

---

## 🎯 Phase 5: Node/TS Modernization

- [ ] Verify ESM consistency (should already be good)
- [ ] Clean build: `npm run build:clean && npm run build`
- [ ] Test all entry points: cli.js, server.js, http-server.js
- [ ] Add `verify:build` script to package.json

**Gate**: Build is clean and correct

---

## 🔒 Phase 6: MCP Compliance

- [ ] Replace all `z.unknown()` in schemas (done in Phase 2.2)
- [ ] Fix or remove stubbed pivot action (pivot.ts line 311)
- [ ] Add structured error format to HTTP server
- [ ] Create `ToolContext` interface with cancellation
- [ ] Wire cancellation in server
- [ ] Update tool handlers to check `ctx.throwIfCancelled()`
- [ ] Test: Cancellation works

**Gate**: MCP compliance tests pass

---

## 🧪 Phase 7: Testing & CI

- [ ] Create `eslint.config.js`
- [ ] Update CI to make security audit blocking
- [ ] Write HTTP transport integration tests
- [ ] Write OAuth flow integration tests
- [ ] Write cancellation integration tests
- [ ] Run all tests: `npm run test:all`
- [ ] Check coverage: `npm run test:coverage`

**Gate**: Coverage >80%, all tests pass

---

## 📊 Phase 8: Final Validation

- [ ] Run production readiness checklist (see PRODUCTION_READINESS_PLAN.md)
- [ ] Update README.md with new env vars
- [ ] Update CHANGELOG.md
- [ ] Create migration guide if needed
- [ ] Update deployment docs
- [ ] Tag release: `v2.0.0`

**Gate**: All checklists complete, ready to deploy

---

## 🏁 Final Commands

Before declaring production ready, run:

```bash
# Clean everything
npm run build:clean
rm -rf node_modules package-lock.json
npm install

# Build
npm run build

# Lint
npm run lint

# Test everything
npm test
npm run test:integration
npm run test:coverage

# Security audit
npm audit --production

# Verify build
npm run verify:build

# Start servers (manual smoke test)
NODE_ENV=production npm start
NODE_ENV=production npm run start:http
```

All should pass with no errors.

---

## 📈 Progress Tracking

Use this to track overall progress:

- [ ] Phase 1: CRITICAL (3 items) - **BLOCKING**
- [ ] Phase 2: HIGH (2 items) - **IMPORTANT**
- [ ] Phase 3: MEDIUM (3 items) - **ALIGNMENT**
- [ ] Phase 4: Dependencies (7 items) - **UPDATES**
- [ ] Phase 5: Modernization (1 item) - **POLISH**
- [ ] Phase 6: MCP Compliance (6 items) - **STANDARD**
- [ ] Phase 7: Testing (6 items) - **COVERAGE**
- [ ] Phase 8: Final (5 items) - **DOCUMENTATION**

**Total Items**: 33
**Completed**: 0
**Progress**: 0%

---

## ⏱️ Time Tracking

| Phase | Estimated | Actual | Status |
|-------|-----------|--------|--------|
| Phase 1 | 11-16h | - | ⬜ |
| Phase 2 | 18-22h | - | ⬜ |
| Phase 3 | 6-9h | - | ⬜ |
| Phase 4 | 6-8h | - | ⬜ |
| Phase 5 | 1-2h | - | ⬜ |
| Phase 6 | 3-5h | - | ⬜ |
| Phase 7 | 6-8h | - | ⬜ |
| Phase 8 | 2-3h | - | ⬜ |
| **Total** | **53-73h** | - | ⬜ |

---

## 🚦 Status Legend

- ⬜ Not Started
- 🟡 In Progress
- ✅ Complete
- ❌ Blocked
- ⏭️ Skipped

---

**Last Updated**: 2025-01-03
**Current Phase**: Not Started
**Blocker**: None
**Next Action**: Review plan and start Phase 1.1
