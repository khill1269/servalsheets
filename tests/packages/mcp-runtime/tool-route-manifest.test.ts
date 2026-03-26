import { describe, expect, it, vi } from 'vitest';

import {
  ALL_TOOL_NAMES,
  createMcpRuntime,
  dispatchToolCall,
  getToolRoutePolicy,
  getToolRoutingSummary,
  getTransportVisibleToolNames,
  listToolsByRouteMode,
  resolveExecutionTarget,
  validateToolRouteManifest,
} from '../../../packages/mcp-runtime/src/index.js';
import { TOOL_DEFINITIONS } from '../../../src/mcp/registration/tool-definitions.js';

describe('@serval/mcp-runtime tool route manifest', () => {
  it('covers every tool in TOOL_DEFINITIONS without drift', () => {
    const toolNames = TOOL_DEFINITIONS.map((tool) => tool.name);
    const validation = validateToolRouteManifest(toolNames);

    expect(validation.valid).toBe(true);
    expect(validation.missingToolNames).toEqual([]);
    expect(validation.extraToolNames).toEqual([]);
    expect(ALL_TOOL_NAMES).toHaveLength(TOOL_DEFINITIONS.length);
  });

  it('provides a reason for every tool route', () => {
    for (const toolName of ALL_TOOL_NAMES) {
      const policy = getToolRoutePolicy(toolName);
      expect(policy.reason.length).toBeGreaterThan(20);
    }
  });

  it('summarizes the current routing split', () => {
    const summary = getToolRoutingSummary();

    expect(summary.totalToolCount).toBe(ALL_TOOL_NAMES.length);
    expect(summary.localCount).toBeGreaterThan(0);
    expect(summary.remoteCount).toBeGreaterThan(0);
    expect(summary.preferLocalCount).toBeGreaterThan(0);
    expect(summary.stdioExposedCount).toBe(ALL_TOOL_NAMES.length);
  });

  it('classifies known hybrid candidates consistently', () => {
    expect(listToolsByRouteMode('remote')).toContain('sheets_federation');
    expect(listToolsByRouteMode('prefer_local')).toContain('sheets_compute');
    expect(listToolsByRouteMode('prefer_local')).toContain('sheets_analyze');
    expect(listToolsByRouteMode('local')).toContain('sheets_auth');
    expect(getTransportVisibleToolNames('stdio')).toContain('sheets_session');
  });
});

describe('@serval/mcp-runtime dispatch helpers', () => {
  it('routes remote tools to the remote executor when required', async () => {
    const localExecute = vi.fn(async () => 'local');
    const remoteExecute = vi.fn(async () => 'remote');

    const target = resolveExecutionTarget({
      toolName: 'sheets_federation',
      transport: 'stdio',
      hasRemoteExecutor: true,
    });
    const result = await dispatchToolCall({
      toolName: 'sheets_federation',
      transport: 'stdio',
      localExecute,
      remoteExecute,
    });

    expect(target).toBe('remote');
    expect(result).toBe('remote');
    expect(localExecute).not.toHaveBeenCalled();
    expect(remoteExecute).toHaveBeenCalledTimes(1);
  });

  it('throws when a remote-only tool has no remote executor', () => {
    expect(() =>
      resolveExecutionTarget({
        toolName: 'sheets_federation',
        transport: 'stdio',
        hasRemoteExecutor: false,
      })
    ).toThrow(/marked remote/);
  });

  it('creates a runtime facade over the manifest helpers', async () => {
    const runtime = createMcpRuntime();

    expect(runtime.allToolNames).toEqual(ALL_TOOL_NAMES);
    expect(runtime.getToolRoutePolicy('sheets_connectors').mode).toBe('prefer_local');

    const result = await runtime.dispatchToolCall({
      toolName: 'sheets_core',
      transport: 'stdio',
      localExecute: async () => 'ok',
    });

    expect(result).toBe('ok');
  });

  it('falls back to the remote executor for prefer_local tools after a local failure', async () => {
    const localExecute = vi.fn(async () => {
      throw new Error('local failed');
    });
    const remoteExecute = vi.fn(async () => 'remote fallback');

    const result = await dispatchToolCall({
      toolName: 'sheets_compute',
      transport: 'streamable-http',
      localExecute,
      remoteExecute,
    });

    expect(result).toBe('remote fallback');
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(remoteExecute).toHaveBeenCalledTimes(1);
  });
});
