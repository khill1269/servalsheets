import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { SheetsCoreHandler } from '../../src/handlers/core.js';
import type { HandlerContext } from '../../src/handlers/base.js';
import { SessionHandler } from '../../src/handlers/session.js';
import { buildToolResponse } from '../../src/mcp/registration/tool-handlers.js';
import { SheetsSessionInputSchema } from '../../src/schemas/session.js';
import { ACTION_METADATA } from '../../src/schemas/action-metadata.js';
import { wrapGoogleApi, type GoogleApiClient } from '../../src/services/google-api.js';
import { resetSessionContext } from '../../src/services/session-context.js';
import { zodSchemaToJsonSchema } from '../../src/utils/schema-compat.js';
import { createRequestContext, runWithRequestContext } from '../../src/utils/request-context.js';

type ToolCallResult = ReturnType<typeof buildToolResponse>;

function parseStructuredContent(result: ToolCallResult): Record<string, unknown> {
  const content = result.content[0];
  if (!content || content.type !== 'text') {
    throw new Error('Expected text content in tool result');
  }

  return JSON.parse(content.text) as Record<string, unknown>;
}

function schemaText(schema: unknown): string {
  return JSON.stringify(zodSchemaToJsonSchema(schema));
}

function createCoreHandlerContext(): HandlerContext {
  return {
    requestId: 'contract-core-create',
    timestamp: new Date('2026-06-24T00:00:00Z'),
    auth: {
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    },
    session: new Map(),
    capabilities: {
      supports: () => true,
      requireCapability: () => undefined,
      getCapability: () => undefined,
    },
    authService: {
      isAuthenticated: () => true,
      getClient: async () => ({}),
    },
    googleClient: {},
    batchCompiler: {
      compile: async () => ({ requests: [] }),
      execute: async () => ({ responses: [] }),
    },
    rangeResolver: {
      resolve: async () => ({
        a1Notation: 'Sheet1!A1',
        sheetName: 'Sheet1',
        resolution: { method: 'a1_direct', confidence: 1, path: '' },
      }),
    },
  } as unknown as HandlerContext;
}

describe('action runtime contracts', () => {
  beforeEach(() => {
    resetSessionContext();
  });

  afterEach(() => {
    resetSessionContext();
  });

  it('sheets_session.set_active matches declared cost and documented no-fetch behavior', async () => {
    const toolName = 'sheets_session';
    const actionName = 'set_active';
    const declaredMetadata = ACTION_METADATA[toolName]?.[actionName];

    expect(declaredMetadata).toMatchObject({
      apiCalls: 0,
      readOnly: false,
      destructive: false,
      requiresConfirmation: false,
    });

    const handler = new SessionHandler();
    const context = createRequestContext({ requestId: 'contract-set-active' });
    const result = await runWithRequestContext(context, async () =>
      buildToolResponse(
        await handler.handle({
          request: {
            action: actionName,
            spreadsheetId: '1ContractSpreadsheetId123456789',
          },
        }),
        toolName
      )
    );

    const structuredContent = parseStructuredContent(result);
    const response = structuredContent['response'] as Record<string, unknown>;
    const meta = structuredContent['_meta'] as Record<string, unknown>;
    const spreadsheet = response['spreadsheet'] as Record<string, unknown>;

    expect(response['success']).toBe(true);
    expect(response['action']).toBe(actionName);
    expect(spreadsheet['sheetNames']).toEqual([]);
    expect(response['message']).toContain('Sheet names were not supplied');
    expect(response['message']).toContain('disabled until sheetNames are supplied');
    expect(meta['apiCallsMade']).toBe(declaredMetadata?.apiCalls);

    const sessionSchemaText = schemaText(SheetsSessionInputSchema);
    expect(sessionSchemaText).toContain('caller-supplied');
    expect(sessionSchemaText).toContain('sheet-name reference resolution is disabled');
    expect(sessionSchemaText).not.toContain('fetched from the API');
  });

  it('sheets_core.create matches declared one-call cost through the wrapped API', async () => {
    const toolName = 'sheets_core';
    const actionName = 'create';
    const declaredMetadata = ACTION_METADATA[toolName]?.[actionName];

    expect(declaredMetadata).toMatchObject({
      apiCalls: 1,
      readOnly: false,
      destructive: false,
    });

    const rawSheetsApi = {
      spreadsheets: {
        create: async () => ({
          data: {
            spreadsheetId: 'created-contract-sheet',
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/created-contract-sheet',
            properties: {
              title: 'Contract Sheet',
              locale: 'en_US',
              timeZone: 'America/New_York',
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
      },
    };
    const fakeGoogleClient = {
      recordCallResult: () => undefined,
      isSharedDriveFile: async () => false,
    } as unknown as GoogleApiClient;
    const sheetsApi = wrapGoogleApi(rawSheetsApi, { client: fakeGoogleClient });
    const handler = new SheetsCoreHandler(createCoreHandlerContext(), sheetsApi as never);
    const context = createRequestContext({ requestId: 'contract-core-create' });

    const result = await runWithRequestContext(context, async () =>
      buildToolResponse(
        await handler.handle({
          request: {
            action: actionName,
            title: 'Contract Sheet',
          },
        }),
        toolName
      )
    );

    const structuredContent = parseStructuredContent(result);
    const response = structuredContent['response'] as Record<string, unknown>;
    const meta = structuredContent['_meta'] as Record<string, unknown>;

    expect(response['success']).toBe(true);
    expect(response['action']).toBe(actionName);
    expect(meta['apiCallsMade']).toBe(declaredMetadata?.apiCalls);
  });
});
