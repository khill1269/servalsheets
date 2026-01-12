/**
 * Sheet Extractor Service
 *
 * Unified extraction pipeline for the testing framework.
 * Implements tiered data retrieval with cache-first strategy,
 * pagination support, and Drive API integration.
 *
 * @module sheet-extractor
 */

import type { sheets_v4, drive_v3 } from "googleapis";
import { logger } from "../utils/logger.js";
import { cacheManager, createCacheKey } from "../utils/cache-manager.js";
import {
  type ExtractionTier,
  type TestCategory,
  type TestDomain,
  type TierConfig,
  EXTRACTION_TIERS,
  CATEGORY_TO_TIER,
  getTiersForCategories,
  mergeFieldMasks,
  getMinTTL,
  requiresGridData,
  requiresDriveApi,
  getAllCategories,
} from "../constants/extraction-fields.js";
import { FIELD_MASKS } from "../constants/field-masks.js";

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Progress callback for long-running extractions
 */
export type ExtractProgressCallback = (progress: ExtractProgress) => void;

/**
 * Progress information during extraction
 */
export interface ExtractProgress {
  phase: "initializing" | "fetching" | "processing" | "complete";
  tier?: ExtractionTier;
  tiersCompleted: number;
  tiersTotal: number;
  message: string;
  percentComplete: number;
}

/**
 * Options for extraction
 */
export interface ExtractOptions {
  /** Specific tiers to extract (defaults to all needed for categories) */
  tiers?: ExtractionTier[];

  /** Specific categories to test (determines tiers if not specified) */
  categories?: TestCategory[];

  /** Specific domains to test */
  domains?: TestDomain[];

  /** Maximum rows to extract per sheet (for pagination) */
  maxRowsPerSheet?: number;

  /** Maximum columns to extract per sheet */
  maxColumnsPerSheet?: number;

  /** Skip cache and fetch fresh data */
  skipCache?: boolean;

  /** Progress callback */
  onProgress?: ExtractProgressCallback;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Include raw API responses */
  includeRaw?: boolean;
}

/**
 * Sheet metadata from extraction
 */
export interface ExtractedSheetMeta {
  sheetId: number;
  title: string;
  index: number;
  hidden: boolean;
  gridProperties: {
    rowCount: number;
    columnCount: number;
    frozenRowCount: number;
    frozenColumnCount: number;
  };
  tabColor?: { red: number; green: number; blue: number; alpha?: number };
}

/**
 * Cell value with metadata
 */
export interface ExtractedCellValue {
  row: number;
  col: number;
  value: unknown;
  formattedValue?: string;
  formula?: string;
  hyperlink?: string;
  note?: string;
  dataValidation?: sheets_v4.Schema$DataValidationRule;
}

/**
 * Merged cell region
 */
export interface ExtractedMerge {
  sheetId: number;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

/**
 * Named range
 */
export interface ExtractedNamedRange {
  namedRangeId: string;
  name: string;
  range: {
    sheetId: number;
    startRowIndex: number;
    endRowIndex: number;
    startColumnIndex: number;
    endColumnIndex: number;
  };
}

/**
 * Conditional format rule
 */
export interface ExtractedConditionalFormat {
  sheetId: number;
  ranges: Array<{
    startRowIndex: number;
    endRowIndex: number;
    startColumnIndex: number;
    endColumnIndex: number;
  }>;
  booleanRule?: sheets_v4.Schema$BooleanRule;
  gradientRule?: sheets_v4.Schema$GradientRule;
}

/**
 * Protected range
 */
export interface ExtractedProtectedRange {
  protectedRangeId: number;
  sheetId?: number;
  range?: {
    startRowIndex: number;
    endRowIndex: number;
    startColumnIndex: number;
    endColumnIndex: number;
  };
  description?: string;
  warningOnly: boolean;
  editors?: {
    users?: string[];
    groups?: string[];
    domainUsersCanEdit?: boolean;
  };
}

/**
 * Filter view
 */
export interface ExtractedFilterView {
  filterViewId: number;
  title: string;
  range: {
    sheetId: number;
    startRowIndex: number;
    endRowIndex: number;
    startColumnIndex: number;
    endColumnIndex: number;
  };
  criteria?: Record<string, sheets_v4.Schema$FilterCriteria>;
}

/**
 * Chart
 */
export interface ExtractedChart {
  chartId: number;
  sheetId: number;
  position: {
    anchorCell?: { sheetId: number; rowIndex: number; columnIndex: number };
    offsetX?: number;
    offsetY?: number;
    width?: number;
    height?: number;
  };
  chartType?: string;
  title?: string;
}

/**
 * Pivot table
 */
export interface ExtractedPivotTable {
  sheetId: number;
  sourceRange?: {
    sheetId: number;
    startRowIndex: number;
    endRowIndex: number;
    startColumnIndex: number;
    endColumnIndex: number;
  };
  rows?: sheets_v4.Schema$PivotGroup[];
  columns?: sheets_v4.Schema$PivotGroup[];
  values?: sheets_v4.Schema$PivotValue[];
}

/**
 * Sharing permission (from Drive API)
 */
export interface ExtractedPermission {
  id: string;
  type: "user" | "group" | "domain" | "anyone";
  role: "owner" | "organizer" | "fileOrganizer" | "writer" | "commenter" | "reader";
  emailAddress?: string;
  domain?: string;
  displayName?: string;
}

/**
 * Comment (from Drive API)
 */
export interface ExtractedComment {
  id: string;
  author: {
    displayName: string;
    emailAddress?: string;
  };
  content: string;
  createdTime: string;
  modifiedTime?: string;
  resolved: boolean;
  anchor?: string;
  replies?: Array<{
    id: string;
    author: {
      displayName: string;
      emailAddress?: string;
    };
    content: string;
    createdTime: string;
  }>;
}

/**
 * Complete extraction result
 */
export interface ExtractionResult {
  /** Spreadsheet ID */
  spreadsheetId: string;

