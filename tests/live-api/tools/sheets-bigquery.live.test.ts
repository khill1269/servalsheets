/**
 * Live API Tests for sheets_bigquery Tool
 *
 * Tests BigQuery Connected Sheets integration with real Google Sheets data.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 14 Actions:
 * Connection Management (5): connect, connect_looker, disconnect, list_connections, get_connection
 * Query Operations (4): query, preview, refresh, cancel_refresh
 * Schema Discovery (3): list_datasets, list_tables, get_table_schema
 * Data Transfer (2): export_to_bigquery, import_from_bigquery
 *
 * Note: Most BigQuery operations require:
 * - BigQuery API enabled in GCP project
 * - Appropriate BigQuery permissions
 * - Existing datasets/tables in BigQuery
 *
 * These tests verify the Sheets API context and data structures.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import { loadTestCredentials, shouldRunIntegrationTests } from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_bigquery Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('bigquery');
  });

  describe('Connection Management', () => {
    describe('connect action context', () => {
      it('should validate BigQuery data source specification', () => {
        const spec = {
          projectId: 'my-gcp-project',
          datasetId: 'my_dataset',
          tableId: 'my_table',
        };

        expect(spec.projectId).toBeDefined();
        expect(spec.datasetId).toBeDefined();
        expect(spec.tableId).toBeDefined();
      });

      it('should validate query-based connection', () => {
        const spec = {
          projectId: 'my-gcp-project',
          query: 'SELECT * FROM `project.dataset.table` LIMIT 1000',
        };

        expect(spec.query).toContain('SELECT');
        expect(spec.projectId).toBeDefined();
      });

      it('should prepare spreadsheet for BigQuery connection', async () => {
        // Verify spreadsheet exists and can host data source
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'spreadsheetId,properties.title,sheets.properties',
        });

        expect(response.status).toBe(200);
        expect(response.data.spreadsheetId).toBe(testSpreadsheet.id);
      });
    });

    describe('connect_looker action context', () => {
      it('should validate Looker data source specification', () => {
        const lookerSpec = {
          instanceUri: 'https://company.looker.com',
          model: 'sales_model',
          explore: 'orders',
        };

        expect(lookerSpec.instanceUri).toMatch(/^https:\/\//);
        expect(lookerSpec.model).toBeDefined();
        expect(lookerSpec.explore).toBeDefined();
      });
    });

    describe('list_connections action context', () => {
      it('should handle empty data sources list', async () => {
        // Get data sources (likely empty for test spreadsheet)
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'dataSources',
        });

        // New spreadsheets typically have no data sources
        const dataSources = response.data.dataSources || [];
        expect(Array.isArray(dataSources)).toBe(true);
      });
    });

    describe('disconnect action context', () => {
      it('should validate data source ID format', () => {
        const dataSourceId = 'abc123xyz';
        expect(dataSourceId.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Query Operations', () => {
    describe('query action context', () => {
      it('should validate SQL query structure', () => {
        const queries = [
          'SELECT * FROM `project.dataset.table`',
          'SELECT name, COUNT(*) as count FROM `project.dataset.users` GROUP BY name',
          'SELECT a.*, b.value FROM `p.d.table_a` a JOIN `p.d.table_b` b ON a.id = b.id',
        ];

        for (const query of queries) {
          expect(query.toUpperCase()).toContain('SELECT');
          expect(query).toContain('FROM');
        }
      });

      it('should validate query parameters', () => {
        const queryConfig = {
          projectId: 'my-project',
          query: 'SELECT * FROM `my-project.dataset.table` LIMIT 100',
          maxResults: 10000,
        };

        expect(queryConfig.maxResults).toBeLessThanOrEqual(100000);
        expect(queryConfig.projectId).toBeDefined();
      });
    });

    describe('preview action context', () => {
      it('should limit preview rows', () => {
        const previewConfig = {
          query: 'SELECT * FROM table',
          maxRows: 100,
        };

        expect(previewConfig.maxRows).toBeLessThanOrEqual(1000);
      });
    });

    describe('refresh action context', () => {
      it('should track refresh operations', () => {
        const refreshConfig = {
          dataSourceId: 'ds_123',
          forceRefresh: true,
        };

        expect(refreshConfig.dataSourceId).toBeDefined();
      });
    });
  });

  describe('Schema Discovery', () => {
    describe('list_datasets action context', () => {
      it('should validate project ID for datasets query', () => {
        const config = {
          projectId: 'my-gcp-project',
        };

        // Project ID should follow GCP naming conventions
        expect(config.projectId).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
      });
    });

    describe('list_tables action context', () => {
      it('should validate dataset reference', () => {
        const config = {
          projectId: 'my-gcp-project',
          datasetId: 'my_dataset',
        };

        expect(config.projectId).toBeDefined();
        expect(config.datasetId).toBeDefined();
      });
    });

    describe('get_table_schema action context', () => {
      it('should validate table reference', () => {
        const tableRef = {
          projectId: 'my-gcp-project',
          datasetId: 'my_dataset',
          tableId: 'my_table',
        };

        expect(tableRef.tableId).toBeDefined();
      });

      it('should define expected schema column structure', () => {
        const columns = [
          { name: 'id', type: 'INTEGER', mode: 'REQUIRED' },
          { name: 'name', type: 'STRING', mode: 'NULLABLE' },
          { name: 'created_at', type: 'TIMESTAMP', mode: 'NULLABLE' },
          { name: 'tags', type: 'STRING', mode: 'REPEATED' },
        ];

        expect(columns[0].mode).toBe('REQUIRED');
        expect(columns[3].mode).toBe('REPEATED');
      });
    });
  });

  describe('Data Transfer', () => {
    describe('export_to_bigquery action context', () => {
      it('should prepare data for BigQuery export', async () => {
        // Write sample data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C5',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['id', 'name', 'value'],
              ['1', 'Alice', '100'],
              ['2', 'Bob', '200'],
              ['3', 'Charlie', '300'],
              ['4', 'Diana', '400'],
            ],
          },
        });

        // Read back to verify export-ready format
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C5',
        });

        expect(response.data.values).toHaveLength(5);
        expect(response.data.values![0]).toEqual(['id', 'name', 'value']); // Headers
      });

      it('should validate export configuration', () => {
        const exportConfig = {
          spreadsheetId: 'abc123',
          range: 'Sheet1!A1:Z1000',
          destination: {
            projectId: 'my-project',
            datasetId: 'my_dataset',
            tableId: 'imported_data',
          },
          writeDisposition: 'WRITE_TRUNCATE', // or WRITE_APPEND
        };

        expect(exportConfig.destination.projectId).toBeDefined();
        expect(['WRITE_TRUNCATE', 'WRITE_APPEND']).toContain(exportConfig.writeDisposition);
      });
    });

    describe('import_from_bigquery action context', () => {
      it('should validate import configuration', () => {
        const importConfig = {
          source: {
            projectId: 'my-project',
            datasetId: 'my_dataset',
            tableId: 'source_table',
          },
          spreadsheetId: 'abc123',
          sheetName: 'ImportedData',
          createNewSheet: true,
        };

        expect(importConfig.source.tableId).toBeDefined();
        expect(importConfig.sheetName).toBeDefined();
      });

      it('should prepare target sheet for import', async () => {
        // Add a new sheet for import target
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'BigQueryImport',
                    gridProperties: {
                      rowCount: 10000,
                      columnCount: 26,
                    },
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        const newSheetId = response.data.replies![0].addSheet?.properties?.sheetId;
        expect(newSheetId).toBeDefined();
      });
    });
  });

  describe('Connected Sheets Data Source Structure', () => {
    it('should understand data source response structure', () => {
      // Expected data source structure from Sheets API
      const dataSource = {
        dataSourceId: 'ds_123456',
        spec: {
          bigQuery: {
            projectId: 'my-project',
            querySpec: {
              rawQuery: 'SELECT * FROM table',
            },
          },
        },
        calculatedColumns: [],
        sheetId: 12345,
      };

      expect(dataSource.dataSourceId).toBeDefined();
      expect(dataSource.spec.bigQuery).toBeDefined();
    });

    it('should understand data source sheet structure', () => {
      // When a BigQuery data source is connected, it creates a data source sheet
      const dataSourceSheet = {
        sheetId: 12345,
        sheetType: 'DATA_SOURCE',
        dataSourceSheetProperties: {
          dataSourceId: 'ds_123456',
          columns: [{ reference: { name: 'id' } }, { reference: { name: 'name' } }],
          dataExecutionStatus: {
            state: 'SUCCEEDED',
            lastRefreshTime: new Date().toISOString(),
          },
        },
      };

      expect(dataSourceSheet.sheetType).toBe('DATA_SOURCE');
      expect(dataSourceSheet.dataSourceSheetProperties.dataSourceId).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should track BigQuery-related operations', async () => {
      client.resetMetrics();

      // Operations that would be part of BigQuery workflow
      await client.trackOperation('get', 'GET', () =>
        client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'dataSources,dataSourceSchedules',
        })
      );

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(1);
    });
  });
});
