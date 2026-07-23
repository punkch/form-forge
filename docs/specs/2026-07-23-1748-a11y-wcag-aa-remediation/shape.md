# Accessibility remediation (WCAG AA) — Shaping Notes

## Scope

Fix every axe-core/Lighthouse accessibility finding on the live app across the full
theming matrix (light/dark × normal/high-contrast × 6 accents): the systemic
color-contrast gap (no AA guarantee in normal-contrast mode), four critical ARIA/semantics
defects (tree children, unlabeled inputs, unnamed maximize button, invalid ARIA attrs from
PrimeVue), and a CI regression gate so the app stays at zero violations.

Out of scope (deliberate): performance remediation (FCP/LCP ~12s throttled-mobile, code
splitting, lazy-loading `@getodk/web-forms`/`xlsx`) and the SEO meta description — both go
to a roadmap backlog entry ("strictly a11y" was an explicit user decision).

## Decisions

- **Accent AA = auto-clamp in the generator** (not hand-picked hexes): extend
  `scripts/theme-css-lib.mjs` to clamp *applied* accent tokens to ≥4.5:1 in normal mode,
  mirroring the existing high-contrast AAA (7:1) clamp. Stays correct if accents change;
  ratio-gated by unit test. Visual fine-tuning, if wanted, is a follow-up after seeing it.
- **Clamp surfaces are worst-case, not base**: light `#f8fafc` (raised) rather than white,
  dark `#1e293b` rather than `#0f172a` — the audit showed raised surfaces are the binding
  constraint (rose passed on white, failed on `#f8fafc`).
- **Brand hex500s stay untouched** (`#6366f1` purple in swatches, favicon.svg, 5 PWA PNGs,
  `index.html` metas + inline ACCENTS map, manifest `theme_color`). Purple misses AA by only
  0.04, so its clamped UI tokens shift near-imperceptibly. **Icons decision = decide after
  seeing it**: the verification pass screenshots clamped-purple UI next to the icon purple;
  regeneration (new script + raster devDep) only if visibly off.
- **CI gate = reduced matrix in ci.yml** (~5 min: both themes × both contrasts × default
  accent + one worst-case accent spot check) against the locally served build; the full
  24-mode matrix stays a documented manual act.
- **Prefer PrimeVue typed props over `pt`** (repo has zero `pt` usage): maximize button via
  `maximize-button-props`; drawer role via plain attr first, `pt` only as fallback; the
  TieredMenu `aria-level` may end up a *documented accepted exception* if `pt` can't strip
  the hoisted attr (upstream PrimeVue 4.3.3 non-conformance).
- **PrimeVue aria strings live in a dedicated typed module** (`src/i18n/primevue-locale.ts`,
  `Record<AppLocale, …>`), not the app MessageSchema — vendor strings, compiler-checked
  parity, wired at `app.use` (seed) and inside `setLocale` (reactive switch).
- **Muted-token fixes are override-layer only** — `odk-tokens.css` is byte-parity-locked
  with web-forms; remaps go in `builder.css`/`builder-dark.css`/`builder-contrast.css`,
  attr-scoped (`:root[data-ff-theme]`) to out-specific PrimeVue's late unlayered injection.

## Context

- **Visuals:** none provided; evidence is the audit data (see references.md) and the
  verification screenshots to be logged in `docs/verification/`.
- **References:** full audit numbers + implementation surface map in `references.md`.
- **Product alignment:** supports the roadmap's quality bar for the delivered Phase 2/3
  surfaces; adds a new hard invariant (normal-mode AA clamp) alongside the existing
  AAA/theming invariants in CLAUDE.md.

## Delivery notes (deviations from plan, 2026-07-23)

- The plan's cascade reasoning had one gap the review's correctness lens caught: the AA
  file's literal `--odk-primary-*` aliases (0,3,0) beat high contrast's 0,2,0 alias
  redirect in light HC. Resolved with a 0,3,0 re-assert block in `builder-contrast.css`
  whose win depends on being imported AFTER the generated AA file — import order in
  `main.ts` is now load-bearing and test-pinned (`theme-contrast-ratio.spec.ts`).
- The export menu's `aria-level` strip via `:pt` WORKED (verified with before/after
  component tests) — the "document as accepted upstream exception" fallback was not
  needed. It is the repo's first `pt` usage.
- The light muted-text tiers collapse onto surface-600 (no scale step separates them
  while clearing the `#f8f8f8` card bg); dark collapses onto surface-400. Tiering by
  size/weight is a noted follow-up if missed visually.
- The audit's live-site numbers for light muted-on-card (3.78:1) did not reproduce
  against the pinned emission (4.48:1) — the deployed build predated this work; the fix
  targets the real emission and the local rebuilt app audits clean either way.
- `AppLocale` is now exported from `src/i18n/index.ts` as the single locale-union
  source of truth (review finding; the implementer had flagged the drift hazard).

## Audit provenance

Live app audited 2026-07-23 with Lighthouse 13.4.1 (root + settings routes) and the new
`pnpm audit:a11y` (axe-core 4.12, WCAG 2.x A/AA tags) across 13 UI states × 16 mode
combinations. Landing-page Lighthouse: a11y 95, best-practices 100, SEO 90, performance 54.
The audit tool itself (scripts/a11y-audit.mjs) was delivered immediately before this spec.
