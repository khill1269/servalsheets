/**
 * AI Conversation Flow Simulator
 *
 * Simulates realistic Claude+ServalSheets multi-step conversations.
 * Executes real handler code against mock Google API, validating response
 * intelligence output at each step and threading session state across steps.
 *
 * Purpose: catch issues unit tests miss — hint routing, nextAction suggestions,
 * gotcha warnings, multi-step state coherence, idempotence patterns.
 */

import { vi } from 'vitest';
import type { HandlerContext } from '../../src/handlers/base.js';
import { SessionContextManager } from '../../src/services/session-context.js';
import { SheetsCoreHandler } from '../../src/handlers/core.js';
import { SheetsDataHandler } from '../../src/handlers/data.js';
import { FormatHandler } from '../../src/handlers/format.js';
import { AnalyzeHandler } from '../../src/handlers/analyze.js';
import { FixHandler } from '../../src/handlers/fix.js';
import { VisualizeHandler } from '../../src/handlers/visualize.js';
import { SessionHandler } from '../../src/handlers/session.js';
import { HistoryHandler } from '../../src/handlers/history.js';
import { QualityHandler } from '../../src/handlers/quality.js';
import type { sheets_v4, drive_v3 } from 'googleapis';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface FlowStep {
  /** Human-readable description of what Claude would be doing at this step */
  intent: string;
  /** The tool name (e.g. 'sheets_core', 'sheets_data') */
  tool: string;
  /** The action name (e.g. 'create', 'read') */
  action: string;
  /** Parameters — spreadsheetId is auto-injected from session context if omitted */
  params: Record<string, unknown>;
  /** Assertions against the response */
  expectations: {
    /** response.success should match */
    success?: boolean;
    /** response should contain these top-level keys */
    hasKeys?: string[];
    /** response._hints should be present */
    hasHints?: boolean;
    /** response._gotcha should be present */
    hasGotcha?: boolean;
    /** response._nextActions or nextActions should include a string matching this */
    nextActionIncludes?: string;
    /** Custom assertion — throw to fail, return void to pass */
    assert?: (response: Record<string, unknown>) => void;
  };
  /** If true, record the operation in session context after this step */
  recordOperation?: boolean;
}

export interface ConversationFlow {
  name: string;
  description: string;
  category:
    | 'analysis'
    | 'data-entry'
    | 'dashboard'
    | 'cleaning'
    | 'collaboration'
    | 'automation'
    | 'agent-workflow'
    | 'error-recovery';
  steps: FlowStep[];
}

export interface FlowStepResult {
  step: number;
  intent: string;
  tool: string;
  action: string;
  success: boolean;
  durationMs: number;
  expectationsMet: boolean;
  failures: string[];
  response: Record<string, unknown>;
}

