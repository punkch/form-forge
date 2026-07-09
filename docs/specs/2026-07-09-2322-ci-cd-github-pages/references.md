# References for CI/CD: GitHub Actions + release-please + GitHub Pages

## In-repo

### Shaping source
- **Location:** `docs/specs/backlog/ci-cd-release.md`
- **Relevance:** original backlog shaping with the user decisions of
  2026-07-09 (main = release branch, v1.0.0 first, e2e gates deploy,
  manual one-time steps documented). This spec folder supersedes it.

### Playwright configuration
- **Location:** `playwright.config.ts`
- **Relevance:** the e2e job relies on it entirely — `webServer` runs
  `pnpm build && pnpm preview` (port 4173) so CI needs no separate
  build/serve steps; `process.env.CI` branches control forbidOnly, retries
  (2), and reporters (github + html on CI; html output `playwright-report/`
  is what the failure artifact uploads). Projects: chromium + firefox — the
  browsers `ci.yml` installs; the future deploy gate runs
  `--project=chromium` only.

### Package manifest
- **Location:** `package.json`
- **Relevance:** `packageManager: "pnpm@10.18.3"` is what
  `pnpm/action-setup@v4` reads (no version input in the composite action);
  `engines.node >=20` (CI uses 22); scripts consumed by CI: `lint`,
  `typecheck`, `test`, `test:e2e` (plus `build` via webServer). `version:
  2.0.0-dev` is the placeholder the v1.0.0 release-as bootstrap normalizes.

### Vite configuration
- **Location:** `vite.config.ts`
- **Relevance:** Wave B adds `base: process.env.BASE_PATH || '/'` here so the
  Pages build serves assets under `/<repo-name>/`.

### PWA backlog item
- **Location:** `docs/specs/backlog/pwa-packaging.md`
- **Relevance:** each Pages deploy emits a new service-worker precache
  manifest — the deploy pipeline IS the PWA update channel, which is why the
  e2e gate blocks deploys.

## External (verified against docs, 2026-07-09)

- https://github.com/pnpm/action-setup — v4 reads `packageManager` from
  package.json when no `version` input is given.
- https://github.com/actions/setup-node — v4 `cache: pnpm` caches the pnpm
  store keyed on `pnpm-lock.yaml`.
- https://playwright.dev/docs/ci — browser cache path on Linux is
  `~/.cache/ms-playwright`; `playwright install --with-deps <browsers>`.
- https://github.com/googleapis/release-please-action — v4, `release-type:
  node`, `release-as` bootstrap, config-file + manifest mode.
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
  — configure-pages / upload-pages-artifact / deploy-pages trio and the
  `pages: write` + `id-token: write` permissions.
- https://docs.github.com/en/actions/using-workflows/reusing-workflows and
  https://docs.github.com/en/actions/creating-actions/creating-a-composite-action
  — composite action mechanics (`shell` required on `run` steps).
