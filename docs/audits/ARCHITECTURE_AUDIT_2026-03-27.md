# ServalSheets Monorepo - Re-baselined Architectural Audit

**Date:** 2026-03-27  
**Scope:** repo shape, build system, CI, package usage, cleanup priorities  
**Version:** ServalSheets v2.0.0

## Baseline Rules

- **Tracked repo truth** means paths and counts derived from `git ls-files` or committed refs such as `HEAD` / `origin/main`.
- **Working tree truth** means what is currently on disk from `find`, `rg`, `du`, and `git status`, including ignored local artifacts and untracked files.
- **Branch/worktree context** is part of the audit because the current checkout is not a clean baseline.
- Files under `docs/audits/artifacts/` are ignored local analysis outputs, not canonical tracked docs.

## Executive Summary

- The core runtime picture remains strong: `25` tools, `407` actions, `5` workspace packages, and `43` tracked deployment files are still supported by the repo.
- The earlier audit overstated or misstated several hygiene risks by mixing tracked state with ignored local artifacts.
- The largest corrections are around `tools/`, workspace package usage, empty-module claims, build exclusions, deployment layout, adapter wiring, and the extraction of the tracing UI out of `src/`.
- The current branch is not a neutral reference point. `audit/session-110-fixes` is both dirty and far from `origin/main`, so every repo-shape metric must be labeled by baseline.

## Branch And Worktree Status

| Ref | Kind | Status | Commands |
|-----|------|--------|----------|
| `audit/session-110-fixes` | Current worktree | `136` behind / `375` ahead vs `origin/main`; `1` ahead vs `origin/audit/session-110-fixes`; working tree has `538` modified tracked entries and `29` untracked entries | `git rev-list --left-right --count origin/main...audit/session-110-fixes`; `git rev-list --left-right --count origin/audit/session-110-fixes...audit/session-110-fixes`; `git status --porcelain=v1` |
| `main` | Linked worktree | `1` behind / `0` ahead vs `origin/main` | `git rev-list --left-right --count origin/main...main` |
| `main-cleanup-ci-devops` | Linked worktree | `0` behind / `4` ahead vs `origin/main` | `git rev-list --left-right --count origin/main...main-cleanup-ci-devops` |
| `main-cleanup-docs-hygiene` | Linked worktree | `0` behind / `1` ahead vs `origin/main` | `git rev-list --left-right --count origin/main...main-cleanup-docs-hygiene` |
| `main-cleanup-runtime` | Linked worktree | `0` behind / `3` ahead vs `origin/main` | `git rev-list --left-right --count origin/main...main-cleanup-runtime` |

Linked worktrees were verified with `git worktree list --porcelain`.

## Metric Baseline

| Metric | Tracked repo truth | Working tree / local truth | Commands |
|--------|--------------------|----------------------------|----------|
| Top-level directories | N/A | `37` directories when excluding `.git/` and `node_modules/` | `find . -maxdepth 1 -mindepth 1 -type d ! -name .git ! -name node_modules | wc -l` |
| Workflow files | `28` tracked in `HEAD` | `18` files on disk | `git ls-tree -r --name-only HEAD .github/workflows | wc -l`; `find .github/workflows -maxdepth 1 -type f | wc -l` |
| Workflow YAML lines | `4377` tracked lines in `HEAD` | `3748` on-disk lines | `git ls-tree -r --name-only HEAD .github/workflows | while read -r f; do git show HEAD:"$f" | wc -l; done | awk '{sum += $1} END {print sum}'`; `find .github/workflows -maxdepth 1 -type f | xargs wc -l | tail -n 1` |
| Script files | `164` tracked | `192` on disk | `git ls-files | rg '^scripts/' | wc -l`; `find scripts -type f | wc -l` |
| Docs files | `173` tracked | `658` on disk | `git ls-files | rg '^docs/' | wc -l`; `find docs -type f | wc -l` |
| npm scripts | `333` committed | `338` in current working tree | `git show HEAD:package.json | node ...`; `node -e "const p=require('./package.json'); ..."` |
| Workspace packages | `5` | `5` | `find packages -maxdepth 1 -mindepth 1 -type d | wc -l` |
| Deployment files | `43` tracked in `HEAD` | `55` on disk | `git ls-files deployment | wc -l`; `find deployment -type f | wc -l` |
| Tool and action counts | `25` tools / `407` actions | same | parse `src/generated/action-counts.ts` |
| `ui/tracing-dashboard` | `0` tracked files in `HEAD` at the new root path | `24` files on disk under the extracted root UI app; `src/ui/` is now `1` file (`tracing.ts`) in the working tree | `git ls-files ui/tracing-dashboard | wc -l`; `find ui/tracing-dashboard -type f | wc -l`; `find src/ui -type f | wc -l` |