export interface FlowResult {
  flow: string;
  steps: FlowStepResult[];
  passed: boolean;
  totalMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic handler interface
// ─────────────────────────────────────────────────────────────────────────────

interface AnyHandler {
  handle: (input: Record<string, unknown>) => Promise<{ response: Record<string, unknown> }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock API factories
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SPREADSHEET_ID = 'sim-spreadsheet-abc123';

export function createSimSheetsApi(): sheets_v4.Sheets {
  return {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: {
          spreadsheetId: MOCK_SPREADSHEET_ID,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${MOCK_SPREADSHEET_ID}/edit`,
          properties: {
            title: 'Simulation Spreadsheet',
            locale: 'en_US',
            timeZone: 'America/Los_Angeles',
          },
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: 'Sheet1',
                index: 0,
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
              // Grid data included for suggest_format and similar actions
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: [
                    {
                      values: [
                        {
                          formattedValue: 'Month',
                          effectiveValue: { stringValue: 'Month' },
                          effectiveFormat: { textFormat: { bold: false } },
                        },
                        {
                          formattedValue: 'Revenue',
                          effectiveValue: { stringValue: 'Revenue' },
                          effectiveFormat: { textFormat: { bold: false } },
                        },
                        {
                          formattedValue: 'Cost',
                          effectiveValue: { stringValue: 'Cost' },
                          effectiveFormat: { textFormat: { bold: false } },
                        },
                        {
                          formattedValue: 'Profit',
                          effectiveValue: { stringValue: 'Profit' },
                          effectiveFormat: { textFormat: { bold: false } },
                        },
                      ],
                    },
                    {
                      values: [
                        {
                          formattedValue: '2026-01-01',
                          effectiveValue: { stringValue: '2026-01-01' },
                          effectiveFormat: {},
                        },
                        {
                          formattedValue: '10000',
                          effectiveValue: { numberValue: 10000 },
                          effectiveFormat: {},
                        },
                        {
                          formattedValue: '6000',
                          effectiveValue: { numberValue: 6000 },
                          effectiveFormat: {},
                        },
                        {
                          formattedValue: '4000',
                          effectiveValue: { numberValue: 4000 },
                          effectiveFormat: {},
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              properties: {
                sheetId: 1,
                title: 'Data',
                index: 1,
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            },
          ],
        },
      }),
      create: vi.fn().mockResolvedValue({
        data: {
          spreadsheetId: MOCK_SPREADSHEET_ID,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${MOCK_SPREADSHEET_ID}/edit`,
          properties: {
            title: 'New Spreadsheet',
            locale: 'en_US',
            timeZone: 'America/Los_Angeles',
          },
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: 'Sheet1',
                index: 0,
                gridProperties: { rowCount: 1000, columnCount: 26 },
              },
            },
          ],
        },
      }),
      batchUpdate: vi.fn().mockResolvedValue({
        data: {
          spreadsheetId: MOCK_SPREADSHEET_ID,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${MOCK_SPREADSHEET_ID}/edit`,
          replies: [
            {
              addSheet: {
                properties: { sheetId: 2, title: 'NewSheet', index: 2 },
              },
            },
            {
              addEmbeddedObject: {
                embeddedObject: {
                  objectId: 42,
                  spec: { title: 'Chart' },
                  position: {
                    overlayPosition: {
                      anchorCell: { sheetId: 0, rowIndex: 7, columnIndex: 0 },
                    },
                  },
                },
              },
            },
          ],
          updatedSpreadsheet: {
            spreadsheetId: MOCK_SPREADSHEET_ID,
            sheets: [
              { properties: { sheetId: 0, title: 'Sheet1', index: 0 } },
              { properties: { sheetId: 1, title: 'Data', index: 1 } },
              { properties: { sheetId: 2, title: 'NewSheet', index: 2 } },
            ],
          },
        },
      }),
      values: {
        get: vi.fn().mockResolvedValue({
          data: {
            range: 'Sheet1!A1:D5',
            values: [
              ['Month', 'Revenue', 'Cost', 'Profit'],
              ['2026-01-01', 10000, 6000, 4000],
              ['2026-02-01', 11000, 6500, 4500],
              ['2026-03-01', 12000, 7000, 5000],
              ['2026-04-01', 9500, 5800, 3700],
            ],
          },
        }),
        update: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: MOCK_SPREADSHEET_ID,
            updatedRange: 'Sheet1!A1:D5',
            updatedRows: 5,
            updatedColumns: 4,
            updatedCells: 20,
          },
        }),
        append: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: MOCK_SPREADSHEET_ID,
            updates: {
              updatedRange: 'Sheet1!A6:D6',
              updatedRows: 1,
              updatedColumns: 4,
              updatedCells: 4,
            },
          },
        }),
        clear: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: MOCK_SPREADSHEET_ID,
            clearedRange: 'Sheet1!A1:D5',
          },
        }),
        batchGet: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: MOCK_SPREADSHEET_ID,
            valueRanges: [
              {
                range: 'Sheet1!A1:D5',
                values: [
                  ['Month', 'Revenue', 'Cost', 'Profit'],
                  ['2026-01-01', 10000, 6000, 4000],
                  ['2026-02-01', 11000, 6500, 4500],
                ],
              },
              {
                range: 'Data!A1:D5',
                values: [
                  ['Month', 'Revenue', 'Cost', 'Profit'],
                  ['2025-12-01', 9000, 5500, 3500],
                ],
              },
            ],
          },
        }),
        batchUpdate: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: MOCK_SPREADSHEET_ID,
            totalUpdatedRows: 5,
            totalUpdatedColumns: 4,
            totalUpdatedCells: 20,
            responses: [
              {
                updatedRange: 'Sheet1!A1:D5',
                updatedRows: 5,
                updatedColumns: 4,
                updatedCells: 20,
              },
            ],
          },
        }),
        batchGetByDataFilter: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: MOCK_SPREADSHEET_ID,
            valueRanges: [
              {
                valueRange: {
                  range: 'Sheet1!A1:D5',
                  values: [
                    ['Month', 'Revenue', 'Cost', 'Profit'],
                    ['2026-01-01', 10000, 6000, 4000],
                  ],
                },
              },
            ],
          },
        }),
        batchUpdateByDataFilter: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: MOCK_SPREADSHEET_ID,
            totalUpdatedRows: 2,
            totalUpdatedColumns: 4,
            totalUpdatedCells: 8,
          },
        }),
        batchClear: vi.fn().mockResolvedValue({
          data: { clearedRanges: ['Sheet1!A1:D5'] },
        }),
        batchClearByDataFilter: vi.fn().mockResolvedValue({
          data: { clearedRanges: ['Sheet1!A1:D5'] },
        }),
      } as unknown as sheets_v4.Sheets['spreadsheets']['values'],
      sheets: {
        copyTo: vi.fn().mockResolvedValue({
          data: {
            sheetId: 99,
            title: 'Sheet1 (2)',
            index: 3,
            gridProperties: { rowCount: 1000, columnCount: 26 },
          },
        }),
      } as unknown as sheets_v4.Sheets['spreadsheets']['sheets'],
      developerMetadata: {
        get: vi.fn().mockResolvedValue({ data: {} }),
        search: vi.fn().mockResolvedValue({ data: { matchedDeveloperMetadata: [] } }),
      } as unknown as sheets_v4.Sheets['spreadsheets']['developerMetadata'],
    } as unknown as sheets_v4.Sheets['spreadsheets'],
  } as unknown as sheets_v4.Sheets;
}

export function createSimDriveApi(): drive_v3.Drive {
  return {
    files: {
      get: vi.fn().mockResolvedValue({
        data: {
          id: MOCK_SPREADSHEET_ID,
          name: 'Simulation Spreadsheet',
          mimeType: 'application/vnd.google-apps.spreadsheet',
          webViewLink: `https://docs.google.com/spreadsheets/d/${MOCK_SPREADSHEET_ID}/edit`,
          createdTime: '2026-01-01T00:00:00Z',
          modifiedTime: '2026-04-01T00:00:00Z',
        },
      }),
      list: vi.fn().mockResolvedValue({
        data: {
          files: [
            {
              id: MOCK_SPREADSHEET_ID,
              name: 'Simulation Spreadsheet',
              mimeType: 'application/vnd.google-apps.spreadsheet',
              createdTime: '2026-01-01T00:00:00Z',
              modifiedTime: '2026-04-01T00:00:00Z',
            },
          ],
        },
      }),
      copy: vi.fn().mockResolvedValue({
        data: {
          id: 'copied-sim-id',
          name: 'Copy of Simulation Spreadsheet',
          webViewLink: 'https://docs.google.com/spreadsheets/d/copied-sim-id/edit',
        },
      }),
    } as unknown as drive_v3.Drive['files'],
    revisions: {
      list: vi.fn().mockResolvedValue({ data: { revisions: [] } }),
    } as unknown as drive_v3.Drive['revisions'],
  } as unknown as drive_v3.Drive;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock context factory
