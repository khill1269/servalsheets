import { describe, expect, it } from 'vitest';

import { TaskStoreAdapter } from '../../src/core/index.js';
import { buildServerStdioInfrastructure } from '../../src/server/build-server-stdio-infrastructure.js';

describe('buildServerStdioInfrastructure', () => {
  it('reuses a provided task store and creates runtime infrastructure', () => {
    const taskStore = new TaskStoreAdapter();

    const infrastructure = buildServerStdioInfrastructure({
      options: {
        name: 'servalsheets-test',
        version: '1.2.3',
        taskStore,
      },
      packageVersion: '9.9.9',
    });

    expect(infrastructure.taskStore).toBe(taskStore);
    expect(infrastructure.server).toBeDefined();
    expect(infrastructure.requestQueue).toBeDefined();
    expect(infrastructure.connectionHealthCheck).toBeDefined();
    expect(infrastructure.healthMonitor).toBeDefined();
  });

  it('creates a default task store when one is not provided', () => {
    const infrastructure = buildServerStdioInfrastructure({
      options: {},
      packageVersion: '9.9.9',
    });

    expect(infrastructure.taskStore).toBeInstanceOf(TaskStoreAdapter);
  });
});
