# References — App Settings Page

Real paths studied during shaping, and why each matters.

## Reuse as-is (do not modify)

- **`src/components/importexport/WorkspaceArchiveDialog.vue`** — the whole-library
  import UI (drag/drop, parse report, `workspace-archive-*` testids). Mounted on
  the settings page's "Import workspace" action instead of the library. Unchanged.
- **`src/persistence/workspace-io.ts`** — `gatherArchiveForms(recordIds?)` and
  `importArchiveForms(parsed)`, both already reading/writing via
  `getPersistenceBackend()`. The export composable calls `gatherArchiveForms`;
  the dialog calls `importArchiveForms`. Unchanged.
- **`src/core/workspace/archive.ts`** — `buildWorkspaceArchive` /
  `readWorkspaceArchive`. Called from the composable / dialog. Unchanged.
- **`src/composables/useDownload.ts`** — `downloadBlob(data, name, type)`, used by
  the export composable. Unchanged.
- **`src/pwa/persistentStorage.ts`** — `isStoragePersistent()` returns
  `true | false | null` (null = API unavailable). Drives the About storage line.
  The library footer already uses it; the settings About section reuses it.

## Patterns to mirror

- **`src/views/FullPreviewView.vue`** — the template for a simple routed page: a
  top bar with a back Button (`icon="pi pi-arrow-left"`, its own testid
  `back-to-editor`) + title, then a scrollable body. `SettingsView.vue` follows
  this shape (its own `settings-back`, **not** the editor's `back-to-library`).
- **`src/views/FormLibraryView.vue`** — source of the code being moved/replaced:
  - overflow menu to remove: `library-overflow-menu` Button + `workspaceMenu`
    `<Menu>` + `workspaceMenuItems` + `openWorkspaceMenu` + `workspaceImportVisible`
    + the `<WorkspaceArchiveDialog>` mount (lines ~135–174, ~207–216, ~341).
  - export helpers to lift into the composable: `exportArchive`, `exportWorkspace`,
    `exportFormArchive`, `localDateStamp`, `appVersion` (lines ~138–160).
  - stays in the library: card-menu `library.workspace.exportArchive`
    (`exportFormArchive`) and footer storage-hint link calling `exportWorkspace`
    (lines ~123, ~294–295) — both now sourced from the composable.
- **`src/router/index.ts`** — hash history (`createWebHashHistory`); `embedded =
  embedDetection().active` already switches `/` between the library and the
  waiting view. Add the embed-gated `/settings` route the same way; the existing
  `/:pathMatch(.*)*` → `/` catch-all covers the embed redirect.
- **`src/i18n/index.ts` / `setLocale.ts` / `locales/en/index.ts`** — `createI18n`
  (Composition mode, `StrictTranslate`), `setLocale` (syncs `<html lang>`/`dir`,
  one shipped locale today), and the per-namespace catalog assembly (each JSON's
  single top-level key is its namespace; add `appSettings`). `SUPPORTED_LOCALES`
  lives beside `createI18n` here.
- **`src/stores/ui.ts`** — `locale` ref (BCP-47, default `en`) persisted to
  `localStorage` key `odk-builder:ui:v1` by the deep watcher. The picker writes
  `ui.locale`; no store change needed.

## Clash sources (must NOT be reused)

- **`src/components/settings/FormSettingsDialog.vue`** — owns the `settings.*`
  i18n namespace and the `settings-dialog` / `settings-tab-general` /
  `settings-tab-entities` testids (asserted in `tests/e2e/entities.spec.ts`,
  `tests/component/entities.spec.ts`). The new page must not touch these →
  `appSettings` namespace + distinct `settings-gear`/`settings-view`/… testids.

## Test surfaces to migrate / add

- **`tests/e2e/workspace-archive.spec.ts`** — the only `library-overflow-menu`
  consumer (lines 29, 54). Migrate both to the `settings-gear` → settings-page
  flow. `workspace-archive-*` dialog testids stay.
- **`tests/component/form-library-view.spec.ts`** — does not reference the
  overflow menu today; add a `settings-gear` render/route assertion.
- **`tests/component/i18n-smoke.spec.ts`** — namespace-agnostic wiring; unchanged.

## New files

- `src/composables/useWorkspaceExport.ts`
- `src/views/SettingsView.vue`
- `src/i18n/locales/en/appSettings.json`
- `tests/unit/workspace-export.spec.ts`
- `tests/unit/settings-route.spec.ts`
- `tests/component/settings-view.spec.ts`
- `tests/e2e/settings.spec.ts`

## New test IDs

`settings-gear`, `settings-view`, `settings-back`, `settings-export-workspace`,
`settings-import-workspace`, `settings-language-select`, `settings-about`,
`settings-about-version`, `settings-about-storage`.
