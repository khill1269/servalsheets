/**
 * Shared auth path helpers.
 */

import { homedir } from 'os';
import { join, resolve, isAbsolute } from 'path';

export function getDefaultTokenStorePath(): string {
  return join(homedir(), '.servalsheets', 'tokens.encrypted');
}

/**
 * Normalize a token store path to prevent directory traversal attacks.
 * Resolves `..` components and ensures the result is an absolute path.
 */
export function sanitizeTokenStorePath(rawPath: string): string {
  // resolve() collapses any ../.. traversal sequences into an absolute path
  const resolved = isAbsolute(rawPath) ? resolve(rawPath) : resolve(process.cwd(), rawPath);
  return resolved;
}
