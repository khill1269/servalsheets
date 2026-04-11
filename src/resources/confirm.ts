export const confirmResource = {
  uri: 'sheets://confirm',
  name: 'Pending Confirmations',
  description: 'Destructive actions awaiting user approval via elicitation',
  mimeType: 'application/json',
};

// Alias for resources/index.ts re-export
export const registerConfirmResources = confirmResource;
