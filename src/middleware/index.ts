/**
 * ServalSheets - Middleware Index
 *
 * Middleware components for request processing, security, and compliance.
 */

// Redaction middleware
export * from './redaction.js';

// Idempotency middleware
export * from './idempotency-middleware.js';

// Tenant isolation middleware
export * from './tenant-isolation.js';

// RBAC middleware
export * from './rbac-middleware.js';

// Audit middleware — imported directly by tool-handlers.ts (not via barrel) due to init-time deps;
// exported here so new routes can import from the barrel without accidentally omitting audit logging.
export * from './audit-middleware.js';

// Re-export write-lock without the conflicting MUTATION_ACTIONS name (audit-middleware is canonical)
export {
  FORCE_WRITE_ACTIONS,
  isLikelyMutationAction,
  getWriteLock,
  isMutationAction,
  extractWriteLockParams,
  withWriteLock,
  cleanupIdleLocks,
  getWriteLockStats,
} from './write-lock-middleware.js';

// Mutation safety — formula injection scanner applied to all mutation payloads
export * from './mutation-safety-middleware.js';

// Rate limit — token-bucket per-principal limiter
export * from './rate-limit-middleware.js';

// Schema version — API version negotiation
export * from './schema-version.js';
