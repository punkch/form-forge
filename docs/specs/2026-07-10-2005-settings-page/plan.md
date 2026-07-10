# Plan — App Settings Page behind a gear (2026-07-10)

## Context

App-level actions hide behind an unlabeled ⋯ overflow menu on the library
header (`library-overflow-menu`: workspace export/import), and the UI-language
preference already exists and persists (`ui.locale`, applied via `setLocale`)
but has no control anywhere. This work introduces a routed **App Settings**
page (`#/settings`) reached from a gear on the library header, replacing the
overflow menu, and gives the language preference a home. It also adds a minimal
About section. Central-servers stays out (central-publishing is blocked); only
an extension-point marker is left.

The shaping doc is `docs/specs/backlog/settings-page.md`. The open questions in
it are resolved in `shape.md` (gear replaces the menu with no extra header
button; minimal About with version + storage status, no update check; embed has
no gear and `/settings` is blocked; `SUPPORTED_LOCALES` descriptor beside
`createI18n`; central-servers is an extension point only; e2e helpers migrate to
`settings-*` testids in the same change).

Branch note: CLAUDE.md says "work on development" but no such branch exists and
all recent work + release-please target `main` — commits go to `main`, matching
actual practice.

### Two naming clashes discovered in the code (the plan works around both)

1. **i18n namespace `settings` is already taken** by the per-form
   `FormSettingsDialog` (`src/components/settings/`, keys `settings.dialog.*`,
   `settings.tabs.*`, `settings.entities.*`, registered in
   `src/i18n/locales/en/index.ts`). The new page therefore uses a **new
   `appSettings` namespace** — never `settings`.
2. **Testids `settings-dialog` / `settings-tab-general` / `settings-tab-entities`
   are already taken** by that same dialog (asserted in
   `tests/e2e/entities.spec.ts`, `tests/component/entities.spec.ts`). The new
   page uses distinct `settings-gear` / `settings-view` / `settings-back` /
   `settings-export-workspace` / `settings-import-workspace` /
   `settings-language-select` / `settings-about*` testids, none of which collide.
   Do **not** reuse `settings-dialog`.

## Task 1: Save spec documentation — DONE

`docs/specs/2026-07-10-2005-settings-page/` with plan.md (this file), shape.md,
standards.md, references.md, user-guide.md. (No visuals — text-only feature.)

## Implementation work packages

Four packages. **WP1 is foundation and lands first** (WP2/WP3 import from it).
**WP2 and WP3 run in parallel** after WP1. **WP4 is the integration/test-fix
package** and runs last. Strict file ownership: no two packages edit the same
file (verified below). Cross-package *imports* (not shared edits) are called out.

---

### WP1 — Foundation: shared export composable + i18n scaffolding

**Owns (create/edit):**
- `src/composables/useWorkspaceExport.ts` (NEW)
- `src/i18n/index.ts` (EDIT)
- `src/i18n/locales/en/appSettings.json` (NEW)
- `src/i18n/locales/en/index.ts` (EDIT)
- `tests/unit/workspace-export.spec.ts` (NEW)

**What to build:**

1. **`useWorkspaceExport()` composable** — lift the workspace/single-form export
   logic verbatim out of `FormLibraryView.vue` so both the library (card-menu
   single-form export + footer backup link) and the new settings page share one
   implementation. Move: `exportArchive(recordIds, filename)` (uses
   `gatherArchiveForms` + `buildWorkspaceArchive` + `downloadBlob`),
   `exportWorkspace()`, `exportFormArchive(record)`, and the pure helpers
   `localDateStamp(date)` and `appVersion()`. **Export `localDateStamp` as a
   named pure function** (unit-testable). Keep behavior byte-identical: filenames
   `formforge-workspace-<yyyy-mm-dd>.formforge.zip` and
   `<formId||'form'>.formforge.zip`.
2. **`SUPPORTED_LOCALES` descriptor** in `src/i18n/index.ts`, beside
   `createI18n`: a `code → native display name` map for locales the app knows how
   to name, e.g. `export const SUPPORTED_LOCALES: Record<string, string> = { en:
   'English' }`. Add a small exported helper
   `export const localeOptions = (): { code: string; label: string }[]` that maps
   **`i18n.global.availableLocales`** to `{ code, label: SUPPORTED_LOCALES[code]
   ?? code }`. This is the seam the picker maps over: production ships only `en`
   (one option), and a test that registers a second catalog via
   `i18n.global.setLocaleMessage(...)` makes a second option appear without
   mutating any const — satisfying the "tests may register a test catalog"
   requirement. (RTL/`dir` is already handled inside `setLocale`.)
