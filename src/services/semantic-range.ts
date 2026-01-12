/**
 * ServalSheets - Semantic Range Finder
 *
 * Translates natural language range references into A1 notation.
 *
 * Users say: "the totals row", "email column", "last month's data"
 * Claude needs: "Sheet1!A15:Z15", "Sheet1!E:E", "Sheet1!A100:Z150"
 *
 * @module services/semantic-range
 */

import type { sheets_v4 } from "googleapis";
import { logger } from "../utils/logger.js";

// ============================================================================
// TYPES
// ============================================================================

export interface SemanticRangeQuery {
  /** Natural language description */
  description: string;
  /** Spreadsheet to search in */
  spreadsheetId: string;
  /** Optional: specific sheet to search */
  sheetName?: string;
  /** Optional: hint about what type of range */
  hint?: "row" | "column" | "cell" | "range";
}

export interface SemanticRangeResult {
  /** Whether a match was found */
  found: boolean;
  /** The A1 notation range */
  range?: string;
  /** Confidence level 0-1 */
  confidence: number;
  /** How the range was found */
  method:
    | "header_match"
    | "pattern_match"
    | "position_match"
    | "formula_detection"
    | "not_found";
  /** Additional context about the match */
  context?: string;
}

export interface SheetStructure {
  sheetName: string;
  headers: string[];
  headerRow: number;
  dataStartRow: number;
  lastRow: number;
  lastColumn: number;
  /** Special rows detected */
  specialRows: {
    totals?: number;
    averages?: number;
    headers?: number;
    footer?: number;
  };
  /** Column purposes detected */
  columnPurposes: Map<number, string>;
}

// ============================================================================
// SEMANTIC PATTERNS
// ============================================================================

/**
 * Patterns for detecting semantic row references
 */
const ROW_PATTERNS: Array<{
  pattern: RegExp;
  type: string;
  finder: (structure: SheetStructure) => number | null;
}> = [
  {
    pattern: /\b(total[s]?|sum)\s*(row)?\b/i,
    type: "totals",
    finder: (s) => s.specialRows.totals ?? null,
  },
  {
    pattern: /\b(average[s]?|avg|mean)\s*(row)?\b/i,
    type: "averages",
    finder: (s) => s.specialRows.averages ?? null,
  },
  {
    pattern: /\b(header[s]?|title[s]?)\s*(row)?\b/i,
    type: "headers",
    finder: (s) => s.specialRows.headers ?? s.headerRow,
  },
  {
    pattern: /\b(last|bottom|final)\s*(row|entry)?\b/i,
    type: "last",
    finder: (s) => s.lastRow,
  },
  {
    pattern: /\b(first|top)\s*(data\s*)?(row|entry)?\b/i,
    type: "first_data",
    finder: (s) => s.dataStartRow,
  },
  {
    pattern: /\brow\s*(\d+)\b/i,
    type: "numbered",
    finder: () => null, // Handled specially
  },
];

/**
 * Patterns for detecting semantic column references
 */
const COLUMN_PATTERNS: Array<{
  pattern: RegExp;
  type: string;
  headers: string[];
}> = [
  {
    pattern: /\b(email|e-?mail)\s*(column|col)?\b/i,
    type: "email",
    headers: ["email", "e-mail", "email address", "contact email"],
  },
  {
    pattern: /\b(name|full\s*name)\s*(column|col)?\b/i,
    type: "name",
    headers: ["name", "full name", "contact name", "customer name"],
  },
  {
    pattern: /\b(phone|telephone|mobile)\s*(column|col)?\b/i,
    type: "phone",
    headers: ["phone", "telephone", "mobile", "phone number", "contact"],
  },
  {
    pattern: /\b(date|created|updated)\s*(column|col)?\b/i,
    type: "date",
    headers: ["date", "created", "updated", "created at", "modified"],
  },
  {
    pattern: /\b(amount|total|sum|price|cost|revenue)\s*(column|col)?\b/i,
    type: "amount",
    headers: ["amount", "total", "sum", "price", "cost", "revenue", "value"],
  },
  {
    pattern: /\b(status|state)\s*(column|col)?\b/i,
    type: "status",
    headers: ["status", "state", "stage", "condition"],
  },
  {
    pattern: /\b(id|identifier|key)\s*(column|col)?\b/i,
    type: "id",
    headers: ["id", "identifier", "key", "record id", "contact id"],
  },
  {
    pattern: /\b(notes?|comments?|description)\s*(column|col)?\b/i,
    type: "notes",
    headers: ["notes", "note", "comments", "description", "remarks"],
  },
];

// ============================================================================
// SEMANTIC RANGE FINDER
// ============================================================================

/**
 * Finds ranges based on natural language descriptions
 */
export class SemanticRangeFinder {
  private structureCache = new Map<string, SheetStructure>();
  private sheetsApi: sheets_v4.Sheets;

  constructor(sheetsApi: sheets_v4.Sheets) {
    this.sheetsApi = sheetsApi;
  }

