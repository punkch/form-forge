# References for In-app guidance

## The pattern to copy: in-app help system

### Content registry → i18n catalog

- **Location:** `src/help/content.ts`, `src/help/search.ts`,
  `src/i18n/locales/en/help.json`, `src/i18n/locales/en/index.ts`.
- **Relevance:** `guideHelp` is the exact shape of `typeHelp`/`fieldHelp` — a
  typed index of literal `MessageKey`s so vue-tsc catches a missing/misspelled
  catalog entry. `guides.json` is registered like `help.json`.
- **Key patterns:** `satisfies Record<Key, Shape>`; `docsUrl()` resolves a bare
  anchor vs an absolute URL; `MessageKey = NestedKey<typeof en>` auto-extends
  when the new namespace is merged.

### Drawer with list + detail modes

- **Location:** `src/components/help/QuestionTypeHelpDrawer.vue`,
  `QuestionTypeHelpContent.vue`, `HelpPopover.vue`; `src/stores/editor.ts`
  (`helpTypeId`, `openTypeHelp`).
- **Relevance:** the drawer already does list-vs-detail off `helpTypeId` and
  `activeDialog === 'help-reference'`; guides add a parallel `helpGuideId` +
  `openGuideHelp` and a Guides section in list mode. `GuideContent.vue` mirrors
  `QuestionTypeHelpContent.vue`; `GuideTrigger.vue` is a drawer-opening variant
  of `HelpPopover.vue` (note HelpPopover's non-`<button>` workaround — only
  needed inside a field `<label>`, which the guide triggers are not).

### Persisted, dismissable UI state

- **Location:** `src/stores/ui.ts` — `storageHintDismissed` /
  `dismissStorageHint()` and the `PersistedUiState` + `watch` persistence.
- **Relevance:** `dismissedCallouts: string[]` / `dismissCallout(id)` /
  `isCalloutDismissed(id)` follow the same load → ref → watch → localStorage
  path (`odk-builder:ui:v1`). This is what makes callout dismissal survive
  reload.

## Contextual surfaces the triggers/callouts attach to

- **Translations:** `src/components/translations/TranslationsDialog.vue`,
  `TranslationGrid.vue`, `src/core/model/translations.ts`. NOTE: reshaped by the
  translation-coverage feature (editing-language control moves to the properties
  panel; grid shows empty sites) — read the live surface at implementation time.
- **Logic builder:** `src/components/logic/ConditionBuilder.vue` (the
  `builder-header`, the `mode`/`canVisual` derivation, the `rawOnlyNote`) and
  `src/components/properties/LogicSection.vue`.
- **Dataset section:** `src/components/properties/ChoicesSection.vue` (itemset /
  external-file affordance); preview in
  `src/components/datasets/DatasetPreviewDialog.vue`.
- **Entity section:** `src/components/properties/EntitySection.vue` (the
  `save_to` field). Declaration UI is in `FormSettingsDialog.vue` — avoid it
  (settings-page feature owns it).
- **Library toolbar:** `src/views/FormLibraryView.vue` (`library-actions`;
  overflow `workspaceMenu` for export/import). Mount the drawer here.
- **Header Help button:** `src/components/shell/AppHeader.vue` — already opens
  the drawer list; needs no change.
- **Drawer mount:** `src/components/EditorDialogs.vue` (editor route only).

## Guide content sources (adapt, don't invent)

The prose largely exists in delivered specs' `user-guide.md`. Package A adapts
each into numbered, task-oriented steps.

| GuideKey | Source(s) |
| --- | --- |
| `logic` | `docs/specs/2026-07-10-1000-visual-logic-builder/user-guide.md` |
| `datasets` | `docs/specs/2026-07-10-0850-external-dataset-tooling/user-guide.md` + `docs/specs/2026-07-10-0725-dataset-upload-affordance/user-guide.md` |
| `entities` | `docs/specs/2026-07-10-1000-entities-advanced/user-guide.md` |
| `backup` | `docs/specs/2026-07-09-2352-workspace-export-import/user-guide.md` |
| `templates` | `docs/specs/2026-07-10-0725-form-templates/user-guide.md` |
| `keyboard` | `docs/specs/2026-07-09-1910-ux-overhaul-resizable-responsive/user-guide.md` (panel-resize keys) + the tree bindings in `src/components/canvas/TreeNodeCard.vue` (Alt+↑/↓ move, Alt+→/← indent/outdent, Delete, ↑/↓ roving focus) |
| `autosave` | `docs/specs/2026-07-09-2352-workspace-export-import/` (snapshots excluded from archives) + `src/stores/form.ts`, `src/persistence/forms-repo.ts`, `src/persistence/db.ts` (snapshots table, kinds `open`/`auto`/`manual`/`import`, last-20 pruning) + `src/views/FormEditorView.vue` (beforeunload guard) + `SaveIndicator.vue`. Confirm the real recovery entry point before writing a restore step. |
| `translations` | No source `user-guide.md` exists (`docs/specs/2026-07-09-1748-choices-cascades-translations/` has only `shape.md`). Derive from the live post-translation-coverage `TranslationsDialog.vue` + `TranslationGrid.vue` + `src/core/model/translations.ts` (languageKey `Name (code)`, first-language migration, default language, editing-language retargeting, no-fallback rule). |

## External docs (deep links)

- docs.getodk.org — `docsUrl` targets for `translations` (form language),
  `logic` (form logic), `datasets` (datasets/attachments), `entities`
  (entities). Verify each anchor against the live page during implementation
  (fetch, don't guess), as the in-app-help spec did for `docsAnchor`. The
  app-specific guides (`backup`, `templates`, `autosave`, `keyboard`) have no ODK
  docs equivalent and carry no `docsUrl`.
