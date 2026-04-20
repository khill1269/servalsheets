import type { ServalTransport } from '../transport.js';

export type CellValue = string | number | boolean | null;
export type Row = CellValue[];

export interface ReadOptions {
  spreadsheetId: string;
  range: string;
  valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA';
  dateTimeRenderOption?: 'SERIAL_NUMBER' | 'FORMATTED_STRING';
}

export interface WriteOptions {
  spreadsheetId: string;
  range: string;
  values: Row[];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface AppendOptions {
  spreadsheetId: string;
  range: string;
  values: Row[];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
  insertDataOption?: 'OVERWRITE' | 'INSERT_ROWS';
}

export interface ReadResult {
  range: string;
  values: Row[];
  majorDimension?: string;
}

export interface WriteResult {
  spreadsheetId: string;
  updatedRange: string;
  updatedRows: number;
  updatedColumns: number;
  updatedCells: number;
}

export interface FindReplaceOptions {
  spreadsheetId: string;
  find: string;
  replacement: string;
  range?: string;
  matchCase?: boolean;
  matchEntireCell?: boolean;
  searchByRegex?: boolean;
}

export class DataNamespace {
  constructor(private readonly transport: ServalTransport) {}

  async read(options: ReadOptions): Promise<ReadResult> {
    return this.transport.callTool('sheets_data', { request: { action: 'read', ...options } }) as never;
  }

  async write(options: WriteOptions): Promise<WriteResult> {
    return this.transport.callTool('sheets_data', { request: { action: 'write', ...options } }) as never;
  }

  async append(options: AppendOptions): Promise<WriteResult> {
    return this.transport.callTool('sheets_data', { request: { action: 'append', ...options } }) as never;
  }

  async clear(spreadsheetId: string, range: string): Promise<{ clearedRange: string }> {
    return this.transport.callTool('sheets_data', { request: { action: 'clear', spreadsheetId, range } }) as never;
  }

  async batchRead(spreadsheetId: string, ranges: string[], valueRenderOption?: string): Promise<{ valueRanges: ReadResult[] }> {
    return this.transport.callTool('sheets_data', { request: { action: 'batch_read', spreadsheetId, ranges, valueRenderOption } }) as never;
  }

  async batchWrite(spreadsheetId: string, data: Array<{ range: string; values: Row[] }>, valueInputOption?: string): Promise<{ responses: WriteResult[] }> {
    return this.transport.callTool('sheets_data', { request: { action: 'batch_write', spreadsheetId, data, valueInputOption } }) as never;
  }

  async findReplace(options: FindReplaceOptions): Promise<{ occurrencesChanged: number }> {
    return this.transport.callTool('sheets_data', { request: { action: 'find_replace', ...options } }) as never;
  }

  async copyPaste(spreadsheetId: string, sourceRange: string, destinationRange: string, pasteType?: string): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_data', { request: { action: 'copy_paste', spreadsheetId, sourceRange, destinationRange, pasteType } }) as never;
  }

  async mergeCells(spreadsheetId: string, range: string, mergeType?: 'MERGE_ALL' | 'MERGE_COLUMNS' | 'MERGE_ROWS'): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_data', { request: { action: 'merge_cells', spreadsheetId, range, mergeType } }) as never;
  }

  async unmergeCells(spreadsheetId: string, range: string): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_data', { request: { action: 'unmerge_cells', spreadsheetId, range } }) as never;
  }

  async addNote(spreadsheetId: string, range: string, note: string): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_data', { request: { action: 'add_note', spreadsheetId, range, note } }) as never;
  }

  async setHyperlink(spreadsheetId: string, range: string, url: string, label?: string): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_data', { request: { action: 'set_hyperlink', spreadsheetId, range, url, label } }) as never;
  }
}
