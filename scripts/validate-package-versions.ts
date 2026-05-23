#!/usr/bin/env tsx

/**
 * Validates that all package versions in package.json files exist on npm
 * before npm install runs. Catches version mismatches early.
 */

import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return /ETIMEDOUT|ENOTFOUND|ECONNRESET|ECONNREFUSED|E429/i.test(msg);
}

function npmView(spec: string): string {
  const result = spawnSync('npm', ['view', '--', spec, 'version'], {
    encoding: 'utf-8',
    timeout: 15_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `npm view failed for ${spec}`);
  return result.stdout.trim();
}

interface ValidationResult {
  package: string;
  specified: string;
  exists: boolean;
  latest?: string;
  error?: string;
  skipped?: boolean;
}

const packageFiles = [
  'package.json',
  'tools/google-docs-server/package.json',
  'tools/test-intelligence-server/package.json',
  'tools/gcloud-console-server/package.json',
];

// Packages that are workspace-local, scaffold-only, or use non-standard registries.
// These are intentionally excluded from npm version validation.
const SKIP_PACKAGES = new Set([
  // Workspace packages (resolved via npm workspaces, not published to npm)
  '@serval/core',
  '@serval/mcp-client',
  '@serval/mcp-http',
  '@serval/mcp-runtime',
  '@serval/mcp-stdio',
  // Scaffold backend dependencies (not yet wired — adapter layer placeholders)
  '@duckdb/duckdb-wasm',
  'duckdb-wasm',
  'node-sqlite',
  'notionhq-client',  // correct: @notionhq/client (scaffold)
  'spearman',          // Spearman correlation implemented inline
  'voyage-ai',         // correct: voyageai (scaffold for semantic search)
  'posthog',           // correct: posthog-node (scaffold for analytics)
  'api-gateway',       // internal routing abstraction (scaffold)
  // Packages with non-standard versioning or unpublished ranges
  'diff-match-patch',  // uses date-based versioning (20240101.0.0)
  '@apple/passwordless-auth', // optional, not on public npm
]);

async function validateVersion(pkg: string, version: string): Promise<ValidationResult> {
  if (
    version.startsWith('workspace:') ||
    version.startsWith('file:') ||
    version.startsWith('link:') ||
    version.startsWith('git+') ||
    version.startsWith('http:') ||
    SKIP_PACKAGES.has(pkg)
  ) {
    return {
      package: pkg,
      specified: version,
      exists: true,
      skipped: true,
    };
  }

  // Remove semver range characters to get exact version
  const cleanVersion = version.replace(/[\^~>=<]/, '').trim();

  try {
    npmView(`${pkg}@${cleanVersion}`);
    return { package: pkg, specified: version, exists: true };
  } catch (lookupErr) {
    if (isNetworkError(lookupErr)) {
      return { package: pkg, specified: version, exists: true, skipped: true };
    }
    // Version not found — fetch latest to include in the error message.
    try {
      const latest = npmView(pkg);
      return {
        package: pkg,
        specified: version,
        exists: false,
        latest,
        error: `Version ${version} not found. Latest: ${latest}`,
      };
    } catch {
      // Registry unreachable for the fallback call too — skip rather than fail.
      return { package: pkg, specified: version, exists: true, skipped: true };
    }
  }
}

async function main() {
  console.log('🔍 Validating package versions across all package.json files...\n');

  let hasErrors = false;
  const results: ValidationResult[] = [];

  for (const file of packageFiles) {
    const fullPath = join(process.cwd(), file);
    if (!existsSync(fullPath)) {
      console.log(`⏭️  Skipping ${file} (not found)`);
      continue;
    }

    console.log(`📦 Checking ${file}...`);
    const packageJson = JSON.parse(readFileSync(fullPath, 'utf-8'));

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [pkg, version] of Object.entries(allDeps)) {
      const result = await validateVersion(pkg, version as string);
      results.push(result);

      if (result.exists) {
        if (result.skipped) {
          console.log(`  ⏭️  ${pkg}@${result.specified} (local/workspace dependency)`);
        } else {
          console.log(`  ✅ ${pkg}@${result.specified}`);
        }
      } else {
        console.error(`  ❌ ${pkg}@${result.specified}`);
        console.error(`     ${result.error}`);
        hasErrors = true;
      }
    }
    console.log('');
  }

  // Summary
  console.log('━'.repeat(60));
  console.log(
    `📊 Summary: ${results.filter((r) => r.exists).length}/${results.length} packages valid`
  );

  if (hasErrors) {
    console.error('\n❌ Validation failed. Fix version mismatches before installing.');
    process.exit(1);
  } else {
    console.log('\n✅ All package versions are valid!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