// ─────────────────────────────────────────────────────────────────────────────

export function createSimContext(sessionContext: SessionContextManager): HandlerContext {
  return {
    requestId: 'sim-request-001',
    auth: {
      hasElevatedAccess: false,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/bigquery',
        'https://www.googleapis.com/auth/bigquery.readonly',
        'https://www.googleapis.com/auth/script.projects',
        'https://www.googleapis.com/auth/script.deployments',
        'https://www.googleapis.com/auth/script.processes',
      ],
    },
    session: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      has: vi.fn(),
      keys: vi.fn(),
    },
    capabilities: {
      supports: vi.fn(() => true),
      requireCapability: vi.fn(),
      getCapability: vi.fn(),
    },
    googleClient: {
      sheets: vi.fn(),
      drive: vi.fn(),
    } as unknown as HandlerContext['googleClient'],
    authService: {
      isAuthenticated: vi.fn().mockReturnValue(true),
      getClient: vi.fn().mockResolvedValue({}),
    } as unknown as HandlerContext['authService'],
    elicitationServer: {
      request: vi.fn().mockResolvedValue({ confirmed: true, reason: '' }),
      elicitInput: vi.fn().mockResolvedValue({ action: 'accept', content: { confirm: true } }),
      getClientCapabilities: vi.fn().mockReturnValue({ elicitation: { form: true } }),
    } as unknown as HandlerContext['elicitationServer'],
    snapshotService: {
      createSnapshot: vi.fn().mockResolvedValue({
        snapshotId: 'sim-snapshot-001',
        timestamp: new Date('2026-04-01T00:00:00Z'),
      }),
      create: vi.fn().mockResolvedValue({
        id: 'sim-snapshot-001',
        timestamp: new Date('2026-04-01T00:00:00Z'),
      }),
    } as unknown as HandlerContext['snapshotService'],
    impactAnalyzer: {
      analyzeOperation: vi.fn().mockResolvedValue({
        severity: 'low',
        cellsAffected: 0,
        formulasAffected: [],
        chartsAffected: [],
        warnings: [],
      }),
    } as unknown as HandlerContext['impactAnalyzer'],
    rangeResolver: {
      resolve: vi.fn().mockResolvedValue({
        a1Notation: 'Sheet1!A1:D5',
        sheetId: 0,
        sheetName: 'Sheet1',
        gridRange: {
          sheetId: 0,
          startRowIndex: 0,
          endRowIndex: 5,
          startColumnIndex: 0,
          endColumnIndex: 4,
        },
        resolution: { method: 'a1_direct', confidence: 1.0, path: '' },
      }),
    } as unknown as HandlerContext['rangeResolver'],
    batchCompiler: {
      compile: vi.fn(),
      execute: vi.fn().mockResolvedValue({
        responses: [{ updatedRange: 'Sheet1!A1:D5' }],
        totalUpdatedCells: 20,
      }),
      executeWithSafety: vi.fn().mockImplementation(
        async (options: Record<string, unknown>) => {
          const op = options['operation'] as (() => Promise<void>) | undefined;
          const safety = options['safety'] as Record<string, unknown> | undefined;
          if (op && !safety?.['dryRun']) {
            await op();
          }
          return {
            success: true,
            spreadsheetId: options['spreadsheetId'],
            responses: [],
            dryRun: safety?.['dryRun'] ?? false,
          };
        }
      ),
    } as unknown as HandlerContext['batchCompiler'],
    sessionContext,
  } as unknown as HandlerContext & { sessionContext: SessionContextManager };
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler factory — creates handler instances keyed by tool name
// ─────────────────────────────────────────────────────────────────────────────

