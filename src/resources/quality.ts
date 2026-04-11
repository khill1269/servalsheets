export const qualityResource = {
  uri: 'sheets://quality',
  name: 'Data Quality Report',
  description: 'Quality issues detected: duplicates, inconsistent formats, anomalies',
  mimeType: 'application/json',
};

// Alias for resources/index.ts re-export
export const registerQualityResources = qualityResource;
