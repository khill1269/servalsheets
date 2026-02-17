/**
 * Pre-Flight Validation System
 *
 * Validates startup requirements before server initialization to provide
 * clear, actionable error messages instead of cryptic runtime failures.
 *
 * Checks performed:
 * 1. Build artifacts exist (dist/cli.js, dist/server.js)
 * 2. Node.js version meets minimum requirement
 * 3. Critical dependencies loadable
 * 4. Configuration validity
 * 5. File system permissions
 * 6. Port availability (HTTP mode only)
 */

import { existsSync, accessSync, constants as fsConstants } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { createServer } from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

export interface PreflightCheck {
  name: string;
  critical: boolean; // If true, failure blocks startup
  check: () => Promise<PreflightResult>;
}

export interface PreflightResult {
  passed: boolean;
  message: string;
  fix?: string; // Actionable fix command/instruction
  details?: Record<string, unknown>;
}

export interface PreflightResults {
  checks: Array<PreflightCheck & { result: PreflightResult }>;
  criticalFailures: number;
  warnings: number;
  failures: Array<{ name: string; message: string; fix?: string }>;
  warningList: Array<{ name: string; message: string; fix?: string }>;
}

/**
 * Check 1: Build Artifacts Exist
 * Verifies that TypeScript has been compiled and dist/ directory populated
 */
async function checkBuildArtifacts(): Promise<PreflightResult> {
  const distPath = join(projectRoot, 'dist');
  const cliPath = join(distPath, 'cli.js');
  const serverPath = join(distPath, 'server.js');

  if (!existsSync(distPath)) {
    return {
      passed: false,
      message: 'dist/ directory not found - project not built',
      fix: 'Run: npm run build',
      details: { distPath },
    };
  }

  if (!existsSync(cliPath)) {
    return {
      passed: false,
      message: 'dist/cli.js not found - incomplete build',
      fix: 'Run: npm run build',
      details: { cliPath },
    };
  }

  if (!existsSync(serverPath)) {
    return {
      passed: false,
      message: 'dist/server.js not found - incomplete build',
      fix: 'Run: npm run build',
      details: { serverPath },
    };
  }

  return {
    passed: true,
    message: 'Build artifacts present',
    details: { distPath, cliPath, serverPath },
  };
}

/**
 * Check 2: Node.js Version
 * Verifies Node.js version meets minimum requirement (18.0.0)
 */
async function checkNodeVersion(): Promise<PreflightResult> {
  const current = process.version; // e.g., "v20.11.0"
  const versionParts = current.slice(1).split('.');
  const currentMajor = parseInt(versionParts[0] || '0', 10);
  const requiredMajor = 18;

  if (currentMajor < requiredMajor) {
    return {
      passed: false,
      message: `Node.js ${current} is too old (requires >= ${requiredMajor}.0.0)`,
      fix: `Upgrade Node.js to version ${requiredMajor} or higher`,
      details: { current, required: `${requiredMajor}.0.0` },
    };
  }

  return {
    passed: true,
    message: `Node.js ${current} meets requirements`,
    details: { current, required: `>= ${requiredMajor}.0.0` },
  };
}

/**
 * Check 3: Module Resolution
 * Verifies critical dependencies are installed and loadable
 */
async function checkModuleResolution(): Promise<PreflightResult> {
  const criticalModules = [
    '@modelcontextprotocol/sdk/server/index.js',
    'google-auth-library',
    'googleapis',
    'zod',
  ];

  const missingModules: string[] = [];

  for (const moduleName of criticalModules) {
    try {
      // Attempt to resolve the module
      await import(moduleName);
    } catch (_error) {
      missingModules.push(moduleName);
    }
  }

  if (missingModules.length > 0) {
    return {
      passed: false,
      message: `Missing ${missingModules.length} critical dependencies`,
      fix: 'Run: npm install',
      details: { missingModules },
    };
  }

  return {
    passed: true,
    message: `All ${criticalModules.length} critical dependencies loadable`,
    details: { criticalModules },
  };
}

/**
 * Check 4: Configuration Validation
 * Validates environment variable configuration
 */
async function checkConfiguration(): Promise<PreflightResult> {
  const issues: string[] = [];

  // ENCRYPTION_KEY validation
  const encryptionKey = process.env['ENCRYPTION_KEY'];
  if (encryptionKey) {
    if (encryptionKey.length !== 64) {
      issues.push(
        `ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${encryptionKey.length}`
      );
    }
  }

  // OAuth configuration validation
  const clientId = process.env['OAUTH_CLIENT_ID'];
  const clientSecret = process.env['OAUTH_CLIENT_SECRET'];
  const sessionSecret = process.env['SESSION_SECRET'];

  // If any OAuth var is set, all should be set
  const oauthVarsSet = [clientId, clientSecret, sessionSecret].filter(Boolean).length;
  if (oauthVarsSet > 0 && oauthVarsSet < 3) {
    issues.push(
      'Incomplete OAuth configuration - need OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, and SESSION_SECRET'
    );
  }

  // Redis URL format validation (if present)
  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl) {
    if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
      const preview = redisUrl.length > 20 ? `${redisUrl.slice(0, 20)}...` : redisUrl;
      issues.push(`REDIS_URL should start with redis:// or rediss://, got: ${preview}`);
    }
  }

  if (issues.length > 0) {
    return {
      passed: false,
      message: `Configuration validation failed: ${issues.length} issues`,
      fix: 'Fix configuration issues listed above',
      details: { issues },
    };
  }

  return {
    passed: true,
    message: 'Configuration validated',
    details: {
      hasEncryptionKey: Boolean(encryptionKey),
      hasOAuthConfig: oauthVarsSet === 3,
      hasRedisUrl: Boolean(redisUrl),
    },
  };
}