  /** Spreadsheet metadata */
  metadata: {
    title: string;
    locale: string;
    timeZone: string;
    url: string;
    createdTime?: string;
    modifiedTime?: string;
    ownerEmail?: string;
  };

  /** Tiers that were extracted */
  tiersExtracted: ExtractionTier[];

  /** Extraction timestamp */
  extractedAt: string;

  /** Time taken in milliseconds */
  extractionTimeMs: number;

  /** Whether data came from cache */
  fromCache: boolean;

  /** Sheet metadata */
  sheets: ExtractedSheetMeta[];

  /** Cell data by sheet (sheetId -> row -> col -> cell) */
  cellData: Map<number, Map<number, Map<number, ExtractedCellValue>>>;

  /** Merged cells */
  merges: ExtractedMerge[];

  /** Named ranges */
  namedRanges: ExtractedNamedRange[];

  /** Conditional formats by sheet */
  conditionalFormats: Map<number, ExtractedConditionalFormat[]>;

  /** Protected ranges */
  protectedRanges: ExtractedProtectedRange[];

  /** Filter views by sheet */
  filterViews: Map<number, ExtractedFilterView[]>;

  /** Charts by sheet */
  charts: Map<number, ExtractedChart[]>;

  /** Pivot tables by sheet */
  pivotTables: Map<number, ExtractedPivotTable[]>;

  /** Data validation rules by sheet (sheetId -> row -> col -> rule) */
  dataValidation: Map<number, Map<number, Map<number, sheets_v4.Schema$DataValidationRule>>>;

  /** Sharing permissions (requires Drive API) */
  permissions?: ExtractedPermission[];

  /** Comments (requires Drive API) */
  comments?: ExtractedComment[];

  /** Raw API responses (if requested) */
  raw?: {
    spreadsheet?: sheets_v4.Schema$Spreadsheet;
    permissions?: drive_v3.Schema$PermissionList;
    comments?: drive_v3.Schema$CommentList;
  };

  /** Errors encountered during extraction */
  errors: Array<{
    tier: ExtractionTier;
    message: string;
    recoverable: boolean;
  }>;
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

const CACHE_NAMESPACE = "sheet-extractor";
const CACHE_VERSION = "v1";

/**
 * Create cache key for extraction
 */
function createExtractionCacheKey(
  spreadsheetId: string,
  tiers: ExtractionTier[]
): string {
  const tierKey = tiers.sort().join("-");
  return `${CACHE_NAMESPACE}:${CACHE_VERSION}:${spreadsheetId}:${tierKey}`;
}

// ============================================================================
// SHEET EXTRACTOR CLASS
// ============================================================================

/**
 * Sheet Extractor Service
 *
 * Provides unified data extraction from Google Sheets with:
 * - Tiered extraction based on test categories
 * - Cache-first retrieval strategy
 * - Pagination for large sheets
 * - Drive API integration for collaboration data
 * - Progress tracking
 */
export class SheetExtractor {
  private sheetsApi: sheets_v4.Sheets;
  private driveApi?: drive_v3.Drive;

  constructor(
    sheetsApi: sheets_v4.Sheets,
    driveApi?: drive_v3.Drive
  ) {
    this.sheetsApi = sheetsApi;
    this.driveApi = driveApi;
  }

  // ==========================================================================
  // PUBLIC EXTRACTION METHODS
  // ==========================================================================