## Corrected Findings

1. `tools/` is **not** a current gitignore gap.
   - `tools/` is no longer ignored as an untracked leak scenario; instead it contains `16` tracked files and `494M` on disk.
   - `tools/` is also absent from the publish `files` array in `package.json`, so the npm-publish risk is weaker than the earlier audit claimed.

2. The workspace-package story was materially wrong and has now been partially formalized.
   - `@serval/core` is imported by package name in `src/` (`27` matches).
   - `@serval/mcp-client`, `@serval/mcp-http`, `@serval/mcp-runtime`, and `@serval/mcp-stdio` are now consumed through root package-internal `#mcp-*` aliases in `src/` (`2`, `33`, `9`, and `24` matches respectively).
   - Raw relative `packages/*/dist` imports in `src/` are now `0`.
   - `package.json#imports` now records the alias contract, and `scripts/stage-runtime-package.mjs` propagates it into the staged runtime package while normalizing bundled `@serval/*` workspace dependencies to local `file:` references.
   - The remaining issue is architectural coupling to built package outputs, not "four unused packages."

3. `src/knowledge/` and `src/templates/` are active.
   - Tracked repo truth shows `19` files in `src/knowledge/` and `1` in `src/templates/`.
   - The on-disk worktree currently has `55` files in `src/knowledge/` and `1` in `src/templates/`.
   - The prior recommendation to delete them as empty modules is invalid.

4. The non-UI build exclusions have now been cleaned up.
   - `tsconfig.build.json` no longer excludes `src/utils/protocol-tracer.ts`, `src/services/discovery-client.ts`, `src/services/schema-cache.ts`, `src/services/schema-validator.ts`, or `src/cli/schema-manager.ts`.
   - A targeted probe compile for those four files passed, and the canonical `tsconfig.build.json` build also passed after removing them.
   - The remaining `src/` exclusion is test-only `src/__tests__/**`.

5. The adapter layer is experimental/gated, not dead.
   - Google Sheets remains the only production backend.
   - Excel, Notion, and Airtable are exported, gated behind `ENABLE_EXPERIMENTAL_BACKENDS`, and partially wired through `src/adapters/backend-router.ts`.
   - "Never wired" was too strong.

6. Compatibility shims should not be deleted casually.
   - `src/oauth-provider.ts` explicitly says it preserves backward compatibility and is still part of the package export surface.
   - `src/remote-server.ts` explicitly says it is retained for backward compatibility.
   - "Zero repo importers" is not sufficient evidence for safe deletion.

7. The tracing UI cleanup is now implemented in the current working tree.
   - The dashboard app now lives at root `ui/tracing-dashboard/`.
   - `src/ui/` is down to the runtime bridge file in the working tree instead of carrying the app itself.
   - The canonical repo-root UI build is still `npm run build:ui`, and the runtime fallback path now resolves the extracted app from `ui/tracing-dashboard/dist`.

8. The test-count narrative is stale.
   - The current tree has `564` `.test.ts` / `.spec.ts` files, `5` `.bench.ts` files, and `62` files under `tests/live-api/`.
   - The earlier `2784` test-case figure is no longer a credible current baseline.

9. The old "tracked dead source files" claim needs one more baseline correction.
   - `src/handlers/bigquery.ts.bak` exists on disk and is `1964` lines, but it is ignored by `*.bak` and is not tracked by Git.
   - `src/test_perm_check.ts` also exists locally as an ignored scratch file and is not tracked.
   - These are working-tree artifacts, not current tracked dead source in the repo baseline.

