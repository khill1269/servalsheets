/**
 * ServalSheets - Request Merger Service
 *
 * Merges overlapping read requests to reduce API calls by 20-40%
 *
 * Features:
 * - Time-window based request collection
 * - A1 notation parsing and overlap detection
 * - Range merging and response splitting
 * - Promise-based request queuing
 * - Metrics tracking
 *
 * Architecture:
 * 1. Collect incoming requests in a time window (default 50ms)
 * 2. Detect overlapping/adjacent ranges
 * 3. Merge into minimal bounding range
 * 4. Execute single API call
 * 5. Split response back to individual requesters
 */

import type { sheets_v4 } from "googleapis";
import { logger } from "../utils/logger.js";

/**
 * Parsed A1 range information
 */
export interface RangeInfo {
  /** Sheet name (empty for default sheet) */
  sheetName: string;
  /** Start row (1-indexed, 0 = unbounded) */
  startRow: number;
  /** Start column (1-indexed, 0 = unbounded) */
  startCol: number;
  /** End row (1-indexed, 0 = unbounded) */
  endRow: number;
  /** End column (1-indexed, 0 = unbounded) */
  endCol: number;
  /** Original A1 notation */
  originalA1: string;
}

/**
 * Read request options
 */
export interface ReadOptions {
  valueRenderOption?: "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA";
  majorDimension?: "ROWS" | "COLUMNS";
}

/**
 * Pending read request
 */
interface PendingRequest {
  rangeInfo: RangeInfo;
  options: ReadOptions;
  resolve: (value: sheets_v4.Schema$ValueRange) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Request group for merging
 */
interface RequestGroup {
  spreadsheetId: string;
  requests: PendingRequest[];
  timer: NodeJS.Timeout;
}

/**
 * Merger statistics
 */
export interface MergerStats {
  enabled: boolean;
  totalRequests: number;
  mergedRequests: number;
  apiCalls: number;
  savingsRate: number;
  averageWindowSize: number;
  windowTimeMs: number;
}

/**
 * Request Merger Configuration
 */
export interface RequestMergerConfig {
  /** Enable request merging */
  enabled?: boolean;
  /** Time window for collecting requests (ms) */
  windowMs?: number;
  /** Maximum requests per window */
  maxWindowSize?: number;
  /** Enable adjacency merging (merge adjacent but non-overlapping ranges) */
  mergeAdjacent?: boolean;
}

/**
 * Request Merger Service
 *
 * Reduces API calls by merging overlapping read requests into single calls.
 *
 * Example:
 * - Request 1: Sheet1!A1:C10
 * - Request 2: Sheet1!B5:D15
 * - Merged:    Sheet1!A1:D15 (single API call)
 * - Split responses back to individual requesters
 */
export class RequestMerger {
  private enabled: boolean;
  private windowMs: number;
  private maxWindowSize: number;
  private mergeAdjacent: boolean;

  // Request queues per spreadsheet
  private pendingGroups = new Map<string, RequestGroup>();

  // Metrics
  private stats = {
    totalRequests: 0,
    mergedRequests: 0,
    apiCalls: 0,
    windowSizes: [] as number[],
  };

  constructor(config: RequestMergerConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.windowMs = config.windowMs ?? 50;
    this.maxWindowSize = config.maxWindowSize ?? 100;
    this.mergeAdjacent = config.mergeAdjacent ?? true;

    logger.info("RequestMerger initialized", {
      enabled: this.enabled,
      windowMs: this.windowMs,
      maxWindowSize: this.maxWindowSize,
      mergeAdjacent: this.mergeAdjacent,
    });
  }

  /**
   * Queue a read request for potential merging
   *
   * @param sheetsApi Google Sheets API client
   * @param spreadsheetId Spreadsheet ID
   * @param range A1 notation range
   * @param options Read options
   * @returns Promise resolving to ValueRange
   */
  async mergeRead(
    sheetsApi: sheets_v4.Sheets,
    spreadsheetId: string,
    range: string,
    options: ReadOptions = {},
  ): Promise<sheets_v4.Schema$ValueRange> {
    // If merging disabled, execute directly
    if (!this.enabled) {
      const response = await sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: options.valueRenderOption,
        majorDimension: options.majorDimension,
      });
      this.stats.totalRequests++;
      this.stats.apiCalls++;
      return response.data;
    }

