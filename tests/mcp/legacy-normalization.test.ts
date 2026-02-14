import { describe, expect, it, vi } from 'vitest';
import type { Handlers } from '../../src/handlers/index.js';
import {
  createToolHandlerMap,
  normalizeToolArgs,
} from '../../src/mcp/registration/tool-handlers.js';

function createMockHandlers(): Handlers {
  const makeHandler = () => ({ handle: vi.fn(async () => ({ response: { success: true } })) });
  return {
    core: makeHandler(),
    data: makeHandler(),
    format: makeHandler(),
    dimensions: makeHandler(),
    visualize: makeHandler(),
    collaborate: makeHandler(),
    advanced: makeHandler(),
    transaction: makeHandler(),
    quality: makeHandler(),
    history: makeHandler(),
    confirm: makeHandler(),
    analyze: makeHandler(),
    fix: makeHandler(),
    composite: makeHandler(),
    session: makeHandler(),
    templates: makeHandler(),
    bigquery: makeHandler(),
    appsscript: makeHandler(),
    webhooks: makeHandler(),
    dependencies: makeHandler(),
  } as unknown as Handlers;
}

describe('legacy argument normalization', () => {
  it('flattens root-level action+params wrappers', () => {
    expect(
      normalizeToolArgs({
        action: 'get',
        params: { spreadsheetId: 'sheet-123' },
      })
    ).toEqual({
      request: {
        action: 'get',
        spreadsheetId: 'sheet-123',
      },
    });
  });

  it('flattens nested request.params wrappers', () => {
    expect(
      normalizeToolArgs({
        request: {
          action: 'get',
          params: { spreadsheetId: 'sheet-456' },
        },
      })
    ).toEqual({
      request: {
        action: 'get',
        spreadsheetId: 'sheet-456',
      },
    });
  });
});

describe('legacy schema wrapper hardening', () => {
  it('does not allow wrapped invalid actions to bypass validation', async () => {
    const handlers = createMockHandlers();
    const map = createToolHandlerMap(handlers);

    expect(() =>
      map.sheets_core({
        request: {
          action: 'not_a_real_action',
          spreadsheetId: 'sheet-123',
        },
      })
    ).toThrow();

    expect(handlers.core.handle).not.toHaveBeenCalled();
  });
});
