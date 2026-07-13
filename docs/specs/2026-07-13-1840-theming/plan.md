# Plan — Theming: light/dark/system + accent presets (2026-07-13)

## Context

Form Forge is client-side-only and styled to look like ODK Web Forms: its
PrimeVue preset is byte-identical to the one `@getodk/web-forms` injects, and the
live preview mounts a **second** PrimeVue runtime in the **same document**. That
identity is a hard invariant (`pnpm verify:webforms`, `theme-parity.spec.ts`) and
the reason the app shipped light-only.

The load-bearing constraint the shaping doc surfaced: both runtimes write into
the same `<style data-primevue-style-id>` elements, and the preview's runtime
unconditionally rewrites their `textContent` every time the lazy preview chunk
mounts. Enabling PrimeVue's runtime dark mode on the host preset is therefore a
dead end — dark would be clobbered the moment the preview opens. Any workable
theming has to (a) live in a stylesheet PrimeVue never touches and (b) out-rank
the runtime `:root {}` injections. The mechanism below does both.

The shaping/provenance doc is `docs/specs/backlog/theming.md` (feasibility
verdict, the clobber trap, proposed decisions). `shape.md` in this folder records
the resolved decisions (including the answers to the shaping doc's open
questions). `references.md` carries the provenance and key source files. Stage A
was implemented and browser-validated before this documentation was written.

Branch: **development**. Conventional commits; release-please derives versions
from `main`. **No `Co-Authored-By` trailer on any commit** (global user
instruction).

## Mechanism — "B, generated"

Committed static override CSS, produced from the pinned `@primeuix/styled`
emission itself. Runtime dark mode is never enabled; both PrimeVue installs keep
`darkModeSelector: false`.

- **Selector strategy.** Every generated rule is keyed on
  `:root[data-ff-theme="dark"]` (dark) or `:root[data-ff-accent="…"]` (accent) —
  specificity (0,2,0), which beats both runtimes' plain `:root` (0,1,0)
  injections regardless of injection order. The files are Vite-owned, so
  PrimeVue's `useStyle` never rewrites them. This is what makes dark immune to
  the preview-runtime clobber.
- **Why generate, not hand-author.** ~29 Aura components carry distinct dark
  token *mappings* (not just palette values). Generating from PrimeVue's own
  code gives Aura-grade fidelity without hand-maintaining hundreds of tokens.
- **Why commit, not build on the fly.** Reviewable diffs, no build-step magic; a
  drift gate re-runs the generator in CI and fails if the committed files are
  stale (catches a PrimeVue/@primeuix bump silently changing the emission).

## File map (delivered)

### Pure theme layer — `src/theme/`

- **`src/theme/constants.ts`** — PURE (no Vue/DOM/i18n), the single source of
  truth for identifiers, imported by the store (validation), the embed protocol
  (coercion), the Appearance UI (options), the no-FOUC inline script, and the
  Node generator. Exports:
  - `type ThemeScheme = 'light' | 'dark' | 'system'`;
    `type ResolvedScheme = 'light' | 'dark'`.
  - `THEME_SCHEMES`, `DEFAULT_THEME = 'system'`.
  - `type AccentId`; `interface AccentDef { id; hex500; i18nKey }`;
    `ACCENTS` (order blue, purple, green, teal, amber, rose — `hex500` are the
    *effective* rendered primary-500, so green is the AA-nudged `#0f7c39`, not the
    raw anchor); `ACCENT_IDS`; `DEFAULT_ACCENT = 'blue'`.
  - `isThemeScheme`, `isAccentId` type guards; `resolveScheme(theme,
    systemPrefersDark): ResolvedScheme`.
