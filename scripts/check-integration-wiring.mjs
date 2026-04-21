#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function ensureIncludes(source, pattern, message, issues) {
  if (!source.includes(pattern)) {
    issues.push(message);
  }
}

function ensureExists(path, message, issues) {
  if (!existsSync(path)) {
    issues.push(message);
  }
}

function extractStringSet(source, exportName) {
  // Matches legacy inline form: `export const NAME = new Set<...>([ 'a', 'b' ]);`
  // Kept for any remaining inline literal Sets in other files.
  const inlinePattern = new RegExp(
    `export const ${exportName} = new Set(?:<[^>]+>)?\\(\\[([\\s\\S]*?)\\]\\);`,
    'm'
  );
  const match = source.match(inlinePattern);
  if (!match?.[1]) {
    return null;
  }

  const values = [];
  const valuePattern = /'([^']+)'|"([^"]+)"/g;
  for (const entry of match[1].matchAll(valuePattern)) {
    values.push(entry[1] ?? entry[2]);
  }
  return values;
}

/**
 * Extract the canonical mutation action names from the shared constants file.
 * This is the single source of truth both middleware files derive from.
 */
function extractMutationActionNames() {
  const src = read('src/middleware/mutation-actions.constants.ts');
  const pattern = /export const MUTATION_ACTION_NAMES[\s\S]*?=\s*\[([\s\S]*?)\]\s*as\s+const/;
  const match = src.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  const values = [];
  for (const entry of match[1].matchAll(/'([^']+)'|"([^"]+)"/g)) {
    values.push(entry[1] ?? entry[2]);
  }
  return values;
}

/**
 * Verify that a middleware file derives its MUTATION_ACTIONS Set from the
 * shared canonical names list (not from a local inline array).
 */
