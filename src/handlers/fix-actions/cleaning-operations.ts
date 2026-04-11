import { BaseHandler } from '../base.js';
import type { SheetsFixInput, FixOutput } from '../../schemas/fix.js';
import { logger } from '../../utils/logger.js';

export class FixCleaningHandler extends BaseHandler<any, any> {
  async handleClean(req: SheetsFixInput & { action: 'clean' }): Promise<FixOutput> {
    const { spreadsheetId, range } = req;

    try {
      const data = await this.context.cachedApi.get(spreadsheetId, range);
      const cleaned = await this.cleanData(data);

      return this.success('clean', { cleaned, summary: { rowsCleaned: cleaned.length } }, true);
    } catch (error) {
      logger.error('Clean operation failed', { spreadsheetId, error });
      throw error;
    }
  }

  private async cleanData(data: any[][]): Promise<any[][]> {
    return data.map((row) =>
      row.map((cell) => {
        if (typeof cell === 'string') {
          return cell.trim();
        }
        return cell;
      })
    );
  }
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

// Standalone function exports for parent handler dispatch
import type { FixHandlerAccess } from './internal.js';
import type { CleanInput, StandardizeFormatsInput, FillMissingInput, SheetsFixOutput } from '../../schemas/fix.js';

export async function handleCleanAction(
  handler: FixHandlerAccess,
  req: CleanInput,
  _verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  const { spreadsheetId, range } = req;
  try {
    const data = await handler._fetchRangeData(spreadsheetId!, range as string);
    const cleaned = data.map((row) =>
      row.map((cell) => {
        if (typeof cell === 'string') return cell.trim();
        return cell;
      })
    );
    const response = {
      success: true as const,
      action: 'clean' as const,
      cleaned,
      summary: { rowsCleaned: cleaned.length },
    };
    return { response: handler._applyVerbosityFilter(response, _verbosity) };
  } catch (error) {
    return { response: handler._mapError(error) };
  }
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleStandardizeFormatsAction(
  handler: FixHandlerAccess,
  req: StandardizeFormatsInput,
  _verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  return { response: handler._mapError(new Error('standardize_formats: not yet migrated to standalone function')) };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}

export async function handleFillMissingAction(
  handler: FixHandlerAccess,
  req: FillMissingInput,
  _verbosity: 'minimal' | 'standard' | 'detailed'
): Promise<SheetsFixOutput> {
  return { response: handler._mapError(new Error('fill_missing: not yet migrated to standalone function')) };
  async handle(input: any): Promise<any> { throw new Error('Not implemented - use specific action methods'); }
}
