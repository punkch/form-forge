# CI/CD: release-please + GitHub Pages — shaping (scheduled)

## Problem

The repo has no CI and no deployment. The product needs an online server
for the PWA to check for updates against, and a release discipline that
turns conventional commits (already in use) into versioned, published
builds.

## Scope

- `ci.yml`: lint → typecheck → unit tests ∥ e2e on push (main,
  development) + PRs.
- `release-please.yml`: release PR automation on `main`
  (googleapis/release-please-action@v4, release-type node).
- `deploy.yml`: build + publish to GitHub Pages when a release is
  published (also manual dispatch); chromium e2e gate before deploy.

## Approach

- Branch model: work on `development`; `main` is the release branch —
  merging development → main updates the release PR, merging the release
  PR tags and deploys.
- Base path stays repo-name-agnostic:
  `BASE_PATH=${{ vars.BASE_PATH || format('/{0}/', github.event.repository.name) }}`
  feeding `base` in vite.config (hash routing needs no 404 tricks).
- Version bootstrap: normalize package.json `2.0.0-dev` → `1.0.0` with
  `release-as: 1.0.0` for the first release.
- Each Pages deploy emits a new service-worker precache manifest — that IS
  the PWA update mechanism (see pwa-packaging).
- Composite setup action dedupes pnpm/node/install; Playwright browser
  cache keyed off the lockfile.

## Decisions (user, 2026-07-09)

- `main` = release branch (not single-branch release-please).
- First public release is **v1.0.0**.
- e2e (chromium-only) blocks deploy — Pages is production and the PWA
  pushes updates to every installed client.
- User creates and pushes the GitHub repo; one-time manual steps
  (create main, default branch, enable Pages with source "GitHub Actions")
  are documented, not automated.

## Acceptance

CI green on first push; release-please opens a v1.0.0 PR; merging it
publishes a working Pages site (engine preview included); a second release
triggers the PWA update flow on an installed client.
