const initializedSessions = new WeakMap<object, { initialized: boolean }>();

function getOrCreateState(server: object): { initialized: boolean } {
  const existing = initializedSessions.get(server);
  if (existing) {
    return existing;
  }

  const created = { initialized: false };
  initializedSessions.set(server, created);
  return created;
}

export function markSessionInitialized(server: object): void {
  getOrCreateState(server).initialized = true;
}

export function resetSessionInitialization(server: object): void {
  initializedSessions.delete(server);
}

export function isSessionInitialized(server: object): boolean {
  return getOrCreateState(server).initialized;
}

export function isInitializedNotification(notification: { method: string }): boolean {
  return notification.method === 'notifications/initialized';
}
