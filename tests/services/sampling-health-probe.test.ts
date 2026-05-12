/**
 * Sampling Health Probe Tests
 *
 * Full coverage of probeOnce() paths and getSamplingHealth() caching/circuit-breaker logic.
 * Uses __resetSamplingHealthForTesting() for cache isolation between tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSamplingHealth,
  __resetSamplingHealthForTesting,
  PROBE_TTL_MS,
  FAILURE_THRESHOLD,
} from '../../src/services/sampling-health-probe.js';

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

function mockOkResponse(status = 200): void {
  fetchMock.mockResolvedValue({
    ok: true,
    status,
    text: async () => '{}',
  } as Response);
}

function mockFailResponse(status: number): void {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    text: async () => `error ${status}`,
  } as Response);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  __resetSamplingHealthForTesting();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getSamplingHealth()', () => {
  it('1. 2xx success — healthy with provider/model', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-123');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    mockOkResponse(200);

    const result = await getSamplingHealth();

    expect(result.healthy).toBe(true);
    expect(result.reason).toBe('healthy');
    expect(result.provider).toBe('anthropic');
    expect(typeof result.model).toBe('string');
    expect(result.model!.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('2. ENABLE_SAMPLING=false — disabled without fetch', async () => {
    vi.stubEnv('ENABLE_SAMPLING', 'false');
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-123');

    const result = await getSamplingHealth();

    expect(result.healthy).toBe(false);
    expect(result.reason).toBe('config:disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('3. No API key — config:missing_api_key without fetch', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', '');
    vi.stubEnv('LLM_API_KEY', '');

    const result = await getSamplingHealth();

    expect(result.healthy).toBe(false);
    expect(result.reason).toBe('config:missing_api_key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('4. HTTP 401 — probe:failed', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-123');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    mockFailResponse(401);

    const result = await getSamplingHealth();

    expect(result.healthy).toBe(false);
    expect(result.reason).toBe('probe:failed');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('5. HTTP 429 — probe:failed', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-123');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    mockFailResponse(429);

    const result = await getSamplingHealth();

    expect(result.healthy).toBe(false);
    expect(result.reason).toBe('probe:failed');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('6. Network exception — probe:exception', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-123');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await getSamplingHealth();

    expect(result.healthy).toBe(false);
    expect(result.reason).toBe('probe:exception');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('7. Circuit breaker — opens after FAILURE_THRESHOLD consecutive failures', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-123');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    mockFailResponse(500);

    // Drive FAILURE_THRESHOLD consecutive failures. Each call must re-probe
    // (cache expired), but the module must retain the consecutiveFailures
    // counter — so we must NOT call __resetSamplingHealthForTesting() here.
    //
    // Strategy: advance the fake clock by 2×PROBE_TTL_MS on each iteration
    // so the stored cachedUntil from the previous round is always in the past.
    // We need each successive fakeNow to exceed the PREVIOUS cachedUntil.
    // cachedUntil[i] = fakeNow[i] + PROBE_TTL_MS
    // So fakeNow[i+1] must be > fakeNow[i] + PROBE_TTL_MS
    // → step by 2×PROBE_TTL_MS each round.
    const realNow = Date.now();
    let last!: Awaited<ReturnType<typeof getSamplingHealth>>;

    for (let i = 0; i < FAILURE_THRESHOLD; i++) {
      const fakeNow = realNow + i * 2 * PROBE_TTL_MS;
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(fakeNow);
      try {
        last = await getSamplingHealth();
      } finally {
        dateSpy.mockRestore();
      }
    }

    // After FAILURE_THRESHOLD consecutive failures the reason must be circuit_open
    expect(last.healthy).toBe(false);
    expect(last.reason).toBe('circuit_open');
    expect(last.consecutiveFailures).toBeGreaterThanOrEqual(FAILURE_THRESHOLD);
  });

  it('8. Cache freshness — cachedUntil is within [now, now + PROBE_TTL_MS + 100]', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key-123');
    vi.stubEnv('LLM_PROVIDER', 'anthropic');
    mockOkResponse(200);

    const before = Date.now();
    const result = await getSamplingHealth();
    const after = Date.now();

    expect(result.cachedUntil).toBeDefined();
    expect(result.cachedUntil!).toBeGreaterThan(before);
    expect(result.cachedUntil!).toBeLessThanOrEqual(after + PROBE_TTL_MS + 100);
  });
});
