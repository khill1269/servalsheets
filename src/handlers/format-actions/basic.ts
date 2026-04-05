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
