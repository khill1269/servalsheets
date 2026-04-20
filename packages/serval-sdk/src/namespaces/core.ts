import type { ServalTransport } from '../transport.js';

export interface SpreadsheetProperties {
  spreadsheetId: string;
  title: string;
  locale?: string;
  timeZone?: string;
  sheets: Array<{ sheetId: number; title: string; index: number }>;
}

export class CoreNamespace {
  constructor(private readonly transport: ServalTransport) {}

  async list(options?: { pageSize?: number; pageToken?: string }): Promise<{ files: Array<{ id: string; name: string }>; nextPageToken?: string }> {
    return this.transport.callTool('sheets_core', { request: { action: 'list', ...options } }) as never;
  }

  async get(spreadsheetId: string, options?: { ranges?: string[]; includeGridData?: boolean }): Promise<SpreadsheetProperties> {
    return this.transport.callTool('sheets_core', { request: { action: 'get', spreadsheetId, ...options } }) as never;
  }

  async create(title: string, options?: { locale?: string; timeZone?: string }): Promise<SpreadsheetProperties> {
    return this.transport.callTool('sheets_core', { request: { action: 'create', title, ...options } }) as never;
  }

  async copy(spreadsheetId: string, title?: string): Promise<SpreadsheetProperties> {
    return this.transport.callTool('sheets_core', { request: { action: 'copy', spreadsheetId, title } }) as never;
  }

  async addSheet(spreadsheetId: string, title: string, options?: { index?: number; rowCount?: number; columnCount?: number }): Promise<{ sheetId: number; title: string }> {
    return this.transport.callTool('sheets_core', { request: { action: 'add_sheet', spreadsheetId, title, ...options } }) as never;
  }

  async deleteSheet(spreadsheetId: string, sheetId: number): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_core', { request: { action: 'delete_sheet', spreadsheetId, sheetId } }) as never;
  }

  async updateProperties(spreadsheetId: string, properties: Partial<Pick<SpreadsheetProperties, 'title' | 'locale' | 'timeZone'>>): Promise<SpreadsheetProperties> {
    return this.transport.callTool('sheets_core', { request: { action: 'update_properties', spreadsheetId, ...properties } }) as never;
  }
}
