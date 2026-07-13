# References — Theming: light/dark/system + accent presets

## Provenance

- **Promoted from `docs/specs/backlog/theming.md` on 2026-07-13.** That backlog
  doc is the shaping/provenance record: the feasibility exploration (web-forms
  resolves every color through CSS custom properties, mounts as a child Vue app
  in the same document, and bundles its own PrimeVue that clobbers shared
  `<style data-primevue-style-id>` elements), the "B, generated" mechanism
  proposal, the proposed decisions, and the open questions this spec resolves.
  It stays in the backlog as the provenance record (mirroring how
  central-publishing is kept there).
- **Stage A** (the mechanism + wiring) was implemented and **browser-validated**
  before this documentation was written; verification screenshots are under
  `docs/verification/theming/`.

## Key source files

### Pure theme layer

- **`src/theme/constants.ts`** — pure identifiers + guards + `resolveScheme`
  (the single source of truth shared by store, embed, UI, inline script, and the
  Node generator). No Vue/DOM/i18n imports.
- **`src/theme/index.ts`** — apply/runtime layer: `applyTheme`,
  `initThemeController`, `setEmbedTheme`, `systemPrefersDark`; owns the `<html
  data-ff-theme data-ff-accent>` attributes + the dynamic `color-scheme` /
  `theme-color` metas; re-exports `constants`.

### Generator + CSS

- **`scripts/theme-css-lib.mjs`** — pure generators (`generateThemeDarkCss`,
  `generateAccentsCss`, `accentPrimary500`, `ACCENT_GEN`, `DARK_SELECTOR`).
- **`scripts/generate-theme-css.mjs`** — CLI (`pnpm generate:theme`) that writes
  the committed files.
- **`src/styles/generated/theme-dark.css`** — committed dark override CSS
  (`:root[data-ff-theme="dark"]`).
- **`src/styles/generated/theme-accents.css`** — committed accent overrides
  (`:root[data-ff-accent="…"]`).
- **`src/styles/builder-dark.css`** — hand-authored companion remapping
  `--odk-*` / `--builder-*` aliases + raw scrim/shadow literals +
  `--builder-cat-*` tints under the dark selector.
- **`src/styles/odk-preset.ts`** — gains the inert `colorScheme.dark` block
  (slate) that feeds the generator; light values byte-stable.

### Wiring & UI

- **`src/main.ts`** — imports the three theming stylesheets; calls
  `initThemeController(useUiStore(pinia))`; PrimeVue install keeps
  `darkModeSelector: false`.
- **`index.html`** — no-FOUC inline `<head>` script (reads
  `localStorage['odk-builder:ui:v1']`, stamps attributes + metas pre-paint).
- **`src/stores/ui.ts`** — persisted `theme` / `accent` refs on the
  `odk-builder:ui:v1` blob (`STORAGE_VERSION` 1), validated on load, in the
  watcher; used like `locale`.
- **`src/embed/protocol.ts`** — `EmbedConfig.theme` / `.accent` +
  `coerceEmbedConfig` validation; applied via `setEmbedTheme`.
- **Header `ThemeToggle`** + Settings **Appearance** section — the two switch
  surfaces; strings under `appSettings.appearance.*`.

### Guards / tests

- **`scripts/verify-webforms-bundle.mjs`** (`pnpm verify:webforms`) — byte-parity
  of `--odk-*` tokens + primary scale + PrimeVue pins against the web-forms
  bundle; extended with the `darkModeSelector: false` guard.
- **`tests/unit/theme-parity.spec.ts`** — the light-preset / primary-scale
  byte-stability guard (unchanged assertions kept; proves the generated CSS never
  enabled runtime dark mode).
- **Generated-CSS drift gate** — a unit spec that re-runs the pure generators and
  asserts the committed `src/styles/generated/*.css` equal a fresh regeneration.
- **Inline-script agreement** — a unit spec pinning the `index.html` script ↔
  store agreement on the storage key + attribute names.

## `@primeuix` API used by the generator

- **`@primeuix/themes`** `definePreset`, `Theme.setTheme` /
  `Theme.getCommon('', {})` (semantic + global CSS) / `Theme.getComponent(name,
  {})` / `Theme.getPreset()` — run with `darkModeSelector: DARK_SELECTOR` to
  emit the dark rules the generator filters and commits.
- **`@primeuix/themes`** `palette(anchor)` — pure build-time hex math producing a
  50–950 scale for each accent; `Aura` is the base preset.
- These are the **pinned** versions matched to `@getodk/web-forms`
  (`@primeuix/themes 1.0.3`), so the emission the generator captures is exactly
  the emission that would ship at runtime — the reason the mechanism stays inside
  the parity invariant.
