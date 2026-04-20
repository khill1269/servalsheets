import type { ServalTransport } from '../transport.js';

export interface TextFormatOptions {
  spreadsheetId: string;
  range: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number;
  fontFamily?: string;
  foregroundColor?: { red: number; green: number; blue: number };
}

export interface NumberFormatOptions {
  spreadsheetId: string;
  range: string;
  type: 'TEXT' | 'NUMBER' | 'PERCENT' | 'CURRENCY' | 'DATE' | 'TIME' | 'DATE_TIME' | 'SCIENTIFIC';
  pattern?: string;
}

export interface BackgroundOptions {
  spreadsheetId: string;
  range: string;
  color: { red: number; green: number; blue: number };
}

export interface AlignmentOptions {
  spreadsheetId: string;
  range: string;
  horizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY';
  vertical?: 'TOP' | 'MIDDLE' | 'BOTTOM';
  wrapStrategy?: 'OVERFLOW_CELL' | 'LEGACY_WRAP' | 'CLIP' | 'WRAP';
}

export class FormatNamespace {
  constructor(private readonly transport: ServalTransport) {}

  async setTextFormat(options: TextFormatOptions): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_format', { request: { action: 'set_text_format', ...options } }) as never;
  }

  async setNumberFormat(options: NumberFormatOptions): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_format', { request: { action: 'set_number_format', ...options } }) as never;
  }

  async setBackground(options: BackgroundOptions): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_format', { request: { action: 'set_background', ...options } }) as never;
  }

  async setAlignment(options: AlignmentOptions): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_format', { request: { action: 'set_alignment', ...options } }) as never;
  }

  async clearFormat(spreadsheetId: string, range: string): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_format', { request: { action: 'clear_format', spreadsheetId, range } }) as never;
  }

  async applyPreset(spreadsheetId: string, range: string, preset: string): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_format', { request: { action: 'apply_preset', spreadsheetId, range, preset } }) as never;
  }

  async autoFit(spreadsheetId: string, sheetId: number, dimension?: 'COLUMNS' | 'ROWS'): Promise<{ success: boolean }> {
    return this.transport.callTool('sheets_format', { request: { action: 'auto_fit', spreadsheetId, sheetId, dimension } }) as never;
  }
}
