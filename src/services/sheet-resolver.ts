/**
 * ServalSheets - Sheet Resolver Service
 *
 * Resolves sheet references (name or ID) to sheet metadata.
 * Enables users to reference sheets by name instead of numeric ID.
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 *
 * @module services/sheet-resolver
 */

import type { sheets_v4 } from "googleapis";
import { LRUCache } from "lru-cache";
import { logger } from "../utils/logger.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Sheet reference - can be either name or ID
 */
export interface SheetReference {
  /** Sheet name (preferred for UX) */
  sheetName?: string;
  /** Sheet ID (numeric, for API) */
  sheetId?: number;
}

/**
 * Resolved sheet information
 */
export interface ResolvedSheet {
  /** Numeric sheet ID */
  sheetId: number;
  /** Sheet title/name */
  title: string;
  /** Sheet index (0-based position) */
  index: number;
  /** Whether the sheet is hidden */
  hidden: boolean;
  /** Grid properties */
  gridProperties?: {
    rowCount: number;
    columnCount: number;
    frozenRowCount?: number;
    frozenColumnCount?: number;
  };
}

/**
 * Sheet resolution result with confidence
 */
export interface SheetResolutionResult {
  /** Resolved sheet info */
  sheet: ResolvedSheet;
  /** Resolution method used */
  method: "exact_name" | "exact_id" | "fuzzy_name" | "index";
  /** Confidence score (0-1) */
  confidence: number;
  /** Alternative matches (for fuzzy resolution) */
  alternatives?: Array<{ sheet: ResolvedSheet; similarity: number }>;
}

/**
 * Sheet resolver options
 */
export interface SheetResolverOptions {
  /** Sheets API instance */
  sheetsApi: sheets_v4.Sheets;
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
  /** Enable fuzzy matching (default: true) */
  enableFuzzyMatch?: boolean;
  /** Fuzzy match threshold (0-1, default: 0.7) */
  fuzzyThreshold?: number;
}

// ============================================================================
// Sheet Resolution Error
// ============================================================================

export class SheetResolutionError extends Error {
  public readonly code: string;
  public readonly details: Record<string, unknown>;
  public readonly retryable: boolean;
  public readonly availableSheets?: string[];

  constructor(
    message: string,
    code: string,
    details: Record<string, unknown> = {},
    availableSheets?: string[],
  ) {
    super(message);
    this.name = "SheetResolutionError";
    this.code = code;
    this.details = details;
    this.retryable = false;
    this.availableSheets = availableSheets;
  }
}

// ============================================================================
// Sheet Resolver Service
// ============================================================================

/**
 * Sheet Resolver Service
 *
 * Provides intelligent sheet resolution with caching and fuzzy matching.
 * Allows users to reference sheets by name, reducing friction.
 */
export class SheetResolver {
  private sheetsApi: sheets_v4.Sheets | null;
  private cache: LRUCache<string, ResolvedSheet[]>;
  private cacheTtlMs: number;
  private enableFuzzyMatch: boolean;
  private fuzzyThreshold: number;

  constructor(options?: SheetResolverOptions) {
    this.sheetsApi = options?.sheetsApi || null;
    this.cacheTtlMs = options?.cacheTtlMs ?? 300000; // 5 minutes
    this.enableFuzzyMatch = options?.enableFuzzyMatch ?? true;
    this.fuzzyThreshold = options?.fuzzyThreshold ?? 0.7;

    this.cache = new LRUCache<string, ResolvedSheet[]>({
      max: 500,
      ttl: this.cacheTtlMs,
      updateAgeOnGet: true,
    });

    logger.info("Sheet resolver initialized", {
      cacheTtlMs: this.cacheTtlMs,
      enableFuzzyMatch: this.enableFuzzyMatch,
      fuzzyThreshold: this.fuzzyThreshold,
    });
  }

  /**
   * Get the Sheets API instance
   * @private
   */
  private getSheetsApi(): sheets_v4.Sheets {
    if (!this.sheetsApi) {
      throw new Error("SheetResolver not initialized with sheetsApi. Call constructor with { sheetsApi } options.");
    }
    return this.sheetsApi;
  }

