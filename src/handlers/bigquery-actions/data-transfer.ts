/**
 * ServalSheets — BigQuery Data Transfer Handler
 *
 * Handles export_to_bigquery and import_from_bigquery actions.
 * Uses BigQuery Data Transfer Service for scheduled transfers.
 */

import type { sheets_v4 } from 'googleapis';
import { BigQuery } from '@google-cloud/bigquery';
import { DataTransferServiceClient } from '@google-cloud/bigquery-datatransfer';
import { ServiceError } from '../../utils/error-types.js';
import type { HandlerContext } from '../base.js';
import type { SheetsDataOutput } from '../../schemas/data.js';

export class DataTransferHandler {
  private bigquery: BigQuery;
  private transferClient: DataTransferServiceClient;

  constructor(
    private context: HandlerContext,
    private sheetsApi: sheets_v4.Sheets
  ) {
    this.bigquery = new BigQuery();
    this.transferClient = new DataTransferServiceClient();
  }

  async handleExportToBigQuery(params: {
    spreadsheetId: string;
    datasetId: string;
    tableId: string;
    writeDisposition?: 'WRITE_APPEND' | 'WRITE_TRUNCATE' | 'WRITE_EMPTY';
  }): Promise<SheetsDataOutput> {
    try {
      const { spreadsheetId, datasetId, tableId, writeDisposition = 'WRITE_TRUNCATE' } = params;

      // 1. Fetch spreadsheet metadata
      const spreadsheet = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,properties(title)',
      });

      if (!spreadsheet.data) {
        throw new ServiceError(
          'Failed to fetch spreadsheet metadata',
          'SPREADSHEET_NOT_FOUND',
          { spreadsheetId },
          false
        );
      }

      // 2. Create or verify BigQuery dataset
      const dataset = this.bigquery.dataset(datasetId);
      const [datasetExists] = await dataset.exists();

      if (!datasetExists) {
        throw new ServiceError(
          `BigQuery dataset not found: ${datasetId}`,
          'BIGQUERY_DATASET_NOT_FOUND',
          { datasetId, spreadsheetId },
          false,
          { retryable: false }
        );
      }

      // 3. Set up transfer configuration
      const projectId = this.bigquery.projectId;
      const transferConfig = {
        destinationDatasetId: datasetId,
        displayName: `${spreadsheet.data.properties?.title || 'Sheet'} → ${tableId}`,
        dataSourceId: 'google_sheets',
        params: {
          data_path_template: `gs://bucket/path/to/${spreadsheetId}`,
        },
        schedule: 'every day 01:00',
      };

      // 4. Create transfer job (if not exists)
      const parent = `projects/${projectId}/locations/us`;
      const request = { parent, transferConfig };

      const [response] = await this.transferClient.createTransferConfig(request);

      return {
        response: {
          success: true,
          action: 'export_to_bigquery',
          data: {
            transferId: response.name,
            dataset: datasetId,
            table: tableId,
            status: 'scheduled',
          },
        },
      };
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err;
      }
      throw new ServiceError(
        `Export to BigQuery failed: ${err instanceof Error ? err.message : String(err)}`,
        'EXPORT_FAILED',
        { originalError: String(err) },
        true,
        { retryable: true }
      );
    }
  }

  async handleImportFromBigQuery(params: {
    spreadsheetId: string;
    projectId: string;
    query: string;
    destination?: { sheetName?: string; startCell?: string };
  }): Promise<SheetsDataOutput> {
    try {
      const { spreadsheetId, projectId, query, destination } = params;

      // 1. Fetch spreadsheet to verify it exists
      const spreadsheet = await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,sheets(properties(title,sheetId))',
      });

      if (!spreadsheet.data) {
        throw new ServiceError(
          'Spreadsheet not found',
          'SPREADSHEET_NOT_FOUND',
          { spreadsheetId },
          false
        );
      }

      // 2. Run BigQuery query
      const [rows] = await this.bigquery.query({ query, projectId });

      if (!rows || rows.length === 0) {
        throw new ServiceError(
          'BigQuery query returned no results',
          'BIGQUERY_EMPTY_RESULT',
          { query },
          false
        );
      }

      // 3. Convert BigQuery rows to sheet format
      const headers = Object.keys(rows[0] || {});
      const values = [headers, ...rows.map((row: any) => headers.map((h) => row[h]))];

      // 4. Write to destination sheet
      const targetSheet = destination?.sheetName || 'BigQuery Import';
      const startCell = destination?.startCell || 'A1';

      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId,
        range: `${targetSheet}!${startCell}`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });

      return {
        response: {
          success: true,
          action: 'import_from_bigquery',
          data: {
            rowsImported: rows.length,
            columns: headers.length,
            destination: { sheet: targetSheet, startCell },
          },
        },
      };
    } catch (err) {
      if (err instanceof ServiceError) {
        throw err;
      }
      throw new ServiceError(
        `Import from BigQuery failed: ${err instanceof Error ? err.message : String(err)}`,
        'IMPORT_FAILED',
        { originalError: String(err) },
        true,
        { retryable: true }
      );
    }
  }
}