10. One broken performance script was restored to a live target.
   - `perf:memory-leaks` now runs `tests/audit/memory-leaks.test.ts`, which exists and passes.
   - `docs/guides/DEBUGGING.md` no longer points users at the removed `monitor:health` placeholder when checking circuit breaker status.

11. The remaining health-script placeholders were replaced with a live in-process check.
   - `monitor:health` and `test:health` now run `scripts/check-health-surface.ts`.
   - The script verifies `GET /health/live`, `GET /health/ready`, `GET /health`, and `HEAD /health` against the current HTTP server route surface without requiring a separately running server.

12. The last explicit performance-script placeholder was restored to the supported baseline flow.
   - `perf:update-baselines` now aliases `perf:baseline`.
   - The regression suite gate was corrected so `PERF_BASELINE=true` actually runs the tests instead of skipping the suite.
   - The command now writes `.performance-history/baseline.json` and a timestamped history snapshot as intended.

13. Two orphaned test aliases were removed from the package surface.
   - `test:plugins` pointed at nonexistent `tests/plugins`.
   - `test:websocket` pointed at nonexistent `tests/transports`.
   - The package-script local-path scan is now clean again for `scripts/`, `tests/`, and `src/` references.

14. Docs command drift around the package-script surface has been cleaned up.
   - `docs/guides/PHASE_3_USER_GUIDE.md` now marks WebSocket and plugin flows as historical/aspirational and no longer tells users to run nonexistent `plugin:*` commands.
   - Runbooks, compliance docs, migrations docs, remediation notes, and example docs were updated to use current scripts or to mark planned/deployment-specific commands explicitly.
   - A docs scan against `package.json` now finds `0` missing `npm run <script>` references in `docs/`.

15. Docs and workflow script-reference drift is now guarded automatically.
   - `package.json` now exposes `check:npm-run-refs`, and both `verify` and `verify:safe` include it.
   - `.github/workflows/docs-validation.yml` now watches workflow and package-script surface changes and runs `npm run check:npm-run-refs`.
   - The latest pass validated `225` files across `docs/` and `.github/workflows/`.

16. The local JSON audit artifacts are now generated instead of hand-maintained.
   - `scripts/generate-local-audit-artifacts.ts` now regenerates `docs/audits/artifacts/repo_manifest.json` and `docs/audits/artifacts/build_graph.json`.
   - This keeps the ignored machine-readable baseline aligned with the tracked markdown audit after repo-shape changes.

17. Workflow rationalization has moved further in the current working tree.
   - The local tree now removes `claude-fix.yml`, `benchmark.yml`, `performance-tracking.yml`, `dependency-validation.yml`, `deploy-dashboard.yml`, `sync-docs.yml`, `audit-106.yml`, `actionlint.yml`, `file-size-check.yml`, `validate-server-json.yml`, and `scorecards.yml`.
   - `ci.yml` now absorbs workflow lint and the standalone repo-hygiene checks.
   - `security.yml` now absorbs OpenSSF Scorecards with the original main/scheduled/manual behavior preserved at the job level.
   - `performance.yml` and `architecture.yml` explicitly document the consolidation of the performance and dependency-validation surfaces.
   - `deploy-dashboard.yml` depended on a missing `dashboard/` app, `sync-docs.yml` no longer matched the current `docs:sync` command, `audit-106.yml` no longer matched the current audit-report pipeline shape, and the remaining four deleted workflows were already functionally folded into `ci.yml` or `security.yml`.
   - Until those deletions are committed, workflow tracked-repo truth still comes from `HEAD` and remains higher than the on-disk local count.

18. Two dead script surfaces were removed from the working tree.
   - `dashboard:generate` and `scripts/generate-dashboard.ts` were removed after confirming `dashboard/template.html` and the `dashboard/` app are gone.
   - `scripts/sync-audit-to-docs.ts` was removed as an orphaned legacy helper after `docs:sync` was repointed elsewhere and no references remained.

