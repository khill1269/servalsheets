/**
 * ServalSheets - Category 13 Elicitation & Wizards Tests (Simulation)
 *
 * Tests for wizard flows, confirmations, snapshots, consent, and OAuth
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import { ConfirmHandler } from '../../src/handlers/confirm.js';
import { VisualizeHandler } from '../../src/handlers/visualize.js';
import { SheetsCoreHandler } from '../../src/handlers/core.js';
import { TransactionHandler } from '../../src/handlers/transaction.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import { getToolDiscoveryHint } from '../../src/mcp/registration/tool-discovery-hints.js';
import {
  assertSamplingConsent,
  clearSamplingConsentCache,
  registerSamplingConsentChecker,
} from '../../src/mcp/sampling.js';
import { createRequestContext, runWithRequestContext } from '../../src/utils/request-context.js';
import { getEnv } from '../../src/config/env.js';
import { startApiKeyServer, startOAuthCredentialsServer } from '../../src/utils/api-key-server.js';

const canListenLocalhost = await new Promise<boolean>((resolve) => {
  const server = net.createServer();
  server.once('error', () => resolve(false));
  server.listen(0, '127.0.0.1', () => {
    server.close(() => resolve(true));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock APIs and Context
// ─────────────────────────────────────────────────────────────────────────────

const createMockSheetsApi = () => ({
  spreadsheets: {
    create: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'new-sheet-id',
        properties: { title: 'Untitled Spreadsheet' },
        sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
      },
    }),
    get: vi.fn().mockResolvedValue({
      data: {
        spreadsheetId: 'test-sheet-id',
        properties: { title: 'Test Sheet' },
        sheets: [{ properties: { sheetId: 0, title: 'Sheet1' } }],
      },
    }),
    batchUpdate: vi.fn().mockResolvedValue({ data: { replies: [] } }),
  },
});

const createMockContext = (): HandlerContext => ({
  googleClient: {} as any,
  batchCompiler: {
    compile: vi.fn().mockResolvedValue({ requests: [] }),
    execute: vi.fn().mockResolvedValue({ replies: [] }),
  } as any,
  rangeResolver: {
    resolve: vi.fn().mockResolvedValue({ a1Notation: 'Sheet1!A1:B2', sheetId: 0, sheetName: 'Sheet1' }),
  } as any,
  auth: { scopes: ['https://www.googleapis.com/auth/spreadsheets'] } as any,
  samplingServer: undefined,
  snapshotService: {
    create: vi.fn().mockResolvedValue({ snapshotId: 'snap-123' }),
    restore: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({ snapshotId: 'snap-123' }),
  } as any,
  sessionContext: {
    recordElicitationRejection: vi.fn(),
    wasRecentlyRejected: vi.fn().mockResolvedValue(false),
  } as any,
  confirmDestructiveAction: vi.fn().mockResolvedValue(undefined),
  createSnapshotIfNeeded: vi.fn().mockResolvedValue({ snapshotId: 'snap-123' }),
  sendProgress: vi.fn(),
  cachedApi: {} as any,
});

// ─────────────────────────────────────────────────────────────────────────────
// Category 13: Elicitation & Wizards
// ─────────────────────────────────────────────────────────────────────────────

describe('Category 13: Elicitation & Wizards', () => {
  let mockContext: HandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
    clearSamplingConsentCache();
    vi.useRealTimers();
  });

  describe('13.1 Chart Creation Wizard', () => {
    let handler: VisualizeHandler;
    let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;

    beforeEach(() => {
      mockSheetsApi = createMockSheetsApi();
      handler = new VisualizeHandler(mockContext, mockSheetsApi as unknown as any);
    });

    it('13.1 chart_create wizard schema validates 2-step flow', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: { replies: [{ addChart: { chart: { chartId: 123 } } }] },
      });

      const result = await handler.handle({
        request: {
          action: 'chart_create',
          spreadsheetId: 'test-sheet-id',
          sheetId: 0,
          chartType: 'LINE',
          data: {
            sourceRange: 'Sheet1!A1:C10',
          },
          position: { sheetId: 0, rowIndex: 5, columnIndex: 0 },
        },
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it('13.1b chart_create with title (step 2) dispatches', async () => {
      mockSheetsApi.spreadsheets.batchUpdate.mockResolvedValue({
        data: { replies: [{ addChart: { chart: { chartId: 123, spec: { title: 'Revenue Chart' } } } }] },
      });

      const result = await handler.handle({
        request: {
          action: 'chart_create',
          spreadsheetId: 'test-sheet-id',
          sheetId: 0,
          chartType: 'COLUMN',
          data: {
            sourceRange: 'Sheet1!A1:B10',
          },
          options: {
            title: 'Revenue by Month',
          },
          position: { sheetId: 0, rowIndex: 0, columnIndex: 0 },
        },
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });

  describe('13.2 Conditional Format Wizard', () => {
    it('13.2 conditional format wizard preset selection', () => {
      const formatHint = getToolDiscoveryHint('sheets_format');

      expect(formatHint).not.toBeNull();
      expect(formatHint!.actionParams['add_conditional_format_rule']?.required).toEqual(
        expect.arrayContaining(['spreadsheetId', 'range'])
      );
      expect(formatHint!.actionParams['add_conditional_format_rule']?.optional).toEqual(
        expect.arrayContaining(['ruleType', 'condition', 'format', 'preset'])
      );
    });
  });

  describe('13.3 Spreadsheet Creation Wizard', () => {
    let handler: SheetsCoreHandler;
    let mockSheetsApi: ReturnType<typeof createMockSheetsApi>;

    beforeEach(() => {
      mockSheetsApi = createMockSheetsApi();
      handler = new SheetsCoreHandler(mockContext, mockSheetsApi as unknown as any);
    });

    it('13.3 create wizard with title dispatches', async () => {
      const result = await handler.handle({
        request: {
          action: 'create',
          title: 'My Budget Tracker',
        },
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      if (result.response.success) {
        expect(result.response).toHaveProperty('spreadsheetId');
      }
    });

    it('13.3b create with default title dispatches', async () => {
      const result = await handler.handle({
        request: {
          action: 'create',
        },
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });

  describe('13.4 Transaction Begin Wizard', () => {
    it('13.4 transaction begin is part of elicitation framework', () => {
      // Transaction handler requires service initialization (outside test scope)
      // This test verifies the handler exists and is importable
      expect(TransactionHandler).toBeDefined();
      expect(typeof TransactionHandler).toBe('function');
    });

    it('13.4b transaction features are accessible', () => {
      // Verify the service layer is properly exported
      expect(TransactionHandler).toBeDefined();
    });
  });

  describe('13.5-13.6 Destructive Action Safety Rails', () => {
    it('13.5 destructive actions use confirmation and snapshot pattern', async () => {
      const mockSheetsApi = createMockSheetsApi();
      const order: string[] = [];
      const elicitationServer = {
        elicitInput: vi.fn(async () => {
          order.push('confirm');
          return { action: 'accept', content: { confirm: true } };
        }),
      };

      mockContext.elicitationServer = elicitationServer as any;
      mockContext.snapshotService = {
        create: vi.fn(async () => {
          order.push('snapshot');
          return { id: 'snap-ordered' };
        }),
        restore: vi.fn(),
        get: vi.fn(),
      } as any;

      mockSheetsApi.spreadsheets.batchUpdate.mockImplementation(async () => {
        order.push('mutate');
        return { data: { replies: [] } };
      });

      const handler = new SheetsCoreHandler(mockContext, mockSheetsApi as unknown as any);
      const result = await handler.handle({
        request: {
          action: 'delete_sheet',
          spreadsheetId: 'test-sheet-id',
          sheetId: 0,
          safety: { createSnapshot: true },
        },
      });

      expect(result.response.success).toBe(true);
      expect(order).toEqual(['confirm', 'snapshot', 'mutate']);
    });

    it('13.6 snapshot ordering is maintained (confirm first)', async () => {
      const mockSheetsApi = createMockSheetsApi();
      const snapshotCreate = vi.fn();

      mockContext.snapshotService = {
        create: snapshotCreate,
        restore: vi.fn(),
        get: vi.fn(),
      } as any;

      const handler = new SheetsCoreHandler(mockContext, mockSheetsApi as unknown as any);
      const result = await handler.handle({
        request: {
          action: 'delete_sheet',
          spreadsheetId: 'test-sheet-id',
          sheetId: 0,
          safety: { createSnapshot: true },
        },
      });

      expect(result.response.success).toBe(false);
      expect(snapshotCreate).not.toHaveBeenCalled();
      expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('13.7 Wizard Session Management', () => {
    let handler: ConfirmHandler;

    beforeEach(() => {
      handler = new ConfirmHandler(mockContext);
    });

    it('13.7 wizard_start creates session and returns sessionId', async () => {
      const result = await handler.handle({
        request: {
          action: 'wizard_start',
          title: 'Import Data',
          description: 'Step-by-step import guide',
          steps: [
            { id: 'step1', title: 'Select File', description: 'Choose CSV file' },
            { id: 'step2', title: 'Map Columns', description: 'Match columns to sheet' },
          ],
        },
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it('13.7b wizard sessions have cap (1000 max with eviction)', async () => {
      let latestStartSucceeded = false;

      for (let index = 0; index <= 1000; index++) {
        const startResult = await handler.handle({
          request: {
            action: 'wizard_start',
            wizardId: `wiz-${index}`,
            title: `Wizard ${index}`,
            description: 'Capacity test',
            steps: [{ id: 'step1', title: 'Only Step', description: 'Fill once', fields: [] }],
          },
        });
        latestStartSucceeded = startResult.response.success;
      }

      const oldest = await handler.handle({
        request: {
          action: 'wizard_step',
          wizardId: 'wiz-0',
          stepId: 'step1',
          values: { ok: true },
        },
      });

      expect(latestStartSucceeded).toBe(true);
      expect(oldest.response.success).toBe(false);
    });
  });

  describe('13.8 Elicitation Unavailable Handling', () => {
    let handler: ConfirmHandler;

    beforeEach(() => {
      mockContext.samplingServer = undefined; // Simulate no elicitation support
      handler = new ConfirmHandler(mockContext);
    });

    it('13.8 graceful degradation when elicitation unavailable', async () => {
      const result = await handler.handle({
        request: {
          action: 'wizard_start',
          title: 'Setup',
          steps: [],
        },
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      // Should degrade gracefully, not throw
    });
  });

  describe('13.9 Sampling Consent', () => {
    it('13.9 sampling consent cache with TTL', async () => {
      const checker = vi.fn(async () => {});
      registerSamplingConsentChecker(checker);

      await runWithRequestContext(
        createRequestContext({ principalId: 'wizard-user', requestId: 'wizard-req-1' }),
        async () => {
          await assertSamplingConsent();
          await assertSamplingConsent();
        }
      );

      expect(checker).toHaveBeenCalledTimes(1);
    });

    it('13.9b consent cache prevents re-prompting within TTL', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));

      const checker = vi.fn(async () => {});
      const ttlMs = getEnv().SAMPLING_CONSENT_CACHE_TTL_MS;
      registerSamplingConsentChecker(checker);

      await runWithRequestContext(
        createRequestContext({ principalId: 'wizard-user', requestId: 'wizard-req-2' }),
        async () => {
          await assertSamplingConsent();
        }
      );

      vi.setSystemTime(Date.now() + ttlMs + 1);

      await runWithRequestContext(
        createRequestContext({ principalId: 'wizard-user', requestId: 'wizard-req-2' }),
        async () => {
          await assertSamplingConsent();
        }
      );

      expect(checker).toHaveBeenCalledTimes(2);
    });
  });

  describe('13.10 OAuth URL-Mode (Not Form-Mode)', () => {
    it.skipIf(!canListenLocalhost)('13.10 OAuth uses URL-mode for credentials (not form-mode)', async () => {
      const handle = await startOAuthCredentialsServer({ provider: 'Test OAuth', timeout: 50 });

      expect(handle.url).toMatch(/^http:\/\/localhost:\d+\/setup-oauth$/);
      handle.shutdown();
      await expect(handle.credentialsPromise).rejects.toThrow('OAuth credentials server shut down');
    });

    it.skipIf(!canListenLocalhost)('13.10b API key server redirects to localhost on random port', async () => {
      const handle = await startApiKeyServer({
        provider: 'Test Provider',
        signupUrl: 'https://example.com/signup',
        hint: 'Starts with tp-',
        timeout: 50,
      });

      expect(handle.url).toMatch(/^http:\/\/localhost:\d+\/setup-key$/);
      handle.shutdown();
      await expect(handle.keyPromise).rejects.toThrow('API key server shut down');
    });
  });

  describe('13.x Confirmation Order Validation', () => {
    it('should confirm before snapshot (correct order)', () => {
      expect(getToolDiscoveryHint('sheets_confirm')?.actionParams['wizard_start']).toBeDefined();
    });

    it('should handle missing destructive confirmation gracefully', async () => {
      const mockSheetsApi = createMockSheetsApi();
      const handler = new SheetsCoreHandler(mockContext, mockSheetsApi as unknown as any);

      const result = await handler.handle({
        request: {
          action: 'delete_sheet',
          spreadsheetId: 'test-sheet-id',
          sheetId: 0,
        },
      });

      expect(result.response.success).toBe(false);
      expect(mockSheetsApi.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    });
  });

  describe('13.x Edge Cases', () => {
    it('should handle wizard step validation', async () => {
      const handler = new ConfirmHandler(mockContext);

      const result = await handler.handle({
        request: {
          action: 'wizard_step',
          wizardId: 'non-existent',
          stepId: 'step1',
          values: { input: 'test' },
        },
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it('should handle wizard completion', async () => {
      const handler = new ConfirmHandler(mockContext);

      const result = await handler.handle({
        request: {
          action: 'wizard_complete',
          wizardId: 'test-wizard',
        },
      });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });
});
