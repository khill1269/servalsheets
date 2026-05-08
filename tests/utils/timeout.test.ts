import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeoutError, withTimeout } from '../../src/utils/timeout.js';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to the default timeout when the requested timeout is invalid', async () => {
    vi.useFakeTimers();

    const result = withTimeout(
      () => new Promise<string>(() => undefined),
      Number.NaN,
      'invalid-timeout-test'
    );

    const assertion = expect(result).rejects.toMatchObject({
      name: 'TimeoutError',
      operationName: 'invalid-timeout-test',
      timeoutMs: 60000,
    } satisfies Partial<TimeoutError>);

    await vi.advanceTimersByTimeAsync(60000);
    await assertion;
  });
});