    // Parse range
    const rangeInfo = parseA1Range(range);

    // Create promise for this request
    return new Promise<sheets_v4.Schema$ValueRange>((resolve, reject) => {
      this.stats.totalRequests++;

      const request: PendingRequest = {
        rangeInfo,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Get or create request group for this spreadsheet
      let group = this.pendingGroups.get(spreadsheetId);

      if (!group) {
        // Create new group with timer
        group = {
          spreadsheetId,
          requests: [request],
          timer: setTimeout(() => {
            this.flushGroup(sheetsApi, spreadsheetId);
          }, this.windowMs),
        };
        this.pendingGroups.set(spreadsheetId, group);
      } else {
        // Add to existing group
        group.requests.push(request);

        // Flush immediately if window is full
        if (group.requests.length >= this.maxWindowSize) {
          clearTimeout(group.timer);
          this.flushGroup(sheetsApi, spreadsheetId);
        }
      }
    });
  }

  /**
   * Flush a request group - merge and execute
   */
  private async flushGroup(
    sheetsApi: sheets_v4.Sheets,
    spreadsheetId: string,
  ): Promise<void> {
    const group = this.pendingGroups.get(spreadsheetId);
    if (!group || group.requests.length === 0) {
      return;
    }

    // Remove from pending
    this.pendingGroups.delete(spreadsheetId);

    const { requests } = group;
    this.stats.windowSizes.push(requests.length);

    try {
      // Group by sheet and options
      const groupsBySheet = this.groupRequestsBySheet(requests);

      // Process each sheet group
      for (const [sheetKey, sheetRequests] of groupsBySheet) {
        await this.processSheetGroup(
          sheetsApi,
          spreadsheetId,
          sheetKey,
          sheetRequests,
        );
      }
    } catch (error) {
      // Reject all requests on catastrophic failure
      for (const request of requests) {
        request.reject(
          error instanceof Error ? error : new Error("Request merge failed"),
        );
      }
    }
  }

  /**
   * Group requests by sheet name and options
   */
  private groupRequestsBySheet(
    requests: PendingRequest[],
  ): Map<string, PendingRequest[]> {
    const groups = new Map<string, PendingRequest[]>();

    for (const request of requests) {
      // Create key from sheet name and options
      const key = `${request.rangeInfo.sheetName}:${request.options.valueRenderOption || "FORMATTED_VALUE"}:${request.options.majorDimension || "ROWS"}`;

      const group = groups.get(key) || [];
      group.push(request);
      groups.set(key, group);
    }

    return groups;
  }

  /**
   * Process a group of requests for the same sheet
   */
  private async processSheetGroup(
    sheetsApi: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetKey: string,
    requests: PendingRequest[],
  ): Promise<void> {
    if (requests.length === 0) return;

    // If only one request, execute directly
    if (requests.length === 1) {
      const request = requests[0]!;
      try {
        const response = await sheetsApi.spreadsheets.values.get({
          spreadsheetId,
          range: request.rangeInfo.originalA1,
          valueRenderOption: request.options.valueRenderOption,
          majorDimension: request.options.majorDimension,
        });
        this.stats.apiCalls++;
        request.resolve(response.data);
      } catch (error) {
        request.reject(
          error instanceof Error ? error : new Error("API call failed"),
        );
      }
      return;
    }

    // Find mergeable ranges
    const mergeGroups = this.findMergeableGroups(requests);

    logger.debug("Request merge analysis", {
      spreadsheetId,
      sheetKey,
      totalRequests: requests.length,
      mergeGroups: mergeGroups.length,
      savings: requests.length - mergeGroups.length,
    });

    // Execute each merge group
    for (const group of mergeGroups) {
      await this.executeMergedRequest(sheetsApi, spreadsheetId, group);
    }

    // Update merge statistics
    this.stats.mergedRequests += requests.length - mergeGroups.length;
  }

