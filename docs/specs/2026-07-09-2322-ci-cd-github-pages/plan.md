# CI/CD: GitHub Actions + release-please + GitHub Pages — Plan

## Context

The repo has no CI and no deployment. The product needs an online server for
the PWA to check for updates against (see `docs/specs/backlog/pwa-packaging.md`),
and a release discipline that turns conventional commits (already in use) into
versioned, published builds. The repo has no remote yet — the user creates and
pushes the GitHub repository; every workflow here must therefore be correct by
construction, without a live repo to iterate against.

**Delivery is split in two waves:**

- **Wave A (this spec's implementation): `ci.yml` + composite setup action** —
  lands now so the very first push runs green CI.
- **Wave B (planned here, implemented later): `release-please.yml`,
  `deploy.yml`, `release-please-config.json` + `.release-please-manifest.json`,
  and the `BASE_PATH` wiring in `vite.config.ts`** — release automation and
  GitHub Pages deployment.

## Branch and release model

- Work happens on `development`; **`main` is the release branch**.
- Merging `development` → `main` updates the release-please release PR;
  merging the release PR tags the release and (via the `release published`
  event) deploys to GitHub Pages.
- Conventional commits drive the version bump and CHANGELOG
  (`feat:` → minor, `fix:` → patch, `feat!:`/`BREAKING CHANGE` → major).

## Wave A — `ci.yml` (implemented now)

### `.github/actions/setup/action.yml` (composite action)

Dedupes pnpm/node/install across every job in every workflow:

1. `pnpm/action-setup@v4` — **no `version` input**; it reads
   `packageManager: "pnpm@10.18.3"` from `package.json` (single source of truth).
2. `actions/setup-node@v4` with `node-version: 22` (repo requires Node >=20)
   and `cache: pnpm` (caches the pnpm store keyed on `pnpm-lock.yaml`).
3. `pnpm install --frozen-lockfile` (`shell: bash` — required in composite
   `run` steps).

### `.github/workflows/ci.yml`

- **Name:** `CI`. **Triggers:** `push` to `main` + `development`, and all
  `pull_request` events.
- **Two parallel jobs** on `ubuntu-latest`:
  - **quality**: checkout → setup action → `pnpm lint` → `pnpm typecheck` →
    `pnpm test` (Vitest unit + component suites).
  - **e2e**: checkout → setup action → `actions/cache@v4` of
    `~/.cache/ms-playwright` keyed `${{ runner.os }}-playwright-${{ hashFiles('pnpm-lock.yaml') }}`
    → `pnpm exec playwright install --with-deps chromium firefox` (no-op
    download on cache hit; still installs OS deps) → `pnpm test:e2e`.
    `playwright.config.ts` builds and serves the app itself (webServer
    `pnpm build && pnpm preview` on :4173) and branches on `process.env.CI`
    (forbidOnly, 2 retries, github+html reporters).
  - On e2e failure, `actions/upload-artifact@v4` uploads `playwright-report/`
    (`if: failure()`, `retention-days: 7`). The HTML reporter was added to the
    CI branch of `playwright.config.ts` so this report (self-contained,
    embeds traces) actually exists.

## Wave B — release + deploy (planned, later wave)

### `release-please.yml`

- **Trigger:** `push` to `main`. **Permissions:** `contents: write`,
  `pull-requests: write`.
- Single job running `googleapis/release-please-action@v4` with
  `release-type: node` (config-file driven via `release-please-config.json`
  + `.release-please-manifest.json` at repo root).
- Maintains a release PR against `main`; merging it bumps `package.json`,
  writes `CHANGELOG.md`, tags `vX.Y.Z`, and publishes a GitHub Release —
  which triggers `deploy.yml`.

### Version bootstrap: 2.0.0-dev → 1.0.0

`package.json` currently says `2.0.0-dev` (rebuild placeholder). The first
public release is **v1.0.0**:

- Normalize `package.json` `version` to `1.0.0` in the Wave B change, and
- Bootstrap release-please with `release-as: 1.0.0` in
  `release-please-config.json` (or a `Release-As: 1.0.0` footer on the
  bootstrap commit) plus `.release-please-manifest.json` = `{".": "1.0.0"}`
  semantics for the first release PR. Remove `release-as` after v1.0.0 ships.

### `deploy.yml`

- **Triggers:** `release: types: [published]` + `workflow_dispatch` (manual
  redeploy/first-deploy escape hatch).
- **Permissions:** `pages: write`, `id-token: write` (plus `contents: read`).
  Concurrency group `pages`, `cancel-in-progress: false`.
- **Job 1 — e2e gate (chromium only):** checkout → setup action → Playwright
  cache → `pnpm exec playwright install --with-deps chromium` →
  `pnpm exec playwright test --project=chromium`. Pages is production and the
  PWA pushes updates to every installed client, so a broken deploy is never
  acceptable; chromium-only keeps the gate fast.
- **Job 2 — build + deploy (needs: e2e gate):**
  - `BASE_PATH=${{ vars.BASE_PATH || format('/{0}/', github.event.repository.name) }} pnpm build`
    — repo-name-agnostic: works unchanged for project pages
    (`/form-forge/`), forks, renames, and can be overridden with a repository
    variable `BASE_PATH` (e.g. `/` for a custom domain).
  - `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3` with
    `path: dist` → `actions/deploy-pages@v4` (environment `github-pages`).
- **Vite wiring (same wave):** `vite.config.ts` gains
  `base: process.env.BASE_PATH || '/'`. Hash-history routing means no 404
  fallback tricks are needed on Pages.
- Each Pages deploy emits a new service-worker precache manifest — that IS the
  PWA update mechanism (see `docs/specs/backlog/pwa-packaging.md`).

## One-time manual steps (documented, not automated)

The user creates and pushes the GitHub repo; `user-guide.md` in this folder
documents: push repo → create `main` from `development` → set default branch →
enable Pages with source "GitHub Actions" → cut v1.0.0 → verify. None of this
is scripted because it happens exactly once against the live GitHub UI/API.

## Acceptance

- **Wave A:** CI green on first push of `development`; both jobs run in
  parallel; a failing e2e run leaves a downloadable `playwright-report`
  artifact.
- **Wave B:** release-please opens a v1.0.0 PR on the first
  `development` → `main` merge; merging it publishes a working Pages site
  (engine preview included, all assets loading under the base path); a second
  release triggers the PWA update flow on an installed client.

## Out of scope

- npm/registry publishing (the package is `private: true`).
- Preview deployments per PR.
- PWA/service-worker work itself (`docs/specs/backlog/pwa-packaging.md`).
