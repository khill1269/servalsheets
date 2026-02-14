import { describe, expect, it, vi } from 'vitest';
import type { Handlers } from '../../src/handlers/index.js';
import {
  buildToolResponse,
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

describe('tool-handlers validation enhancements', () => {
  it('includes valid actions for invalid action values', async () => {
    const handlers = createMockHandlers();
    const handlerMap = createToolHandlerMap(handlers);

    let thrown: unknown;
    try {
      await handlerMap.sheets_core({
        action: 'not_a_real_action',
        spreadsheetId: 'test-spreadsheet-id',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    expect(message).toContain('Valid actions:');
    expect(message).toContain('update_sheet');
    expect(handlers.core.handle).not.toHaveBeenCalled();
  });

  it('rejects invalid actions even when wrapped under request', async () => {
    const handlers = createMockHandlers();
    const handlerMap = createToolHandlerMap(handlers);

    let thrown: unknown;
    try {
      await handlerMap.sheets_core({
        request: {
          action: 'not_a_real_action',
          spreadsheetId: 'test-spreadsheet-id',
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    expect(message).toContain('Valid actions:');
    expect(handlers.core.handle).not.toHaveBeenCalled();
  });

  it('adds rename_sheet hint pointing to update_sheet', async () => {
    const handlers = createMockHandlers();
    const handlerMap = createToolHandlerMap(handlers);

    let thrown: unknown;
    try {
      await handlerMap.sheets_core({
        action: 'rename_sheet',
        spreadsheetId: 'test-spreadsheet-id',
        sheetId: 0,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    expect(message).toContain('update_sheet');
    expect(message).toContain('title');
  });
});

describe('normalizeToolArgs legacy compatibility', () => {
  it('flattens root-level legacy params wrapper', () => {
    const normalized = normalizeToolArgs({
      action: 'get',
      params: {
        spreadsheetId: 'sheet-123',
      },
    });

    expect(normalized).toEqual({
      request: {
        action: 'get',
        spreadsheetId: 'sheet-123',
      },
    });
  });

  it('flattens nested request.params wrapper', () => {
    const normalized = normalizeToolArgs({
      request: {
        action: 'get',
        params: {
          spreadsheetId: 'sheet-456',
        },
      },
    });

    expect(normalized).toEqual({
      request: {
        action: 'get',
        spreadsheetId: 'sheet-456',
      },
    });
  });
});

describe('buildToolResponse non-fatal classification', () => {
  it('keeps validation/config style failures as non-fatal MCP results', () => {
    const result = buildToolResponse({
      response: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid action',
          retryable: false,
        },
      },
    });

    expect(result.isError).toBeUndefined();
    expect((result.structuredContent as any).response.success).toBe(false);
    expect((result.structuredContent as any).response._meta.nonFatalError).toBe(true);
  });

  it('keeps internal failures as MCP errors', () => {
    const result = buildToolResponse({
      response: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected failure',
          retryable: false,
        },
      },
    });

    expect(result.isError).toBe(true);
  });
});
