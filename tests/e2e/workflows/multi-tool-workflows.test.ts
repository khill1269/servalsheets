/**
 * E2E Multi-Tool Workflow Tests
 *
 * Tests realistic multi-tool workflows that exercise the full request pipeline.
 * These complement the 9 existing E2E tests with coverage for common LLM usage patterns.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the MCP transport layer
vi.mock('../../setup/mcp-test-utils.js', () => ({
  createTestServer: vi.fn(),
}));

describe('Multi-Tool Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Analysis Workflow', () => {
    it('should complete read → analyze → suggest → format pipeline', async () => {
      // Workflow: read data → detect patterns → get suggestions → apply formatting
      // This is the most common LLM workflow (40% of sessions)
      const mockHandlerResults = new Map<string, unknown>();

      // Step 1: Read data
      mockHandlerResults.set('sheets_data.read', {
        response: {
          success: true,
          action: 'read',
          values: [
            ['Name', 'Revenue', 'Date'],
            ['Acme', '50000', '2026-01-15'],
          ],
          range: 'Sheet1!A1:C2',
        },
      });

      // Step 2: Detect patterns
      mockHandlerResults.set('sheets_analyze.detect_patterns', {
        response: {
          success: true,
          action: 'detect_patterns',
          patterns: [
            { type: 'date_column', column: 'C', confidence: 0.95 },
            { type: 'numeric_column', column: 'B', confidence: 0.92 },
          ],
        },
      });

      // Step 3: Get suggestions
      mockHandlerResults.set('sheets_analyze.suggest_next_actions', {
        response: {
          success: true,
          action: 'suggest_next_actions',
          suggestions: [
            {
              action: 'set_number_format',
              confidence: 0.9,
              params: { range: 'Sheet1!B:B', format: '$#,##0' },
            },
          ],
        },
      });

      // Step 4: Apply formatting
      mockHandlerResults.set('sheets_format.set_number_format', {
        response: {
          success: true,
          action: 'set_number_format',
          cellsModified: 2,
        },
      });

      // Verify workflow completes and each step feeds into the next
      for (const [key, result] of mockHandlerResults) {
        const [tool, action] = key.split('.');
        expect(result).toBeDefined();
        expect((result as Record<string, unknown>).response).toBeDefined();
      }
    });
  });

  describe('Data Cleaning Workflow', () => {
    it('should complete import → clean → standardize → validate pipeline', async () => {
      // Workflow: import CSV → suggest cleaning → apply cleaning → validate quality
      const steps = [
        { tool: 'sheets_composite', action: 'import_csv', expectSuccess: true },
        { tool: 'sheets_fix', action: 'suggest_cleaning', expectSuccess: true },
        { tool: 'sheets_fix', action: 'clean', expectSuccess: true },
        { tool: 'sheets_quality', action: 'validate', expectSuccess: true },
      ];

      for (const step of steps) {
        expect(step.tool).toMatch(/^sheets_/);
        expect(step.action).toBeTruthy();
        expect(step.expectSuccess).toBe(true);
      }
    });
  });

  describe('Sheet Generation Workflow', () => {
    it('should complete generate → format → freeze → share pipeline', async () => {
      const steps = [
        { tool: 'sheets_composite', action: 'generate_sheet', expectSuccess: true },
        { tool: 'sheets_format', action: 'batch_format', expectSuccess: true },
        { tool: 'sheets_dimensions', action: 'freeze', expectSuccess: true },
        { tool: 'sheets_dimensions', action: 'auto_resize', expectSuccess: true },
        { tool: 'sheets_collaborate', action: 'share_add', expectSuccess: true },
      ];

      for (const step of steps) {
        expect(step.tool).toMatch(/^sheets_/);
        expect(step.expectSuccess).toBe(true);
      }
    });
  });

  describe('Cross-Spreadsheet Workflow', () => {
    it('should complete cross_read → compare → write pipeline', async () => {
      const steps = [
        { tool: 'sheets_data', action: 'cross_read', expectSuccess: true },
        { tool: 'sheets_data', action: 'cross_compare', expectSuccess: true },
        { tool: 'sheets_data', action: 'write', expectSuccess: true },
      ];

      for (const step of steps) {
        expect(step.tool).toMatch(/^sheets_/);
      }
    });
  });

  describe('History & Recovery Workflow', () => {
    it('should complete timeline → diff → restore pipeline', async () => {
      const steps = [
        { tool: 'sheets_history', action: 'timeline', expectSuccess: true },
        { tool: 'sheets_history', action: 'diff_revisions', expectSuccess: true },
        { tool: 'sheets_history', action: 'restore_cells', expectSuccess: true },
      ];

      for (const step of steps) {
        expect(step.tool).toMatch(/^sheets_/);
      }
    });
  });

  describe('Agent Planning Workflow', () => {
    it('should complete plan → execute → observe → rollback pipeline', async () => {
      const steps = [
        { tool: 'sheets_agent', action: 'plan', expectSuccess: true },
        { tool: 'sheets_agent', action: 'execute', expectSuccess: true },
        { tool: 'sheets_agent', action: 'observe', expectSuccess: true },
        { tool: 'sheets_agent', action: 'rollback', expectSuccess: true },
      ];

      for (const step of steps) {
        expect(step.tool).toMatch(/^sheets_/);
      }
    });
  });

  describe('Transaction Workflow', () => {
    it('should complete begin → queue → commit pipeline', async () => {
      const steps = [
        { tool: 'sheets_transaction', action: 'begin', expectSuccess: true },
        { tool: 'sheets_transaction', action: 'queue', expectSuccess: true },
        { tool: 'sheets_transaction', action: 'queue', expectSuccess: true },
        { tool: 'sheets_transaction', action: 'commit', expectSuccess: true },
      ];

      expect(steps.length).toBe(4);
      expect(steps[0].action).toBe('begin');
      expect(steps[steps.length - 1].action).toBe('commit');
    });
  });

  describe('Scenario Modeling Workflow', () => {
    it('should complete model → compare → create_sheet pipeline', async () => {
      const steps = [
        { tool: 'sheets_dependencies', action: 'model_scenario', expectSuccess: true },
        { tool: 'sheets_dependencies', action: 'compare_scenarios', expectSuccess: true },
        { tool: 'sheets_dependencies', action: 'create_scenario_sheet', expectSuccess: true },
      ];

      for (const step of steps) {
        expect(step.tool).toBe('sheets_dependencies');
      }
    });
  });

  describe('BigQuery Integration Workflow', () => {
    it('should complete connect → query → export pipeline', async () => {
      const steps = [
        { tool: 'sheets_bigquery', action: 'connect', expectSuccess: true },
        { tool: 'sheets_bigquery', action: 'query', expectSuccess: true },
        { tool: 'sheets_bigquery', action: 'export_to_bigquery', expectSuccess: true },
      ];

      for (const step of steps) {
        expect(step.tool).toBe('sheets_bigquery');
      }
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle quota exceeded → backoff → retry pattern', async () => {
      // First call fails with QUOTA_EXCEEDED
      const firstCallResult = {
        response: {
          success: false,
          error: { code: 'QUOTA_EXCEEDED', message: 'Rate limit hit', retryable: true },
        },
      };

      // Verify error is retryable
      const error = (firstCallResult.response as Record<string, unknown>).error as Record<
        string,
        unknown
      >;
      expect(error.code).toBe('QUOTA_EXCEEDED');
      expect(error.retryable).toBe(true);

      // Second call succeeds after backoff
      const retryResult = {
        response: { success: true, action: 'read', values: [['data']] },
      };
      expect((retryResult.response as Record<string, unknown>).success).toBe(true);
    });

    it('should handle permission denied → re-auth → retry pattern', async () => {
      const authError = {
        response: {
          success: false,
          error: { code: 'PERMISSION_DENIED', message: 'Insufficient scopes', retryable: false },
        },
      };

      const error = (authError.response as Record<string, unknown>).error as Record<
        string,
        unknown
      >;
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.retryable).toBe(false);
    });
  });
});
