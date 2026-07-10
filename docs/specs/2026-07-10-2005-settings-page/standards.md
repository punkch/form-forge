# Standards — App Settings Page

Follows the project standards from
`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md` (strict
TypeScript, neostandard ESLint, Composition API `<script setup>`, Vitest +
Playwright) and the i18n conventions from
`docs/specs/2026-07-09-2352-ui-i18n-foundation/`. The binding invariants for
this work, from `CLAUDE.md`:

## CLAUDE.md hard invariants that apply

- **UI strings only via vue-i18n**, in the typed per-namespace catalog under
  `src/i18n/locales/en/`. This feature adds a **new `appSettings` namespace**
  (never the existing `settings` namespace, which is the per-form
  `FormSettingsDialog`). Register it in `src/i18n/locales/en/index.ts`. Use
  `useAppI18n()` in the view; `t()` is key-checked by `StrictTranslate` /
  vue-tsc, and `@intlify/eslint-plugin-vue-i18n`'s `no-missing-keys` is an error.
- **Keep rendered English byte-stable** once written. e2e/component tests assert
  substrings; changing copy later means updating those tests deliberately.
- **Preserve `data-testid`s — migrate, don't strip.** The `library-overflow-menu`
  testid is being removed, so **every consumer moves in the same change**
  (`tests/e2e/workspace-archive.spec.ts`). New affordances get new testids
  (`settings-*`); do not reuse the per-form dialog's `settings-dialog` /
  `settings-tab-*`.
- **`src/core/` stays pure** — this feature is UI/persistence/i18n only and adds
  nothing to `src/core/`. The `useWorkspaceExport` composable lives in
  `src/composables/`, not `src/core/`.
- **Persistence goes through the backend seam.** Workspace export/import reuse
  `gatherArchiveForms` / `importArchiveForms` (`src/persistence/workspace-io.ts`)
  unchanged, which already read/write through `getPersistenceBackend()`. No new
  persistence code.
- **Conventional commits** on `main`; release-please derives versions from them.

## Conventions this feature adds

- **App-level settings prose lives in `appSettings.*`**, page-shaped
  (`title`, `open`, `back`, section headings, `workspace.*`, `language.*`,
  `about.*`). Keep it distinct from the per-form `settings.*` namespace so the
  two never drift or shadow each other.
- **Supported UI locales are declared once, beside `createI18n`** as
  `SUPPORTED_LOCALES` (code → native display name). Any language picker derives
  its options from `i18n.global.availableLocales` labeled via that map — never a
  second hand-maintained list. Adding a real locale = registering its catalog +
  adding its `SUPPORTED_LOCALES` entry.
- **Locale switching goes through `setLocale` + `ui.locale`** only. Components set
  `ui.locale` and call `setLocale(code)`; persistence is the ui-store watcher's
  job (localStorage `odk-builder:ui:v1`). `setLocale` is the single point that
  syncs `<html lang>`/`dir`.
- **Workspace export logic is centralized in `useWorkspaceExport`.** The library
  card menu, the library footer backup link, and the settings page all call the
  same composable; no duplicated blob-building or filename logic.
- **Routed app-level pages are embed-gated in the router**, mirroring the
  existing `/` split: register the route only when `!embedded`, letting the
  catch-all redirect cover the embed case with no extra guard.