- **`src/theme/index.ts`** — the apply/runtime layer; re-exports all of
  `constants`. Owns `<html data-ff-theme data-ff-accent>` and the dynamic
  `<meta name="color-scheme">` / `<meta name="theme-color">` (accent 500 in
  light, dark slate `#0f172a` in dark). Exports:
  - `applyTheme(resolved, accent)` — stamps the attributes + syncs the metas;
    `resolved` is always concrete, never `system`.
  - `initThemeController(ui)` — wires to the reactive ui store, applies once
    pre-mount, watches `ui.theme`/`ui.accent`, and owns the single `matchMedia`
    listener (re-applies only while the effective preference is `system`). Called
    from `main.ts` next to `setLocale`.
  - `setEmbedTheme(theme?, accent?)` — embed-host override, precedence over the
    persisted preference; a missing field leaves that dimension under the
    user/device preference; `system` is honoured.
  - `systemPrefersDark()`.

### Generator + generated + hand-authored CSS

- **`scripts/theme-css-lib.mjs`** — pure generator library (deterministic).
  Exports `generateThemeDarkCss()`, `generateAccentsCss()`, `accentPrimary500()`
  (`{ blue: '#3e9fcc', green: '#0f7c39', … }`), `DARK_SELECTOR
  = ':root[data-ff-theme="dark"]'`, `ACCENT_GEN`. Runs `Theme.setTheme(odkPreset,
  { darkModeSelector: DARK_SELECTOR, cssLayer: false })`, then keeps only the
  rule blocks whose selector targets `data-ff-theme` from `Theme.getCommon`
  (semantic + global) and every `Theme.getComponent(name)`. The primitive palette
  (`--p-slate-*`, …) the rules reference is emitted by the PrimeVue runtime's own
  `:root {}` block, so it is deliberately excluded. Accents use `palette(anchor)`
  (`@primeuix/themes`, pure hex math) for a 50–950 scale; `ACCENT_GEN` sets
  amber's `--p-primary-contrast-color: var(--p-surface-900)` (white-on-amber
  fails AA).
- **`scripts/generate-theme-css.mjs`** — CLI (`pnpm generate:theme`). Writes the
  two generated files and logs the effective accent primary-500 map. Deliberate
  act; re-run after a PrimeVue/@primeuix bump, an `odkPreset` change, or an accent
  tweak.
- **`src/styles/generated/theme-dark.css`** (~30 KB, committed) — dark semantic
  tokens, the `color-scheme` global, and 29 Aura component dark token maps, all
  under `:root[data-ff-theme="dark"]`.
- **`src/styles/generated/theme-accents.css`** (committed) — per non-default
  accent, a `:root[data-ff-accent="…"]{ --p-primary-50…950; }` block (+ amber's
  contrast override). Dark × accent needs no extra block: the dark map already
  references `var(--p-primary-400)` etc., so re-tinting `--p-primary-*` re-tints
  both schemes for free.
- **`src/styles/builder-dark.css`** (hand-authored, ~40 lines under
  `:root[data-ff-theme="dark"]`) — the companion for aliases the generated CSS
  can't reach: remaps the `--odk-*` text/surface/primary/status aliases (which
  point at fixed scale steps), the raw `rgba` scrim/shadow literals
  (`--builder-scrim-bg`, `--builder-drawer-shadow`, `--builder-card-shadow`), and
  the `--builder-cat-*` question-category tints. Keep in step with the light
  values in `odk-tokens.css` / `builder.css`.
- **`src/styles/odk-preset.ts`** — gains a curated `colorScheme.dark` (slate,
  not Aura zinc). **Provably inert at runtime** while `darkModeSelector` stays
  `false`; it exists solely to feed the generator. Light values, the
  `ODK_PRIMARY_SCALE`, and the runtime `:root { --p-* }` output are byte-stable
  (guarded by `theme-parity.spec.ts` + `verify:webforms`).

### Wiring

- **`src/main.ts`** — imports the three theming stylesheets after
  `odk-tokens.css` + `builder.css`
  (`@/styles/generated/theme-dark.css`, `@/styles/generated/theme-accents.css`,
  `@/styles/builder-dark.css`); keeps `theme: { … darkModeSelector unchanged }`
  in the PrimeVue install; calls `initThemeController(useUiStore(pinia))` next to
  the locale setup.