  /**
   * Resolve a sheet reference to sheet metadata
   *
   * @param spreadsheetId - Spreadsheet ID
   * @param reference - Sheet reference (name or ID)
   * @returns Resolved sheet information
   */
  async resolve(
    spreadsheetId: string,
    reference: SheetReference,
  ): Promise<SheetResolutionResult> {
    // Validate that at least one reference is provided
    if (reference.sheetId === undefined && reference.sheetName === undefined) {
      throw new SheetResolutionError(
        "Must provide either sheetId or sheetName",
        "NO_REFERENCE",
        {},
        [],
      );
    }

    // Get all sheets (cached)
    const sheets = await this.getSheets(spreadsheetId);

    if (sheets.length === 0) {
      throw new SheetResolutionError("Spreadsheet has no sheets", "NO_SHEETS", {
        spreadsheetId,
      });
    }

    // Resolution by ID (highest confidence)
    if (reference.sheetId !== undefined) {
      const byId = sheets.find((s) => s.sheetId === reference.sheetId);
      if (byId) {
        return {
          sheet: byId,
          method: "exact_id",
          confidence: 1.0,
        };
      }
      throw new SheetResolutionError(
        `Sheet with ID ${reference.sheetId} not found`,
        "SHEET_NOT_FOUND",
        { sheetId: reference.sheetId },
        sheets.map((s) => s.title),
      );
    }

    // Resolution by name
    if (reference.sheetName !== undefined) {
      return this.resolveByName(sheets, reference.sheetName);
    }

    // This should never be reached due to validation above,
    // but TypeScript requires all code paths to return
    throw new SheetResolutionError(
      "Invalid state: no sheet reference provided",
      "INVALID_STATE",
      {},
      [],
    );
  }

  /**
   * Resolve sheet by name with fuzzy matching support
   */
  private resolveByName(
    sheets: ResolvedSheet[],
    name: string,
  ): SheetResolutionResult {
    const nameLower = name.toLowerCase().trim();

    // Exact match (case-insensitive)
    const exact = sheets.find((s) => s.title.toLowerCase() === nameLower);
    if (exact) {
      return {
        sheet: exact,
        method: "exact_name",
        confidence: 1.0,
      };
    }

    // Fuzzy matching
    if (this.enableFuzzyMatch) {
      const matches = sheets
        .map((sheet) => ({
          sheet,
          similarity: this.calculateSimilarity(
            nameLower,
            sheet.title.toLowerCase(),
          ),
        }))
        .filter((m) => m.similarity >= this.fuzzyThreshold)
        .sort((a, b) => b.similarity - a.similarity);

      if (matches.length > 0) {
        const best = matches[0];
        if (best) {
          return {
            sheet: best.sheet,
            method: "fuzzy_name",
            confidence: best.similarity,
            alternatives:
              matches.length > 1
                ? matches.slice(1, 4).map((m) => ({
                    sheet: m.sheet,
                    similarity: m.similarity,
                  }))
                : undefined,
          };
        }
      }
    }

    throw new SheetResolutionError(
      `Sheet "${name}" not found`,
      "SHEET_NOT_FOUND",
      { searchedName: name },
      sheets.map((s) => s.title),
    );
  }

  /**
   * Calculate string similarity using Levenshtein-based metric
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0;

    // Check if one contains the other
    if (a.includes(b) || b.includes(a)) {
      const minLen = Math.min(a.length, b.length);
      const maxLen = Math.max(a.length, b.length);
      return minLen / maxLen;
    }

    // Levenshtein distance
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      const firstRow = matrix[0];
      if (firstRow) {
        firstRow[j] = j;
      }
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
        const row = matrix[i];
        const prevRow = matrix[i - 1];
        if (row && prevRow) {
          row[j] = Math.min(
            (prevRow[j] ?? 0) + 1,
            (row[j - 1] ?? 0) + 1,
            (prevRow[j - 1] ?? 0) + cost,
          );
        }
      }
    }

    const lastRow = matrix[b.length];
    const distance = lastRow?.[a.length] ?? Math.max(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    return 1 - distance / maxLen;
  }

  /**
   * Get all sheets in a spreadsheet (cached)
   */
  async getSheets(spreadsheetId: string): Promise<ResolvedSheet[]> {
    const cached = this.cache.get(spreadsheetId);
    if (cached) {
      return cached;
    }

    const api = this.getSheetsApi();
    const response = await api.spreadsheets.get({
      spreadsheetId,
      fields:
        "sheets(properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)))",
    });

    const sheets: ResolvedSheet[] = (response.data.sheets ?? []).map(
      (sheet) => ({
        sheetId: sheet.properties?.sheetId ?? 0,
        title: sheet.properties?.title ?? "Sheet",
        index: sheet.properties?.index ?? 0,
        hidden: sheet.properties?.hidden ?? false,
        gridProperties: sheet.properties?.gridProperties
          ? {
              rowCount: sheet.properties.gridProperties.rowCount ?? 1000,
              columnCount: sheet.properties.gridProperties.columnCount ?? 26,
              frozenRowCount:
                sheet.properties.gridProperties.frozenRowCount ?? undefined,
              frozenColumnCount:
                sheet.properties.gridProperties.frozenColumnCount ?? undefined,
            }
          : undefined,
      }),
    );

    this.cache.set(spreadsheetId, sheets);
    return sheets;
  }

