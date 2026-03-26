import { describe, expect, it, vi } from 'vitest';

import { createAsyncOnce } from '../../../packages/mcp-runtime/src/index.js';

describe('@serval/mcp-runtime createAsyncOnce', () => {
  it('runs the task only once after success', async () => {
    const task = vi.fn(async () => {});
    const once = createAsyncOnce(task);

    await once.run();
    await once.run();
    await once.run();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight promise across concurrent callers', async () => {
    let resolveTask!: () => void;
    const task = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveTask = resolve;
        })
    );
    const once = createAsyncOnce(task);

    const first = once.run();
    const second = once.run();

    expect(task).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    resolveTask();
    await Promise.all([first, second]);
  });

  it('allows retries after failures', async () => {
    const task = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce();
    const once = createAsyncOnce(task);

    await expect(once.run()).rejects.toThrow('boom');
    await once.run();

    expect(task).toHaveBeenCalledTimes(2);
  });
});
