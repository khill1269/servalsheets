/**
 * Composite Dashboard Handler
 *
 * Decomposed action handler for:
 * - build_dashboard
 */

import { getRequestLogger } from '../../utils/request-context.js';
import { buildGridRangeInput, toGridRange } from '../../utils/google-sheets-helpers.js';
import type { CompositeBuildDashboardInput, CompositeOutput } from '../../schemas/composite.js';
import type { CompositeHandlerAccess } from './internal.js';

/**
 * Decomposed action handler for `build_dashboard`.
 */
export async function handleBuildDashboardAction(
  input: CompositeBuildDashboardInput,
  access: CompositeHandlerAccess
): Promise<CompositeOutput['response']> {
  const { spreadsheetId, dataSheet, dashboardSheet, layout, kpis, charts, slicers } = input;
  const logger = getRequestLogger();

  logger.info('Building dashboard', { spreadsheetId, dataSheet, dashboardSheet, layout });

  access.sendProgress(0, 10, 'Setting up dashboard sheet');

  // Single spreadsheets.get to fetch all sheet metadata upfront
  const spreadsheet = await access.sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title)',
  });
  const existingSheets = spreadsheet.data.sheets ?? [];

  // Build sheetId lookup from the single fetch
  const sheetIdByTitle = new Map<string, number>(
    existingSheets
      .filter((s) => s.properties?.title != null)
      .map((s) => [s.properties!.title!, s.properties!.sheetId ?? 0])
  );

  // Ensure dashboard sheet exists; capture its sheetId from batchUpdate reply if newly created
  if (!sheetIdByTitle.has(dashboardSheet)) {
    const addReply = await access.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: dashboardSheet } } }],
      },
    });
    const newId = addReply.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    sheetIdByTitle.set(dashboardSheet, newId);
  }

  const dashboardSheetId = sheetIdByTitle.get(dashboardSheet) ?? 0;
  const dataSheetId = sheetIdByTitle.get(dataSheet) ?? 0;

  access.sendProgress(3, 10, 'Writing KPI metrics');

  // Step 2: Write KPIs if provided
  if (kpis && kpis.length > 0) {
    const labelRow = kpis.map((k) => k.label);
    const formulaRow = kpis.map((k) => k.formula);
    const kpiRange = `${dashboardSheet}!A1:${String.fromCharCode(65 + kpis.length - 1)}2`;
    await access.sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: kpiRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [labelRow, formulaRow] },
    });
  }

  access.sendProgress(5, 10, 'Applying formatting');

  // Step 3: Bold the label row via batchUpdate if KPIs present
  if (kpis && kpis.length > 0) {
    await access.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: toGridRange(buildGridRangeInput(dashboardSheetId, 0, 1, 0, kpis.length)),
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
        ],
      },
    });
  }

  access.sendProgress(7, 10, 'Adding charts');

  // Step 4: Collect all addChart requests and issue a single batchUpdate
  let chartsAddedCount = 0;
  if (charts && charts.length > 0 && layout !== 'kpi_header') {
    const chartRequests = charts.map((chart, i) => {
      const anchorRow = (kpis ? 4 : 1) + i * 20;
      return {
        addChart: {
          chart: {
            spec: {
              title: chart.title,
              basicChart: {
                chartType: chart.type,
                series: [{ series: { sourceRange: { sources: [] } } }],
              },
            },
            position: {
              overlayPosition: {
                anchorCell: {
                  sheetId: dashboardSheetId,
                  rowIndex: anchorRow,
                  columnIndex: 0,
                },
              },
            },
          },
        },
      };
    });
    await access.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: chartRequests },
    });
    chartsAddedCount = charts.length;
  }

  access.sendProgress(9, 10, 'Adding slicers');

  // Step 5: Collect all addSlicer requests and issue a single batchUpdate
  let slicersAddedCount = 0;
  if (slicers && slicers.length > 0 && layout === 'full_analytics') {
    const slicerRequests = slicers.map((slicer) => ({
      addSlicer: {
        slicer: {
          spec: {
            dataRange: toGridRange(
              buildGridRangeInput(
                dataSheetId,
                0,
                1000,
                slicer.filterColumn,
                slicer.filterColumn + 1
              )
            ),
            columnIndex: slicer.filterColumn,
            title: slicer.title,
          },
          position: {
            overlayPosition: {
              anchorCell: {
                sheetId: dashboardSheetId,
                rowIndex: 0,
                columnIndex: 0,
              },
            },
          },
        },
      },
    }));
    await access.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: slicerRequests },
    });
    slicersAddedCount = slicers.length;
  }

  access.sendProgress(10, 10, 'Dashboard complete');

  const kpisAdded = kpis?.length ?? 0;
  const chartsAdded = chartsAddedCount;
  const slicersAdded = slicersAddedCount;

  return {
    success: true as const,
    action: 'build_dashboard' as const,
    dashboardSheet,
    kpisAdded,
    chartsAdded,
    slicersAdded,
    message: `Dashboard "${dashboardSheet}" created with ${kpisAdded} KPIs, ${chartsAdded} charts`,
  };
}
