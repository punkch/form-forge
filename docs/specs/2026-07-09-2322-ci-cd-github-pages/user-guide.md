# CI/CD — User Guide & One-Time Manual Steps

After Wave A, every push to `development`/`main` and every PR runs CI (lint,
typecheck, unit tests, and chromium+firefox e2e in parallel). After Wave B,
merging release PRs on `main` publishes versioned builds to GitHub Pages.

These one-time steps are deliberately manual (they touch the live GitHub
UI/API exactly once and are not worth automating).

## 1. Push the repository

1. Create the GitHub repository (any name — nothing in the workflows hardcodes
   it). Do not initialize it with files.
2. From the local repo:
   `git remote add origin git@github.com:<owner>/<repo>.git`
   then `git push -u origin development`.
3. **Verify:** the Actions tab shows a `CI` run for the push; both jobs
   (`quality`, `e2e`) go green.

## 2. Create `main` from `development` and set the default branch

1. `git checkout -b main development && git push -u origin main`
   (then `git checkout development` to keep working there).
2. On GitHub: Settings → General → Default branch → set to `main`.
3. Recommended: Settings → Branches → add a ruleset/protection on `main`
   requiring the `quality` and `e2e` status checks.
4. **Verify:** the push to `main` triggered a green `CI` run.

## 3. Enable GitHub Pages (source: GitHub Actions)

1. Settings → Pages → "Build and deployment" → Source: **GitHub Actions**
   (not "Deploy from a branch").
2. Optional: to serve from a custom domain (base path `/`), add a repository
   variable `BASE_PATH` = `/` under Settings → Secrets and variables →
   Actions → Variables. Without it, deploys use `/<repo-name>/` automatically.

## 4. Cut v1.0.0 (after Wave B lands)

1. Merge `development` → `main` (PR). release-please opens/updates a release
   PR titled `chore(main): release 1.0.0` — the version comes from the
   `release-as: 1.0.0` bootstrap, not from the old `2.0.0-dev` placeholder.
2. Review the generated CHANGELOG in the release PR, then merge it.
3. release-please tags `v1.0.0` and publishes a GitHub Release; the
   `release published` event starts `deploy.yml` (chromium e2e gate → build →
   Pages deploy).
4. After v1.0.0: remove the `release-as` bootstrap from
   `release-please-config.json` so subsequent versions derive from
   conventional commits.

## 5. Verify

| # | Steps | Expected |
|---|---|---|
| 1 | Push a commit to `development` | `CI` runs; `quality` and `e2e` both green |
| 2 | Open a PR | `CI` runs on the PR; checks appear on the PR page |
| 3 | Break an e2e test on a branch, push | `e2e` fails; a `playwright-report` artifact (7-day retention) is downloadable from the run |
| 4 | Merge development → main | `CI` runs on main; release PR appears/updates |
| 5 | Merge the release PR | Tag `vX.Y.Z` + GitHub Release created; `deploy.yml` runs: e2e gate then deploy |
| 6 | Open `https://<owner>.github.io/<repo>/` | App loads, ODK-styled; form library works; assets load (no 404s under the base path) |
| 7 | In the deployed app, open a form and its preview | Engine preview (lazy `odk-web-forms` chunk) renders — confirms base path is correct for lazy chunks |
| 8 | Actions tab → deploy run → re-run via `workflow_dispatch` | Manual redeploy succeeds without a new release |

## Day-to-day afterwards

- Work on `development` with conventional commits (`feat:`, `fix:`, …).
- PRs and pushes get full CI; nothing deploys from `development`.
- To release: merge `development` → `main`, then merge the release PR that
  release-please maintains. The deploy (and the PWA update it implies) only
  happens when a release is published or a maintainer dispatches `deploy.yml`.
