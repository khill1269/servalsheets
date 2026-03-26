/**
 * BigQuery data transfer actions:
 * - export_to_bigquery: Export sheet data to a BigQuery table
 * - import_from_bigquery: Import BigQuery query results to a sheet
 */

import type { BigQueryHandlerAccess } from './internal.js';
import type {
  BigQueryResponse,
  BigQueryExportInput,
  BigQueryImportInput,
} from '../../schemas/index.js';
import { ErrorCodes } from '../error-codes.js';
import { ServiceError } from '../../core/errors.js';
import { validateBigQuerySql, safeBqTableRef } from './helpers.js';
import { logger } from '../../utils/logger.js';
import { sendProgress } from '../../utils/request-context.js';
import { MAX_CELLS_PER_SPREADSHEET } from '../../config/google-limits.js';

export async function handleExportToBigQuery(
  ha: BigQueryHandlerAccess,
  req: BigQueryExportInput
): Promise<BigQueryResponse> {
  const bigquery = ha.requireBigQuery();

  try {
    // Extract range string from various formats
    let range: string;
    if (typeof req.range === 'string') {
      range = req.range;
    } else if ('a1' in req.range) {
      range = req.range.a1;
    } else if ('namedRange' in req.range) {
      range = req.range.namedRange;
    } else {
      return ha.error({
        code: ErrorCodes.INVALID_PARAMS,
        message: 'Range must be a string, A1 notation object, or named range',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const sheetData = await ha.sheetsApi.spreadsheets.values.get({
      spreadsheetId: req.spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const values = sheetData.data.values ?? [];
    if (values.length === 0) {
      return ha.error({
        code: ErrorCodes.INVALID_PARAMS,
        message: 'No data found in the specified range',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const writeDisposition = req.writeDisposition ?? 'WRITE_APPEND';

    // WRITE_EMPTY: fail if the table already has rows
    if (writeDisposition === 'WRITE_EMPTY') {
      const tableRef = safeBqTableRef(
        req.destination.projectId,
        req.destination.datasetId,
        req.destination.tableId
      );
      const countJob = await ha.withBigQueryCircuitBreaker(() =>
        bigquery.jobs.insert({
          projectId: req.destination.projectId,
          requestBody: {
            configuration: {
              query: {
                query: `SELECT COUNT(1) AS row_count FROM ${tableRef}`,
                useLegacySql: false,
              },
            },
          },
        })
      );
      const jobId = countJob.data.jobReference?.jobId;
      if (jobId) {
        const deadline = Date.now() + 120_000; // 120 second wall-clock deadline
        for (let attempt = 0; attempt < 15; attempt++) {
          if (Date.now() > deadline) {
            throw new ServiceError(
              'BigQuery WRITE_EMPTY poll timeout exceeded',
              'OPERATION_FAILED',
              'bigquery',
              true,
              {
                spreadsheetId: req.spreadsheetId,
                projectId: req.destination.projectId,
                tableId: req.destination.tableId,
              }
            );
          }
          const delay = Math.min(500 * Math.pow(2, attempt), 5000);
          await new Promise((r) => setTimeout(r, delay));
          const pollResp = await bigquery.jobs.get({
            projectId: req.destination.projectId,
            jobId,
            location: req.destination.location,
          });
          if (pollResp.data.status?.state === 'DONE') {
            const queryResults = await bigquery.jobs.getQueryResults({
              projectId: req.destination.projectId,
              jobId,
            });
            const existingRows = Number(queryResults.data.rows?.[0]?.f?.[0]?.v ?? 0);
            if (existingRows > 0) {
              return ha.error({
                code: ErrorCodes.INVALID_PARAMS,
                message: `writeDisposition WRITE_EMPTY failed: table already contains ${existingRows} row(s).`,
                retryable: false,
                suggestedFix: 'Use writeDisposition WRITE_APPEND or WRITE_TRUNCATE.',
              });
            }
            break;
          }
        }
      }
    }

    // WRITE_TRUNCATE: delete all existing rows via DML before streaming new ones
    if (writeDisposition === 'WRITE_TRUNCATE') {
      const tableRef = safeBqTableRef(
        req.destination.projectId,
        req.destination.datasetId,
        req.destination.tableId
      );
      const truncateJob = await ha.withBigQueryCircuitBreaker(() =>
        bigquery.jobs.insert({
          projectId: req.destination.projectId,
          requestBody: {
            configuration: {
              query: {
                query: `DELETE FROM ${tableRef} WHERE TRUE`,
                useLegacySql: false,
              },
            },
          },
        })
      );
      const truncJobId = truncateJob.data.jobReference?.jobId;
      if (truncJobId) {
        const deadline = Date.now() + 120_000; // 120 second wall-clock deadline
        for (let attempt = 0; attempt < 20; attempt++) {
          if (Date.now() > deadline) {
            throw new ServiceError(
              'BigQuery WRITE_TRUNCATE poll timeout exceeded',
              'OPERATION_FAILED',
              'bigquery',
              true,
              {
                spreadsheetId: req.spreadsheetId,
                projectId: req.destination.projectId,
                tableId: req.destination.tableId,
              }
            );
          }
          const delay = Math.min(500 * Math.pow(2, attempt), 5000);
          await new Promise((r) => setTimeout(r, delay));
          const pollResp = await bigquery.jobs.get({
            projectId: req.destination.projectId,
            jobId: truncJobId,
            location: req.destination.location,
          });
          if (pollResp.data.status?.state === 'DONE') {
            if (pollResp.data.status.errorResult) {
              logger.warn(
                'WRITE_TRUNCATE DML returned error (table may not exist yet — proceeding)',
                {
                  error: pollResp.data.status.errorResult,
                }
              );
            }
            break;
          }
        }
      }
    }

    // Skip header rows
    const headerRows = req.headerRows ?? 1;
    const headers: unknown[] = headerRows > 0 ? (values[0] ?? []) : [];
    const dataRows = values.slice(headerRows);

    // Convert to BigQuery format
    const rows = dataRows.map((row) => {
      const json: Record<string, unknown> = {};
      row.forEach((cell, idx) => {
        const headerValue = headers[idx];
        const columnName = typeof headerValue === 'string' ? headerValue : `column_${idx}`;
        json[columnName] = cell;
      });
      return { json };
    });

    // Use streaming insert with chunking for large datasets
    const CHUNK_SIZE = 10_000;
    const LOAD_JOB_THRESHOLD = 500_000;
    const totalRows = rows.length;
    const allInsertErrors: unknown[] = [];
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (totalRows >= LOAD_JOB_THRESHOLD) {
      logger.warn('Very large BigQuery export: GCS-staged load jobs would be more efficient', {
        totalRows,
        threshold: LOAD_JOB_THRESHOLD,
        note: 'Proceeding with streaming insert. For >500K rows, consider using a GCS load job instead.',
      });
    } else if (totalRows > CHUNK_SIZE) {
      logger.info('Chunking large export', {
        totalRows,
        chunkSize: CHUNK_SIZE,
        chunks: Math.ceil(totalRows / CHUNK_SIZE),
      });
    }

    const totalChunks = Math.ceil(totalRows / CHUNK_SIZE);
    await sendProgress(0, totalChunks, `Exporting ${totalRows} rows to BigQuery...`);

    for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, Math.min(i + CHUNK_SIZE, totalRows));
      const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;

      logger.debug('Inserting chunk', {
        chunkNumber,
        totalChunks,
        chunkSize: chunk.length,
        rowsProcessed: i + chunk.length,
        totalRows,
      });

      const insertResponse = await ha.withBigQueryCircuitBreaker(() =>
        bigquery.tabledata.insertAll({
          projectId: req.destination.projectId,
          datasetId: req.destination.datasetId,
          tableId: req.destination.tableId,
          requestBody: {
            skipInvalidRows: true,
            ignoreUnknownValues: true,
            rows: chunk.map((row, rowIdx) => ({
              insertId: `${batchId}-${i + rowIdx}`,
              ...row,
            })),
          },
        })
      );

      const chunkErrors = insertResponse.data.insertErrors ?? [];
      if (chunkErrors.length > 0) {
        logger.warn('Some rows failed to insert in chunk', {
          chunkNumber,
          errorCount: chunkErrors.length,
        });
        allInsertErrors.push(...chunkErrors);
      }

      await sendProgress(chunkNumber, totalChunks, `Exported chunk ${chunkNumber}/${totalChunks}`);
    }

    const successfulRows = totalRows - allInsertErrors.length;

    if (allInsertErrors.length > 0) {
      logger.warn('Export completed with errors', {
        totalRows,
        successfulRows,
        failedRows: allInsertErrors.length,
      });
    }

    return ha.success('export_to_bigquery', {
      rowCount: successfulRows,
      mutation: {
        cellsAffected: totalRows,
        sheetsModified: [],
      },
    });
  } catch (err) {
    logger.error('Failed to export to BigQuery', { err, req });
    throw err;
  }
}

export async function handleImportFromBigQuery(
  ha: BigQueryHandlerAccess,
  req: BigQueryImportInput
): Promise<BigQueryResponse> {
  // Validate query to prevent destructive SQL operations
  validateBigQuerySql(req.query);

  const bigquery = ha.requireBigQuery();

  try {
    // Transform parameters to BigQuery API format (all values must be strings)
    const queryParameters = req.parameters?.map((param) => ({
      name: param.name,
      parameterType: param.parameterType,
      parameterValue: {
        value: String(param.parameterValue.value),
      },
    }));

    await sendProgress(0, 3, 'Running BigQuery query...');

    const queryResult = await ha.executeQueryWithJobPolling(bigquery, {
      projectId: req.projectId,
      query: req.query,
      maxResults: req.maxResults ?? 10000,
      timeoutMs: req.timeoutMs,
      maximumBytesBilled: req.maximumBytesBilled,
      dryRun: req.dryRun ?? false,
      useQueryCache: req.useQueryCache ?? true,
      location: req.location,
      parameterMode: queryParameters ? 'NAMED' : undefined,
      queryParameters,
    });

    await sendProgress(1, 3, `Query returned ${queryResult.rows.length} rows`);

    const columns = queryResult.columns;
    const rows = queryResult.rows;

    // Guard: reject results that would exceed Google Sheets 10M cell limit
    const headerRows = req.includeHeaders !== false ? 1 : 0;
    const totalCells = (rows.length + headerRows) * columns.length;
    if (totalCells > MAX_CELLS_PER_SPREADSHEET) {
      return {
        success: false,
        error: {
          code: ErrorCodes.RESOURCE_EXHAUSTED,
          message:
            `BigQuery result (${rows.length} rows × ${columns.length} cols = ${totalCells} cells) ` +
            `exceeds Google Sheets ${MAX_CELLS_PER_SPREADSHEET.toLocaleString()} cell limit. ` +
            `Reduce MAX_BIGQUERY_RESULT_ROWS or filter columns before importing.`,
          retryable: false,
        },
      };
    }

    // Prepare values array for sheet
    const values: unknown[][] = [];
    if (req.includeHeaders !== false) {
      values.push(columns);
    }
    values.push(...rows);

    // Determine target range
    const startCell = req.startCell ?? 'A1';
    let targetSheetId = req.sheetId;
    let targetSheetName = req.sheetName ?? 'BigQuery Results';

    // If no sheet specified, create a new one
    if (targetSheetId === undefined && req.sheetId === undefined) {
      const addSheetResponse = await ha.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: req.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: targetSheetName,
                },
              },
            },
          ],
        },
      });
      targetSheetId =
        addSheetResponse.data?.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
      targetSheetName =
        addSheetResponse.data?.replies?.[0]?.addSheet?.properties?.title ?? targetSheetName;
    }

    await sendProgress(2, 3, `Writing ${rows.length} rows to sheet...`);

    // Write data to sheet
    const range = `${targetSheetName}!${startCell}`;
    await ha.sheetsApi.spreadsheets.values.update({
      spreadsheetId: req.spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    logger.info('Imported BigQuery results to sheet', {
      spreadsheetId: req.spreadsheetId,
      sheetName: targetSheetName,
      rowCount: rows.length,
    });

    // Record operation in session context for LLM follow-up references
    try {
      if (ha.context.sessionContext) {
        ha.context.sessionContext.recordOperation({
          tool: 'sheets_bigquery',
          action: 'import_from_bigquery',
          spreadsheetId: req.spreadsheetId,
          description: `Imported ${rows.length} rows from BigQuery to ${targetSheetName}`,
          undoable: false,
          cellsAffected: values.length * (columns.length || 1),
        });
      }
    } catch {
      // Non-blocking: session context recording is best-effort
    }

    return ha.success('import_from_bigquery', {
      rowCount: rows.length,
      columns,
      sheetId: targetSheetId ?? undefined,
      sheetName: targetSheetName,
      bytesProcessed: queryResult.bytesProcessed,
      cacheHit: queryResult.cacheHit,
      jobId: queryResult.jobId,
      mutation: {
        cellsAffected: values.length * (columns.length || 1),
        sheetsModified: [targetSheetName],
      },
    });
  } catch (err) {
    logger.error('Failed to import from BigQuery', { err, req });
    return ha.mapBigQueryError(err);
  }
}