  /**
   * Resolve multiple sheet references
   */
  async resolveMultiple(
    spreadsheetId: string,
    references: SheetReference[],
  ): Promise<SheetResolutionResult[]> {
    const sheets = await this.getSheets(spreadsheetId);
    return references.map((ref) => {
      if (ref.sheetId !== undefined) {
        const byId = sheets.find((s) => s.sheetId === ref.sheetId);
        if (byId) {
          return { sheet: byId, method: "exact_id" as const, confidence: 1.0 };
        }
      }
      if (ref.sheetName !== undefined) {
        return this.resolveByName(sheets, ref.sheetName);
      }
      const first = sheets[0];
      if (first) {
        return { sheet: first, method: "index" as const, confidence: 0.8 };
      }
      throw new SheetResolutionError("No sheets available", "NO_SHEETS", {});
    });
  }

  /**
   * Get sheet by index (0-based)
   */
  async getSheetByIndex(
    spreadsheetId: string,
    index: number,
  ): Promise<ResolvedSheet | null> {
    const sheets = await this.getSheets(spreadsheetId);
    return sheets.find((s) => s.index === index) ?? null;
  }

  /**
   * List all sheet names in a spreadsheet
   */
  async listSheetNames(spreadsheetId: string): Promise<string[]> {
    const sheets = await this.getSheets(spreadsheetId);
    return sheets.map((s) => s.title);
  }

  /**
   * Invalidate cache for a spreadsheet
   */
  invalidate(spreadsheetId: string): void {
    this.cache.delete(spreadsheetId);
  }

  /**
   * Invalidate cache for a spreadsheet (alias for invalidate)
   */
  invalidateCache(spreadsheetId: string): void {
    this.invalidate(spreadsheetId);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; max: number } {
    return {
      size: this.cache.size,
      max: this.cache.max,
    };
  }

  /**
   * Get all sheets for a spreadsheet (alias for getSheets)
   */
  async getAllSheets(spreadsheetId: string): Promise<ResolvedSheet[]> {
    return this.getSheets(spreadsheetId);
  }

  /**
   * Get a sheet by name
   */
  async getSheetByName(
    spreadsheetId: string,
    sheetName: string,
    _auth?: unknown, // For test compatibility
  ): Promise<{ properties?: { sheetId: number; title: string } } | undefined> {
    const sheets = await this.getSheets(spreadsheetId);
    // Case-insensitive search
    const sheet = sheets.find(
      (s) => s.title.toLowerCase() === sheetName.toLowerCase(),
    );

    if (!sheet) {
      return undefined;
    }

    // Return in format expected by tests
    return {
      properties: {
        sheetId: sheet.sheetId,
        title: sheet.title,
      },
    };
  }

  /**
   * Get a sheet by ID
   */
  async getSheetById(
    spreadsheetId: string,
    sheetId: number,
    _auth?: unknown, // For test compatibility
  ): Promise<{ properties?: { sheetId: number; title: string } } | undefined> {
    const sheets = await this.getSheets(spreadsheetId);
    const sheet = sheets.find((s) => s.sheetId === sheetId);

    if (!sheet) {
      return undefined;
    }

    // Return in format expected by tests
    return {
      properties: {
        sheetId: sheet.sheetId,
        title: sheet.title,
      },
    };
  }

  // ==================== Extended Sheet Resolver Features ====================