  /**
   * Extract data from a spreadsheet based on specified options
   *
   * @param spreadsheetId - The spreadsheet ID to extract from
   * @param options - Extraction options
   * @returns Complete extraction result
   */
  async extract(
    spreadsheetId: string,
    options: ExtractOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();

    // Determine which tiers to extract
    const tiers = this.determineTiers(options);

    // Check for abort
    if (options.abortSignal?.aborted) {
      throw new Error("Extraction aborted");
    }

    // Report progress
    this.reportProgress(options.onProgress, {
      phase: "initializing",
      tiersCompleted: 0,
      tiersTotal: tiers.length,
      message: `Preparing to extract ${tiers.length} tier(s)`,
      percentComplete: 0,
    });

    // Check cache first (unless skipCache)
    if (!options.skipCache) {
      const cached = await this.getFromCache(spreadsheetId, tiers);
      if (cached) {
        logger.debug("Extraction cache hit", { spreadsheetId, tiers });
        return {
          ...cached,
          fromCache: true,
          extractionTimeMs: Date.now() - startTime,
        };
      }
    }

    // Initialize result
    const result: ExtractionResult = {
      spreadsheetId,
      metadata: {
        title: "",
        locale: "",
        timeZone: "",
        url: "",
      },
      tiersExtracted: [],
      extractedAt: new Date().toISOString(),
      extractionTimeMs: 0,
      fromCache: false,
      sheets: [],
      cellData: new Map(),
      merges: [],
      namedRanges: [],
      conditionalFormats: new Map(),
      protectedRanges: [],
      filterViews: new Map(),
      charts: new Map(),
      pivotTables: new Map(),
      dataValidation: new Map(),
      errors: [],
    };

    // Extract each tier
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (!tier) continue;

      // Check for abort
      if (options.abortSignal?.aborted) {
        throw new Error("Extraction aborted");
      }

      // Report progress
      this.reportProgress(options.onProgress, {
        phase: "fetching",
        tier,
        tiersCompleted: i,
        tiersTotal: tiers.length,
        message: `Extracting ${tier} tier`,
        percentComplete: Math.round((i / tiers.length) * 80),
      });

      try {
        await this.extractTier(spreadsheetId, tier, result, options);
        result.tiersExtracted.push(tier);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Tier extraction failed", { tier, error: errorMessage });
        result.errors.push({
          tier,
          message: errorMessage,
          recoverable: this.isRecoverableError(error),
        });
      }
    }

    // Extract Drive API data if needed
    if (requiresDriveApi(tiers) && this.driveApi) {
      try {
        await this.extractDriveData(spreadsheetId, result, options);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn("Drive API extraction failed", { error: errorMessage });
        result.errors.push({
          tier: "COLLABORATION",
          message: `Drive API: ${errorMessage}`,
          recoverable: true,
        });
      }
    }

    // Process and finalize
    this.reportProgress(options.onProgress, {
      phase: "processing",
      tiersCompleted: tiers.length,
      tiersTotal: tiers.length,
      message: "Processing extracted data",
      percentComplete: 90,
    });

    // Calculate extraction time
    result.extractionTimeMs = Date.now() - startTime;

    // Cache the result
    if (!options.skipCache && result.tiersExtracted.length > 0) {
      await this.saveToCache(spreadsheetId, tiers, result);
    }

    // Report completion
    this.reportProgress(options.onProgress, {
      phase: "complete",
      tiersCompleted: tiers.length,
      tiersTotal: tiers.length,
      message: `Extraction complete (${result.extractionTimeMs}ms)`,
      percentComplete: 100,
    });

    return result;
  }

  /**
   * Extract only specific categories
   */
  async extractCategories(
    spreadsheetId: string,
    categories: TestCategory[],
    options: Omit<ExtractOptions, "categories"> = {}
  ): Promise<ExtractionResult> {
    return this.extract(spreadsheetId, { ...options, categories });
  }

  /**
   * Extract only specific domains
   */
  async extractDomains(
    spreadsheetId: string,
    domains: TestDomain[],
    options: Omit<ExtractOptions, "domains"> = {}
  ): Promise<ExtractionResult> {
    return this.extract(spreadsheetId, { ...options, domains });
  }

  /**
   * Quick extraction - minimal tier only
   */
  async extractMinimal(
    spreadsheetId: string,
    options: Omit<ExtractOptions, "tiers"> = {}
  ): Promise<ExtractionResult> {
    return this.extract(spreadsheetId, { ...options, tiers: ["MINIMAL"] });
  }

  /**
   * Full extraction - all tiers
   */
  async extractComprehensive(
    spreadsheetId: string,
    options: Omit<ExtractOptions, "tiers"> = {}
  ): Promise<ExtractionResult> {
    return this.extract(spreadsheetId, { ...options, tiers: ["COMPREHENSIVE"] });
  }

  // ==========================================================================
  // TIER DETERMINATION
  // ==========================================================================

  /**
   * Determine which tiers to extract based on options
   */
  private determineTiers(options: ExtractOptions): ExtractionTier[] {
    // If tiers explicitly specified, use them
    if (options.tiers && options.tiers.length > 0) {
      return options.tiers;
    }

    // If categories specified, find needed tiers
    if (options.categories && options.categories.length > 0) {
      return getTiersForCategories(options.categories);
    }

    // If domains specified, find all categories in those domains
    if (options.domains && options.domains.length > 0) {
      const categories: TestCategory[] = [];
      for (const domain of options.domains) {
        const domainCategories = getAllCategories().filter(
          (cat) => EXTRACTION_TIERS[CATEGORY_TO_TIER[cat]].domains.includes(domain)
        );
        categories.push(...domainCategories);
      }
      return getTiersForCategories(categories);
    }

    // Default: STRUCTURAL tier for basic testing
    return ["STRUCTURAL"];
  }

  // ==========================================================================
  // TIER EXTRACTION
  // ==========================================================================

