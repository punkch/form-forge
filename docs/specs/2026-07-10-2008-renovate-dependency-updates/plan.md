# Automated dependency updates (Renovate) — Plan

## Deliverables

1. **`renovate.json`** (repo root) — `config:recommended` +
   `:semanticPrefixFixDepsChoreOthers`, Dependency Dashboard on, weekly
   schedule (`before 6am on saturday`), monthly lockfile maintenance,
   `minimumReleaseAge: "3 days"`, automerge off, and package rules:

   | Target | Rule | Why |
   | --- | --- | --- |
   | `primevue`, `@primeuix/**` | `enabled: false` | exact-pinned byte-identical to what `@getodk/web-forms` bundles (`pnpm verify:webforms`); also covers the `pnpm.overrides` entries |
   | `@getodk/web-forms` | own group + `dependencyDashboardApproval` | bumping the engine is a deliberate task: re-pin PrimeVue, re-run golden + preview e2e |
   | `xlsx` | `enabled: false` | installed from the cdn.sheetjs.com tarball; npm datasource can't track it |
   | `typescript` | `allowedVersions: "<7"` | vue-tsc compatibility pin |
   | devDependencies patch+minor | grouped weekly PR | low-risk bulk |
   | dependencies patch+minor | grouped weekly PR (`fix(deps)` titles) | user-visible in changelog |
   | majors (both) | individual PRs | need individual review |
   | `engines`/`packageManager` | majors only | node/pnpm noise control |
   | github-actions manager | one grouped PR | workflow pin hygiene |

2. **`.github/workflows/renovate.yml`** — cron `0 4 * * 6` +
   `workflow_dispatch`, `permissions: {}` at the workflow level (the PAT
   carries the write access), checkout + `renovatebot/github-action`
   pinned exactly, `RENOVATE_REPOSITORIES: ${{ github.repository }}`
   (repo-name-agnostic, same discipline as `deploy.yml`'s BASE_PATH).

3. **User-facing setup doc** — `user-guide.md` here: PAT creation,
   permissions, secret name, first-run expectations.

## Verification

- `renovate.json` parses (JSON) and the workflow passes YAML lint /
  `gh workflow list` recognition once pushed.
- First scheduled (or dispatched) run opens the Dependency Dashboard issue
  and a grouped devDeps PR whose `ci.yml` checks run — **requires the
  RENOVATE_TOKEN secret, so this is user-executed** (see user-guide).
- Acceptance from the backlog doc: `primevue`/`@primeuix`/`xlsx` untouched;
  a web-forms update appears only as a dashboard approval item; merged PRs
  produce `chore(deps)`/`fix(deps)` changelog entries via release-please.

## Not done here

- Creating the PAT / repo secret (owner-only).
- Any pnpm/lockfile changes — this feature adds config files only.
