# References — renovate-dependency-updates

- `docs/specs/backlog/renovate-dependency-updates.md` — shaping source
  (scope, package-rule table, open questions resolved in `shape.md`).
- `docs/product/tech-stack.md` — the pin rationale the config encodes
  (PrimeVue/@primeuix byte-parity, SheetJS CDN tarball, TypeScript <7).
- `package.json` — the actual dependency set: `primevue` 4.3.3 exact,
  `@primeuix/themes` 1.0.3 exact + `pnpm.overrides` for `@primeuix/styles`/
  `styled`/`utils`, `xlsx` as a `https://cdn.sheetjs.com/...` tarball URL,
  `typescript` `~5.9.3`, `packageManager: pnpm@10.18.3`, `engines.node >=20`.
- `.github/workflows/ci.yml` — the gate every update PR must pass
  (quality + e2e jobs on `pull_request`).
- `.github/workflows/release-please.yml` + `release-please-config.json` —
  why PR titles must be conventional commits and why `GITHUB_TOKEN`-created
  PRs are useless here (they don't trigger `ci.yml`).
- `scripts/verify-webforms-bundle.mjs` (`pnpm verify:webforms`) — the
  byte-parity check that makes PrimeVue bumps a web-forms-coupled task.
- renovatebot/github-action releases — v46.1.18 pinned (verified via
  `git ls-remote --tags` on 2026-07-10; no floating major tag exists).
