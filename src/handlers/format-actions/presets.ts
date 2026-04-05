import { BaseHandler } from '../base.js';
import type { SheetsFormatInput, FormatOutput } from '../../schemas/format.js';
import { logger } from '../../utils/logger.js';

export class FormatPresetsHandler extends BaseHandler {
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
}