  /**
   * Resolve a range reference to A1 notation
   * Handles A1 notation, named ranges, and semantic queries
   */
  async resolveRange(
    spreadsheetId: string,
    range: string | { semantic: { column: string; sheet: string } },
    _auth: unknown, // For test compatibility
  ): Promise<{
    resolvedRange: string;
    wasResolved: boolean;
    originalInput: string | object;
  }> {
    const originalInput = range;

    // Handle semantic queries
    if (typeof range === "object" && "semantic" in range) {
      const { column, sheet } = range.semantic;
      const columnIndex = await this.findColumnByHeader(spreadsheetId, sheet, column, _auth);

      if (columnIndex === -1) {
        throw new Error(`Column "${column}" not found in sheet "${sheet}"`);
      }

      const columnLetter = this.columnIndexToLetter(columnIndex);
      const resolvedRange = `${sheet}!${columnLetter}:${columnLetter}`;

      return {
        resolvedRange,
        wasResolved: true,
        originalInput,
      };
    }

    // If already A1 notation, pass through
    // A1 notation patterns: A1, A1:B10, Sheet1!A1:B10, 'My Sheet'!A1, A:B, 1:10
    if (typeof range === "string") {
      // Remove optional sheet qualifier to check the range part
      const rangeWithoutSheet = range.includes("!")
        ? range.split("!")[1] || range
        : range;

      // Check if it's A1 notation (cells, ranges, column-only, or row-only)
      const isA1Notation =
        /^[A-Z]+[0-9]+/.test(rangeWithoutSheet) || // A1 or A1:B10
        /^[A-Z]+:[A-Z]+$/.test(rangeWithoutSheet) || // A:B
        /^[0-9]+:[0-9]+$/.test(rangeWithoutSheet); // 1:10

      if (isA1Notation) {
        return {
          resolvedRange: range,
          wasResolved: false,
          originalInput,
        };
      }
    }

    // Try to resolve as named range
    const api = this.getSheetsApi();
    const response = await api.spreadsheets.get({
      spreadsheetId,
      fields: "namedRanges(name,range)",
    });

    const namedRange = response.data.namedRanges?.find((nr) => nr.name === range);

    if (!namedRange || !namedRange.range) {
      throw new Error(`Named range "${range}" not found`);
    }

    // Convert GridRange to A1 notation
    const nr = namedRange.range;
    const sheets = await this.getSheets(spreadsheetId);
    const sheet = sheets.find((s) => s.sheetId === nr.sheetId);
    const sheetName = sheet?.title || "Sheet1";

    const startCol = this.columnIndexToLetter(nr.startColumnIndex ?? 0);
    const endCol = this.columnIndexToLetter((nr.endColumnIndex ?? 1) - 1);
    const startRow = (nr.startRowIndex ?? 0) + 1;
    const endRow = (nr.endRowIndex ?? 1);

    const resolvedRange = `${sheetName}!${startCol}${startRow}:${endCol}${endRow}`;

    return {
      resolvedRange,
      wasResolved: true,
      originalInput,
    };
  }

  /**
   * Get all named ranges in a spreadsheet
   */
  async getNamedRanges(
    spreadsheetId: string,
    _auth: unknown, // For test compatibility
  ): Promise<Array<{ name: string; range: sheets_v4.Schema$GridRange | null | undefined }>> {
    const api = this.getSheetsApi();
    const response = await api.spreadsheets.get({
      spreadsheetId,
      fields: "namedRanges",
    });

    // Filter out named ranges without names and cast to expected type
    return (response.data.namedRanges || []).filter((nr): nr is { name: string; range: sheets_v4.Schema$GridRange | null | undefined } => !!nr.name);
  }

  /**
   * Find column index by header name
   * Returns 0-based column index, or -1 if not found
   */
  async findColumnByHeader(
    spreadsheetId: string,
    sheetName: string,
    headerName: string,
    _auth: unknown, // For test compatibility
  ): Promise<number> {
    const headers = await this.getHeaders(spreadsheetId, sheetName, _auth);
    const headerLower = headerName.toLowerCase();

    return headers.findIndex((h) => h.toLowerCase() === headerLower);
  }

  /**
   * Get headers (first row) from a sheet
   */
  async getHeaders(
    spreadsheetId: string,
    sheetName: string,
    _auth: unknown, // For test compatibility
  ): Promise<string[]> {
    const api = this.getSheetsApi();
    const response = await api.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      return [];
    }

    const firstRow = response.data.values[0];
    if (!firstRow) {
      return [];
    }