- **`index.html`** — a tiny no-FOUC inline `<head>` script reads
  `localStorage['odk-builder:ui:v1']`, resolves `system` via `matchMedia`, and
  stamps `data-ff-theme` / `data-ff-accent` + the metas before first paint. Its
  agreement with the store (storage key, attribute names) is drift-pinned by a
  unit test.
- **`src/stores/ui.ts`** — additive `theme` (default `system`) and `accent`
  (default `blue`) reactive refs on the persisted blob (`odk-builder:ui:v1`,
  `STORAGE_VERSION` unchanged at 1), validated on load with
  `isThemeScheme`/`isAccentId`, added to the persistence watcher. Used exactly
  like `locale`.
- **`src/embed/protocol.ts`** — `EmbedConfig` gains `theme?: EmbedTheme`
  (`ThemeScheme`, `system` allowed) and `accent?: AccentId`; `coerceEmbedConfig`
  validates them with `isThemeScheme`/`isAccentId`. Applied through
  `setEmbedTheme` on the same path as embed `locale`; exercised from
  `public/embed-demo.html`.

### UI

- **Header `ThemeToggle`** — a 3-state cycle (light → dark → system) in the app
  header, persisting `ui.theme`.
- **Settings "Appearance" section** — a scheme select + an accent swatch row on
  the Settings page, modeled on the Language section, strings under
  `appSettings.appearance.*` (each `AccentDef.i18nKey` is e.g.
  `appSettings.appearance.accent.blue`).

### Upgrade guard / drift gate

- The unit drift gate re-runs `generateThemeDarkCss()` / `generateAccentsCss()`
  and asserts the committed `src/styles/generated/*.css` equal a fresh
  regeneration (fails on a PrimeVue/@primeuix bump that changes the emission —
  regenerate + commit).
- `verify:webforms` / `theme-parity.spec.ts` keep all prior assertions and add
  the `darkModeSelector: false` guard (an upstream default of `"system"` would
  inject competing media-query dark blocks) plus the light-preset byte-stability
  checks — proving the generated CSS never enabled runtime dark mode.

## Verification (definition of done)

- `pnpm lint` / `pnpm typecheck` clean (`appSettings.appearance.*` resolve
  through the typed catalog; embed coercion typechecks).
- `pnpm test` — unit (theme module, store fields, embed coercion, inline-script
  agreement, generated-CSS drift) + component (Appearance section, header
  toggle) green.
- `pnpm test:coverage` — floors unchanged and met.
- `pnpm build && pnpm test:e2e` — chromium + firefox green, including the key
  regression: **dark still applied after opening the preview** (the clobber
  scenario), persistence across reload, and a no-FOUC smoke.
- `pnpm verify:webforms` — green, including the added `darkModeSelector: false`
  + regeneration-drift assertions.
- **agent-browser manual pass** over the built app: toggle scheme flips chrome
  **and** preview with no reload; dark survives first preview open; reload in
  dark shows no light flash; each accent recolors chrome + preview primary
  elements consistently in both schemes; the embed demo host sets dark + an
  accent via `set-config` and the builder follows; Settings section and header
  toggle both persist across sessions. Screenshots logged to
  `docs/verification/theming/`.
- **`/code-review`** (five lenses, no plan mode); fix findings immediately.
- Update README Features, `docs/product/roadmap.md`, `docs/product/tech-stack.md`,
  and `CLAUDE.md` in the same change.

## Acceptance criteria (from the shaping doc)

- Toggling the theme flips builder chrome **and** the live preview with no reload.
- Dark persists after opening the preview for the first time (the clobber
  regression, asserted in e2e).
- Reloading in dark shows no light flash.
- `pnpm verify:webforms` and the full parity suite stay green, including the new
  regeneration-drift + `darkModeSelector: false` assertions.
- The embed demo host sets dark + an accent via `set-config` and the embedded
  builder follows; embed `theme` accepts `system`.
- Each accent recolors chrome and preview primary elements (buttons, focus,
  selection) consistently in both schemes.
- The Appearance section and the header toggle both persist the choice across
  sessions.