  /**
   * Extract a single tier's data
   */
  private async extractTier(
    spreadsheetId: string,
    tier: ExtractionTier,
    result: ExtractionResult,
    options: ExtractOptions
  ): Promise<void> {
    const tierConfig = EXTRACTION_TIERS[tier];

    logger.debug("Extracting tier", {
      tier,
      fieldMask: tierConfig.fieldMask.substring(0, 100) + "...",
      requiresGridData: tierConfig.requiresGridData,
    });

    // Build API request parameters
    const requestParams: sheets_v4.Params$Resource$Spreadsheets$Get = {
      spreadsheetId,
      fields: tierConfig.fieldMask === "*" ? undefined : tierConfig.fieldMask,
      includeGridData: tierConfig.requiresGridData,
    };

    // Execute API call
    const response = await this.sheetsApi.spreadsheets.get(requestParams);
    const spreadsheet = response.data;

    if (!spreadsheet) {
      throw new Error("No spreadsheet data returned");
    }

    // Store raw response if requested
    if (options.includeRaw) {
      result.raw = result.raw || {};
      result.raw.spreadsheet = spreadsheet;
    }

    // Process response based on tier
    this.processSpreadsheetResponse(spreadsheet, tier, result, options);
  }

  /**
   * Process spreadsheet API response and populate result
   */
  private processSpreadsheetResponse(
    spreadsheet: sheets_v4.Schema$Spreadsheet,
    tier: ExtractionTier,
    result: ExtractionResult,
    options: ExtractOptions
  ): void {
    // Extract metadata (always available)
    if (spreadsheet.properties) {
      result.metadata.title = spreadsheet.properties.title || "";
      result.metadata.locale = spreadsheet.properties.locale || "";
      result.metadata.timeZone = spreadsheet.properties.timeZone || "";
    }
    if (spreadsheet.spreadsheetUrl) {
      result.metadata.url = spreadsheet.spreadsheetUrl;
    }

    // Process sheets
    if (spreadsheet.sheets) {
      for (const sheet of spreadsheet.sheets) {
        this.processSheet(sheet, tier, result, options);
      }
    }

    // Process named ranges
    if (spreadsheet.namedRanges) {
      this.processNamedRanges(spreadsheet.namedRanges, result);
    }
  }

  /**
   * Process a single sheet
   */
  private processSheet(
    sheet: sheets_v4.Schema$Sheet,
    tier: ExtractionTier,
    result: ExtractionResult,
    options: ExtractOptions
  ): void {
    const props = sheet.properties;
    if (!props || props.sheetId === undefined) {
      return;
    }

    const sheetId = props.sheetId ?? 0;

    // Extract sheet metadata
    const sheetMeta: ExtractedSheetMeta = {
      sheetId,
      title: props.title ?? "",
      index: props.index ?? 0,
      hidden: props.hidden ?? false,
      gridProperties: {
        rowCount: props.gridProperties?.rowCount ?? 0,
        columnCount: props.gridProperties?.columnCount ?? 0,
        frozenRowCount: props.gridProperties?.frozenRowCount ?? 0,
        frozenColumnCount: props.gridProperties?.frozenColumnCount ?? 0,
      },
    };

    if (props.tabColor) {
      sheetMeta.tabColor = {
        red: props.tabColor.red ?? 0,
        green: props.tabColor.green ?? 0,
        blue: props.tabColor.blue ?? 0,
        alpha: props.tabColor.alpha ?? 1.0,
      };
    }

    // Add or update sheet in result
    const existingIndex = result.sheets.findIndex((s) => s.sheetId === sheetId);
    if (existingIndex >= 0) {
      result.sheets[existingIndex] = sheetMeta;
    } else {
      result.sheets.push(sheetMeta);
    }

    // Process merges
    if (sheet.merges) {
      this.processMerges(sheet.merges, sheetId, result);
    }

    // Process conditional formats
    if (sheet.conditionalFormats) {
      this.processConditionalFormats(sheet.conditionalFormats, sheetId, result);
    }

    // Process filter views
    if (sheet.filterViews) {
      this.processFilterViews(sheet.filterViews, sheetId, result);
    }

    // Process protected ranges
    if (sheet.protectedRanges) {
      this.processProtectedRanges(sheet.protectedRanges, sheetId, result);
    }

    // Process charts
    if (sheet.charts) {
      this.processCharts(sheet.charts, sheetId, result);
    }

    // Process grid data (cell values, formatting, validation)
    if (sheet.data && tier !== "MINIMAL" && tier !== "STRUCTURAL") {
      this.processGridData(sheet.data, sheetId, result, options);
    }
  }

  // ==========================================================================
  // DATA PROCESSING METHODS
  // ==========================================================================

