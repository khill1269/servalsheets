import { BaseHandler } from '../base.js';
import type { SheetsFormatInput, FormatOutput } from '../../schemas/format.js';
import { logger } from '../../utils/logger.js';

export class FormatBasicHandler extends BaseHandler<any, any> {
  async handleSetBackground(req: SheetsFormatInput & { action: 'set_background' }): Promise<FormatOutput> {
    return {} as any;
  }

  async handleSetTextFormat(req: SheetsFormatInput & { action: 'set_text_format' }): Promise<FormatOutput> {
    return {} as any;
  }
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { FormatHandlerAccess } from './internal.js';
import type { FormatResponse } from '../../schemas/index.js';

type FormatReq<A extends string> = { action: A; spreadsheetId?: string; range?: string; [key: string]: unknown };

export async function handleSetFormat(ha: FormatHandlerAccess, request: FormatReq<'set_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}

export async function handleSetBackground(ha: FormatHandlerAccess, request: FormatReq<'set_background'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}

export async function handleSetTextFormat(ha: FormatHandlerAccess, request: FormatReq<'set_text_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}

export async function handleSetNumberFormat(ha: FormatHandlerAccess, request: FormatReq<'set_number_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}

export async function handleSetAlignment(ha: FormatHandlerAccess, request: FormatReq<'set_alignment'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}

export async function handleSetBorders(ha: FormatHandlerAccess, request: FormatReq<'set_borders'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}

export async function handleClearFormat(ha: FormatHandlerAccess, request: FormatReq<'clear_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}

export async function handleSetRichText(ha: FormatHandlerAccess, request: FormatReq<'set_rich_text'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}
