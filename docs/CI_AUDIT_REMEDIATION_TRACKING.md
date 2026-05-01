# CI Audit Remediation Tracking

Generated: 2026-04-30. Source: `docs/CI_AUDIT.md`.

## Mechanical fixes (this PR)

- [x] `persist-credentials: false` on 62 checkouts across 26 files
- [x] Move workflow-level write permissions to job level (`deploy-dashboard.yml`, `docs.yml`, `performance-tracking.yml`)
- [x] Convert high-risk template-injection to `env:` pattern (`mcp-protocol-test.yml`, `schema-check.yml`, `auto-draft-pr.yml`, `live-api-triage.yml`)
- [x] Add `comment.author_association` actor check to `claude.yml`

## Tier S — manual review (separate PRs)

- [ ] **`deploy-demo.yml`**: drop `workflow_run` trigger, deploy from `push: branches: [main]` only
- [ ] **`docker.yml`**: add `load: true` for PR builds so Trivy can scan local image
- [ ] **`sync-docs.yml`**: drop `workflow_run` from "106-Category Audit"; rely on `push` and `workflow_dispatch` only
- [ ] **`claude.yml`**: scope `GITHUB_TOKEN` writes via fine-grained PAT or GitHub App; add `harden-runner` egress allowlist for `api.anthropic.com`

## Tier A — cache poisoning hardening (single PR, follows template)

- [ ] `ci.yml` lines 68, 76, 84, 90, 254, 404, 425 — split `actions/cache` → `actions/cache/restore` + conditional `actions/cache/save`
- [ ] `performance.yml` cache uses
- [ ] `test-gates.yml` cache uses
- [ ] `fly-deploy.yml` cache uses

## Tier B — cost / efficiency

- [ ] Add `paths-ignore: ['**.md', 'docs/**', 'AETHER_SOLUTIONS/**', 'LICENSE']` to `ci.yml`, `security.yml`, `performance.yml`, `multi-agent-analysis.yml`, `test-gates.yml`
- [ ] Migrate `ci.yml` jobs to use `setup-node-cached.yml` reusable workflow
- [ ] Add `merge_group` to `cancel-in-progress` predicate in `ci.yml`
- [ ] Restrict `performance.yml`'s `cancel-in-progress: false` to `main`/`release/*` only
- [ ] Gate `multi-agent-analysis.yml` behind a label or `workflow_dispatch`

## Tier C — long-term hardening

- [ ] Adopt `step-security/harden-runner` in `audit` mode for 2 weeks on top 5 sensitive workflows
- [ ] After audit data: switch `harden-runner` to `block` with allowlist
- [ ] Add zizmor as a CI check (parallel with actionlint)
- [ ] Enable repo ruleset: SHA pinning enforcement (GH Aug 2025 feature)
- [ ] Verify "Allow GitHub Actions to create and approve PRs" is **off**
- [ ] Review/group `.github/dependabot.yml` to avoid 13-PR storms

## Already-known unrelated issues

- [ ] Close PR #231 (Aether bot spam — adds only a markdown file)
- [ ] Audit branch list for other `aether-solution-*` bot branches
