import { logger } from '../../utils/logger.js';

export interface RecommendationRule {
  id: string;
  name: string;
  description: string;
  trigger: (context: any) => boolean;
  recommendation: (context: any) => string;
  action?: {
    tool: string;
    action: string;
  };
}

/**
 * Action Recommendation Rules
 *
 * Rules for suggesting next actions based on sheet context and user patterns.
 */

export class ActionRecommender {
  private rules: RecommendationRule[] = [
    {
      id: 'add_summary_row',
      name: 'Add Summary Row',
      description: 'Data rows detected without totals',
      trigger: (ctx) => ctx.hasNumericData && !ctx.hasSummaryRow,
      recommendation: (ctx) => `Add SUM formulas to row ${ctx.lastDataRow + 2}`,
      action: {
        tool: 'sheets_data',
        action: 'write',
      },
    },
    {
      id: 'freeze_header',
      name: 'Freeze Header Row',
      description: 'Improve readability by freezing column headers',
      trigger: (ctx) => !ctx.headersFrozen && ctx.hasHeaders,
      recommendation: () => 'Freeze the header row for easier scrolling',
      action: {
        tool: 'sheets_dimensions',
        action: 'freeze',
      },
    },
    {
      id: 'add_formatting',
      name: 'Add Professional Formatting',
      description: 'Apply formatting to improve readability',
      trigger: (ctx) => ctx.dataRows > 10 && !ctx.hasFormatting,
      recommendation: () => 'Apply header formatting and alternating row colors',
      action: {
        tool: 'sheets_format',
        action: 'apply_preset',
      },
    },
  ];

  recommendActions(context: any): RecommendationRule[] {
    return this.rules.filter((rule) => {
      try {
        return rule.trigger(context);
      } catch (error) {
        logger.error(`Rule ${rule.id} trigger failed`, { error });
        return false;
      }
    });
  }
}
