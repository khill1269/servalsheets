/**
 * Phase 8: Aggregate statistics, visualization recommendations, performance analysis,
 * and summary/insight generation
 */

import type { SheetMetadata } from '../tiered-retrieval.js';
import { columnToLetter } from './helpers.js';
import type {
  SheetAnalysis,
  VisualizationRecommendation,
  PerformanceRecommendation,
} from '../comprehensive.js';

/**
 * Calculate aggregate statistics across all analyzed sheets
 */
export function calculateAggregates(sheetAnalyses: SheetAnalysis[]): {
  totalDataRows: number;
  totalFormulas: number;
  overallQualityScore: number;
  overallCompleteness: number;
  totalIssues: number;
  totalAnomalies: number;
  totalTrends: number;
  totalCorrelations: number;
  formulaDensity: number;
  chartCount: number;
  errorCellCount: number;
  pivotTableCount: number;
  dataValidationCount: number;
  conditionalFormatCount: number;
} {
  const totalFormulas = sheetAnalyses.reduce((sum, s) => sum + (s.formulas?.total ?? 0), 0);
  const totalCells = sheetAnalyses.reduce((sum, s) => sum + s.rowCount * s.columnCount, 0);
  const errorCellCount = sheetAnalyses.reduce(
    (sum, s) => sum + s.issues.filter((i) => i.type === 'error').length,
    0
  );
  return {
    totalDataRows: sheetAnalyses.reduce((sum, s) => sum + s.dataRowCount, 0),
    totalFormulas,
    overallQualityScore:
      sheetAnalyses.length > 0
        ? sheetAnalyses.reduce((sum, s) => sum + s.qualityScore, 0) / sheetAnalyses.length
        : 0,
    overallCompleteness:
      sheetAnalyses.length > 0
        ? sheetAnalyses.reduce((sum, s) => sum + s.completeness, 0) / sheetAnalyses.length
        : 0,
    totalIssues: sheetAnalyses.reduce((sum, s) => sum + s.issues.length, 0),
    totalAnomalies: sheetAnalyses.reduce((sum, s) => sum + s.anomalies.length, 0),
    totalTrends: sheetAnalyses.reduce((sum, s) => sum + s.trends.length, 0),
    totalCorrelations: sheetAnalyses.reduce((sum, s) => sum + s.correlations.length, 0),
    formulaDensity: totalCells > 0 ? totalFormulas / totalCells : 0,
    chartCount: 0, // Populated by getSpreadsheetInfo() when available
    errorCellCount,
    pivotTableCount: 0, // Populated by getSpreadsheetInfo() when available
    dataValidationCount: 0, // Populated by getSpreadsheetInfo() when available
    conditionalFormatCount: 0, // Populated by getSpreadsheetInfo() when available
  };
}

/**
 * Generate visualization recommendations based on the first sheet's analysis
 */