  /**
   * Process grid data (cells, values, formatting)
   */
  private processGridData(
    gridData: sheets_v4.Schema$GridData[],
    sheetId: number,
    result: ExtractionResult,
    options: ExtractOptions
  ): void {
    // Initialize maps for this sheet
    if (!result.cellData.has(sheetId)) {
      result.cellData.set(sheetId, new Map());
    }
    if (!result.dataValidation.has(sheetId)) {
      result.dataValidation.set(sheetId, new Map());
    }

    const cellMap = result.cellData.get(sheetId)!;
    const validationMap = result.dataValidation.get(sheetId)!;

    const maxRows = options.maxRowsPerSheet || 10000;
    const maxCols = options.maxColumnsPerSheet || 1000;

    for (const grid of gridData) {
      const startRow = grid.startRow || 0;
      const startCol = grid.startColumn || 0;

      if (!grid.rowData) continue;

      for (let rowIdx = 0; rowIdx < grid.rowData.length && (startRow + rowIdx) < maxRows; rowIdx++) {
        const row = grid.rowData[rowIdx];
        if (!row?.values) continue;

        const absoluteRow = startRow + rowIdx;

        if (!cellMap.has(absoluteRow)) {
          cellMap.set(absoluteRow, new Map());
        }
        if (!validationMap.has(absoluteRow)) {
          validationMap.set(absoluteRow, new Map());
        }

        const rowCells = cellMap.get(absoluteRow)!;
        const rowValidation = validationMap.get(absoluteRow)!;

        for (let colIdx = 0; colIdx < row.values.length && (startCol + colIdx) < maxCols; colIdx++) {
          const cell = row.values[colIdx];
          if (!cell) continue;

          const absoluteCol = startCol + colIdx;

          // Extract cell value
          const extractedCell: ExtractedCellValue = {
            row: absoluteRow,
            col: absoluteCol,
            value: this.extractCellValue(cell),
            formattedValue: cell.formattedValue ?? undefined,
            formula: cell.userEnteredValue?.formulaValue ?? undefined,
            hyperlink: cell.hyperlink ?? undefined,
            note: cell.note ?? undefined,
          };

          rowCells.set(absoluteCol, extractedCell);

          // Extract data validation
          if (cell.dataValidation) {
            rowValidation.set(absoluteCol, cell.dataValidation);
          }
        }
      }
    }
  }

  /**
   * Extract the actual value from a cell
   */
  private extractCellValue(cell: sheets_v4.Schema$CellData): unknown {
    if (!cell.effectiveValue && !cell.userEnteredValue) {
      return null;
    }

    const value = cell.effectiveValue || cell.userEnteredValue;

    if (value?.stringValue !== undefined) return value.stringValue;
    if (value?.numberValue !== undefined) return value.numberValue;
    if (value?.boolValue !== undefined) return value.boolValue;
    if (value?.errorValue) return { error: value.errorValue.type, message: value.errorValue.message };
    if (value?.formulaValue !== undefined) return value.formulaValue;

    return null;
  }

  /**
   * Process merged cell regions
   */
  private processMerges(
    merges: sheets_v4.Schema$GridRange[],
    sheetId: number,
    result: ExtractionResult
  ): void {
    for (const merge of merges) {
      if (merge.sheetId !== sheetId) continue;

      result.merges.push({
        sheetId,
        startRow: merge.startRowIndex ?? 0,
        endRow: merge.endRowIndex ?? 0,
        startCol: merge.startColumnIndex ?? 0,
        endCol: merge.endColumnIndex ?? 0,
      });
    }
  }

  /**
   * Process named ranges
   */
  private processNamedRanges(
    namedRanges: sheets_v4.Schema$NamedRange[],
    result: ExtractionResult
  ): void {
    for (const nr of namedRanges) {
      if (!nr.namedRangeId || !nr.name || !nr.range) continue;

      result.namedRanges.push({
        namedRangeId: nr.namedRangeId,
        name: nr.name,
        range: {
          sheetId: nr.range.sheetId ?? 0,
          startRowIndex: nr.range.startRowIndex ?? 0,
          endRowIndex: nr.range.endRowIndex ?? 0,
          startColumnIndex: nr.range.startColumnIndex ?? 0,
          endColumnIndex: nr.range.endColumnIndex ?? 0,
        },
      });
    }
  }

  /**
   * Process conditional formats
   */
  private processConditionalFormats(
    formats: sheets_v4.Schema$ConditionalFormatRule[],
    sheetId: number,
    result: ExtractionResult
  ): void {
    if (!result.conditionalFormats.has(sheetId)) {
      result.conditionalFormats.set(sheetId, []);
    }

    const sheetFormats = result.conditionalFormats.get(sheetId)!;

    for (const format of formats) {
      if (!format.ranges) continue;

      const extractedFormat: ExtractedConditionalFormat = {
        sheetId,
        ranges: format.ranges.map((r) => ({
          startRowIndex: r.startRowIndex ?? 0,
          endRowIndex: r.endRowIndex ?? 0,
          startColumnIndex: r.startColumnIndex ?? 0,
          endColumnIndex: r.endColumnIndex ?? 0,
        })),
        booleanRule: format.booleanRule ?? undefined,
        gradientRule: format.gradientRule ?? undefined,
      };

      sheetFormats.push(extractedFormat);
    }
  }

