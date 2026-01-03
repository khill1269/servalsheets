/**
 * ServalSheets - Analysis Handler
 *
 * Handles sheets_analysis tool (read-only analytics)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsAnalysisInput, SheetsAnalysisOutput } from '../schemas/analysis.js';
import type { RangeInput } from '../schemas/shared.js';

export class AnalysisHandler extends BaseHandler<SheetsAnalysisInput, SheetsAnalysisOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_analysis', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsAnalysisInput): Promise<SheetsAnalysisOutput> {
    try {
      switch (input.action) {
        case 'data_quality':
          return await this.handleDataQuality(input);
        case 'formula_audit':
          return await this.handleFormulaAudit(input);
        case 'structure_analysis':
          return await this.handleStructure(input);
        case 'statistics':
          return await this.handleStatistics(input);
        case 'correlations':
          return await this.handleCorrelations(input);
        case 'summary':
          return await this.handleSummary(input);
        case 'dependencies':
          return await this.handleDependencies(input);
        case 'compare_ranges':
          return await this.handleCompareRanges(input);
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

  protected createIntents(_input: SheetsAnalysisInput): Intent[] {
    // Read-only handler
    return [];
  }

  // ============================================================
  // Actions
  // ============================================================

  private async handleDataQuality(
    input: Extract<SheetsAnalysisInput, { action: 'data_quality' }>
  ): Promise<SheetsAnalysisOutput> {
    const range = input.range ?? { a1: 'A1:Z200' };
    const values = await this.fetchValues(input.spreadsheetId, range);

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
    input: Extract<SheetsAnalysisInput, { action: 'formula_audit' }>
  ): Promise<SheetsAnalysisOutput> {
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
    for (const row of response.data.values ?? []) {
      for (const cell of row ?? []) {
        if (typeof cell === 'string' && cell.startsWith('=')) {
          formulas.push(cell);
          if (cell.includes('#REF!') || cell.includes('#ERROR')) {
            issues.push({
              type: 'BROKEN_REFERENCE',
              severity: 'high',
              cell: '', // cell addresses not returned by values.get; omit
              formula: cell,
              description: 'Formula contains a broken reference',
              suggestion: 'Repoint the reference to a valid range.',
            });
          }
          if (/(NOW\(|TODAY\(|RAND\(|RANDBETWEEN\()/.test(cell)) {
            issues.push({
              type: 'VOLATILE_FUNCTION',
              severity: 'medium',
              cell: '',
              formula: cell,
              description: 'Volatile function may recalc frequently.',
              suggestion: 'Consider static values or less volatile functions.',
            });
          }
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

    const uniqueFormulas = new Set(formulas);
    const score = Math.max(0, 100 - issues.length * 5);
    return this.success('formula_audit', {
      formulaAudit: {
        score,
        totalFormulas: formulas.length,
        uniqueFormulas: uniqueFormulas.size,
        issues,
        summary: issues.length === 0 ? 'No formula issues detected.' : `${issues.length} formula issue(s) detected.`,
      },
    });
  }

  private async handleStructure(
    input: Extract<SheetsAnalysisInput, { action: 'structure_analysis' }>
  ): Promise<SheetsAnalysisOutput> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.properties,namedRanges',
    });

    const sheets = response.data.sheets ?? [];
    const totalRows = sheets.reduce((sum, s) => sum + (s.properties?.gridProperties?.rowCount ?? 0), 0);
    const totalColumns = sheets.reduce((sum, s) => sum + (s.properties?.gridProperties?.columnCount ?? 0), 0);

    const namedRanges = (response.data.namedRanges ?? []).map(n => ({
      name: n.name ?? '',
      range: `${n.range?.sheetId ?? 0}:${n.range?.startRowIndex ?? 0}-${n.range?.endRowIndex ?? 0}`,
    }));

    return this.success('structure_analysis', {
      structure: {
        sheets: sheets.length,
        totalRows,
        totalColumns,
        tables: [],
        namedRanges,
      },
    });
  }

  private async handleStatistics(
    input: Extract<SheetsAnalysisInput, { action: 'statistics' }>
  ): Promise<SheetsAnalysisOutput> {
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
        name: headers[colIdx] as string | undefined,
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
    input: Extract<SheetsAnalysisInput, { action: 'correlations' }>
  ): Promise<SheetsAnalysisOutput> {
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
    input: Extract<SheetsAnalysisInput, { action: 'summary' }>
  ): Promise<SheetsAnalysisOutput> {
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
    input: Extract<SheetsAnalysisInput, { action: 'dependencies' }>
  ): Promise<SheetsAnalysisOutput> {
    // Dependency tracing not implemented
    return this.success('dependencies', {
      dependencies: {
        cell: input.cell ?? '',
        precedents: [],
        dependents: [],
      },
    });
  }

  private async handleCompareRanges(
    input: Extract<SheetsAnalysisInput, { action: 'compare_ranges' }>
  ): Promise<SheetsAnalysisOutput> {
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

  // ============================================================
  // Helpers
  // ============================================================

  private async fetchValues(
    spreadsheetId: string,
    range: RangeInput
  ): Promise<unknown[][]> {
    const a1 = await this.resolveRange(spreadsheetId, range);
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: a1,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    return (response.data.values ?? []) as unknown[][];
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
}