3. **`appSettings.json`** — new `appSettings` namespace with all page copy:
   `title`, `open` (gear aria-label, e.g. "Settings"), `back` (reuse the sense of
   "Back to forms" — a new key so the library's `shell.nav.backToForms` isn't
   overloaded), section headings, `workspace.*` (export button + description,
   import button + description — moved in spirit from `library.workspace.*`),
   `language.*` (heading, label, `appLanguageNote` clarifying this is the builder
   UI language, not form translations), `about.*` (heading, `version`,
   `storagePersistent`, `storageNotPersistent`, `storageUnknown`). Register it in
   `src/i18n/locales/en/index.ts` (import + spread into `en`). Keep rendered
   English intentional and byte-stable thereafter.

**Tests (WP1):** `tests/unit/workspace-export.spec.ts` — `localDateStamp` formats
local date parts (not UTC) as `yyyy-mm-dd`; `localeOptions()` returns one `en`
option by default and a second option after `i18n.global.setLocaleMessage('xx',
…)`; the `appVersion()` fallback shape. (Do **not** touch
`tests/component/i18n-smoke.spec.ts` — it is namespace-agnostic wiring and keeps
passing; adding a namespace won't break it.)

---

### WP2 — Settings view + route + embed gating

**Depends on WP1** (imports `useWorkspaceExport`, `SUPPORTED_LOCALES` /
`localeOptions`, and `appSettings.*` keys).

**Owns (create/edit):**
- `src/views/SettingsView.vue` (NEW)
- `src/router/index.ts` (EDIT)
- `tests/component/settings-view.spec.ts` (NEW)
- `tests/unit/settings-route.spec.ts` (NEW)

**What to build:**

1. **`SettingsView.vue`** — a routed page following `FullPreviewView.vue`'s
   simple-page conventions (top bar with a back button, scrollable body; the page
   is self-contained with sections inline, like `FormLibraryView` keeps its
   dialogs inline). Root `data-testid="settings-view"`. Header: back Button
   (`icon="pi pi-arrow-left"`, `data-testid="settings-back"`) →
   `router.push({ name: 'library' })`; page title from `appSettings.title`.
   Sections as plain page panels (not nested dialogs):
   - **Workspace** — "Export workspace" Button
     (`data-testid="settings-export-workspace"`, disabled when
     `workspace.forms.length === 0`) calling `useWorkspaceExport().exportWorkspace`;
     "Import workspace" Button (`data-testid="settings-import-workspace"`) opening
     the reused `WorkspaceArchiveDialog` (mount it here with a local
     `workspaceImportVisible` ref — this mount moves out of the library).
   - **Language** — a PrimeVue `Select` (`data-testid="settings-language-select"`)
     whose options are `localeOptions()`, value bound to `ui.locale`; on change
     call `setLocale(code)` and set `ui.locale = code` (persistence is automatic
     via the ui store watcher). Show `appSettings.language.appLanguageNote`.
   - **About** (`data-testid="settings-about"`) — app version
     (`data-testid="settings-about-version"`, from `__APP_VERSION__` via the
     composable's `appVersion()`); storage-persistence status
     (`data-testid="settings-about-storage"`) resolved with
     `isStoragePersistent()` (granted / not granted / unavailable → the three
     `appSettings.about.storage*` strings). **No update check** (see shape.md).
   - **Central servers** — no UI; a single clearly-marked code comment as an
     extension point (`<!-- Extension point: central-servers section ships with
     central-publishing (docs/specs/backlog/central-publishing.md) -->`).
2. **Route** in `src/router/index.ts`: add a `{ path: '/settings', name:
   'settings', component: () => import('@/views/SettingsView.vue') }` entry,
   **registered only when `!embedded`** (mirror the existing `embedded ? … : …`
   pattern used for `/`). In embed mode the route is absent, so `#/settings`
   falls through the existing catch-all `/:pathMatch(.*)*` → redirect to `/` (the
   embed waiting screen) — no extra guard needed.

**Tests (WP2):**
- `tests/component/settings-view.spec.ts` — sections render; **language switch +
  persistence**: register a test catalog
  (`i18n.global.setLocaleMessage('eo', { … })`) so a second option appears,
  select it, assert `setLocale` ran (`i18n.global.locale.value === 'eo'` /
  `<html lang>`) and `ui.locale` was written to `localStorage`
  (`odk-builder:ui:v1`); export button invokes the composable (mock/spy
  `downloadBlob` or `buildWorkspaceArchive`); import button reveals
  `workspace-archive-dialog`; About shows a version and a storage line.
- `tests/unit/settings-route.spec.ts` — with `@/embed/detect` mocked so
  `embedDetection()` is inactive, the router resolves `name: 'settings'`; with it
  active (and `vi.resetModules()` + re-import), `/settings` resolves to the
  catch-all redirect to `/`. This is the reliable proof of "embed blocks the
  route" (cleaner than an embed e2e).

---

### WP3 — Library gear replaces the overflow menu

**Depends on WP1** (imports `useWorkspaceExport`). Uses route `name: 'settings'`
(runtime-resolved; integration in WP4 confirms the full flow).

**Owns (edit):**
- `src/views/FormLibraryView.vue` (EDIT)
- `src/i18n/locales/en/library.json` (EDIT)
- `tests/component/form-library-view.spec.ts` (EDIT if needed)

**What to build:**

1. In `FormLibraryView.vue`: **remove** the `library-overflow-menu` Button, the
   `<Menu ref="workspaceMenu">`, `workspaceMenuItems`, `openWorkspaceMenu`, the
   `workspaceImportVisible` ref, and the `<WorkspaceArchiveDialog>` mount (all
   move to the settings page). **Remove** the local export helpers now living in
   the composable (`exportArchive`, `exportWorkspace`, `exportFormArchive`,
   `localDateStamp`, `appVersion`) and import them from `useWorkspaceExport`
   instead; drop now-unused imports (`buildWorkspaceArchive`,
   `gatherArchiveForms`, and `downloadBlob`/`Menu` if unused after the move).
   **Add** a gear Button in the header actions: `icon="pi pi-cog"`,
   `severity="secondary" text rounded`, `data-testid="settings-gear"`,
   `:aria-label="t('appSettings.open')"`, `@click="router.push({ name: 'settings'
   })"`. Keep `import-form` and `new-form` as the primary header buttons.
   **Keep** the card-menu "Export archive" item (now `exportFormArchive` from the
   composable) and the footer storage-hint "export a workspace backup" link (now
   `exportWorkspace` from the composable) — both stay direct, one-click.
2. In `library.json`: remove the moved keys `workspace.exportWorkspace`,
   `workspace.importWorkspace`, `workspace.menuLabel`; **keep**
   `workspace.exportArchive` (card menu) and all `footer.*` keys.

**Tests (WP3):** update `tests/component/form-library-view.spec.ts` only if it
asserts removed markup (current file does not reference the overflow menu, so
likely a no-op; add a small assertion that `settings-gear` renders and routes).

---

### WP4 — Integration, e2e migration, suite green

**Depends on WP2 + WP3.**

**Owns (edit/create):**
- `tests/e2e/workspace-archive.spec.ts` (EDIT)
- `tests/e2e/settings.spec.ts` (NEW)

**What to build:**

1. **Migrate `workspace-archive.spec.ts`** off `library-overflow-menu` (two
   sites, lines ~29 and ~54). New export flow: from the library, click
   `settings-gear` → on the settings page click `settings-export-workspace`
   (still assert the download filename regex). New import flow: `settings-gear` →
   `settings-import-workspace` → existing `workspace-archive-*` dialog testids
   unchanged. The single-form card-menu "Export archive" test is untouched (that
   affordance stays in the library).
2. **New `tests/e2e/settings.spec.ts`** — gear on the library routes to
   `#/settings` (`settings-view` visible); `settings-back` returns to the
   library; the Language section renders the shipped `en` option; About shows a
   version line and a storage line. (Language *switch persistence* is covered at
   component level in WP2; embed *route blocking* is covered by the WP2 router
   unit test — no embed e2e edit needed.)
3. Run the full suite; fix any fallout from the file moves (imports, unused
   symbols, coverage floors).

---

## Execution

WP1 first (small; foundation). WP2 and WP3 as parallel agents with strict file
ownership. WP4 last in the main loop. i18n namespaces are per-package
(`appSettings.json` = WP1; `library.json` = WP3) so no string file is shared.

## Verification (definition of done)

Commands:
- `pnpm lint` — clean (incl. `@intlify/no-missing-keys`; no raw UI strings).
- `pnpm typecheck` — clean (`appSettings` keys resolve through `StrictTranslate`;
  no unknown keys).
- `pnpm test` — unit + component green, coverage floors still met
  (`pnpm test:coverage`).
- `pnpm build && pnpm test:e2e` — chromium + firefox green after the testid
  migration.

Plus:
- agent-browser pass over the built app (gear → settings → export/import,
  language section, About, back link; confirm no gear and `#/settings` redirect
  in the embed demo host) logged to `docs/verification/2026-07-10-settings-page/`.
- `/code-review` (five lenses, no plan mode); fix findings immediately.
- Conventional commits on `main`, grouped by area (e.g.
  `feat(settings): routed app settings page behind a gear`,
  `refactor(library): gear replaces the workspace overflow menu`,
  `refactor(i18n): SUPPORTED_LOCALES descriptor + appSettings catalog`,
  `test(e2e): migrate workspace archive to the settings page`). Do **not** commit
  `tests/golden/complex/` (untracked leftover).
- Update `README.md` Features, `docs/product/roadmap.md`, and `CLAUDE.md`
  (settings view + `appSettings` namespace + `useWorkspaceExport`) in the same
  change.

## Acceptance criteria (from the backlog doc)

- The gear on the library header routes to `#/settings`.
- Workspace export/import work from the settings page, with the existing tests
  migrated (no `library-overflow-menu` left in code or tests).
- The Language section lists supported catalogs by native name and a switch
  persists across reload (asserted with a registered test catalog until a second
  real locale lands).
- Embed mode shows no gear and the `#/settings` route is blocked (redirects to
  the waiting screen).
- Full unit/component/e2e suite green after the testid migration.
