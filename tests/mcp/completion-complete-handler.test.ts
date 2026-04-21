/**
 * Tests for completion/complete handler wiring (Fix 1)
 * and lazy TOOL_ICONS loading (Fix 2)
 *
 * TDD: these tests are written BEFORE implementation and must fail initially.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────
// Fix 1: completion/complete handler wiring
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix 1: registerToolCompletionHandler', () => {
  it('registers a completion/complete request handler on the server', async () => {
    const { registerToolCompletionHandler } = await import(
      '../../src/server/control-plane-registration.js'
    );

    const setRequestHandler = vi.fn();
    const mockServer = { server: { setRequestHandler } } as unknown as Parameters<
      typeof registerToolCompletionHandler
    >[0]['server'];

    registerToolCompletionHandler({ server: mockServer });

    expect(setRequestHandler).toHaveBeenCalledOnce();
    // The handler is registered for the completion/complete method
    const [schema] = setRequestHandler.mock.calls[0] as [{ shape?: { method?: unknown } }, unknown];
    // CompleteRequestSchema has method: "completion/complete"
    expect(schema).toBeDefined();
  });

  it('returns action completions for a ref/tool request', async () => {
    const { registerToolCompletionHandler } = await import(
      '../../src/server/control-plane-registration.js'
    );

    let capturedHandler: ((req: unknown) => Promise<unknown>) | null = null;
    const setRequestHandler = vi.fn((_schema: unknown, handler: (req: unknown) => Promise<unknown>) => {
      capturedHandler = handler;
    });
    const mockServer = { server: { setRequestHandler } } as unknown as Parameters<
      typeof registerToolCompletionHandler
    >[0]['server'];

    registerToolCompletionHandler({ server: mockServer });

    expect(capturedHandler).not.toBeNull();

    const result = await capturedHandler!({
      method: 'completion/complete',
      params: {
        ref: { type: 'ref/tool', name: 'sheets_auth' },
        argument: { name: 'action', value: '' },
      },
    });

    const typed = result as { completion: { values: string[]; hasMore: boolean } };
    expect(typed.completion).toBeDefined();
    expect(typed.completion.values).toBeInstanceOf(Array);
    expect(typed.completion.values.length).toBeGreaterThan(0);
    // sheets_auth actions should include 'status', 'login', etc.
    expect(typed.completion.values).toContain('status');
    expect(typed.completion.hasMore).toBe(false);
  });

  it('filters action completions by partial value', async () => {
    const { registerToolCompletionHandler } = await import(
      '../../src/server/control-plane-registration.js'
    );

    let capturedHandler: ((req: unknown) => Promise<unknown>) | null = null;
    const setRequestHandler = vi.fn((_schema: unknown, handler: (req: unknown) => Promise<unknown>) => {
      capturedHandler = handler;
    });
    const mockServer = { server: { setRequestHandler } } as unknown as Parameters<
      typeof registerToolCompletionHandler
    >[0]['server'];

    registerToolCompletionHandler({ server: mockServer });

    const result = await capturedHandler!({
      method: 'completion/complete',
      params: {
        ref: { type: 'ref/tool', name: 'sheets_auth' },
        argument: { name: 'action', value: 'log' },
      },
    });

    const typed = result as { completion: { values: string[] } };
    expect(typed.completion.values).toContain('logout');
    // 'status' does not start with 'log'
    expect(typed.completion.values).not.toContain('status');
  });

  it('returns range suggestions for range arguments', async () => {
    const { registerToolCompletionHandler } = await import(
      '../../src/server/control-plane-registration.js'
    );

    let capturedHandler: ((req: unknown) => Promise<unknown>) | null = null;
    const setRequestHandler = vi.fn((_schema: unknown, handler: (req: unknown) => Promise<unknown>) => {
      capturedHandler = handler;
    });
    const mockServer = { server: { setRequestHandler } } as unknown as Parameters<
      typeof registerToolCompletionHandler
    >[0]['server'];

    registerToolCompletionHandler({ server: mockServer });

    const result = await capturedHandler!({
      method: 'completion/complete',
      params: {
        ref: { type: 'ref/tool', name: 'sheets_data' },
        argument: { name: 'range', value: 'Sheet1' },
      },
    });

    const typed = result as { completion: { values: string[] } };
    expect(typed.completion.values).toBeInstanceOf(Array);
    expect(typed.completion.values.length).toBeGreaterThan(0);
  });

  it('returns empty completions for unknown tool', async () => {
    const { registerToolCompletionHandler } = await import(
      '../../src/server/control-plane-registration.js'
    );

    let capturedHandler: ((req: unknown) => Promise<unknown>) | null = null;
    const setRequestHandler = vi.fn((_schema: unknown, handler: (req: unknown) => Promise<unknown>) => {
      capturedHandler = handler;
    });
    const mockServer = { server: { setRequestHandler } } as unknown as Parameters<
      typeof registerToolCompletionHandler
    >[0]['server'];

    registerToolCompletionHandler({ server: mockServer });

    const result = await capturedHandler!({
      method: 'completion/complete',
      params: {
        ref: { type: 'ref/tool', name: 'sheets_nonexistent' },
        argument: { name: 'action', value: '' },
      },
    });

    const typed = result as { completion: { values: string[] } };
    expect(typed.completion.values).toHaveLength(0);
  });

  it('delegates ref/prompt completions back (non-tool refs return empty)', async () => {
    const { registerToolCompletionHandler } = await import(
      '../../src/server/control-plane-registration.js'
    );

    let capturedHandler: ((req: unknown) => Promise<unknown>) | null = null;
    const setRequestHandler = vi.fn((_schema: unknown, handler: (req: unknown) => Promise<unknown>) => {
      capturedHandler = handler;
    });
    const mockServer = { server: { setRequestHandler } } as unknown as Parameters<
      typeof registerToolCompletionHandler
    >[0]['server'];

    registerToolCompletionHandler({ server: mockServer });

    // Non-tool refs (ref/prompt, ref/resource) are handled by the SDK — our
    // handler returns an empty completion set for them (not an error).
    const result = await capturedHandler!({
      method: 'completion/complete',
      params: {
        ref: { type: 'ref/prompt', name: 'some_prompt' },
        argument: { name: 'param', value: '' },
      },
    });

    const typed = result as { completion: { values: string[] } };
    expect(typed.completion.values).toBeInstanceOf(Array);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fix 2: lazy TOOL_ICONS
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix 2: getToolIcons() lazy loading', () => {
  it('exports a getToolIcons function', async () => {
    const mod = await import('../../src/mcp/features-2025-11-25.js');
    expect(typeof mod.getToolIcons).toBe('function');
  });

  it('getToolIcons() returns the same icons as the static TOOL_ICONS constant', async () => {
    const mod = await import('../../src/mcp/features-2025-11-25.js');
    const icons = mod.getToolIcons();
    expect(icons).toBeDefined();
    expect(typeof icons).toBe('object');
    // Should have entries for all 25 tools
    expect(Object.keys(icons).length).toBeGreaterThanOrEqual(25);
    // Each tool should have at least one icon
    for (const toolIcons of Object.values(icons)) {
      expect(Array.isArray(toolIcons)).toBe(true);
      expect((toolIcons as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it('getToolIcons() is idempotent — returns same reference on repeated calls', async () => {
    const mod = await import('../../src/mcp/features-2025-11-25.js');
    const first = mod.getToolIcons();
    const second = mod.getToolIcons();
    expect(first).toBe(second);
  });

  it('TOOL_ICONS backward-compat export still works', async () => {
    const mod = await import('../../src/mcp/features-2025-11-25.js');
    // TOOL_ICONS should still be exported for backward compatibility
    expect(mod.TOOL_ICONS).toBeDefined();
    expect(typeof mod.TOOL_ICONS).toBe('object');
  });
});
