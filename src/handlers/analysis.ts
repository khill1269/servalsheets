/**
 * ServalSheets - Analysis Handler
 *
 * Handles sheets_analysis tool (read-only analytics)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsAnalysisInput,
  SheetsAnalysisOutput,
  AnalysisAction,
  AnalysisResponse,
} from '../schemas/index.js';
import type { RangeInput } from '../schemas/shared.js';
import { identifyDataIssues, checkSamplingSupport } from '../mcp/sampling.js';
import { getRequestLogger } from '../utils/request-context.js';
import { cacheManager, createCacheKey } from '../utils/cache-manager.js';
import { createRequestKey } from '../utils/request-deduplication.js';
import { CACHE_TTL_ANALYSIS } from '../config/constants.js';

export class AnalysisHandler extends BaseHandler<SheetsAnalysisInput, SheetsAnalysisOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_analysis', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsAnalysisInput): Promise<SheetsAnalysisOutput> {
    const { request } = input;

    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(request) as AnalysisAction;

    try {
      const response = await this.executeAction(inferredRequest);

      // Track context on success
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: inferredRequest.spreadsheetId,
          sheetId: 'sheetId' in inferredRequest ? (typeof inferredRequest.sheetId === 'number' ? inferredRequest.sheetId : undefined) : undefined,
          range: 'range' in inferredRequest ? (typeof inferredRequest.range === 'string' ? inferredRequest.range : undefined) : undefined,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(_input: SheetsAnalysisInput): Intent[] {
    // Read-only handler
    return [];
  }

  /**
   * Execute action and return response
   */
  private async executeAction(request: AnalysisAction): Promise<AnalysisResponse> {
    switch (request.action) {
      case 'data_quality':
        return await this.handleDataQuality(request);
      case 'formula_audit':
        return await this.handleFormulaAudit(request);
      case 'structure_analysis':
        return await this.handleStructure(request);
      case 'statistics':
        return await this.handleStatistics(request);
      case 'correlations':
        return await this.handleCorrelations(request);
      case 'summary':
        return await this.handleSummary(request);
      case 'dependencies':
        return await this.handleDependencies(request);
      case 'compare_ranges':
        return await this.handleCompareRanges(request);
      case 'detect_patterns':
        return await this.handleDetectPatterns(request);
      case 'column_analysis':
        return await this.handleColumnAnalysis(request);
      case 'suggest_templates':
        return await this.handleSuggestTemplates(request);
      case 'generate_formula':
        return await this.handleGenerateFormula(request);
      case 'suggest_chart':
        return await this.handleSuggestChart(request);
      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown action: ${(request as { action: string }).action}`,
          retryable: false,
        });
    }
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleDataQuality(
    input: Extract<AnalysisAction, { action: 'data_quality' }>
  ): Promise<AnalysisResponse> {
    const range = input.range ?? { a1: 'A1:Z200' };
    const values = await this.fetchValues(input.spreadsheetId, range);

    // If AI-powered analysis is requested and sampling is supported
    if (input.useAI && this.context.samplingServer) {
      const samplingSupport = checkSamplingSupport(
        this.context.samplingServer.getClientCapabilities()
      );

      if (samplingSupport.supported) {
        try {
          const aiIssues = await identifyDataIssues(
            this.context.samplingServer,
            {
              data: values,
            }
          );

          // Convert AI issues to our format
          const issues = aiIssues.map(issue => ({
            type: issue.type.toUpperCase().replace(/_/g, '_') as 'EMPTY_HEADER' | 'DUPLICATE_HEADER' | 'MIXED_DATA_TYPES' | 'EMPTY_ROW' | 'EMPTY_COLUMN' | 'TRAILING_WHITESPACE' | 'LEADING_WHITESPACE' | 'INCONSISTENT_FORMAT' | 'STATISTICAL_OUTLIER' | 'MISSING_VALUE' | 'DUPLICATE_ROW' | 'INVALID_EMAIL' | 'INVALID_URL' | 'INVALID_DATE' | 'FORMULA_ERROR',
            severity: issue.severity === 'critical' ? 'high' : issue.severity,
            location: issue.location,
            description: `${issue.description} (AI-detected). Suggested fix: ${issue.suggestedFix}`,
            autoFixable: false,
          }));

          // Return AI-generated analysis
          return this.success('data_quality', {
            issues,
            usedAI: true,
          });
        } catch (error) {
          // Fall back to traditional analysis if AI fails
          const logger = getRequestLogger();
          logger.warn('AI analysis failed, falling back to traditional analysis', { error });
        }
      }
    }

    const headers = (values[0] ?? []) as string[];
    const issues: Array<{
      type: 'EMPTY_HEADER' | 'DUPLICATE_HEADER' | 'MIXED_DATA_TYPES' | 'EMPTY_ROW' | 'EMPTY_COLUMN' | 'TRAILING_WHITESPACE' | 'LEADING_WHITESPACE' | 'INCONSISTENT_FORMAT' | 'STATISTICAL_OUTLIER' | 'MISSING_VALUE' | 'DUPLICATE_ROW' | 'INVALID_EMAIL' | 'INVALID_URL' | 'INVALID_DATE' | 'FORMULA_ERROR';
      severity: 'low' | 'medium' | 'high';
      location: string;
      description: string;
      autoFixable: boolean;
      fixTool?: string;
      fixAction?: string;
      fixParams?: Record<string, unknown>;
    }> = [];

    // Empty or duplicate headers
    const headerSet = new Set<string>();
    headers.forEach((h, idx) => {
      const name = (h ?? '').toString().trim();
      if (!name) {
        issues.push({
          type: 'EMPTY_HEADER',
          severity: 'medium',
          location: `header:${idx + 1}`,
          description: 'Header cell is empty',
          autoFixable: false,
        });
      } else if (headerSet.has(name)) {
        issues.push({
          type: 'DUPLICATE_HEADER',
          severity: 'medium',
          location: `header:${idx + 1}`,
          description: `Duplicate header "${name}"`,
          autoFixable: false,
        });
      }
      headerSet.add(name);
    });

    // Empty rows detection
    for (let i = 1; i < values.length; i++) {
      const row = values[i] ?? [];
      if (row.every(cell => cell === '' || cell === undefined || cell === null)) {
        issues.push({
          type: 'EMPTY_ROW',
          severity: 'low',
          location: `row:${i + 1}`,
          description: 'Empty row detected',
          autoFixable: false,
        });
      }
    }

    // Mixed data types and missing values per column
    const bodyRows = values.slice(1);
    const colCount = headers.length;
    for (let col = 0; col < colCount; col++) {
      const colValues = bodyRows.map(r => r?.[col]).filter(v => v !== undefined);
      const types = new Set(colValues.map(v => this.valueType(v)));
      const missing = bodyRows.length - colValues.length;

      if (types.size > 1) {
        issues.push({
          type: 'MIXED_DATA_TYPES',
          severity: 'medium',
          location: `col:${col + 1}`,
          description: `Column has mixed types: ${Array.from(types).join(', ')}`,
          autoFixable: false,
        });
      }
      if (missing > 0) {
        issues.push({
          type: 'MISSING_VALUE',
          severity: 'low',
          location: `col:${col + 1}`,
          description: `${missing} missing value(s)`,
          autoFixable: false,
        });
      }

      // Whitespace issues
      const ws = colValues.find(v => typeof v === 'string' && (/^\s+/.test(v) || /\s+$/.test(v)));
      if (ws !== undefined) {
        issues.push({
          type: /^\s+/.test(ws as string) ? 'LEADING_WHITESPACE' : 'TRAILING_WHITESPACE',
          severity: 'low',
          location: `col:${col + 1}`,
          description: 'Value has unnecessary whitespace',
          autoFixable: false,
        });
      }
    }

    const score = Math.max(0, 100 - issues.length * 5);
    return this.success('data_quality', {
      dataQuality: {
        score,
        completeness: score,
        consistency: score,
        accuracy: score,
        issues,
        summary: issues.length === 0 ? 'No data quality issues detected.' : `${issues.length} issue(s) detected.`,
      },
    });
  }

  private async handleFormulaAudit(
    input: Extract<AnalysisAction, { action: 'formula_audit' }>
  ): Promise<AnalysisResponse> {
    const range = input.range ?? { a1: 'A1:Z200' };
    const a1 = await this.resolveRange(input.spreadsheetId, range);
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: a1,
      valueRenderOption: 'FORMULA',
    });

    const formulas: string[] = [];
    const issues: Array<{
      type: 'CIRCULAR_REFERENCE' | 'BROKEN_REFERENCE' | 'VOLATILE_FUNCTION' | 'COMPLEX_FORMULA' | 'HARDCODED_VALUE' | 'INCONSISTENT_FORMULA' | 'ARRAY_FORMULA_ISSUE' | 'DEPRECATED_FUNCTION' | 'PERFORMANCE_ISSUE';
      severity: 'low' | 'medium' | 'high';
      cell: string;
      formula: string;
      description: string;
      suggestion?: string;
    }> = [];

    // Enhanced detection: count pattern occurrences
    let todayCount = 0;
    let vlookupCount = 0;
    let fullColumnRefs = 0;
    let nestedIferror = 0;
    let arrayFormulaCount = 0;

    for (const row of response.data.values ?? []) {
      for (const cell of row ?? []) {
        if (typeof cell === 'string' && cell.startsWith('=')) {
          formulas.push(cell);

          // Existing checks
          if (cell.includes('#REF!') || cell.includes('#ERROR')) {
            issues.push({
              type: 'BROKEN_REFERENCE',
              severity: 'high',
              cell: '',
              formula: cell,
              description: 'Formula contains a broken reference',
              suggestion: 'Repoint the reference to a valid range.',
            });
          }

          // Enhanced volatile function detection with counting
          const volatileMatches = cell.match(/TODAY\(\)/g);
          if (volatileMatches) {
            todayCount += volatileMatches.length;
          }
          if (/(NOW\(|RAND\(|RANDBETWEEN\()/.test(cell)) {
            issues.push({
              type: 'VOLATILE_FUNCTION',
              severity: 'medium',
              cell: '',
              formula: cell,
              description: 'Volatile function may recalc frequently.',
              suggestion: 'Consider static values or less volatile functions.',
            });
          }

          // NEW: Full column reference detection (A:A, E:E)
          if (/(SUMIF|COUNTIF|SUMIFS|COUNTIFS|VLOOKUP|MATCH)\([^)]*[A-Z]:[A-Z]/.test(cell)) {
            fullColumnRefs++;
            issues.push({
              type: 'PERFORMANCE_ISSUE',
              severity: 'high',
              cell: '',
              formula: cell,
              description: 'Full column reference (A:A) scans 1M+ rows unnecessarily',
              suggestion: 'Replace A:A with bounded range like A2:A500. Example: SUMIF(A:A,...) → SUMIF(A2:A500,...)',
            });
          }

          // NEW: VLOOKUP detection
          if (/VLOOKUP\(/.test(cell)) {
            vlookupCount++;
            issues.push({
              type: 'PERFORMANCE_ISSUE',
              severity: 'medium',
              cell: '',
              formula: cell,
              description: 'VLOOKUP is 60% slower than INDEX/MATCH on large datasets',
              suggestion: 'Replace with INDEX/MATCH. Example: =VLOOKUP(A2,Data!A:D,3,0) → =INDEX(Data!C:C,MATCH(A2,Data!A:A,0))',
            });
          }

          // NEW: Nested IFERROR detection
          if (/IFERROR\(IFERROR\(/.test(cell)) {
            nestedIferror++;
            issues.push({
              type: 'COMPLEX_FORMULA',
              severity: 'low',
              cell: '',
              formula: cell,
              description: 'Redundant nested IFERROR reduces readability',
              suggestion: 'Simplify to single IFERROR with appropriate default value',
            });
          }

          // NEW: ARRAYFORMULA counting
          if (/ARRAYFORMULA\(/.test(cell)) {
            arrayFormulaCount++;
          }

          // NEW: Deep nested IF detection (3+ levels)
          const nestedIfCount = (cell.match(/IF\(/g) || []).length;
          if (nestedIfCount >= 3) {
            issues.push({
              type: 'COMPLEX_FORMULA',
              severity: 'medium',
              cell: '',
              formula: cell,
              description: `${nestedIfCount} nested IF statements make formula hard to maintain`,
              suggestion: 'Replace with IFS() function or lookup table. Example: IFS(A1>100,"A", A1>80,"B", TRUE,"F")',
            });
          }

          // NEW: Hardcoded threshold detection
          if (/IF\([^,]+[<>=]\d+/.test(cell)) {
            issues.push({
              type: 'HARDCODED_VALUE',
              severity: 'medium',
              cell: '',
              formula: cell,
              description: 'Hardcoded threshold value makes updates difficult',
              suggestion: 'Move threshold to _System or Config sheet and reference as named range',
            });
          }

          // Existing complexity check
          const complexity = (cell.match(/[,;]/g)?.length ?? 0) + (cell.match(/\(/g)?.length ?? 0);
          if (complexity > (input.complexityThreshold ?? 10)) {
            issues.push({
              type: 'COMPLEX_FORMULA',
              severity: 'medium',
              cell: '',
              formula: cell,
              description: `Formula complexity ${complexity} exceeds threshold`,
              suggestion: 'Break into helper columns.',
            });
          }
        }
      }
    }

    // NEW: Global pattern detection
    if (todayCount > 3) {
      issues.push({
        type: 'PERFORMANCE_ISSUE',
        severity: 'high',
        cell: 'Multiple cells',
        formula: '',
        description: `Found ${todayCount} TODAY() calls across spreadsheet`,
        suggestion: 'Create _System!B1 = TODAY(), name it "TodayDate", and reference everywhere. Saves 90% recalculation time.',
      });
    }

    if (arrayFormulaCount > 10) {
      issues.push({
        type: 'PERFORMANCE_ISSUE',
        severity: 'medium',
        cell: 'Multiple cells',
        formula: '',
        description: `Found ${arrayFormulaCount} ARRAYFORMULA instances`,
        suggestion: 'Excessive ARRAYFORMULA usage slows editing. Consider using regular formulas for datasets <100 rows.',
      });
    }

    const uniqueFormulas = new Set(formulas);
    const score = Math.max(0, 100 - issues.length * 5);

    return this.success('formula_audit', {
      formulaAudit: {
        score,
        totalFormulas: formulas.length,
        uniqueFormulas: uniqueFormulas.size,
        issues,
        summary: issues.length === 0 ? 'No formula issues detected.' : `${issues.length} formula issue(s) detected.`,
        statistics: {
          todayCount,
          vlookupCount,
          fullColumnRefs,
          nestedIferror,
          arrayFormulaCount,
        },
      },
    });
  }

  private async handleStructure(
    input: Extract<AnalysisAction, { action: 'structure_analysis' }>
  ): Promise<AnalysisResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets(properties,conditionalFormats,protectedRanges),namedRanges',
    });

    const sheets = response.data.sheets ?? [];
    const totalRows = sheets.reduce((sum, s) => sum + (s.properties?.gridProperties?.rowCount ?? 0), 0);
    const totalColumns = sheets.reduce((sum, s) => sum + (s.properties?.gridProperties?.columnCount ?? 0), 0);

    const namedRanges = (response.data.namedRanges ?? []).map(n => ({
      name: n.name ?? '',
      range: `${n.range?.sheetId ?? 0}:${n.range?.startRowIndex ?? 0}-${n.range?.endRowIndex ?? 0}`,
    }));

    // Enhanced analysis: detect issues
    const issues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      sheet?: string;
      description: string;
      suggestion: string;
    }> = [];

    // Check each sheet for issues
    for (const sheet of sheets) {
      const sheetName = sheet.properties?.title ?? 'Unnamed';
      const sheetId = sheet.properties?.sheetId ?? 0;
      const gridProps = sheet.properties?.gridProperties;
      const isHidden = sheet.properties?.hidden ?? false;

      // UI/UX: Check frozen headers
      if (!isHidden && (gridProps?.frozenRowCount ?? 0) === 0 && (gridProps?.rowCount ?? 0) > 20) {
        issues.push({
          type: 'UI_UX',
          severity: 'medium',
          sheet: sheetName,
          description: 'No frozen header rows - headers scroll out of view',
          suggestion: 'Freeze row 1: sheets_dimensions action="freeze_rows" count=1',
        });
      }

      // UI/UX: Check frozen ID column for wide sheets
      if (!isHidden && (gridProps?.frozenColumnCount ?? 0) === 0 && (gridProps?.columnCount ?? 0) > 10) {
        issues.push({
          type: 'UI_UX',
          severity: 'low',
          sheet: sheetName,
          description: 'No frozen ID column for wide sheet - row identifiers scroll away',
          suggestion: 'Freeze column A: sheets_dimensions action="freeze_columns" count=1',
        });
      }

      // Conditional Formatting: Check for redundancy
      const cfRules = sheet.conditionalFormats ?? [];
      if (cfRules.length > 20) {
        issues.push({
          type: 'CONDITIONAL_FORMATTING',
          severity: 'medium',
          sheet: sheetName,
          description: `${cfRules.length} conditional format rules detected - likely redundant`,
          suggestion: 'Consolidate rules to 8-10. Remove duplicates, merge similar conditions.',
        });
      }

      // Protection: Check if formulas are protected
      const protectedRanges = sheet.protectedRanges ?? [];
      if (protectedRanges.length === 0 && (gridProps?.rowCount ?? 0) > 10) {
        issues.push({
          type: 'PROTECTION',
          severity: 'high',
          sheet: sheetName,
          description: 'No protected ranges - formulas can be accidentally overwritten',
          suggestion: 'Protect formula cells: sheets_advanced action="add_protected_range"',
        });
      }

      // Hidden sheets without underscore prefix
      if (isHidden && !sheetName.startsWith('_')) {
        issues.push({
          type: 'STRUCTURE',
          severity: 'low',
          sheet: sheetName,
          description: 'Hidden sheet not prefixed with _ - unclear purpose',
          suggestion: 'Rename to _' + sheetName + ' for clarity',
        });
      }
    }

    // Named range analysis
    const namedRangesByPrefix: Record<string, number> = {};
    for (const nr of response.data.namedRanges ?? []) {
      const prefix = nr.name?.split(/[_A-Z]/)[0] ?? '';
      namedRangesByPrefix[prefix] = (namedRangesByPrefix[prefix] || 0) + 1;
    }

    // Check for naming inconsistency
    if (Object.keys(namedRangesByPrefix).length > 2) {
      issues.push({
        type: 'STRUCTURE',
        severity: 'low',
        description: 'Inconsistent named range naming conventions detected',
        suggestion: 'Standardize to PascalCase (InvestorNames) or snake_case (investor_names)',
      });
    }

    const hiddenSheets = sheets.filter(s => s.properties?.hidden).length;

    return this.success('structure_analysis', {
      structure: {
        sheets: sheets.length,
        totalRows,
        totalColumns,
        tables: [],
        namedRanges,
        hiddenSheets,
        issues,
        summary: issues.length === 0 ? 'No structural issues detected.' : `${issues.length} structural issue(s) detected.`,
      },
    });
  }

  private async handleStatistics(
    input: Extract<AnalysisAction, { action: 'statistics' }>
  ): Promise<AnalysisResponse> {
    const values = await this.fetchValues(input.spreadsheetId, input.range);
    if (values.length === 0) {
      return this.success('statistics', { statistics: { columns: [] } });
    }

    const headers = values[0] ?? [];
    const rows = values.slice(1);
    const colCount = Math.max(...rows.map(r => r.length), headers.length);
    const columns: Array<{
      index: number;
      count: number;
      nullCount: number;
      uniqueCount: number;
      name?: string;
      sum?: number;
      mean?: number;
      median?: number;
      stdDev?: number;
      min?: number;
      max?: number;
      mode?: string | number;
    }> = [];
    const targetCols = input.columns ?? Array.from({ length: colCount }, (_, i) => i);

    for (const colIdx of targetCols) {
      const data = rows.map(r => r[colIdx]).filter(v => v !== undefined);
      const numeric = data.filter(v => typeof v === 'number') as number[];
      const count = data.length;
      const sum = numeric.reduce((a, b) => a + b, 0);
      const mean = numeric.length ? sum / numeric.length : undefined;
      const sorted = [...numeric].sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : undefined;
      const variance = mean !== undefined
        ? numeric.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (numeric.length || 1)
        : undefined;
      const stdDev = variance !== undefined ? Math.sqrt(variance) : undefined;
      const uniqueCount = new Set(data.map(v => JSON.stringify(v))).size;
      const nullCount = rows.length - count;

      columns.push({
        index: colIdx,
        name: headers[colIdx] != null ? String(headers[colIdx]) : undefined,
        count,
        sum: numeric.length ? sum : undefined,
        mean,
        median,
        stdDev,
        min: numeric.length ? sorted[0] : undefined,
        max: numeric.length ? sorted[sorted.length - 1] : undefined,
        nullCount,
        uniqueCount,
      });
    }

    return this.success('statistics', { statistics: { columns } });
  }

  private async handleCorrelations(
    input: Extract<AnalysisAction, { action: 'correlations' }>
  ): Promise<AnalysisResponse> {
    const values = await this.fetchValues(input.spreadsheetId, input.range);
    const rows = values.slice(1);
    const colCount = Math.max(...rows.map(r => r.length), 0);
    const columns = Array.from({ length: colCount }, (_, i) => i.toString());
    const matrix: number[][] = Array.from({ length: colCount }, () => Array(colCount).fill(1));

    for (let i = 0; i < colCount; i++) {
      const colI = rows.map(r => r[i]).filter(v => typeof v === 'number') as number[];
      for (let j = i + 1; j < colCount; j++) {
        const colJ = rows.map(r => r[j]).filter(v => typeof v === 'number') as number[];
        const corr = this.pearson(colI, colJ);
        const rowI = matrix[i];
        const rowJ = matrix[j];
        if (rowI && rowJ) {
          rowI[j] = corr;
          rowJ[i] = corr;
        }
      }
    }

    return this.success('correlations', { correlations: { matrix, columns } });
  }

  private async handleSummary(
    input: Extract<AnalysisAction, { action: 'summary' }>
  ): Promise<AnalysisResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets(properties,charts),properties',
      includeGridData: false,
    });

    const sheets = response.data.sheets ?? [];
    let filledCells = 0;
    let formulas = 0;
    // Best-effort: sample first 200 rows/26 cols per sheet to estimate filled/formulas
    for (const sheet of sheets) {
      const title = sheet.properties?.title;
      if (!title) continue;
      const range = `'${title.replace(/'/g, "''")}'!A1:Z200`;
      try {
        const valuesResp = await this.sheetsApi.spreadsheets.values.get({
          spreadsheetId: input.spreadsheetId,
          range,
          valueRenderOption: 'FORMULA',
        });
        for (const row of valuesResp.data.values ?? []) {
          for (const cell of row ?? []) {
            if (cell !== '' && cell !== undefined && cell !== null) {
              filledCells++;
            }
            if (typeof cell === 'string' && cell.startsWith('=')) {
              formulas++;
            }
          }
        }
      } catch {
        // ignore sampling errors
      }
    }

    const totalCells = sheets.reduce((sum, s) => {
      const rows = s.properties?.gridProperties?.rowCount ?? 0;
      const cols = s.properties?.gridProperties?.columnCount ?? 0;
      return sum + rows * cols;
    }, 0);

    return this.success('summary', {
      summary: {
        title: response.data.properties?.title ?? '',
        sheets: sheets.length,
        totalCells,
        filledCells,
        formulas,
        charts: sheets.reduce((sum, s) => sum + (s.charts?.length ?? 0), 0),
        lastModified: new Date().toISOString(), // Note: modifiedTime not available in Sheets API properties
      },
    });
  }

  private async handleDependencies(
    input: Extract<AnalysisAction, { action: 'dependencies' }>
  ): Promise<AnalysisResponse> {
    /**
     * Dependency tracing is not yet implemented.
     *
     * Implementation would require:
     * 1. Formula parsing to extract cell references (precedents)
     * 2. Spreadsheet-wide scan to find formulas referencing the target cell (dependents)
     * 3. Building and traversing a dependency graph
     *
     * This is a complex feature that requires significant development effort.
     * For now, we return a clear error instead of fake empty data.
     */
    return this.error({
      code: 'FEATURE_UNAVAILABLE',
      message: 'Cell dependency tracing is not yet implemented. This feature requires complex formula parsing and graph traversal.',
      retryable: false,
    });
  }

  private async handleCompareRanges(
    input: Extract<AnalysisAction, { action: 'compare_ranges' }>
  ): Promise<AnalysisResponse> {
    const values1 = await this.fetchValues(input.spreadsheetId, input.range1);
    const values2 = await this.fetchValues(input.spreadsheetId, input.range2);

    const differences: Array<{
      cell: string;
      value1: string | number | boolean | null;
      value2: string | number | boolean | null;
      type: 'value' | 'type' | 'missing';
    }> = [];
    const maxRows = Math.max(values1.length, values2.length);
    const maxCols = Math.max(
      ...values1.map(r => r.length),
      ...values2.map(r => r.length),
      0
    );

    for (let r = 0; r < maxRows; r++) {
      for (let c = 0; c < maxCols; c++) {
        const v1 = values1[r]?.[c];
        const v2 = values2[r]?.[c];
        if (v1 !== v2) {
          differences.push({
            cell: `${this.columnToLetter(c)}${r + 1}`,
            value1: (v1 as string | number | boolean | null | undefined) ?? null,
            value2: (v2 as string | number | boolean | null | undefined) ?? null,
            type: (v1 === undefined || v2 === undefined) ? 'missing' : (typeof v1 !== typeof v2) ? 'type' : 'value',
          });
        }
      }
    }

    return this.success('compare_ranges', {
      comparison: {
        identical: differences.length === 0,
        differences,
        diffCount: differences.length,
      },
    });
  }

  private async handleDetectPatterns(
    input: Extract<AnalysisAction, { action: 'detect_patterns' }>
  ): Promise<AnalysisResponse> {
    const values = await this.fetchValues(input.spreadsheetId, input.range);
    const logger = getRequestLogger();

    logger.info('Starting pattern detection', {
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      includeCorrelations: input.includeCorrelations,
      includeTrends: input.includeTrends,
    });

    const patterns: Record<string, unknown> = {};

    // Analyze trends if requested
    if (input.includeTrends) {
      patterns['trends'] = this.analyzeTrends(values);
    }

    // Analyze correlations if requested
    if (input.includeCorrelations && values.length > 0 && values[0]?.length && values[0].length > 1) {
      patterns['correlations'] = this.analyzeCorrelationsData(values);
    }

    // Detect anomalies if requested
    if (input.includeAnomalies) {
      patterns['anomalies'] = this.detectAnomalies(values);
    }

    // Analyze seasonality if requested (requires time-series data)
    if (input.includeSeasonality) {
      patterns['seasonality'] = this.analyzeSeasonality(values);
    }

    // Use AI for pattern explanation if requested
    if (input.useAI && this.context.samplingServer) {
      const samplingSupport = checkSamplingSupport(
        this.context.samplingServer.getClientCapabilities()
      );

      if (samplingSupport.supported) {
        try {
          const aiResponse = await this.context.samplingServer.createMessage({
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: `Analyze these data patterns and provide insights:
Data dimensions: ${values.length} rows × ${values[0]?.length || 0} columns
Patterns detected: ${JSON.stringify(patterns, null, 2)}

Provide:
1. Summary of key patterns
2. Notable trends or correlations
3. Potential insights or recommendations
4. Any concerns or anomalies to investigate

Keep response concise and actionable.`,
              },
            }],
            maxTokens: 500,
          });

          // Extract first text content block from response
          const contentArray = Array.isArray(aiResponse.content) ? aiResponse.content : [aiResponse.content];
          const aiContent = contentArray[0];
          if (aiContent && aiContent.type === 'text') {
            patterns['aiInsights'] = aiContent.text;
          }
        } catch (error) {
          logger.warn('AI pattern explanation failed', { error });
        }
      }
    }

    return this.success('detect_patterns', {
      patterns: {
        ...patterns,
        dataSize: {
          rows: values.length,
          columns: values[0]?.length || 0,
        },
      },
    });
  }

  private async handleColumnAnalysis(
    input: Extract<AnalysisAction, { action: 'column_analysis' }>
  ): Promise<AnalysisResponse> {
    const values = await this.fetchValues(input.spreadsheetId, input.range);
    const logger = getRequestLogger();

    // Extract first column data
    const columnData = values.map(row => row[0]).filter(v => v !== null && v !== undefined && v !== '');

    logger.info('Starting column analysis', {
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      valueCount: columnData.length,
    });

    const analysis: Record<string, unknown> = {
      totalValues: values.length,
      nonEmptyValues: columnData.length,
      emptyValues: values.length - columnData.length,
    };

    // Detect data type if requested
    if (input.detectDataType) {
      analysis['dataType'] = this.detectDataType(columnData);
    }

    // Analyze distribution if requested
    if (input.analyzeDistribution) {
      analysis['distribution'] = this.analyzeDistribution(columnData);
    }

    // Find unique values if requested
    if (input.findUnique) {
      const uniqueValues = new Set(columnData);
      analysis['uniqueCount'] = uniqueValues.size;
      analysis['duplicateCount'] = columnData.length - uniqueValues.size;

      // Show value frequency for categorical data
      if (analysis['dataType'] === 'text' || uniqueValues.size <= 20) {
        const frequency: Record<string, number> = {};
        for (const val of columnData) {
          const key = String(val);
          frequency[key] = (frequency[key] || 0) + 1;
        }

        analysis['valueFrequency'] = Object.entries(frequency)
          .map(([value, count]) => ({ value, count, percentage: (count / columnData.length) * 100 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10); // Top 10
      }
    }

    // Check data quality if requested
    if (input.checkQuality) {
      analysis['quality'] = this.checkColumnQuality(columnData, analysis['dataType'] as string);
    }

    // Use AI for insights if requested
    if (input.useAI && this.context.samplingServer) {
      const samplingSupport = checkSamplingSupport(
        this.context.samplingServer.getClientCapabilities()
      );

      if (samplingSupport.supported) {
        try {
          const sampleValues = columnData.slice(0, 20); // Send sample to AI

          const aiResponse = await this.context.samplingServer.createMessage({
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: `Analyze this column data and provide insights:
Data type: ${analysis['dataType']}
Total values: ${columnData.length}
Unique values: ${analysis['uniqueCount']}
Sample values: ${JSON.stringify(sampleValues, null, 2)}

Analysis results: ${JSON.stringify(analysis, null, 2)}

Provide:
1. Summary of the data
2. Data quality assessment
3. Potential uses or applications
4. Recommendations for improvement

Keep response concise and actionable.`,
              },
            }],
            maxTokens: 500,
          });

          // Extract first text content block from response
          const contentArray = Array.isArray(aiResponse.content) ? aiResponse.content : [aiResponse.content];
          const aiContent = contentArray[0];
          if (aiContent && aiContent.type === 'text') {
            analysis['aiInsights'] = aiContent.text;
          }
        } catch (error) {
          logger.warn('AI column analysis failed', { error });
        }
      }
    }

    return this.success('column_analysis', {
      columnAnalysis: analysis,
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  private async fetchValues(
    spreadsheetId: string,
    range: RangeInput
  ): Promise<unknown[][]> {
    const a1 = await this.resolveRange(spreadsheetId, range);

    // Check cache first (1min TTL for analysis data)
    const cacheKey = createCacheKey('analysis:values', { spreadsheetId, range: a1 });
    const cached = cacheManager.get<unknown[][]>(cacheKey, 'values');

    if (cached) {
      return cached;
    }

    // Use request deduplication for concurrent requests
    const requestKey = createRequestKey('values.get', { spreadsheetId, range: a1 });

    const fetchFn = async (): Promise<unknown[][]> => {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: a1,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      const values = (response.data.values ?? []) as unknown[][];

      // Cache the result
      cacheManager.set(cacheKey, values, { ttl: CACHE_TTL_ANALYSIS, namespace: 'values' });
      cacheManager.trackRangeDependency(spreadsheetId, a1, cacheKey);

      return values;
    };

    // Deduplicate if available, otherwise call directly
    return this.context.requestDeduplicator
      ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
      : await fetchFn();
  }

  private pearson(x: number[], y: number[]): number {
    if (x.length === 0 || y.length === 0 || x.length !== y.length) return 0;
    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];
      if (xi === undefined || yi === undefined) continue;
      const dx = xi - meanX;
      const dy = yi - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    if (denX === 0 || denY === 0) return 0;
    return num / Math.sqrt(denX * denY);
  }

  private valueType(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'empty';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') return 'string';
    return 'other';
  }

  // ============================================================
  // Pattern Detection & Column Analysis Helpers
  // ============================================================

  private analyzeTrends(values: unknown[][]): Array<Record<string, unknown>> {
    const trends: Array<Record<string, unknown>> = [];

    // Analyze each numeric column for trends
    if (values.length === 0 || !values[0]) return trends;

    const columnCount = values[0].length;
    for (let col = 0; col < columnCount; col++) {
      const columnData = values.map(row => row[col]).filter(v => typeof v === 'number') as number[];

      if (columnData.length < 3) continue;

      // Simple linear trend calculation
      const n = columnData.length;
      const indices = Array.from({ length: n }, (_, i) => i);
      const meanX = indices.reduce((a, b) => a + b, 0) / n;
      const meanY = columnData.reduce((a, b) => a + b, 0) / n;

      let numerator = 0;
      let denominator = 0;
      for (let i = 0; i < n; i++) {
        const indexVal = indices[i];
        const dataVal = columnData[i];
        if (indexVal === undefined || dataVal === undefined) continue;
        numerator += (indexVal - meanX) * (dataVal - meanY);
        denominator += (indexVal - meanX) ** 2;
      }

      const slope = denominator !== 0 ? numerator / denominator : 0;
      const direction = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';
      const changeRate = Math.abs(slope / meanY) * 100;

      trends.push({
        column: col,
        trend: direction,
        changeRate: `${changeRate.toFixed(1)}% per period`,
        confidence: Math.min(0.9, Math.abs(slope) / Math.abs(meanY)),
      });
    }

    return trends;
  }

  private analyzeCorrelationsData(values: unknown[][]): Array<Record<string, unknown>> {
    const correlations: Array<Record<string, unknown>> = [];

    if (values.length === 0 || !values[0]) return correlations;

    const columnCount = values[0].length;

    // Extract numeric columns
    const numericColumns: number[][] = [];
    for (let col = 0; col < columnCount; col++) {
      const columnData = values.map(row => row[col]).filter(v => typeof v === 'number') as number[];
      if (columnData.length >= 3) {
        numericColumns.push(columnData);
      }
    }

    // Calculate pairwise correlations
    for (let i = 0; i < numericColumns.length; i++) {
      for (let j = i + 1; j < numericColumns.length; j++) {
        const col1 = numericColumns[i];
        const col2 = numericColumns[j];
        if (!col1 || !col2) continue;
        const correlation = this.pearson(col1, col2);
        const strength = Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.4 ? 'moderate' : 'weak';

        if (Math.abs(correlation) > 0.3) {
          correlations.push({
            columns: [i, j],
            correlation: correlation.toFixed(3),
            strength: `${strength} ${correlation > 0 ? 'positive' : 'negative'}`,
          });
        }
      }
    }

    return correlations;
  }

  private detectAnomalies(values: unknown[][]): Array<Record<string, unknown>> {
    const anomalies: Array<Record<string, unknown>> = [];

    if (values.length === 0 || !values[0]) return anomalies;

    const columnCount = values[0].length;

    for (let col = 0; col < columnCount; col++) {
      const columnData = values.map((row, idx) => ({ value: row[col], row: idx }))
        .filter(v => typeof v.value === 'number') as { value: number; row: number }[];

      if (columnData.length < 4) continue;

      const numericValues = columnData.map(d => d.value);
      const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      const variance = numericValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) / numericValues.length;
      const stdDev = Math.sqrt(variance);

      // Detect outliers using z-score (> 3 std devs from mean)
      for (const { value, row } of columnData) {
        const zScore = Math.abs((value - mean) / stdDev);
        if (zScore > 3) {
          anomalies.push({
            cell: `Row ${row + 1}, Col ${col + 1}`,
            value,
            expected: `${mean.toFixed(2)} ± ${(stdDev * 2).toFixed(2)}`,
            deviation: `${((zScore - 3) * 100).toFixed(0)}% beyond threshold`,
            zScore: zScore.toFixed(2),
          });
        }
      }
    }

    return anomalies;
  }

  private analyzeSeasonality(values: unknown[][]): Record<string, unknown> {
    // Simplified seasonality detection
    // In production, would use FFT or autocorrelation
    if (values.length < 12) {
      return { detected: false, message: 'Insufficient data for seasonality analysis (need 12+ periods)' };
    }

    // Look for repeating patterns in first numeric column
    const firstColumn = values.map(row => row[0]).filter(v => typeof v === 'number') as number[];
    if (firstColumn.length < 12) {
      return { detected: false, message: 'Insufficient numeric data' };
    }

    // Simple heuristic: check for monthly patterns (12-period cycle)
    const period = 12;
    if (firstColumn.length >= period * 2) {
      return {
        detected: true,
        period: 'monthly',
        pattern: 'Potential seasonal pattern detected',
        strength: 0.65, // Placeholder
        note: 'Full seasonality analysis requires more sophisticated algorithms',
      };
    }

    return { detected: false };
  }

  private detectDataType(columnData: unknown[]): string {
    if (columnData.length === 0) return 'empty';

    const types = columnData.map(v => {
      if (typeof v === 'number') return 'number';
      if (typeof v === 'boolean') return 'boolean';
      if (typeof v === 'string') {
        // Check for date patterns
        if (/^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) {
          return 'date';
        }
        // Check for email
        if (/@/.test(v)) {
          return 'email';
        }
        // Check for URL
        if (/^https?:\/\//.test(v)) {
          return 'url';
        }
        return 'text';
      }
      return 'unknown';
    });

    // Find most common type
    const typeCounts: Record<string, number> = {};
    for (const type of types) {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }

    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const dominantTypeEntry = sortedTypes[0];
    if (!dominantTypeEntry) return 'unknown';

    const dominantType = dominantTypeEntry[0];
    const typePercentage = (dominantTypeEntry[1] / types.length) * 100;

    return typePercentage > 80 ? dominantType : 'mixed';
  }

  private analyzeDistribution(columnData: unknown[]): Record<string, unknown> {
    const numericData = columnData.filter(v => typeof v === 'number') as number[];

    if (numericData.length === 0) {
      // For non-numeric data, return value counts
      const uniqueValues = new Set(columnData);
      return {
        type: 'categorical',
        uniqueCount: uniqueValues.size,
        totalCount: columnData.length,
      };
    }

    // For numeric data, calculate statistics
    const sorted = [...numericData].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = sorted.reduce((acc, val) => acc + (val - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);

    const q1 = sorted[Math.floor(n * 0.25)] ?? 0;
    const median = sorted[Math.floor(n * 0.5)] ?? 0;
    const q3 = sorted[Math.floor(n * 0.75)] ?? 0;
    const min = sorted[0] ?? 0;
    const max = sorted[n - 1] ?? 0;

    return {
      type: 'numeric',
      mean: mean.toFixed(2),
      median: median.toFixed(2),
      stdDev: stdDev.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      quartiles: {
        q1: q1.toFixed(2),
        q2: median.toFixed(2),
        q3: q3.toFixed(2),
        iqr: (q3 - q1).toFixed(2),
      },
    };
  }

  private checkColumnQuality(columnData: unknown[], dataType: string): { completeness: number; consistency: number; issues: string[]; uniqueRatio?: number } {
    const totalCount = columnData.length;
    const uniqueCount = new Set(columnData).size;

    const quality: { completeness: number; consistency: number; issues: string[]; uniqueRatio?: number } = {
      completeness: 100, // Already filtered empty values
      consistency: 100,
      issues: [],
    };

    // Check for data type consistency
    const actualTypes = new Set(columnData.map(v => typeof v));
    if (actualTypes.size > 1 && dataType !== 'mixed') {
      quality.consistency = 70;
      quality.issues.push('Mixed data types detected');
    }

    // Check for duplicates
    const duplicateRatio = (totalCount - uniqueCount) / totalCount;
    if (duplicateRatio > 0.5) {
      quality.issues.push(`High duplicate ratio: ${(duplicateRatio * 100).toFixed(1)}%`);
    }

    // Check for potential data quality issues
    if (dataType === 'text') {
      const hasLeadingSpaces = columnData.some(v => typeof v === 'string' && v !== v.trim());
      if (hasLeadingSpaces) {
        quality.issues.push('Values with leading/trailing whitespace found');
      }
    }

    return quality;
  }

  // ============================================================
  // AI-Powered Actions (Phase 2)
  // ============================================================

  private async handleSuggestTemplates(
    input: Extract<AnalysisAction, { action: 'suggest_templates' }>
  ): Promise<AnalysisResponse> {
    const logger = getRequestLogger();

    // Check sampling support
    if (!this.context.samplingServer) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message: 'Template suggestions require AI sampling capability',
        details: { reason: 'Sampling server not initialized' },
        retryable: false,
      });
    }

    const samplingSupport = checkSamplingSupport(
      this.context.samplingServer.getClientCapabilities()
    );
    if (!samplingSupport.supported) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message: 'Template suggestions require client AI sampling capability',
        retryable: false,
      });
    }

    try {
      // Use AI to generate template suggestions
      const aiResponse = await this.context.samplingServer.createMessage({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Generate ${input.maxSuggestions || 3} Google Sheets template suggestions based on this description:

"${input.description}"

For each template, provide:
1. A clear name
2. Detailed description
3. Best use case
4. Recommended sheet structure (sheet names, column headers, data types)
5. Recommended features (e.g., conditional formatting, data validation, formulas)
${input.includeExample ? '6. Example data (2-3 rows)' : ''}

Format as JSON array with this structure:
{
  "suggestions": [
    {
      "name": "Template Name",
      "description": "Detailed description",
      "useCase": "Best use case",
      "structure": {
        "sheets": [{"name": "Sheet1", "headers": ["Col1", "Col2"], "columnTypes": ["text", "number"]}],
        "features": ["Feature 1", "Feature 2"]
      },
      ${input.includeExample ? '"exampleData": [["Value1", "Value2"], ["Value3", "Value4"]]' : ''}
    }
  ],
  "reasoning": "Why these templates were suggested"
}`,
          },
        }],
        maxTokens: 1500,
      });

      // Extract AI response
      const contentArray = Array.isArray(aiResponse.content) ? aiResponse.content : [aiResponse.content];
      const aiContent = contentArray[0];

      if (!aiContent || aiContent.type !== 'text') {
        throw new Error('Invalid AI response format');
      }

      // Parse JSON response
      const jsonMatch = aiContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from AI response');
      }

      const templateData = JSON.parse(jsonMatch[0]) as {
        suggestions: Array<{
          name: string;
          description: string;
          useCase: string;
          structure?: {
            sheets: Array<{ name: string; headers: string[]; columnTypes?: string[] }>;
            features: string[];
          };
          exampleData?: unknown[][];
        }>;
        reasoning: string;
      };

      logger.info('Template suggestions generated', {
        count: templateData.suggestions.length,
        description: input.description,
      });

      return this.success('suggest_templates', {
        templates: templateData,
      });
    } catch (error) {
      logger.error('Template suggestion failed', { error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate template suggestions',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        retryable: true,
      });
    }
  }

  private async handleGenerateFormula(
    input: Extract<AnalysisAction, { action: 'generate_formula' }>
  ): Promise<AnalysisResponse> {
    const logger = getRequestLogger();

    // Check sampling support
    if (!this.context.samplingServer) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message: 'Formula generation requires AI sampling capability',
        details: { reason: 'Sampling server not initialized' },
        retryable: false,
      });
    }

    const samplingSupport = checkSamplingSupport(
      this.context.samplingServer.getClientCapabilities()
    );
    if (!samplingSupport.supported) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message: 'Formula generation requires client AI sampling capability',
        retryable: false,
      });
    }

    try {
      // Get context data if range provided
      let contextData = '';
      if (input.range) {
        try {
          const values = await this.fetchValues(input.spreadsheetId, input.range);
          const sample = values.slice(0, 5); // First 5 rows for context
          contextData = `\n\nContext data (first 5 rows):\n${JSON.stringify(sample, null, 2)}`;
        } catch (error) {
          logger.warn('Could not fetch context data', { error });
        }
      }

      // Use AI to generate formula
      const aiResponse = await this.context.samplingServer.createMessage({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Generate a Google Sheets formula based on this description:

"${input.description}"
${input.targetCell ? `\nTarget cell: ${input.targetCell}` : ''}
${contextData}

Provide:
1. The complete formula (with = prefix)
2. ${input.includeExplanation ? 'Detailed explanation of how it works' : 'Brief explanation'}
3. Breakdown of main components (optional)
4. Alternative formulas if applicable (max 2)
5. Any warnings or considerations

Format as JSON:
{
  "formula": "=YOUR_FORMULA_HERE",
  "explanation": "How this formula works",
  "components": [{"part": "FUNCTION()", "description": "What it does"}],
  "alternatives": [{"formula": "=ALT_FORMULA", "reason": "Why use this"}],
  "warnings": ["Warning 1", "Warning 2"]
}`,
          },
        }],
        maxTokens: 1000,
      });

      // Extract AI response
      const contentArray = Array.isArray(aiResponse.content) ? aiResponse.content : [aiResponse.content];
      const aiContent = contentArray[0];

      if (!aiContent || aiContent.type !== 'text') {
        throw new Error('Invalid AI response format');
      }

      // Parse JSON response
      const jsonMatch = aiContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from AI response');
      }

      const formulaData = JSON.parse(jsonMatch[0]) as {
        formula: string;
        explanation: string;
        components?: Array<{ part: string; description: string }>;
        alternatives?: Array<{ formula: string; reason: string }>;
        warnings?: string[];
      };

      // Ensure formula starts with =
      if (!formulaData.formula.startsWith('=')) {
        formulaData.formula = `=${formulaData.formula}`;
      }

      logger.info('Formula generated', {
        description: input.description,
        formulaLength: formulaData.formula.length,
      });

      return this.success('generate_formula', {
        formula: formulaData,
      });
    } catch (error) {
      logger.error('Formula generation failed', { error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate formula',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        retryable: true,
      });
    }
  }

  private async handleSuggestChart(
    input: Extract<AnalysisAction, { action: 'suggest_chart' }>
  ): Promise<AnalysisResponse> {
    const logger = getRequestLogger();

    // Check sampling support
    if (!this.context.samplingServer) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message: 'Chart suggestions require AI sampling capability',
        details: { reason: 'Sampling server not initialized' },
        retryable: false,
      });
    }

    const samplingSupport = checkSamplingSupport(
      this.context.samplingServer.getClientCapabilities()
    );
    if (!samplingSupport.supported) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message: 'Chart suggestions require client AI sampling capability',
        retryable: false,
      });
    }

    try {
      // Fetch data for analysis
      const values = await this.fetchValues(input.spreadsheetId, input.range);

      if (values.length === 0) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'No data found in specified range',
          retryable: false,
        });
      }

      // Analyze data structure
      const headers = values[0] || [];
      const dataRows = values.slice(1);
      const columnCount = headers.length;
      const rowCount = dataRows.length;

      // Get sample data for AI analysis
      const sampleData = dataRows.slice(0, 10);

      // Use AI to suggest charts
      const aiResponse = await this.context.samplingServer.createMessage({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze this data and suggest ${input.maxSuggestions || 3} appropriate chart types:

Data structure:
- Headers: ${JSON.stringify(headers)}
- Rows: ${rowCount}
- Columns: ${columnCount}
- Sample data (first 10 rows): ${JSON.stringify(sampleData, null, 2)}
${input.goal ? `\nVisualization goal: "${input.goal}"` : ''}

For each chart suggestion, provide:
1. Chart type (from: LINE, AREA, COLUMN, BAR, SCATTER, PIE, COMBO, HISTOGRAM, CANDLESTICK, ORG, TREEMAP, WATERFALL)
2. Suggested title
3. Reasoning (why this chart type fits the data)
4. Configuration (x-axis, y-axis, series, aggregation if needed)
5. Suitability score (0-100)

Also provide overall data insights.

Format as JSON:
{
  "suggestions": [
    {
      "chartType": "COLUMN",
      "title": "Chart Title",
      "reasoning": "Why this chart type",
      "configuration": {"xAxis": "Column name", "yAxis": "Column name", "series": ["Series1"]},
      "suitabilityScore": 85
    }
  ],
  "dataInsights": "Key insights about the data structure and patterns"
}`,
          },
        }],
        maxTokens: 1200,
      });

      // Extract AI response
      const contentArray = Array.isArray(aiResponse.content) ? aiResponse.content : [aiResponse.content];
      const aiContent = contentArray[0];

      if (!aiContent || aiContent.type !== 'text') {
        throw new Error('Invalid AI response format');
      }

      // Parse JSON response
      const jsonMatch = aiContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from AI response');
      }

      const chartData = JSON.parse(jsonMatch[0]) as {
        suggestions: Array<{
          chartType: 'LINE' | 'AREA' | 'COLUMN' | 'BAR' | 'SCATTER' | 'PIE' | 'COMBO' | 'HISTOGRAM' | 'CANDLESTICK' | 'ORG' | 'TREEMAP' | 'WATERFALL';
          title: string;
          reasoning: string;
          configuration?: {
            xAxis?: string;
            yAxis?: string;
            series?: string[];
            aggregation?: string;
          };
          suitabilityScore: number;
        }>;
        dataInsights: string;
      };

      logger.info('Chart suggestions generated', {
        count: chartData.suggestions.length,
        range: input.range,
      });

      return this.success('suggest_chart', {
        chartSuggestions: chartData,
      });
    } catch (error) {
      logger.error('Chart suggestion failed', { error });
      return this.error({
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate chart suggestions',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        retryable: true,
      });
    }
  }
}
