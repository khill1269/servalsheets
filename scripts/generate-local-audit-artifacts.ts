#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT, 'docs', 'audits', 'artifacts');

type BranchStatus = {
  vs_origin_main?: {
    behind: number;
    ahead: number;
  };
  vs_origin_audit_branch?: {
    behind: number;
    ahead: number;
  };
};

type WorkspacePackageGraph = {
  package_name_imports_in_src: number;
  internal_alias_imports_in_src: number;
  raw_relative_dist_imports_in_src: number;
  status: string;
};

function run(command: string): string {
  return execFileSync('/bin/zsh', ['-lc', command], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function runInt(command: string): number {
  const output = run(command);
  const match = output.match(/-?\d+/);
  if (!match) {
    throw new Error(`Command did not return an integer: ${command}\nOutput: ${output}`);
  }
  return Number(match[0]);
}

function runPair(command: string): [number, number] {
  const output = run(command);
  const matches = [...output.matchAll(/-?\d+/g)].map((match) => Number(match[0]));
  if (matches.length < 2) {
    throw new Error(`Command did not return a numeric pair: ${command}\nOutput: ${output}`);
  }
  return [matches[0], matches[1]];
}

function branchStatus(ref: string, base = 'origin/main'): { behind: number; ahead: number } {
  const [behind, ahead] = runPair(`git rev-list --left-right --count ${base}...${ref}`);
  return { behind, ahead };
}

function currentDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(new Date());
}

function readActionCounts(): { toolCount: number; actionCount: number } {
  const source = readFileSync(path.join(ROOT, 'src', 'generated', 'action-counts.ts'), 'utf8');
  const entries = [...source.matchAll(/^\s+[a-z0-9_]+:\s+(\d+),$/gm)].map((match) => Number(match[1]));
  return {
    toolCount: entries.length,
    actionCount: entries.reduce((sum, count) => sum + count, 0),
  };
}

function readBuildExclusions(): string[] {
  const configPath = path.join(ROOT, 'tsconfig.build.json');
  const parsed = ts.readConfigFile(configPath, ts.sys.readFile);
  if (parsed.error) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext([parsed.error], {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => ROOT,
      getNewLine: () => '\n',
    }));
  }

  return Array.isArray(parsed.config.exclude)
    ? parsed.config.exclude.filter((entry: unknown): entry is string => typeof entry === 'string')
    : [];
}

function workspacePackageGraph(
  packageName: string,
  aliasPrefix: string | null,
  distPrefix: string
): WorkspacePackageGraph {
  const packageImportCount = runInt(
    `rg -n "@serval/${packageName}" src --glob '!**/dist/**' | wc -l`
  );
  const aliasImportCount = aliasPrefix
    ? runInt(`rg -n "#${aliasPrefix}" src --glob '!**/dist/**' | wc -l`)
    : 0;
  const relativeDistImportCount = runInt(
    `rg -n "${distPrefix}" src --glob '!**/dist/**' | wc -l`
  );

  return {
    package_name_imports_in_src: packageImportCount,
    internal_alias_imports_in_src: aliasImportCount,
    raw_relative_dist_imports_in_src: relativeDistImportCount,
    status:
      packageImportCount > 0
        ? 'active'
        : aliasImportCount > 0
          ? 'active-via-internal-alias'
          : 'inactive',
  };
}

function writeJsonArtifact(relativePath: string, value: unknown): void {
  const outputPath = path.join(ARTIFACTS_DIR, relativePath);
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
}

