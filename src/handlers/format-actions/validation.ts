import { BaseHandler } from '../base.js';
import type { SheetsFormatInput, FormatOutput } from '../../schemas/format.js';
import { logger } from '../../utils/logger.js';

export class FormatValidationHandler extends BaseHandler {
  async handleSetDataValidation(req: SheetsFormatInput & { action: 'set_data_validation' }): Promise<FormatOutput> {
    const { spreadsheetId, range, validationType, validationOptions } = req;

    try {
      await this.context.cachedApi.setDataValidation(spreadsheetId, range, {
        type: validationType,
        ...validationOptions,
      });

      return this.success('set_data_validation', { validationAdded: true }, true);
    } catch (error) {
      logger.error('Set data validation failed', { spreadsheetId, range, error });
      throw error;
    }
  }
}
