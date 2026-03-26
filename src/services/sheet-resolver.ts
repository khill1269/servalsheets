/**
 * SheetResolver
 *
 * @purpose Intelligently resolves sheet references (by name, pattern, or position) into sheetId values
 * @category Core
 * @usage Fuzzy match sheet names, resolve ranges with A1 notation, parse formula references
 * @dependencies google-sheets-api, utils/fuzzy
 * @stateful Yes - maintains LRU cache (max 100, TTL 5 min) of resolved sheet metadata
 * @singleton No - can be instantiated per request, but caching shared across instances
 *
 * @example
 * const resolver = new SheetResolver(cachedApi);
 * const sheetId = await resolver.resolve(spreadsheetId, 'Sales Data'); // Fuzzy match
 * const range = await resolver.resolveRange(spreadsheetId, 'Sheet1!A1:B10');
 * const headers = await resolver.getHeaders(spreadsheetId, sheetId);
 */

import { logger } from '../utils/logger.js';
import { CachedSheetsApi } from './cached-sheets-api.js';
import { ValidationError, NotFoundError } from '../core/errors.js';
import type { sheets_v4 } from 'googleapis';

export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
  gridProperties: {
    rowCount: number;
    columnCount: number;
  };
}

export interface ResolveRangeResult {
  sheetId: number;
  range: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export class SheetResolver {
  private cache = new Map<string, { sheets: SheetInfo[]; timestamp: number }>();
  private readonly cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private readonly maxCacheSize = 100;

  constructor(private cachedApi: CachedSheetsApi) {}

  /**
   * Resolve a sheet reference (name, pattern, or index) to a sheetId
   */
  async resolve(spreadsheetId: string, reference: string): Promise<number> {
    const sheets = await this.getSheets(spreadsheetId);

    // Try exact match first
    const exactMatch = sheets.find((s) => s.title.toLowerCase() === reference.toLowerCase());
    if (exactMatch) return exactMatch.sheetId;

    // Try substring match (case-insensitive)
    const substringMatch = sheets.find((s) =>
      s.title.toLowerCase().includes(reference.toLowerCase())
    );
    if (substringMatch) return substringMatch.sheetId;

    // Try numeric index (0-based)
    const numericRef = parseInt(reference, 10);
    if (!isNaN(numericRef)) {
      if (numericRef < sheets.length) {
        return sheets[numericRef].sheetId;
      }
    }

    throw new NotFoundError('Sheet', reference, {
      spreadsheetId,
      availableSheets: sheets.map((s) => s.title).join(', '),
    });
  }

  /**
   * Get all sheets in a spreadsheet
   */
  async getSheets(spreadsheetId: string): Promise<SheetInfo[]> {
    const cacheKey = spreadsheetId;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.sheets;
    }

    // Fetch metadata
    const response = await this.cachedApi.getSpreadsheet(spreadsheetId, {
      fields: 'sheets(properties(sheetId,title,index,gridProperties))',
    });

    const sheets: SheetInfo[] = (response.sheets || []).map((sheet) => ({
      sheetId: sheet.properties?.sheetId || 0,
      title: sheet.properties?.title || 'Sheet',
      index: sheet.properties?.index || 0,
      gridProperties: {
        rowCount: sheet.properties?.gridProperties?.rowCount || 1000,
        columnCount: sheet.properties?.gridProperties?.columnCount || 26,
      },
    }));

    // Update cache
    this.cache.set(cacheKey, { sheets, timestamp: Date.now() });

    // Enforce max cache size
    if (this.cache.size > this.maxCacheSize) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0][0];
      this.cache.delete(oldestKey);
    }

    return sheets;
  }

  /**
   * Resolve a full A1 range notation into components
   */
  async resolveRange(
    spreadsheetId: string,
    range: string
  ): Promise<ResolveRangeResult> {
    // Parse A1 notation: "Sheet1!A1:B10" or "A1:B10"
    const match = range.match(/^(?:([^!]+)!)?([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
    if (!match) {
      throw new ValidationError('Invalid A1 range notation', { range });
    }

    const [, sheetName, startColStr, startRowStr, endColStr, endRowStr] = match;

    // Resolve sheet
    let sheetId = 0;
    if (sheetName) {
      sheetId = await this.resolve(spreadsheetId, sheetName);
    } else {
      const sheets = await this.getSheets(spreadsheetId);
      if (sheets.length > 0) {
        sheetId = sheets[0].sheetId;
      }
    }

    // Parse columns and rows
    const startCol = this.colToNumber(startColStr);
    const startRow = parseInt(startRowStr, 10) - 1; // 0-based
    const endCol = endColStr ? this.colToNumber(endColStr) : startCol;
    const endRow = endRowStr ? parseInt(endRowStr, 10) - 1 : startRow;

    return {
      sheetId,
      range,
      startRow,
      endRow,
      startCol,
      endCol,
    };
  }

  /**
   * Get headers for a sheet (first row)
   */
  async getHeaders(spreadsheetId: string, sheetId: number): Promise<string[]> {
    const sheets = await this.getSheets(spreadsheetId);
    const sheet = sheets.find((s) => s.sheetId === sheetId);
    if (!sheet) {
      throw new NotFoundError('Sheet', String(sheetId), { spreadsheetId });
    }

    const range = `'${sheet.title}'!1:1`;
    const response = await this.cachedApi.getRange(spreadsheetId, range);
    return response[0] || [];
  }

  /**
   * Parse A1 notation column letter to number (1-based)
   */
  private colToNumber(col: string): number {
    let result = 0;
    for (let i = 0; i < col.length; i++) {
      result = result * 26 + (col.charCodeAt(i) - 64);
    }
    return result;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
