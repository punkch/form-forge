# References — PWA Packaging

## Files added

- `src/pwa/updatePolicy.ts` — pure hybrid update policy (`decide`,
  `RELOAD_GRACE_MS`).
- `src/pwa/registerSW.ts` — `useSwUpdate()`, `swRegistrationAllowed()`,
  `SW_UPDATE_TOAST_GROUP`, `UPDATE_CHECK_INTERVAL_MS`.
- `src/pwa/persistentStorage.ts` — `requestPersistentStorage()` (one-shot),
  `isStoragePersistent()`.
- `src/pwa/pwa-env.d.ts` — `vite-plugin-pwa/client` type reference for
  `virtual:pwa-register`.
- `public/pwa-192x192.png`, `public/pwa-512x512.png`,
  `public/pwa-maskable-192x192.png`, `public/pwa-maskable-512x512.png`,
  `public/apple-touch-icon.png`, `public/favicon.svg` — placeholder "FB"
  mark.
- `tests/unit/pwa-update-policy.spec.ts`
- `tests/unit/pwa-persistent-storage.spec.ts`
- `tests/e2e/pwa.spec.ts`

## Files changed

- `vite.config.ts` — `base` from `BASE_PATH`, `VitePWA` plugin + manifest.
- `index.html` — theme-color meta, favicon.svg, apple-touch-icon links.
- `src/App.vue` — `useSwUpdate()` + sticky update toast (group
  `sw-update`, testids `sw-update-toast` / `sw-update-reload`).
- `src/stores/form.ts` — one-shot `requestPersistentStorage()` after a
  successful `flushSave`.
- `src/stores/ui.ts` — persisted `storageHintDismissed` +
  `dismissStorageHint()`.
- `src/views/FormLibraryView.vue` — footer (testids `library-footer`,
  `storage-persistent`, `storage-hint`, `storage-hint-dismiss`).
- `src/i18n/locales/en/shell.json` — `shell.pwa.*`.
- `src/i18n/locales/en/library.json` — `library.footer.*`.
- `package.json` — `vite-plugin-pwa@1.3.0`, `workbox-window@7.4.1`
  (explicit peer of the virtual client module).

## Icon regeneration

The PNGs are rendered from simple SVGs (white bold "FB" on `#3e9fcc`;
DejaVu Sans). Rounded-square mark = `public/favicon.svg`; the maskable
variant is the same mark full-bleed with the glyph inside the 80% safe
zone (`font-size` 192 instead of 248, `y` 322 instead of 342, no `rx`).

```sh
inkscape public/favicon.svg -w 512 -h 512 -o public/pwa-512x512.png
inkscape public/favicon.svg -w 192 -h 192 -o public/pwa-192x192.png
inkscape mark-maskable.svg -w 512 -h 512 -o public/pwa-maskable-512x512.png
inkscape mark-maskable.svg -w 192 -h 192 -o public/pwa-maskable-192x192.png
inkscape mark-maskable.svg -w 180 -h 180 -o public/apple-touch-icon.png
```

## External

- vite-plugin-pwa: <https://vite-pwa-org.netlify.app/> — `prompt`
  registration, `virtual:pwa-register`, workbox `generateSW` options.
- Maskable icon safe zone: <https://web.dev/articles/maskable-icon>
  (inner 80% circle).
- `navigator.storage.persist()`:
  <https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist>
