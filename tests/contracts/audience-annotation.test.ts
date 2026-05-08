/**
 * Audience Annotation Contract Tests
 *
 * MCP 2025-11-25 requires all content items carry annotations.audience.
 * This is implemented in src/mcp/registration/tool-response.ts but had ZERO
 * test coverage prior to this file.
 *
 * Contract rules (src/mcp/registration/tool-response.ts:70-71, 637, 676, 690):
 * - Success responses:  annotations.audience = ['assistant']
 * - Fatal errors:       annotations.audience = ['user', 'assistant'], isError = true
 * - Non-fatal errors:   annotations.audience = ['assistant'], isError = undefined
 * - Large response branches (>MCP_MAX_RESPONSE_BYTES, >10MB) also carry audience
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildToolResponse } from '../../src/mcp/registration/tool-response.js';
import { resetEnvForTest } from '../../src/config/env.js';

// NON_FATAL codes are defined in tool-response.ts:54-68.
// A code outside that set triggers a fatal error (isError: true).
const FATAL_ERROR_CODE = 'INTERNAL_ERROR'; // not in NON_FATAL set
const NON_FATAL_ERROR_CODE = 'NOT_FOUND'; // in NON_FATAL set

function successPayload(data?: Record<string, unknown>) {
  return {
    response: {
      success: true,
      action: 'test_action',
      ...(data ?? { value: 42 }),
    },
  };
}

function fatalErrorPayload() {
  return {
    response: {
      success: false,
      error: { code: FATAL_ERROR_CODE, message: 'Something went wrong' },
    },
  };
}

function nonFatalErrorPayload() {
  return {
    response: {
      success: false,
      error: { code: NON_FATAL_ERROR_CODE, message: 'Resource not found' },
    },
  };
}

describe('Audience Annotation Contract', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvForTest();
  });

  it('success response: content items have audience [assistant]', () => {
    const result = buildToolResponse(successPayload());

    expect(result.content).toHaveLength(1);
    const item = result.content[0];
    expect(item.annotations).toBeDefined();
    expect(item.annotations!.audience).toEqual(['assistant']);
    expect(result.isError).toBeUndefined();
  });

  it('fatal error (INTERNAL_ERROR): content has audience [user, assistant] and isError: true', () => {
    // MCP_NON_FATAL_TOOL_ERRORS defaults to 'true', so we need to ensure
    // INTERNAL_ERROR is NOT in the non-fatal set (it isn't — see tool-response.ts:54-68)
    const result = buildToolResponse(fatalErrorPayload());

    expect(result.content).toHaveLength(1);
    const item = result.content[0];
    expect(item.annotations).toBeDefined();
    expect(item.annotations!.audience).toEqual(['user', 'assistant']);
    expect(result.isError).toBe(true);
  });

  it('non-fatal error (NOT_FOUND): content has audience [assistant] and isError is not true', () => {
    // NOT_FOUND is in NON_FATAL_TOOL_ERROR_CODES — treated as non-fatal by default
    vi.stubEnv('MCP_NON_FATAL_TOOL_ERRORS', 'true');
    resetEnvForTest(); // flush getEnv() cache so stub takes effect
    const result = buildToolResponse(nonFatalErrorPayload());

    expect(result.content).toHaveLength(1);
    const item = result.content[0];
    expect(item.annotations).toBeDefined();
    expect(item.annotations!.audience).toEqual(['assistant']);
    expect(result.isError).toBeUndefined();
  });

  it('when MCP_NON_FATAL_TOOL_ERRORS=false, NOT_FOUND becomes fatal with [user, assistant]', () => {
    vi.stubEnv('MCP_NON_FATAL_TOOL_ERRORS', 'false');
    resetEnvForTest(); // flush getEnv() cache so stub takes effect
    const result = buildToolResponse(nonFatalErrorPayload());

    expect(result.content).toHaveLength(1);
    const item = result.content[0];
    expect(item.annotations).toBeDefined();
    expect(item.annotations!.audience).toEqual(['user', 'assistant']);
    expect(result.isError).toBe(true);
  });

  it('token-budget fallback branch (>MCP_MAX_RESPONSE_BYTES) carries audience [assistant]', () => {
    // Set a tiny budget so any response exceeds it
    vi.stubEnv('MCP_MAX_RESPONSE_BYTES', '10');
    // No need to resetEnvForTest here — MCP_MAX_RESPONSE_BYTES is read via process.env directly

    // Build a payload that will exceed 10 bytes when serialized
    const largePayload = {
      response: {
        success: true,
        action: 'read',
        rows: Array.from({ length: 50 }, (_, i) => [`row-${i}`, `value-${i}`]),
      },
    };

    const result = buildToolResponse(largePayload);

    expect(result.content).toHaveLength(1);
    const item = result.content[0];
    expect(item.annotations).toBeDefined();
    expect(item.annotations!.audience).toEqual(['assistant']);
    // The token-budget branch sets isError: undefined (not a real error)
    expect(result.isError).toBeUndefined();
    // The response indicates truncation
    const parsed = JSON.parse(item.text as string) as Record<string, unknown>;
    const responseRecord = parsed['response'] as Record<string, unknown>;
    expect(responseRecord).toBeDefined();
    expect(responseRecord['resourceUri']).toBeDefined();
  });

  it('every content item in the response has annotations.audience defined', () => {
    const testCases = [
      successPayload(),
      fatalErrorPayload(),
    ];

    for (const payload of testCases) {
      const result = buildToolResponse(payload);
      for (const item of result.content) {
        expect(
          item.annotations?.audience,
          `content item is missing annotations.audience for payload: ${JSON.stringify(payload).slice(0, 80)}`
        ).toBeDefined();
        expect(Array.isArray(item.annotations!.audience)).toBe(true);
        expect((item.annotations!.audience as string[]).length).toBeGreaterThan(0);
      }
    }
  });

  it('audience values are restricted to known MCP roles (user, assistant)', () => {
    const result = buildToolResponse(successPayload());
    const VALID_ROLES = new Set(['user', 'assistant']);

    for (const item of result.content) {
      const audience = item.annotations?.audience as string[] | undefined;
      expect(audience).toBeDefined();
      for (const role of audience!) {
        expect(
          VALID_ROLES.has(role),
          `Unexpected audience role "${role}" — must be "user" or "assistant"`
        ).toBe(true);
      }
    }
  });
});
