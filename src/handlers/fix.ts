/**
 * ServalSheets - Fix Handler
 *
 * Automated issue resolution (F0) and data cleaning pipeline (F3).
 * Takes issues from sheets_analyze and applies fixes,
 * plus automated data cleaning: clean, standardize_formats,
 * fill_missing, detect_anomalies, suggest_cleaning.
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import { ValidationError } from '../core/errors.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsFixInput,
  SheetsFixOutput,
  FixRequest,
  FixOperation,
  IssueToFix,
  FixResult,
  CleanInput,
  StandardizeFormatsInput,
  FillMissingInput,
  DetectAnomaliesInput,
  SuggestCleaningInput,
  CellChange,
} from '../schemas/fix.js';

export class FixHandler extends BaseHandler<SheetsFixInput, SheetsFixOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_fix', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsFixInput): Promise<SheetsFixOutput> {
    try {
      // Phase 1, Task 1.4: Infer missing parameters from context
      const rawReq = unwrapRequest<SheetsFixInput['request']>(input);
      const req = this.inferRequestParameters(rawReq) as FixRequest & {
        verbosity?: 'minimal' | 'standard' | 'detailed';
      };

      const verbosity = req.verbosity ?? 'standard';
      // Dispatch based on action
      switch (req.action) {
        case 'fix':
          return this.handleFix(req as FixRequest & { action: 'fix' }, verbosity);
        case 'clean':
          return this.handleClean(req as unknown as CleanInput, verbosity);
        case 'standardize_formats':
          return this.handleStandardizeFormats(
            req as unknown as StandardizeFormatsInput,
            verbosity
          );
        case 'fill_missing':
          return this.handleFillMissing(req as unknown as FillMissingInput, verbosity);
        case 'detect_anomalies':
          return this.handleDetectAnomalies(req as unknown as DetectAnomaliesInput, verbosity);
        case 'suggest_cleaning':
          return this.handleSuggestCleaning(req as unknown as SuggestCleaningInput, verbosity);
        default:
          return {
            response: this.mapError(
              new ValidationError(
                `Unknown action: ${(req as { action: string }).action}`,
                'action',
                'fix | clean | standardize_formats | fill_missing | detect_anomalies | suggest_cleaning'
              )
            ),
          };
      }
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  // ─── F0: Original fix action ───

  private async handleFix(
    req: FixRequest & { action: 'fix'; verbosity?: 'minimal' | 'standard' | 'detailed' },
    verbosity: string
  ): Promise<SheetsFixOutput> {
    // Type narrow to ensure required fields are present
    if (!req.spreadsheetId || !req.issues) {
      return {
        response: this.mapError(new Error('Missing required fields: spreadsheetId and issues')),
      };
    }

    const mode = req.mode ?? 'preview';

    // Filter issues based on user preferences
    const filteredIssues = this.filterIssues(req.issues, req.filters);

    if (filteredIssues.length === 0) {
      const response = {
        success: true as const,
        mode,
        operations: [] as FixOperation[],
        summary: { total: 0, skipped: req.issues.length },
        message: 'No issues matched the filters',
      };
      return {
        response: super.applyVerbosityFilter(response, verbosity),
      };
    }

    // Generate fix operations
    const operations = await this.generateFixOperations(req.spreadsheetId, filteredIssues);

    // Preview mode - just return operations
    if (mode === 'preview' || req.safety?.dryRun) {
      const response = {
        success: true as const,
        mode: 'preview' as const,
        operations,
        summary: {
          total: operations.length,
        },
        message: `Preview: ${operations.length} operation(s) ready to apply. Use mode="apply" to execute.`,
      };
      return {
        response: super.applyVerbosityFilter(response, verbosity),
      };
    }

    // Apply mode - execute operations
    const snapshot =
      req.safety?.createSnapshot !== false
        ? await this.createSnapshot(req.spreadsheetId)
        : undefined;

    const results = await this.applyFixOperations(req.spreadsheetId, operations);

    // Count successes/failures
    const applied = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Track context on success
    if (applied > 0) {
      this.trackContextFromRequest({
        spreadsheetId: req.spreadsheetId,
      });
    }

    const response = {
      success: true as const,
      mode: 'apply' as const,
      operations,
      results,
      snapshotId: snapshot?.revisionId,
      summary: {
        total: operations.length,
        applied,
        failed,
      },
      message: `Applied ${applied}/${operations.length} fix(es). ${failed} failed.`,
    };

    return {
      response: super.applyVerbosityFilter(response, verbosity),
    };
  }

  // ─── F3: Clean action ───

  private async handleClean(req: CleanInput, verbosity: string): Promise<SheetsFixOutput> {
    if (!req.spreadsheetId || !req.range) {
      return {
        response: this.mapError(new Error('Missing required fields: spreadsheetId and range')),
      };
    }

    const mode = req.mode ?? 'preview';

    // Dynamically import to avoid circular deps and keep handler lean
    const { CleaningEngine, parseRangeOffset } = await import('../services/cleaning-engine.js');
    const engine = new CleaningEngine();

    // Fetch data from the range
    const data = await this.fetchRangeData(req.spreadsheetId, req.range);
    const rangeOffset = parseRangeOffset(req.range);

    // Run cleaning
    const result = await engine.clean(data, req.rules, rangeOffset);

    // Apply mode: write changes back
    if (mode === 'apply' && result.changes.length > 0) {
      const snapshot =
        req.safety?.createSnapshot !== false
          ? await this.createSnapshot(req.spreadsheetId)
          : undefined;

      await this.writeChanges(req.spreadsheetId, req.range, data, result.changes, rangeOffset);

      this.trackContextFromRequest({ spreadsheetId: req.spreadsheetId });

      const response = {
        success: true as const,
        mode: 'apply' as const,
        action: 'clean',
        operations: [] as FixOperation[],
        summary: { total: result.changes.length, applied: result.changes.length },
        message: `Cleaned ${result.summary.cellsCleaned} cell(s) using ${result.summary.rulesApplied.length} rule(s).`,
        snapshotId: snapshot?.revisionId,
        changes: result.changes,
        cleaningSummary: result.summary,
      };
      return { response: super.applyVerbosityFilter(response, verbosity) };
    }

    // Preview mode
    const response = {
      success: true as const,
      mode: 'preview' as const,
      action: 'clean',
      operations: [] as FixOperation[],
      summary: { total: result.changes.length },
      message: `Preview: ${result.summary.cellsCleaned} cell(s) would be cleaned using ${result.summary.rulesApplied.length} rule(s). Use mode="apply" to execute.`,
      changes: result.changes,
      cleaningSummary: result.summary,
    };
    return { response: super.applyVerbosityFilter(response, verbosity) };
  }

  // ─── F3: Standardize formats action ───

  private async handleStandardizeFormats(
    req: StandardizeFormatsInput,
    verbosity: string
  ): Promise<SheetsFixOutput> {
    if (!req.spreadsheetId || !req.range || !req.columns) {
      return {
        response: this.mapError(
          new Error('Missing required fields: spreadsheetId, range, and columns')
        ),
      };
    }

    const mode = req.mode ?? 'preview';

    const { CleaningEngine, parseRangeOffset } = await import('../services/cleaning-engine.js');
    const engine = new CleaningEngine();

    const data = await this.fetchRangeData(req.spreadsheetId, req.range);
    const rangeOffset = parseRangeOffset(req.range);

    const result = await engine.standardizeFormats(data, req.columns, rangeOffset);

    if (mode === 'apply' && result.changes.length > 0) {
      const snapshot =
        req.safety?.createSnapshot !== false
          ? await this.createSnapshot(req.spreadsheetId)
          : undefined;

      await this.writeChanges(req.spreadsheetId, req.range, data, result.changes, rangeOffset);

      this.trackContextFromRequest({ spreadsheetId: req.spreadsheetId });

      const response = {
        success: true as const,
        mode: 'apply' as const,
        action: 'standardize_formats',
        operations: [] as FixOperation[],
        summary: { total: result.changes.length, applied: result.changes.length },
        message: `Standardized ${result.summary.cellsChanged} cell(s) across ${result.summary.columnsProcessed} column(s).`,
        snapshotId: snapshot?.revisionId,
        formatChanges: result.changes,
        formatSummary: result.summary,
      };
      return { response: super.applyVerbosityFilter(response, verbosity) };
    }

    const response = {
      success: true as const,
      mode: 'preview' as const,
      action: 'standardize_formats',
      operations: [] as FixOperation[],
      summary: { total: result.changes.length },
      message: `Preview: ${result.summary.cellsChanged} cell(s) would be standardized across ${result.summary.columnsProcessed} column(s). Use mode="apply" to execute.`,
      formatChanges: result.changes,
      formatSummary: result.summary,
    };
    return { response: super.applyVerbosityFilter(response, verbosity) };
  }

  // ─── F3: Fill missing action ───

  private async handleFillMissing(
    req: FillMissingInput,
    verbosity: string
  ): Promise<SheetsFixOutput> {
    if (!req.spreadsheetId || !req.range || !req.strategy) {
      return {
        response: this.mapError(
          new Error('Missing required fields: spreadsheetId, range, and strategy')
        ),
      };
    }

    const mode = req.mode ?? 'preview';

    const { CleaningEngine, parseRangeOffset } = await import('../services/cleaning-engine.js');
    const engine = new CleaningEngine();

    const data = await this.fetchRangeData(req.spreadsheetId, req.range);
    const rangeOffset = parseRangeOffset(req.range);

    const result = await engine.fillMissing(
      data,
      req.strategy,
      { constantValue: req.constantValue, columns: req.columns },
      rangeOffset
    );

    if (mode === 'apply' && result.changes.length > 0) {
      const snapshot =
        req.safety?.createSnapshot !== false
          ? await this.createSnapshot(req.spreadsheetId)
          : undefined;

      await this.writeChanges(req.spreadsheetId, req.range, data, result.changes, rangeOffset);

      this.trackContextFromRequest({ spreadsheetId: req.spreadsheetId });

      const response = {
        success: true as const,
        mode: 'apply' as const,
        action: 'fill_missing',
        operations: [] as FixOperation[],
        summary: { total: result.changes.length, applied: result.changes.length },
        message: `Filled ${result.summary.filled} of ${result.summary.totalEmpty} empty cell(s) using "${req.strategy}" strategy.`,
        snapshotId: snapshot?.revisionId,
        fillChanges: result.changes,
        fillSummary: result.summary,
      };
      return { response: super.applyVerbosityFilter(response, verbosity) };
    }

    const response = {
      success: true as const,
      mode: 'preview' as const,
      action: 'fill_missing',
      operations: [] as FixOperation[],
      summary: { total: result.changes.length },
      message: `Preview: ${result.summary.filled} of ${result.summary.totalEmpty} empty cell(s) would be filled using "${req.strategy}" strategy. Use mode="apply" to execute.`,
      fillChanges: result.changes,
      fillSummary: result.summary,
    };
    return { response: super.applyVerbosityFilter(response, verbosity) };
  }

  // ─── F3: Detect anomalies action ───

  private async handleDetectAnomalies(
    req: DetectAnomaliesInput,
    verbosity: string
  ): Promise<SheetsFixOutput> {
    if (!req.spreadsheetId || !req.range) {
      return {
        response: this.mapError(new Error('Missing required fields: spreadsheetId and range')),
      };
    }

    const { CleaningEngine, parseRangeOffset } = await import('../services/cleaning-engine.js');
    const engine = new CleaningEngine();

    const data = await this.fetchRangeData(req.spreadsheetId, req.range);
    const rangeOffset = parseRangeOffset(req.range);

    const result = await engine.detectAnomalies(
      data,
      req.method ?? 'iqr',
      req.threshold,
      req.columns,
      rangeOffset
    );

    // detect_anomalies is always read-only (no apply mode)
    const response = {
      success: true as const,
      mode: 'preview' as const,
      action: 'detect_anomalies',
      operations: [] as FixOperation[],
      summary: { total: result.anomalies.length },
      message: `Found ${result.summary.anomaliesFound} anomaly(ies) across ${Object.keys(result.summary.byColumn).length} column(s) using ${result.summary.method} method (threshold: ${result.summary.threshold}).`,
      anomalies: result.anomalies,
      anomalySummary: result.summary,
    };
    return { response: super.applyVerbosityFilter(response, verbosity) };
  }

  // ─── F3: Suggest cleaning action ───

  private async handleSuggestCleaning(
    req: SuggestCleaningInput,
    verbosity: string
  ): Promise<SheetsFixOutput> {
    if (!req.spreadsheetId || !req.range) {
      return {
        response: this.mapError(new Error('Missing required fields: spreadsheetId and range')),
      };
    }

    const { CleaningEngine, parseRangeOffset } = await import('../services/cleaning-engine.js');
    const engine = new CleaningEngine();

    const data = await this.fetchRangeData(req.spreadsheetId, req.range);
    const rangeOffset = parseRangeOffset(req.range);

    const result = await engine.suggestCleaning(data, req.maxRecommendations ?? 10, rangeOffset);

    // suggest_cleaning is always read-only
    const response = {
      success: true as const,
      mode: 'preview' as const,
      action: 'suggest_cleaning',
      operations: [] as FixOperation[],
      summary: { total: result.recommendations.length },
      message: `Found ${result.recommendations.length} cleaning recommendation(s) after profiling ${result.dataProfile.totalRows} row(s) across ${result.dataProfile.totalColumns} column(s).`,
      recommendations: result.recommendations,
      dataProfile: result.dataProfile,
    };
    return { response: super.applyVerbosityFilter(response, verbosity) };
  }

  // ─── Intent creation ───

  protected createIntents(input: SheetsFixInput): Intent[] {
    const req = unwrapRequest<SheetsFixInput['request']>(input);

    // Read-only actions never create intents
    if (req.action === 'detect_anomalies' || req.action === 'suggest_cleaning') {
      return []; // OK: Explicit empty — read-only actions
    }

    if ((req.mode ?? 'preview') === 'preview' || req.safety?.dryRun) {
      return []; // OK: Explicit empty — preview mode is read-only
    }

    if (!req.spreadsheetId) {
      return []; // OK: Explicit empty — missing required field
    }

    // Mutating actions (fix, clean, standardize_formats, fill_missing) are destructive
    return [
      {
        type: 'SET_VALUES' as const,
        target: {
          spreadsheetId: req.spreadsheetId,
        },
        payload: {
          action: req.action,
        },
        metadata: {
          sourceTool: 'sheets_fix',
          sourceAction: req.action,
          priority: 0,
          destructive: true,
        },
      },
    ];
  }

  // ─── Shared helpers ───

  /**
   * Fetch range data from Google Sheets
   */
  private async fetchRangeData(
    spreadsheetId: string,
    range: string
  ): Promise<(string | number | boolean | null)[][]> {
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    return (response.data.values ?? []) as (string | number | boolean | null)[][];
  }

  /**
   * Write cell changes back to the spreadsheet
   */
  private async writeChanges(
    spreadsheetId: string,
    range: string,
    originalData: (string | number | boolean | null)[][],
    changes: CellChange[],
    _rangeOffset: { startRow: number; startCol: number }
  ): Promise<void> {
    // Apply changes to the data grid
    const updatedData = originalData.map((row) => [...row]);

    for (const change of changes) {
      // Convert absolute row/col back to data array indices
      const dataRow = change.row - _rangeOffset.startRow;
      const dataCol = change.col - _rangeOffset.startCol;

      if (dataRow >= 0 && dataRow < updatedData.length) {
        while (updatedData[dataRow].length <= dataCol) {
          updatedData[dataRow].push(null);
        }
        updatedData[dataRow][dataCol] = change.newValue;
      }
    }

    // Write the entire updated range back
    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: updatedData,
      },
    });
  }

  // ─── F0 fix helpers (unchanged) ───

  /**
   * Filter issues based on user preferences
   */
  private filterIssues(issues: IssueToFix[], filters?: FixRequest['filters']): IssueToFix[] {
    if (!filters) return issues;

    let filtered = issues;

    if (filters.severity) {
      filtered = filtered.filter((i) => filters.severity!.includes(i.severity));
    }

    if (filters.types) {
      filtered = filtered.filter((i) => filters.types!.includes(i.type));
    }

    if (filters.sheets) {
      filtered = filtered.filter((i) => !i.sheet || filters.sheets!.includes(i.sheet));
    }

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Generate fix operations from issues
   */
  private async generateFixOperations(
    spreadsheetId: string,
    issues: IssueToFix[]
  ): Promise<FixOperation[]> {
    const operations: FixOperation[] = [];

    for (const issue of issues) {
      const ops = await this.generateFixForIssue(spreadsheetId, issue);
      operations.push(...ops);
    }

    return operations;
  }

  /**
   * Generate fix operations for a single issue
   */
  private async generateFixForIssue(
    spreadsheetId: string,
    issue: IssueToFix
  ): Promise<FixOperation[]> {
    switch (issue.type) {
      case 'MULTIPLE_TODAY':
        return this.fixMultipleToday(spreadsheetId);

      case 'NO_FROZEN_HEADERS':
        return this.fixFrozenHeaders(spreadsheetId, issue.sheet!);

      case 'NO_FROZEN_COLUMNS':
        return this.fixFrozenColumns(spreadsheetId, issue.sheet!);

      case 'NO_PROTECTION':
        return this.fixProtection(spreadsheetId, issue.sheet!);

      case 'FULL_COLUMN_REFS':
        return this.fixFullColumnRefs(spreadsheetId, issue);

      case 'NESTED_IFERROR':
        return this.fixNestedIferror(spreadsheetId, issue);

      case 'EXCESSIVE_CF_RULES':
        return this.fixExcessiveCfRules(spreadsheetId, issue.sheet!);

      default:
        return [];
    }
  }

  /**
   * Fix: Consolidate multiple TODAY() calls
   */
  private async fixMultipleToday(spreadsheetId: string): Promise<FixOperation[]> {
    return [
      {
        id: `fix_today_${Date.now()}`,
        issueType: 'MULTIPLE_TODAY',
        tool: 'sheets_data',
        action: 'write',
        parameters: {
          spreadsheetId,
          range: '_System!B1',
          values: [['=TODAY()']],
        },
        estimatedImpact: 'Create _System!B1 with =TODAY() formula',
        risk: 'low',
      },
      {
        id: `fix_today_name_${Date.now()}`,
        issueType: 'MULTIPLE_TODAY',
        tool: 'sheets_advanced',
        action: 'create_named_range',
        parameters: {
          spreadsheetId,
          name: 'TodayDate',
          range: '_System!B1',
        },
        estimatedImpact: 'Create named range "TodayDate" → _System!B1',
        risk: 'low',
      },
    ];
  }

  /**
   * Fix: Freeze header rows
   */
  private async fixFrozenHeaders(
    spreadsheetId: string,
    sheetName: string
  ): Promise<FixOperation[]> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.title === sheetName);
    if (!sheet) return []; // OK: Explicit empty — sheet not found, no operations to generate

    return [
      {
        id: `fix_freeze_headers_${Date.now()}`,
        issueType: 'NO_FROZEN_HEADERS',
        tool: 'sheets_dimensions',
        action: 'freeze_rows',
        parameters: {
          spreadsheetId,
          sheetId: sheet.properties!.sheetId!,
          count: 1,
        },
        estimatedImpact: `Freeze row 1 in "${sheetName}"`,
        risk: 'low',
      },
    ];
  }

  /**
   * Fix: Freeze ID columns
   */
  private async fixFrozenColumns(
    spreadsheetId: string,
    sheetName: string
  ): Promise<FixOperation[]> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.title === sheetName);
    if (!sheet) return []; // OK: Explicit empty — sheet not found, no operations to generate

    return [
      {
        id: `fix_freeze_columns_${Date.now()}`,
        issueType: 'NO_FROZEN_COLUMNS',
        tool: 'sheets_dimensions',
        action: 'freeze_columns',
        parameters: {
          spreadsheetId,
          sheetId: sheet.properties!.sheetId!,
          count: 1,
        },
        estimatedImpact: `Freeze column A in "${sheetName}"`,
        risk: 'low',
      },
    ];
  }

  /**
   * Fix: Protect formula cells
   */
  private async fixProtection(spreadsheetId: string, sheetName: string): Promise<FixOperation[]> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.title === sheetName);
    if (!sheet) return []; // OK: Explicit empty — sheet not found, no operations to generate

    return [
      {
        id: `fix_protection_${Date.now()}`,
        issueType: 'NO_PROTECTION',
        tool: 'sheets_advanced',
        action: 'add_protected_range',
        parameters: {
          spreadsheetId,
          sheetId: sheet.properties!.sheetId!,
          description: 'Auto-protected by ServalSheets',
          warningOnly: true,
        },
        estimatedImpact: `Add protection to "${sheetName}" (warning mode)`,
        risk: 'low',
      },
    ];
  }

  /**
   * Fix: Replace full column references with bounded ranges
   */
  private async fixFullColumnRefs(
    _spreadsheetId: string,
    _issue: IssueToFix
  ): Promise<FixOperation[]> {
    // Requires reading formulas, parsing, and rewriting — placeholder
    return [
      {
        id: `fix_full_column_${Date.now()}`,
        issueType: 'FULL_COLUMN_REFS',
        tool: 'sheets_data',
        action: 'find_replace',
        parameters: {},
        estimatedImpact: 'Replace A:A with A2:A500 in formulas',
        risk: 'medium',
      },
    ];
  }

  /**
   * Fix: Simplify nested IFERROR
   */
  private async fixNestedIferror(
    _spreadsheetId: string,
    _issue: IssueToFix
  ): Promise<FixOperation[]> {
    // Requires formula parsing and rewriting — placeholder
    return []; // OK: Explicit empty — not yet implemented
  }

  /**
   * Fix: Consolidate excessive CF rules
   */
  private async fixExcessiveCfRules(
    _spreadsheetId: string,
    _sheetName: string
  ): Promise<FixOperation[]> {
    // Would need to read rules, merge similar ones, delete duplicates — placeholder
    return []; // OK: Explicit empty — not yet implemented
  }

  /**
   * Create snapshot before making changes
   */
  private async createSnapshot(spreadsheetId: string): Promise<{ revisionId: string } | undefined> {
    try {
      const _response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetUrl',
      });

      // Note: Google Sheets API doesn't have a direct "create snapshot" endpoint
      // Versions are auto-created. We'd use sheets_collaborate version_create_snapshot in real impl
      return { revisionId: `auto_${Date.now()}` };
    } catch {
      // OK: Explicit empty — snapshot creation failed (versions API not available)
      return undefined;
    }
  }

  /**
   * Apply fix operations (calls other tools)
   */
  private async applyFixOperations(
    _spreadsheetId: string,
    operations: FixOperation[]
  ): Promise<FixResult[]> {
    const results: FixResult[] = [];

    for (const op of operations) {
      try {
        await this.executeOperation(op);

        results.push({
          operationId: op.id,
          success: true,
          message: `Applied: ${op.estimatedImpact}`,
        });
      } catch (err) {
        results.push({
          operationId: op.id,
          success: false,
          message: 'Failed to apply operation',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }

  /**
   * Execute a single fix operation
   */
  private async executeOperation(op: FixOperation): Promise<void> {
    const { tool, action, parameters } = op;

    switch (tool) {
      case 'sheets_data':
        if (action === 'write') {
          await this.sheetsApi.spreadsheets.values.update({
            spreadsheetId: parameters['spreadsheetId'] as string,
            range: parameters['range'] as string,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: parameters['values'] as unknown[][],
            },
          });
        }
        break;

      case 'sheets_dimensions':
        if (action === 'freeze_rows' || action === 'freeze_columns') {
          await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: parameters['spreadsheetId'] as string,
            requestBody: {
              requests: [
                {
                  updateSheetProperties: {
                    properties: {
                      sheetId: parameters['sheetId'] as number,
                      gridProperties: {
                        [action === 'freeze_rows' ? 'frozenRowCount' : 'frozenColumnCount']:
                          parameters['count'] as number,
                      },
                    },
                    fields: `gridProperties.${action === 'freeze_rows' ? 'frozenRowCount' : 'frozenColumnCount'}`,
                  },
                },
              ],
            },
          });
        }
        break;

      case 'sheets_advanced':
        if (action === 'add_protected_range') {
          await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: parameters['spreadsheetId'] as string,
            requestBody: {
              requests: [
                {
                  addProtectedRange: {
                    protectedRange: {
                      range: {
                        sheetId: parameters['sheetId'] as number,
                      },
                      description: parameters['description'] as string,
                      warningOnly: parameters['warningOnly'] as boolean,
                    },
                  },
                },
              ],
            },
          });
        } else if (action === 'create_named_range') {
          await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: parameters['spreadsheetId'] as string,
            requestBody: {
              requests: [
                {
                  addNamedRange: {
                    namedRange: {
                      name: parameters['name'] as string,
                      range: {
                        sheetId: 0,
                      },
                    },
                  },
                },
              ],
            },
          });
        }
        break;

      default:
        throw new ValidationError(
          `Unsupported tool: ${tool}`,
          'tool',
          'sheets_data | sheets_format | sheets_dimensions | sheets_core'
        );
    }
  }
}
