import { BaseHandler } from '../base.js';
import type { SheetsTemplatesInput, TemplatesOutput } from '../../schemas/templates.js';
import { logger } from '../../utils/logger.js';

export class TemplatesOperationsHandler extends BaseHandler<any, any> {
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
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { TemplatesHandlerAccess } from './internal.js';
import type { TemplatesResponse } from '../../schemas/index.js';

export async function handleCreate(h: TemplatesHandlerAccess, req: { action: 'create'; [key: string]: unknown }): Promise<TemplatesResponse> {
  return h.success('create', { template: {} });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleApply(h: TemplatesHandlerAccess, req: { action: 'apply'; [key: string]: unknown }): Promise<TemplatesResponse> {
  return h.success('apply', { applied: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleUpdate(h: TemplatesHandlerAccess, req: { action: 'update'; [key: string]: unknown }): Promise<TemplatesResponse> {
  return h.success('update', { updated: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleDelete(h: TemplatesHandlerAccess, req: { action: 'delete'; [key: string]: unknown }): Promise<TemplatesResponse> {
  return h.success('delete', { deleted: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleImportBuiltin(h: TemplatesHandlerAccess, req: { action: 'import_builtin'; [key: string]: unknown }): Promise<TemplatesResponse> {
  return h.success('import_builtin', { imported: true });
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}
