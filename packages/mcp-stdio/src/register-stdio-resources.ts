export interface StdioResourceRegistrationLogger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface RegisterStdioResourcesDependencies {
  readonly registerResources: () => Promise<void>;
  readonly log: StdioResourceRegistrationLogger;
}

export async function registerStdioResources(
  resourcesRegistered: boolean,
  dependencies: RegisterStdioResourcesDependencies
): Promise<void> {
  if (resourcesRegistered) {
    return;
  }

  try {
    await dependencies.registerResources();
  } catch (error) {
    if (error instanceof Error && error.message.includes('already registered')) {
      dependencies.log.warn('Resource already registered — skipping duplicate registration', {
        message: error.message,
      });
      return;
    }
    throw error;
  }
}

export interface EnsureStdioResourcesRegisteredState {
  readonly resourcesRegistered: boolean;
  readonly resourceRegistrationPromise: Promise<void> | null;
  readonly resourceRegistrationFailed: boolean;
  readonly setResourcesRegistered: (value: boolean) => void;
  readonly setResourceRegistrationPromise: (value: Promise<void> | null) => void;
  readonly setResourceRegistrationFailed: (value: boolean) => void;
}

export interface EnsureStdioResourcesRegisteredDependencies {
  readonly registerResources: () => Promise<void>;
  readonly log: StdioResourceRegistrationLogger;
}

export async function ensureStdioResourcesRegistered(
  state: EnsureStdioResourcesRegisteredState,
  dependencies: EnsureStdioResourcesRegisteredDependencies
): Promise<void> {
  if (state.resourcesRegistered) {
    return;
  }

  if (state.resourceRegistrationFailed) {
    return;
  }

  if (state.resourceRegistrationPromise) {
    await state.resourceRegistrationPromise;
    return;
  }

  const nextPromise = (async () => {
    try {
      dependencies.log.info('Lazy-loading resources on first access');
      await dependencies.registerResources();
      state.setResourcesRegistered(true);
      dependencies.log.info('Resources registered successfully');
    } catch (error) {
      dependencies.log.error(
        'Failed to register resources — poisoning retry guard to prevent cascading "already registered" errors',
        { error }
      );
      state.setResourceRegistrationFailed(true);
      state.setResourceRegistrationPromise(null);
      throw error;
    }
  })();

  state.setResourceRegistrationPromise(nextPromise);
  await nextPromise;
  state.setResourceRegistrationPromise(null);
}
