/**
 * Contract: every task created by InMemoryTaskStore.createTask() carries a
 * pollInterval > 0. Clients rely on this value to drive tasks/get polling
 * without having to guess a safe cadence.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  InMemoryTaskStore,
  DEFAULT_TASK_POLL_INTERVAL_MS,
} from '../../src/core/task-store.js';

describe('task polling contract', () => {
  let store: InMemoryTaskStore | undefined;

  afterEach(() => {
    store?.dispose();
    store = undefined;
  });

  it('createTask() sets pollInterval > 0', async () => {
    store = new InMemoryTaskStore();
    const task = await store.createTask({});
    expect(task.pollInterval).toBeDefined();
    expect(typeof task.pollInterval).toBe('number');
    expect(task.pollInterval as number).toBeGreaterThan(0);
  });

  it('createTask() uses the canonical DEFAULT_TASK_POLL_INTERVAL_MS', async () => {
    store = new InMemoryTaskStore();
    const task = await store.createTask({});
    expect(task.pollInterval).toBe(DEFAULT_TASK_POLL_INTERVAL_MS);
  });

  it('getTask() round-trips pollInterval', async () => {
    store = new InMemoryTaskStore();
    const created = await store.createTask({});
    const fetched = await store.getTask(created.taskId);
    expect(fetched?.pollInterval).toBe(created.pollInterval);
  });

  it('DEFAULT_TASK_POLL_INTERVAL_MS is a sensible default (between 500ms and 30s)', () => {
    // Bound the sanity range: faster than 500ms would hammer the server;
    // slower than 30s makes the UI feel stuck.
    expect(DEFAULT_TASK_POLL_INTERVAL_MS).toBeGreaterThanOrEqual(500);
    expect(DEFAULT_TASK_POLL_INTERVAL_MS).toBeLessThanOrEqual(30_000);
  });
});
