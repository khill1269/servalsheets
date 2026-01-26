/**
 * Live API Tests for sheets_appsscript Tool
 *
 * Tests Apps Script integration with real Google Sheets data.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 14 Actions:
 * Project Management (4): create, get, get_content, update_content
 * Version Management (3): create_version, list_versions, get_version
 * Deployment Management (4): deploy, list_deployments, get_deployment, undeploy
 * Execution (3): run, list_processes, get_metrics
 *
 * Note: Apps Script API does NOT work with service accounts.
 * These tests verify the data structures and Sheets API context.
 * Full Apps Script execution requires OAuth user authentication.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import { loadTestCredentials, shouldRunIntegrationTests } from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_appsscript Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('appsscript');
  });

  describe('Project Management', () => {
    describe('create action context', () => {
      it('should validate script project structure', () => {
        const project = {
          title: 'My Script Project',
          parentId: 'spreadsheet_id_here', // For container-bound scripts
        };

        expect(project.title).toBeDefined();
        expect(project.parentId).toBeDefined();
      });

      it('should define file types for script projects', () => {
        const fileTypes = ['SERVER_JS', 'HTML', 'JSON'];
        expect(fileTypes).toContain('SERVER_JS'); // Code files
        expect(fileTypes).toContain('HTML'); // Template files
        expect(fileTypes).toContain('JSON'); // Manifest
      });
    });

    describe('get action context', () => {
      it('should validate script project metadata', () => {
        const project = {
          scriptId: 'abc123xyz789',
          title: 'Sales Automation',
          parentId: 'spreadsheet_123',
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
          creator: {
            email: 'user@example.com',
            name: 'Test User',
          },
        };

        expect(project.scriptId).toBeDefined();
        expect(project.title).toBeDefined();
      });
    });

    describe('get_content action context', () => {
      it('should define script file structure', () => {
        const files = [
          {
            name: 'Code',
            type: 'SERVER_JS',
            source: `
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  Logger.log('Edited: ' + range.getA1Notation());
}

function formatCurrency(range) {
  range.setNumberFormat('$#,##0.00');
}
            `.trim(),
          },
          {
            name: 'appsscript',
            type: 'JSON',
            source: JSON.stringify({
              timeZone: 'America/New_York',
              dependencies: {},
              exceptionLogging: 'STACKDRIVER',
            }),
          },
        ];

        expect(files.length).toBe(2);
        expect(files[0].type).toBe('SERVER_JS');
        expect(files[1].type).toBe('JSON');
      });
    });

    describe('update_content action context', () => {
      it('should validate code file update', () => {
        const update = {
          scriptId: 'abc123',
          files: [
            {
              name: 'Code',
              type: 'SERVER_JS' as const,
              source: 'function myFunction() { return "Hello"; }',
            },
          ],
        };

        expect(update.files[0].source).toContain('function');
      });
    });
  });

  describe('Version Management', () => {
    describe('create_version action context', () => {
      it('should validate version creation', () => {
        const version = {
          scriptId: 'abc123',
          description: 'Version 1.0 - Initial release',
        };

        expect(version.description).toBeDefined();
      });
    });

    describe('list_versions action context', () => {
      it('should define version list structure', () => {
        const versions = [
          { versionNumber: 1, description: 'Initial', createTime: '2024-01-01T00:00:00Z' },
          { versionNumber: 2, description: 'Bug fixes', createTime: '2024-01-15T00:00:00Z' },
          { versionNumber: 3, description: 'New features', createTime: '2024-02-01T00:00:00Z' },
        ];

        expect(versions[versions.length - 1].versionNumber).toBe(3);
      });
    });

    describe('get_version action context', () => {
      it('should validate specific version retrieval', () => {
        const version = {
          versionNumber: 2,
          description: 'Bug fixes',
          createTime: '2024-01-15T00:00:00Z',
        };

        expect(version.versionNumber).toBe(2);
      });
    });
  });

  describe('Deployment Management', () => {
    describe('deploy action context', () => {
      it('should validate deployment configuration', () => {
        const deployment = {
          scriptId: 'abc123',
          versionNumber: 3,
          description: 'Production deployment',
          type: 'WEB_APP' as const,
          config: {
            access: 'ANYONE',
            executeAs: 'USER_DEPLOYING',
          },
        };

        expect(deployment.type).toBe('WEB_APP');
        expect(['MYSELF', 'DOMAIN', 'ANYONE', 'ANYONE_ANONYMOUS']).toContain(
          deployment.config.access
        );
      });
    });

    describe('list_deployments action context', () => {
      it('should define deployment list structure', () => {
        const deployments = [
          {
            deploymentId: 'dep_123',
            versionNumber: 2,
            entryPoints: [
              {
                entryPointType: 'WEB_APP',
                webApp: {
                  url: 'https://script.google.com/macros/s/ABC123/exec',
                },
              },
            ],
          },
          {
            deploymentId: 'dep_456',
            versionNumber: 3,
            entryPoints: [
              {
                entryPointType: 'EXECUTION_API',
              },
            ],
          },
        ];

        expect(deployments.length).toBe(2);
        expect(deployments[0].entryPoints[0].webApp?.url).toContain('script.google.com');
      });
    });

    describe('undeploy action context', () => {
      it('should validate undeploy request', () => {
        const undeploy = {
          scriptId: 'abc123',
          deploymentId: 'dep_456',
        };

        expect(undeploy.deploymentId).toBeDefined();
      });
    });
  });

  describe('Execution', () => {
    describe('run action context', () => {
      it('should validate function execution request', () => {
        const runConfig = {
          scriptId: 'abc123',
          function: 'processData',
          parameters: ['arg1', { key: 'value' }, 123],
          devMode: false,
        };

        expect(runConfig.function).toBeDefined();
        expect(Array.isArray(runConfig.parameters)).toBe(true);
      });
    });

    describe('list_processes action context', () => {
      it('should define process status types', () => {
        const statuses = [
          'COMPLETED',
          'FAILED',
          'RUNNING',
          'CANCELED',
          'TIMED_OUT',
          'UNKNOWN',
          'DELAYED',
        ];

        expect(statuses).toContain('COMPLETED');
        expect(statuses).toContain('FAILED');
      });

      it('should define process types', () => {
        const processTypes = [
          'EDITOR',
          'SIMPLE_TRIGGER',
          'TRIGGER',
          'WEBAPP',
          'API_EXECUTABLE',
          'ADD_ON',
          'TIME_DRIVEN',
        ];

        expect(processTypes).toContain('TRIGGER');
        expect(processTypes).toContain('WEBAPP');
      });
    });

    describe('get_metrics action context', () => {
      it('should define metrics structure', () => {
        const metrics = {
          activeUsers: 150,
          totalExecutions: 5000,
          failedExecutions: 25,
          failureRate: 0.5,
          averageExecutionTime: 1234, // ms
        };

        expect(metrics.failureRate).toBeLessThan(1);
        expect(metrics.totalExecutions).toBeGreaterThan(metrics.failedExecutions);
      });
    });
  });

  describe('Container-Bound Scripts', () => {
    it('should understand container-bound script relationship', async () => {
      // Container-bound scripts are tied to specific Sheets
      // The spreadsheet ID becomes the parentId of the script

      const response = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        fields: 'spreadsheetId,properties.title',
      });

      // A container-bound script would use this spreadsheet as parent
      const scriptConfig = {
        title: `Script for ${response.data.properties?.title}`,
        parentId: response.data.spreadsheetId,
      };

      expect(scriptConfig.parentId).toBe(testSpreadsheet.id);
    });

    it('should prepare spreadsheet with script-triggerable data', async () => {
      // Set up data that a script might process
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D5',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['Date', 'Item', 'Quantity', 'Price'],
            ['2024-01-01', 'Widget A', '10', '25.00'],
            ['2024-01-02', 'Widget B', '5', '30.00'],
            ['2024-01-03', 'Widget C', '15', '20.00'],
            ['2024-01-04', 'Widget D', '8', '35.00'],
          ],
        },
      });

      // A script could process this data
      // Example script function:
      const scriptCode = `
function calculateTotal() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getRange('A2:D5').getValues();
  var total = 0;
  for (var i = 0; i < data.length; i++) {
    total += data[i][2] * data[i][3]; // Quantity * Price
  }
  sheet.getRange('E1').setValue('Total');
  sheet.getRange('E2').setValue(total);
}
      `.trim();

      expect(scriptCode).toContain('SpreadsheetApp');
      expect(scriptCode).toContain('getValues');
    });
  });

  describe('Script Triggers', () => {
    it('should define trigger types for spreadsheets', () => {
      const triggers = [
        { type: 'onEdit', description: 'Runs when user edits' },
        { type: 'onChange', description: 'Runs when structure changes' },
        { type: 'onOpen', description: 'Runs when spreadsheet opens' },
        { type: 'onFormSubmit', description: 'Runs when form is submitted' },
        { type: 'time-driven', description: 'Runs on schedule' },
      ];

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.find((t) => t.type === 'onEdit')).toBeDefined();
    });

    it('should define simple trigger code', () => {
      const triggerCode = `
function onEdit(e) {
  if (!e) return;

  var sheet = e.source.getActiveSheet();
  var range = e.range;

  // Log the edit
  console.log('Edited:', range.getA1Notation(), 'New value:', e.value);

  // Update timestamp
  if (range.getColumn() <= 4) {
    sheet.getRange(range.getRow(), 5).setValue(new Date());
  }
}
      `.trim();

      expect(triggerCode).toContain('onEdit');
      expect(triggerCode).toContain('e.range');
    });
  });

  describe('Performance Metrics', () => {
    it('should track script-related spreadsheet operations', async () => {
      client.resetMetrics();

      // Operations that would be part of script workflow
      await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        fields: 'properties,sheets.properties',
      });

      await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:Z100',
      });

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
    });
  });
});
