# ServalSheets CI/CD Workflow Audit

**Date:** 2026-04-30  
**Scope:** All 28 workflow files under `.github/workflows/`  
**Methodology:** `actionlint` + `zizmor` (Astral) + manual review against 2025–2026 best-practice references

## Executive summary

| Metric | Before | After patch set | Change |
|---|---|---|---|
| Total findings (zizmor) | 140 | 66 | −53% |
| `artipacked` (credential persistence) | 63 | 1 | −62 |
| `excessive-permissions` | 5 | 0 | −5 |
| `template-injection` (high-confidence shell/JS) | 4 high-sev | 0 | −4 |
| `cache-poisoning` | 28 | 28 | unchanged (manual fix templated) |
| `dangerous-triggers` (`workflow_run`) | 5 | 5 | unchanged (structural — see Tier S) |
| `actionlint` syntax errors | 0 | 0 | clean throughout |

## Patch set applied (mechanical)

1. **`persist-credentials: false` sweep** across 26/28 files, 62 checkouts hardened. Exempted: `sync-docs.yml` (uses explicit token to push), `scorecards.yml` (already had it).
2. **Workflow-level write permissions reduced to read-only** in `deploy-dashboard.yml`, `docs.yml`, `performance-tracking.yml`. Write scopes (`pages: write`, `id-token: write`, `issues: write`) moved to the specific job that needs them.
3. **High-risk template-injection sites converted to `env:` pattern**:
   - `claude.yml` — added `comment.author_association` actor check (only OWNER/MEMBER/COLLABORATOR can trigger via `@claude` mention)
   - `mcp-protocol-test.yml` — `inputs.tool_filter` → `env: TOOL_FILTER`
   - `schema-check.yml` — `inputs.api` → `env: API_FILTER`
   - `auto-draft-pr.yml` — `steps.commits.outputs.summary` → `process.env.COMMIT_SUMMARY`
   - `live-api-triage.yml` — `inputs.artifact_run_id` → `process.env.INPUT_RUN_ID`

## Tier S — manual review required

These cannot be safely auto-patched. Each requires a human decision.

### `deploy-demo.yml` — workflow_run + checkout of attacker-controlled SHA

```yaml
on:
  workflow_run:
    workflows: ['CI']
    types: [completed]
# ...
- uses: actions/checkout@<SHA>
  with:
    ref: ${{ github.event.workflow_run.head_sha || github.sha }}  # ← attacker-controlled
    persist-credentials: false
- run: |
    docker build -f deployment/demo/Dockerfile ...  # ← runs against attacker code
- # ... gcloud push
```

**Why dangerous:** `workflow_run` runs in default-branch context with secrets, but `head_sha` is the PR commit. A fork-PR contributor controls the `Dockerfile` and can exfiltrate `GCP_WORKLOAD_IDENTITY_PROVIDER` during `docker build`.

**Recommended fix:** Drop `workflow_run`. Use:
```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```
Always deploy from the merged commit, never from PR head.

### `claude.yml` — patched but worth a second look

The patch adds `comment.author_association` filtering, but Claude Code still has `contents: write`, `pull-requests: write`, `issues: write`, `id-token: write`, and `ANTHROPIC_API_KEY`. Consider:

1. Use a fine-grained GitHub App token instead of `GITHUB_TOKEN` to scope writes to specific repos.
2. Wire `harden-runner` in `block` mode with an egress allowlist for `api.anthropic.com` only.

### `sync-docs.yml` — privileged auto-commit on workflow_run

Triggers from "106-Category Audit" workflow_run, has `contents: write` + `pull-requests: write`, runs `npm run docs:sync` and commits. If the audit workflow ever processes untrusted content, this becomes a write-amplifier. Recommended: drop the `workflow_run` trigger; rely on `push: branches: [main]` and the manual dispatch path only.

### `ci-health.yml`, `deploy-dashboard.yml` — workflow_run pattern

