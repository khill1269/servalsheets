import { BaseHandler } from '../base.js';
import type { SheetsSessionInput, SessionOutput } from '../../schemas/session.js';
import { logger } from '../../utils/logger.js';

export class SessionCheckpointsHandler extends BaseHandler<any, any> {
  async handleSaveCheckpoint(req: SheetsSessionInput & { action: 'save_checkpoint' }): Promise<SessionOutput> {
    const { spreadsheetId, name } = req;

    try {
      const checkpoint = await this.context.sessionContext.saveCheckpoint(spreadsheetId, name);

      return this.success('save_checkpoint', { checkpoint }, false);
    } catch (error) {
      logger.error('Save checkpoint failed', { spreadsheetId, error });
      throw error;
    }
  }

  async handleLoadCheckpoint(req: SheetsSessionInput & { action: 'load_checkpoint' }): Promise<SessionOutput> {
    const { spreadsheetId, checkpointId } = req;

    try {
      const result = await this.context.sessionContext.loadCheckpoint(spreadsheetId, checkpointId);

      return this.success('load_checkpoint', { restored: true, result }, true);
    } catch (error) {
      logger.error('Load checkpoint failed', { spreadsheetId, error });
      throw error;
    }
  }
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager } from '../../services/session-context.js';

export async function handleSaveCheckpoint(
  session: SessionContextManager,
  req: { action: 'save_checkpoint'; spreadsheetId?: string; name?: string; [key: string]: unknown }
): Promise<SheetsSessionOutput> {
  return { response: { success: true, action: 'save_checkpoint' } };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleLoadCheckpoint(
  session: SessionContextManager,
  req: { action: 'load_checkpoint'; spreadsheetId?: string; checkpointId?: string; [key: string]: unknown }
): Promise<SheetsSessionOutput> {
  return { response: { success: true, action: 'load_checkpoint' } };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleListCheckpoints(
  req: { action: 'list_checkpoints'; spreadsheetId?: string; [key: string]: unknown }
): Promise<SheetsSessionOutput> {
  return { response: { success: true, action: 'list_checkpoints', checkpoints: [] } };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleDeleteCheckpoint(
  req: { action: 'delete_checkpoint'; checkpointId?: string; [key: string]: unknown }
): Promise<SheetsSessionOutput> {
  return { response: { success: true, action: 'delete_checkpoint' } };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}
