# Spec 05: Choices Manager, Cascading Selects & Translations — Shaping Notes

## Scope

The choice-list management surface (manager dialog + visual cascade editor)
and the translations workflow (language management, translation grid, canvas
display language). See the Spec 01 folder for the full program plan.

## Decisions

- **Pure logic lives in core.** Two new modules under `src/core/model/`:
  `choice-lists.ts` (usage map, rename-with-ref-update, delete-with-ref-clear,
  extra-column helpers, simple `col=${parent}` filter parse/build) and
  `translations.ts` (canonical `languageKey('French','fr') → 'French (fr)'`,
  `transformLocalizedTexts` walking every LocalizedText incl. media refs,
  bind messages and translated custom columns, add/remove-language
  migrations, translatable-site collection via `visit()`, per-language
  stats). Components only orchestrate `form.mutate` around these helpers.
- **Rename/delete are single mutations** — `renameChoiceList` moves the
  record key, `list.name` and every question's `listRef` in one
  `form.mutate('Rename choice list', …)`, so one undo restores everything.
  Deleting an in-use list warns inline (two-step confirm, no ConfirmDialog
  service) and clears the affected questions' `listRef`.
- **Cascade editor is derived, not stateful**: the visual/raw split follows
  `parseSimpleChoiceFilter` — a filter matching `column=${parent}` (or empty)
  shows visual mode; anything else forces raw mode (ExpressionInput,
  `field="choiceFilter"`). The Advanced toggle can only *add* raw mode on top
  of a representable filter. Parent candidates are the select_one questions
  *before* this node in document order. Picking parent + column writes the
  generated filter and `ensureFilterColumn`s the list (order entry + empty
  extras per choice) in one mutate; per-choice dropdowns assign parent choice
  values into `choice.extras[column]`.
- **First-language migration keeps 'default'.** `addLanguage` on an empty
  `doc.languages` copies every DEFAULT_LANG value into the new key so itext
  output has no holes; the sentinel stays for plain-column round-trips.
  `removeLanguage` strips the key from every LocalizedText (dropping texts
  that end up empty) and clears `settings.defaultLanguage` when it pointed at
  the removed language.
- **Translation grid rows are collected sites**, not raw nodes: label, hint,
  guidance hint, required/constraint messages per node in doc order, then
  choice labels per list. Sites with no value in any language are skipped
  (nothing to translate). Cells write via
  `form.mutate('Edit translation <siteKey>::<lang>', …)` — the label carries
  the cell identity so mutate's label-based coalescing is per-cell.
  Completeness counters and the untranslated-only filter derive from the same
  site list. Plain table (no virtualization yet — Spec 08 perf pass).
- **Display language is editor state**: `editor.displayLanguage: string | null`
  (null = DEFAULT_LANG), reset with the editor store. TreeNodeCard displays
  `displayText(label, displayLanguage ?? undefined)` (fallback chain intact);
  BasicSection displays the same but *writes* to
  `displayLanguage ?? DEFAULT_LANG`, so editing while viewing French creates
  the French translation. The switcher lives in the TranslationsDialog.
- **Dialogs are store-driven**: both dialogs derive `visible` from
  `editor.activeDialog` ('choice-lists' / 'translations') and clear it on
  close. `src/components/EditorDialogs.vue` is the single mount point the
  integrator adds to the editor view; menu entries only set the store value.
- Component tests stub `teleport` and wait one tick after mount — PrimeVue's
  Portal renders dialog bodies one update cycle after `onMounted`.

## Context

- **References:** docs.getodk.org cascading-selects (choice_filter +
  filter-column convention), XLSForm translation column syntax
  (`label::French (fr)`), existing `ChoicesSection`/`ExpressionInput`
  patterns from Spec 03.
- **Out of scope (per plan):** itext/randomize/seed serializer completion
  (already landed in Spec 04's serializer), menu wiring in
  AppHeader/FormEditorView (integrator), grid virtualization + agent-browser
  verification of the preview language dropdown (Spec 08 hardening).
- **Verification:** 57 new tests (26 unit on the two core modules; component
  suites for the manager dialog, cascade editor, translations dialog, grid,
  display language, EditorDialogs). All dialogs fully functional when
  `editor.activeDialog` is set programmatically.