  /**
   * Process filter views
   */
  private processFilterViews(
    filterViews: sheets_v4.Schema$FilterView[],
    sheetId: number,
    result: ExtractionResult
  ): void {
    if (!result.filterViews.has(sheetId)) {
      result.filterViews.set(sheetId, []);
    }

    const sheetFilterViews = result.filterViews.get(sheetId)!;

    for (const fv of filterViews) {
      if (!fv.filterViewId || !fv.range) continue;

      sheetFilterViews.push({
        filterViewId: fv.filterViewId,
        title: fv.title ?? "",
        range: {
          sheetId: fv.range.sheetId ?? sheetId,
          startRowIndex: fv.range.startRowIndex ?? 0,
          endRowIndex: fv.range.endRowIndex ?? 0,
          startColumnIndex: fv.range.startColumnIndex ?? 0,
          endColumnIndex: fv.range.endColumnIndex ?? 0,
        },
        criteria: fv.criteria ?? undefined,
      });
    }
  }

  /**
   * Process protected ranges
   */
  private processProtectedRanges(
    protectedRanges: sheets_v4.Schema$ProtectedRange[],
    sheetId: number,
    result: ExtractionResult
  ): void {
    for (const pr of protectedRanges) {
      if (!pr.protectedRangeId) continue;

      const extracted: ExtractedProtectedRange = {
        protectedRangeId: pr.protectedRangeId,
        sheetId: pr.range?.sheetId ?? sheetId,
        description: pr.description ?? undefined,
        warningOnly: pr.warningOnly ?? false,
      };

      if (pr.range) {
        extracted.range = {
          startRowIndex: pr.range.startRowIndex ?? 0,
          endRowIndex: pr.range.endRowIndex ?? 0,
          startColumnIndex: pr.range.startColumnIndex ?? 0,
          endColumnIndex: pr.range.endColumnIndex ?? 0,
        };
      }

      if (pr.editors) {
        extracted.editors = {
          users: pr.editors.users ?? undefined,
          groups: pr.editors.groups ?? undefined,
          domainUsersCanEdit: pr.editors.domainUsersCanEdit ?? undefined,
        };
      }

      result.protectedRanges.push(extracted);
    }
  }

  /**
   * Process charts
   */
  private processCharts(
    charts: sheets_v4.Schema$EmbeddedChart[],
    sheetId: number,
    result: ExtractionResult
  ): void {
    if (!result.charts.has(sheetId)) {
      result.charts.set(sheetId, []);
    }

    const sheetCharts = result.charts.get(sheetId)!;

    for (const chart of charts) {
      if (!chart.chartId) continue;

      const extracted: ExtractedChart = {
        chartId: chart.chartId,
        sheetId,
        position: {},
      };

      if (chart.position?.overlayPosition) {
        const overlay = chart.position.overlayPosition;
        extracted.position = {
          anchorCell: overlay.anchorCell ? {
            sheetId: overlay.anchorCell.sheetId ?? sheetId,
            rowIndex: overlay.anchorCell.rowIndex ?? 0,
            columnIndex: overlay.anchorCell.columnIndex ?? 0,
          } : undefined,
          offsetX: overlay.offsetXPixels ?? 0,
          offsetY: overlay.offsetYPixels ?? 0,
          width: overlay.widthPixels ?? 0,
          height: overlay.heightPixels ?? 0,
        };
      }

      if (chart.spec?.title) {
        extracted.title = chart.spec.title;
      }

      // Determine chart type from spec
      if (chart.spec?.basicChart) {
        extracted.chartType = chart.spec.basicChart.chartType ?? "UNKNOWN";
      } else if (chart.spec?.pieChart) {
        extracted.chartType = "PIE";
      } else if (chart.spec?.bubbleChart) {
        extracted.chartType = "BUBBLE";
      } else if (chart.spec?.candlestickChart) {
        extracted.chartType = "CANDLESTICK";
      } else if (chart.spec?.orgChart) {
        extracted.chartType = "ORG";
      } else if (chart.spec?.histogramChart) {
        extracted.chartType = "HISTOGRAM";
      } else if (chart.spec?.waterfallChart) {
        extracted.chartType = "WATERFALL";
      } else if (chart.spec?.treemapChart) {
        extracted.chartType = "TREEMAP";
      } else if (chart.spec?.scorecardChart) {
        extracted.chartType = "SCORECARD";
      }

      sheetCharts.push(extracted);
    }
  }

  // ==========================================================================
  // DRIVE API EXTRACTION
  // ==========================================================================

