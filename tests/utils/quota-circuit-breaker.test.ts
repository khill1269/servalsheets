import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QuotaCircuitBreaker, CircuitBreakerError } from '../../src/utils/circuit-breaker.js';

function make429(): Error {
  return Object.assign(new Error('Too Many Requests'), { response: { status: 429 } });
}

describe('QuotaCircuitBreaker', () => {
  let breaker: QuotaCircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new QuotaCircuitBreaker(
      { failureThreshold: 6, successThreshold: 1, timeout: 1000, name: 'test-quota' },
      { quotaThreshold: 3, quotaBlockMs: 2000 }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor defaults', () => {
    it('quotaThreshold defaults to ceil(failureThreshold / 2)', () => {
      const b = new QuotaCircuitBreaker({ failureThreshold: 5, timeout: 500, name: 'default-test' });
      const op = vi.fn().mockRejectedValue(make429());
      const tryExec = async () => { try { await b.execute(op); } catch {} };

      // 3 = ceil(5/2) should trip the gate
      return (async () => {
        await tryExec();
        await tryExec();
        expect(b.isOpen()).toBe(false);
        await tryExec();
        expect(b.isOpen()).toBe(true);
      })();
    });

    it('quotaBlockMs defaults to timeout * 2', async () => {
      const b = new QuotaCircuitBreaker({ failureThreshold: 2, timeout: 500, name: 'block-test' }, { quotaThreshold: 1 });
      const op = vi.fn().mockRejectedValue(make429());
      try { await b.execute(op); } catch {}

      expect(b.isOpen()).toBe(true);
      vi.advanceTimersByTime(999);
      expect(b.isOpen()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(b.isOpen()).toBe(false);
    });
  });

  describe('execute() — success path', () => {
    it('resets quota counter on success after partial 429s', async () => {
      const op429 = vi.fn().mockRejectedValue(make429());
      const opOk = vi.fn().mockResolvedValue('ok');

      try { await breaker.execute(op429); } catch {}
      try { await breaker.execute(op429); } catch {}
      await breaker.execute(opOk);

      // Counter reset — need 3 more to trip, not 1
      try { await breaker.execute(op429); } catch {}
      expect(breaker.isOpen()).toBe(false);
    });
  });

  describe('execute() — 429 path', () => {
    it('opens quota gate after quotaThreshold consecutive 429s', async () => {
      const op = vi.fn().mockRejectedValue(make429());

      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(op); } catch {}
      }
      expect(breaker.isOpen()).toBe(true);
    });

    it('throws CircuitBreakerError when quota gate is open', async () => {
      const op = vi.fn().mockRejectedValue(make429());
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(op); } catch {}
      }

      await expect(breaker.execute(vi.fn())).rejects.toThrow(CircuitBreakerError);
      await expect(breaker.execute(vi.fn())).rejects.toThrow(/quota/i);
    });

    it('quota gate expires after quotaBlockMs', async () => {
      const op429 = vi.fn().mockRejectedValue(make429());
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(op429); } catch {}
      }
      expect(breaker.isOpen()).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(breaker.isOpen()).toBe(false);

      const opOk = vi.fn().mockResolvedValue('recovered');
      const result = await breaker.execute(opOk);
      expect(result).toBe('recovered');
    });

    it('non-429 error resets quota counter', async () => {
      const op429 = vi.fn().mockRejectedValue(make429());
      const opOther = vi.fn().mockRejectedValue(new Error('Server Error'));

      try { await breaker.execute(op429); } catch {}
      try { await breaker.execute(op429); } catch {}
      try { await breaker.execute(opOther); } catch {}

      // Counter reset — need 3 more 429s from scratch
      try { await breaker.execute(op429); } catch {}
      try { await breaker.execute(op429); } catch {}
      expect(breaker.isOpen()).toBe(false);
    });
  });

  describe('isOpen()', () => {
    it('returns false initially', () => {
      expect(breaker.isOpen()).toBe(false);
    });

    it('returns true when quota-blocked', async () => {
      const op = vi.fn().mockRejectedValue(make429());
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(op); } catch {}
      }
      expect(breaker.isOpen()).toBe(true);
    });

    it('returns false after quota block expires', async () => {
      const op = vi.fn().mockRejectedValue(make429());
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(op); } catch {}
      }
      vi.advanceTimersByTime(2000);
      expect(breaker.isOpen()).toBe(false);
    });
  });

  describe('reset()', () => {
    it('clears quota state and allows calls again', async () => {
      const op = vi.fn().mockRejectedValue(make429());
      for (let i = 0; i < 3; i++) {
        try { await breaker.execute(op); } catch {}
      }
      expect(breaker.isOpen()).toBe(true);

      breaker.reset();
      expect(breaker.isOpen()).toBe(false);

      const opOk = vi.fn().mockResolvedValue('after-reset');
      const result = await breaker.execute(opOk);
      expect(result).toBe('after-reset');
    });
  });

  describe('delegation', () => {
    it('getState() delegates to inner breaker', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('getStats() delegates to inner breaker', () => {
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(typeof stats.fallbackUsageCount).toBe('number');
    });

    it('registerFallback() delegates to inner breaker', () => {
      expect(() => {
        breaker.registerFallback({
          name: 'test-fallback',
          priority: 10,
          execute: async () => 'fallback',
          shouldUse: () => true,
        });
      }).not.toThrow();
    });
  });
});
