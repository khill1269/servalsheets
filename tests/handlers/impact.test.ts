/**
 * ServalSheets - Impact Handler Tests
 *
 * Tests for pre-execution impact analysis operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImpactHandler } from '../../src/handlers/impact.js';
import { SheetsImpactOutputSchema } from '../../src/schemas/impact.js';
import type { ImpactAnalysis } from '../../src/types/impact.js';

// Create mock impact analyzer
const mockImpactAnalyzer = {
  analyzeOperation: vi.fn(),
  getStats: vi.fn(),
  resetStats: vi.fn(),
};

// Mock getImpactAnalyzer function
vi.mock('../../src/services/impact-analyzer.js', () => ({
  getImpactAnalyzer: vi.fn(() => mockImpactAnalyzer),
}));

describe('ImpactHandler', () => {
  let handler: ImpactHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new ImpactHandler();
  });

  describe('analyze action - low severity', () => {
    it('should analyze impact of a small operation', async () => {
      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-1',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:B2' },
        },
        cellsAffected: 4,
        rowsAffected: 2,
        columnsAffected: 2,
        formulasAffected: [],
        chartsAffected: [],
        pivotTablesAffected: [],
        validationRulesAffected: [],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [],
        protectedRangesAffected: [],
        estimatedExecutionTime: 150,
        severity: 'low',
        warnings: [],
        recommendations: [],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:B2' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.action).toBe('analyze');
        expect(result.response.impact.severity).toBe('low');
        expect(result.response.impact.scope.cells).toBe(4);
        expect(result.response.impact.scope.rows).toBe(2);
        expect(result.response.impact.scope.columns).toBe(2);
        expect(result.response.impact.canProceed).toBe(true);
        expect(result.response.impact.requiresConfirmation).toBe(false);
      }

      const parseResult = SheetsImpactOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });
  });

  describe('analyze action - medium severity', () => {
    it('should analyze impact with affected formulas', async () => {
      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-2',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:A100' },
        },
        cellsAffected: 100,
        rowsAffected: 100,
        columnsAffected: 1,
        formulasAffected: [
          {
            cell: 'B1',
            sheetName: 'Sheet1',
            formula: '=SUM(A1:A100)',
            impactType: 'references_affected_range',
            description: 'Formula references cells in the affected range A1:A100',
          },
          {
            cell: 'B2',
            sheetName: 'Sheet1',
            formula: '=AVERAGE(A1:A100)',
            impactType: 'references_affected_range',
            description: 'Formula references cells in the affected range A1:A100',
          },
        ],
        chartsAffected: [],
        pivotTablesAffected: [],
        validationRulesAffected: [],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [],
        protectedRangesAffected: [],
        estimatedExecutionTime: 250,
        severity: 'medium',
        warnings: [
          {
            severity: 'medium',
            message: '2 formula(s) reference this range and may be affected',
            resourceType: 'formulas',
            affectedCount: 2,
            suggestedAction: 'Review formulas before proceeding',
          },
        ],
        recommendations: ['Verify formula references after operation'],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:A100' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.impact.severity).toBe('medium');
        expect(result.response.impact.affectedResources.formulas).toHaveLength(2);
        expect(result.response.impact.affectedResources.formulas).toContain('B1');
        expect(result.response.impact.affectedResources.formulas).toContain('B2');
        expect(result.response.impact.warnings).toHaveLength(1);
        expect(result.response.impact.warnings[0].severity).toBe('medium');
        expect(result.response.impact.recommendations).toHaveLength(1);
        expect(result.response.impact.canProceed).toBe(true);
        expect(result.response.impact.requiresConfirmation).toBe(false);
      }
    });

    it('should analyze impact with affected charts', async () => {
      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-3',
        operation: {
          type: 'values_clear',
          tool: 'sheets_values',
          action: 'clear',
          params: { range: 'A1:D100' },
        },
        cellsAffected: 400,
        rowsAffected: 100,
        columnsAffected: 4,
        formulasAffected: [],
        chartsAffected: [
          {
            chartId: 123,
            title: 'Sales Chart',
            sheetName: 'Sheet1',
            chartType: 'COLUMN',
            dataRanges: ['Sheet1!A1:D100'],
            impactType: 'data_source_affected',
            description: 'Chart uses data from the affected range A1:D100',
          },
        ],
        pivotTablesAffected: [],
        validationRulesAffected: [],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [],
        protectedRangesAffected: [],
        estimatedExecutionTime: 300,
        severity: 'medium',
        warnings: [
          {
            severity: 'medium',
            message: '1 chart(s) use data from this range',
            resourceType: 'charts',
            affectedCount: 1,
            suggestedAction: 'Charts may need to be updated',
          },
        ],
        recommendations: ['Refresh charts after operation'],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_clear',
          tool: 'sheets_values',
          action: 'clear',
          params: { range: 'A1:D100' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.impact.severity).toBe('medium');
        expect(result.response.impact.affectedResources.charts).toHaveLength(1);
        expect(result.response.impact.affectedResources.charts).toContain('Sales Chart');
        expect(result.response.impact.warnings[0].message).toContain('chart');
      }
    });
  });

  describe('analyze action - high severity', () => {
    it('should analyze impact with many affected formulas', async () => {
      const formulasAffected = Array.from({ length: 15 }, (_, i) => ({
        cell: `B${i + 1}`,
        sheetName: 'Sheet1',
        formula: `=SUM(A${i + 1})`,
        impactType: 'references_affected_range' as const,
        description: `Formula references cells in the affected range`,
      }));

      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-4',
        operation: {
          type: 'sheet_delete',
          tool: 'sheets_sheet',
          action: 'delete',
          params: { sheetName: 'Data' },
        },
        cellsAffected: 5000,
        rowsAffected: 100,
        columnsAffected: 50,
        formulasAffected,
        chartsAffected: [
          {
            chartId: 456,
            title: 'Revenue Chart',
            sheetName: 'Dashboard',
            chartType: 'LINE',
            dataRanges: ['Data!A1:Z100'],
            impactType: 'data_source_affected',
            description: 'Chart uses data from the affected range',
          },
          {
            chartId: 457,
            title: 'Profit Chart',
            sheetName: 'Dashboard',
            chartType: 'BAR',
            dataRanges: ['Data!A1:Z100'],
            impactType: 'will_break',
            description: 'Chart will break when source data is deleted',
          },
          {
            chartId: 458,
            title: 'Summary Chart',
            sheetName: 'Dashboard',
            chartType: 'PIE',
            dataRanges: ['Data!A1:Z100'],
            impactType: 'will_break',
            description: 'Chart will break when source data is deleted',
          },
          {
            chartId: 459,
            title: 'Comparison Chart',
            sheetName: 'Dashboard',
            chartType: 'COLUMN',
            dataRanges: ['Data!A1:Z100'],
            impactType: 'will_break',
            description: 'Chart will break when source data is deleted',
          },
        ],
        pivotTablesAffected: [],
        validationRulesAffected: [],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [],
        protectedRangesAffected: [],
        estimatedExecutionTime: 1500,
        severity: 'high',
        warnings: [
          {
            severity: 'high',
            message: '15 formula(s) reference this range and may be affected',
            resourceType: 'formulas',
            affectedCount: 15,
            suggestedAction: 'Review formulas before proceeding',
          },
          {
            severity: 'high',
            message: '4 chart(s) use data from this range',
            resourceType: 'charts',
            affectedCount: 4,
            suggestedAction: 'Charts may need to be updated',
          },
        ],
        recommendations: [
          'Review all warnings carefully before proceeding',
          'Verify formula references after operation',
          'Refresh charts after operation',
        ],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'sheet_delete',
          tool: 'sheets_sheet',
          action: 'delete',
          params: { sheetName: 'Data' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.impact.severity).toBe('high');
        expect(result.response.impact.affectedResources.formulas).toHaveLength(15);
        expect(result.response.impact.affectedResources.charts).toHaveLength(4);
        expect(result.response.impact.warnings).toHaveLength(2);
        expect(result.response.impact.recommendations).toHaveLength(3);
        expect(result.response.impact.canProceed).toBe(true);
        expect(result.response.impact.requiresConfirmation).toBe(true);
      }
    });

    it('should analyze impact with pivot tables', async () => {
      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-5',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:Z1000' },
        },
        cellsAffected: 26000,
        rowsAffected: 1000,
        columnsAffected: 26,
        formulasAffected: [],
        chartsAffected: [],
        pivotTablesAffected: [
          {
            pivotTableId: 789,
            sheetName: 'PivotSheet',
            sourceRange: 'A1:Z1000',
            impactType: 'source_data_affected',
            description: 'Pivot table source data will be modified. The pivot table may need to be refreshed.',
          },
        ],
        validationRulesAffected: [],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [],
        protectedRangesAffected: [],
        estimatedExecutionTime: 2500,
        severity: 'high',
        warnings: [
          {
            severity: 'medium',
            message: 'This operation affects 26,000 cells',
            resourceType: 'cells',
            affectedCount: 26000,
          },
        ],
        recommendations: [
          'Use a transaction to ensure atomicity',
          'Consider breaking into smaller batches',
        ],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:Z1000' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.impact.severity).toBe('high');
        expect(result.response.impact.affectedResources.pivotTables).toHaveLength(1);
        expect(result.response.impact.affectedResources.pivotTables[0]).toContain('PivotTable 789');
        expect(result.response.impact.requiresConfirmation).toBe(true);
      }
    });
  });

  describe('analyze action - critical severity', () => {
    it('should analyze impact with protected ranges', async () => {
      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-6',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:A10' },
        },
        cellsAffected: 10,
        rowsAffected: 10,
        columnsAffected: 1,
        formulasAffected: [],
        chartsAffected: [],
        pivotTablesAffected: [],
        validationRulesAffected: [],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [],
        protectedRangesAffected: [
          {
            protectedRangeId: 999,
            range: 'A1:A10',
            description: 'Protected header row',
            impactType: 'permission_required',
            editors: ['user@example.com'],
          },
        ],
        estimatedExecutionTime: 200,
        severity: 'critical',
        warnings: [
          {
            severity: 'critical',
            message: 'This range is protected. Edit permissions required.',
            resourceType: 'protected_ranges',
            affectedCount: 1,
            suggestedAction: 'Request edit permissions from sheet owner',
          },
        ],
        recommendations: [
          'Review all warnings carefully before proceeding',
          'Consider creating a backup snapshot',
        ],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:A10' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.impact.severity).toBe('critical');
        expect(result.response.impact.affectedResources.protectedRanges).toHaveLength(1);
        expect(result.response.impact.affectedResources.protectedRanges[0]).toBe('A1:A10');
        expect(result.response.impact.canProceed).toBe(false);
        expect(result.response.impact.requiresConfirmation).toBe(true);
        expect(result.response.impact.warnings[0].severity).toBe('critical');
        expect(result.response.impact.warnings[0].message).toContain('protected');
      }
    });

    it('should analyze impact with very large cell count', async () => {
      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-7',
        operation: {
          type: 'sheet_clear',
          tool: 'sheets_sheet',
          action: 'clear',
          params: { sheetName: 'LargeSheet' },
        },
        cellsAffected: 50000,
        rowsAffected: 1000,
        columnsAffected: 50,
        formulasAffected: [],
        chartsAffected: [],
        pivotTablesAffected: [],
        validationRulesAffected: [],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [],
        protectedRangesAffected: [],
        estimatedExecutionTime: 10000,
        severity: 'critical',
        warnings: [
          {
            severity: 'critical',
            message: 'This operation affects 50,000 cells, which may take significant time',
            resourceType: 'cells',
            affectedCount: 50000,
            suggestedAction: 'Consider breaking into smaller operations',
          },
        ],
        recommendations: [
          'Review all warnings carefully before proceeding',
          'Consider creating a backup snapshot',
          'Use a transaction to ensure atomicity',
          'Consider breaking into smaller batches',
        ],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'sheet_clear',
          tool: 'sheets_sheet',
          action: 'clear',
          params: { sheetName: 'LargeSheet' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.impact.severity).toBe('critical');
        expect(result.response.impact.scope.cells).toBe(50000);
        expect(result.response.impact.estimatedExecutionTime).toBe(10000);
        expect(result.response.impact.canProceed).toBe(false);
        expect(result.response.impact.requiresConfirmation).toBe(true);
        expect(result.response.impact.warnings).toHaveLength(1);
        expect(result.response.impact.warnings[0].severity).toBe('critical');
        expect(result.response.impact.warnings[0].message).toContain('50,000 cells');
        expect(result.response.impact.recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('analyze action - multiple affected resources', () => {
    it('should analyze complex operation affecting multiple resource types', async () => {
      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-8',
        operation: {
          type: 'sheet_modify',
          tool: 'sheets_sheet',
          action: 'modify',
          params: { range: 'A1:Z100' },
        },
        cellsAffected: 2600,
        rowsAffected: 100,
        columnsAffected: 26,
        formulasAffected: [
          {
            cell: 'AA1',
            sheetName: 'Sheet1',
            formula: '=SUM(A1:Z100)',
            impactType: 'references_affected_range',
            description: 'Formula references cells in the affected range',
          },
        ],
        chartsAffected: [
          {
            chartId: 111,
            title: 'Data Chart',
            sheetName: 'Sheet1',
            chartType: 'LINE',
            dataRanges: ['Sheet1!A1:Z100'],
            impactType: 'data_source_affected',
            description: 'Chart uses data from the affected range',
          },
        ],
        pivotTablesAffected: [],
        validationRulesAffected: [
          {
            ruleId: 'val-1',
            range: 'A1:A100',
            ruleType: 'NUMBER_BETWEEN',
            impactType: 'may_conflict',
            description: 'Data validation rule may be affected',
          },
        ],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [
          {
            namedRangeId: 'named-1',
            name: 'DataRange',
            range: 'A1:Z100',
            impactType: 'will_be_affected',
            description: 'Named range "DataRange" overlaps with affected range',
          },
        ],
        protectedRangesAffected: [],
        estimatedExecutionTime: 800,
        severity: 'medium',
        warnings: [
          {
            severity: 'medium',
            message: 'This operation affects 2,600 cells',
            resourceType: 'cells',
            affectedCount: 2600,
          },
          {
            severity: 'medium',
            message: '1 formula(s) reference this range and may be affected',
            resourceType: 'formulas',
            affectedCount: 1,
            suggestedAction: 'Review formulas before proceeding',
          },
          {
            severity: 'medium',
            message: '1 chart(s) use data from this range',
            resourceType: 'charts',
            affectedCount: 1,
            suggestedAction: 'Charts may need to be updated',
          },
        ],
        recommendations: [
          'Verify formula references after operation',
          'Refresh charts after operation',
        ],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'sheet_modify',
          tool: 'sheets_sheet',
          action: 'modify',
          params: { range: 'A1:Z100' },
        },
      });

      expect(result.response.success).toBe(true);
      if (result.response.success) {
        expect(result.response.impact.severity).toBe('medium');
        expect(result.response.impact.affectedResources.formulas).toHaveLength(1);
        expect(result.response.impact.affectedResources.charts).toHaveLength(1);
        expect(result.response.impact.affectedResources.validationRules).toHaveLength(1);
        expect(result.response.impact.affectedResources.namedRanges).toHaveLength(1);
        expect(result.response.impact.affectedResources.namedRanges[0]).toBe('DataRange');
        expect(result.response.impact.warnings).toHaveLength(3);
      }
    });
  });

  describe('error handling', () => {
    it('should handle analyzer errors gracefully', async () => {
      mockImpactAnalyzer.analyzeOperation = vi.fn().mockRejectedValue(
        new Error('Failed to fetch spreadsheet metadata')
      );

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:B2' },
        },
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INTERNAL_ERROR');
        expect(result.response.error.message).toContain('Failed to fetch spreadsheet metadata');
        expect(result.response.error.retryable).toBe(false);
      }

      const parseResult = SheetsImpactOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);
    });

    it('should handle unknown errors', async () => {
      mockImpactAnalyzer.analyzeOperation = vi.fn().mockRejectedValue('Unknown error string');

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:B2' },
        },
      });

      expect(result.response.success).toBe(false);
      if (!result.response.success) {
        expect(result.response.error.code).toBe('INTERNAL_ERROR');
        expect(result.response.error.message).toBe('Unknown error string');
      }
    });
  });

  describe('schema validation', () => {
    it('should produce schema-compliant output for successful analysis', async () => {
      const mockAnalysis: ImpactAnalysis = {
        id: 'test-analysis-9',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:B2' },
        },
        cellsAffected: 4,
        rowsAffected: 2,
        columnsAffected: 2,
        formulasAffected: [],
        chartsAffected: [],
        pivotTablesAffected: [],
        validationRulesAffected: [],
        conditionalFormatsAffected: 0,
        namedRangesAffected: [],
        protectedRangesAffected: [],
        estimatedExecutionTime: 150,
        severity: 'low',
        warnings: [],
        recommendations: [],
        timestamp: Date.now(),
      };

      mockImpactAnalyzer.analyzeOperation = vi.fn().mockResolvedValue(mockAnalysis);

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:B2' },
        },
      });

      const parseResult = SheetsImpactOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);

      if (parseResult.success) {
        expect(parseResult.data).toHaveProperty('response');
        expect(parseResult.data.response).toHaveProperty('success');
      }
    });

    it('should produce schema-compliant output for errors', async () => {
      mockImpactAnalyzer.analyzeOperation = vi.fn().mockRejectedValue(
        new Error('Test error')
      );

      const result = await handler.handle({
        action: 'analyze',
        spreadsheetId: 'test-sheet-id',
        operation: {
          type: 'values_write',
          tool: 'sheets_values',
          action: 'write',
          params: { range: 'A1:B2' },
        },
      });

      const parseResult = SheetsImpactOutputSchema.safeParse(result);
      expect(parseResult.success).toBe(true);

      if (parseResult.success && !parseResult.data.response.success) {
        expect(parseResult.data.response.error).toHaveProperty('code');
        expect(parseResult.data.response.error).toHaveProperty('message');
        expect(parseResult.data.response.error).toHaveProperty('retryable');
      }
    });
  });
});