  /**
   * Find groups of overlapping/adjacent ranges to merge
   */
  private findMergeableGroups(requests: PendingRequest[]): PendingRequest[][] {
    const groups: PendingRequest[][] = [];
    const remaining = [...requests];

    while (remaining.length > 0) {
      const current = remaining.shift()!;
      const group = [current];

      // Find all requests that overlap with this one
      let i = 0;
      while (i < remaining.length) {
        const candidate = remaining[i]!;

        // Check if any request in the group overlaps with candidate
        const overlaps = group.some((r) =>
          this.shouldMerge(r.rangeInfo, candidate.rangeInfo),
        );

        if (overlaps) {
          group.push(candidate);
          remaining.splice(i, 1);
          // Restart search from beginning to catch transitive overlaps
          i = 0;
        } else {
          i++;
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Check if two ranges should be merged
   */
  private shouldMerge(range1: RangeInfo, range2: RangeInfo): boolean {
    // Must be on same sheet
    if (range1.sheetName !== range2.sheetName) {
      return false;
    }

    // Check for overlap or adjacency
    if (this.mergeAdjacent) {
      return rangesOverlapOrAdjacent(range1, range2);
    } else {
      return rangesOverlap(range1, range2);
    }
  }

  /**
   * Execute a merged request and split response
   */
  private async executeMergedRequest(
    sheetsApi: sheets_v4.Sheets,
    spreadsheetId: string,
    requests: PendingRequest[],
  ): Promise<void> {
    try {
      // Merge all ranges into bounding box
      const mergedRange = mergeRanges(requests.map((r) => r.rangeInfo));
      const mergedA1 = formatA1Range(mergedRange);

      // Use options from first request (all in group have same options)
      const options = requests[0]!.options;

      logger.debug("Executing merged request", {
        spreadsheetId,
        mergedRange: mergedA1,
        requestCount: requests.length,
      });

      // Execute single API call
      const response = await sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: mergedA1,
        valueRenderOption: options.valueRenderOption,
        majorDimension: options.majorDimension,
      });

      this.stats.apiCalls++;

      // Split response to individual requesters
      for (const request of requests) {
        try {
          const split = splitResponse(
            response.data,
            mergedRange,
            request.rangeInfo,
          );
          request.resolve(split);
        } catch (error) {
          request.reject(
            error instanceof Error
              ? error
              : new Error("Failed to split response"),
          );
        }
      }
    } catch (error) {
      // Reject all requests in this group
      for (const request of requests) {
        request.reject(
          error instanceof Error ? error : new Error("Merged request failed"),
        );
      }
    }
  }

  /**
   * Get merger statistics
   */
  getStats(): MergerStats {
    const avgWindowSize =
      this.stats.windowSizes.length > 0
        ? this.stats.windowSizes.reduce((a, b) => a + b, 0) /
          this.stats.windowSizes.length
        : 0;

    const savingsRate =
      this.stats.totalRequests > 0
        ? ((this.stats.totalRequests - this.stats.apiCalls) /
            this.stats.totalRequests) *
          100
        : 0;

    return {
      enabled: this.enabled,
      totalRequests: this.stats.totalRequests,
      mergedRequests: this.stats.mergedRequests,
      apiCalls: this.stats.apiCalls,
      savingsRate,
      averageWindowSize: avgWindowSize,
      windowTimeMs: this.windowMs,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      mergedRequests: 0,
      apiCalls: 0,
      windowSizes: [],
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all pending timers
    for (const group of this.pendingGroups.values()) {
      clearTimeout(group.timer);
      // Reject all pending requests
      for (const request of group.requests) {
        request.reject(new Error("RequestMerger destroyed"));
      }
    }
    this.pendingGroups.clear();
  }
}

// ============================================================================
// A1 NOTATION PARSING AND RANGE OPERATIONS
// ============================================================================

/**
 * Parse A1 notation to structured range info
 *
 * Handles formats:
 * - A1
 * - A1:B10
 * - Sheet1!A1:B10
 * - 'Sheet Name'!A1:B10
 * - A:A (entire column)
 * - 1:1 (entire row)
 */
export function parseA1Range(range: string): RangeInfo {
  // Extract sheet name if present
  let sheetName = "";
  let rangeRef = range;

  // Match sheet name (quoted or unquoted)
  const sheetMatch = range.match(/^(?:'((?:[^']|'')+)'|([^!]+))!(.*)$/);
  if (sheetMatch) {
    sheetName = (sheetMatch[1] || sheetMatch[2] || "").replace(/''/g, "'");
    rangeRef = sheetMatch[3] || "";
  }

  // Parse range reference
  let startRow = 0,
    startCol = 0,
    endRow = 0,
    endCol = 0;

  if (rangeRef) {
    // Match: [COL][ROW]:[COL][ROW] or [COL][ROW] or [COL]:[COL] or [ROW]:[ROW]
    const rangePattern =
      /^([A-Z]+)?(\d+)?(?::([A-Z]+)?(\d+)?)?$|^([A-Z]+):([A-Z]+)$|^(\d+):(\d+)$/i;
    const match = rangeRef.match(rangePattern);

    if (match) {
      // Standard range: A1:B10
      if (match[1] !== undefined || match[2] !== undefined) {
        startCol = match[1] ? letterToColumnIndex(match[1]) + 1 : 0;
        startRow = match[2] ? parseInt(match[2], 10) : 0;
        endCol = match[3] ? letterToColumnIndex(match[3]) + 1 : startCol || 0;
        endRow = match[4] ? parseInt(match[4], 10) : startRow || 0;
      }
      // Column range: A:A
      else if (match[5]) {
        startCol = letterToColumnIndex(match[5]) + 1;
        endCol = letterToColumnIndex(match[6]!) + 1;
        startRow = 0;
        endRow = 0;
      }
      // Row range: 1:1
      else if (match[7]) {
        startRow = parseInt(match[7], 10);
        endRow = parseInt(match[8]!, 10);
        startCol = 0;
        endCol = 0;
      }
    }
  }

  return {
    sheetName,
    startRow,
    startCol,
    endRow,
    endCol,
    originalA1: range,
  };
}

/**
 * Check if two ranges overlap
 */
export function rangesOverlap(range1: RangeInfo, range2: RangeInfo): boolean {
  // Must be on same sheet
  if (range1.sheetName !== range2.sheetName) {
    return false;
  }

  // Handle unbounded ranges (entire sheet, entire column, entire row)
  const r1Unbounded = range1.startRow === 0 || range1.startCol === 0;
  const r2Unbounded = range2.startRow === 0 || range2.startCol === 0;

  if (r1Unbounded || r2Unbounded) {
    // Conservative: treat unbounded ranges as non-overlapping
    return false;
  }

  // Check row overlap
  const rowOverlap =
    Math.max(range1.startRow, range2.startRow) <=
    Math.min(
      range1.endRow || Number.MAX_SAFE_INTEGER,
      range2.endRow || Number.MAX_SAFE_INTEGER,
    );

  // Check column overlap
  const colOverlap =
    Math.max(range1.startCol, range2.startCol) <=
    Math.min(
      range1.endCol || Number.MAX_SAFE_INTEGER,
      range2.endCol || Number.MAX_SAFE_INTEGER,
    );

  return rowOverlap && colOverlap;
}

/**
 * Check if two ranges overlap or are adjacent
 */
export function rangesOverlapOrAdjacent(
  range1: RangeInfo,
  range2: RangeInfo,
): boolean {
  // Must be on same sheet
  if (range1.sheetName !== range2.sheetName) {
    return false;
  }

  // Handle unbounded ranges
  const r1Unbounded = range1.startRow === 0 || range1.startCol === 0;
  const r2Unbounded = range2.startRow === 0 || range2.startCol === 0;

  if (r1Unbounded || r2Unbounded) {
    return false;
  }

  // Check row adjacency (within 1 row)
  const rowAdjacent =
    Math.max(range1.startRow, range2.startRow) <=
    Math.min(
      range1.endRow || Number.MAX_SAFE_INTEGER,
      range2.endRow || Number.MAX_SAFE_INTEGER,
    ) +
      1;

  // Check column adjacency (within 1 column)
  const colAdjacent =
    Math.max(range1.startCol, range2.startCol) <=
    Math.min(
      range1.endCol || Number.MAX_SAFE_INTEGER,
      range2.endCol || Number.MAX_SAFE_INTEGER,
    ) +
      1;

  return rowAdjacent && colAdjacent;
}

/**
 * Merge multiple ranges into minimal bounding box
 */
export function mergeRanges(ranges: RangeInfo[]): RangeInfo {
  if (ranges.length === 0) {
    throw new Error("Cannot merge empty range list");
  }

  if (ranges.length === 1) {
    return ranges[0]!;
  }

  // All ranges must be on same sheet
  const sheetName = ranges[0]!.sheetName;
  if (!ranges.every((r) => r.sheetName === sheetName)) {
    throw new Error("Cannot merge ranges from different sheets");
  }

  // Calculate bounding box
  let minRow = Number.MAX_SAFE_INTEGER;
  let minCol = Number.MAX_SAFE_INTEGER;
  let maxRow = 0;
  let maxCol = 0;

  for (const range of ranges) {
    // Skip unbounded ranges
    if (range.startRow === 0 || range.startCol === 0) {
      continue;
    }

    minRow = Math.min(minRow, range.startRow);
    minCol = Math.min(minCol, range.startCol);
    maxRow = Math.max(maxRow, range.endRow || range.startRow);
    maxCol = Math.max(maxCol, range.endCol || range.startCol);
  }

  return {
    sheetName,
    startRow: minRow === Number.MAX_SAFE_INTEGER ? 0 : minRow,
    startCol: minCol === Number.MAX_SAFE_INTEGER ? 0 : minCol,
    endRow: maxRow,
    endCol: maxCol,
    originalA1: "", // Not applicable for merged range
  };
}

/**
 * Format RangeInfo as A1 notation
 */
export function formatA1Range(range: RangeInfo): string {
  const parts: string[] = [];

  // Add sheet name if present
  if (range.sheetName) {
    const escaped = range.sheetName.replace(/'/g, "''");
    parts.push(`'${escaped}'!`);
  }

  // Handle unbounded ranges
  if (range.startRow === 0 && range.startCol === 0) {
    return parts.join(""); // Entire sheet
  }

  // Format start cell
  if (range.startCol > 0) {
    parts.push(columnIndexToLetter(range.startCol - 1));
  }
  if (range.startRow > 0) {
    parts.push(range.startRow.toString());
  }

  // Add range separator if needed (but not for single cells)
  if (range.endRow !== range.startRow || range.endCol !== range.startCol) {
    parts.push(":");

    // Format end cell
    if (range.endCol > 0) {
      parts.push(columnIndexToLetter(range.endCol - 1));
    }
    if (range.endRow > 0) {
      parts.push(range.endRow.toString());
    }
  }

  return parts.join("");
}

/**
 * Split merged response back to individual range
 */
export function splitResponse(
  mergedData: sheets_v4.Schema$ValueRange,
  mergedRange: RangeInfo,
  targetRange: RangeInfo,
): sheets_v4.Schema$ValueRange {
  const mergedValues = (mergedData.values || []) as unknown[][];

  // Calculate offset
  const rowOffset = targetRange.startRow - mergedRange.startRow;
  const colOffset = targetRange.startCol - mergedRange.startCol;

  // Calculate dimensions
  const rowCount =
    targetRange.endRow > 0
      ? targetRange.endRow - targetRange.startRow + 1
      : mergedValues.length - rowOffset;
  const colCount =
    targetRange.endCol > 0
      ? targetRange.endCol - targetRange.startCol + 1
      : mergedValues[0]
        ? (mergedValues[0] as unknown[]).length - colOffset
        : 0;

  // Extract subset
  const targetValues: unknown[][] = [];
  for (let r = 0; r < rowCount && r + rowOffset < mergedValues.length; r++) {
    const row = mergedValues[r + rowOffset] || [];
    const targetRow: unknown[] = [];
    for (let c = 0; c < colCount && c + colOffset < row.length; c++) {
      targetRow.push(row[c + colOffset]);
    }
    targetValues.push(targetRow);
  }

  return {
    range: targetRange.originalA1,
    values: targetValues,
    majorDimension: mergedData.majorDimension,
  };
}

/**
 * Convert column letter to 0-based index
 */
function letterToColumnIndex(letter: string): number {
  let index = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Convert 0-based index to column letter
 */
function columnIndexToLetter(index: number): string {
  let letter = "";
  let temp = index + 1;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}
