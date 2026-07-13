> **Delivered 2026-07-13.** Promoted to
> `docs/specs/2026-07-13-1840-theming/` (shape + full implementation plan) and
> shipped. This file remains as the provenance record (feasibility exploration,
> the clobber trap, proposed decisions and open questions — resolved in the
> spec's `shape.md`).

# Theming — light/dark/system + accent presets — shaping (backlog)

## Problem

The app is deliberately pinned to light mode (`darkModeSelector: false`,
`<meta name="color-scheme" content="light">`) because its PrimeVue preset
must stay byte-identical to the one `@getodk/web-forms` injects. Users
expect dark mode; embed hosts can't make the builder match their page; and
any theming that darkens the chrome but leaves the live preview a white
island (or vice versa) looks broken. The feature is: a theme preference
(light / dark / follow-OS) plus a small set of accent-color presets that
restyle the **whole surface — builder chrome and the embedded web-forms
preview together** — without weakening the parity invariant that keeps the
preview pixel-faithful.

## Why it's feasible (exploration verdict, 2026-07-13)

- Web-forms has **no hardcoded colors**: its injected stylesheet resolves
  every color through CSS custom properties (`--odk-*` aliases →
  PrimeVue `--p-*` tokens), and the preview mounts as a child Vue app in
  the **same document** (no iframe/shadow DOM). Document-level custom
  property overrides therefore re-theme the preview for free.
- The app chrome is equally token-driven (`--builder-*` → `--odk-*` →
  `--p-*`; hex literals in components are only `var()` fallbacks). Only
  ~4 raw `rgba` scrim/shadow literals and the `--builder-cat-*` tints in
  `src/styles/builder.css` need explicit dark values.
- **The trap (load-bearing constraint):** web-forms bundles its own copy
  of PrimeVue/`@primeuix/styled`, but both runtimes write into the same
  `<style data-primevue-style-id="...">` elements (`semantic-variables`,
  `global-variables`, `<component>-variables`) — `useStyle` reuses the
  element by selector and unconditionally rewrites its `textContent`. When
  the lazy preview chunk mounts, the child **clobbers host-emitted theme
  CSS with its light-only bytes** (invisible today only because the
  strings are byte-identical). So enabling PrimeVue's runtime dark mode on
  the host preset is a dead end: dark would break the moment the preview
  opens. The approach below never touches either runtime's emission.

## Scope

- **Theme preference** `light | dark | system` (default `system`),
  persisted in the ui store's localStorage blob like `locale`; `system`
  tracks `prefers-color-scheme` live via a single `matchMedia` listener.
- **Accent presets**: ODK blue (default, no override emitted) plus a
  curated set — purple `#6366F1`, green `#16A34A` (user-chosen anchors)
  and 1–2 more curated hues — each a full 50–950 scale applied to chrome
  and preview alike.
- **Switch UI**: an "Appearance" section on the settings page (scheme
  select + accent swatch row) **and** a quick light/dark toggle in the
  app header.
- **Embed mode**: additive `theme` / `accent` keys on `EmbedConfig`
  (`init` / `set-config`), validated in `coerceEmbedConfig` — no protocol
  version bump. Host config wins over any persisted preference while
  embedded (mirroring `locale`).
- **Browser chrome**: `<meta name="color-scheme">` and
  `<meta name="theme-color">` become script-managed (accent 500 in light,
  dark surface in dark). PWA manifest colors stay static light —
  manifests can't react to user preferences; documented stance.
- A no-FOUC pre-paint apply on reload.

## Hard invariants (unchanged)

- Both PrimeVue installs keep `darkModeSelector: false` and the
  byte-identical light preset; the `#3e9fcc` primary scale and the light
  values in `src/styles/odk-tokens.css` are never touched. `verify:
  webforms` / `theme-parity.spec.ts` keep all current assertions.
- `src/core/` untouched (theming is pure UI). All new strings go through
  the typed i18n catalog. Existing `data-testid`s preserved.

## Approach

**Mechanism — "B, generated": committed static override CSS, produced at
build time from the pinned preset machinery itself.**

- `scripts/generate-theme-css.mjs` (npm script `generate:theme`) runs the
  *pinned* `@primeuix/styled` emission (`ThemeUtils.getCommon` /
  `Theme.getComponent`) against `odkPreset` with `darkModeSelector:
  '[data-ff-theme="dark"]'` and keeps only the dark-selector rules —
  ~30 Aura components carry distinct dark token *mappings* (not just
  palette values), so semantic vars alone can't produce a correct dark
  theme; generating from PrimeVue's own code gives Aura-grade fidelity
  without hand-authoring hundreds of tokens. Output is committed as
  `src/styles/generated/theme-dark.css` (reviewable diffs, no build-step
  magic).
- Emitted selectors are `:root[data-ff-theme="dark"]` (specificity 0,2,0)
  — they beat both runtimes' plain `:root` injections regardless of
  injection order, and live in Vite-owned stylesheets PrimeVue never
  rewrites. This is what makes dark immune to the clobbering above.
- Accent presets: `src/styles/generated/theme-accents.css` — per accent a
  block overriding only `--p-primary-50…950`, scales produced by the
  `palette()` util re-exported from `@primeuix/themes` 1.0.3 (pure
  build-time hex math). Dark interplay is free: dark maps
  `primary.color → var(--p-primary-400)` etc., so
  `[data-ff-theme="dark"][data-ff-accent="x"]` needs no extra block.
- Hand-authored companion `src/styles/builder-dark.css` (~25–40 lines
  under `:root[data-ff-theme="dark"]`): remap the `--odk-*` aliases that
  point at fixed scale steps (e.g. `--odk-text-color:
  var(--p-surface-900)`), the `--builder-*` panel/canvas tokens, the two
  raw `rgba` scrim/shadow literals, and the `--builder-cat-*` tints.
  The preset gains a curated slate-derived `colorScheme.dark` (brand
  continuity over Aura's zinc); provably inert at runtime while
  `darkModeSelector` stays `false` — it only feeds the generator.
- **Apply layer** `src/theme/index.ts`: `THEME_OPTIONS`, `ACCENTS`
  (`{ id, hex500, i18nKey }`), `resolveTheme`, `applyTheme(resolved,
  accent)` (sets `<html data-ff-theme>` — always the *resolved* scheme,
  never `"system"` — and `data-ff-accent`, updates both metas),
  `initThemeController(ui)` called from `main.ts` next to `setLocale`
  (applies once pre-mount, watches `ui.theme`/`ui.accent`, owns the
  `matchMedia` listener).
- **No FOUC**: a tiny inline script in `index.html` `<head>` reads
  `localStorage['odk-builder:ui:v1']`, resolves `system` via `matchMedia`,
  and stamps the attributes + metas before first paint; a unit test pins
  script ↔ store agreement on the storage key and attribute names.
- **Store**: additive `theme` / `accent` fields on the persisted ui-store
  blob (keep `STORAGE_VERSION 1`, validate on load, add to the watcher).
- **UI**: Appearance section in `SettingsView.vue` modeled on the Language
  section (+ `appSettings.appearance.*` keys); a header toggle component
  for quick light/dark.
- **Embed**: `theme`/`accent` in `src/embed/protocol.ts` +
  `coerceEmbedConfig`, applied through the same path as embed `locale`;
  exercised from `public/embed-demo.html`.
- **Upgrade guard**: extend `verify:webforms` + `theme-parity.spec.ts` to
  also assert (a) the committed generated CSS equals a fresh regeneration
  (drift gate for web-forms/primeuix bumps) and (b) the web-forms dist
  still installs `darkModeSelector: !1` (an upstream default of
  `"system"` would inject competing media-query dark blocks).
- **Tests**: unit (theme module, store fields, embed coercion, inline-
  script agreement), component (Appearance section, header toggle), e2e —
  incl. the key regression: **dark still applied after opening the
  preview** (the clobber scenario), persistence across reload, no-FOUC
  smoke.
- **Docs**: `docs/product/tech-stack.md` (drop "light mode only", describe
  the generated-override scheme), `CLAUDE.md` code map + verify note,
  README features.

**Sequencing at promotion**: spike → preset dark curation → generator +
generated files → theme module / store / index.html / main.ts →
builder-dark hand pass → Settings UI + header toggle + i18n → embed
wiring → tests/docs.

## Decisions (proposed)

- Default `system`; existing light-OS users see no change.
- Accent anchors: ODK blue (default), purple `#6366F1`, green `#16A34A`;
  1–2 further hues curated at promotion.
- Dark surfaces slate-derived, not Aura zinc.
- Generated CSS is committed and drift-gated, not built on the fly.
- PWA manifest stays light; metas are the dynamic layer.
- While embedded, host-supplied theme/accent override the persisted
  preference (device preference still applies when the host sends none).

## Open questions

- Remaining accent hues beyond purple/green.
- White-on-500 contrast for the user-specified anchors (`#16A34A` is
  ~3.3:1, below AA 4.5): nudge the generated scale / button contrast
  mapping, or accept and document?
- Should embed `theme` accept `system` (track the *user's* OS inside a
  host page), or only explicit `light`/`dark`?
- Header toggle semantics when the preference is `system`: cycle
  light → dark → system, or a two-state override?
- Dark treatment of the preview "paper" background: match the chrome
  surfaces, or keep a slightly elevated card look?

## Spike (first implementation task, ~half a day)

Hand-run the generator logic, paste the output into the running app, set
`data-ff-theme="dark"`, open the preview: confirm (a) the child runtime
does clobber `semantic-variables` as predicted and (b) dark rendering
survives it, visually complete across builder + preview. Everything else
in the plan is mechanical; this validates the whole mechanism before real
investment.

## Acceptance

Toggling the theme flips builder chrome **and** the live preview with no
reload; dark persists after opening the preview for the first time (the
clobber regression, asserted in e2e); reloading in dark shows no light
flash; `pnpm verify:webforms` and the full parity suite stay green,
including the new regeneration-drift assertions; the embed demo host sets
dark + an accent via `set-config` and the embedded builder follows; each
accent recolors chrome and preview primary elements (buttons, focus,
selection) consistently in both schemes; the Appearance section and the
header toggle both persist the choice across sessions.
