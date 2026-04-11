export const conflictResource = {
  uri: 'sheets://conflicts',
  name: 'Concurrent Modification Conflicts',
  description: 'Detected conflicts from concurrent edits',
  mimeType: 'application/json',
};

// Alias for resources/index.ts re-export
export const registerConflictResources = conflictResource;
