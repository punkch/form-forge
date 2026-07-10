# Standards — PWA Packaging

Follows the existing project standards
(`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`):
strict TypeScript, neostandard ESLint (no semicolons), Vitest, all UI
strings through the typed i18n catalog.

Conventions this feature adds:

- **Policy is pure, plumbing is thin.** Update decisions live in
  `src/pwa/updatePolicy.ts` as a pure function with a unit-tested decision
  table; `registerSW.ts` only gathers the context (clock, route, save
  state) and executes the verdict. Change the policy there, not in the
  callback wiring.
- **Never reload over an unsaved edit.** Any future change to the update
  flow must preserve this invariant (`decide` returns `'toast'` for
  `editorOpen && saveState !== 'saved'`); the deferred update may only
  auto-apply on navigation back to the library.
- **`virtual:pwa-register` is imported dynamically** and only behind
  `swRegistrationAllowed()`. Do not import it statically — vitest and any
  build without the plugin must never have to resolve it.
- **e2e stays service-worker-free by default.** Under `VITE_E2E=1` the SW
  registers only with `?pwa=1` in the URL. A new spec that needs the SW
  must opt in with that param (and stay chromium-only); everything else
  must not start one.
- **Deploy-relative everything.** `base` comes from `BASE_PATH`; manifest
  `start_url`/`scope`/icon paths are relative. Never hardcode an absolute
  deploy path in the manifest or SW options.
- **Storage APIs are optional.** All `navigator.storage` access is
  feature-detected and failure-swallowing (`persistentStorage.ts`) so node
  unit tests and older browsers never throw.
- **Placeholder branding.** The FB mark is deliberately not the ODK logo;
  replacing it means regenerating all five PNGs (references.md) and
  keeping the maskable safe zone.