  /**
   * Extract data from Drive API (permissions, comments)
   */
  private async extractDriveData(
    spreadsheetId: string,
    result: ExtractionResult,
    options: ExtractOptions
  ): Promise<void> {
    if (!this.driveApi) {
      logger.debug("Drive API not available, skipping collaboration data extraction");
      return;
    }

    // Extract permissions
    try {
      const permResponse = await this.driveApi.permissions.list({
        fileId: spreadsheetId,
        fields: "permissions(id,type,role,emailAddress,domain,displayName)",
      });

      if (permResponse.data.permissions) {
        result.permissions = permResponse.data.permissions.map((p) => ({
          id: p.id || "",
          type: (p.type as ExtractedPermission["type"]) || "user",
          role: (p.role as ExtractedPermission["role"]) || "reader",
          emailAddress: p.emailAddress || undefined,
          domain: p.domain || undefined,
          displayName: p.displayName || undefined,
        }));

        // Extract owner email
        const owner = result.permissions.find((p) => p.role === "owner");
        if (owner?.emailAddress) {
          result.metadata.ownerEmail = owner.emailAddress;
        }
      }

      if (options.includeRaw) {
        result.raw = result.raw || {};
        result.raw.permissions = permResponse.data;
      }
    } catch (error) {
      logger.warn("Failed to fetch permissions", { error });
    }

    // Extract comments
    try {
      const commentsResponse = await this.driveApi.comments.list({
        fileId: spreadsheetId,
        fields: "comments(id,author,content,createdTime,modifiedTime,resolved,anchor,replies)",
      });

      if (commentsResponse.data.comments) {
        result.comments = commentsResponse.data.comments.map((c) => ({
          id: c.id || "",
          author: {
            displayName: c.author?.displayName || "Unknown",
            emailAddress: c.author?.emailAddress || undefined,
          },
          content: c.content || "",
          createdTime: c.createdTime || "",
          modifiedTime: c.modifiedTime || undefined,
          resolved: c.resolved || false,
          anchor: c.anchor || undefined,
          replies: c.replies?.map((r) => ({
            id: r.id || "",
            author: {
              displayName: r.author?.displayName || "Unknown",
              emailAddress: r.author?.emailAddress || undefined,
            },
            content: r.content || "",
            createdTime: r.createdTime || "",
          })),
        }));
      }

      if (options.includeRaw) {
        result.raw = result.raw || {};
        result.raw.comments = commentsResponse.data;
      }
    } catch (error) {
      logger.warn("Failed to fetch comments", { error });
    }

    // Get file metadata for timestamps
    try {
      const fileResponse = await this.driveApi.files.get({
        fileId: spreadsheetId,
        fields: "createdTime,modifiedTime",
      });

      if (fileResponse.data.createdTime) {
        result.metadata.createdTime = fileResponse.data.createdTime;
      }
      if (fileResponse.data.modifiedTime) {
        result.metadata.modifiedTime = fileResponse.data.modifiedTime;
      }
    } catch (error) {
      logger.warn("Failed to fetch file metadata", { error });
    }
  }

  // ==========================================================================
  // CACHING
  // ==========================================================================

  /**
   * Get cached extraction result
   */
  private async getFromCache(
    spreadsheetId: string,
    tiers: ExtractionTier[]
  ): Promise<ExtractionResult | null> {
    const cacheKey = createExtractionCacheKey(spreadsheetId, tiers);

    try {
      const cached = cacheManager.get<Record<string, unknown>>(cacheKey, CACHE_NAMESPACE);

      if (cached) {
        // Reconstruct Maps from cached data
        return this.reconstructMaps(cached);
      }
    } catch (error) {
      logger.debug("Cache retrieval failed", { error });
    }

    return null;
  }

  /**
   * Save extraction result to cache
   */
  private async saveToCache(
    spreadsheetId: string,
    tiers: ExtractionTier[],
    result: ExtractionResult
  ): Promise<void> {
    const cacheKey = createExtractionCacheKey(spreadsheetId, tiers);
    const ttl = getMinTTL(tiers);

    try {
      // Convert Maps to serializable format
      const serializable = this.serializeMaps(result);

      cacheManager.set(cacheKey, serializable, {
        ttl,
        namespace: CACHE_NAMESPACE,
      });
    } catch (error) {
      logger.debug("Cache save failed", { error });
    }
  }

  /**
   * Convert Maps to plain objects for serialization
   */
  private serializeMaps(result: ExtractionResult): Record<string, unknown> {
    return {
      ...result,
      cellData: this.mapToObject(result.cellData, (rowMap) =>
        this.mapToObject(rowMap, (colMap) => this.mapToObject(colMap))
      ),
      conditionalFormats: this.mapToObject(result.conditionalFormats),
      filterViews: this.mapToObject(result.filterViews),
      charts: this.mapToObject(result.charts),
      pivotTables: this.mapToObject(result.pivotTables),
      dataValidation: this.mapToObject(result.dataValidation, (rowMap) =>
        this.mapToObject(rowMap, (colMap) => this.mapToObject(colMap))
      ),
    };
  }

  /**
   * Convert serialized objects back to Maps
   */
  private reconstructMaps(cached: Record<string, unknown>): ExtractionResult {
    const result = cached as unknown as ExtractionResult;

    // Reconstruct cellData
    if (cached["cellData"] && typeof cached["cellData"] === "object") {
      result.cellData = this.objectToMap(
        cached["cellData"] as Record<string, unknown>,
        (rowObj) => this.objectToMap(
          rowObj as Record<string, unknown>,
          (colObj) => this.objectToMap(colObj as Record<string, unknown>)
        )
      );
    } else {
      result.cellData = new Map();
    }

    // Reconstruct other maps
    result.conditionalFormats = this.objectToMap(
      (cached["conditionalFormats"] as Record<string, unknown>) || {}
    );
    result.filterViews = this.objectToMap(
      (cached["filterViews"] as Record<string, unknown>) || {}
    );
    result.charts = this.objectToMap(
      (cached["charts"] as Record<string, unknown>) || {}
    );
    result.pivotTables = this.objectToMap(
      (cached["pivotTables"] as Record<string, unknown>) || {}
    );

    // Reconstruct dataValidation
    if (cached["dataValidation"] && typeof cached["dataValidation"] === "object") {
      result.dataValidation = this.objectToMap(
        cached["dataValidation"] as Record<string, unknown>,
        (rowObj) => this.objectToMap(
          rowObj as Record<string, unknown>,
          (colObj) => this.objectToMap(colObj as Record<string, unknown>)
        )
      );
    } else {
      result.dataValidation = new Map();
    }

    return result;
  }

