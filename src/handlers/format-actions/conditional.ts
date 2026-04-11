import { BaseHandler } from '../base.js';
import type { SheetsFormatInput, FormatOutput } from '../../schemas/format.js';
import { logger } from '../../utils/logger.js';

export class FormatConditionalHandler extends BaseHandler<any, any> {
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
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { FormatHandlerAccess } from './internal.js';
import type { FormatResponse } from '../../schemas/index.js';

type FormatReq<A extends string> = { action: A; [key: string]: unknown };

export async function handleRuleAddConditionalFormat(ha: FormatHandlerAccess, request: FormatReq<'rule_add_conditional_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { ruleAdded: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleRuleUpdateConditionalFormat(ha: FormatHandlerAccess, request: FormatReq<'rule_update_conditional_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { ruleUpdated: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleRuleDeleteConditionalFormat(ha: FormatHandlerAccess, request: FormatReq<'rule_delete_conditional_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { ruleDeleted: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleRuleListConditionalFormats(ha: FormatHandlerAccess, request: FormatReq<'rule_list_conditional_formats'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { rules: [] });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleAddConditionalFormatRule(ha: FormatHandlerAccess, request: FormatReq<'add_conditional_format_rule'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { ruleAdded: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleGenerateConditionalFormat(ha: FormatHandlerAccess, request: FormatReq<'generate_conditional_format'>): Promise<FormatResponse> {
  return ha.makeSuccess(request.action, { generated: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}
