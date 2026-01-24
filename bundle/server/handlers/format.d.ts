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
import type { SheetsFormatInput, SheetsFormatOutput } from '../schemas/index.js';
export declare class FormatHandler extends BaseHandler<SheetsFormatInput, SheetsFormatOutput> {
    private sheetsApi;
    constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets);
    /**
     * Apply verbosity filtering to optimize token usage (LLM optimization)
     */
    handle(input: SheetsFormatInput): Promise<SheetsFormatOutput>;
    protected createIntents(input: SheetsFormatInput): Intent[];
    /**
     * Execute action and return response (extracted for task/non-task paths)
     */
    private executeAction;
    private handleSetFormat;
    private handleSuggestFormat;
    private handleSetBackground;
    private handleSetTextFormat;
    private handleSetNumberFormat;
    private handleSetAlignment;
    private handleSetBorders;
    private handleClearFormat;
    private handleApplyPreset;
    private handleAutoFit;
    private handleRuleAddConditionalFormat;
    private handleRuleUpdateConditionalFormat;
    private handleRuleDeleteConditionalFormat;
    private handleRuleListConditionalFormats;
    private handleSetDataValidation;
    private handleClearDataValidation;
    private handleListDataValidations;
    private handleAddConditionalFormatRule;
    private a1ToGridRange;
    private resolveGridRange;
    private resolveRangeInput;
}
//# sourceMappingURL=format.d.ts.map