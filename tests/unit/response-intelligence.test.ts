import { describe, expect, it } from 'vitest';
import { applyResponseIntelligence } from '../../src/mcp/registration/response-intelligence.js';

describe('applyResponseIntelligence', () => {
  it('adds suggested fixes for failure responses', () => {
    const responseRecord: Record<string, unknown> = {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'User does not have access',
      },
    };

    applyResponseIntelligence(responseRecord, {
      toolName: 'sheets_data',
      hasFailure: true,
    });

    expect(responseRecord['error']).toEqual(
      expect.objectContaining({
        suggestedFix: expect.objectContaining({
          tool: 'sheets_auth',
          action: 'login',
        }),
      })
    );
  });

  it('adds data-aware suggestions and quality warnings from nested values', () => {
    const responseRecord: Record<string, unknown> = {
      success: true,
      action: 'read',
      range: 'Sheet1!A1:D5',
      data: {
        values: [
          ['Date', 'Amount', 'Lookup', 'Notes'],
          ['2026-01-03', 100, '=VLOOKUP(A2,Lookup!A:B,2,FALSE)', null],
          ['2026-01-01', 200, '=VLOOKUP(A3,Lookup!A:B,2,FALSE)', 'ok'],
          ['2026-01-02', '', '=VLOOKUP(A4,Lookup!A:B,2,FALSE)', null],
          ['2026-01-04', 150, '=VLOOKUP(A5,Lookup!A:B,2,FALSE)', null],
        ],
      },
      confidence: {
        gaps: ['Missing column type info'],
      },
    };

    applyResponseIntelligence(responseRecord, {
      toolName: 'sheets_data',
      hasFailure: false,
    });

    expect(responseRecord['suggestedNextActions']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: 'sheets_visualize', action: 'suggest_chart' }),
        expect.objectContaining({ tool: 'sheets_analyze', action: 'analyze_formulas' }),
        expect.objectContaining({ tool: 'sheets_dimensions', action: 'sort_range' }),
        expect.objectContaining({ tool: 'sheets_fix', action: 'fill_missing' }),
        expect.objectContaining({ tool: 'sheets_analyze', action: 'analyze_data' }),
      ])
    );
    expect(responseRecord['dataQualityWarnings']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'empty_required_cells',
          column: 'Notes',
        }),
      ])
    );
  });

  it('does not inject recommendations when the action is missing', () => {
    const responseRecord: Record<string, unknown> = {
      success: true,
      values: [['A'], ['B']],
    };

    applyResponseIntelligence(responseRecord, {
      toolName: 'sheets_data',
      hasFailure: false,
    });

    expect(responseRecord['suggestedNextActions']).toBeUndefined();
    expect(responseRecord['dataQualityWarnings']).toBeUndefined();
  });
});
