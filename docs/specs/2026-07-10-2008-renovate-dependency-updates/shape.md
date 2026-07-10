# Automated dependency updates (Renovate) — Shaping Notes

## Scope

Self-hosted Renovate via GitHub Actions (`renovatebot/github-action`) on a
weekly schedule + manual `workflow_dispatch`, with `renovate.json` tuned to
this repo's deliberate version pins. Update PRs run the existing `ci.yml`
and are merged manually; conventional-commit titles feed release-please.

Promoted from `docs/specs/backlog/renovate-dependency-updates.md`
(2026-07-10). No Mend cloud app — nothing about this repo leaves GitHub.

## Decisions

- **Token: fine-grained PAT to start** (`RENOVATE_TOKEN` repo secret),
  documented in the workflow header — a dedicated GitHub App can replace it
  later without config changes. The default `GITHUB_TOKEN` is ruled out:
  PRs it creates don't trigger `ci.yml` (same limitation release-please
  documents).
- **Manual merge in v1, automerge off everywhere** — CI green is necessary
  but not sufficient (preview-engine regressions need the golden/e2e matrix
  plus a manual look). Revisit devDependencies-patch automerge after a few
  cycles.
- **Pin discipline encoded as package rules** (see `plan.md` for the full
  table): `primevue`/`@primeuix/**` disabled, `@getodk/web-forms` dashboard-
  approval only, `xlsx` disabled (cdn.sheetjs.com tarball), `typescript`
  `allowedVersions: "<7"`, engines/packageManager majors only.
- **`@fontsource/roboto` floats** with the grouped runtime non-major PRs —
  it is our own styling dependency, not part of the byte-identical
  web-forms preset surface that `pnpm verify:webforms` checks.
- **`minimumReleaseAge: "3 days"`** — small supply-chain buffer before a
  fresh npm release can appear in a PR (this repo ships a PWA that
  auto-updates installed clients).
- **Config lives in `renovate.json`** at the repo root (schema-validated in
  editors), not in package.json.
- **Exact action pin** (`renovatebot/github-action@v46.1.18`): the action
  publishes no floating major tag; Renovate's own github-actions manager
  keeps the pin fresh once running.

## Out of scope

- Automerge of any kind (v1).
- Tracking `xlsx` (would need a custom datasource for the SheetJS CDN).
- A GitHub App identity for the bot.

## Context

- Backlog source: `docs/specs/backlog/renovate-dependency-updates.md`.
- Pin rationale: `docs/product/tech-stack.md`.
- CI the PRs must pass: `.github/workflows/ci.yml`;
  release automation consuming the commit titles:
  `.github/workflows/release-please.yml`.

## Skills & Conventions Applied

- unops-toolkit:shape-spec — this folder's structure
- Conventional commits — `fix(deps)`/`chore(deps)` via
  `:semanticPrefixFixDepsChoreOthers` so release-please picks updates up
