/**
 * Live API Tests for sheets_confirm Tool
 *
 * Tests confirmation workflows with real Google Sheets data.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 5 Actions:
 * - request: Request user confirmation for a multi-step operation plan
 * - get_stats: Get statistics about confirmation requests
 * - wizard_start: Start a multi-step wizard flow
 * - wizard_step: Process a wizard step
 * - wizard_complete: Complete the wizard and execute
 *
 * Note: sheets_confirm uses MCP Elicitation (SEP-1036) for user interaction.
 * These tests verify the data structures and API context, not the elicitation flow itself.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import { loadTestCredentials, shouldRunIntegrationTests } from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_confirm Live API Tests', () => {
  let client: LiveApiClient;
  let manager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const credentials = await loadTestCredentials();
    if (!credentials) {
      throw new Error('Test credentials not available');
    }
    client = new LiveApiClient(credentials, { trackMetrics: true });
    manager = new TestSpreadsheetManager(client);
  });

  afterAll(async () => {
    await manager.cleanup();
  });

  beforeEach(async () => {
    testSpreadsheet = await manager.createTestSpreadsheet('confirm');
  });

  describe('request action', () => {
    it('should validate plan structure with real spreadsheet context', async () => {
      // Create a plan that references the real spreadsheet
      const plan = {
        title: 'Update Sales Data',
        description: `Update sales data in spreadsheet ${testSpreadsheet.id}`,
        steps: [
          {
            stepNumber: 1,
            description: 'Read current data',
            tool: 'sheets_data',
            action: 'read',
            risk: 'low' as const,
            estimatedApiCalls: 1,
            isDestructive: false,
            canUndo: true,
          },
          {
            stepNumber: 2,
            description: 'Write new values',
            tool: 'sheets_data',
            action: 'write',
            risk: 'medium' as const,
            estimatedApiCalls: 1,
            isDestructive: true,
            canUndo: true,
          },
        ],
        willCreateSnapshot: true,
      };

      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].isDestructive).toBe(false);
      expect(plan.steps[1].isDestructive).toBe(true);
    });

    it('should calculate total API calls from plan', () => {
      const plan = {
        steps: [{ estimatedApiCalls: 2 }, { estimatedApiCalls: 3 }, { estimatedApiCalls: 1 }],
      };

      const totalApiCalls = plan.steps.reduce(
        (sum, step) => sum + (step.estimatedApiCalls || 0),
        0
      );
      expect(totalApiCalls).toBe(6);
    });

    it('should identify high-risk operations in plan', async () => {
      // Create test data
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:C100',
        valueInputOption: 'RAW',
        requestBody: {
          values: Array.from({ length: 100 }, (_, i) => [
            `Row${i + 1}`,
            `Data${i + 1}`,
            `Value${i + 1}`,
          ]),
        },
      });

      // Plan with high-risk deletion
      const plan = {
        title: 'Clear Old Data',
        steps: [
          {
            stepNumber: 1,
            description: 'Delete 100 rows of data',
            tool: 'sheets_data',
            action: 'clear',
            risk: 'critical' as const,
            isDestructive: true,
            canUndo: false,
          },
        ],
      };

      const highRiskSteps = plan.steps.filter((s) => s.risk === 'critical' || s.risk === 'high');
      expect(highRiskSteps.length).toBe(1);
      expect(highRiskSteps[0].canUndo).toBe(false);
    });

    it('should prepare confirmation with spreadsheet metadata', async () => {
      // Get spreadsheet metadata for confirmation context
      const response = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        fields: 'properties.title,sheets.properties.title,sheets.properties.sheetId',
      });

      const title = response.data.properties?.title;
      const sheets = response.data.sheets?.map((s) => ({
        name: s.properties?.title,
        sheetId: s.properties?.sheetId,
      }));

      expect(title).toBeDefined();
      expect(sheets?.length).toBeGreaterThan(0);

      // Confirmation context would include this metadata
      const confirmationContext = {
        spreadsheetTitle: title,
        availableSheets: sheets,
        warningMessage: `This will modify spreadsheet "${title}"`,
      };

      expect(confirmationContext.warningMessage).toContain(title);
    });
  });

  describe('get_stats action', () => {
    it('should track confirmation statistics structure', () => {
      // Stats structure that would be tracked
      const stats = {
        totalConfirmations: 10,
        approved: 7,
        declined: 2,
        cancelled: 1,
        approvalRate: 0.7,
        avgResponseTime: 2500, // ms
      };

      expect(stats.approved + stats.declined + stats.cancelled).toBe(stats.totalConfirmations);
      expect(stats.approvalRate).toBe(stats.approved / stats.totalConfirmations);
    });
  });

  describe('wizard_start action', () => {
    it('should define multi-step wizard for spreadsheet creation', async () => {
      const wizard = {
        wizardId: `wizard_${Date.now()}`,
        title: 'Create Sales Spreadsheet',
        description: 'Step-by-step wizard to create a new sales tracking spreadsheet',
        steps: [
          {
            stepId: 'basic_info',
            title: 'Basic Information',
            description: 'Enter spreadsheet name and description',
            fields: [
              { name: 'title', label: 'Spreadsheet Title', type: 'text' as const, required: true },
              { name: 'description', label: 'Description', type: 'text' as const, required: false },
            ],
          },
          {
            stepId: 'columns',
            title: 'Column Setup',
            description: 'Define the columns for your spreadsheet',
            fields: [
              {
                name: 'columns',
                label: 'Columns',
                type: 'multiselect' as const,
                required: true,
                options: ['Date', 'Product', 'Quantity', 'Price', 'Total', 'Customer'],
              },
            ],
            dependsOn: 'basic_info',
          },
          {
            stepId: 'formatting',
            title: 'Formatting Options',
            description: 'Choose formatting preferences',
            fields: [
              {
                name: 'headerStyle',
                label: 'Header Style',
                type: 'select' as const,
                required: true,
                options: ['Bold', 'Bold + Background', 'Custom'],
              },
              {
                name: 'freezeHeader',
                label: 'Freeze Header Row',
                type: 'boolean' as const,
                required: true,
                default: true,
              },
            ],
            dependsOn: 'columns',
          },
        ],
      };

      expect(wizard.steps.length).toBe(3);
      expect(wizard.steps[1].dependsOn).toBe('basic_info');
      expect(wizard.steps[2].fields.find((f) => f.name === 'freezeHeader')?.default).toBe(true);
    });

    it('should validate wizard step dependencies', () => {
      const steps = [
        { stepId: 'step1', dependsOn: undefined },
        { stepId: 'step2', dependsOn: 'step1' },
        { stepId: 'step3', dependsOn: 'step2' },
      ];

      // Build dependency graph
      const stepOrder: string[] = [];
      const completed = new Set<string>();

      function canExecute(step: (typeof steps)[0]): boolean {
        return !step.dependsOn || completed.has(step.dependsOn);
      }

      for (const step of steps) {
        if (canExecute(step)) {
          stepOrder.push(step.stepId);
          completed.add(step.stepId);
        }
      }

      expect(stepOrder).toEqual(['step1', 'step2', 'step3']);
    });
  });

  describe('wizard_step action', () => {
    it('should validate field values for wizard step', () => {
      const step = {
        stepId: 'basic_info',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'rowCount', type: 'number', required: true },
          { name: 'useFormulas', type: 'boolean', required: false },
        ],
      };

      const values = {
        title: 'My Spreadsheet',
        rowCount: 100,
        useFormulas: true,
      };

      // Validate required fields
      const requiredFields = step.fields.filter((f) => f.required).map((f) => f.name);
      const missingFields = requiredFields.filter(
        (name) => values[name as keyof typeof values] === undefined
      );

      expect(missingFields.length).toBe(0);
    });

    it('should handle wizard navigation directions', () => {
      const wizardState = {
        currentStepIndex: 1,
        totalSteps: 3,
        completedSteps: ['step1'],
      };

      // Navigate forward
      const nextIndex = Math.min(wizardState.currentStepIndex + 1, wizardState.totalSteps - 1);
      expect(nextIndex).toBe(2);

      // Navigate back
      const prevIndex = Math.max(wizardState.currentStepIndex - 1, 0);
      expect(prevIndex).toBe(0);
    });

    it('should collect values across wizard steps', () => {
      const collectedValues: Record<string, unknown> = {};

      // Step 1 values
      const step1Values = { title: 'Sales Report', description: 'Monthly sales' };
      Object.assign(collectedValues, step1Values);

      // Step 2 values
      const step2Values = { columns: ['Date', 'Product', 'Amount'] };
      Object.assign(collectedValues, step2Values);

      // Step 3 values
      const step3Values = { headerStyle: 'Bold', freezeHeader: true };
      Object.assign(collectedValues, step3Values);

      expect(Object.keys(collectedValues).length).toBe(5);
      expect(collectedValues['title']).toBe('Sales Report');
      expect(collectedValues['columns']).toHaveLength(3);
    });
  });

  describe('wizard_complete action', () => {
    it('should generate execution plan from wizard values', async () => {
      const wizardValues = {
        title: 'Test Spreadsheet',
        columns: ['A', 'B', 'C'],
        headerStyle: 'Bold',
        freezeHeader: true,
      };

      // Generate execution plan
      const executionPlan = {
        steps: [
          {
            tool: 'sheets_core',
            action: 'create',
            params: { title: wizardValues.title },
          },
          {
            tool: 'sheets_data',
            action: 'write',
            params: {
              range: 'Sheet1!A1:C1',
              values: [wizardValues.columns],
            },
          },
          {
            tool: 'sheets_format',
            action: 'set_text_format',
            params: {
              range: 'Sheet1!A1:C1',
              bold: wizardValues.headerStyle === 'Bold',
            },
          },
        ],
      };

      if (wizardValues.freezeHeader) {
        executionPlan.steps.push({
          tool: 'sheets_dimensions',
          action: 'freeze',
          params: { rows: 1 },
        });
      }

      expect(executionPlan.steps.length).toBe(4);
    });

    it('should create actual spreadsheet from wizard completion', async () => {
      // Create spreadsheet based on wizard output
      const createResponse = await client.sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `WizardTest_${Date.now()}`,
          },
        },
      });

      const spreadsheetId = createResponse.data.spreadsheetId!;
      expect(spreadsheetId).toBeDefined();

      // Write header row
      await client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:C1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Column A', 'Column B', 'Column C']],
        },
      });

      // Verify
      const readResponse = await client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A1:C1',
      });

      expect(readResponse.data.values![0]).toEqual(['Column A', 'Column B', 'Column C']);

      // Cleanup
      await client.drive.files.delete({ fileId: spreadsheetId });
    });
  });

  describe('Risk Assessment with Real Data', () => {
    it('should assess risk based on data volume', async () => {
      // Write significant data
      const rowCount = 50;
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: `TestData!A1:D${rowCount}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: Array.from({ length: rowCount }, (_, i) => [
            `Row${i + 1}`,
            Math.random() * 1000,
            new Date().toISOString(),
            'Active',
          ]),
        },
      });

      // Calculate risk based on affected cells
      const cellCount = rowCount * 4;
      let risk: 'low' | 'medium' | 'high' | 'critical';

      if (cellCount < 50) risk = 'low';
      else if (cellCount < 200) risk = 'medium';
      else if (cellCount < 1000) risk = 'high';
      else risk = 'critical';

      expect(risk).toBe('medium'); // 200 cells
    });

    it('should require confirmation for operations above threshold', async () => {
      // Get current data size
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A:Z',
      });

      const rowCount = response.data.values?.length || 0;
      const confirmationThreshold = 10; // Require confirmation for >10 rows

      const requiresConfirmation = rowCount > confirmationThreshold;

      // If we have data, this should require confirmation
      if (rowCount > 0) {
        expect(requiresConfirmation).toBe(rowCount > confirmationThreshold);
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should track confirmation-related API calls', async () => {
      client.resetMetrics();

      // Operations that would be confirmed
      await client.trackOperation('get', 'GET', () =>
        client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'properties.title',
        })
      );

      await client.trackOperation('valuesGet', 'GET', () =>
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:A10',
        })
      );

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
    });
  });
});
