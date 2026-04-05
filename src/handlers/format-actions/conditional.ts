import { BaseHandler } from '../base.js';
import type { SheetsFormatInput, FormatOutput } from '../../schemas/format.js';
import { logger } from '../../utils/logger.js';

export class FormatConditionalHandler extends BaseHandler {
  async handleAddConditionalFormat(req: SheetsFormatInput & { action: 'add_conditional_format_rule' }): Promise<FormatOutput> {
    const { spreadsheetId, range, formula } = req;

    try {
      await this.context.cachedApi.addConditionalFormat(spreadsheetId, range, { formula });

      return this.success('add_conditional_format_rule', { ruleAdded: true }, true);
    } catch (error) {
      logger.error('Add conditional format failed', { spreadsheetId, range, error });
      throw error;
    }
  }
}
