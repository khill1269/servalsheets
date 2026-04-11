export const cacheResource = {
  uri: 'sheets://cache',
  name: 'Cache Status',
  description: 'Current state of sheet cache (hit rate, size, TTL)',
  mimeType: 'application/json',
};

// Alias for resources/index.ts re-export
export const registerCacheResources = cacheResource;
