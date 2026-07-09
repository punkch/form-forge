# PWA packaging — shaping (scheduled)

## Problem

The product pitch is "works offline on field laptops/tablets", and the data
layer already is offline-first (IndexedDB). But the app shell itself still
needs a network on first visit per deployment, and browsers may evict
IndexedDB under storage pressure.

## Scope

- Installable PWA: manifest, icons, offline app shell.
- Update flow: new deployments prompt "Update available → reload".
- Durable storage: request `navigator.storage.persist()` and surface the
  result.

## Approach

- **vite-plugin-pwa** (workbox under the hood) with
  `registerType: 'prompt'`:
  - Precache the app shell + lazy chunks. The `odk-web-forms` chunk is
    ~1.6 MB gzip / ~5 MB raw; include it in the precache (offline preview is
    exactly the point) but raise workbox's
    `maximumFileSizeToCacheInBytes` accordingly.
  - `@fontsource` woff2 files precache automatically as build assets.
  - No runtime caching rules needed — the app makes no network requests.
- Update UX: a small toast (existing PrimeVue Toast) with "Reload" action
  driven by the plugin's `useRegisterSW` composable; never auto-reload (an
  author mid-edit must not lose focus — autosave makes reload safe, but it
  is still their call).
- Storage durability: on first form save, call
  `navigator.storage.persist()`; if denied, show a one-time hint in the
  library ("storage may be cleared under pressure — export a workspace
  backup"), linking to workspace export.
- Icons/branding: generate maskable icons from a simple mark; deliberately
  not the ODK logo (trademark) — text-based "FB" mark until there is a
  proper identity.

## Decisions

- **Updated requirement (user, 2026-07-09):** the app must work fully
  offline (installable as a Chrome app) and must check the online server
  for a newer version on load, updating itself when one exists. Resolved as
  a **hybrid policy** on top of `registerType: 'prompt'` plumbing: update
  found right at page load, or while no unsaved edit is in progress
  (autosave state = saved) → apply and reload automatically; update found
  mid-edit → sticky "New version ready — Reload" toast plus auto-apply on
  the next return to the library. Never reload under an unsaved edit.
- No offline analytics, no background sync — nothing to sync.

## Open questions

- Version display: surface `appVersion` (from package.json) in the library
  footer so update prompts are meaningful? Proposal: yes, trivial.

## Acceptance

Lighthouse PWA checks pass; airplane-mode reload serves the full app
including a working engine preview; deploying a new build shows the update
prompt; e2e smoke via Playwright's offline context emulation.
