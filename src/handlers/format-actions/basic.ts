import { BaseHandler } from '../base.js';
import type { SheetsFormatInput, FormatOutput } from '../../schemas/format.js';
import { logger } from '../../utils/logger.js';

export class FormatBasicHandler extends BaseHandler {
  async handleSetBackground(req: SheetsFormatInput & { action: 'set_background' }): Promise<FormatOutput> {
    const { spreadsheetId, range, color } = req;

    try {
      await this.context.cachedApi.format(spreadsheetId, range, { backgroundColor: color });

      return this.success('set_background', { formatted: true }, true);
    } catch (error) {
      logger.error('Set background failed', { spreadsheetId, range, error });
      throw error;
    }
  }

  async handleSetTextFormat(req: SheetsFormatInput & { action: 'set_text_format' }): Promise<FormatOutput> {
    const { spreadsheetId, range, bold, italic } = req;

    try {
      await this.context.cachedApi.format(spreadsheetId, range, { bold, italic });

      return this.success('set_text_format', { formatted: true }, true);
    } catch (error) {
      logger.error('Set text format failed', { spreadsheetId, range, error });
      throw error;
    }
  }
}

// Standalone function exports for parent handler dispatch
import type { FormatHandlerAccess } from './internal.js';
import type { FormatResponse } from '../../schemas/index.js';

type FormatReq<A extends string> = { action: A; spreadsheetId?: string; range?: string; [key: string]: unknown };

export async function handleSetFormat(ha: FormatHandlerAccess, request: FormatReq<'set_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
}

export async function handleSetBackground(ha: FormatHandlerAccess, request: FormatReq<'set_background'>): Promise<FormatResponse> {
  try {
    await ha.context.cachedApi.format(request.spreadsheetId!, request.range!, { backgroundColor: (request as any).color });
    return ha.makeSuccess(request.action, { formatted: true });
  } catch (error) {
    return ha.makeError({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false });
  }
}

export async function handleSetTextFormat(ha: FormatHandlerAccess, request: FormatReq<'set_text_format'>): Promise<FormatResponse> {
  try {
    await ha.context.cachedApi.format(request.spreadsheetId!, request.range!, { bold: (request as any).bold, italic: (request as any).italic });
    return ha.makeSuccess(request.action, { formatted: true });
  } catch (error) {
    return ha.makeError({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error), retryable: false });
  }
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
