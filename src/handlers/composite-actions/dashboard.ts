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

  // Step 1: Ensure dashboard sheet exists (add it if missing)
  const spreadsheet = await access.sheetsApi.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets ?? [];
  const dashboardExists = existingSheets.some((s) => s.properties?.title === dashboardSheet);

  if (!dashboardExists) {
    await access.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: dashboardSheet } } }],
      },
    });
  }

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
    const dashboardSheetObj = (
      await access.sheetsApi.spreadsheets.get({ spreadsheetId })
    ).data.sheets?.find((s) => s.properties?.title === dashboardSheet);
    const dashboardSheetId = dashboardSheetObj?.properties?.sheetId ?? 0;
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

  // Step 4: Create charts if provided (simplified — charts use addChart request)
  let chartsAddedCount = 0;
  if (charts && charts.length > 0 && layout !== 'kpi_header') {
    const dashboardSheetObj2 = (
      await access.sheetsApi.spreadsheets.get({ spreadsheetId })
    ).data.sheets?.find((s) => s.properties?.title === dashboardSheet);
    const dashboardSheetId2 = dashboardSheetObj2?.properties?.sheetId ?? 0;

    for (const [i, chart] of charts.entries()) {
      const anchorRow = (kpis ? 4 : 1) + i * 20;
      await access.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
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
                        sheetId: dashboardSheetId2,
                        rowIndex: anchorRow,
                        columnIndex: 0,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      });
      chartsAddedCount++;
    }
  }

  access.sendProgress(9, 10, 'Adding slicers');

  // Step 5: Create slicers if provided and layout includes them
  let slicersAddedCount = 0;
  if (slicers && slicers.length > 0 && layout === 'full_analytics') {
    const dataSheetObj = (
      await access.sheetsApi.spreadsheets.get({ spreadsheetId })
    ).data.sheets?.find((s) => s.properties?.title === dataSheet);
    const dataSheetId = dataSheetObj?.properties?.sheetId ?? 0;
    const dashboardSheetObj3 = (
      await access.sheetsApi.spreadsheets.get({ spreadsheetId })
    ).data.sheets?.find((s) => s.properties?.title === dashboardSheet);
    const dashboardSheetId3 = dashboardSheetObj3?.properties?.sheetId ?? 0;

    for (const slicer of slicers) {
      await access.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
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
                        sheetId: dashboardSheetId3,
                        rowIndex: 0,
                        columnIndex: 0,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      });
      slicersAddedCount++;
    }
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