Both are flagged by zizmor as "fundamentally insecure trigger" but in practice are safer than deploy-demo because they don't check out the PR head. Document the pattern as known-safe with a comment block at the top of each file referring to GitHub Security Lab's [keeping your Actions secure series](https://securitylab.github.com/resources/github-actions-new-patterns-and-mitigations/).

## Tier A — cache poisoning hardening (templated)

`ci.yml` has 7 `actions/cache@v5` use-sites; `test-gates.yml` and `performance.yml` add more. All currently allow PR runs to write to the cache that subsequent push-to-main runs read from. The 2024–2025 attack research (Adnan Khan, GitHub Security Lab, Apache Arrow #49730) recommends **read-only caches on PRs, write-only on trusted refs**.

### Template (apply to each cache use-site):

**Before:**
```yaml
- name: Setup Turbo cache
  uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

**After:**
```yaml
- name: Restore Turbo cache
  uses: actions/cache/restore@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
  id: turbo-cache
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-

# ... your build/test steps run ...

- name: Save Turbo cache
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  uses: actions/cache/save@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
```

Apply to: ci.yml lines 68, 76, 84, 90, 254, 404, 425; performance.yml; test-gates.yml.

## Tier B — cost / efficiency

1. **`paths-ignore` filters** on `ci.yml`, `security.yml`, `performance.yml`, `multi-agent-analysis.yml`, `test-gates.yml`:
   ```yaml
   on:
     pull_request:
       paths-ignore:
         - '**.md'
         - 'docs/**'
         - 'AETHER_SOLUTIONS/**'
         - 'LICENSE'
   ```
   PR #231 (markdown-only "Aether" bot spam) triggered the entire pipeline. This filter would have made it free.

2. **Reusable workflow consolidation**: `setup-node-cached.yml` exists but ci.yml's 10+ jobs each run their own `actions/setup-node + npm ci`. Migrate.

3. **`cancel-in-progress` doesn't cover `merge_group`**: `ci.yml` has `cancel-in-progress: ${{ github.event_name == 'push' }}`. Consider `|| github.event_name == 'merge_group'`.

4. **Performance.yml's `cancel-in-progress: false`** keeps stale runs alive across rapid pushes. Restrict to `main`/`release/*` only.

5. **Multi-Agent Analysis runs every PR** with 1/4 historical failure rate. Either gate behind a label, or move to `workflow_dispatch` only.

## Tier C — long-term hardening

1. **Adopt `step-security/harden-runner`** in `audit` mode on the 5 most sensitive workflows (claude, deploy-demo, sync-docs, docker, deploy-dashboard) for 2 weeks. Then switch to `block` mode using the observed baseline. Caught the tj-actions/changed-files breach in the wild.

2. **Pin `zizmor` as a CI check** alongside actionlint. Public repos get free SARIF uploads to GitHub code scanning.

3. **Set repository ruleset for SHA pinning enforcement** (GitHub's August 2025 feature). Workflows using unpinned actions now *fail* instead of warn.

4. **Disable "Allow GitHub Actions to create and approve pull requests"** in repo settings unless explicitly required.

5. **Dependabot grouping** — verify `.github/dependabot.yml` uses `groups:` so 13 actions don't create 13 PRs.

## Per-file scorecard (post-patch)

| File | Findings before | Findings after | Status |
|---|---:|---:|---|
| ci.yml | 35 | 23 | Tier A pending (cache split) |
| test-gates.yml | 14 | 7 | Tier A pending (cache split) |
| deploy-demo.yml | 10 | 7 | **Tier S pending (workflow_run + head_sha)** |
| performance.yml | 9 | 1 | Tier A pending (cache split) |
| architecture.yml | 7 | 2 | template-injection on `base_ref` (low risk) |
| audit-106.yml | 5 | 4 | template-injection in shell |
| deploy-dashboard.yml | 5 | 1 | excessive-perms fixed; workflow_run remains |
| security.yml | 5 | 0 | ✅ |
| docs.yml | 4 | 1 | excessive-perms fixed |
| fly-deploy.yml | 4 | 2 | cache split pending |
| live-api-triage.yml | 4 | 1 | injection fixed; workflow_run remains |
| performance-tracking.yml | 4 | 0 | ✅ |
| publish.yml | 4 | 3 | template-injection in shell |
| schema-check.yml | 4 | 0 | ✅ |
| sync-docs.yml | 4 | 4 | **deliberately not patched (push token)** |
| auto-draft-pr.yml | 3 | 1 | injection fixed; minor template remains |
| mcp-protocol-test.yml | 3 | 1 | injection fixed |
| ci-health.yml | 2 | 1 | workflow_run flagged structurally |
| multi-agent-analysis.yml | 2 | 1 | template-injection on PR title |
| mutation-testing.yml | 2 | 1 | template-injection in shell |
| release-audit.yml | 2 | 1 | template-injection in shell |
| docs-validation.yml | 2 | 0 | ✅ |
| actionlint.yml | 1 | 0 | ✅ |
| claude.yml | 1 | 0 | ✅ (actor check + persist-credentials) |
| docker.yml | 1 | 0 | ✅ (note: separate Trivy bug — see footnote) |
| nightly-live-api.yml | 1 | 0 | ✅ |
| setup-node-cached.yml | 1 | 0 | ✅ |
| scorecards.yml | 1 | 1 | benign (default_branch in step summary) |

## Footnote — Trivy Docker bug (separate from security audit)

`docker.yml` Trivy step fails 100% of PR runs because `push: ${{ github.event_name != 'pull_request' }}` skips the registry push, but the Trivy step still references `image-ref: ghcr.io/...:pr-N`. Fix:

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@<sha>
  with:
    push: ${{ github.event_name != 'pull_request' }}
    load: ${{ github.event_name == 'pull_request' }}  # ← load locally on PR
    tags: ${{ steps.meta.outputs.tags }}
    # ...
```

Then the Trivy step finds the image in the local Docker daemon for PR scans.

## References

- [Wiz: Hardening GitHub Actions](https://www.wiz.io/blog/github-actions-security-guide) (Apr 2026)
- [GitHub Security Lab: Keeping your Actions secure Pt 4](https://securitylab.github.com/resources/github-actions-new-patterns-and-mitigations/) (Jan 2025)
- [Adnan Khan: Angular cache poisoning writeup](https://adnanthekhan.com/posts/angular-compromise-through-dev-infra/) (Mar 2026)
- [Grafana Labs: zizmor at scale](https://grafana.com/blog/how-to-detect-vulnerable-github-actions-at-scale-with-zizmor/) (Jun 2025)
- [Top 10 GitHub Actions Security Pitfalls 2025/2026](https://arctiq.com/blog/top-10-github-actions-security-pitfalls-the-ultimate-guide-to-bulletproof-workflows) (Jan 2026)
- [zizmor docs](https://docs.zizmor.sh/audits/)
- [GitHub Docs: Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)

## Tools used in this audit

- `actionlint 1.7.11` — workflow syntax & semantics
- `zizmor 1.24.1` — security & misconfiguration audit (Astral)
- `gh 2.x` — workflow run history analysis
- Manual review against the references above

To reproduce locally:
```bash
cd .github/workflows
brew install zizmor
zizmor --persona regular *.yml
actionlint *.yml
```
