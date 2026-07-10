# Automated dependency updates (Renovate) — shaping (backlog)

## Problem

Dependencies only move when someone remembers to bump them. This repo has
security-relevant surface (jszip, SheetJS, vite tooling) and a CI/release
pipeline that makes update PRs cheap to validate — but also several
deliberate, load-bearing version pins that naive auto-updates would break.

## Scope

- Self-hosted **Renovate via GitHub Actions** (`renovatebot/github-action`)
  on a weekly schedule + manual `workflow_dispatch`; no Mend cloud app.
- `renovate.json` tuned to this repo's pinning discipline (below).
- Update PRs run the existing `ci.yml` (lint/typecheck/unit/e2e) and are
  merged manually; conventional-commit titles so release-please picks them
  up (`fix(deps):` / `chore(deps):`).

## Approach

- `.github/workflows/renovate.yml`: cron (weekly, off-hours) +
  workflow_dispatch, running `renovatebot/github-action` with
  `RENOVATE_TOKEN` — a fine-grained PAT (or GitHub App token). The default
  `GITHUB_TOKEN` is NOT enough: PRs it creates don't trigger `ci.yml`
  (same limitation release-please documents).
- `renovate.json` package rules:
  - **`primevue` + `@primeuix/*`: disabled.** Exact-pinned byte-identical
    to what `@getodk/web-forms` bundles (`docs/product/tech-stack.md`);
    they move only when web-forms moves.
  - **`@getodk/web-forms`: own group, `dependencyDashboardApproval`** —
    surfaced on the dashboard but never auto-PR'd; bumping it is a
    deliberate task (re-pin PrimeVue, re-run golden/preview e2e).
  - **`xlsx`: ignored.** Installed from the cdn.sheetjs.com tarball (npm
    registry copy is stale); Renovate's npm datasource can't track it.
  - **`typescript`: `<7` range respected** (vue-tsc compatibility pin).
  - devDependencies patch+minor: grouped weekly PR, automerge OFF in v1
    (revisit once the update flow has run a few cycles).
  - dependencies: separate PRs, minor+patch grouped, majors individual.
  - `engines`/`packageManager` (node, pnpm): tracked but major-only PRs.
  - GitHub Actions (`.github/workflows/*` `uses:` pins): enabled, grouped.
- Lockfile maintenance: monthly `pnpm-lock.yaml` refresh PR.
- Dependency Dashboard issue enabled — one place to see pending/blocked
  updates.

## Decisions (proposed)

- Manual merge in v1 — CI green is necessary but not sufficient (preview
  engine regressions may need the golden/e2e matrix plus a manual look).
- No automerge until the pipeline has proven itself; then consider
  devDependencies-patch automerge only.
- Renovate config lives in `renovate.json` (repo root) so the schema is
  editor-validated; not in package.json.

## Open questions

- Token flavor: fine-grained PAT (simplest) vs a dedicated GitHub App
  (nicer audit trail, no personal coupling)? Proposal: PAT to start,
  documented in the workflow header.
- Should `@fontsource/roboto` follow web-forms' pinned font version or
  float? (Check what web-forms bundles when scheduling.)

## Acceptance

First scheduled run opens the Dependency Dashboard + a grouped devDeps PR
whose `ci.yml` checks run and pass; `primevue`/`@primeuix`/`xlsx` are
untouched; a `@getodk/web-forms` update appears only as a dashboard
approval item; merging an update PR produces a `chore(deps)`/`fix(deps)`
entry in the next release-please changelog.