19. Package-script path drift is now guarded automatically.
   - `check:script-paths` now validates repo-local `scripts/`, `tests/`, `src/`, and `dashboard/` references inside `package.json` scripts.
   - Both `verify` and `verify:safe` now include that check so broken local-path commands fail before CI or manual runs drift further.

20. The stale root `skill/` surface has been removed from active repo guidance.
   - The canonical skill guide is [docs/guides/SKILL.md], not a nonexistent root `SKILL.md`.
   - `package.json#files` no longer publishes the stale root `skill/` directory.
   - The last tracked file under `skill/` was removed from the current working tree after confirming there were no remaining in-repo references to it.
   - Internal comments now point at real `guide://...` resources instead of the nonexistent `resource://skill/servalsheets` URI.

21. The orphaned root database schema has been relocated in the current working tree.
   - `database/schema.sql` had no in-repo path references.
   - The current working tree now carries that file at `deployment/database/schema.sql`, which better matches the intended deployment-oriented layout.
   - Tracked repo truth still reflects the old root path until that move is committed.

22. The root Kubernetes operator surface has been relocated under `deployment/` in the current working tree.
   - The former root `k8s/` tree now lives at `deployment/k8s-operator/`, so the root directory count dropped again.
   - `.github/dependabot.yml`, `docs/deployment/kubernetes.md`, and deployment/runbook references were updated to point at the new location.
   - The operator package no longer reaches into `src/utils/logger.ts`; it now uses a local logger helper, which removes the repo-internal typecheck coupling introduced by the old location.
   - Tracked repo truth still reflects the old `k8s/` paths until that relocation is committed.

23. The Kubernetes health-probe surface now matches the verified runtime endpoints.
   - `deployment/k8s/deployment.yaml` now probes `/health/live` and `/health/ready` instead of using `/health` for both states.
   - The operator controller now generates managed server deployments with the same `/health/live` and `/health/ready` probes.
   - The operator's own deployment manifest no longer advertises nonexistent `:8080 /healthz` and `/readyz` endpoints.
   - Deployment docs were updated to reflect the verified health contract rather than stale aliases.

## Runtime Sections Still Valid

- `25` tool handlers / `407` actions remains correct.
- The 5-package workspace structure remains correct.
- `deployment/` still contains the expected deployment stack; the corrected baseline is `43` tracked files in `HEAD` and `56` on disk in the current working tree.
- The tracked workflow baseline of `28` files / `4377` YAML lines in `HEAD` is correct.
- `.env`, `.env.local`, `.DS_Store`, `.mcp.json`, `.vscode/`, and `.secrets/` are ignored and untracked.
- OAuth, SAML, and RBAC surfaces remain implemented in source; the overstatement was around repo hygiene, not absence of security code.

## Corrected Cleanup Priorities

1. Keep the audit documentation pinned to tracked-vs-working-tree baselines.
2. Decide whether `tools/` is part of the monorepo boundary or should be extracted; do not treat it as a simple gitignore issue.
3. Keep the `#mcp-*` alias contract documented, and decide later whether dist-backed package internals should migrate to true package-name imports or source-level workspace boundaries.
4. Keep the build exclusion list minimal.
   - Under `src/`, `tsconfig.build.json` now excludes only test-only `src/__tests__/**`.
5. Commit the extracted tracing UI layout.
   - The current working tree already moves the app to `ui/tracing-dashboard/`.
   - The remaining task is to land that move so `HEAD` and the working tree stop disagreeing about where the UI lives.
6. Revisit compatibility shims only after published import policy is explicit.
7. Rationalize workflows and scripts using the corrected tracked/on-disk counts.
   - The immediate package-script drift is smaller now that the two orphaned test aliases were removed.
   - The local working tree has already pruned eleven obsolete or fully absorbed workflows, but the committed baseline still remains at `28` until those deletions land.
   - The local script surface dropped two dead entries and added one guard script, leaving the on-disk script count at `192` and the working-tree npm script count at `338`.
8. Keep validating `npm run` references across `docs/` against the current package script surface.
   - The current docs/workflow scan is clean, and the check is now automated through `check:npm-run-refs`, `verify`, `verify:safe`, and `docs-validation.yml`.
