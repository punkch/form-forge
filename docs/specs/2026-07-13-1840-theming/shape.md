# Theming — light/dark/system + accent presets — Shaping Notes

Promoted from `docs/specs/backlog/theming.md` on 2026-07-13. That backlog doc is
the provenance record (the feasibility exploration, the clobber trap, the
proposed decisions). This folder is the implementation spec. Everything below is
settled — the open questions the shaping doc left are resolved here, the
mechanism was browser-validated in Stage A, and the feature is delivered.

## Scope

The app had been deliberately pinned to light mode (`darkModeSelector: false`,
`<meta name="color-scheme" content="light">`) because its PrimeVue preset must
stay byte-identical to the one `@getodk/web-forms` injects. This feature adds a
**theme preference** (light / dark / follow-OS) plus a small set of
**accent-color presets** that restyle the **whole surface — builder chrome and
the embedded web-forms preview together** — without weakening the parity
invariant that keeps the preview pixel-faithful.

Ships:

- **Theme preference** `light | dark | system` (default `system`), persisted in
  the ui-store localStorage blob like `locale`; `system` tracks
  `prefers-color-scheme` live via a single `matchMedia` listener.
- **Accent presets** — six curated hues, each a full 50–950 scale applied to
  chrome and preview alike: **blue** (default ODK `#3e9fcc`, emits no override),
  **purple** `#6366f1`, **green** `#0f7c39` (AA-nudged), **teal** `#0d9488`,
  **amber** `#f59e0b` (dark-text contrast override), **rose** `#e11d48`.
- **Switch UI** — an "Appearance" section on the Settings page (scheme select +
  accent swatch row) **and** a quick 3-state light/dark/system toggle in the app
  header.
- **Embed mode** — additive `theme` / `accent` keys on `EmbedConfig`
  (`init` / `set-config`), validated in `coerceEmbedConfig`; no protocol-version
  bump. Host config wins over any persisted preference while embedded (mirroring
  `locale`); embed `theme` accepts `system`.
- **Browser chrome** — `<meta name="color-scheme">` and
  `<meta name="theme-color">` become script-managed (accent 500 in light, the
  dark slate surface in dark). The PWA manifest colors stay static light.
- **No-FOUC pre-paint apply** — an inline `<head>` script stamps the resolved
  scheme + accent before the bundle parses.

## Mechanism (Stage A, browser-validated)

**"B, generated": committed static override CSS, produced from the pinned
`@primeuix/styled` emission itself.** No runtime dark mode is ever enabled.

- `scripts/generate-theme-css.mjs` (`pnpm generate:theme`) runs the *pinned*
  `@primeuix/styled` emission against `odkPreset` with the dark selector
  `:root[data-ff-theme="dark"]`, keeps only the dark-selector rules, and writes
  `src/styles/generated/theme-dark.css` (~30 KB: dark semantic + `color-scheme`
  global + every Aura component's dark token *map* — 29 components carry distinct
  dark token mappings, not just palette values, so semantic vars alone can't
  produce a correct dark theme). Accent presets go to
  `src/styles/generated/theme-accents.css` (per-accent `--p-primary-*` overrides
  under `:root[data-ff-accent="…"]`, scales from `@primeuix/themes` `palette()`).
- The pure generator functions live in `scripts/theme-css-lib.mjs`
  (`generateThemeDarkCss`, `generateAccentsCss`, `accentPrimary500`, `ACCENT_GEN`,
  `DARK_SELECTOR`) — deterministic, no filesystem/Date/random; the CLI wrapper
  writes; the drift gate re-runs them.
- `src/styles/builder-dark.css` (hand-authored) remaps the `--odk-*` / `--builder-*`
  aliases that point at fixed scale steps, the raw `rgba` scrim/shadow literals,
  and the `--builder-cat-*` category tints — under the same
  `:root[data-ff-theme="dark"]` selector.
- `:root[data-ff-theme="dark"]` has specificity (0,2,0), so it beats both
  runtimes' plain `:root` (0,1,0) injections regardless of order, and lives in a
  Vite-owned stylesheet PrimeVue never rewrites — **immune to the preview
  runtime's clobbering** (the load-bearing constraint the shaping doc identified).