function buildHandlerMap(
  context: HandlerContext,
  sheetsApi: sheets_v4.Sheets,
  driveApi: drive_v3.Drive,
  sessionContext: SessionContextManager
): Map<string, AnyHandler> {
  const map = new Map<string, AnyHandler>();

  map.set('sheets_core', new SheetsCoreHandler(context, sheetsApi, driveApi) as unknown as AnyHandler);
  map.set('sheets_data', new SheetsDataHandler(context, sheetsApi) as unknown as AnyHandler);
  map.set('sheets_format', new FormatHandler(context, sheetsApi) as unknown as AnyHandler);
  map.set('sheets_analyze', new AnalyzeHandler(context, sheetsApi) as unknown as AnyHandler);
  map.set('sheets_fix', new FixHandler(context, sheetsApi) as unknown as AnyHandler);
  map.set('sheets_visualize', new VisualizeHandler(context, sheetsApi) as unknown as AnyHandler);
  map.set('sheets_session', new SessionHandler(sessionContext) as unknown as AnyHandler);
  map.set(
    'sheets_history',
    new HistoryHandler({ sheetsApi, driveApi, sessionContext }) as unknown as AnyHandler
  );
  map.set('sheets_quality', new QualityHandler({}) as unknown as AnyHandler);

  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expectation checker
// ─────────────────────────────────────────────────────────────────────────────

function checkExpectations(
  response: Record<string, unknown>,
  expectations: FlowStep['expectations']
): string[] {
  const failures: string[] = [];

  if (expectations.success !== undefined) {
    if (response['success'] !== expectations.success) {
      failures.push(
        `expected success=${String(expectations.success)}, got success=${String(response['success'])}`
      );
    }
  }

  if (expectations.hasKeys) {
    for (const key of expectations.hasKeys) {
      if (!(key in response)) {
        failures.push(`expected key '${key}' in response`);
      }
    }
  }

  if (expectations.hasHints) {
    const hasHints = '_hints' in response && response['_hints'] != null;
    if (!hasHints) {
      failures.push('expected _hints to be present in response');
    }
  }

  if (expectations.hasGotcha) {
    const hasGotcha = '_gotcha' in response && response['_gotcha'] != null;
    if (!hasGotcha) {
      failures.push('expected _gotcha to be present in response');
    }
  }

  if (expectations.nextActionIncludes) {
    const needle = expectations.nextActionIncludes;
    const nextActions =
      response['_nextActions'] ??
      response['nextActions'] ??
      (response['_meta'] as Record<string, unknown> | undefined)?.['nextActions'];
    const asString = JSON.stringify(nextActions ?? '');
    if (!asString.includes(needle)) {
      // Advisory: nextAction routing is heuristic, not a hard contract
      failures.push(
        `[advisory] expected nextActions to include '${needle}', got: ${asString.substring(0, 120)}`
      );
    }
  }

  if (expectations.assert) {
    try {
      expectations.assert(response);
    } catch (err) {
      failures.push(
        `custom assertion failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return failures;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a conversation flow end-to-end.
 *
 * Creates a fresh SessionContextManager and HandlerContext for each run,
 * ensuring flows are isolated and deterministic.
 */
export async function runConversationFlow(flow: ConversationFlow): Promise<FlowResult> {
  const sessionContext = new SessionContextManager();
  const context = createSimContext(sessionContext);
  const sheetsApi = createSimSheetsApi();
  const driveApi = createSimDriveApi();
  const handlers = buildHandlerMap(context, sheetsApi, driveApi, sessionContext);

  const stepResults: FlowStepResult[] = [];
  const flowStart = Date.now();

  // Track active spreadsheetId — updated by set_active and create responses
  let activeSpreadsheetId: string | undefined;

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i]!;
    const stepStart = Date.now();

    // Auto-inject spreadsheetId from session if the step doesn't provide one
    const params = { ...step.params };
    if (activeSpreadsheetId && !('spreadsheetId' in params)) {
      params['spreadsheetId'] = activeSpreadsheetId;
    }

    const input: Record<string, unknown> = {
      action: step.action,
      ...params,
    };

    let response: Record<string, unknown> = {};
    let handlerSucceeded = true;

    try {
      const handler = handlers.get(step.tool);
      if (!handler) {
        throw new Error(
          `No handler registered for tool '${step.tool}'. ` +
            `Add it to buildHandlerMap() in ai-flow-simulator.ts`
        );
      }
      const result = await handler.handle(input);
      response = (result.response as Record<string, unknown>) ?? {};
    } catch (err) {
      handlerSucceeded = false;
      response = {
        success: false,
        error: {
          code: 'HANDLER_THREW',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }

    const durationMs = Date.now() - stepStart;
    const failures = checkExpectations(response, step.expectations);

    // Thread: update activeSpreadsheetId after set_active
    if (
      step.tool === 'sheets_session' &&
      step.action === 'set_active' &&
      response['success'] === true
    ) {
      const spreadsheet = response['spreadsheet'] as Record<string, unknown> | undefined;
      if (typeof spreadsheet?.['spreadsheetId'] === 'string') {
        activeSpreadsheetId = spreadsheet['spreadsheetId'];
      } else if (typeof params['spreadsheetId'] === 'string') {
        activeSpreadsheetId = params['spreadsheetId'];
      }
    }

    // Thread: update activeSpreadsheetId after core.create
    if (
      step.tool === 'sheets_core' &&
      step.action === 'create' &&
      response['success'] === true
    ) {
      const spreadsheet = response['spreadsheet'] as Record<string, unknown> | undefined;
      if (typeof spreadsheet?.['spreadsheetId'] === 'string') {
        activeSpreadsheetId = spreadsheet['spreadsheetId'];
      }
    }

    // Optional: record operation in session context for undo support
    if (step.recordOperation && response['success'] === true && activeSpreadsheetId) {
      try {
        sessionContext.recordOperation({
          tool: step.tool,
          action: step.action,
          spreadsheetId: activeSpreadsheetId,
          description: step.intent,
          undoable: false,
        });
      } catch {
        // Non-fatal — session recording failure should not fail the step
      }
    }

    stepResults.push({
      step: i + 1,
      intent: step.intent,
      tool: step.tool,
      action: step.action,
      success: handlerSucceeded && response['success'] === true,
      durationMs,
      expectationsMet: failures.length === 0,
      failures,
      response,
    });
  }

  const totalMs = Date.now() - flowStart;
  const passed = stepResults.every((s) => s.expectationsMet);

  return {
    flow: flow.name,
    steps: stepResults,
    passed,
    totalMs,
  };
}
