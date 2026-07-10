# F6 — PWA Packaging — Plan

## Goal

Make the builder an installable, fully offline-capable PWA that keeps
itself up to date against the deploy server without ever reloading over an
unsaved edit, and that asks the browser for durable storage.

## Build (`vite.config.ts`)

- `base = process.env.BASE_PATH ?? '/'`.
- `VitePWA({ registerType: 'prompt', workbox: { globPatterns:
  ['**/*.{js,css,html,woff2,svg,png,ico}'], maximumFileSizeToCacheInBytes:
  8 * 1024 * 1024, navigateFallback: 'index.html' }, manifest, devOptions:
  { enabled: false } })`.
- Manifest: name "Form Forge for ODK", short_name "Form Forge",
  `display: standalone`, `theme_color #3e9fcc`, `background_color #ffffff`,
  relative `start_url '.'` / `scope '.'`, 192/512 icons + maskable
  variants.
- The `odk-web-forms` manualChunks split stays; the chunk lands in the
  precache (~7.2 MB total precache, 91 entries).

## Runtime (`src/pwa/`)

- `updatePolicy.ts` — pure `decide({ msSinceLoad, editorOpen, saveState })
  → 'reload' | 'toast'`; unit-tested decision table.
- `registerSW.ts` — `useSwUpdate()` composable called from `App.vue`
  setup: gates registration (`swRegistrationAllowed`), dynamically imports
  `virtual:pwa-register` (so vitest never resolves it), wires
  `onNeedRefresh → decide(...)` to either `updateSW(true)` or a sticky
  PrimeVue toast (group `sw-update`, custom template with a Reload
  button), hourly `registration.update()` re-check, and auto-apply of a
  pending update on router navigation back to the library.
- `persistentStorage.ts` — one-shot `requestPersistentStorage()` +
  `isStoragePersistent()` query, both hardened for environments without
  `navigator.storage`.
- `pwa-env.d.ts` — types for the virtual module.

## Integration points

- `src/App.vue` — `useSwUpdate()` + the dedicated update `<Toast>`.
- `src/stores/form.ts` — one line after a successful `flushSave`:
  `void requestPersistentStorage()`.
- `src/stores/ui.ts` — persisted `storageHintDismissed` flag +
  `dismissStorageHint()`.
- `src/views/FormLibraryView.vue` — footer: app version
  (`__APP_VERSION__`), "Storage: persistent" or the dismissible
  export-a-backup hint.
- `index.html` — `theme-color` meta, `favicon.svg`, `apple-touch-icon`.
- i18n: `shell.pwa.*`, `library.footer.*`.

## Tests

- `tests/unit/pwa-update-policy.spec.ts` — full decision table.
- `tests/unit/pwa-persistent-storage.spec.ts` — one-shot latch, missing
  API, grant query.
- `tests/e2e/pwa.spec.ts` (chromium only) — register with `?pwa=1`, await
  `navigator.serviceWorker.ready`, `context.setOffline(true)`, reload →
  library renders; create a form, add a question, open the preview → the
  engine renders offline (proves the big-chunk precache).

## Out of scope / follow-ups

- Deploy wiring consumes `BASE_PATH` (F7b).
- Real icon identity to replace the FB placeholder.
