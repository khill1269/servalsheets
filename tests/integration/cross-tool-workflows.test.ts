import { describe, it, expect } from 'vitest';
import {
  SheetsCoreInputSchema,
  SheetsDataInputSchema,
  SheetsFormatInputSchema,
  SheetsDimensionsInputSchema,
  SheetsVisualizeInputSchema,
  SheetsCollaborateInputSchema,
  SheetsTransactionInputSchema,
  SheetsAnalyzeInputSchema,
} from '../../src/schemas/index.js';
import { getToolFixtures } from '../audit/action-coverage-fixtures.js';

type WorkflowInput = {
  request: Record<string, unknown>;
};

function getFixtureInput(tool: string, action: string): WorkflowInput {
  const fixture = getToolFixtures(tool).find((candidate) => candidate.action === action);
  if (!fixture) {
    throw new Error(`Missing fixture for ${tool}.${action}`);
  }
  return structuredClone(fixture.validInput) as WorkflowInput;
}

function withSpreadsheetId(input: WorkflowInput, spreadsheetId: string): WorkflowInput {
  const cloned = structuredClone(input);
  cloned.request.spreadsheetId = spreadsheetId;
  return cloned;
}

function expectValid(
  label: string,
  schema: {
    safeParse: (input: unknown) => { success: boolean; error?: { issues: unknown[] } };
  },
  input: unknown
): void {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(`${label} failed schema validation:\n${JSON.stringify(result.error?.issues, null, 2)}`);
  }
  expect(result.success).toBe(true);
}

describe('Cross-Tool Workflow Contracts', () => {
  it('validates create -> add_sheet -> write -> set_format with a shared spreadsheet id', () => {
    const create = getFixtureInput('sheets_core', 'create');
    const createdSpreadsheetId = 'workflow-sheet-001';

    const addSheet = withSpreadsheetId(getFixtureInput('sheets_core', 'add_sheet'), createdSpreadsheetId);
    addSheet.request.title = 'Expenses';

    const write = withSpreadsheetId(getFixtureInput('sheets_data', 'write'), createdSpreadsheetId);
    const format = withSpreadsheetId(
      getFixtureInput('sheets_format', 'set_format'),
      createdSpreadsheetId
    );

    expectValid('sheets_core.create', SheetsCoreInputSchema, create);
    expectValid('sheets_core.add_sheet', SheetsCoreInputSchema, addSheet);
    expectValid('sheets_data.write', SheetsDataInputSchema, write);
    expectValid('sheets_format.set_format', SheetsFormatInputSchema, format);

    expect(addSheet.request.spreadsheetId).toBe(createdSpreadsheetId);
    expect(write.request.spreadsheetId).toBe(createdSpreadsheetId);
    expect(format.request.spreadsheetId).toBe(createdSpreadsheetId);
  });

  it('validates read -> chart_create -> analyze_data over the same spreadsheet', () => {
    const spreadsheetId = 'workflow-sheet-002';
    const read = withSpreadsheetId(getFixtureInput('sheets_data', 'read'), spreadsheetId);
    const chartCreate = withSpreadsheetId(
      getFixtureInput('sheets_visualize', 'chart_create'),
      spreadsheetId
    );
    const analyze = withSpreadsheetId(
      getFixtureInput('sheets_analyze', 'analyze_data'),
      spreadsheetId
    );

    expectValid('sheets_data.read', SheetsDataInputSchema, read);
    expectValid('sheets_visualize.chart_create', SheetsVisualizeInputSchema, chartCreate);
    expectValid('sheets_analyze.analyze_data', SheetsAnalyzeInputSchema, analyze);

    expect(chartCreate.request.spreadsheetId).toBe(spreadsheetId);
    expect(analyze.request.spreadsheetId).toBe(spreadsheetId);
  });

  it('validates freeze -> resize -> sort_range as a single dimensions workflow', () => {
    const spreadsheetId = 'workflow-sheet-003';
    const freeze = withSpreadsheetId(getFixtureInput('sheets_dimensions', 'freeze'), spreadsheetId);
    const resize = withSpreadsheetId(getFixtureInput('sheets_dimensions', 'resize'), spreadsheetId);
    const sortRange = withSpreadsheetId(
      getFixtureInput('sheets_dimensions', 'sort_range'),
      spreadsheetId
    );

    expectValid('sheets_dimensions.freeze', SheetsDimensionsInputSchema, freeze);
    expectValid('sheets_dimensions.resize', SheetsDimensionsInputSchema, resize);
    expectValid('sheets_dimensions.sort_range', SheetsDimensionsInputSchema, sortRange);

    expect(freeze.request.spreadsheetId).toBe(spreadsheetId);
    expect(resize.request.spreadsheetId).toBe(spreadsheetId);
    expect(sortRange.request.spreadsheetId).toBe(spreadsheetId);
  });

  it('validates collaboration flows with shared spreadsheet context', () => {
    const spreadsheetId = 'workflow-sheet-004';
    const share = withSpreadsheetId(getFixtureInput('sheets_collaborate', 'share_add'), spreadsheetId);
    const comment = withSpreadsheetId(
      getFixtureInput('sheets_collaborate', 'comment_add'),
      spreadsheetId
    );

    expectValid('sheets_collaborate.share_add', SheetsCollaborateInputSchema, share);
    expectValid('sheets_collaborate.comment_add', SheetsCollaborateInputSchema, comment);

    expect(share.request.spreadsheetId).toBe(spreadsheetId);
    expect(comment.request.spreadsheetId).toBe(spreadsheetId);
  });

  it('validates begin -> queue -> commit transaction sequencing', () => {
    const begin = withSpreadsheetId(
      getFixtureInput('sheets_transaction', 'begin'),
      'workflow-sheet-005'
    );
    const queue = getFixtureInput('sheets_transaction', 'queue');
    const commit = getFixtureInput('sheets_transaction', 'commit');

    expectValid('sheets_transaction.begin', SheetsTransactionInputSchema, begin);
    expectValid('sheets_transaction.queue', SheetsTransactionInputSchema, queue);
    expectValid('sheets_transaction.commit', SheetsTransactionInputSchema, commit);

    expect(begin.request.action).toBe('begin');
    expect(queue.request.action).toBe('queue');
    expect(commit.request.action).toBe('commit');
  });
});
