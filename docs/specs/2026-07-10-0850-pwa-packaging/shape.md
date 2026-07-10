# F6 — PWA Packaging — Shaping Notes

Shaped from `docs/specs/backlog/pwa-packaging.md`.

## Problem

The data layer is offline-first (IndexedDB) but the app shell still needs a
network on first visit per deployment, and browsers may evict IndexedDB
under storage pressure. The product pitch — "works offline on field
laptops/tablets" — needs the shell itself to be installable and durable.

## Scope

- Installable PWA: web manifest, icons, offline app shell via a
  service-worker precache (including the ~5 MB `odk-web-forms` engine
  chunk — offline preview is the point).
- Update flow: **hybrid policy** (user decision, 2026-07-09) on top of
  `registerType: 'prompt'` plumbing — auto-apply and reload whenever no
  unsaved edit can be lost; sticky toast otherwise.
- Durable storage: `navigator.storage.persist()` after the first
  successful save, with the result surfaced in the library footer.
- App version in the library footer so update prompts are meaningful
  (open question in the backlog — resolved: yes).

## Decisions

- **vite-plugin-pwa 1.3.0** (workbox `generateSW`). Compatibility gate
  passed: its peer range includes vite `^8.0.0` (project is on vite 8.1.4).
  `workbox-window` had to be added as an explicit devDependency — pnpm does
  not hoist the plugin's peer into the app bundle graph, and the
  `virtual:pwa-register` client imports it.
- **Hybrid update policy** as a pure function
  (`src/pwa/updatePolicy.ts::decide`): `reload` when
  `msSinceLoad <= 3000 || !editorOpen || saveState === 'saved'`, else
  `toast`. A toast-deferred update also auto-applies on the next router
  navigation back to the library. Never reload under an unsaved edit.
- **No runtime caching rules** — the app makes no network requests.
  `maximumFileSizeToCacheInBytes` raised to 8 MB so the engine chunk
  precaches; `navigateFallback: 'index.html'` (hash router, so every
  navigation is `/`-rooted anyway).
- **Base path**: `process.env.BASE_PATH ?? '/'` wired into Vite's `base`;
  the manifest uses *relative* `start_url: '.'`, `scope: '.'` and relative
  icon paths so one build recipe works at any deploy prefix (GitHub Pages
  project sites included — F7b consumes this).
- **e2e gating**: the Playwright build sets `VITE_E2E=1`; the service
  worker then only registers when the page URL opts in with `?pwa=1`
  (`swRegistrationAllowed()` in `src/pwa/registerSW.ts`). This keeps every
  other spec service-worker-free while `tests/e2e/pwa.spec.ts` exercises
  the real precache. Chromium-only (one engine proves the precache).
- **Icons are a deliberate placeholder**: simple white-on-`#3e9fcc` "FB"
  text mark (rounded square + full-bleed maskable variants), *not* the ODK
  logo (trademark). Rendered from SVG with Inkscape; sources kept as
  `public/favicon.svg` (regeneration commands in references.md).
- **Storage durability**: one-shot `persist()` after the first successful
  `flushSave` (browsers grant it far more readily once the user has
  content). The library footer shows "Storage: persistent" when granted,
  or a dismissible one-time hint linking directly to workspace export when
  not; nothing at all when the API is absent.

## Non-goals

- No offline analytics, no background sync — nothing to sync.
- No `runtimeCaching`, no push notifications, no periodic background sync.
- No real brand identity work (the FB mark is scaffolding).
