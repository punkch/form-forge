# CI/CD — User Guide & One-Time Manual Steps

Every push to `development`/`main` and every PR runs CI (lint, typecheck,
unit tests, and chromium+firefox e2e in parallel). Merging the release PR
that release-please maintains on `main` tags a version, publishes a GitHub
Release, and deploys the build to GitHub Pages (behind a chromium e2e gate).

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

## 4. Cut v1.0.0

1. Bootstrap the version **once**. Right after `main` first has commits,
   push an empty commit carrying a `Release-As` footer:

   ```
   git checkout main
   git commit --allow-empty -m "chore: bootstrap v1 release" -m "Release-As: 1.0.0"
   git push
   ```

   release-please honors the footer for that one run and opens/updates a
   release PR titled `chore(main): release 1.0.0`, ignoring the old
   `2.0.0-dev` placeholder in `package.json`. (The
   `.release-please-manifest.json` placeholder `{".": "0.0.0"}` is rewritten
   to the real version automatically on each release.) No standing config
   change is needed, and normal conventional-commit bumping resumes on the
   next release.
2. Note: the release PR shows **no CI checks** — PRs created by the workflow's
   `GITHUB_TOKEN` don't trigger `ci.yml`. This is expected; the code already
   passed full CI before reaching `main`, and `deploy.yml` re-gates with
   chromium e2e. If you added a required-checks ruleset on `main` (step 2.3),
   merge the release PR with admin bypass or scope the ruleset to exclude
   release-please PRs.
3. Review the generated CHANGELOG in the release PR, then merge it.
4. release-please tags `v1.0.0`, publishes a GitHub Release, and then
   explicitly dispatches `deploy.yml` (chromium e2e gate → build → Pages
   deploy). The explicit dispatch exists because a release published with
   the workflow's `GITHUB_TOKEN` emits no `release published` event to
   other workflows (GitHub suppresses those to prevent loops); the
   `on: release` trigger in `deploy.yml` only fires for releases published
   manually from the GitHub UI.
5. Subsequent versions derive from conventional commits with no further
   action (`fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE` →
   major). To force a specific later version, add another `Release-As:` footer
   to a commit on `main` — it is honored once and never persists in config.

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
| 8 | Actions tab → "Deploy to GitHub Pages" → "Run workflow" (`workflow_dispatch`) | Manual redeploy succeeds without a new release (also the escape hatch if the first release deployed before Pages was enabled) |
| 9 | Install the app as a PWA, then cut a second release (`fix:` commit → merge to `main` → merge release PR) | Deploy publishes a new service-worker precache manifest; the installed client detects it and applies/offers the update — confirms the PWA update flow end to end |

## Day-to-day afterwards

- Work on `development` with conventional commits (`feat:`, `fix:`, …).
- PRs and pushes get full CI; nothing deploys from `development`.
- To release: merge `development` → `main`, then merge the release PR that
  release-please maintains. The deploy (and the PWA update it implies) only
  happens when a release is published or a maintainer dispatches `deploy.yml`.
