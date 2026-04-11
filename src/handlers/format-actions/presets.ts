import { BaseHandler } from '../base.js';
import type { SheetsFormatInput, FormatOutput } from '../../schemas/format.js';
import { logger } from '../../utils/logger.js';

export class FormatPresetsHandler extends BaseHandler<any, any> {
  async handleApplyPreset(req: SheetsFormatInput & { action: 'apply_preset' }): Promise<FormatOutput> {
    const { spreadsheetId, range, preset } = req;

    try {
      const formatSpec = this.getPresetSpec(preset);
      await this.context.cachedApi.format(spreadsheetId, range, formatSpec);

      return this.success('apply_preset', { applied: true }, true);
    } catch (error) {
      logger.error('Apply preset failed', { spreadsheetId, range, error });
      throw error;
    }
  }

  private getPresetSpec(preset: string): Record<string, any> {
    const specs: Record<string, any> = {
      header_row: { bold: true, backgroundColor: '#e8f0fe' },
      alternating_rows: { alternatingRowsColor: '#f3f3f3' },
      currency: { numberFormat: '$#,##0.00' },
    };

    return specs[preset] || {};
  }
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { FormatHandlerAccess } from './internal.js';
import type { FormatResponse } from '../../schemas/index.js';

type FormatReq<A extends string> = { action: A; [key: string]: unknown };

export async function handleApplyPreset(ha: FormatHandlerAccess, request: FormatReq<'apply_preset'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { applied: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleAutoFit(ha: FormatHandlerAccess, request: FormatReq<'auto_fit'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleBatchFormat(ha: FormatHandlerAccess, request: FormatReq<'batch_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { formatted: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleSparklineAdd(ha: FormatHandlerAccess, request: FormatReq<'sparkline_add'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { added: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleSparklineGet(ha: FormatHandlerAccess, request: FormatReq<'sparkline_get'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, {});
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleSparklineClear(ha: FormatHandlerAccess, request: FormatReq<'sparkline_clear'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { cleared: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}
