import { BaseHandler } from '../base.js';
import type { SheetsTemplatesInput, TemplatesOutput } from '../../schemas/templates.js';
import { logger } from '../../utils/logger.js';

export class TemplatesOperationsHandler extends BaseHandler {
  async handleCreate(req: SheetsTemplatesInput & { action: 'create' }): Promise<TemplatesOutput> {
    const { spreadsheetId, templateName } = req;

    try {
      const template = await this.context.cachedApi.get(spreadsheetId, undefined);
      const saved = await this.context.templateService.save(templateName, template);

      return this.success('create', { template: saved }, false);
    } catch (error) {
      logger.error('Create template failed', { spreadsheetId, error });
      throw error;
    }
  }

  async handleApply(req: SheetsTemplatesInput & { action: 'apply' }): Promise<TemplatesOutput> {
    const { spreadsheetId, templateId } = req;

    try {
      const template = await this.context.templateService.load(templateId);
      await this.context.cachedApi.batchUpdate(spreadsheetId, template.operations);

      return this.success('apply', { applied: true }, true);
    } catch (error) {
      logger.error('Apply template failed', { spreadsheetId, error });
      throw error;
    }
  }
}