  /**
   * Find a range by semantic description
   */
  async findRange(query: SemanticRangeQuery): Promise<SemanticRangeResult> {
    const { description, spreadsheetId, sheetName } = query;
    const lowerDesc = description.toLowerCase();

    // Get or fetch structure
    const structure = await this.getSheetStructure(spreadsheetId, sheetName);
    if (!structure) {
      return {
        found: false,
        confidence: 0,
        method: "not_found",
        context: "Could not analyze spreadsheet structure",
      };
    }

    // Try different matching strategies
    const results: SemanticRangeResult[] = [];

    // 1. Try row patterns
    const rowResult = this.findRowBySemantic(lowerDesc, structure);
    if (rowResult.found) results.push(rowResult);

    // 2. Try column patterns (header matching)
    const colResult = this.findColumnBySemantic(lowerDesc, structure);
    if (colResult.found) results.push(colResult);

    // 3. Try direct header match
    const headerResult = this.findByHeaderMatch(lowerDesc, structure);
    if (headerResult.found) results.push(headerResult);

    // 4. Try formula detection (e.g., "the formula cells")
    const formulaResult = await this.findFormulaRange(
      lowerDesc,
      spreadsheetId,
      structure,
    );
    if (formulaResult.found) results.push(formulaResult);

    // Return best match
    if (results.length === 0) {
      return {
        found: false,
        confidence: 0,
        method: "not_found",
        context: `Could not find a range matching "${description}"`,
      };
    }

    // Sort by confidence and return best
    results.sort((a, b) => b.confidence - a.confidence);
    return results[0]!;
  }

  /**
   * Find row by semantic description
   */
  private findRowBySemantic(
    description: string,
    structure: SheetStructure,
  ): SemanticRangeResult {
    for (const pattern of ROW_PATTERNS) {
      const match = description.match(pattern.pattern);
      if (match) {
        // Handle numbered row specially
        if (pattern.type === "numbered" && match[1]) {
          const rowNum = parseInt(match[1], 10);
          return {
            found: true,
            range: `'${structure.sheetName}'!${rowNum}:${rowNum}`,
            confidence: 1.0,
            method: "pattern_match",
            context: `Row ${rowNum} (explicit reference)`,
          };
        }

        const rowNum = pattern.finder(structure);
        if (rowNum !== null) {
          return {
            found: true,
            range: `'${structure.sheetName}'!${rowNum}:${rowNum}`,
            confidence: 0.9,
            method: "pattern_match",
            context: `${pattern.type} row at row ${rowNum}`,
          };
        }
      }
    }

    return { found: false, confidence: 0, method: "not_found" };
  }

  /**
   * Find column by semantic description
   */
  private findColumnBySemantic(
    description: string,
    structure: SheetStructure,
  ): SemanticRangeResult {
    for (const pattern of COLUMN_PATTERNS) {
      if (pattern.pattern.test(description)) {
        // Find matching header
        const headerIndex = structure.headers.findIndex((h) =>
          pattern.headers.some(
            (ph) =>
              h.toLowerCase().includes(ph) || ph.includes(h.toLowerCase()),
          ),
        );

        if (headerIndex >= 0) {
          const colLetter = this.numberToColumn(headerIndex + 1);
          return {
            found: true,
            range: `'${structure.sheetName}'!${colLetter}:${colLetter}`,
            confidence: 0.85,
            method: "header_match",
            context: `Column ${colLetter} (${structure.headers[headerIndex]})`,
          };
        }
      }
    }

    return { found: false, confidence: 0, method: "not_found" };
  }

  /**
   * Find by direct header text match
   */
  private findByHeaderMatch(
    description: string,
    structure: SheetStructure,
  ): SemanticRangeResult {
    // Extract potential header name from description
    const headerMatch = description.match(
      /(?:the\s+)?["']?([^"']+)["']?\s*(?:column|col|field)?/i,
    );
    if (!headerMatch) {
      return { found: false, confidence: 0, method: "not_found" };
    }

    const searchTerm = headerMatch[1]!.trim().toLowerCase();

    // Find best matching header
    let bestMatch = -1;
    let bestScore = 0;

    for (let i = 0; i < structure.headers.length; i++) {
      const header = structure.headers[i]!.toLowerCase();

      // Exact match
      if (header === searchTerm) {
        bestMatch = i;
        bestScore = 1.0;
        break;
      }

      // Contains match
      if (header.includes(searchTerm) || searchTerm.includes(header)) {
        const score =
          Math.min(searchTerm.length, header.length) /
          Math.max(searchTerm.length, header.length);
        if (score > bestScore) {
          bestMatch = i;
          bestScore = score;
        }
      }
    }

    if (bestMatch >= 0 && bestScore > 0.5) {
      const colLetter = this.numberToColumn(bestMatch + 1);
      return {
        found: true,
        range: `'${structure.sheetName}'!${colLetter}:${colLetter}`,
        confidence: bestScore * 0.8,
        method: "header_match",
        context: `Column ${colLetter} matches "${structure.headers[bestMatch]}"`,
      };
    }

    return { found: false, confidence: 0, method: "not_found" };
  }

