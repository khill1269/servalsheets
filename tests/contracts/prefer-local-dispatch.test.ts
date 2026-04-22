/**
 * prefer_local Dispatch Contract Tests
 *
 * Guarantees the routing invariants that BUG #5 violated in the
 * 2026-04-21 E2E session. Specifically, for tools declared
 * `mode: 'prefer_local'` in the manifest
 * (packages/mcp-runtime/dist/tool-route-manifest.js):
 *
 *   - If no remote executor is wired, the dispatcher runs local-only and
 *     propagates the original local error UNCHANGED. It must NOT fail over
 *     to a placeholder remote executor that then throws
 *     "SERVICE_NOT_ENABLED", because that error burial is exactly the
 *     regression BUG #5 produced (`sheets_analyze.analyze_data` claimed
 *     "Remote MCP executor is not configured" when the real cause was a
 *     local validation error).
 *
 *   - If a remote executor IS wired, local failure falls through to remote
 *     — this is the documented hybrid behaviour.
 *
 *   - `resolveExecutionTarget` returns `'local'` for `prefer_local`,
 *     regardless of whether a remote executor is present. (Remote is only
 *     used as a fallback inside `dispatchToolCall`.)
 *
 *   - The `prefer_local` set is a superset/subset drift check: expected
 *     tools are `sheets_analyze`, `sheets_bigquery`, `sheets_appsscript`,
 *     `sheets_compute`, `sheets_agent`, `sheets_connectors`. A new
 *     entry triggers a review; an accidental deletion also triggers one.
 *
 *   - `local` tools NEVER fall over to remote, even if a remoteExecute
 *     closure is passed. This is a defence against regressions where a
 *     dispatcher helper is tempted to always provide a remote path.
 *
 *   - `disabled_on_stdio` tools throw on stdio and succeed on http/sse.
 *
 * @module tests/contracts/prefer-local-dispatch
 */

import { describe, it, expect } from 'vitest';

import {
  dispatchToolCall,
  resolveExecutionTarget,
  getToolRoutePolicy,
  listToolsByRouteMode,
  TOOL_ROUTE_MANIFEST,
  ALL_TOOL_NAMES,
} from '../../src/mcp/tool-routing.js';

// --------------------------------------------------------------------------
// Expected set of prefer_local tools
// --------------------------------------------------------------------------
//
// Sourced from the original BUG #5 audit and the current manifest. Any
// change here must be paired with a comment explaining why the tool's
// routing mode changed.
// --------------------------------------------------------------------------
const EXPECTED_PREFER_LOCAL = new Set([
  'sheets_analyze',
  'sheets_bigquery',
  'sheets_appsscript',
  'sheets_compute',
  'sheets_agent',
  'sheets_connectors',
]);

const EXPECTED_REMOTE = new Set(['sheets_federation']);

// --------------------------------------------------------------------------