function main(): void {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const actionCounts = readActionCounts();
  const buildExclusions = readBuildExclusions().filter((entry) => entry.startsWith('src/'));
  const [modifiedTrackedEntries, untrackedEntries] = runPair(
    "git status --short | awk 'BEGIN{m=0;u=0} /^[ MARCUDT]/ {m++} /^\\?\\?/ {u++} END {print m, u}'"
  );
  const uiNonVendoredFiles = runInt(
    "find ui/tracing-dashboard \\( -path '*/node_modules' -o -path '*/dist' \\) -prune -o -type f | wc -l"
  );
  const uiRawFiles = runInt('find ui/tracing-dashboard -type f | wc -l');

  const repoManifest = {
    audit_date: currentDate(),
    codebase: 'servalsheets v2.0.0',
    baseline_rules: {
      tracked_repo_truth: 'git ls-files or committed refs',
      working_tree_truth: 'on-disk filesystem state including ignored local artifacts and untracked files',
      note: 'docs/audits/artifacts/ is ignored local output, not canonical tracked documentation',
    },
    metrics: {
      top_level_directories_excluding_git_and_node_modules: {
        value: runInt(
          'find . -maxdepth 1 -mindepth 1 -type d ! -name .git ! -name node_modules | wc -l'
        ),
        command:
          'find . -maxdepth 1 -mindepth 1 -type d ! -name .git ! -name node_modules | wc -l',
      },
      workflow_files: {
        tracked_repo_truth: runInt('git ls-tree -r --name-only HEAD .github/workflows | wc -l'),
        working_tree_truth: runInt(
          "find .github/workflows -maxdepth 1 -type f \\( -name '*.yml' -o -name '*.yaml' \\) | wc -l"
        ),
        commands: [
          'git ls-tree -r --name-only HEAD .github/workflows | wc -l',
          "find .github/workflows -maxdepth 1 -type f \\( -name '*.yml' -o -name '*.yaml' \\) | wc -l",
        ],
      },
      workflow_yaml_lines: {
        tracked_repo_truth: runInt(
          "git ls-tree -r --name-only HEAD .github/workflows | while read -r f; do git show HEAD:\"$f\" | wc -l; done | awk '{sum += $1} END {print sum}'"
        ),
        working_tree_truth: runInt(
          "find .github/workflows -maxdepth 1 -type f \\( -name '*.yml' -o -name '*.yaml' \\) -print0 | xargs -0 wc -l | tail -n 1"
        ),
        commands: [
          "git ls-tree -r --name-only HEAD .github/workflows | while read -r f; do git show HEAD:\"$f\" | wc -l; done | awk '{sum += $1} END {print sum}'",
          "find .github/workflows -maxdepth 1 -type f \\( -name '*.yml' -o -name '*.yaml' \\) -print0 | xargs -0 wc -l | tail -n 1",
        ],
      },
      scripts: {
        tracked_repo_truth: runInt('git ls-files scripts | wc -l'),
        working_tree_truth: runInt('find scripts -type f | wc -l'),
        commands: ['git ls-files scripts | wc -l', 'find scripts -type f | wc -l'],
      },
      docs_files: {
        tracked_repo_truth: runInt("git ls-files | rg '^docs/' | wc -l"),
        working_tree_truth: runInt('find docs -type f | wc -l'),
        commands: ["git ls-files | rg '^docs/' | wc -l", 'find docs -type f | wc -l'],
      },
      npm_scripts: {
        tracked_repo_truth: runInt(
          "git show HEAD:package.json | node -e \"let input=''; process.stdin.on('data', (chunk) => input += chunk); process.stdin.on('end', () => { const pkg = JSON.parse(input); console.log(Object.keys(pkg.scripts || {}).length); });\""
        ),
        working_tree_truth: runInt(
          "node -e \"const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).length)\""
        ),
        commands: [
          "git show HEAD:package.json | node -e \"let input=''; process.stdin.on('data', (chunk) => input += chunk); process.stdin.on('end', () => { const pkg = JSON.parse(input); console.log(Object.keys(pkg.scripts || {}).length); });\"",
          "node -e \"const p=require('./package.json'); console.log(Object.keys(p.scripts||{}).length)\"",
        ],
      },
      workspace_packages: {
        tracked_repo_truth: runInt('find packages -maxdepth 1 -mindepth 1 -type d | wc -l'),
        command: 'find packages -maxdepth 1 -mindepth 1 -type d | wc -l',
      },
      deployment_files: {
        tracked_repo_truth: runInt("git ls-files deployment | wc -l"),
        working_tree_truth: runInt('find deployment -type f | wc -l'),
        commands: ['git ls-files deployment | wc -l', 'find deployment -type f | wc -l'],
      },
      tool_and_action_counts: {
        tracked_repo_truth: {
          tool_count: actionCounts.toolCount,
          action_count: actionCounts.actionCount,
        },
        command: 'parse src/generated/action-counts.ts',
      },
    },
    branch_status: {
      audit_session_110_fixes: {
        vs_origin_main: branchStatus('audit/session-110-fixes'),
        vs_origin_audit_branch: branchStatus(
          'audit/session-110-fixes',
          'origin/audit/session-110-fixes'
        ),
      } satisfies BranchStatus,
      main: {
        vs_origin_main: branchStatus('main'),
      } satisfies BranchStatus,
      main_cleanup_ci_devops: {
        vs_origin_main: branchStatus('main-cleanup-ci-devops'),
      } satisfies BranchStatus,
      main_cleanup_docs_hygiene: {
        vs_origin_main: branchStatus('main-cleanup-docs-hygiene'),
      } satisfies BranchStatus,
      main_cleanup_runtime: {
        vs_origin_main: branchStatus('main-cleanup-runtime'),
      } satisfies BranchStatus,
    },
    working_tree_status: {
      modified_tracked_entries: modifiedTrackedEntries,
      untracked_entries: untrackedEntries,
      command: 'git status --porcelain=v1',
    },
    corrections: [
      '`tools/` is not a gitignore gap; it is a tracked-plus-ignored mixed boundary',
      'All workspace packages are consumed by the runtime; the non-core packages now resolve through root `#mcp-*` aliases instead of raw relative dist imports',
      '`src/knowledge/` and `src/templates/` are active modules, not empty directories',
      'The stale non-UI build exclusions were removed from tsconfig.build.json; the remaining src-level exclusion is test-only src/__tests__/**',
      'Adapter backends other than Google Sheets are experimental/gated, not unwired dead code',
      'Compatibility shims in src/ should not be deleted without an explicit import-compat policy',
      'The tracing dashboard now lives under ui/tracing-dashboard instead of being embedded under src/, and its canonical root build still emits to dist/ui/tracing',
      '`src/handlers/bigquery.ts.bak` and `src/test_perm_check.ts` are ignored working-tree artifacts, not tracked dead source files',
      '`perf:memory-leaks` now points at a live audit test, and the debugging guide uses supported health and circuit-breaker endpoints',
      '`monitor:health` and `test:health` now run a live in-process health-surface check instead of placeholder echoes',
      '`perf:update-baselines` now runs the supported baseline flow, and PERF_BASELINE mode no longer skips the regression suite',
      'Orphaned package test aliases for nonexistent tests/plugins and tests/transports were removed, and the local package-script path scan is now clean',
      'A docs scan against package.json now reports 0 missing npm run references after updating runbooks, guides, remediation notes, migrations docs, and historical audit references',
      'check:npm-run-refs now guards docs and workflow script references automatically, and docs-validation.yml runs it when docs, workflows, package.json, or the checker itself changes',
      'The local JSON audit artifacts are now regenerated by scripts/generate-local-audit-artifacts.ts instead of being hand-maintained',
      'The working tree now removes claude-fix.yml, benchmark.yml, performance-tracking.yml, dependency-validation.yml, deploy-dashboard.yml, sync-docs.yml, audit-106.yml, actionlint.yml, file-size-check.yml, validate-server-json.yml, and scorecards.yml; committed workflow truth stays on HEAD until those deletions are committed',
      'dashboard:generate and scripts/generate-dashboard.ts were removed after confirming the dashboard template/app no longer exists, and scripts/sync-audit-to-docs.ts was removed as an orphaned legacy helper',
      'check:script-paths now guards package.json repo-local script references so missing scripts/, tests/, src/, or dashboard/ paths fail early in verify and verify:safe',
      'The stale root skill/ directory is no longer part of the npm publish files list, its last tracked file was removed from the current working tree after a no-reference scan, docs/README now points at docs/guides/SKILL.md, and internal comments now reference real guide:// resources instead of the nonexistent resource://skill/servalsheets URI',
      'database/schema.sql had no in-repo path references and was relocated into deployment/database/schema.sql in the current working tree; the tracked deployment baseline stays on HEAD until that move is committed',
      'The former root k8s/ operator tree was relocated into deployment/k8s-operator/ in the current working tree, dependabot and deployment docs were updated to match, and the operator package now uses a local logger instead of reaching into src/utils/logger.ts',
      'Manual Kubernetes manifests and operator-generated server deployments now use /health/live and /health/ready probes, and the operator deployment manifest no longer claims nonexistent /healthz or /readyz endpoints',
    ],
  };

  const buildGraph = {
    audit_date: currentDate(),
    baseline_rules: {
      tracked_repo_truth: 'git ls-files or committed refs',
      working_tree_truth: 'on-disk filesystem state',
    },
    entrypoints: {
      'src/cli.ts': {
        transport: 'CLI dispatcher',
        status: 'active',
      },
      'src/server.ts': {
        transport: 'STDIO',
        status: 'active',
      },
      'src/http-server.ts': {
        transport: 'HTTP/SSE/Express',
        status: 'active',
      },
      'src/index.ts': {
        transport: 'Library barrel',
        status: 'active',
      },
      'src/oauth-provider.ts': {
        transport: 'Compatibility shim for OAuth provider',
        status: 'active-compatibility-surface',
      },
      'src/remote-server.ts': {
        transport: 'Compatibility shim for remote server startup',
        status: 'active-compatibility-surface',
      },
    },
    workspace_packages: {
      '@serval/core': workspacePackageGraph('core', null, 'packages/serval-core/dist'),
      '@serval/mcp-client': workspacePackageGraph('mcp-client', 'mcp-client', 'packages/mcp-client/dist'),
      '@serval/mcp-http': workspacePackageGraph('mcp-http', 'mcp-http', 'packages/mcp-http/dist'),
      '@serval/mcp-runtime': workspacePackageGraph('mcp-runtime', 'mcp-runtime', 'packages/mcp-runtime/dist'),
      '@serval/mcp-stdio': workspacePackageGraph('mcp-stdio', 'mcp-stdio', 'packages/mcp-stdio/dist'),
    },
    build_pipeline: {
      module_system: 'ESM (NodeNext)',
      tsconfig_chain: [
        'tsconfig.json (typecheck / noEmit)',
        'tsconfig.build.json (emit)',
        'tsconfig.eslint.json (lint scope)',
      ],
      build_exclusions: {
        active_paths: buildExclusions,
      },
      notes: [
        'The root runtime now uses a root-level `#mcp-*` alias contract that still targets packaged dist outputs',
        'The staged runtime package copies that alias map and normalizes bundled @serval workspace dependencies to local file references',
        'The tracing dashboard is now a dedicated root UI app under ui/tracing-dashboard instead of an embedded source subtree under src/',
        'The canonical tracing dashboard build now emits to dist/ui/tracing from the repo root',
        'The schema/discovery CLI files now compile under the canonical build and are no longer excluded from tsconfig.build.json',
      ],
    },
    dependency_flow: {
      runtime_core: [
        'cli.ts -> server.ts / http-server.ts',
        'server.ts -> handlers/* -> services/* -> googleapis',
        'http-server.ts -> #mcp-http/* -> packages/mcp-http/dist/*',
        'server/* -> #mcp-runtime/* and #mcp-stdio/* -> packages/*/dist/*',
        'services/federated-mcp-client.ts -> #mcp-client/* -> packages/mcp-client/dist/*',
      ],
      ui_note: `ui/tracing-dashboard is the dedicated tracing UI app; count ${uiNonVendoredFiles} non-vendored files separately from ${uiRawFiles} raw on-disk files`,
    },
    corrections: [
      'The older build graph understated workspace package usage',
      'oauth-provider.ts and remote-server.ts are compatibility surfaces, not dead entrypoints',
      'The stale non-UI build exclusions were removed; tsconfig.build.json now keeps only test-only src/__tests__/**',
      'Raw relative packages/*/dist imports in src/ were replaced with root #mcp-* aliases and staged-package propagation',
      'build_graph.json is now regenerated by scripts/generate-local-audit-artifacts.ts',
    ],
  };

  writeJsonArtifact('repo_manifest.json', repoManifest);
  writeJsonArtifact('build_graph.json', buildGraph);

  console.log('Wrote local audit artifacts:');
  console.log(`- ${path.relative(ROOT, path.join(ARTIFACTS_DIR, 'repo_manifest.json'))}`);
  console.log(`- ${path.relative(ROOT, path.join(ARTIFACTS_DIR, 'build_graph.json'))}`);
}

main();
