import { describe, expect, it, vi } from 'vitest';

import { createHandlerRuntimeBridge } from '../../../packages/mcp-runtime/src/index.js';

describe('@serval/mcp-runtime handler runtime bridge', () => {
  it('builds the shared handler MCP bridge and cost tracker fields', () => {
    const server = { name: 'bridge-server' };
    const samplingServer = { name: 'sampling-server' };
    const costTracker = { name: 'cost-tracker' };
    const createSamplingServer = vi.fn(() => samplingServer);
    const getCostTracker = vi.fn(() => costTracker);

    const result = createHandlerRuntimeBridge({
      server,
      createSamplingServer,
      costTrackingEnabled: true,
      getCostTracker,
    });

    expect(createSamplingServer).toHaveBeenCalledWith(server);
    expect(getCostTracker).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      costTracker,
      samplingServer,
      elicitationServer: server,
      server,
    });
  });

  it('omits the cost tracker when cost tracking is disabled', () => {
    const createSamplingServer = vi.fn((server: { id: string }) => ({ samplingFor: server.id }));
    const getCostTracker = vi.fn();

    const result = createHandlerRuntimeBridge({
      server: { id: 'server-1' },
      createSamplingServer,
      costTrackingEnabled: false,
      getCostTracker,
    });

    expect(getCostTracker).not.toHaveBeenCalled();
    expect(result.costTracker).toBeUndefined();
    expect(result.samplingServer).toEqual({ samplingFor: 'server-1' });
  });
});
