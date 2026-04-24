/**
 * Sampling Health Probe
 *
 * AUDIT-2026-04-23 (Root C partial, artifact bugs #12, #13, #14): the server
 * advertises `sampling.available: true` in `auth.status` based on the
 * presence of an LLM API key environment variable. That's config presence,
 * not capability — if the key is revoked, the endpoint is down, or the
 * request we generate is malformed (e.g. missing max_tokens), every
 * sampling-backed analyze action returns `INTERNAL_ERROR 400` even though
 * auth.status reported the capability as available.
 *
 * This module:
 *   1. Issues a tiny throwaway probe to the configured LLM backend on demand
 *   2. Caches the result for `PROBE_TTL_MS` to avoid hammering the provider
 *   3. Tracks consecutive failures — flips `healthy: false` with reason
 *      after `FAILURE_THRESHOLD` consecutive failures (circuit breaker)
 *   4. Exposes `getSamplingHealth()` for `auth.status` + analyze handlers
 *
 * Callers that want the MCP-client-hosted sampling path (not server-side
 * LLM fallback) probe separately via the caller-hosted capability check;
 * this module only tells you whether the SERVER-SIDE fallback works.
 */

import { logger } from '../utils/logger.js';
import { getLLMFallbackConfig, isLLMFallbackAvailable } from './llm-fallback.js';

export type SamplingHealthReason =
  | 'healthy'
  | 'config:missing_api_key' // No *_API_KEY configured at all
  | 'config:disabled' // ENABLE_SAMPLING=false
  | 'probe:failed' // Probe call returned non-2xx
  | 'probe:exception' // Probe call threw (network, DNS, etc.)
  | 'probe:never_run' // Hot path asked before any probe completed
  | 'circuit_open'; // Too many consecutive failures recently

export interface SamplingHealth {
  healthy: boolean;
  reason: SamplingHealthReason;
  /** Provider the probe exercised (if any). */
  provider?: string;
  /** Epoch ms of the most recent probe attempt. */
  lastProbedAt?: number;
  /** How many consecutive failures since the last success. */
  consecutiveFailures: number;
  /** Epoch ms when the cached result expires. */
  cachedUntil?: number;
}

// Exposed for tests
export const PROBE_TTL_MS = 5 * 60 * 1000; // 5 minutes — long enough to avoid probe storms
export const FAILURE_THRESHOLD = 3; // Flip to circuit_open after 3 consecutive fails
export const PROBE_TIMEOUT_MS = 6_000; // Probe itself times out at 6s

let cache: SamplingHealth | null = null;
let inflight: Promise<SamplingHealth> | null = null;

function cacheFresh(entry: SamplingHealth | null): entry is SamplingHealth {
  return entry !== null && typeof entry.cachedUntil === 'number' && entry.cachedUntil > Date.now();
}

/**
 * Issue a 1-shot minimal probe to the configured LLM provider.
 *
 * Intentionally sends the smallest valid request the provider will
 * accept so we're measuring reachability + auth, not model quality.
 */
async function probeOnce(): Promise<SamplingHealth> {
  // Env flag (defaults on). If false → respect the operator's decision.
  if ((process.env['ENABLE_SAMPLING'] ?? 'true').toLowerCase() === 'false') {
    return {
      healthy: false,
      reason: 'config:disabled',
      consecutiveFailures: 0,
    };
  }

  if (!isLLMFallbackAvailable()) {
    return {
      healthy: false,
      reason: 'config:missing_api_key',
      consecutiveFailures: 0,
    };
  }

  const config = getLLMFallbackConfig();
  if (!config) {
    // Defensive: isLLMFallbackAvailable returned true but config is null.
    return {
      healthy: false,
      reason: 'config:missing_api_key',
      consecutiveFailures: 0,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let url: string;
    let body: string;

    switch (config.provider) {
      case 'anthropic':
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        url = `${config.baseUrl}/v1/messages`;
        // Smallest valid Anthropic request — 1 token, 1 user message.
        body = JSON.stringify({
          model: config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        });
        break;
      case 'openai':
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        url = `${config.baseUrl}/v1/chat/completions`;
        body = JSON.stringify({
          model: config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        });
        break;
      case 'google':
        url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        body = JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 1 },
        });
        break;
      default: {
        const _exhaustive: never = config.provider;
        return {
          healthy: false,
          reason: 'probe:failed',
          provider: String(_exhaustive),
          consecutiveFailures: 0,
        };
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const snippet = (await response.text()).slice(0, 200);
      logger.warn('Sampling health probe failed', {
        provider: config.provider,
        status: response.status,
        snippet,
      });
      return {
        healthy: false,
        reason: 'probe:failed',
        provider: config.provider,
        consecutiveFailures: 0, // caller will increment
      };
    }

    // 2xx — provider is reachable and the request shape is valid.
    return {
      healthy: true,
      reason: 'healthy',
      provider: config.provider,
      consecutiveFailures: 0,
    };
  } catch (err) {
    logger.warn('Sampling health probe exception', {
      provider: config.provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      healthy: false,
      reason: 'probe:exception',
      provider: config.provider,
      consecutiveFailures: 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get the cached sampling-health state, probing if the cache is stale.
 *
 * Safe to call from hot paths — deduplicates concurrent probes.
 */
export async function getSamplingHealth(): Promise<SamplingHealth> {
  if (cacheFresh(cache)) return cache;
  if (inflight) return inflight;

  const cacheSnapshot = cache as SamplingHealth | null;
  inflight = (async () => {
    const fresh = await probeOnce();
    const prevFailures = cacheSnapshot?.consecutiveFailures ?? 0;
    const consecutiveFailures = fresh.healthy ? 0 : prevFailures + 1;

    let result: SamplingHealth = {
      ...fresh,
      consecutiveFailures,
      lastProbedAt: Date.now(),
      cachedUntil: Date.now() + PROBE_TTL_MS,
    };

    // Circuit breaker: if we've been failing for a while, advertise
    // circuit_open so the caller sees a stable explanation instead of a
    // transient reason on every refresh.
    if (!fresh.healthy && consecutiveFailures >= FAILURE_THRESHOLD) {
      result = { ...result, reason: 'circuit_open' };
    }

    cache = result;
    return result;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Synchronous accessor for the most recent probe result.
 *
 * Useful for tight loops where waiting on a network round-trip is
 * unacceptable. Returns `reason: 'probe:never_run'` if no probe has
 * completed yet; callers should either await `getSamplingHealth()`
 * first or treat this as degraded.
 */
export function getSamplingHealthSync(): SamplingHealth {
  if (cache) return cache;
  return {
    healthy: false,
    reason: 'probe:never_run',
    consecutiveFailures: 0,
  };
}

/**
 * Test/reset hook — exported for unit tests and for SIGHUP-style config
 * reloads. Do not call from production code paths.
 */
export function __resetSamplingHealthForTesting(): void {
  cache = null;
  inflight = null;
}
