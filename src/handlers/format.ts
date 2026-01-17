/**
 * ServalSheets - Format Handler
 *
 * Handles sheets_format tool (formatting operations and rules)
 * MCP Protocol: 2025-11-25
 *
 * 18 Actions:
 * Format (10): set_format, suggest_format, set_background, set_text_format, set_number_format,
 *              set_alignment, set_borders, clear_format, apply_preset, auto_fit
 * Rules (8): rule_add_conditional_format, rule_update_conditional_format, rule_delete_conditional_format,
 *            rule_list_conditional_formats, rule_add_data_validation, rule_clear_data_validation,
 *            rule_list_data_validations, rule_add_preset_rule
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsFormatInput, SheetsFormatOutput, FormatResponse } from '../schemas/index.js';
import {
  parseA1Notation,
  toGridRange,
  estimateCellCount,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
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

export class FormatHandler extends BaseHandler<SheetsFormatInput, SheetsFormatOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_format', context);
    this.sheetsApi = sheetsApi;
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  async handle(input: SheetsFormatInput): Promise<SheetsFormatOutput> {
    // Input is now the action directly (no request wrapper)

    // Require authentication before proceeding
    this.requireAuth();

    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(input) as SheetsFormatInput;

    try {
      const response = await this.executeAction(inferredRequest);

      // Track context on success
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: inferredRequest.spreadsheetId,
          sheetId:
            'sheetId' in inferredRequest
              ? typeof inferredRequest.sheetId === 'number'
                ? inferredRequest.sheetId
                : undefined
              : undefined,
          range:
            'range' in inferredRequest
              ? typeof inferredRequest.range === 'string'
                ? inferredRequest.range
                : undefined
              : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = inferredRequest.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsFormatInput): Intent[] {
    // Input is now the action directly (no request wrapper)
    const destructiveActions = [
      'clear_format',
      'rule_update_conditional_format',
      'rule_delete_conditional_format',
      'rule_clear_data_validation',
    ];

    const isRuleAction = input.action.startsWith('rule_');

    if ('spreadsheetId' in input) {
      return [
        {
          type: isRuleAction ? 'UPDATE_CONDITIONAL_FORMAT' : 'UPDATE_CELLS',
          target: { spreadsheetId: input.spreadsheetId },
          payload: {},
          metadata: {
            sourceTool: this.toolName,
            sourceAction: input.action,
            priority: 1,
            destructive: destructiveActions.includes(input.action),
          },
        },
      ];
    }
    return [];
  }

  /**
   * Execute action and return response (extracted for task/non-task paths)
   */
  private async executeAction(request: SheetsFormatInput): Promise<FormatResponse> {
    switch (request.action) {
      case 'set_format':
        return await this.handleSetFormat(request as SheetsFormatInput & { action: 'set_format' });
      case 'suggest_format':
        return await this.handleSuggestFormat(
          request as SheetsFormatInput & { action: 'suggest_format' }
        );
      case 'set_background':
        return await this.handleSetBackground(
          request as SheetsFormatInput & { action: 'set_background' }
        );
      case 'set_text_format':
        return await this.handleSetTextFormat(
          request as SheetsFormatInput & { action: 'set_text_format' }
        );
      case 'set_number_format':
        return await this.handleSetNumberFormat(
          request as SheetsFormatInput & { action: 'set_number_format' }
        );
      case 'set_alignment':
        return await this.handleSetAlignment(
          request as SheetsFormatInput & { action: 'set_alignment' }
        );
      case 'set_borders':
        return await this.handleSetBorders(
          request as SheetsFormatInput & { action: 'set_borders' }
        );
      case 'clear_format':
        return await this.handleClearFormat(
          request as SheetsFormatInput & { action: 'clear_format' }
        );
      case 'apply_preset':
        return await this.handleApplyPreset(
          request as SheetsFormatInput & { action: 'apply_preset' }
        );
      case 'auto_fit':
        return await this.handleAutoFit(request as SheetsFormatInput & { action: 'auto_fit' });
      case 'rule_add_conditional_format':
        return await this.handleRuleAddConditionalFormat(
          request as SheetsFormatInput & { action: 'rule_add_conditional_format' }
        );
      case 'rule_update_conditional_format':
        return await this.handleRuleUpdateConditionalFormat(
          request as SheetsFormatInput & { action: 'rule_update_conditional_format' }
        );
      case 'rule_delete_conditional_format':
        return await this.handleRuleDeleteConditionalFormat(
          request as SheetsFormatInput & { action: 'rule_delete_conditional_format' }
        );
      case 'rule_list_conditional_formats':
        return await this.handleRuleListConditionalFormats(
          request as SheetsFormatInput & { action: 'rule_list_conditional_formats' }
        );
      case 'rule_add_data_validation':
        return await this.handleRuleAddDataValidation(
          request as SheetsFormatInput & { action: 'rule_add_data_validation' }
        );
      case 'rule_clear_data_validation':
        return await this.handleRuleClearDataValidation(
          request as SheetsFormatInput & { action: 'rule_clear_data_validation' }
        );
      case 'rule_list_data_validations':
        return await this.handleRuleListDataValidations(
          request as SheetsFormatInput & { action: 'rule_list_data_validations' }
        );
      case 'rule_add_preset_rule':
        return await this.handleRuleAddPresetRule(
          request as SheetsFormatInput & { action: 'rule_add_preset_rule' }
        );
      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown action: ${(request as { action: string }).action}`,
          retryable: false,
        });
    }
  }

  // ============================================================
  // Format Actions
  // ============================================================

  private async handleSetFormat(
    input: SheetsFormatInput & { action: 'set_format' }
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

    return this.success('set_format', {
      cellsFormatted: estimateCellCount(googleRange),
    });
  }

  private async handleSuggestFormat(
    input: SheetsFormatInput & { action: 'suggest_format' }
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
      });

      const sheet = response.data.sheets?.[0];
      const gridData = sheet?.data?.[0];
      if (!gridData || !gridData.rowData || gridData.rowData.length === 0) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'Range contains no data',
          retryable: false,
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
        });
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.error({
          code: 'INTERNAL_ERROR',
          message: 'Could not parse format suggestions from AI response',
          retryable: true,
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
      });
    }
  }

  private async handleSetBackground(
    input: SheetsFormatInput & { action: 'set_background' }
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
    input: SheetsFormatInput & { action: 'set_text_format' }
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
    input: SheetsFormatInput & { action: 'set_number_format' }
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
    input: SheetsFormatInput & { action: 'set_alignment' }
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
        message: 'No alignment properties specified',
        retryable: false,
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
    input: SheetsFormatInput & { action: 'set_borders' }
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
    input: SheetsFormatInput & { action: 'clear_format' }
  ): Promise<FormatResponse> {
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
    input: SheetsFormatInput & { action: 'apply_preset' }
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
    input: SheetsFormatInput & { action: 'auto_fit' }
  ): Promise<FormatResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range!);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
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
  // Rules Actions (Conditional Formatting)
  // ============================================================

  private async handleRuleAddConditionalFormat(
    input: SheetsFormatInput & { action: 'rule_add_conditional_format' }
  ): Promise<FormatResponse> {
    const gridRange = await this.resolveGridRange(
      input.spreadsheetId,
      input.sheetId!,
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
    input: SheetsFormatInput & { action: 'rule_update_conditional_format' }
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
      fields: 'sheets.conditionalFormats',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    const currentRule = sheet?.conditionalFormats?.[input.ruleIndex!];

    if (!currentRule) {
      return this.error({
        code: 'RANGE_NOT_FOUND',
        message: `Conditional format rule at index ${input.ruleIndex} not found`,
        retryable: false,
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
    input: SheetsFormatInput & { action: 'rule_delete_conditional_format' }
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
    input: SheetsFormatInput & { action: 'rule_list_conditional_formats' }
  ): Promise<FormatResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.conditionalFormats,sheets.properties.sheetId',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    const allRules = (sheet?.conditionalFormats ?? []).map((rule, index) => ({
      index,
      type: rule.booleanRule ? ('boolean' as const) : ('gradient' as const),
      ranges: (rule.ranges ?? []).map((r) => ({
        sheetId: r.sheetId ?? 0,
        startRowIndex: r.startRowIndex ?? undefined,
        endRowIndex: r.endRowIndex ?? undefined,
        startColumnIndex: r.startColumnIndex ?? undefined,
        endColumnIndex: r.endColumnIndex ?? undefined,
      })),
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
        suggestion: `Found ${totalCount} rules. Showing first ${limit}. Use sheets_spreadsheet to get full rule data if needed.`,
      }),
    });
  }

  // ============================================================
  // Rules Actions (Data Validation)
  // ============================================================

  private async handleRuleAddDataValidation(
    input: SheetsFormatInput & { action: 'rule_add_data_validation' }
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

    return this.success('rule_add_data_validation', {});
  }

  private async handleRuleClearDataValidation(
    input: SheetsFormatInput & { action: 'rule_clear_data_validation' }
  ): Promise<FormatResponse> {
    if (input.safety?.dryRun) {
      return this.success('rule_clear_data_validation', {}, undefined, true);
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

    return this.success('rule_clear_data_validation', {
      snapshotId: snapshot?.snapshotId,
    });
  }

  private async handleRuleListDataValidations(
    input: SheetsFormatInput & { action: 'rule_list_data_validations' }
  ): Promise<FormatResponse> {
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      ranges: [],
      includeGridData: true,
      fields: 'sheets.data.rowData.values.dataValidation,sheets.properties.sheetId',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
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
    sheet?.data?.forEach((data) => {
      data.rowData?.forEach((row, rowIdx) => {
        row.values?.forEach((cell, colIdx) => {
          if (cell.dataValidation?.condition) {
            const condType = cell.dataValidation.condition.type as ConditionType;
            allValidations.push({
              range: {
                sheetId: input.sheetId!,
                startRowIndex: rowIdx,
                endRowIndex: rowIdx + 1,
                startColumnIndex: colIdx,
                endColumnIndex: colIdx + 1,
              },
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

    return this.success('rule_list_data_validations', {
      validations,
      totalCount,
      truncated,
      ...(truncated && {
        suggestion: `Found ${totalCount} validation rules. Showing first ${limit}. Consider using a specific range instead of entire sheet.`,
      }),
    });
  }

  // ============================================================
  // Rules Actions (Preset Rules)
  // ============================================================

  private async handleRuleAddPresetRule(
    input: SheetsFormatInput & { action: 'rule_add_preset_rule' }
  ): Promise<FormatResponse> {
    const gridRange = await this.resolveGridRange(
      input.spreadsheetId,
      input.sheetId!,
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

      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown preset: ${input.rulePreset}`,
          retryable: false,
        });
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: { requests: [request] },
    });

    return this.success('rule_add_preset_rule', { ruleIndex: 0 });
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async a1ToGridRange(spreadsheetId: string, a1: string): Promise<GridRangeInput> {
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };
  }

  private async resolveGridRange(
    spreadsheetId: string,
    sheetId: number,
    range: { a1?: string } | { namedRange?: string } | { semantic?: unknown } | { grid?: unknown }
  ): Promise<GridRangeInput> {
    if ('a1' in range && range.a1) {
      const parsed = parseA1Notation(range.a1);
      return {
        sheetId,
        startRowIndex: parsed.startRow,
        endRowIndex: parsed.endRow,
        startColumnIndex: parsed.startCol,
        endColumnIndex: parsed.endCol,
      };
    }

    if ('grid' in range && range.grid) {
      const grid = range.grid as {
        sheetId: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      return {
        sheetId: grid.sheetId ?? sheetId,
        startRowIndex: grid.startRowIndex,
        endRowIndex: grid.endRowIndex,
        startColumnIndex: grid.startColumnIndex,
        endColumnIndex: grid.endColumnIndex,
      };
    }

    // For named ranges, resolve via API
    if ('namedRange' in range && range.namedRange) {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'namedRanges',
      });

      const namedRange = response.data.namedRanges?.find((nr) => nr.name === range.namedRange);
      if (namedRange?.range) {
        return {
          sheetId: namedRange.range.sheetId ?? sheetId,
          startRowIndex: namedRange.range.startRowIndex ?? 0,
          endRowIndex: namedRange.range.endRowIndex ?? 1000,
          startColumnIndex: namedRange.range.startColumnIndex ?? 0,
          endColumnIndex: namedRange.range.endColumnIndex ?? 26,
        };
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
    range: { a1?: string } | { namedRange?: string } | { semantic?: unknown } | { grid?: unknown }
  ): Promise<GridRangeInput> {
    if ('a1' in range && range.a1) {
      const parsed = parseA1Notation(range.a1);
      const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);
      return {
        sheetId,
        startRowIndex: parsed.startRow,
        endRowIndex: parsed.endRow,
        startColumnIndex: parsed.startCol,
        endColumnIndex: parsed.endCol,
      };
    }

    if ('grid' in range && range.grid) {
      const grid = range.grid as {
        sheetId: number;
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      };
      return {
        sheetId: grid.sheetId,
        startRowIndex: grid.startRowIndex,
        endRowIndex: grid.endRowIndex,
        startColumnIndex: grid.startColumnIndex,
        endColumnIndex: grid.endColumnIndex,
      };
    }

    // For named ranges, resolve via API
    if ('namedRange' in range && range.namedRange) {
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'namedRanges',
      });

      const namedRange = response.data.namedRanges?.find((nr) => nr.name === range.namedRange);
      if (namedRange?.range) {
        return {
          sheetId: namedRange.range.sheetId ?? 0,
          startRowIndex: namedRange.range.startRowIndex ?? 0,
          endRowIndex: namedRange.range.endRowIndex ?? 1000,
          startColumnIndex: namedRange.range.startColumnIndex ?? 0,
          endColumnIndex: namedRange.range.endColumnIndex ?? 26,
        };
      }
    }

    throw new RangeResolutionError(
      'Could not resolve range - ambiguous input',
      'RANGE_RESOLUTION_FAILED',
      { input: range, spreadsheetId },
      false
    );
  }
}
