export const metricsResource = {
  uri: 'sheets://metrics',
  name: 'Sheet Metrics',
  description: 'Performance metrics: API calls, cache hits, formula recalc time',
  mimeType: 'application/json',
};

// Alias for resources/index.ts re-export
export const registerMetricsResources = metricsResource;
