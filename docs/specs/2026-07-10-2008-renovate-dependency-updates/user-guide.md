# User guide — automated dependency updates (Renovate)

Form Forge's dependencies are kept fresh by a self-hosted Renovate bot
running inside GitHub Actions (`.github/workflows/renovate.yml`). Nothing
runs on third-party infrastructure and no repo data leaves GitHub.

## One-time setup (repo owner)

1. **Create a fine-grained personal access token** (GitHub → Settings →
   Developer settings → Fine-grained tokens):
   - Repository access: only this repository.
   - Permissions: **Contents** read/write, **Pull requests** read/write,
     **Issues** read/write (Dependency Dashboard), **Workflows** read/write
     (so grouped action-pin PRs can touch `.github/workflows/`).
2. **Add it as a repository secret** named `RENOVATE_TOKEN`
   (repo → Settings → Secrets and variables → Actions).
3. Optionally trigger the first run: Actions → Renovate → *Run workflow*.
   Otherwise it runs Saturdays 04:00 UTC.

Why not the built-in `GITHUB_TOKEN`? PRs created with it do not trigger
`ci.yml`, so every update PR would show no checks — the same limitation the
release-please setup documents.

## What to expect

- A pinned **Dependency Dashboard** issue listing pending, blocked, and
  approval-gated updates.
- Weekly PRs: one grouped *dev dependencies (non-major)*, one grouped
  *runtime dependencies (non-major)* (`fix(deps):` titles → changelog),
  individual PRs per major, one grouped *github actions* PR, and a monthly
  `pnpm-lock.yaml` maintenance PR.
- **Never PR'd automatically**: `primevue`/`@primeuix/*` (move only with
  web-forms), `xlsx` (SheetJS CDN tarball), TypeScript 7+ (vue-tsc pin),
  node/pnpm minors. `@getodk/web-forms` appears on the dashboard behind a
  checkbox — ticking it creates the PR; treat that bump as a task:
  re-pin PrimeVue to match, run `pnpm verify:webforms`, golden tests, and
  the preview e2e suite.

## Merging

CI green is necessary, not sufficient. Merge manually; conventional-commit
titles mean release-please folds the update into the next release PR's
changelog. Automerge is deliberately off in v1.