/**
 * Check 5: File System Permissions
 * Verifies write access to required directories
 */
async function checkFileSystemPermissions(): Promise<PreflightResult> {
  const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '/tmp';
  const servalSheetsDir = join(homeDir, '.servalsheets');
  const issues: string[] = [];

  // Check if directory exists and is writable
  try {
    if (!existsSync(servalSheetsDir)) {
      // Directory doesn't exist - that's fine, we'll create it
      return {
        passed: true,
        message: 'File system permissions OK (directory will be created)',
        details: { servalSheetsDir, status: 'will-create' },
      };
    }

    // Directory exists, check if writable
    accessSync(servalSheetsDir, fsConstants.W_OK);

    return {
      passed: true,
      message: 'File system permissions OK',
      details: { servalSheetsDir, status: 'writable' },
    };
  } catch (error) {
    issues.push(`Cannot write to ${servalSheetsDir}`);

    return {
      passed: false,
      message: 'File system permission check failed',
      fix: `Grant write permissions: chmod -R 755 ${servalSheetsDir}`,
      details: { servalSheetsDir, error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Check 6: Port Availability
 * Verifies HTTP port is available (HTTP mode only)
 */
async function checkPortAvailability(): Promise<PreflightResult> {
  // Only check port in HTTP mode
  const isHttpMode = process.argv.includes('--http');
  if (!isHttpMode) {
    return {
      passed: true,
      message: 'Port availability check skipped (STDIO mode)',
      details: { mode: 'stdio' },
    };
  }

  const port = parseInt(process.env['HTTP_PORT'] || process.env['PORT'] || '3000', 10);

  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve({
          passed: false,
          message: `Port ${port} is already in use`,
          fix: `Use different port: servalsheets --http --port 8080\nOr kill process: kill $(lsof -ti:${port})`,
          details: { port, error: 'EADDRINUSE' },
        });
      } else {
        resolve({
          passed: false,
          message: `Port check failed: ${err.message}`,
          fix: 'Check network configuration',
          details: { port, error: err.code },
        });
      }
    });

    server.once('listening', () => {
      server.close();
      resolve({
        passed: true,
        message: `Port ${port} is available`,
        details: { port },
      });
    });

    server.listen(port);
  });
}

/**
 * Run all pre-flight checks
 */
export async function runPreflightChecks(): Promise<PreflightResults> {
  // Skip pre-flight checks if explicitly disabled
  if (process.env['SKIP_PREFLIGHT'] === 'true') {
    logger.warn('Pre-flight checks skipped (SKIP_PREFLIGHT=true)');
    return {
      checks: [],
      criticalFailures: 0,
      warnings: 0,
      failures: [],
      warningList: [],
    };
  }

  const checks: PreflightCheck[] = [
    { name: 'Build Artifacts', critical: true, check: checkBuildArtifacts },
    { name: 'Node.js Version', critical: true, check: checkNodeVersion },
    { name: 'Module Resolution', critical: true, check: checkModuleResolution },
    { name: 'Configuration Validation', critical: true, check: checkConfiguration },
    { name: 'File System Permissions', critical: false, check: checkFileSystemPermissions },
    { name: 'Port Availability', critical: false, check: checkPortAvailability },
  ];

  const startTime = Date.now();
  const results: Array<PreflightCheck & { result: PreflightResult }> = [];

  for (const check of checks) {
    try {
      const result = await check.check();
      results.push({ ...check, result });

      if (!result.passed) {
        if (check.critical) {
          logger.error(`Pre-flight check failed: ${check.name}`, {
            message: result.message,
            fix: result.fix,
            details: result.details,
          });
        } else {
          logger.warn(`Pre-flight warning: ${check.name}`, {
            message: result.message,
            fix: result.fix,
            details: result.details,
          });
        }
      } else {
        logger.debug(`Pre-flight check passed: ${check.name}`, { details: result.details });
      }
    } catch (error) {
      // Check threw an exception
      const errorResult: PreflightResult = {
        passed: false,
        message: `Check threw exception: ${error instanceof Error ? error.message : String(error)}`,
        fix: 'Review error details and fix underlying issue',
        details: { error: error instanceof Error ? error.stack : String(error) },
      };

      results.push({ ...check, result: errorResult });

      logger.error(`Pre-flight check exception: ${check.name}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  const duration = Date.now() - startTime;

  const failures = results
    .filter((r) => !r.result.passed && r.critical)
    .map((r) => ({ name: r.name, message: r.result.message, fix: r.result.fix }));

  const warningList = results
    .filter((r) => !r.result.passed && !r.critical)
    .map((r) => ({ name: r.name, message: r.result.message, fix: r.result.fix }));

  const summary: PreflightResults = {
    checks: results,
    criticalFailures: failures.length,
    warnings: warningList.length,
    failures,
    warningList,
  };

  logger.info('Pre-flight checks completed', {
    duration,
    total: results.length,
    passed: results.filter((r) => r.result.passed).length,
    failed: failures.length,
    warnings: warningList.length,
  });

  return summary;
}
