export const historyResource = {
  uri: 'sheets://history',
  name: 'Operation History',
  description: 'Recent operations on the active spreadsheet (for undo/redo context)',
  mimeType: 'application/json',
};

// Alias for resources/index.ts re-export
export const registerHistoryResources = historyResource;
