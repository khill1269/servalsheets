import { describe, expect, it, vi } from 'vitest';

import { buildServerStdioInfrastructure } from '../../../packages/mcp-stdio/src/build-server-stdio-infrastructure.js';

describe('@serval/mcp-stdio buildServerStdioInfrastructure', () => {
  it('reuses a provided task store and assembles runtime infrastructure', () => {
    const taskStore = { kind: 'task-store' };
    const afterServerCreated = vi.fn();
    const log = {
      info: vi.fn(),
    };

    const infrastructure = buildServerStdioInfrastructure({
      options: {
        name: 'servalsheets-test',
        version: '1.2.3',
        taskStore,
      },
      packageVersion: '9.9.9',
      createTaskStore: () => ({ kind: 'generated-task-store' }),
      createServer: ({ name, version, taskStore: serverTaskStore }) => ({
        name,
        version,
        taskStore: serverTaskStore,
      }),
      afterServerCreated,
      maxConcurrentRequests: 4,
      createConnectionHealthCheck: (input) => ({ kind: 'connection', input } as never),
      disconnectThresholdMs: 120000,
      warnThresholdMs: 60000,
      createHeapHealthCheck: (input) => ({ kind: 'heap', input }),
      heapWarningThreshold: 0.7,
      heapCriticalThreshold: 0.85,
      enableHeapSnapshots: true,
      heapSnapshotPath: '/tmp/heap-snapshots',
      createHealthMonitor: ({ checks, autoStart }) => ({ checks, autoStart }),
      healthMonitorAutoStart: false,
      log,
    });

    expect(infrastructure.taskStore).toBe(taskStore);
    expect(infrastructure.server).toMatchObject({
      name: 'servalsheets-test',
      version: '1.2.3',
      taskStore,
    });
    expect(infrastructure.requestQueue).toBeDefined();
    expect(infrastructure.connectionHealthCheck).toMatchObject({ kind: 'connection' });
    expect(infrastructure.healthMonitor).toMatchObject({
      autoStart: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ kind: 'heap' }),
        expect.objectContaining({ kind: 'connection' }),
      ]),
    });
    expect(afterServerCreated).toHaveBeenCalledOnce();
    expect(log.info).toHaveBeenCalledWith('Request queue initialized', {
      maxConcurrent: 4,
    });
  });

  it('creates a default task store when one is not provided', () => {
    const infrastructure = buildServerStdioInfrastructure({
      options: {},
      packageVersion: '9.9.9',
      createTaskStore: () => ({ kind: 'generated-task-store' }),
      createServer: ({ taskStore }) => ({ taskStore }),
      maxConcurrentRequests: 2,
      createConnectionHealthCheck: () => ({ kind: 'connection' }),
      disconnectThresholdMs: 120000,
      warnThresholdMs: 60000,
      createHeapHealthCheck: () => ({ kind: 'heap' }),
      heapWarningThreshold: 0.7,
      heapCriticalThreshold: 0.85,
      enableHeapSnapshots: false,
      heapSnapshotPath: './heap-snapshots',
      createHealthMonitor: ({ checks }) => ({ checks }),
      log: {
        info: vi.fn(),
      },
    });

    expect(infrastructure.taskStore).toEqual({ kind: 'generated-task-store' });
  });
});
