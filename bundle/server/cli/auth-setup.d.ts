#!/usr/bin/env node
/**
 * ServalSheets - Interactive Authentication Setup
 *
 * Provides a user-friendly OAuth authentication flow:
 * - Auto-discovers credentials in common locations
 * - Opens browser automatically
 * - Shows clear status and progress
 * - Validates configuration
 *
 * Usage: npm run auth
 */
interface AuthStatus {
    hasEnvFile: boolean;
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasTokens: boolean;
    envPath: string;
    tokenPath: string;
}
/**
 * Check current authentication status
 */
declare function getAuthStatus(): AuthStatus;
/**
 * Main authentication setup flow
 */
declare function main(): Promise<void>;
export { main as runAuthSetup, getAuthStatus };
//# sourceMappingURL=auth-setup.d.ts.map