9. Regenerate the local audit JSONs whenever the markdown audit moves.
   - `node --import tsx scripts/generate-local-audit-artifacts.ts` now refreshes `repo_manifest.json` and `build_graph.json` from current repo state.
10. Keep deployment-path claims baseline-aware.
   - `deployment/` now has a tracked/on-disk split too: `43` tracked files in `HEAD` versus `55` on disk locally.
   - The local drift currently comes from four untracked Grafana dashboard JSON files, the relocated `deployment/database/schema.sql`, and the moved `deployment/k8s-operator/` tree.
11. Keep deployment manifests and docs aligned with the verified health surface.
   - The verified contract is `/health/live`, `/health/ready`, `GET /health`, and `HEAD /health`.
   - Manual K8s manifests and operator-generated server deployments now use the explicit liveness/readiness endpoints instead of collapsing both states onto `/health`.

## Notes On Supporting Artifacts

- `docs/audits/artifacts/target_architecture.md` is now treated as a target-state planning note, not current-state truth.
- `docs/audits/artifacts/module_inventory.md`, `ci_rationalization.md`, `risk_register.md`, and `cleanup_backlog.md` were re-baselined alongside this document.
- `docs/audits/artifacts/repo_manifest.json` and `build_graph.json` are now regenerated by `scripts/generate-local-audit-artifacts.ts`.

## Verification Notes

- `npx tsc -p tsconfig.json --noEmit --pretty false` passed after the alias migration.
- `node --input-type=module -e "import('#mcp-http/create-http-server').then(() => console.log('ok'))"` resolved successfully from the repo root.
- `node scripts/stage-runtime-package.mjs /private/tmp/servalsheets-runtime-imports-smoke2` completed successfully.
- The staged runtime package manifest was verified to use local `file:` references for all bundled `@serval/*` packages.
- `node --input-type=module -e "import('#mcp-http/create-http-server').then(() => console.log('ok'))"` also resolved successfully from `/private/tmp/servalsheets-runtime-imports-smoke2`.
- `npm run build:ui` passed after vendoring the `d3-flame-graph` CSS and aligning the import with the library's default export.
- `npm run ui:typecheck` and `npm run ui:build` also passed after the tracing dashboard script cleanup.
- `node --import tsx scripts/generate-local-audit-artifacts.ts` was rerun after the workflow deletions, deployment probe alignment, and tracing UI extraction so the local JSON audit artifacts match the current working tree again.
- `npm run perf:memory-leaks` passed (`1` file, `5` tests) after repointing it to the live audit test.
- `npm run monitor:health` and `npm run test:health` both passed after replacing the placeholder with `scripts/check-health-surface.ts`.
- `npm run perf:update-baselines` passed after fixing the `PERF_BASELINE` gate, and it wrote `.performance-history/baseline.json` plus a history entry.
- A package-script local-path scan now returns no missing `scripts/`, `tests/`, or `src/` paths after removing `test:plugins` and `test:websocket`.
- A docs scan against `package.json` now reports `0` missing script names after correcting the stale runbook, guide, remediation, migrations, and historical audit references.
- `npm run check:npm-run-refs` now passes and reports `225` validated files across `docs/` and `.github/workflows/`.
- `npm run check:script-paths` now passes and confirms that package.json repo-local script paths are valid.
- `node --import tsx scripts/generate-local-audit-artifacts.ts` now regenerates `docs/audits/artifacts/repo_manifest.json` and `docs/audits/artifacts/build_graph.json`.
- A targeted TypeScript probe for `src/services/discovery-client.ts`, `src/services/schema-cache.ts`, `src/services/schema-validator.ts`, and `src/cli/schema-manager.ts` passed, and `npx tsc -p tsconfig.build.json --noEmit --pretty false` also passed after removing those four build exclusions.
- `npm --prefix deployment/k8s-operator/operator run typecheck` now fails only on missing local installation of `@kubernetes/client-node`; the relocation-specific cross-project logger and `rootDir` errors were removed.
- `npm run monitor:health` still passes and confirms `/health/live`, `/health/ready`, `/health`, and `HEAD /health` are healthy after the deployment probe updates.
