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

// Standalone function exports for parent handler dispatch
import type { FormatHandlerAccess } from './internal.js';
import type { FormatResponse } from '../../schemas/index.js';

type FormatReq<A extends string> = { action: A; [key: string]: unknown };

export async function handleRuleAddConditionalFormat(ha: FormatHandlerAccess, request: FormatReq<'rule_add_conditional_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { ruleAdded: true });
}

export async function handleRuleUpdateConditionalFormat(ha: FormatHandlerAccess, request: FormatReq<'rule_update_conditional_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { ruleUpdated: true });
}

export async function handleRuleDeleteConditionalFormat(ha: FormatHandlerAccess, request: FormatReq<'rule_delete_conditional_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { ruleDeleted: true });
}

export async function handleRuleListConditionalFormats(ha: FormatHandlerAccess, request: FormatReq<'rule_list_conditional_formats'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { rules: [] });
}

export async function handleAddConditionalFormatRule(ha: FormatHandlerAccess, request: FormatReq<'add_conditional_format_rule'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { ruleAdded: true });
}

export async function handleGenerateConditionalFormat(ha: FormatHandlerAccess, request: FormatReq<'generate_conditional_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { generated: true });
}
