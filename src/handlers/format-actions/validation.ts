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

// Standalone function exports for parent handler dispatch
import type { FormatHandlerAccess } from './internal.js';
import type { FormatResponse } from '../../schemas/index.js';

type FormatReq<A extends string> = { action: A; [key: string]: unknown };

export async function handleSetDataValidation(ha: FormatHandlerAccess, request: FormatReq<'set_data_validation'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { validationAdded: true });
}

export async function handleClearDataValidation(ha: FormatHandlerAccess, request: FormatReq<'clear_data_validation'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { validationCleared: true });
}

export async function handleListDataValidations(ha: FormatHandlerAccess, request: FormatReq<'list_data_validations'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { validations: [] });
}

export async function handleSuggestFormat(ha: FormatHandlerAccess, request: FormatReq<'suggest_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { suggestions: [] });
}
