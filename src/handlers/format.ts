/**
 * ServalSheets - Format Handler
 *
 * Handles sheets_format tool (formatting operations, sparklines, and rules)
 * MCP Protocol: 2025-11-25
 *
 * 22 Actions:
 * Format (10): set_format, suggest_format, set_background, set_text_format, set_number_format,
 *              set_alignment, set_borders, clear_format, apply_preset, auto_fit
 * Batch (1): batch_format
 * Sparklines (3): sparkline_add, sparkline_get, sparkline_clear
 * Rules (8): rule_add_conditional_format, rule_update_conditional_format, rule_delete_conditional_format,
 *            rule_list_conditional_formats, rule_add_data_validation, rule_clear_data_validation,
 *            rule_list_data_validations, rule_add_preset_rule
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsFormatInput,
  SheetsFormatOutput,
  FormatResponse,
  FormatRequest,
} from '../schemas/index.js';
import {
  buildGridRangeInput,
  parseA1Notation,
  toGridRange,
  estimateCellCount,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createValidationError } from '../utils/error-factory.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
import { RangeResolutionError } from '../core/range-resolver.js';
import { checkSamplingSupport } from '../mcp/sampling.js';

// Valid condition types from schema
type ConditionType =
  | 'NUMBER_GREATER'
  | 'NUMBER_GREATER_THAN_EQ'
  | 'NUMBER_LESS'
  | 'NUMBER_LESS_THAN_EQ'
  | 'NUMBER_EQ'
  | 'NUMBER_NOT_EQ'
  | 'NUMBER_BETWEEN'
  | 'NUMBER_NOT_BETWEEN'
  | 'TEXT_CONTAINS'
  | 'TEXT_NOT_CONTAINS'
  | 'TEXT_STARTS_WITH'
  | 'TEXT_ENDS_WITH'
  | 'TEXT_EQ'
  | 'TEXT_IS_EMAIL'
  | 'TEXT_IS_URL'
  | 'DATE_EQ'
  | 'DATE_BEFORE'
  | 'DATE_AFTER'
  | 'DATE_ON_OR_BEFORE'
  | 'DATE_ON_OR_AFTER'
  | 'DATE_BETWEEN'
  | 'DATE_NOT_BETWEEN'
  | 'DATE_IS_VALID'
  | 'ONE_OF_RANGE'
  | 'ONE_OF_LIST'
  | 'BLANK'
  | 'NOT_BLANK'
  | 'CUSTOM_FORMULA'
  | 'BOOLEAN';

// Fix 1.4: Format operation batching queue
interface QueuedFormatOperation {
  request: FormatRequest;
  timestamp: number;
  resolve: (value: FormatResponse) => void;
  reject: (error: unknown) => void;
}

export class FormatHandler extends BaseHandler<SheetsFormatInput, SheetsFormatOutput> {
  private sheetsApi: sheets_v4.Sheets;
  // Fix 1.4: Track format operations for auto-consolidation
  private formatQueue = new Map<string, QueuedFormatOperation[]>();
  private flushTimers = new Map<string, NodeJS.Timeout>();
  // Fix 6: Track sequential individual format calls to suggest batch_format
  private recentFormatCallCount = 0;
  private lastFormatCallTime = 0;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_format', context);
    this.sheetsApi = sheetsApi;
  }

  /**
   * Fix 1.4: Check if format operation should be batched
   * Queues sequential format operations on the same sheet within 500ms window
   */
  private shouldBatchFormat(request: FormatRequest): boolean {
    const batchableActions = [
      'set_number_format',
      'set_background',
      'set_text_format',
      'set_borders',
      'set_alignment',
    ];
    return batchableActions.includes(request.action);
  }

  /**
   * Fix 1.4: Get batching key for grouping operations
   */
  private getBatchKey(request: FormatRequest): string | null {
    if (!('spreadsheetId' in request) || !('sheetId' in request)) {
      return null;
    }
    return `${request.spreadsheetId}:${request.sheetId}`;
  }

  /**
   * Fix 1.4 COMPLETION: Merge multiple format operations into one set_format call
   */
  private mergeFormatOperations(operations: FormatRequest[]): FormatRequest {
    if (operations.length === 0) {
      throw createValidationError({
        field: 'operations',
        value: [],
        reason: 'Cannot merge empty operations array',
      });
    }

    // Start with the first operation as base
    const base = operations[0]!;
    const merged: Partial<FormatRequest> & { format: Record<string, unknown> } = {
      action: 'set_format',
      spreadsheetId: base.spreadsheetId,
      range: 'range' in base ? base.range : undefined,
      format: {},
    };

    // Merge format properties from all operations
    for (const op of operations) {
      switch (op.action) {
        case 'set_background':
          if (
            'backgroundColor' in op &&
            op.backgroundColor &&
            typeof op.backgroundColor === 'object' &&
            'red' in op.backgroundColor &&
            'green' in op.backgroundColor &&
            'blue' in op.backgroundColor &&
            'alpha' in op.backgroundColor
          ) {
            merged.format.backgroundColor = op.backgroundColor as {
              red: number;
              green: number;
              blue: number;
              alpha: number;
            };
          }
          break;
        case 'set_text_format':
          if ('textFormat' in op && op.textFormat) {
            merged.format.textFormat = {
              ...merged.format.textFormat,
              ...op.textFormat,
            };
          }
          break;
        case 'set_number_format':
          if ('numberFormat' in op && op.numberFormat) {
            merged.format.numberFormat = op.numberFormat;
          }
          break;
        case 'set_borders':
          if ('borders' in op && op.borders) {
            merged.format.borders = {
              ...merged.format.borders,
              ...op.borders,
            };
          }
          break;
        case 'set_alignment':
          if (
            'horizontalAlignment' in op &&
            (op.horizontalAlignment === 'LEFT' ||
              op.horizontalAlignment === 'CENTER' ||
              op.horizontalAlignment === 'RIGHT')
          ) {
            merged.format.horizontalAlignment = op.horizontalAlignment;
          }
          if (
            'verticalAlignment' in op &&
            (op.verticalAlignment === 'TOP' ||
              op.verticalAlignment === 'MIDDLE' ||
              op.verticalAlignment === 'BOTTOM')
          ) {
            merged.format.verticalAlignment = op.verticalAlignment;
          }
          if (
            'wrapStrategy' in op &&
            (op.wrapStrategy === 'OVERFLOW_CELL' ||
              op.wrapStrategy === 'LEGACY_WRAP' ||
              op.wrapStrategy === 'CLIP' ||
              op.wrapStrategy === 'WRAP')
          ) {
            merged.format.wrapStrategy = op.wrapStrategy;
          }
          break;
        case 'set_format':
          // Already a consolidated format - merge its format object
          if ('format' in op && op.format) {
            merged.format = {
              ...merged.format,
              ...op.format,
            };
          }
          break;
      }
    }

    return merged as FormatRequest;
  }

  /**
   * Detect adjacent ranges that could be merged (audit optimization: 90 instances)
   * Logs warnings for ranges like D2:D30 + E2:E30 that could be D2:E30
   */
  private detectAdjacentRanges(ranges: string[]): void {
    const logger = this.context.logger;
    if (!logger || ranges.length < 2) return;

    // Simple adjacent column detection (e.g., D2:D30 + E2:E30)
    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        const range1 = ranges[i]!;
        const range2 = ranges[j]!;

        try {
          const parsed1 = parseA1Notation(range1);
          const parsed2 = parseA1Notation(range2);

          // Check if ranges are on same sheet and have same row span
          if (
            parsed1.sheetName === parsed2.sheetName &&
            parsed1.startRow === parsed2.startRow &&
            parsed1.endRow === parsed2.endRow
          ) {
            // Check if columns are adjacent
            if (parsed1.endCol + 1 === parsed2.startCol) {
              const mergedRange = `${parsed1.sheetName}!${this.columnToLetter(parsed1.startCol)}${parsed1.startRow}:${this.columnToLetter(parsed2.endCol)}${parsed2.endRow}`;
              logger.info('Adjacent ranges detected - could be merged', {
                range1,
                range2,
                mergedRange,
                apiCallSavings: 1,
              });
            }
          }
        } catch {
          // Ignore parsing errors
        }
      }
    }
  }

  /**
   * Helper: Convert column index to letter (0=A, 25=Z, 26=AA)
   */
  protected columnToLetter(col: number): string {
    let letter = '';
    while (col >= 0) {
      letter = String.fromCharCode((col % 26) + 65) + letter;
      col = Math.floor(col / 26) - 1;
    }
    return letter;
  }

  /**
   * Fix 1.4: Flush queued format operations as a consolidated batch
   */
  private async flushFormatQueue(key: string): Promise<void> {
    const operations = this.formatQueue.get(key);
    if (!operations || operations.length === 0) {
      return;
    }

    this.formatQueue.delete(key);
    const timer = this.flushTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(key);
    }

    const logger = this.context.logger;
    logger?.info(`Auto-consolidating ${operations.length} format operations`, { key });

    // Fix 1.4 COMPLETION: Actually consolidate operations instead of executing sequentially
    // Group operations by range to merge format properties
    const rangeGroups = new Map<string, QueuedFormatOperation[]>();

    for (const op of operations) {
      const range =
        'range' in op.request && op.request.range ? String(op.request.range) : 'default';
      const group = rangeGroups.get(range) || [];
      group.push(op);
      rangeGroups.set(range, group);
    }

    // Check for adjacent ranges that could be merged (audit optimization: 90 instances)
    this.detectAdjacentRanges(Array.from(rangeGroups.keys()));

    // Process each range group
    for (const [range, group] of rangeGroups.entries()) {
      try {
        if (group.length === 1) {
          // Single operation - execute directly
          const result = await this.executeFormatOperationDirect(group[0]!.request);
          group[0]!.resolve(result);
        } else {
          // Multiple operations on same range - consolidate into set_format
          const merged = this.mergeFormatOperations(group.map((g) => g.request));
          const result = await this.executeFormatOperationDirect(merged);

          // Resolve all operations with the consolidated result
          for (const op of group) {
            op.resolve(result);
          }

          logger?.info(`Consolidated ${group.length} operations into 1 set_format call`, {
            range,
            actions: group.map((g) => g.request.action),
            savingsPercent: Math.round((1 - 1 / group.length) * 100),
          });
        }
      } catch (error) {
        // Reject all operations in this group
        for (const op of group) {
          op.reject(error);
        }
      }
    }
  }

  /**
   * Handle format operations with verbosity-aware metadata generation
   */
  async handle(input: SheetsFormatInput): Promise<SheetsFormatOutput> {
    // Extract the request from the wrapper
    const req = unwrapRequest<SheetsFormatInput['request']>(input);

    // Require authentication before proceeding
    this.requireAuth();

    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredReq = this.inferRequestParameters(req) as FormatRequest;

    // Set verbosity early to skip metadata generation for minimal mode (saves ~400-800 tokens)
    const verbosity = inferredReq.verbosity ?? 'standard';
    this.setVerbosity(verbosity);

    try {
      const response = await this.executeAction(inferredReq);

      // Track context on success
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: inferredReq.spreadsheetId,
          sheetId:
            'sheetId' in inferredReq
              ? typeof inferredReq.sheetId === 'number'
                ? inferredReq.sheetId
                : undefined
              : undefined,
          range:
            'range' in inferredReq
              ? typeof inferredReq.range === 'string'
                ? inferredReq.range
                : undefined
              : undefined,
        });
      }

      // Fix 6: Track individual format calls and suggest batch_format when pattern detected
      const individualFormatActions = [
        'set_format',
        'set_background',
        'set_text_format',
        'set_number_format',
        'set_alignment',
        'set_borders',
        'apply_preset',
      ];
      const now = Date.now();
      if (individualFormatActions.includes(inferredReq.action) && response.success) {
        // Reset counter if >30s since last call (new formatting session)
        if (now - this.lastFormatCallTime > 30000) {
          this.recentFormatCallCount = 0;
        }
        this.recentFormatCallCount++;
        this.lastFormatCallTime = now;

        // Add hint after 3+ sequential individual format calls
        if (this.recentFormatCallCount >= 3) {
          const saved = this.recentFormatCallCount - 1;
          (response as Record<string, unknown>)['_hint'] =
            `You've made ${this.recentFormatCallCount} separate format calls. Use batch_format to combine them — saves ~${Math.round((saved / this.recentFormatCallCount) * 100)}% API calls.`;
        }
      } else if (inferredReq.action === 'batch_format') {
        // Reset counter when batch_format is used (LLM learned!)
        this.recentFormatCallCount = 0;
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = inferredReq.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsFormatInput): Intent[] {
    const req = unwrapRequest<SheetsFormatInput['request']>(input);
    const destructiveActions = [
      'clear_format',
      'rule_update_conditional_format',
      'rule_delete_conditional_format',
      'clear_data_validation',
    ];

    const isRuleAction = req.action.startsWith('rule_');

    if ('spreadsheetId' in req) {
      return [
        {
          type: isRuleAction ? 'UPDATE_CONDITIONAL_FORMAT' : 'UPDATE_CELLS',
          target: { spreadsheetId: req.spreadsheetId },
          payload: {},
          metadata: {
            sourceTool: this.toolName,
            sourceAction: req.action,
            priority: 1,
            destructive: destructiveActions.includes(req.action),
          },
        },
      ];
    }
    return [];
  }

  /**
   * Execute action and return response (extracted for task/non-task paths)
   */
  private async executeAction(request: FormatRequest): Promise<FormatResponse> {
    // Fix 1.4: Intercept batchable format operations for auto-consolidation
    if (this.shouldBatchFormat(request)) {
      const batchKey = this.getBatchKey(request);
      if (batchKey) {
        return new Promise<FormatResponse>((resolve, reject) => {
          // Add operation to queue
          const operations = this.formatQueue.get(batchKey) || [];
          operations.push({
            request,
            timestamp: Date.now(),
            resolve,
            reject,
          });
          this.formatQueue.set(batchKey, operations);

          // Set or reset flush timer (500ms consolidation window)
          const existingTimer = this.flushTimers.get(batchKey);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const timer = setTimeout(() => {
            void this.flushFormatQueue(batchKey);
          }, 500);
          this.flushTimers.set(batchKey, timer);

          // Log queuing for visibility
          this.context.logger?.info('Format operation queued for consolidation', {
            action: request.action,
            batchKey,
            queueSize: operations.length,
          });
        });
      }
    }

    // Non-batchable or batching not applicable - execute directly
    return this.executeFormatOperationDirect(request);
  }

  /**
   * Fix 1.4: Execute format operation directly (bypasses batching)
   */
  private async executeFormatOperationDirect(request: FormatRequest): Promise<FormatResponse> {
    switch (request.action) {
      case 'set_format':
        return await this.handleSetFormat(request as FormatRequest & { action: 'set_format' });
      case 'suggest_format':
        return await this.handleSuggestFormat(
          request as FormatRequest & { action: 'suggest_format' }
        );
      case 'set_background':
        return await this.handleSetBackground(
          request as FormatRequest & { action: 'set_background' }
        );
      case 'set_text_format':
        return await this.handleSetTextFormat(
          request as FormatRequest & { action: 'set_text_format' }
        );
      case 'set_number_format':
        return await this.handleSetNumberFormat(
          request as FormatRequest & { action: 'set_number_format' }
        );
      case 'set_alignment':
        return await this.handleSetAlignment(
          request as FormatRequest & { action: 'set_alignment' }
        );
      case 'set_borders':
        return await this.handleSetBorders(request as FormatRequest & { action: 'set_borders' });
      case 'clear_format':
        return await this.handleClearFormat(request as FormatRequest & { action: 'clear_format' });
      case 'apply_preset':
        return await this.handleApplyPreset(request as FormatRequest & { action: 'apply_preset' });
      case 'auto_fit':
        return await this.handleAutoFit(request as FormatRequest & { action: 'auto_fit' });
      case 'batch_format':
        return await this.handleBatchFormat(request as FormatRequest & { action: 'batch_format' });
      case 'rule_add_conditional_format':
        return await this.handleRuleAddConditionalFormat(
          request as FormatRequest & { action: 'rule_add_conditional_format' }
        );
      case 'rule_update_conditional_format':
        return await this.handleRuleUpdateConditionalFormat(
          request as FormatRequest & { action: 'rule_update_conditional_format' }
        );
      case 'rule_delete_conditional_format':
        return await this.handleRuleDeleteConditionalFormat(
          request as FormatRequest & { action: 'rule_delete_conditional_format' }
        );
      case 'rule_list_conditional_formats':
        return await this.handleRuleListConditionalFormats(
          request as FormatRequest & { action: 'rule_list_conditional_formats' }
        );
      case 'set_data_validation':
        return await this.handleSetDataValidation(
          request as FormatRequest & { action: 'set_data_validation' }
        );
      case 'clear_data_validation':
        return await this.handleClearDataValidation(
          request as FormatRequest & { action: 'clear_data_validation' }
        );
      case 'list_data_validations':
        return await this.handleListDataValidations(
          request as FormatRequest & { action: 'list_data_validations' }
        );
      case 'add_conditional_format_rule':
        return await this.handleAddConditionalFormatRule(
          request as FormatRequest & { action: 'add_conditional_format_rule' }
        );
      case 'generate_conditional_format':
        return await this.handleGenerateConditionalFormat(
          request as FormatRequest & { action: 'generate_conditional_format' }
        );
      case 'sparkline_add':
        return await this.handleSparklineAdd(
          request as FormatRequest & { action: 'sparkline_add' }
        );
      case 'sparkline_get':
        return await this.handleSparklineGet(
          request as FormatRequest & { action: 'sparkline_get' }
        );
      case 'sparkline_clear':
        return await this.handleSparklineClear(
          request as FormatRequest & { action: 'sparkline_clear' }
        );
      case 'set_rich_text':
        return await this.handleSetRichText(request as FormatRequest & { action: 'set_rich_text' });
      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown action: ${(request as { action: string }).action}`,
          retryable: false,
          suggestedFix:
            'Check the parameter format and ensure all required parameters are provided',
        });
    }
  }

  // ============================================================
  // Format Actions
  // ============================================================

  private async handleSetFormat(
    input: FormatRequest & { action: 'set_format' }
  ): Promise<FormatResponse> {
    if (input.safety?.dryRun) {
      return this.success('set_format', { cellsFormatted: 0 }, undefined, true);
    }

    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const format = input.format!;

    const cellFormat: sheets_v4.Schema$CellFormat = {};
    const fields: string[] = [];

    if (format.backgroundColor) {
      cellFormat.backgroundColor = format.backgroundColor;
      fields.push('backgroundColor');
    }
    if (format.textFormat) {
      cellFormat.textFormat = format.textFormat;
      fields.push('textFormat');
    }
    if (format.horizontalAlignment) {
      cellFormat.horizontalAlignment = format.horizontalAlignment;
      fields.push('horizontalAlignment');
    }
    if (format.verticalAlignment) {
      cellFormat.verticalAlignment = format.verticalAlignment;
      fields.push('verticalAlignment');
    }
    if (format.wrapStrategy) {
      cellFormat.wrapStrategy = format.wrapStrategy;
      fields.push('wrapStrategy');
    }
    if (format.numberFormat) {
      cellFormat.numberFormat = format.numberFormat;
      fields.push('numberFormat');
    }
    if (format.borders) {
      cellFormat.borders = format.borders;
      fields.push('borders');
    }

    const googleRange = toGridRange(gridRange);
    // Use precise field mask when specific fields identified, wildcard otherwise
    const fieldMask =
      fields.length > 0 ? `userEnteredFormat(${fields.join(',')})` : 'userEnteredFormat';
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: { userEnteredFormat: cellFormat },
              fields: fieldMask,
            },
          },
        ],
      },
    });

    return this.success('set_format', {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSuggestFormat(
    input: FormatRequest & { action: 'suggest_format' }
  ): Promise<FormatResponse> {
    // Check if server exists and client supports sampling
    const samplingSupport = this.context.server
      ? checkSamplingSupport(this.context.server.getClientCapabilities?.())
      : { supported: false };

    if (!this.context.server || !samplingSupport.supported) {
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message:
          'Format suggestions require MCP Sampling capability (SEP-1577). Client does not support sampling.',
        retryable: false,
        suggestedFix:
          'Enable the feature by setting the appropriate environment variable, or contact your administrator',
      });
    }

    const server = this.context.server;
    const startTime = Date.now();

    try {
      // Convert range to A1 notation string
      const rangeStr =
        typeof input.range === 'string'
          ? input.range
          : input.range && 'a1' in input.range
            ? input.range.a1
            : 'A1';

      // Fetch data and current formatting from the specified range
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        ranges: [rangeStr],
        includeGridData: true,
        fields: 'sheets.data.rowData.values(formattedValue,effectiveValue,effectiveFormat)',
      });

      const sheet = response.data.sheets?.[0];
      const gridData = sheet?.data?.[0];
      if (!gridData || !gridData.rowData || gridData.rowData.length === 0) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'Range contains no data',
          retryable: false,
          suggestedFix:
            'Check the parameter format and ensure all required parameters are provided',
        });
      }

      // Extract sample data and current formats
      const sampleRows = gridData.rowData.slice(0, 10);
      const sampleData = sampleRows.map(
        (row) => row.values?.map((cell) => cell.formattedValue || cell.effectiveValue) || []
      );

      const currentFormats = sampleRows.slice(0, 3).map(
        (row) =>
          row.values?.map((cell) => ({
            backgroundColor: cell.effectiveFormat?.backgroundColor,
            textFormat: cell.effectiveFormat?.textFormat,
            numberFormat: cell.effectiveFormat?.numberFormat,
          })) || []
      );

      const prompt = `Analyze this spreadsheet data and suggest the ${input.maxSuggestions || 3} best formatting options to improve readability and visual hierarchy.

**Data range:** ${rangeStr}
**Row count:** ${gridData.rowData.length}
**Column count:** ${gridData.rowData[0]?.values?.length || 0}

**Sample data (first 10 rows):**
\`\`\`json
${JSON.stringify(sampleData, null, 2)}
\`\`\`

**Current formatting (first 3 rows):**
\`\`\`json
${JSON.stringify(currentFormats, null, 2)}
\`\`\`

For each formatting suggestion, provide:
1. A descriptive title
2. Clear explanation of how this improves the presentation
3. Confidence score (0-100)
4. Reasoning for this formatting choice
5. Format options:
   - Background color (RGB object, optional)
   - Text format (bold, italic, fontSize, fontFamily, optional)
   - Number format (type and pattern, optional)
   - Borders (boolean, optional)
   - Alignment (LEFT, CENTER, RIGHT, optional)

Format your response as JSON:
{
  "suggestions": [
    {
      "title": "Header Row Formatting",
      "explanation": "Makes column headers stand out with bold text and colored background",
      "confidence": 95,
      "reasoning": "First row appears to be headers based on text content",
      "formatOptions": {
        "backgroundColor": {"red": 0.85, "green": 0.85, "blue": 0.85},
        "textFormat": {"bold": true, "fontSize": 11},
        "alignment": "CENTER"
      }
    }
  ]
}`;

      const samplingRequest = {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: prompt,
            },
          },
        ],
        systemPrompt: `You are an expert in spreadsheet design and data visualization.
Analyze spreadsheet content and formatting to suggest improvements for readability and visual hierarchy.
Consider data types, patterns, and best practices for professional spreadsheet design.
Always return valid JSON in the exact format requested.`,
        modelPreferences: {
          hints: [{ name: 'claude-3-5-sonnet-20241022' }],
          intelligencePriority: 0.8,
        },
        maxTokens: 2048,
      };

      const samplingResult = await server.createMessage(samplingRequest);
      const duration = Date.now() - startTime;

      // Extract JSON from response
      const contentArray = Array.isArray(samplingResult.content)
        ? samplingResult.content
        : [samplingResult.content];
      const textContent = contentArray.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return this.error({
          code: 'INTERNAL_ERROR',
          message: 'No text content in sampling response',
          retryable: true,
          suggestedFix: 'Please try again. If the issue persists, contact support',
        });
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.error({
          code: 'INTERNAL_ERROR',
          message: 'Could not parse format suggestions from AI response',
          retryable: true,
          suggestedFix: 'Please try again. If the issue persists, contact support',
        });
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return this.success('suggest_format', {
        suggestions: parsed.suggestions || [],
        _meta: {
          duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      return this.error({
        code: 'INTERNAL_ERROR',
        message: `Format suggestion failed: ${error instanceof Error ? error.message : String(error)}`,
        retryable: true,
        suggestedFix: 'Please try again. If the issue persists, contact support',
      });
    }
  }

  private async handleSetBackground(
    input: FormatRequest & { action: 'set_background' }
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: {
                userEnteredFormat: {
                  backgroundColor: input.color!,
                },
              },
              fields: 'userEnteredFormat.backgroundColor',
            },
          },
        ],
      },
    });

    return this.success('set_background', {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetTextFormat(
    input: FormatRequest & { action: 'set_text_format' }
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: {
                userEnteredFormat: {
                  textFormat: input.textFormat!,
                },
              },
              fields: 'userEnteredFormat.textFormat',
            },
          },
        ],
      },
    });

    return this.success('set_text_format', {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetNumberFormat(
    input: FormatRequest & { action: 'set_number_format' }
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: {
                userEnteredFormat: {
                  numberFormat: input.numberFormat!,
                },
              },
              fields: 'userEnteredFormat.numberFormat',
            },
          },
        ],
      },
    });

    return this.success('set_number_format', {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetAlignment(
    input: FormatRequest & { action: 'set_alignment' }
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    const cellFormat: sheets_v4.Schema$CellFormat = {};
    const fields: string[] = [];

    if (input.horizontal) {
      cellFormat.horizontalAlignment = input.horizontal;
      fields.push('horizontalAlignment');
    }
    if (input.vertical) {
      cellFormat.verticalAlignment = input.vertical;
      fields.push('verticalAlignment');
    }
    if (input.wrapStrategy) {
      cellFormat.wrapStrategy = input.wrapStrategy;
      fields.push('wrapStrategy');
    }

    if (fields.length === 0) {
      return this.error({
        code: 'INVALID_PARAMS',
        message:
          'No alignment properties specified. You must provide at least one of: horizontal (LEFT, CENTER, RIGHT), vertical (TOP, MIDDLE, BOTTOM), or wrapStrategy (OVERFLOW_CELL, LEGACY_WRAP, CLIP, WRAP)',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
        resolution:
          'Specify at least one alignment property: horizontal, vertical, or wrapStrategy. Example: { horizontal: "CENTER", vertical: "MIDDLE" }',
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: { userEnteredFormat: cellFormat },
              fields: `userEnteredFormat(${fields.join(',')})`,
            },
          },
        ],
      },
    });

    return this.success('set_alignment', {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSetBorders(
    input: FormatRequest & { action: 'set_borders' }
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);

    const updateBordersRequest: sheets_v4.Schema$UpdateBordersRequest = {
      range: googleRange,
      top: input.top,
      bottom: input.bottom,
      left: input.left,
      right: input.right,
      innerHorizontal: input.innerHorizontal,
      innerVertical: input.innerVertical,
    };

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [{ updateBorders: updateBordersRequest }],
      },
    });

    return this.success('set_borders', {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleClearFormat(
    input: FormatRequest & { action: 'clear_format' }
  ): Promise<FormatResponse> {
    // BUG-008 FIX: Large clear_format operations (>100K cells) can timeout
    // Optimization: Use batchUpdate with repeatCell and explicit field mask
    // This minimizes payload and request complexity
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);
    const estimatedCells = estimateCellCount(googleRange);

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.elicitationServer && estimatedCells > 500) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          'Clear Formatting',
          `You are about to clear all formatting from approximately ${estimatedCells.toLocaleString()} cells in range ${rangeA1}.\n\nAll number formats, colors, borders, and text styling will be removed. Cell values will not be affected.`
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: 'PRECONDITION_FAILED',
            message: 'Clear formatting operation cancelled by user',
            retryable: false,
            suggestedFix: 'Review the operation requirements and try again',
          });
        }
      } catch (err) {
        // If elicitation fails, proceed (backward compatibility)
        this.context.logger?.warn(
          'Elicitation failed for clear_format, proceeding with operation',
          { error: err }
        );
      }
    }

    if (input.safety?.dryRun) {
      return this.success('clear_format', { cellsFormatted: 0 }, undefined, true);
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'clear_format',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
        affectedCells: estimatedCells,
      },
      input.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: googleRange,
              cell: { userEnteredFormat: {} },
              fields: 'userEnteredFormat',
            },
          },
        ],
      },
    });

    return this.success('clear_format', {
      cellsFormatted: estimateCellCount(googleRange),
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleApplyPreset(
    input: FormatRequest & { action: 'apply_preset' }
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const googleRange = toGridRange(gridRange);
    const requests: sheets_v4.Schema$Request[] = [];

    switch (input.preset!) {
      case 'header_row':
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        });
        break;

      case 'alternating_rows':
        requests.push({
          addBanding: {
            bandedRange: {
              range: googleRange,
              rowProperties: {
                firstBandColor: { red: 1, green: 1, blue: 1 },
                secondBandColor: { red: 0.95, green: 0.95, blue: 0.95 },
              },
            },
          },
        });
        break;

      case 'total_row':
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                textFormat: { bold: true },
                borders: {
                  top: {
                    style: 'SOLID_MEDIUM',
                    color: { red: 0, green: 0, blue: 0 },
                  },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,borders.top)',
          },
        });
        break;

      case 'currency':
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        });
        break;

      case 'percentage':
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'PERCENT', pattern: '0.00%' },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        });
        break;

      case 'date':
        requests.push({
          repeatCell: {
            range: googleRange,
            cell: {
              userEnteredFormat: {
                numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        });
        break;

      case 'highlight_positive':
        requests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'NUMBER_GREATER',
                  values: [{ userEnteredValue: '0' }],
                },
                format: {
                  backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 },
                },
              },
            },
            index: 0,
          },
        });
        break;

      case 'highlight_negative':
        requests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'NUMBER_LESS',
                  values: [{ userEnteredValue: '0' }],
                },
                format: {
                  backgroundColor: { red: 0.95, green: 0.85, blue: 0.85 },
                },
              },
            },
            index: 0,
          },
        });
        break;
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success('apply_preset', {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleAutoFit(
    input: FormatRequest & { action: 'auto_fit' }
  ): Promise<FormatResponse> {
    let gridRange: GridRangeInput;

    if (input.range) {
      // User provided a range
      const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
      gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    } else if (input.sheetId !== undefined) {
      // User provided sheetId - fit entire sheet
      gridRange = {
        sheetId: input.sheetId,
        startRowIndex: 0,
        endRowIndex: 1000000,
        startColumnIndex: 0,
        endColumnIndex: 26,
      };
    } else {
      throw new RangeResolutionError('Either range or sheetId must be provided');
    }

    const requests: sheets_v4.Schema$Request[] = [];

    const dimension = input.dimension ?? 'BOTH';
    if (dimension === 'ROWS' || dimension === 'BOTH') {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: gridRange.sheetId,
            dimension: 'ROWS',
            startIndex: gridRange.startRowIndex,
            endIndex: gridRange.endRowIndex,
          },
        },
      });
    }

    if (dimension === 'COLUMNS' || dimension === 'BOTH') {
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: gridRange.sheetId,
            dimension: 'COLUMNS',
            startIndex: gridRange.startColumnIndex,
            endIndex: gridRange.endColumnIndex,
          },
        },
      });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success('auto_fit', {});
  }

  // ============================================================
  // Batch Format Action
  // ============================================================

  /**
   * Apply multiple format operations in a single Google Sheets API call.
   * This is the highest-performance way to format a spreadsheet — N operations
   * are merged into 1 batchUpdate call instead of N separate calls.
   *
   * Supported operation types:
   * - background: Set background color
   * - text_format: Set bold/italic/font/color
   * - number_format: Set currency/percentage/date formatting
   * - alignment: Set horizontal/vertical alignment and wrap strategy
   * - borders: Set cell borders
   * - format: Apply a full CellFormat specification
   * - preset: Apply a named preset (header_row, alternating_rows, etc.)
   */
  private async handleBatchFormat(
    input: FormatRequest & { action: 'batch_format' }
  ): Promise<FormatResponse> {
    // Extract operations from the input using bracket notation (TS strict mode)
    const rawInput = input as unknown as Record<string, unknown>;
    const operations = rawInput['operations'] as Array<Record<string, unknown>> | undefined;

    if (!operations || operations.length === 0) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'No operations provided. Supply at least one operation in the operations array.',
        retryable: false,
        suggestedFix: 'Provide operations array with at least one format operation',
      });
    }

    if (input.safety?.dryRun) {
      return this.success(
        'batch_format',
        {
          cellsFormatted: 0,
          operationsApplied: operations.length,
          apiCallsSaved: Math.max(0, operations.length - 1),
        },
        undefined,
        true
      );
    }

    const requests: sheets_v4.Schema$Request[] = [];
    let totalCellsFormatted = 0;
    const skippedOps: string[] = [];

    for (let opIdx = 0; opIdx < operations.length; opIdx++) {
      const op = operations[opIdx]!;
      const opType = op['type'] as string;
      const rawRange = op['range'];
      // Normalize to RangeInput (resolveRange requires object form, not plain string)
      const rangeInput =
        typeof rawRange === 'string' ? { a1: rawRange } : (rawRange as { a1: string });

      // Resolve range for this operation
      const rangeA1 = await this.resolveRange(input.spreadsheetId, rangeInput);
      const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
      const googleRange = toGridRange(gridRange);
      totalCellsFormatted += estimateCellCount(googleRange);

      switch (opType) {
        case 'background': {
          const color = op['color'] as sheets_v4.Schema$Color;
          if (color) {
            requests.push({
              repeatCell: {
                range: googleRange,
                cell: { userEnteredFormat: { backgroundColor: color } },
                fields: 'userEnteredFormat.backgroundColor',
              },
            });
          } else {
            skippedOps.push(
              `Operation ${opIdx}: type 'background' requires 'color' (e.g. {red:1, green:0, blue:0})`
            );
          }
          break;
        }

        case 'text_format': {
          const textFormat = op['textFormat'] as sheets_v4.Schema$TextFormat;
          if (textFormat) {
            requests.push({
              repeatCell: {
                range: googleRange,
                cell: { userEnteredFormat: { textFormat } },
                fields: 'userEnteredFormat.textFormat',
              },
            });
          } else {
            skippedOps.push(
              `Operation ${opIdx}: type 'text_format' requires 'textFormat' (e.g. {bold:true, fontSize:12})`
            );
          }
          break;
        }

        case 'number_format': {
          const numberFormat = op['numberFormat'] as sheets_v4.Schema$NumberFormat;
          if (numberFormat) {
            requests.push({
              repeatCell: {
                range: googleRange,
                cell: { userEnteredFormat: { numberFormat } },
                fields: 'userEnteredFormat.numberFormat',
              },
            });
          } else {
            skippedOps.push(
              `Operation ${opIdx}: type 'number_format' requires 'numberFormat' (e.g. {type:"CURRENCY", pattern:"$#,##0.00"})`
            );
          }
          break;
        }

        case 'alignment': {
          const cellFormat: sheets_v4.Schema$CellFormat = {};
          const fields: string[] = [];
          if (op['horizontal']) {
            cellFormat.horizontalAlignment = op['horizontal'] as string;
            fields.push('horizontalAlignment');
          }
          if (op['vertical']) {
            cellFormat.verticalAlignment = op['vertical'] as string;
            fields.push('verticalAlignment');
          }
          if (op['wrapStrategy']) {
            cellFormat.wrapStrategy = op['wrapStrategy'] as string;
            fields.push('wrapStrategy');
          }
          if (fields.length > 0) {
            requests.push({
              repeatCell: {
                range: googleRange,
                cell: { userEnteredFormat: cellFormat },
                fields: `userEnteredFormat(${fields.join(',')})`,
              },
            });
          } else {
            skippedOps.push(
              `Operation ${opIdx}: type 'alignment' requires at least one of: 'horizontal', 'vertical', 'wrapStrategy'`
            );
          }
          break;
        }

        case 'borders': {
          const updateBordersRequest: sheets_v4.Schema$UpdateBordersRequest = {
            range: googleRange,
          };
          if (op['top']) updateBordersRequest.top = op['top'] as sheets_v4.Schema$Border;
          if (op['bottom']) updateBordersRequest.bottom = op['bottom'] as sheets_v4.Schema$Border;
          if (op['left']) updateBordersRequest.left = op['left'] as sheets_v4.Schema$Border;
          if (op['right']) updateBordersRequest.right = op['right'] as sheets_v4.Schema$Border;
          if (op['innerHorizontal'])
            updateBordersRequest.innerHorizontal = op['innerHorizontal'] as sheets_v4.Schema$Border;
          if (op['innerVertical'])
            updateBordersRequest.innerVertical = op['innerVertical'] as sheets_v4.Schema$Border;
          requests.push({ updateBorders: updateBordersRequest });
          break;
        }

        case 'format': {
          const format = op['format'] as Record<string, unknown>;
          if (format) {
            const cellFormat: sheets_v4.Schema$CellFormat = {};
            const fields: string[] = [];
            if (format['backgroundColor']) {
              cellFormat.backgroundColor = format['backgroundColor'] as sheets_v4.Schema$Color;
              fields.push('backgroundColor');
            }
            if (format['textFormat']) {
              cellFormat.textFormat = format['textFormat'] as sheets_v4.Schema$TextFormat;
              fields.push('textFormat');
            }
            if (format['horizontalAlignment']) {
              cellFormat.horizontalAlignment = format['horizontalAlignment'] as string;
              fields.push('horizontalAlignment');
            }
            if (format['verticalAlignment']) {
              cellFormat.verticalAlignment = format['verticalAlignment'] as string;
              fields.push('verticalAlignment');
            }
            if (format['wrapStrategy']) {
              cellFormat.wrapStrategy = format['wrapStrategy'] as string;
              fields.push('wrapStrategy');
            }
            if (format['numberFormat']) {
              cellFormat.numberFormat = format['numberFormat'] as sheets_v4.Schema$NumberFormat;
              fields.push('numberFormat');
            }
            if (format['borders']) {
              cellFormat.borders = format['borders'] as sheets_v4.Schema$Borders;
              fields.push('borders');
            }
            if (fields.length > 0) {
              requests.push({
                repeatCell: {
                  range: googleRange,
                  cell: { userEnteredFormat: cellFormat },
                  fields: `userEnteredFormat(${fields.join(',')})`,
                },
              });
            }
          }
          break;
        }

        case 'preset': {
          const preset = op['preset'] as string;
          switch (preset) {
            case 'header_row':
              requests.push({
                repeatCell: {
                  range: googleRange,
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
                      textFormat: {
                        bold: true,
                        foregroundColor: { red: 1, green: 1, blue: 1 },
                      },
                      horizontalAlignment: 'CENTER',
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
                },
              });
              break;
            case 'alternating_rows':
              requests.push({
                addBanding: {
                  bandedRange: {
                    range: googleRange,
                    rowProperties: {
                      firstBandColor: { red: 1, green: 1, blue: 1 },
                      secondBandColor: { red: 0.95, green: 0.95, blue: 0.95 },
                    },
                  },
                },
              });
              break;
            case 'total_row':
              requests.push({
                repeatCell: {
                  range: googleRange,
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                      textFormat: { bold: true },
                      borders: {
                        top: {
                          style: 'SOLID_MEDIUM',
                          color: { red: 0, green: 0, blue: 0 },
                        },
                      },
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,borders.top)',
                },
              });
              break;
            case 'currency':
              requests.push({
                repeatCell: {
                  range: googleRange,
                  cell: {
                    userEnteredFormat: {
                      numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' },
                    },
                  },
                  fields: 'userEnteredFormat.numberFormat',
                },
              });
              break;
            case 'percentage':
              requests.push({
                repeatCell: {
                  range: googleRange,
                  cell: {
                    userEnteredFormat: {
                      numberFormat: { type: 'PERCENT', pattern: '0.0%' },
                    },
                  },
                  fields: 'userEnteredFormat.numberFormat',
                },
              });
              break;
            case 'date':
              requests.push({
                repeatCell: {
                  range: googleRange,
                  cell: {
                    userEnteredFormat: {
                      numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' },
                    },
                  },
                  fields: 'userEnteredFormat.numberFormat',
                },
              });
              break;
            case 'highlight_positive':
              requests.push({
                repeatCell: {
                  range: googleRange,
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 },
                    },
                  },
                  fields: 'userEnteredFormat.backgroundColor',
                },
              });
              break;
            case 'highlight_negative':
              requests.push({
                repeatCell: {
                  range: googleRange,
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.95, green: 0.85, blue: 0.85 },
                    },
                  },
                  fields: 'userEnteredFormat.backgroundColor',
                },
              });
              break;
          }
          break;
        }

        default:
          // Skip unknown operation types (logged but not fatal)
          this.context.logger?.warn(`Unknown batch_format operation type: ${opType}`);
      }
    }

    if (requests.length === 0) {
      const diagnostics =
        skippedOps.length > 0
          ? `\n${skippedOps.join('\n')}`
          : '\nEnsure each operation has a valid type and the required parameters for that type.';
      return this.error({
        code: 'INVALID_PARAMS',
        message: `No valid format operations could be built from ${operations.length} operation(s).${diagnostics}`,
        retryable: false,
        suggestedFix:
          'Each operation needs: type (background|text_format|number_format|alignment|borders|format|preset) + type-specific params. Example: {type:"background", range:"A1:B5", color:{red:1,green:0,blue:0}}',
      });
    }

    // Enforce Google API limit: batchUpdate supports max 100 subrequests per call
    if (requests.length > 100) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `batch_format built ${requests.length} API subrequests but Google Sheets API allows max 100 per batchUpdate call.`,
        retryable: false,
        suggestedFix: 'Split into multiple batch_format calls with up to 100 operations each',
        details: { requestCount: requests.length, limit: 100 },
      });
    }

    // Execute ALL format operations in a single API call
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests },
    });

    return this.success('batch_format', {
      cellsFormatted: totalCellsFormatted,
      operationsApplied: requests.length,
      apiCallsSaved: Math.max(0, requests.length - 1),
    });
  }

  // ============================================================
  // Rules Actions (Conditional Formatting)
  // ============================================================

  private async handleRuleAddConditionalFormat(
    input: FormatRequest & { action: 'rule_add_conditional_format' }
  ): Promise<FormatResponse> {
    // Fix QA-2.2: Pass sheetId as-is (may be undefined), resolveGridRange will look it up from range
    const gridRange = await this.resolveGridRange(
      input.spreadsheetId,
      input.sheetId as number,
      input.range!
    );

    // Calculate affected cells for preview
    const affectedCells =
      ((gridRange.endRowIndex ?? 0) - (gridRange.startRowIndex ?? 0)) *
      ((gridRange.endColumnIndex ?? 0) - (gridRange.startColumnIndex ?? 0));

    // If dry run mode, return preview without executing
    if (input.safety?.dryRun) {
      // Get existing rules to detect conflicts
      let existingRules = 0;
      try {
        const response = await this.sheetsApi.spreadsheets.get({
          spreadsheetId: input.spreadsheetId,
          fields: 'sheets.conditionalFormats',
        });
        const sheet = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
        existingRules = sheet?.conditionalFormats?.length ?? 0;
      } catch {
        // Ignore errors in preview
      }

      return this.success(
        'rule_add_conditional_format',
        {
          ruleIndex: input.index ?? 0,
          dryRun: true,
          rulePreview: {
            affectedRanges: [gridRange],
            affectedCells,
            existingRules,
          },
        },
        undefined,
        true
      );
    }

    let rule: sheets_v4.Schema$ConditionalFormatRule;

    if (input.rule!.type === 'boolean') {
      rule = {
        ranges: [toGridRange(gridRange)],
        booleanRule: {
          condition: {
            type: input.rule!.condition.type,
            values: input.rule!.condition.values?.map((v) => ({
              userEnteredValue: v,
            })),
          },
          format: {
            backgroundColor: input.rule!.format.backgroundColor,
            textFormat: input.rule!.format.textFormat,
          },
        },
      };
    } else {
      // Gradient rule
      rule = {
        ranges: [toGridRange(gridRange)],
        gradientRule: {
          minpoint: {
            type: input.rule!.minpoint.type,
            value: input.rule!.minpoint.value,
            color: input.rule!.minpoint.color,
          },
          midpoint: input.rule!.midpoint
            ? {
                type: input.rule!.midpoint.type,
                value: input.rule!.midpoint.value,
                color: input.rule!.midpoint.color,
              }
            : undefined,
          maxpoint: {
            type: input.rule!.maxpoint.type,
            value: input.rule!.maxpoint.value,
            color: input.rule!.maxpoint.color,
          },
        },
      };
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            addConditionalFormatRule: {
              rule,
              index: input.index ?? 0,
            },
          },
        ],
      },
    });

    return this.success('rule_add_conditional_format', {
      ruleIndex: input.index ?? 0,
    });
  }

  private async handleRuleUpdateConditionalFormat(
    input: FormatRequest & { action: 'rule_update_conditional_format' }
  ): Promise<FormatResponse> {
    if (input.safety?.dryRun) {
      return this.success(
        'rule_update_conditional_format',
        { ruleIndex: input.ruleIndex! },
        undefined,
        true
      );
    }

    // Get current rule to modify
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.conditionalFormats,sheets.properties.sheetId',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    const currentRule = sheet?.conditionalFormats?.[input.ruleIndex!];

    if (!currentRule) {
      return this.error({
        code: 'RANGE_NOT_FOUND',
        message: `Conditional format rule at index ${input.ruleIndex} not found`,
        retryable: false,
        suggestedFix: 'Verify the range reference is correct and the sheet exists',
      });
    }

    if (input.rule) {
      if (input.rule.type === 'boolean') {
        currentRule.booleanRule = {
          condition: {
            type: input.rule.condition.type,
            values: input.rule.condition.values?.map((v) => ({
              userEnteredValue: v,
            })),
          },
          format: {
            backgroundColor: input.rule.format.backgroundColor,
            textFormat: input.rule.format.textFormat,
          },
        };
      } else {
        currentRule.gradientRule = {
          minpoint: {
            type: input.rule.minpoint.type,
            value: input.rule.minpoint.value,
            color: input.rule.minpoint.color,
          },
          midpoint: input.rule.midpoint
            ? {
                type: input.rule.midpoint.type,
                value: input.rule.midpoint.value,
                color: input.rule.midpoint.color,
              }
            : undefined,
          maxpoint: {
            type: input.rule.maxpoint.type,
            value: input.rule.maxpoint.value,
            color: input.rule.maxpoint.color,
          },
        };
      }
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateConditionalFormatRule: {
              rule: currentRule,
              index: input.ruleIndex!,
              sheetId: input.sheetId,
              newIndex: input.newIndex,
            },
          },
        ],
      },
    });

    return this.success('rule_update_conditional_format', {
      ruleIndex: input.newIndex ?? input.ruleIndex!,
    });
  }

  private async handleRuleDeleteConditionalFormat(
    input: FormatRequest & { action: 'rule_delete_conditional_format' }
  ): Promise<FormatResponse> {
    if (input.safety?.dryRun) {
      return this.success('rule_delete_conditional_format', {}, undefined, true);
    }

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'rule_delete_conditional_format',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteConditionalFormatRule: {
              sheetId: input.sheetId!,
              index: input.ruleIndex!,
            },
          },
        ],
      },
    });

    return this.success('rule_delete_conditional_format', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleRuleListConditionalFormats(
    input: FormatRequest & { action: 'rule_list_conditional_formats' }
  ): Promise<FormatResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.conditionalFormats,sheets.properties.sheetId',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    const allRules = (sheet?.conditionalFormats ?? []).map((rule, index) => ({
      index,
      type: rule.booleanRule ? ('boolean' as const) : ('gradient' as const),
      ranges: (rule.ranges ?? []).map((r) =>
        buildGridRangeInput(
          r.sheetId ?? 0,
          r.startRowIndex ?? undefined,
          r.endRowIndex ?? undefined,
          r.startColumnIndex ?? undefined,
          r.endColumnIndex ?? undefined
        )
      ),
    }));

    // Pagination to prevent >1MB responses
    const limit = 50; // Max 50 rules per response
    const totalCount = allRules.length;
    const rules = allRules.slice(0, limit);
    const truncated = totalCount > limit;

    return this.success('rule_list_conditional_formats', {
      rules,
      totalCount,
      truncated,
      ...(truncated && {
        suggestion: `Found ${totalCount} rules. Showing first ${limit}. Use sheets_core action "get" to retrieve full rule data if needed.`,
      }),
    });
  }

  // ============================================================
  // Rules Actions (Data Validation)
  // ============================================================

  private async handleSetDataValidation(
    input: FormatRequest & { action: 'set_data_validation' }
  ): Promise<FormatResponse> {
    const gridRange = await this.resolveRangeInput(input.spreadsheetId, input.range!);

    const condition: sheets_v4.Schema$BooleanCondition = {
      type: input.condition!.type,
    };

    if (input.condition!.values && input.condition!.values.length > 0) {
      condition.values = input.condition!.values.map((v) => ({
        userEnteredValue: v,
      }));
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: toGridRange(gridRange),
              rule: {
                condition,
                inputMessage: input.inputMessage,
                strict: input.strict ?? true,
                showCustomUi: input.showDropdown ?? true,
              },
            },
          },
        ],
      },
    });

    return this.success('set_data_validation', {});
  }

  private async handleClearDataValidation(
    input: FormatRequest & { action: 'clear_data_validation' }
  ): Promise<FormatResponse> {
    if (input.safety?.dryRun) {
      return this.success('clear_data_validation', {}, undefined, true);
    }

    const gridRange = await this.resolveRangeInput(input.spreadsheetId, input.range!);

    // Create snapshot if requested
    const snapshot = await createSnapshotIfNeeded(
      this.context.snapshotService,
      {
        operationType: 'rule_clear_data_validation',
        isDestructive: true,
        spreadsheetId: input.spreadsheetId,
      },
      input.safety
    );

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            setDataValidation: {
              range: toGridRange(gridRange),
              // Omitting rule clears validation
            },
          },
        ],
      },
    });

    return this.success('clear_data_validation', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleListDataValidations(
    input: FormatRequest & { action: 'list_data_validations' }
  ): Promise<FormatResponse> {
    // Get sheet metadata to check size
    const metaResponse = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets(properties(sheetId,gridProperties))',
    });

    const sheet = metaResponse.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    if (!sheet?.properties?.gridProperties) {
      return this.error({
        code: 'SHEET_NOT_FOUND',
        message: `Sheet with ID ${input.sheetId} not found`,
        retryable: false,
        suggestedFix: 'Verify the sheet name or ID is correct',
      });
    }

    const rowCount = sheet.properties.gridProperties.rowCount ?? 1000;
    const colCount = sheet.properties.gridProperties.columnCount ?? 26;
    const totalCells = rowCount * colCount;

    // Require range parameter for large sheets to prevent timeout
    if (!input.range && totalCells > 10000) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Sheet has ${totalCells.toLocaleString()} cells (${rowCount}×${colCount}). Provide 'range' parameter to prevent timeout.`,
        resolution: `Specify a range parameter to limit scan area (e.g., range: "A1:Z100"). For best performance, use ranges <10K cells.`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    // Build range for API call - convert RangeInput to A1 notation
    let rangeStr: string | undefined;
    if (input.range) {
      if (typeof input.range === 'string') {
        rangeStr = input.range;
      } else if ('a1' in input.range) {
        rangeStr = input.range.a1;
      } else if ('namedRange' in input.range) {
        rangeStr = input.range.namedRange;
      } else {
        // For grid/semantic ranges, use a reasonable default
        rangeStr = 'A1:ZZ1000';
      }
    }

    const ranges = rangeStr ? [rangeStr] : []; // Empty = entire sheet

    // Fetch grid data with field mask to only get data validations
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      ranges,
      includeGridData: true,
      fields: 'sheets.data.rowData.values.dataValidation,sheets.properties.sheetId',
    });

    const sheetData = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    const allValidations: Array<{
      range: {
        sheetId: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      condition: { type: ConditionType; values?: string[] };
    }> = [];

    // Extract validations from grid data
    sheetData?.data?.forEach((data) => {
      const startRowIndex = data.startRow ?? 0;
      const startColumnIndex = data.startColumn ?? 0;

      data.rowData?.forEach((row, rowIdx) => {
        row.values?.forEach((cell, colIdx) => {
          if (cell.dataValidation?.condition) {
            const condType = cell.dataValidation.condition.type as ConditionType;
            const absoluteRow = startRowIndex + rowIdx;
            const absoluteCol = startColumnIndex + colIdx;

            allValidations.push({
              range: buildGridRangeInput(
                input.sheetId!,
                absoluteRow,
                absoluteRow + 1,
                absoluteCol,
                absoluteCol + 1
              ),
              condition: {
                type: condType,
                values: cell.dataValidation.condition.values?.map((v) => v.userEnteredValue ?? ''),
              },
            });
          }
        });
      });
    });

    // Pagination to prevent >1MB responses (data validation can be per-cell!)
    const limit = 100; // Max 100 validation rules per response
    const totalCount = allValidations.length;
    const validations = allValidations.slice(0, limit);
    const truncated = totalCount > limit;

    return this.success('list_data_validations', {
      validations,
      totalCount,
      truncated,
      ...(input.range && { scannedRange: ranges[0] }),
      ...(truncated && {
        suggestion: `Found ${totalCount} validation rules. Showing first ${limit}. Consider using a smaller range to see specific validations.`,
      }),
    });
  }

  // ============================================================
  // Rules Actions (Preset Rules)
  // ============================================================

  private async handleAddConditionalFormatRule(
    input: FormatRequest & { action: 'add_conditional_format_rule' }
  ): Promise<FormatResponse> {
    // Fix QA-2.2: Pass sheetId as-is (may be undefined), resolveGridRange will look it up from range
    const gridRange = await this.resolveGridRange(
      input.spreadsheetId,
      input.sheetId as number,
      input.range!
    );
    const googleRange = toGridRange(gridRange);

    let request: sheets_v4.Schema$Request;

    switch (input.rulePreset!) {
      case 'highlight_duplicates':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: '=COUNTIF($A:$A,A1)>1' }],
                },
                format: { backgroundColor: { red: 1, green: 0.9, blue: 0.9 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'highlight_blanks':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: { type: 'BLANK' },
                format: { backgroundColor: { red: 1, green: 1, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'highlight_errors':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: '=ISERROR(A1)' }],
                },
                format: { backgroundColor: { red: 1, green: 0.8, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'color_scale_green_red':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              gradientRule: {
                minpoint: {
                  type: 'MIN',
                  color: { red: 0.8, green: 1, blue: 0.8 },
                },
                maxpoint: {
                  type: 'MAX',
                  color: { red: 1, green: 0.8, blue: 0.8 },
                },
              },
            },
            index: 0,
          },
        };
        break;

      case 'color_scale_blue_red':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              gradientRule: {
                minpoint: {
                  type: 'MIN',
                  color: { red: 0.8, green: 0.8, blue: 1 },
                },
                maxpoint: {
                  type: 'MAX',
                  color: { red: 1, green: 0.8, blue: 0.8 },
                },
              },
            },
            index: 0,
          },
        };
        break;

      case 'data_bars':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              gradientRule: {
                minpoint: { type: 'MIN', color: { red: 1, green: 1, blue: 1 } },
                maxpoint: {
                  type: 'MAX',
                  color: { red: 0.2, green: 0.6, blue: 0.9 },
                },
              },
            },
            index: 0,
          },
        };
        break;

      case 'top_10_percent':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: '=A1>=PERCENTILE($A:$A,0.9)' }],
                },
                format: { backgroundColor: { red: 0.8, green: 1, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'bottom_10_percent':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: '=A1<=PERCENTILE($A:$A,0.1)' }],
                },
                format: { backgroundColor: { red: 1, green: 0.8, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'above_average':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: '=A1>AVERAGE($A:$A)' }],
                },
                format: { backgroundColor: { red: 0.8, green: 1, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'below_average':
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: '=A1<AVERAGE($A:$A)' }],
                },
                format: { backgroundColor: { red: 1, green: 0.8, blue: 0.8 } },
              },
            },
            index: 0,
          },
        };
        break;

      case 'negative_red_positive_green': {
        // Financial preset: red background for negative numbers, green for positive
        // Creates TWO rules in one call for complete P&L / financial formatting
        const negativeRule: sheets_v4.Schema$Request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'NUMBER_LESS',
                  values: [{ userEnteredValue: '0' }],
                },
                format: {
                  backgroundColor: { red: 1, green: 0.85, blue: 0.85 },
                  textFormat: { foregroundColor: { red: 0.8, green: 0, blue: 0 } },
                },
              },
            },
            index: 0,
          },
        };
        const positiveRule: sheets_v4.Schema$Request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'NUMBER_GREATER',
                  values: [{ userEnteredValue: '0' }],
                },
                format: {
                  backgroundColor: { red: 0.85, green: 1, blue: 0.85 },
                  textFormat: { foregroundColor: { red: 0, green: 0.5, blue: 0 } },
                },
              },
            },
            index: 1,
          },
        };
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: input.spreadsheetId,
          requestBody: { requests: [negativeRule, positiveRule] },
        });
        return this.success('add_conditional_format_rule', { ruleIndex: 0, rulesAdded: 2 });
      }

      case 'traffic_light':
        // Three-color gradient: red (low) → yellow (mid) → green (high)
        request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              gradientRule: {
                minpoint: {
                  type: 'MIN',
                  color: { red: 1, green: 0.8, blue: 0.8 },
                },
                midpoint: {
                  type: 'PERCENTILE',
                  value: '50',
                  color: { red: 1, green: 1, blue: 0.7 },
                },
                maxpoint: {
                  type: 'MAX',
                  color: { red: 0.8, green: 1, blue: 0.8 },
                },
              },
            },
            index: 0,
          },
        };
        break;

      case 'variance_highlight': {
        // Highlights values > +10% with green, < -10% with red (for budget variance analysis)
        const negVarRule: sheets_v4.Schema$Request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'NUMBER_LESS',
                  values: [{ userEnteredValue: '-0.1' }],
                },
                format: {
                  backgroundColor: { red: 1, green: 0.85, blue: 0.85 },
                  textFormat: { foregroundColor: { red: 0.8, green: 0, blue: 0 } },
                },
              },
            },
            index: 0,
          },
        };
        const posVarRule: sheets_v4.Schema$Request = {
          addConditionalFormatRule: {
            rule: {
              ranges: [googleRange],
              booleanRule: {
                condition: {
                  type: 'NUMBER_GREATER',
                  values: [{ userEnteredValue: '0.1' }],
                },
                format: {
                  backgroundColor: { red: 0.85, green: 1, blue: 0.85 },
                  textFormat: { foregroundColor: { red: 0, green: 0.5, blue: 0 } },
                },
              },
            },
            index: 1,
          },
        };
        await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: input.spreadsheetId,
          requestBody: { requests: [negVarRule, posVarRule] },
        });
        return this.success('add_conditional_format_rule', { ruleIndex: 0, rulesAdded: 2 });
      }

      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown conditional format preset: "${input.rulePreset}". Available presets: highlight_duplicates, highlight_blanks, highlight_errors, color_scale, data_bar, above_average, top_n, positive_negative, traffic_light, variance_highlight`,
          retryable: false,
          suggestedFix:
            'Use one of the listed presets, or use rule_add_conditional_format for custom rules',
        });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests: [request] },
    });

    return this.success('add_conditional_format_rule', { ruleIndex: 0 });
  }

  // ============================================================
  // NL→CF Compiler
  // ============================================================

  /**
   * Parse a natural language conditional format description and apply it.
   * Supports: comparison rules, text rules, blanks/errors, presets, color scale.
   */
  private async handleGenerateConditionalFormat(
    input: FormatRequest & { action: 'generate_conditional_format' }
  ): Promise<FormatResponse> {
    const {
      spreadsheetId,
      description,
      sheetId = 0,
      applyImmediately = true,
    } = input as {
      spreadsheetId: string;
      description: string;
      range: unknown;
      sheetId?: number;
      applyImmediately?: boolean;
    };
    const range = (input as Record<string, unknown>)['range'] as unknown;

    const parsed = this.parseNLConditionalFormat(description);
    if (!parsed.success) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Could not parse conditional format description: "${description}". ${parsed.hint}`,
        retryable: false,
        suggestedFix:
          'Try: "highlight values greater than 100 in red", "color scale green to red", "highlight blanks in yellow", "above average in green"',
      });
    }

    if (!applyImmediately) {
      return this.success('generate_conditional_format', {
        generatedRule: parsed.rule,
        message: `Rule generated (not applied). Set applyImmediately:true to apply.`,
      });
    }

    // Delegate to existing handler using the parsed rule
    if (parsed.rulePreset) {
      return this.handleAddConditionalFormatRule({
        spreadsheetId,
        sheetId,
        range,
        rulePreset: parsed.rulePreset,
        action: 'add_conditional_format_rule',
      } as FormatRequest & { action: 'add_conditional_format_rule' });
    }

    if (parsed.rule) {
      return this.handleRuleAddConditionalFormat({
        spreadsheetId,
        sheetId,
        range,
        rule: parsed.rule,
        action: 'rule_add_conditional_format',
      } as FormatRequest & { action: 'rule_add_conditional_format' });
    }

    return this.error({
      code: 'INTERNAL_ERROR',
      message: 'Rule parsing produced no output',
      retryable: false,
      suggestedFix: 'Use add_conditional_format_rule directly with a preset',
    });
  }

  /**
   * Parse a natural language conditional format description into rule parameters.
   */
  private parseNLConditionalFormat(description: string): {
    success: boolean;
    rulePreset?: string;
    rule?: Record<string, unknown>;
    hint?: string;
  } {
    const d = description.toLowerCase().trim();

    // === Preset patterns (delegate to add_conditional_format_rule) ===
    if (/\bblank|empty cell/.test(d)) return { success: true, rulePreset: 'highlight_blanks' };
    if (/\bduplicate/.test(d)) return { success: true, rulePreset: 'highlight_duplicates' };
    if (/\berror/.test(d)) return { success: true, rulePreset: 'highlight_errors' };
    if (/\bdata.?bar/.test(d)) return { success: true, rulePreset: 'data_bars' };
    if (/\babove.?average/.test(d)) return { success: true, rulePreset: 'above_average' };
    if (/\bbelow.?average/.test(d)) return { success: true, rulePreset: 'below_average' };
    if (/\btop\s+10/.test(d)) return { success: true, rulePreset: 'top_10_percent' };
    if (/\bbottom\s+10/.test(d)) return { success: true, rulePreset: 'bottom_10_percent' };

    // Color scale patterns
    if (/\bcolor.?scale|heat.?map|gradient/.test(d)) {
      if (/blue/.test(d)) return { success: true, rulePreset: 'color_scale_blue_red' };
      return { success: true, rulePreset: 'color_scale_green_red' };
    }

    // === Comparison rules (build full rule object) ===
    const color = this.parseNLColor(d);

    // Number comparisons
    const numMatch = d.match(
      /(?:greater\s+than|more\s+than|above|>)\s*([\d.,]+)|(?:less\s+than|below|<)\s*([\d.,]+)|(?:equal(?:s)?\s+to|=)\s*([\d.,]+)|(?:not\s+equal|!=)\s*([\d.,]+)/
    );
    if (numMatch) {
      let condType: string;
      let value: string;
      if (numMatch[1]) {
        condType = 'NUMBER_GREATER';
        value = numMatch[1].replace(/,/g, '');
      } else if (numMatch[2]) {
        condType = 'NUMBER_LESS';
        value = numMatch[2].replace(/,/g, '');
      } else if (numMatch[3]) {
        condType = 'NUMBER_EQ';
        value = numMatch[3].replace(/,/g, '');
      } else {
        condType = 'NUMBER_NOT_EQ';
        value = numMatch[4]!.replace(/,/g, '');
      }

      return {
        success: true,
        rule: {
          type: 'boolean',
          condition: { type: condType, values: [{ userEnteredValue: value }] },
          format: { backgroundColor: color ?? { red: 0.9, green: 0.2, blue: 0.2 } },
        },
      };
    }

    // Between range: "between 10 and 100"
    const betweenMatch = d.match(/between\s+([\d.,]+)\s+and\s+([\d.,]+)/);
    if (betweenMatch) {
      return {
        success: true,
        rule: {
          type: 'boolean',
          condition: {
            type: 'NUMBER_BETWEEN',
            values: [
              { userEnteredValue: betweenMatch[1]!.replace(/,/g, '') },
              { userEnteredValue: betweenMatch[2]!.replace(/,/g, '') },
            ],
          },
          format: { backgroundColor: color ?? { red: 0.9, green: 0.9, blue: 0.2 } },
        },
      };
    }

    // Text comparisons
    const textContainsMatch = d.match(/contains?\s+["']?([^"']+?)["']?\s*(?:in\s+\w+)?$/);
    if (
      textContainsMatch &&
      !/greater|less|equal|above|below|blank|duplicate|error|scale/.test(d)
    ) {
      return {
        success: true,
        rule: {
          type: 'boolean',
          condition: {
            type: 'TEXT_CONTAINS',
            values: [{ userEnteredValue: textContainsMatch[1]!.trim() }],
          },
          format: { backgroundColor: color ?? { red: 0.9, green: 0.9, blue: 0.2 } },
        },
      };
    }

    // Text starts with
    const startsWithMatch = d.match(/starts?\s+with\s+["']?([^"']+?)["']?/);
    if (startsWithMatch) {
      return {
        success: true,
        rule: {
          type: 'boolean',
          condition: {
            type: 'TEXT_STARTS_WITH',
            values: [{ userEnteredValue: startsWithMatch[1]!.trim() }],
          },
          format: { backgroundColor: color ?? { red: 0.9, green: 0.9, blue: 0.2 } },
        },
      };
    }

    // Not blank
    if (/not\s+blank|not\s+empty|has\s+value|is\s+filled/.test(d)) {
      return {
        success: true,
        rule: {
          type: 'boolean',
          condition: { type: 'NOT_BLANK' },
          format: { backgroundColor: color ?? { red: 0.2, green: 0.7, blue: 0.2 } },
        },
      };
    }

    return {
      success: false,
      hint: 'Supported patterns: "greater than N", "less than N", "between X and Y", "contains text", "starts with text", "blank", "duplicate", "error", "above average", "below average", "top 10%", "color scale", "data bars".',
    };
  }

  /** Parse a color name from a natural language string */
  private parseNLColor(text: string): Record<string, number> | undefined {
    if (/\bred\b/.test(text)) return { red: 0.9, green: 0.2, blue: 0.2 };
    if (/\bgreen\b/.test(text)) return { red: 0.2, green: 0.7, blue: 0.2 };
    if (/\byellow\b/.test(text)) return { red: 1, green: 0.9, blue: 0 };
    if (/\bblue\b/.test(text)) return { red: 0.2, green: 0.4, blue: 0.8 };
    if (/\borange\b/.test(text)) return { red: 1, green: 0.5, blue: 0 };
    if (/\bpurple\b/.test(text)) return { red: 0.6, green: 0.2, blue: 0.8 };
    if (/\bpink\b/.test(text)) return { red: 1, green: 0.5, blue: 0.7 };
    return undefined; // no matching color name
  }

  // ============================================================
  // Sparkline Actions
  // ============================================================

  private async handleSparklineAdd(
    input: FormatRequest & { action: 'sparkline_add' }
  ): Promise<FormatResponse> {
    // Resolve the data range to A1 notation
    const dataRangeA1 = await this.resolveRange(input.spreadsheetId, input.dataRange);

    // Build SPARKLINE formula with options
    const options: string[] = [];
    const config = input.config;

    // Chart type (default is LINE, so only add if different)
    if (config?.type && config.type !== 'LINE') {
      options.push(`"charttype", "${config.type.toLowerCase()}"`);
    }

    // Colors (convert RGB 0-1 to hex)
    if (config?.color) options.push(`"color", "${this.rgbToHex(config.color)}"`);
    if (config?.negativeColor) options.push(`"negcolor", "${this.rgbToHex(config.negativeColor)}"`);
    if (config?.firstColor) options.push(`"firstcolor", "${this.rgbToHex(config.firstColor)}"`);
    if (config?.lastColor) options.push(`"lastcolor", "${this.rgbToHex(config.lastColor)}"`);
    if (config?.highColor) options.push(`"highcolor", "${this.rgbToHex(config.highColor)}"`);
    if (config?.lowColor) options.push(`"lowcolor", "${this.rgbToHex(config.lowColor)}"`);

    // Axis settings
    if (config?.showAxis && config.axisColor) {
      options.push(`"axis", true`);
      options.push(`"axiscolor", "${this.rgbToHex(config.axisColor)}"`);
    } else if (config?.showAxis) {
      options.push(`"axis", true`);
    }

    // Other options
    if (config?.lineWidth !== undefined && config.lineWidth !== 1) {
      options.push(`"linewidth", ${config.lineWidth}`);
    }
    if (config?.minValue !== undefined) options.push(`"ymin", ${config.minValue}`);
    if (config?.maxValue !== undefined) options.push(`"ymax", ${config.maxValue}`);
    if (config?.rtl) options.push(`"rtl", true`);

    // Build the formula
    const optionsStr = options.length > 0 ? `, {${options.join('; ')}}` : '';
    const formula = `=SPARKLINE(${dataRangeA1}${optionsStr})`;

    if (input.safety?.dryRun) {
      return this.success('sparkline_add', { cell: input.targetCell, formula }, undefined, true);
    }

    // Write formula to target cell
    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: input.spreadsheetId,
      range: input.targetCell,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[formula]] },
    });

    return this.success('sparkline_add', { cell: input.targetCell, formula });
  }

  private async handleSparklineGet(
    input: FormatRequest & { action: 'sparkline_get' }
  ): Promise<FormatResponse> {
    // Read the cell with FORMULA render option to get the actual formula
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.cell,
      valueRenderOption: 'FORMULA',
    });

    const formula = response.data.values?.[0]?.[0];

    if (!formula || !String(formula).toUpperCase().startsWith('=SPARKLINE(')) {
      return this.error({
        code: 'NOT_FOUND',
        message: `No sparkline found in cell ${input.cell}`,
        retryable: false,
        suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
      });
    }

    return this.success('sparkline_get', { cell: input.cell, formula: String(formula) });
  }

  private async handleSparklineClear(
    input: FormatRequest & { action: 'sparkline_clear' }
  ): Promise<FormatResponse> {
    // BUG-010 FIX: sparkline_clear is optimized using values.clear()
    // This is more efficient than other approaches and suitable for single cells
    // values.clear() is a lightweight API call with minimal overhead
    if (input.safety?.dryRun) {
      return this.success('sparkline_clear', { cell: input.cell }, undefined, true);
    }

    // Clear the cell content
    await this.sheetsApi.spreadsheets.values.clear({
      spreadsheetId: input.spreadsheetId,
      range: input.cell,
    });

    return this.success('sparkline_clear', { cell: input.cell });
  }

  /**
   * Convert RGB color (0-1 scale) to hex string
   */
  private rgbToHex(color: { red?: number; green?: number; blue?: number }): string {
    const r = Math.round((color.red ?? 0) * 255);
    const g = Math.round((color.green ?? 0) * 255);
    const b = Math.round((color.blue ?? 0) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async a1ToGridRange(spreadsheetId: string, a1: string): Promise<GridRangeInput> {
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return buildGridRangeInput(
      sheetId,
      parsed.startRow,
      parsed.endRow,
      parsed.startCol,
      parsed.endCol
    );
  }

  private async resolveGridRange(
    spreadsheetId: string,
    sheetId: number,
    range:
      | { a1?: string }
      | { namedRange?: string }
      | { semantic?: unknown }
      | { grid?: unknown }
      | string
      | undefined
      | null
  ): Promise<GridRangeInput> {
    // Validate range is provided
    if (range === undefined || range === null) {
      throw new RangeResolutionError(
        'Range is required for this operation. Provide A1 notation (e.g., "Sheet1!A1:D10") or a range object with { a1: "..." }.',
        'INVALID_PARAMS',
        { spreadsheetId, sheetId },
        false
      );
    }

    // Handle string input (A1 notation passed directly instead of { a1: "..." })
    if (typeof range === 'string') {
      const parsed = parseA1Notation(range);
      // Fix QA-2.2: When sheetId is NaN/undefined, resolve from parsed sheet name
      let resolvedSheetId = sheetId;
      if (
        resolvedSheetId === undefined ||
        resolvedSheetId === null ||
        Number.isNaN(resolvedSheetId)
      ) {
        if (parsed.sheetName) {
          resolvedSheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);
        } else {
          // No sheetId and no sheet name in range - get first sheet
          resolvedSheetId = await this.getSheetId(spreadsheetId, undefined, this.sheetsApi);
        }
      }
      return buildGridRangeInput(
        resolvedSheetId,
        parsed.startRow,
        parsed.endRow,
        parsed.startCol,
        parsed.endCol
      );
    }

    // Handle object with a1 property
    if ('a1' in range && range.a1) {
      const parsed = parseA1Notation(range.a1);
      // Fix QA-2.2: When sheetId is NaN/undefined, resolve from parsed sheet name
      let resolvedSheetId = sheetId;
      if (
        resolvedSheetId === undefined ||
        resolvedSheetId === null ||
        Number.isNaN(resolvedSheetId)
      ) {
        if (parsed.sheetName) {
          resolvedSheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);
        } else {
          resolvedSheetId = await this.getSheetId(spreadsheetId, undefined, this.sheetsApi);
        }
      }
      return buildGridRangeInput(
        resolvedSheetId,
        parsed.startRow,
        parsed.endRow,
        parsed.startCol,
        parsed.endCol
      );
    }

    if ('grid' in range && range.grid) {
      const grid = range.grid as {
        sheetId: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      return buildGridRangeInput(
        grid.sheetId ?? sheetId,
        grid.startRowIndex,
        grid.endRowIndex,
        grid.startColumnIndex,
        grid.endColumnIndex
      );
    }

    // For named ranges, resolve via API
    if ('namedRange' in range && range.namedRange) {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'namedRanges',
      });

      const namedRange = response.data.namedRanges?.find((nr) => nr.name === range.namedRange);
      if (namedRange?.range) {
        return buildGridRangeInput(
          namedRange.range.sheetId ?? sheetId,
          namedRange.range.startRowIndex ?? 0,
          namedRange.range.endRowIndex ?? 1000,
          namedRange.range.startColumnIndex ?? 0,
          namedRange.range.endColumnIndex ?? 26
        );
      }
    }

    throw new RangeResolutionError(
      'Could not resolve range - ambiguous input',
      'RANGE_RESOLUTION_FAILED',
      { input: range, spreadsheetId, sheetId },
      false
    );
  }

  private async resolveRangeInput(
    spreadsheetId: string,
    range:
      | { a1?: string }
      | { namedRange?: string }
      | { semantic?: unknown }
      | { grid?: unknown }
      | string
      | undefined
      | null
  ): Promise<GridRangeInput> {
    // Validate range is provided
    if (range === undefined || range === null) {
      throw new RangeResolutionError(
        'Range is required for this operation. Provide A1 notation (e.g., "Sheet1!A1:D10") or a range object.',
        'INVALID_PARAMS',
        { spreadsheetId },
        false
      );
    }

    // Handle string input (A1 notation passed directly)
    if (typeof range === 'string') {
      const parsed = parseA1Notation(range);
      const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);
      return buildGridRangeInput(
        sheetId,
        parsed.startRow,
        parsed.endRow,
        parsed.startCol,
        parsed.endCol
      );
    }

    // Handle object with a1 property
    if ('a1' in range && range.a1) {
      const parsed = parseA1Notation(range.a1);
      const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);
      return buildGridRangeInput(
        sheetId,
        parsed.startRow,
        parsed.endRow,
        parsed.startCol,
        parsed.endCol
      );
    }

    if ('grid' in range && range.grid) {
      const grid = range.grid as {
        sheetId: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      return buildGridRangeInput(
        grid.sheetId,
        grid.startRowIndex,
        grid.endRowIndex,
        grid.startColumnIndex,
        grid.endColumnIndex
      );
    }

    // For named ranges, resolve via API
    if ('namedRange' in range && range.namedRange) {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'namedRanges',
      });

      const namedRange = response.data.namedRanges?.find((nr) => nr.name === range.namedRange);
      if (namedRange?.range) {
        return buildGridRangeInput(
          namedRange.range.sheetId ?? 0,
          namedRange.range.startRowIndex ?? 0,
          namedRange.range.endRowIndex ?? 1000,
          namedRange.range.startColumnIndex ?? 0,
          namedRange.range.endColumnIndex ?? 26
        );
      }
    }

    throw new RangeResolutionError(
      'Could not resolve range - ambiguous input',
      'RANGE_RESOLUTION_FAILED',
      { input: range, spreadsheetId },
      false
    );
  }

  /**
   * Set rich text formatting within a single cell.
   * Uses the updateCells request with textFormatRuns to apply different
   * formatting to different segments of text within one cell.
   */
  private async handleSetRichText(
    input: FormatRequest & { action: 'set_rich_text' }
  ): Promise<FormatResponse> {
    const cell = (input as unknown as { cell: string }).cell;
    const runs = (
      input as unknown as { runs: Array<{ text: string; format?: Record<string, unknown> }> }
    ).runs;

    // Parse cell reference to get sheet and cell position
    const cellA1 = await this.resolveRange(input.spreadsheetId, { a1: cell });
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, cellA1);
    const googleRange = toGridRange(gridRange);

    // Build the full text value from all runs
    const fullText = runs.map((r) => r.text).join('');

    // Build textFormatRuns array for Google Sheets API
    // Each run specifies a startIndex and format for that segment
    const textFormatRuns: Array<{ startIndex?: number; format?: Record<string, unknown> }> = [];
    let currentIndex = 0;
    for (const run of runs) {
      if (run.format) {
        textFormatRuns.push({
          startIndex: currentIndex,
          format: run.format,
        });
      } else {
        // Even runs without formatting need an entry to reset to default
        textFormatRuns.push({
          startIndex: currentIndex,
          format: {},
        });
      }
      currentIndex += run.text.length;
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: googleRange,
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { stringValue: fullText },
                      textFormatRuns: textFormatRuns,
                    },
                  ],
                },
              ],
              fields: 'userEnteredValue,textFormatRuns',
            },
          },
        ],
      },
    });

    return this.success('set_rich_text', {
      cell: cellA1,
      runsApplied: runs.length,
      textLength: fullText.length,
    });
  }
}
