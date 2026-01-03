/**
 * ServalSheets - Values Handler
 * 
 * Handles sheets_values tool (read, write, append, clear, find, replace)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { 
  SheetsValuesInput, 
  SheetsValuesOutput,
  ValuesArray,
} from '../schemas/index.js';

export class ValuesHandler extends BaseHandler<SheetsValuesInput, SheetsValuesOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_values', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsValuesInput): Promise<SheetsValuesOutput> {
    try {
      switch (input.action) {
        case 'read':
          return await this.handleRead(input);
        case 'write':
          return await this.handleWrite(input);
        case 'append':
          return await this.handleAppend(input);
        case 'clear':
          return await this.handleClear(input);
        case 'batch_read':
          return await this.handleBatchRead(input);
        case 'batch_write':
          return await this.handleBatchWrite(input);
        case 'batch_clear':
          return await this.handleBatchClear(input);
        case 'find':
          return await this.handleFind(input);
        case 'replace':
          return await this.handleReplace(input);
        default:
          return this.error({
            code: 'INVALID_PARAMS',
            message: `Unknown action: ${(input as { action: string }).action}`,
            retryable: false,
          });
      }
    } catch (err) {
      return this.mapError(err);
    }
  }

  protected createIntents(input: SheetsValuesInput): Intent[] {
    const baseIntent = {
      target: {
        spreadsheetId: input.spreadsheetId,
      },
      metadata: {
        sourceTool: this.toolName,
        sourceAction: input.action,
        priority: 1,
        destructive: false,
      },
    };

    switch (input.action) {
      case 'write':
        return [{
          ...baseIntent,
          type: 'SET_VALUES' as const,
          payload: { values: input.values },
          metadata: {
            ...baseIntent.metadata,
            estimatedCells: input.values.reduce((sum, row) => sum + row.length, 0),
          },
        }];
      case 'append':
        return [{
          ...baseIntent,
          type: 'APPEND_VALUES' as const,
          payload: { values: input.values },
          metadata: {
            ...baseIntent.metadata,
            estimatedCells: input.values.reduce((sum, row) => sum + row.length, 0),
          },
        }];
      case 'clear':
        return [{
          ...baseIntent,
          type: 'CLEAR_VALUES' as const,
          payload: {},
          metadata: {
            ...baseIntent.metadata,
            destructive: true,
          },
        }];
      default:
        return [];
    }
  }

  private async handleRead(
    input: Extract<SheetsValuesInput, { action: 'read' }>
  ): Promise<SheetsValuesOutput> {
    const range = await this.resolveRange(input.spreadsheetId, input.range);
    
    // Build params, only including defined values
    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
      spreadsheetId: input.spreadsheetId,
      range,
    };
    if (input.valueRenderOption) params.valueRenderOption = input.valueRenderOption;
    if (input.majorDimension) params.majorDimension = input.majorDimension;
    
    const response = await this.sheetsApi.spreadsheets.values.get(params);

    const values = (response.data.values ?? []) as ValuesArray;
    
    // Check for large data - provide summary instead of full dump
    const cellCount = values.reduce((sum, row) => sum + row.length, 0);
    const truncated = cellCount > 10000;
    
    // Build result object, only including defined values (not null)
    const result: Record<string, unknown> = {
      values: truncated ? values.slice(0, 100) : values,
      range: response.data.range ?? range,
    };
    
    // Only add optional fields if they have truthy values
    if (response.data.majorDimension) {
      result['majorDimension'] = response.data.majorDimension;
    }
    if (truncated) {
      result['truncated'] = true;
      result['resourceUri'] = `sheets:///${input.spreadsheetId}/${encodeURIComponent(range)}`;
    }
    
    return this.success('read', result);
  }

  private async handleWrite(
    input: Extract<SheetsValuesInput, { action: 'write' }>
  ): Promise<SheetsValuesOutput> {
    const range = await this.resolveRange(input.spreadsheetId, input.range);
    const cellCount = input.values.reduce((sum, row) => sum + row.length, 0);

    const updatedRows = input.values.length;
    const updatedColumns = input.values.length > 0
      ? Math.max(...input.values.map(row => row.length))
      : 0;
    let updateResult: sheets_v4.Schema$UpdateValuesResponse | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: cellCount,
      range,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: input.spreadsheetId,
          range,
          valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
          requestBody: { values: input.values },
        });
        updateResult = response.data;
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: 'Write failed',
        retryable: false,
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('write', {
        updatedCells: cellCount,
        updatedRows,
        updatedColumns,
        updatedRange: range,
      }, mutation, true);
    }

    return this.success('write', {
      updatedCells: updateResult?.updatedCells ?? 0,
      updatedRows: updateResult?.updatedRows ?? 0,
      updatedColumns: updateResult?.updatedColumns ?? 0,
      updatedRange: updateResult?.updatedRange ?? range,
    }, mutation);
  }

  private async handleAppend(
    input: Extract<SheetsValuesInput, { action: 'append' }>
  ): Promise<SheetsValuesOutput> {
    const range = await this.resolveRange(input.spreadsheetId, input.range);
    const cellCount = input.values.reduce((sum, row) => sum + row.length, 0);

    const updatedRows = input.values.length;
    const updatedColumns = input.values.length > 0
      ? Math.max(...input.values.map(row => row.length))
      : 0;
    let updates: sheets_v4.Schema$UpdateValuesResponse | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: cellCount,
      range,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.values.append({
          spreadsheetId: input.spreadsheetId,
          range,
          valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
          insertDataOption: input.insertDataOption ?? 'INSERT_ROWS',
          requestBody: { values: input.values },
        });
        updates = response.data.updates;
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: 'Append failed',
        retryable: false,
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('append', {
        updatedCells: cellCount,
        updatedRows,
        updatedColumns,
        updatedRange: range,
      }, mutation, true);
    }

    return this.success('append', {
      updatedCells: updates?.updatedCells ?? 0,
      updatedRows: updates?.updatedRows ?? 0,
      updatedColumns: updates?.updatedColumns ?? 0,
      updatedRange: updates?.updatedRange ?? range,
    }, mutation);
  }

  private async handleClear(
    input: Extract<SheetsValuesInput, { action: 'clear' }>
  ): Promise<SheetsValuesOutput> {
    const resolved = await this.context.rangeResolver.resolve(input.spreadsheetId, input.range);
    const range = resolved.a1Notation;
    const estimatedCells = this.estimateCellsFromGridRange(resolved.gridRange);
    let clearedRange: string | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells,
      range,
      highRisk: true,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.values.clear({
          spreadsheetId: input.spreadsheetId,
          range,
        });
        clearedRange = response.data.clearedRange ?? range;
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: 'Clear failed',
        retryable: false,
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('clear', {
        updatedRange: range,
      }, mutation, true);
    }

    return this.success('clear', {
      updatedRange: clearedRange ?? range,
    }, mutation);
  }

  private async handleBatchRead(
    input: Extract<SheetsValuesInput, { action: 'batch_read' }>
  ): Promise<SheetsValuesOutput> {
    const ranges = await Promise.all(
      input.ranges.map(r => this.resolveRange(input.spreadsheetId, r))
    );
    
    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Batchget = {
      spreadsheetId: input.spreadsheetId,
      ranges,
    };
    if (input.valueRenderOption) params.valueRenderOption = input.valueRenderOption;
    if (input.majorDimension) params.majorDimension = input.majorDimension;
    
    const response = await this.sheetsApi.spreadsheets.values.batchGet(params);

    return this.success('batch_read', {
      valueRanges: (response.data.valueRanges ?? []).map((vr: sheets_v4.Schema$ValueRange) => ({
        range: vr.range ?? '',
        values: (vr.values ?? []) as ValuesArray,
      })),
    });
  }

  private async handleBatchWrite(
    input: Extract<SheetsValuesInput, { action: 'batch_write' }>
  ): Promise<SheetsValuesOutput> {
    const data = await Promise.all(
      input.data.map(async d => ({
        range: await this.resolveRange(input.spreadsheetId, d.range),
        values: d.values,
      }))
    );

    const totalCells = data.reduce(
      (sum, d) => sum + d.values.reduce((s, row) => s + row.length, 0),
      0
    );
    let batchResult: sheets_v4.Schema$BatchUpdateValuesResponse | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: totalCells,
      range: data.map(d => d.range).join(','),
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.values.batchUpdate({
          spreadsheetId: input.spreadsheetId,
          requestBody: {
            valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
            data,
          },
        });
        batchResult = response.data;
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: 'Batch write failed',
        retryable: false,
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('batch_write', {
        updatedCells: totalCells,
      }, mutation, true);
    }

    return this.success('batch_write', {
      updatedCells: batchResult?.totalUpdatedCells ?? 0,
      updatedRows: batchResult?.totalUpdatedRows ?? 0,
      updatedColumns: batchResult?.totalUpdatedColumns ?? 0,
    }, mutation);
  }

  private async handleBatchClear(
    input: Extract<SheetsValuesInput, { action: 'batch_clear' }>
  ): Promise<SheetsValuesOutput> {
    const resolvedRanges = await Promise.all(
      input.ranges.map(r => this.context.rangeResolver.resolve(input.spreadsheetId, r))
    );
    const ranges = resolvedRanges.map(r => r.a1Notation);
    const estimatedCells = resolvedRanges.reduce(
      (sum, r) => sum + this.estimateCellsFromGridRange(r.gridRange),
      0
    );

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells,
      range: ranges.join(','),
      highRisk: true,
      operation: async () => {
        await this.sheetsApi.spreadsheets.values.batchClear({
          spreadsheetId: input.spreadsheetId,
          requestBody: { ranges },
        });
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: 'Batch clear failed',
        retryable: false,
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('batch_clear', {
        updatedCells: estimatedCells,
      }, mutation, true);
    }

    return this.success('batch_clear', {
      updatedCells: 0,
    }, mutation);
  }

  private async handleFind(
    input: Extract<SheetsValuesInput, { action: 'find' }>
  ): Promise<SheetsValuesOutput> {
    // Get all values in range
    const range = input.range 
      ? await this.resolveRange(input.spreadsheetId, input.range)
      : undefined;

    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
      spreadsheetId: input.spreadsheetId,
      range: range ?? 'A:ZZ',
      valueRenderOption: input.includeFormulas ? 'FORMULA' : 'FORMATTED_VALUE',
    };
    
    const response = await this.sheetsApi.spreadsheets.values.get(params);

    const values = response.data.values ?? [];
    const matches: Array<{ cell: string; value: string; row: number; column: number }> = [];
    const query = input.matchCase ? input.query : input.query.toLowerCase();
    const limit = input.limit ?? 100;

    for (let row = 0; row < values.length && matches.length < limit; row++) {
      const rowData = values[row];
      if (!rowData) continue;
      
      for (let col = 0; col < rowData.length && matches.length < limit; col++) {
        const cellValue = String(rowData[col] ?? '');
        const compareValue = input.matchCase ? cellValue : cellValue.toLowerCase();
        
        const isMatch = input.matchEntireCell
          ? compareValue === query
          : compareValue.includes(query);

        if (isMatch) {
          matches.push({
            cell: `${this.columnToLetter(col)}${row + 1}`,
            value: cellValue,
            row: row + 1,
            column: col + 1,
          });
        }
      }
    }

    return this.success('find', { matches });
  }

  private async handleReplace(
    input: Extract<SheetsValuesInput, { action: 'replace' }>
  ): Promise<SheetsValuesOutput> {
    const resolvedRange = input.range
      ? await this.resolveRange(input.spreadsheetId, input.range)
      : undefined;
    const needsEstimate = Boolean(input.safety?.dryRun || input.safety?.effectScope);
    let estimatedMatches = 0;

    if (needsEstimate) {
      const maxCells = input.safety?.effectScope?.maxCellsAffected;
      const limit = maxCells ? maxCells + 1 : 10000;
      const findInput = {
        action: 'find' as const,
        spreadsheetId: input.spreadsheetId,
        query: input.find,
        matchCase: input.matchCase ?? false,
        matchEntireCell: input.matchEntireCell ?? false,
        includeFormulas: false,
        limit,
        range: input.range,
      };

      const findResult = await this.handleFind(findInput);
      if (!findResult.success) {
        return findResult;
      }

      estimatedMatches = (findResult as { matches?: unknown[] }).matches?.length ?? 0;
    }

    let replacementsCount = 0;
    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: estimatedMatches,
      range: resolvedRange,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: input.spreadsheetId,
          requestBody: {
            requests: [{
              findReplace: {
                find: input.find,
                replacement: input.replacement,
                matchCase: input.matchCase,
                matchEntireCell: input.matchEntireCell,
                allSheets: !input.range,
              },
            }],
          },
        });

        const reply = response.data.replies?.[0]?.findReplace;
        replacementsCount = reply?.occurrencesChanged ?? 0;
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: 'Replace failed',
        retryable: false,
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('replace', {
        replacementsCount: estimatedMatches,
      }, mutation, true);
    }

    return this.success('replace', {
      replacementsCount,
    }, mutation);
  }

  private estimateCellsFromGridRange(range: {
    startRowIndex?: number;
    endRowIndex?: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
  }): number {
    if (
      range.startRowIndex === undefined ||
      range.endRowIndex === undefined ||
      range.startColumnIndex === undefined ||
      range.endColumnIndex === undefined
    ) {
      return 0;
    }

    const rows = Math.max(range.endRowIndex - range.startRowIndex, 0);
    const columns = Math.max(range.endColumnIndex - range.startColumnIndex, 0);
    return rows * columns;
  }
}