  /**
   * Find formula-containing ranges
   */
  private async findFormulaRange(
    description: string,
    _spreadsheetId: string,
    _structure: SheetStructure,
  ): Promise<SemanticRangeResult> {
    if (!description.includes("formula")) {
      return { found: false, confidence: 0, method: "not_found" };
    }

    // Formula detection not yet implemented - requires Sheets API formula introspection
    // Would need to fetch cell formulas and identify cells starting with '='
    return { found: false, confidence: 0, method: "not_found" };
  }

  /**
   * Get or fetch sheet structure
   */
  private async getSheetStructure(
    spreadsheetId: string,
    sheetName?: string,
  ): Promise<SheetStructure | null> {
    const cacheKey = `${spreadsheetId}:${sheetName ?? "default"}`;

    if (this.structureCache.has(cacheKey)) {
      return this.structureCache.get(cacheKey)!;
    }

    try {
      // Get spreadsheet metadata
      const metaResponse = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties",
      });

      const sheets = metaResponse.data.sheets ?? [];
      const targetSheet = sheetName
        ? sheets.find((s) => s.properties?.title === sheetName)
        : sheets[0];

      if (!targetSheet?.properties) {
        return null;
      }

      const actualSheetName = targetSheet.properties.title ?? "Sheet1";
      const gridProps = targetSheet.properties.gridProperties;

      // Get header row (first row)
      const headerResponse = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: `'${actualSheetName}'!1:1`,
      });

      const headers = (headerResponse.data.values?.[0] ?? []) as string[];

      // Get sample of data to detect patterns
      const dataResponse = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: `'${actualSheetName}'!A1:${this.numberToColumn(headers.length || 10)}100`,
      });

      const values = dataResponse.data.values ?? [];

      // Analyze structure
      const structure: SheetStructure = {
        sheetName: actualSheetName,
        headers,
        headerRow: 1,
        dataStartRow: 2,
        lastRow: values.length,
        lastColumn: headers.length || gridProps?.columnCount || 26,
        specialRows: this.detectSpecialRows(values),
        columnPurposes: new Map(),
      };

      this.structureCache.set(cacheKey, structure);
      return structure;
    } catch (error) {
      logger.error("Failed to get sheet structure", {
        component: "semantic-range",
        spreadsheetId,
        sheetName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Detect special rows like totals, averages
   */
  private detectSpecialRows(
    values: unknown[][],
  ): SheetStructure["specialRows"] {
    const special: SheetStructure["specialRows"] = {};

    for (let i = values.length - 1; i >= 0; i--) {
      const row = values[i];
      if (!row || row.length === 0) continue;

      const firstCell = String(row[0] ?? "").toLowerCase();

      // Detect totals row
      if (
        firstCell.includes("total") ||
        firstCell.includes("sum") ||
        firstCell === "totals"
      ) {
        special.totals = i + 1; // 1-indexed
      }

      // Detect averages row
      if (
        firstCell.includes("average") ||
        firstCell.includes("avg") ||
        firstCell === "mean"
      ) {
        special.averages = i + 1;
      }
    }

    return special;
  }

  /**
   * Convert column number to letter (1 = A, 27 = AA)
   */
  private numberToColumn(num: number): string {
    let result = "";
    while (num > 0) {
      num--;
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26);
    }
    return result;
  }

  /**
   * Clear structure cache
   */
  clearCache(): void {
    this.structureCache.clear();
  }

  /**
   * Clear cache for specific spreadsheet
   */
  clearCacheForSpreadsheet(spreadsheetId: string): void {
    for (const key of this.structureCache.keys()) {
      if (key.startsWith(spreadsheetId)) {
        this.structureCache.delete(key);
      }
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Parse natural language range references
 *
 * Examples:
 * - "A1:B10" → "A1:B10" (passthrough)
 * - "the email column" → needs semantic finder
 * - "row 5" → "5:5"
 * - "column C" → "C:C"
 */
export function parseNaturalRange(input: string): {
  type: "a1" | "semantic" | "row" | "column";
  value: string;
} {
  const trimmed = input.trim();

  // Check for A1 notation
  if (/^[A-Z]+\d+(:[A-Z]+\d+)?$/i.test(trimmed)) {
    return { type: "a1", value: trimmed.toUpperCase() };
  }

  // Check for full row reference "5:5" or "row 5"
  const rowMatch = trimmed.match(/^(?:row\s*)?(\d+)(?::(\d+))?$/i);
  if (rowMatch) {
    const start = rowMatch[1];
    const end = rowMatch[2] ?? start;
    return { type: "row", value: `${start}:${end}` };
  }

  // Check for column reference "C:C" or "column C"
  const colMatch = trimmed.match(
    /^(?:col(?:umn)?\s*)?([A-Z]+)(?::([A-Z]+))?$/i,
  );
  if (colMatch) {
    const start = colMatch[1]!.toUpperCase();
    const end = colMatch[2]?.toUpperCase() ?? start;
    return { type: "column", value: `${start}:${end}` };
  }

  // Semantic reference
  return { type: "semantic", value: trimmed };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const SemanticRange = {
  SemanticRangeFinder,
  parseNaturalRange,
  ROW_PATTERNS,
  COLUMN_PATTERNS,
};
