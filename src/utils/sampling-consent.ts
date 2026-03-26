/**
 * Sampling consent gate and timeout utilities.
 *
 * Extracted from src/mcp/sampling.ts so service/analysis layers can enforce
 * consent without importing from the MCP application layer.
 *
 * Depended on by: src/mcp/sampling.ts (re-exports), src/services/*, src/analysis/*
 */

import { createRequestAbortError, getRequestContext } from './request-context.js';
import { getEnv } from '../config/env.js';
import { ServiceError } from '../core/errors.js';

// ============================================================================
// ISSUE-117: GDPR consent gate for Sampling calls
// ============================================================================

/**
 * Optional consent checker registered at server startup.
 * Throws if consent is required but not granted.
 * When null (default), all sampling calls are allowed (backwards-compatible).
 */
let _consentChecker: (() => Promise<void>) | null = null;
const _consentCache = new Map<string, { expiresAt: number; errorMessage?: string }>();

/**
 * Register a GDPR consent check callback. Called before every createMessage().
 * Throw an Error with message 'GDPR_CONSENT_REQUIRED' to block the sampling call.
 *
 * @example
 * registerSamplingConsentChecker(async () => {
 *   const hasConsent = await profileManager.hasConsent(getCurrentUserId());
 *   if (!hasConsent) throw new Error('GDPR_CONSENT_REQUIRED: ...');
 * });
 */
export function registerSamplingConsentChecker(checker: () => Promise<void>): void {
  _consentChecker = checker;
}

function getConsentCacheKey(): string {
  const context = getRequestContext();
  return context?.principalId ?? context?.requestId ?? 'global';
}

function purgeExpiredConsentEntries(nowMs: number): void {
  for (const [key, entry] of _consentCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      _consentCache.delete(key);
    }
  }
}

export function clearSamplingConsentCache(): void {
  _consentCache.clear();
}

export async function assertSamplingConsent(): Promise<void> {
  if (!_consentChecker) {
    return;
  }

  const ttlMs = getEnv().SAMPLING_CONSENT_CACHE_TTL_MS;
  if (ttlMs <= 0) {
    await _consentChecker();
    return;
  }

  const nowMs = Date.now();
  purgeExpiredConsentEntries(nowMs);

  const cacheKey = getConsentCacheKey();
  const cached = _consentCache.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    if (cached.errorMessage) {
      throw new ServiceError(cached.errorMessage, 'INTERNAL_ERROR', 'sampling', false);
    }
    return;
  }

  try {
    await _consentChecker();
    _consentCache.set(cacheKey, { expiresAt: nowMs + ttlMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    _consentCache.set(cacheKey, { expiresAt: nowMs + ttlMs, errorMessage: message });
    throw error;
  }
}

// ============================================================================
// Timeout Wrapper (ISSUE-088)
// ============================================================================

export type SamplingOperation<T> = Promise<T> | (() => Promise<T>);

function getEffectiveSamplingTimeout(deadline: number | undefined): number {
  // Lazy read — avoids module-level getEnv() call that fails in test environments
  const timeoutMs = getEnv().SAMPLING_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return 30000;
  }
  if (!Number.isFinite(deadline)) {
    return timeoutMs;
  }
  return Math.min(timeoutMs, Math.max(0, (deadline as number) - Date.now()));
}

/**
 * Wrap a sampling request with a configurable timeout.
 * Respects the current request deadline so sampling never outlasts its parent request.
 * Rejects with a descriptive error if the request exceeds the effective timeout.
 */
export function withSamplingTimeout<T>(operation: SamplingOperation<T>): Promise<T> {
  // Use the remaining request deadline if available, capped at SAMPLING_TIMEOUT_MS
  const ctx = getRequestContext();
  const abortSignal = ctx?.abortSignal;
  const effectiveTimeout = getEffectiveSamplingTimeout(ctx?.deadline);
  const execute = typeof operation === 'function' ? operation : () => operation;

  if (abortSignal?.aborted) {
    return Promise.reject(
      createRequestAbortError(abortSignal.reason, 'Sampling request cancelled by client')
    );
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const cleanup = (): void => {
      if (timer) {
        clearTimeout(timer);
      }
      abortSignal?.removeEventListener('abort', onAbort);
    };
    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = (): void => {
      settle(() =>
        reject(createRequestAbortError(abortSignal?.reason, 'Sampling request cancelled by client'))
      );
    };

    abortSignal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      settle(() => reject(new Error(`Sampling request timed out after ${effectiveTimeout}ms`)));
    }, effectiveTimeout);

    Promise.resolve()
      .then(() => execute())
      .then(
        (value) => {
          settle(() => resolve(value));
        },
        (error: unknown) => {
          settle(() => reject(error));
        }
      );
  });
}
