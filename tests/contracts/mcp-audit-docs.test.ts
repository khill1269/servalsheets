import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOOL_COUNT, ACTION_COUNT } from '../../src/generated/action-counts.js';

describe('MCP audit docs', () => {
  it('source manifest lists MCP features and protocol version', () => {
    const manifest = readFileSync('docs/compliance/MCP_PROTOCOL_SOURCE_MANIFEST.md', 'utf-8');

    // Protocol version
    expect(manifest).toContain('2025-11-25');

    // Must reference core MCP features
    expect(manifest).toContain('tools/list');
    expect(manifest).toContain('tools/call');
    expect(manifest).toContain('resources/list');
    expect(manifest).toContain('resources/read');
    expect(manifest).toContain('prompts/list');
    expect(manifest).toContain('prompts/get');
  });

  it('compliance checklist reflects verified tool and action counts', () => {
    const checklist = readFileSync('docs/compliance/MCP_2025-11-25_COMPLIANCE_CHECKLIST.md', 'utf-8');

    // Must contain current tool and action counts
    expect(checklist).toContain(`${TOOL_COUNT} tools`);
    expect(checklist).toContain(`${ACTION_COUNT} actions`);

    // Must reference the protocol version target
    expect(checklist).toContain('2025-11-25');
    expect(checklist).toContain('2025-06-18');

    // Must reference resource subscriptions
    expect(checklist).toContain('resources/subscribe');
  });

  it('coordinator audit references the protocol surface', () => {
    const coordinator = readFileSync('docs/compliance/MCP_PROTOCOL_COORDINATOR_AUDIT.md', 'utf-8');

    // Must reference protocol version
    expect(coordinator).toContain('2025-11-25');

    // Must cover key compliance areas
    expect(coordinator).toContain('Tool');
    expect(coordinator).toContain('Resource');
    expect(coordinator).toContain('Transport');
  });
});
