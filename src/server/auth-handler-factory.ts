import { AuthHandler, type AuthHandlerOptions } from '../handlers/auth.js';

export function createServerAuthHandler(options: AuthHandlerOptions = {}): AuthHandler {
  return new AuthHandler({
    googleClient: null,
    ...options,
  });
}

export function ensureServerAuthHandler(
  authHandler: AuthHandler | null,
  options: AuthHandlerOptions = {}
): AuthHandler {
  return authHandler ?? createServerAuthHandler(options);
}