- `src/theme/{constants.ts,index.ts}` is the apply layer; the no-FOUC inline
  script lives in `index.html`; the ui store gains `theme`/`accent`; the embed
  protocol gains `theme`/`accent`.

Full mechanism, file map, and generator internals are in `plan.md`.

## Decisions (all resolved 2026-07-13)

The shaping doc's proposed decisions plus the answers to its open questions:

- **Default `system`.** Existing light-OS users see no change.
- **Six accents:** blue (default, no override), purple `#6366f1`, green
  `#0f7c39`, teal `#0d9488`, amber `#f59e0b`, rose `#e11d48`. Order is the swatch
  order in Settings and in `ACCENTS`.
- **Green is AA-nudged.** The user's raw anchor `#16A34A` fails white-on-500
  WCAG AA (~3.3:1); the generated scale uses the darker `#0f7c39` so white
  button text clears AA. The picker swatch shows the effective (nudged) value,
  not the raw anchor.
- **Amber uses a dark-text contrast override.** White-on-amber fails AA, so the
  amber block remaps `--p-primary-contrast-color` to dark text
  (`var(--p-surface-900)`) — which reads in both schemes since the accent stays
  light there.
- **Embed `theme` accepts `system`.** A host page can let the embedded builder
  track the *host viewer's* OS scheme, not only send an explicit `light`/`dark`.
- **Header toggle is a 3-state cycle** — light → dark → system — so the toggle
  can always return to "follow OS", not just flip between two explicit overrides.
- **Dark surfaces are slate-derived, not Aura zinc** — brand continuity with the
  ODK slate family. The preset's inert `colorScheme.dark` block feeds the
  generator only.
- **Dark preview "paper" matches the chrome surfaces.** `builder-dark.css` tiers
  the dark elevation (canvas backdrop deepest, form content mid, panels
  lightest) so the preview reads as part of one surface, not a white island.
- **Generated CSS is committed and drift-gated**, not built on the fly —
  reviewable diffs, no build-step magic.
- **PWA manifest stays light; the metas are the dynamic layer** — a manifest
  can't react to a user preference, and that stance is documented.
- **While embedded, host-supplied theme/accent override the persisted
  preference** (the device preference still applies for any dimension the host
  omits — mirroring `locale`).

## Hard invariants (unchanged, verified)

- Both PrimeVue installs keep `darkModeSelector: false` and the byte-identical
  light preset; the `#3e9fcc` primary scale and the light values in
  `src/styles/odk-tokens.css` are never touched. The generated CSS never enables
  runtime dark mode, so `pnpm verify:webforms` and `theme-parity.spec.ts` stay
  green — now with added regeneration-drift and `darkModeSelector: false`
  assertions.
- `src/core/` untouched (theming is pure UI). `src/theme/constants.ts` is a pure
  module (no Vue/DOM/i18n) safe to import from the Node generator, the store,
  and the embed coercion alike. All new strings go through the typed i18n
  catalog (`appSettings.appearance.*`). Existing `data-testid`s preserved.

## Context

- **Visuals:** verification screenshots saved under `docs/verification/theming/`
  (chrome + preview, both schemes, each accent).
- **References:** see `references.md` — provenance, key source files, and the
  `@primeuix` API the generator uses.
- **Product alignment:** Phase 3 backlog burn-down. Theming was the last
  shaped-only backlog item; delivering it clears the "Pending proposals" table.

## Skills & Conventions Applied

See `standards.md`:

- **unops-toolkit:shape-spec** — used to promote this backlog proposal into the
  timestamped spec folder (this document set).
- **CLAUDE.md hard invariants** — `src/core` purity, byte-identical PrimeVue
  preset + `darkModeSelector: false`, UI strings only via the typed
  per-namespace i18n catalog, `data-testid` preservation, byte-stable rendered
  English, conventional commits with **no `Co-Authored-By` trailer**.
- **Delivery process** — spec folder → dynamic Workflow with parallel agents →
  verification (full suite + agent-browser pass logged to `docs/verification/`)
  → `/code-review` (five lenses) with immediate fixes → conventional commit(s) →
  update README Features, roadmap, and CLAUDE.md.