  /**
   * Convert a Map to a plain object
   */
  private mapToObject<K extends string | number, V>(
    map: Map<K, V>,
    valueTransform?: (value: V) => unknown
  ): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of map.entries()) {
      obj[String(key)] = valueTransform ? valueTransform(value) : value;
    }
    return obj;
  }

  /**
   * Convert a plain object to a Map
   */
  private objectToMap<V>(
    obj: Record<string, unknown>,
    valueTransform?: (value: unknown) => V
  ): Map<number, V> {
    const map = new Map<number, V>();
    for (const [key, value] of Object.entries(obj)) {
      const numKey = parseInt(key, 10);
      if (!isNaN(numKey)) {
        map.set(numKey, valueTransform ? valueTransform(value) : (value as V));
      }
    }
    return map;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  /**
   * Report progress to callback
   */
  private reportProgress(
    callback: ExtractProgressCallback | undefined,
    progress: ExtractProgress
  ): void {
    if (callback) {
      try {
        callback(progress);
      } catch (error) {
        logger.debug("Progress callback error", { error });
      }
    }
  }

  /**
   * Check if an error is recoverable (can continue extraction)
   */
  private isRecoverableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Permission errors are not recoverable
      if (message.includes("permission") || message.includes("forbidden")) {
        return false;
      }

      // Not found errors are not recoverable
      if (message.includes("not found") || message.includes("404")) {
        return false;
      }

      // Rate limit errors might be recoverable with retry
      if (message.includes("rate") || message.includes("quota")) {
        return true;
      }

      // Network errors might be recoverable
      if (message.includes("network") || message.includes("timeout")) {
        return true;
      }
    }

    return true;
  }

  /**
   * Invalidate cache for a spreadsheet
   */
  invalidateCache(spreadsheetId: string): void {
    // Invalidate all tier combinations for this spreadsheet
    const allTiers: ExtractionTier[] = [
      "MINIMAL",
      "STRUCTURAL",
      "FORMATTING",
      "DATA_COMPLETE",
      "COLLABORATION",
      "COMPREHENSIVE",
    ];

    for (const tier of allTiers) {
      const cacheKey = createExtractionCacheKey(spreadsheetId, [tier]);
      cacheManager.delete(cacheKey);
    }

    logger.debug("Invalidated extraction cache", { spreadsheetId });
  }

  /**
   * Get extraction statistics
   */
  getStats(): {
    cacheHits: number;
    cacheMisses: number;
    averageExtractionTime: number;
  } {
    // This would track stats over time - simplified for now
    return {
      cacheHits: 0,
      cacheMisses: 0,
      averageExtractionTime: 0,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new SheetExtractor instance
 */
export function createSheetExtractor(
  sheetsApi: sheets_v4.Sheets,
  driveApi?: drive_v3.Drive
): SheetExtractor {
  return new SheetExtractor(sheetsApi, driveApi);
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get cell value from extraction result
 */
export function getCellValue(
  result: ExtractionResult,
  sheetId: number,
  row: number,
  col: number
): ExtractedCellValue | undefined {
  return result.cellData.get(sheetId)?.get(row)?.get(col);
}

/**
 * Get all cell values for a sheet
 */
export function getSheetCells(
  result: ExtractionResult,
  sheetId: number
): ExtractedCellValue[] {
  const cells: ExtractedCellValue[] = [];
  const sheetData = result.cellData.get(sheetId);

  if (sheetData) {
    for (const rowMap of sheetData.values()) {
      for (const cell of rowMap.values()) {
        cells.push(cell);
      }
    }
  }

  return cells;
}

/**
 * Get sheet by ID from extraction result
 */
export function getSheetById(
  result: ExtractionResult,
  sheetId: number
): ExtractedSheetMeta | undefined {
  return result.sheets.find((s) => s.sheetId === sheetId);
}

/**
 * Get sheet by name from extraction result
 */
export function getSheetByName(
  result: ExtractionResult,
  name: string
): ExtractedSheetMeta | undefined {
  return result.sheets.find((s) => s.title === name);
}

/**
 * Count total cells with data
 */
export function countCellsWithData(result: ExtractionResult): number {
  let count = 0;

  for (const sheetData of result.cellData.values()) {
    for (const rowData of sheetData.values()) {
      count += rowData.size;
    }
  }

  return count;
}

/**
 * Check if extraction has errors
 */
export function hasExtractionErrors(result: ExtractionResult): boolean {
  return result.errors.length > 0;
}

/**
 * Get non-recoverable errors
 */
export function getCriticalErrors(
  result: ExtractionResult
): ExtractionResult["errors"] {
  return result.errors.filter((e) => !e.recoverable);
}