    return firstRow.map((v) => String(v));
  }

  /**
   * Convert 0-based column index to letter (A, B, ..., Z, AA, AB, ...)
   */
  columnIndexToLetter(index: number): string {
    let letter = "";
    let num = index + 1; // Convert to 1-based

    while (num > 0) {
      const remainder = (num - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      num = Math.floor((num - 1) / 26);
    }

    return letter;
  }

  /**
   * Convert column letter to 0-based index (A->0, B->1, ..., AA->26)
   */
  letterToColumnIndex(letter: string): number {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1; // Convert to 0-based
  }

  /**
   * Parse A1 notation into components
   */
  parseA1Notation(notation: string): {
    sheetName?: string;
    startColumn?: string;
    startRow?: number;
    endColumn?: string;
    endRow?: number;
  } {
    // Handle sheet-qualified references like 'Sheet1'!A1:B2
    let sheetName: string | undefined;
    let rangeStr = notation;

    if (notation.includes("!")) {
      const parts = notation.split("!");
      const extractedSheetName = parts[0];
      const extractedRange = parts[1];

      if (extractedSheetName && extractedRange) {
        sheetName = extractedSheetName;
        rangeStr = extractedRange;

        // Remove quotes from sheet name if present
        if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
          sheetName = sheetName.slice(1, -1);
        }
      }
    }

    // Parse the range part
    if (rangeStr.includes(":")) {
      const parts = rangeStr.split(":");
      const start = parts[0];
      const end = parts[1];

      if (!start || !end) {
        throw new Error(`Invalid A1 notation: ${notation}`);
      }

      // Check if it's a row-only range (e.g., "1:10")
      if (/^\d+$/.test(start) && /^\d+$/.test(end)) {
        return {
          sheetName,
          startRow: parseInt(start, 10),
          endRow: parseInt(end, 10),
        };
      }

      // Parse start cell
      const startMatch = start.match(/^([A-Z]+)(\d+)?$/);
      if (!startMatch) {
        throw new Error(`Invalid A1 notation: ${notation}`);
      }

      const startColumn = startMatch[1];
      const startRow = startMatch[2] ? parseInt(startMatch[2], 10) : undefined;

      // Parse end cell
      const endMatch = end.match(/^([A-Z]+)(\d+)?$/);
      if (!endMatch) {
        throw new Error(`Invalid A1 notation: ${notation}`);
      }

      const endColumn = endMatch[1];
      const endRow = endMatch[2] ? parseInt(endMatch[2], 10) : undefined;

      return {
        sheetName,
        startColumn,
        startRow,
        endColumn,
        endRow,
      };
    } else {
      // Single cell reference
      const match = rangeStr.match(/^([A-Z]+)(\d+)?$/);
      if (!match) {
        throw new Error(`Invalid A1 notation: ${notation}`);
      }

      return {
        sheetName,
        startColumn: match[1],
        startRow: match[2] ? parseInt(match[2], 10) : undefined,
      };
    }
  }

  /**
   * Build A1 notation from components
   */
  buildA1Notation(components: {
    sheetName?: string;
    startColumn: string;
    startRow?: number;
    endColumn?: string;
    endRow?: number;
  }): string {
    const { sheetName, startColumn, startRow, endColumn, endRow } = components;

    // Build the range part
    let range = startColumn;
    if (startRow) {
      range += startRow;
    }

    if (endColumn) {
      range += `:${endColumn}`;
      if (endRow) {
        range += endRow;
      }
    }

    // Add sheet name if present
    if (sheetName) {
      // Quote sheet name if it contains special characters
      const needsQuotes = /[^a-zA-Z0-9_]/.test(sheetName);
      const quotedName = needsQuotes ? `'${sheetName}'` : sheetName;
      return `${quotedName}!${range}`;
    }

    return range;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let sheetResolverInstance: SheetResolver | null = null;

/**
 * Get or create the sheet resolver singleton
 */
export function getSheetResolver(
  options?: SheetResolverOptions,
): SheetResolver | null {
  if (!sheetResolverInstance && options) {
    sheetResolverInstance = new SheetResolver(options);
  }
  return sheetResolverInstance;
}

/**
 * Set the sheet resolver (for testing or custom configuration)
 */
export function setSheetResolver(resolver: SheetResolver | null): void {
  sheetResolverInstance = resolver;
}

/**
 * Initialize sheet resolver with Sheets API
 */
export function initializeSheetResolver(
  sheetsApi: sheets_v4.Sheets,
  options?: Omit<SheetResolverOptions, "sheetsApi">,
): SheetResolver {
  sheetResolverInstance = new SheetResolver({
    sheetsApi,
    ...options,
  });
  return sheetResolverInstance;
}

/**
 * Reset the sheet resolver (for testing only)
 * @internal
 */
export function resetSheetResolver(): void {
  if (process.env["NODE_ENV"] !== "test" && process.env["VITEST"] !== "true") {
    throw new Error(
      "resetSheetResolver() can only be called in test environment",
    );
  }
  sheetResolverInstance = null;
}
