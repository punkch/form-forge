# Tech Stack

Client-side-only single-page application; ships as static files. No backend, no telemetry; all data in the browser. The only outbound network calls are the strictly opt-in ODK Central publish/import requests to servers the user registers (see below).

## Frontend

- **Vue 3.5** (Composition API, `<script setup lang="ts">`) + **vue-router 4** (hash history) + **Pinia 3**
- **TypeScript ~5.9** strict (pinned below 7.x for vue-tsc compatibility; matches ODK's own pin)
- **Vite 8** build, **pnpm** package manager
- **PrimeVue 4.3.3** + **@primeuix/themes 1.0.3** — pinned to exactly the versions `@getodk/web-forms` bundles, with a byte-identical Aura-based ODK preset (blue `#3e9fcc` primary, slate surfaces, no cssLayer). Both installs keep `darkModeSelector: false`; light/dark/system + accent theming is delivered by committed static override CSS (see below), never by flipping PrimeVue's runtime dark mode
- **@fontsource/roboto** + **primeicons**; design tokens mirrored from web-forms' injected `--odk-*` / `--p-*` custom properties (`src/styles/odk-tokens.css`)
- **vue-draggable-plus** for drag-and-drop, with a keyboard command layer for accessibility/e2e determinism
- **vue-i18n 11** (strict composition mode) — typed per-namespace catalogs in `src/i18n/locales/{en,fr,es}/` (en is the byte-stable source of truth; fr/es are complete mirrors enforced by the `MessageSchema` type, terminology anchored to ODK's own translations); first-run browser-language detection; UI chrome only (form-content translations are a separate product feature); RTL-ready via logical CSS properties + `dir` switching
- **vite-plugin-pwa** (+ workbox-window) — installable offline app shell precaching the web-forms engine chunk; hybrid self-update policy in `src/pwa/`

### Theming (light/dark/system + accent presets + high contrast)

The app supports a light/dark/system color-scheme preference and six accent presets that restyle the builder chrome **and** the embedded web-forms preview together — without weakening the byte-identical preset pin. Because the live preview mounts a second PrimeVue runtime in the same document that rewrites the shared `<style>` token elements on mount, enabling PrimeVue's runtime dark mode is a dead end (it gets clobbered). Instead, `pnpm generate:theme` (`scripts/generate-theme-css.mjs` + the pure generators in `scripts/theme-css-lib.mjs`) runs the *pinned* `@primeuix/styled` emission against `odkPreset` and commits the dark/accent rules to `src/styles/generated/{theme-dark,theme-accents}.css`, keyed on `:root[data-ff-theme="dark"]` / `:root[data-ff-accent="…"]` (specificity 0,2,0, in Vite-owned stylesheets PrimeVue never touches — immune to the clobber). A hand-authored `src/styles/builder-dark.css` remaps the `--odk-*`/`--builder-*` aliases; `src/theme/` is the pure constants + apply layer. This coexists with the parity pin precisely because it **never** flips the runtime: both installs keep `darkModeSelector: false`, and `pnpm verify:webforms` + `theme-parity.spec.ts` assert both the byte-identical light preset and `darkModeSelector: false`. The committed generated CSS is drift-gated — regenerate (never hand-edit) after any PrimeVue/@primeuix bump. See `docs/specs/2026-07-13-1840-theming/`. An orthogonal `normal|high|system` **contrast** axis (`data-ff-contrast`, `prefers-contrast`-aware) adds hand-authored AAA surfaces (`builder-contrast.css`, ratio-gated by `theme-contrast-ratio.spec.ts`) plus generator-emitted per-accent ≥7:1 clamps (`generated/theme-contrast-accents.css`) — see `docs/specs/2026-07-16-1124-high-contrast-mode/`.

## Form engine integration

- **@getodk/web-forms 1.0.0** — official ODK rendering engine for the live preview; mounted in an isolated child Vue app (its `webFormsPlugin` is never installed on the host app); attachments resolved from IndexedDB via `fetchFormAttachment`
- **Own core engines** (`src/core/`, pure TS): XForm serializer/parser, native XLSForm reader/writer, `${field}` ↔ XPath expression module, validators — behavior pinned to **pyxform 4.5.0** via golden tests

## Storage

- **Dexie 4** over IndexedDB (db `form-forge`, schema v3): `forms` (documents), `attachments` (Blobs), `snapshots` (crash recovery), `templates`, plus the Central tables `centralServers` / `centralVault` / `publishTargets`; autosave with debounce; in-memory undo/redo. A one-time startup migration renames the legacy `odk-form-builder` database. All persistence goes through a backend seam (`src/persistence/backend.ts`) with a memory backend for embed mode, and the whole data model round-trips through the `.formforge.zip` workspace backup (format v2)

## ODK Central integration (opt-in)

- Pure-TS client in `src/core/central/` (injectable `fetchImpl`, typed `CentralError`s) — the app's only network code; draft-only publishing with content-hash freshness tracking
- Credentials in a **WebCrypto vault**: PBKDF2-derived, non-extractable AES-GCM key held in a module closure; session tokens memory-only; secrets excluded from shareable exports by construction and carried in the whole-workspace backup only on explicit opt-in
- CORS is a documented server-side requirement (recipes + local-proxy helper `scripts/central-cors-proxy.{sh,ps1}`); minimum supported Central: 2024.3

## File formats

- **SheetJS CE 0.20.3** (from cdn.sheetjs.com tarball — npm registry copy is stale) for reading .xlsx
- **write-excel-file 4** for writing XLSForm .xlsx
- **jszip 3** for ZIP build/read: per-form bundles (XForm or XLSForm + `media/`, export **and** import) and `.formforge.zip` workspace archives

## Quality tooling

- **Vitest 4** (node env for core, happy-dom for components) + **@vue/test-utils**, **fake-indexeddb**, **fast-check** property tests, pyxform golden files
- **@playwright/test** e2e (chromium + firefox)
- **ESLint 9 + neostandard** (+ `@intlify/eslint-plugin-vue-i18n` — missing catalog keys are errors), **vue-tsc** type-checking in CI scripts
- **stylelint 17** with `value-no-unknown-custom-properties` over `src/**/*.{css,vue}` — a bare `var(--x)` referencing an undefined token fails `pnpm lint` (known tokens fed from the static token files + the pinned `@primeuix` emission)
- **agent-browser** manual verification checklists per spec (`docs/verification/`)

## Hosting

Any static host (GitHub Pages, S3/CloudFront, nginx). Hash routing avoids server rewrite rules.
