import type { TextResourceContents } from '@modelcontextprotocol/sdk/types';

export function getChartResources(): TextResourceContents[] {
  return [
    {
      uri: 'charts://types',
      mimeType: 'text/plain',
      text: `Chart Types Supported

Basic:
- Line chart (trends, time series)
- Column chart (categorical comparison)
- Bar chart (horizontal categorical)
- Area chart (stacked trends)

Comparison:
- Combo chart (mixed line + column)
- Scatter chart (correlation analysis)
- Bubble chart (3D comparison)

Distribution:
- Histogram (frequency distribution)
- Pie chart (composition)
- Donut chart (part-to-whole)

Statistical:
- Box plot (quartiles, outliers)
- Candlestick (OHLC data)

Map:
- Geo chart (geographic distribution)

For each type: customize title, legend, axis labels, colors, data range.`,
    },
  ];
}
