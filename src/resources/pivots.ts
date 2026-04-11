export const pivotsResource = {
  uri: 'sheets://pivots',
  name: 'Pivot Tables',
  description: 'All pivot tables in the active sheet',
  mimeType: 'application/json',
};

// Alias for resources/index.ts re-export
export const registerPivotResources = pivotsResource;