export function generateVisualizationRecommendations(
  spreadsheetId: string,
  analysis: SheetAnalysis
): VisualizationRecommendation[] {
  const recommendations: VisualizationRecommendation[] = [];
  const numericCols = analysis.columns.filter((c) => c.dataType === 'number');
  const textCols = analysis.columns.filter((c) => c.dataType === 'text');

  // Time series / trend chart
  if (analysis.trends.length > 0 && numericCols.length > 0) {
    const trendCol = numericCols[0]!;
    recommendations.push({
      chartType: 'LINE',
      suitabilityScore: 90,
      reasoning: `Trends detected in ${analysis.trends.length} columns - line chart shows progression`,
      suggestedConfig: {
        title: `${trendCol.name} Trend`,
        xAxis: 'Row Index',
        yAxis: trendCol.name,
      },
      executionParams: {
        tool: 'sheets_visualize',
        action: 'chart_create',
        params: {
          spreadsheetId,
          sheetId: analysis.sheetId,
          chartType: 'LINE',
          dataRange: `${analysis.sheetName}!A1:${columnToLetter(analysis.columnCount - 1)}${analysis.dataRowCount + 1}`,
          title: `${trendCol.name} Trend Analysis`,
        },
      },
    });
  }

  // Category comparison (bar chart)
  if (textCols.length > 0 && numericCols.length > 0) {
    const catCol = textCols.find((c) => c.uniqueCount < 20) || textCols[0]!;
    const valCol = numericCols[0]!;
    recommendations.push({
      chartType: 'COLUMN',
      suitabilityScore: 85,
      reasoning: `Categorical data (${catCol.name}) with numeric values (${valCol.name}) - column chart compares categories`,
      suggestedConfig: {
        title: `${valCol.name} by ${catCol.name}`,
        xAxis: catCol.name,
        yAxis: valCol.name,
      },
      executionParams: {
        tool: 'sheets_visualize',
        action: 'chart_create',
        params: {
          spreadsheetId,
          sheetId: analysis.sheetId,
          chartType: 'COLUMN',
          dataRange: `${analysis.sheetName}!A1:${columnToLetter(analysis.columnCount - 1)}${analysis.dataRowCount + 1}`,
          title: `${valCol.name} by ${catCol.name}`,
        },
      },
    });
  }

  // Correlation scatter plot
  if (analysis.correlations.length > 0) {
    const topCorr = analysis.correlations[0]!;
    recommendations.push({
      chartType: 'SCATTER',
      suitabilityScore: 80,
      reasoning: `Strong correlation (${topCorr.coefficient}) between ${topCorr.columns[0]} and ${topCorr.columns[1]}`,
      suggestedConfig: {
        title: `${topCorr.columns[0]} vs ${topCorr.columns[1]}`,
        xAxis: topCorr.columns[0],
        yAxis: topCorr.columns[1],
      },
      executionParams: {
        tool: 'sheets_visualize',
        action: 'chart_create',
        params: {
          spreadsheetId,
          sheetId: analysis.sheetId,
          chartType: 'SCATTER',
          dataRange: `${analysis.sheetName}!A1:${columnToLetter(analysis.columnCount - 1)}${analysis.dataRowCount + 1}`,
          title: `Correlation: ${topCorr.columns[0]} vs ${topCorr.columns[1]}`,
        },
      },
    });
  }

  // Distribution (pie chart for categorical with few values)
  if (textCols.some((c) => c.uniqueCount <= 10 && c.uniqueCount > 1)) {
    const pieCol = textCols.find((c) => c.uniqueCount <= 10 && c.uniqueCount > 1)!;
    recommendations.push({
      chartType: 'PIE',
      suitabilityScore: 75,
      reasoning: `${pieCol.name} has ${pieCol.uniqueCount} categories - pie chart shows distribution`,
      suggestedConfig: {
        title: `${pieCol.name} Distribution`,
      },
      executionParams: {
        tool: 'sheets_visualize',
        action: 'chart_create',
        params: {
          spreadsheetId,
          sheetId: analysis.sheetId,
          chartType: 'PIE',
          dataRange: `${analysis.sheetName}!A1:${columnToLetter(analysis.columnCount - 1)}${analysis.dataRowCount + 1}`,
          title: `${pieCol.name} Distribution`,
        },
      },
    });
  }

  return recommendations.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

/**
 * Analyze spreadsheet performance and produce scored recommendations
 */
export function analyzePerformance(
  metadata: SheetMetadata,
  sheetAnalyses: SheetAnalysis[],
  _aggregate: { totalFormulas: number }
): { score: number; recommendations: PerformanceRecommendation[] } {
  const recommendations: PerformanceRecommendation[] = [];
  let penalties = 0;

  // Check total size
  const totalCells = metadata.sheets.reduce((sum, s) => sum + s.rowCount * s.columnCount, 0);
  if (totalCells > 5000000) {
    recommendations.push({
      type: 'LARGE_SPREADSHEET',
      severity: 'high',
      description: `Spreadsheet has ${(totalCells / 1000000).toFixed(1)}M cells`,
      impact: 'Slow load times and calculation',
      recommendation: 'Consider splitting into multiple spreadsheets',
    });
    penalties += 20;
  }

  // Check sheet count
  if (metadata.sheets.length > 20) {
    recommendations.push({
      type: 'TOO_MANY_SHEETS',
      severity: 'medium',
      description: `${metadata.sheets.length} sheets in spreadsheet`,
      impact: 'Navigation and loading complexity',
      recommendation: 'Consider consolidating or archiving unused sheets',
    });
    penalties += 10;
  }

  // Check volatile formulas
  const volatileCount = sheetAnalyses.reduce((sum, s) => sum + (s.formulas?.volatile ?? 0), 0);
  if (volatileCount > 10) {
    recommendations.push({
      type: 'VOLATILE_FORMULAS',
      severity: 'high',
      description: `${volatileCount} volatile formulas (NOW, TODAY, RAND, etc.)`,
      impact: 'Recalculates on every change',
      recommendation: 'Replace with static values or trigger-based updates',
    });
    penalties += 15;
  }

  // Check complex formulas
  const complexCount = sheetAnalyses.reduce((sum, s) => sum + (s.formulas?.complex ?? 0), 0);
  if (complexCount > 50) {
    recommendations.push({
      type: 'COMPLEX_FORMULAS',
      severity: 'medium',
      description: `${complexCount} complex/very complex formulas`,
      impact: 'Slow calculation times',
      recommendation: 'Simplify formulas or use helper columns',
    });
    penalties += 10;
  }

  const score = Math.max(0, 100 - penalties);

  return { score, recommendations };
}

/**
 * Generate a human-readable summary and top insight bullets
 */
export function generateSummary(
  metadata: SheetMetadata,
  sheetAnalyses: SheetAnalysis[],
  aggregate: ReturnType<typeof calculateAggregates>,
  performance?: { score: number; recommendations: PerformanceRecommendation[] }
): { summary: string; topInsights: string[] } {
  const insights: string[] = [];

  // Quality insight
  if (aggregate.overallQualityScore >= 80) {
    insights.push(
      `✅ High data quality (${aggregate.overallQualityScore.toFixed(0)}%) - data is clean and consistent`
    );
  } else if (aggregate.overallQualityScore >= 60) {
    insights.push(
      `⚠️ Moderate data quality (${aggregate.overallQualityScore.toFixed(0)}%) - ${aggregate.totalIssues} issues found`
    );
  } else {
    insights.push(
      `❌ Low data quality (${aggregate.overallQualityScore.toFixed(0)}%) - ${aggregate.totalIssues} issues need attention`
    );
  }

  // Trends insight
  if (aggregate.totalTrends > 0) {
    const trendingCols = sheetAnalyses.flatMap((s) => s.trends.map((t) => t.column)).slice(0, 3);
    insights.push(`📈 ${aggregate.totalTrends} trend(s) detected in: ${trendingCols.join(', ')}`);
  }

  // Anomalies insight
  if (aggregate.totalAnomalies > 0) {
    insights.push(
      `🔍 ${aggregate.totalAnomalies} anomalies detected - review for data entry errors`
    );
  }

  // Correlations insight
  if (aggregate.totalCorrelations > 0) {
    const strongCorr = sheetAnalyses.flatMap((s) =>
      s.correlations.filter((c) => c.strength === 'strong' || c.strength === 'very_strong')
    );
    if (strongCorr.length > 0) {
      insights.push(
        `🔗 ${strongCorr.length} strong correlation(s) found - ${strongCorr[0]?.columns.join(' ↔ ')}`
      );
    }
  }

  // Performance insight
  if (performance && performance.score < 70) {
    insights.push(
      `⚡ Performance score: ${performance.score}% - ${performance.recommendations.length} optimization(s) recommended`
    );
  }

  // Formula insight
  if (aggregate.totalFormulas > 0) {
    const issueFormulas = sheetAnalyses.reduce(
      (sum, s) => sum + (s.formulas?.issues.length ?? 0),
      0
    );
    if (issueFormulas > 0) {
      insights.push(`📊 ${aggregate.totalFormulas} formulas, ${issueFormulas} need optimization`);
    }
  }

  const summary =
    `Analyzed "${metadata.title}" with ${metadata.sheets.length} sheet(s), ` +
    `${aggregate.totalDataRows.toLocaleString()} data rows. ` +
    `Quality score: ${aggregate.overallQualityScore.toFixed(0)}%. ` +
    `Found ${aggregate.totalTrends} trends, ${aggregate.totalAnomalies} anomalies, ` +
    `${aggregate.totalCorrelations} correlations, and ${aggregate.totalIssues} issues.`;

  return { summary, topInsights: insights.slice(0, 6) };
}
