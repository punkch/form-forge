# CI/CD: GitHub Actions + release-please + GitHub Pages — Shaping Notes

## Scope

Continuous integration for every push/PR, release automation via
release-please, and deployment of the built app to GitHub Pages on each
published release. This spec implements **`ci.yml` + the composite setup
action now**; `release-please.yml`, `deploy.yml`, and the release-please
config land in a later wave, but their full design is fixed here (see
`plan.md`) so the CI pieces are built to compose with them.

## Decisions (user, 2026-07-09)

- **`main` = release branch** (not single-branch release-please on
  `development`). Work continues on `development`; merging
  `development` → `main` feeds the release PR; merging the release PR tags
  and deploys. This keeps `main` always releasable and makes "what is
  deployed" trivially answerable.
- **First public release is v1.0.0** — package.json's `2.0.0-dev` is a rebuild
  placeholder, normalized via a one-time `Release-As: 1.0.0` commit footer on
  `main` rather than letting release-please infer `2.0.0`. The footer is
  honored once, so no standing config override keeps re-proposing v1.0.0.
- **e2e (chromium-only) blocks deploy** — Pages is production and the PWA
  pushes updates to every installed client; a fast chromium gate catches
  build/runtime breakage without doubling the gate time with firefox (full
  chromium+firefox coverage already ran in CI before the code could reach
  `main`).
- **BASE_PATH stays repo-name-agnostic**:
  `vars.BASE_PATH || format('/{0}/', github.event.repository.name)`. No
  hardcoded repo name anywhere; a repository variable overrides for custom
  domains. Hash routing means no 404 tricks are needed.
- **One-time manual steps are documented, not automated** — the user creates
  and pushes the GitHub repo, creates `main`, sets the default branch, and
  enables Pages (source "GitHub Actions"). See `user-guide.md`.

## Shaping choices (implementation-level)

- **Composite action over reusable workflow** for setup: it is a step
  sequence (pnpm → node+cache → install), not a job, and is consumed by jobs
  in `ci.yml` now and `deploy.yml` later.
- **pnpm version comes from `packageManager`** in package.json —
  `pnpm/action-setup@v4` gets no `version` input, so there is exactly one
  place to bump pnpm.
- **Two parallel CI jobs** (quality, e2e) instead of one serial job: e2e is
  the long pole (build + browser install + run) and does not need to wait for
  lint/typecheck; failures surface per-concern.
- **Playwright browser cache** keyed on OS + `pnpm-lock.yaml` hash: the
  `@playwright/test` version (which pins the browser builds) only changes with
  the lockfile. `--with-deps` still runs on cache hits to install OS packages.
- **No separate build step in CI** — `playwright.config.ts`'s `webServer`
  already runs `pnpm build && pnpm preview`, and `pnpm typecheck` (`vue-tsc -b`)
  covers the compile half of `pnpm build` in the quality job.
- **HTML reporter added to the CI branch of `playwright.config.ts`** so the
  on-failure `playwright-report/` artifact upload has something to upload
  (the github reporter alone writes only inline annotations).

## Delivered

- **Wave A:** `.github/actions/setup/action.yml` (composite pnpm/node/install)
  and `.github/workflows/ci.yml` (parallel `quality` + `e2e` jobs on push to
  `main`/`development` and all PRs, Playwright browser cache, on-failure
  `playwright-report` artifact).
- **Wave B:** `.github/workflows/release-please.yml`
  (`googleapis/release-please-action@v4` on push to `main`, config-file +
  manifest-file driven), `release-please-config.json` (`release-type: node`
  and explicit changelog sections: feat/fix/perf/refactor/docs/ci visible;
  chore/test/build/style hidden — no standing `release-as`, so it never
  re-proposes a fixed version), `.release-please-manifest.json`
  (`{".": "0.0.0"}` — pre-release placeholder; the one-time `Release-As: 1.0.0`
  commit footer overrides it for the first release and release-please rewrites
  it to the real version on each release thereafter), and
  `.github/workflows/deploy.yml` (`release: published` + `workflow_dispatch`;
  chromium e2e gate job, then build with
  `BASE_PATH=${{ vars.BASE_PATH || format('/{0}/', github.event.repository.name) }}`
  → `configure-pages@v5` → `upload-pages-artifact@v3` (`path: dist`) →
  `deploy-pages@v4` under the `github-pages` environment, concurrency group
  `pages` with `cancel-in-progress: false`). `vite.config.ts` reads
  `process.env.BASE_PATH` for the build base (wired separately in the same
  wave).
- Known limitation (accepted): release PRs are created with `GITHUB_TOKEN`,
  so they do not trigger `ci.yml`; `deploy.yml`'s gate re-runs chromium e2e
  before anything ships.

## Context

- **References:** `docs/specs/backlog/ci-cd-release.md` (shaping source, incl.
  the user decisions above), `playwright.config.ts`, `package.json` scripts,
  `docs/specs/backlog/pwa-packaging.md` (Pages deploys are the PWA update
  channel).
- **Product alignment:** client-side-only static site — GitHub Pages is a
  sufficient production target; no server component exists or is planned.

## Skills & Conventions Applied

- unops-toolkit:shape-spec — this folder's structure
- Conventional commits (already in use on `development`) — the contract
  release-please consumes
- GitHub Actions pinned to major version tags (@v4/@v5), first-party or
  googleapis-owned actions only