function usesSharedMutationActionNames(source) {
  return (
    source.includes('MUTATION_ACTION_NAMES') &&
    /new Set[^(]*\(\s*MUTATION_ACTION_NAMES\s*\)/.test(source)
  );
}

function hasDependency(packageJson, dependencyName) {
  // Check direct dependencies in package.json
  if (
    packageJson.dependencies?.[dependencyName] ??
    packageJson.devDependencies?.[dependencyName] ??
    packageJson.optionalDependencies?.[dependencyName] ??
    packageJson.peerDependencies?.[dependencyName]
  ) {
    return true;
  }
  // Also check if available as a transitive dependency (in node_modules or lockfile)
  try {
    const lockfile = JSON.parse(read('package-lock.json'));
    if (lockfile.packages?.[`node_modules/${dependencyName}`]) return true;
    // Check nested lockfile format
    if (lockfile.dependencies?.[dependencyName]) return true;
  } catch {
    // No lockfile or unreadable — fall through to false
  }
  return false;
}

const issues = [];

const httpServer = read('src/http-server.ts');
const httpServerGraphql = read('src/http-server/graphql-admin.ts');
const serverMain = read('src/server.ts');
const envConfig = read('src/config/env.ts');
const graphqlResolvers = read('src/graphql/resolvers.ts');
const formulaEvaluator = read('src/services/formula-evaluator.ts');
const dependenciesHandler = read('src/handlers/dependencies.ts') + read('src/handlers/dependencies-actions/scenario.ts');
const toolHandlers = read('src/mcp/registration/tool-handlers.ts');
const auditMiddleware = read('src/middleware/audit-middleware.ts');
const writeLockMiddleware = read('src/middleware/write-lock-middleware.ts');
const webhookSecurityDoc = read('docs/security/WEBHOOK_SECURITY.md');
const packageJson = JSON.parse(read('package.json'));

// RBAC correctness: middleware must not run without manager initialization.
// Accepts direct call initializeRbacManager() OR delegation via createHttpRbacInitializer({ initializeRbacManager, ... })
ensureIncludes(
  httpServer,
  'initializeRbacManager',
  'RBAC manager is not explicitly initialized in src/http-server.ts.',
  issues
);

// Metrics server wiring: documented flags must be wired through env + runtime startup.
ensureIncludes(
  envConfig,
  'ENABLE_METRICS_SERVER',
  'ENABLE_METRICS_SERVER missing in src/config/env.ts.',
  issues
);
ensureIncludes(
  envConfig,
  'METRICS_PORT',
  'METRICS_PORT missing in src/config/env.ts.',
  issues
);
ensureIncludes(
  envConfig,
  'METRICS_HOST',
  'METRICS_HOST missing in src/config/env.ts.',
  issues
);
ensureIncludes(
  envConfig,
  'ENABLE_BILLING_INTEGRATION',
  'ENABLE_BILLING_INTEGRATION missing in src/config/env.ts.',
  issues
);
ensureIncludes(
  envConfig,
  'STRIPE_SECRET_KEY',
  'STRIPE_SECRET_KEY missing in src/config/env.ts.',
  issues
);
// Accepts direct call startMetricsServer() OR delegation via createHttpServerLifecycle({ startMetricsServer, ... })
ensureIncludes(
  httpServer,
  'startMetricsServer',
  'Dedicated metrics server is not started from src/http-server.ts.',
  issues
);
ensureIncludes(
  httpServer,
  'stopMetricsServer',
  'Dedicated metrics server shutdown is not wired in src/http-server.ts.',
  issues
);

// Dependency wiring guardrail: do not remove strategic runtime dependencies before decision.
if (!hasDependency(packageJson, 'graphql')) {
  issues.push('graphql dependency is missing from package.json.');
}
if (!hasDependency(packageJson, 'hyperformula')) {
  issues.push('hyperformula dependency is missing from package.json.');
}

ensureIncludes(
  httpServerGraphql,
  'addGraphQLEndpoint(',
  'GraphQL endpoint is not wired from src/http-server/graphql-admin.ts.',
  issues
);
ensureIncludes(
  graphqlResolvers,
  "from 'graphql'",
  'graphql package import not found in src/graphql/resolvers.ts.',
  issues
);
ensureIncludes(
  formulaEvaluator,
  "import('hyperformula')",
  'HyperFormula dynamic import missing from src/services/formula-evaluator.ts.',
  issues
);
ensureIncludes(
  dependenciesHandler,
  "services/formula-evaluator.js'",
  'Formula evaluator is not wired into src/handlers/dependencies.ts (or dependencies-actions/).',
  issues
);
ensureIncludes(
  serverMain,
  'initializeBillingIntegration(',
  'Billing integration is not wired from src/server.ts.',
  issues
);
// Accepts direct call or delegation via createHttpRbacInitializer({ initializeBillingIntegration, ... })
ensureIncludes(
  httpServer,
  'initializeBillingIntegration',
  'Billing integration is not wired from src/http-server.ts.',
  issues
);
ensureIncludes(
  toolHandlers,
  'ENABLE_BILLING_INTEGRATION',
  'Cost tracking in tool handlers is not aware of billing integration mode.',
  issues
);
ensureIncludes(
  toolHandlers,
  'invalidateSamplingContext(',
  'Sampling context cache invalidation is not wired from src/mcp/registration/tool-handlers.ts.',
  issues
);
ensureIncludes(
  toolHandlers,
  'getCacheInvalidationGraph().getInvalidationKeys(',
  'Sampling context invalidation is not using cache-invalidation graph signals.',
  issues
);

// Public docs/contracts: if docs reference package subpaths, they must exist in exports.
if (webhookSecurityDoc.includes('servalsheets/utils/webhook-verification')) {
  if (!packageJson.exports || !packageJson.exports['./utils/webhook-verification']) {
    issues.push(
      'Docs reference servalsheets/utils/webhook-verification, but package exports are missing ./utils/webhook-verification.'
    );
  }
}

if (webhookSecurityDoc.includes('servalsheets/security/webhook-signature')) {
  if (!packageJson.exports || !packageJson.exports['./security/webhook-signature']) {
    issues.push(
      'Docs reference servalsheets/security/webhook-signature, but package exports are missing ./security/webhook-signature.'
    );
  }
}

// Strategic integration debt markers: keep these modules until an explicit wire-or-delete decision.
// Note: google-formula-service.ts was intentionally deleted (zero imports, dead code — 2026-04-19)
ensureExists(
  'src/config/action-field-masks.ts',
  'src/config/action-field-masks.ts is missing; delete only after an explicit optimization decision.',
  issues
);
ensureExists(
  'src/utils/webhook-verification.ts',
  'src/utils/webhook-verification.ts is missing; this is a documented webhook security helper.',
  issues
);

// ISSUE-231 / Class-2 regression guard: MUTATION_ACTIONS must use current canonical action names.
// These are the names that WERE stale and caused audit events to never fire.
// As of the de-duplication refactor, the canonical names live in
// `src/middleware/mutation-actions.constants.ts:MUTATION_ACTION_NAMES`. Both
// middleware files derive their Sets from this single source, so drift between
// them is impossible by construction. The two checks below verify:
//   (1) the canonical list still contains the previously-stale action names
//   (2) both middleware files actually derive from the shared list (no
//       sneaky inline literal that would re-introduce drift)
const EXPECTED_MUTATION_ACTIONS = ['write', 'append', 'clear', 'bulk_update', 'find_replace'];
const canonicalMutationActionNames = extractMutationActionNames();
if (!canonicalMutationActionNames) {
  issues.push(
    'Unable to parse MUTATION_ACTION_NAMES from src/middleware/mutation-actions.constants.ts. ' +
      'Has the canonical mutation-actions list been moved or renamed?'
  );
} else {
  for (const actionName of EXPECTED_MUTATION_ACTIONS) {
    if (!canonicalMutationActionNames.includes(actionName)) {
      issues.push(
        `MUTATION_ACTION_NAMES in src/middleware/mutation-actions.constants.ts is missing ` +
          `expected action '${actionName}'. Action may have been renamed without updating the ` +
          'canonical list. See ISSUE-231.'
      );
    }
  }
}

if (!usesSharedMutationActionNames(auditMiddleware)) {
  issues.push(
    'src/middleware/audit-middleware.ts no longer derives MUTATION_ACTIONS from ' +
      'MUTATION_ACTION_NAMES. Re-introducing an inline literal would re-open the ISSUE-231 ' +
      'drift class. Restore `new Set<...>(MUTATION_ACTION_NAMES)`.'
  );
}
if (!usesSharedMutationActionNames(writeLockMiddleware)) {
  issues.push(
    'src/middleware/write-lock-middleware.ts no longer derives MUTATION_ACTIONS from ' +
      'MUTATION_ACTION_NAMES. Re-introducing an inline literal would re-open the ISSUE-231 ' +
      'drift class. Restore `new Set<string>(MUTATION_ACTION_NAMES)`.'
  );
}

// ISSUE-223 regression guard: embedded-oauth.ts must not contain a real-looking credential.
// The placeholder sentinel must be in place. Real secrets must never be committed.
const embeddedOAuth = read('src/config/embedded-oauth.ts');
if (!embeddedOAuth.includes('REPLACE_WITH_')) {
  issues.push(
    'src/config/embedded-oauth.ts no longer contains the expected REPLACE_WITH_ placeholder sentinel. ' +
      'Ensure no real OAuth credentials are committed. See ISSUE-223.'
  );
}

if (issues.length > 0) {
  console.error('Integration wiring check failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('Integration wiring check passed.');
