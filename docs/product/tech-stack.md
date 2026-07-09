# Tech Stack

Client-side-only single-page application; ships as static files. No backend, no telemetry; all data in the browser.

## Frontend

- **Vue 3.5** (Composition API, `<script setup lang="ts">`) + **vue-router 4** (hash history) + **Pinia 3**
- **TypeScript ~5.9** strict (pinned below 7.x for vue-tsc compatibility; matches ODK's own pin)
- **Vite 8** build, **pnpm** package manager
- **PrimeVue 4.3.3** + **@primeuix/themes 1.0.3** — pinned to exactly the versions `@getodk/web-forms` bundles, with a byte-identical Aura-based ODK preset (blue `#3e9fcc` primary, slate surfaces, no cssLayer, light mode only)
- **@fontsource/roboto**; design tokens mirrored from web-forms' injected `--odk-*` / `--p-*` custom properties (`src/styles/odk-tokens.css`)
- **vue-draggable-plus** for drag-and-drop, with a keyboard command layer for accessibility/e2e determinism

## Form engine integration

- **@getodk/web-forms 1.0.0** — official ODK rendering engine for the live preview; mounted in an isolated child Vue app (its `webFormsPlugin` is never installed on the host app); attachments resolved from IndexedDB via `fetchFormAttachment`
- **Own core engines** (`src/core/`, pure TS): XForm serializer/parser, native XLSForm reader/writer, `${field}` ↔ XPath expression module, validators — behavior pinned to **pyxform 4.5.0** via golden tests

## Storage

- **Dexie 4** over IndexedDB: `forms` (documents), `attachments` (Blobs), `snapshots` (crash recovery); autosave with debounce; in-memory undo/redo

## File formats

- **SheetJS CE 0.20.3** (from cdn.sheetjs.com tarball — npm registry copy is stale) for reading .xlsx
- **write-excel-file 4** for writing XLSForm .xlsx
- **jszip 3** for ZIP export (form.xml + media)

## Quality tooling

- **Vitest 4** (node env for core, happy-dom for components) + **@vue/test-utils**, **fake-indexeddb**, **fast-check** property tests, pyxform golden files
- **@playwright/test** e2e (chromium + firefox)
- **ESLint 10 + neostandard**, **vue-tsc** type-checking in CI scripts
- **agent-browser** manual verification checklists per spec (`docs/verification/`)

## Hosting

Any static host (GitHub Pages, S3/CloudFront, nginx). Hash routing avoids server rewrite rules.
