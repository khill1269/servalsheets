import { BaseHandler } from '../base.js';
import type { SheetsFixInput, FixOutput } from '../../schemas/fix.js';
import { logger } from '../../utils/logger.js';

export class FixCleaningHandler extends BaseHandler {
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
}