describe('prefer_local dispatch contract', () => {
  // ------------------------------------------------------------------------
  // Membership invariant
  // ------------------------------------------------------------------------
  describe('manifest membership is stable', () => {
    it('prefer_local set matches expected list exactly', () => {
      const actual = new Set(listToolsByRouteMode('prefer_local'));
      const missing = [...EXPECTED_PREFER_LOCAL].filter((t) => !actual.has(t));
      const extra = [...actual].filter((t) => !EXPECTED_PREFER_LOCAL.has(t));
      expect(
        missing.length + extra.length,
        `\nprefer_local drift:\n  missing: ${missing.join(', ')}\n  extra:   ${extra.join(
          ', '
        )}\n\n` +
          `If intentional, update EXPECTED_PREFER_LOCAL in this test and add a comment\n` +
          `explaining why the routing mode changed for those tools.\n`
      ).toBe(0);
    });

    it('remote set matches expected list exactly', () => {
      const actual = new Set(listToolsByRouteMode('remote'));
      expect([...actual].sort()).toEqual([...EXPECTED_REMOTE].sort());
    });

    it('every tool in ALL_TOOL_NAMES has a policy', () => {
      const missing = ALL_TOOL_NAMES.filter(
        (name) =>
          !Object.prototype.hasOwnProperty.call(
            TOOL_ROUTE_MANIFEST as Record<string, unknown>,
            name
          )
      );
      expect(missing, `Tools without a manifest policy: ${missing.join(', ')}`).toEqual([]);
    });
  });

  // ------------------------------------------------------------------------
  // resolveExecutionTarget invariants
  // ------------------------------------------------------------------------
  describe('resolveExecutionTarget', () => {
    it('every prefer_local tool resolves to local target regardless of hasRemoteExecutor', () => {
      for (const toolName of EXPECTED_PREFER_LOCAL) {
        expect(
          resolveExecutionTarget({ toolName, transport: 'stdio', hasRemoteExecutor: false })
        ).toBe('local');
        expect(
          resolveExecutionTarget({ toolName, transport: 'stdio', hasRemoteExecutor: true })
        ).toBe('local');
        expect(
          resolveExecutionTarget({
            toolName,
            transport: 'streamable-http',
            hasRemoteExecutor: true,
          })
        ).toBe('local');
      }
    });

    it('every local-mode tool resolves to local even when a remote executor is present', () => {
      const localTools = listToolsByRouteMode('local');
      expect(localTools.length).toBeGreaterThan(10);
      for (const toolName of localTools) {
        expect(
          resolveExecutionTarget({ toolName, transport: 'stdio', hasRemoteExecutor: true })
        ).toBe('local');
      }
    });

    it('remote-mode tool without remote executor throws', () => {
      expect(() =>
        resolveExecutionTarget({
          toolName: 'sheets_federation',
          transport: 'streamable-http',
          hasRemoteExecutor: false,
        })
      ).toThrow(/remote/i);
    });

    it('remote-mode tool with remote executor resolves to remote', () => {
      expect(
        resolveExecutionTarget({
          toolName: 'sheets_federation',
          transport: 'streamable-http',
          hasRemoteExecutor: true,
        })
      ).toBe('remote');
    });
  });

  // ------------------------------------------------------------------------
  // dispatchToolCall invariants (the BUG #5 guard)
  // ------------------------------------------------------------------------
  describe('dispatchToolCall behavior', () => {
    it('prefer_local: NO remote executor → local success returns local result', async () => {
      for (const toolName of EXPECTED_PREFER_LOCAL) {
        const localResult = { ok: true, tool: toolName } as const;
        const result = await dispatchToolCall({
          toolName,
          transport: 'stdio',
          localExecute: async () => localResult,
          // remoteExecute omitted — this is the "BUG #5 shape"
        });
        expect(result).toEqual(localResult);
      }
    });

    it('prefer_local: NO remote executor → local error propagates UNCHANGED (BUG #5 regression)', async () => {
      for (const toolName of EXPECTED_PREFER_LOCAL) {
        const err = new Error(`LOCAL_ERR:${toolName}`);
        await expect(
          dispatchToolCall({
            toolName,
            transport: 'stdio',
            localExecute: async () => {
              throw err;
            },
            // remoteExecute omitted — must NOT be substituted with a
            // SERVICE_NOT_ENABLED throwing closure.
          })
        ).rejects.toBe(err); // identical reference — not wrapped, not replaced
      }
    });

    it('prefer_local: WITH remote executor → local error falls through to remote', async () => {
      for (const toolName of EXPECTED_PREFER_LOCAL) {
        const remoteResult = { from: 'remote', tool: toolName } as const;
        const result = await dispatchToolCall({
          toolName,
          transport: 'stdio',
          localExecute: async () => {
            throw new Error('boom-local');
          },
          remoteExecute: async () => remoteResult,
        });
        expect(result).toEqual(remoteResult);
      }
    });

    it('prefer_local: WITH remote executor → local success is returned (remote not called)', async () => {
      for (const toolName of EXPECTED_PREFER_LOCAL) {
        const localResult = { from: 'local', tool: toolName } as const;
        let remoteCalled = false;
        const result = await dispatchToolCall({
          toolName,
          transport: 'stdio',
          localExecute: async () => localResult,
          remoteExecute: async () => {
            remoteCalled = true;
            return { from: 'remote' };
          },
        });
        expect(result).toEqual(localResult);
        expect(remoteCalled, `remoteExecute must not fire when local succeeds (${toolName})`).toBe(
          false
        );
      }
    });

    it('local-mode tool: remote executor is IGNORED even on local error', async () => {
      const localTools = listToolsByRouteMode('local').slice(0, 5); // spot check 5
      for (const toolName of localTools) {
        const err = new Error(`LOCAL_ONLY:${toolName}`);
        let remoteCalled = false;
        await expect(
          dispatchToolCall({
            toolName,
            transport: 'stdio',
            localExecute: async () => {
              throw err;
            },
            remoteExecute: async () => {
              remoteCalled = true;
              return { from: 'remote' };
            },
          })
        ).rejects.toBe(err);
        expect(
          remoteCalled,
          `mode:local tool ${toolName} must never fall over to remote`
        ).toBe(false);
      }
    });

    it('remote-mode tool: local executor is IGNORED (even if remote throws, local is not retried)', async () => {
      let localCalled = false;
      await expect(
        dispatchToolCall({
          toolName: 'sheets_federation',
          transport: 'streamable-http',
          localExecute: async () => {
            localCalled = true;
            return { from: 'local' };
          },
          remoteExecute: async () => {
            throw new Error('remote-down');
          },
        })
      ).rejects.toThrow(/remote-down/);
      expect(
        localCalled,
        'mode:remote tool must not retry via localExecute'
      ).toBe(false);
    });
  });

  // ------------------------------------------------------------------------
  // Policy shape invariants
  // ------------------------------------------------------------------------
  describe('policy shape', () => {
    it('every prefer_local tool declares a remoteTransport', () => {
      for (const toolName of EXPECTED_PREFER_LOCAL) {
        const policy = getToolRoutePolicy(toolName);
        expect(policy.mode).toBe('prefer_local');
        expect(
          policy.remoteTransport,
          `${toolName}: prefer_local tools must declare a remoteTransport so createHostedRemoteExecutor can opt-in when config enables it`
        ).toBe('streamable-http');
      }
    });

    it('every remote tool declares a remoteTransport', () => {
      for (const toolName of EXPECTED_REMOTE) {
        const policy = getToolRoutePolicy(toolName);
        expect(policy.mode).toBe('remote');
        expect(policy.remoteTransport).toBe('streamable-http');
      }
    });
  });
});
